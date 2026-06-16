import { STORAGE_KEYS } from '../constants';
import { readBudgetData, getActualDataKey } from './storageKeys';
import { parseMonthIndex, shouldIncludeMonth } from './monthFilter';

export interface AttributionOverride {
  id: string; // `${year}_${planType}_${sourceDeptCode}_${accountCode}_${originalAssignedDeptCode}`
  year: string;
  planType: string;
  sourceDeptCode: string;
  sourceDeptName: string;
  originalAssignedDeptCode: string;
  originalAssignedDeptName: string;
  newAssignedDeptCode: string;
  newAssignedDeptName: string;
  accountCode: string;
  accountName: string;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export interface AttributionCandidate {
  deptCode: string;
  deptName: string;
  score: number;
  reasons: AttributionReason[];
  budgetAmount: number;
  actualAmount: number;
  remainingBudget: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AttributionReason {
  type:
    | 'HAS_BUDGET'
    | 'BUDGET_REMAINING'
    | 'SOURCE_NO_BUDGET'
    | 'ACCOUNT_KEYWORD_MATCH'
    | 'DEPT_NAME_MATCH'
    | 'HISTORICAL_PATTERN'
    | 'PEER_ACTUAL_PATTERN'
    | 'MONTHLY_PATTERN'
    | 'PROCESS_RULE'
    | 'CURRENT_DEPT_MISMATCH';
  label: string;
  weight: number;
}

export interface AttributionRecommendation {
  rowId: string | number;
  year: string;
  period: string;
  originalDeptCode: string;
  originalDeptName: string;
  accountCode: string;
  accountName: string;
  amount: number;
  currentAttributedDeptCode?: string;
  recommendedDeptCode: string;
  recommendedDeptName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  candidates: AttributionCandidate[];
  reasons: AttributionReason[];
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AttributionAuditLog {
  id: string;
  year: string;
  period: string;
  rowId: string | number;
  accountCode: string;
  accountName: string;
  originalDeptCode: string;
  originalDeptName: string;
  beforeAttributedDeptCode?: string;
  beforeAttributedDeptName?: string;
  afterAttributedDeptCode: string;
  afterAttributedDeptName: string;
  score: number;
  reasons: string[];
  action: 'APPLY' | 'BULK_APPLY' | 'IGNORE' | 'MANUAL_CHANGE';
  userCode?: string;
  userName?: string;
  time: string;
}

const ATTRIBUTION_KEYWORD_RULES = [
  {
    keywords: ['수선비_eic', 'eic', '전기', '계장', '계측', '제어'],
    deptKeywords: ['eic', '전기', '계장', '정비', '설비'],
    weight: 25,
  },
  {
    keywords: ['수선비_기계장치', '기계장치', '기계', '설비'],
    deptKeywords: ['기계', '정비', '설비'],
    weight: 25,
  },
  {
    keywords: ['정비외주', '정비용역비', '외주용역비_정비'],
    deptKeywords: ['정비', '설비', '공무'],
    weight: 25,
  },
  {
    keywords: ['안전관리비', '안전'],
    deptKeywords: ['안전'],
    weight: 25,
  },
  {
    keywords: ['환경관리비', '환경'],
    deptKeywords: ['환경'],
    weight: 25,
  },
  {
    keywords: ['품질관리비', '품질', '분석'],
    deptKeywords: ['품질', '분석'],
    weight: 25,
  },
  {
    keywords: ['전력비', '용수비', '연료유지비', '유틸리티'],
    deptKeywords: ['유틸리티', '동력', '공무', '생산지원'],
    weight: 20,
  },
];

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .toLowerCase();
}

export function getKeywordDeptMatchScore(accountName: string, deptName: string): number {
  const acc = normalizeText(accountName);
  const dept = normalizeText(deptName);

  for (const rule of ATTRIBUTION_KEYWORD_RULES) {
    const accountMatched = rule.keywords.some(k => acc.includes(normalizeText(k)));
    const deptMatched = rule.deptKeywords.some(k => dept.includes(normalizeText(k)));

    if (accountMatched && deptMatched) return rule.weight;
  }

  return 0;
}

export function getDeptAccountBudgetAmount(params: {
  deptCode: string;
  accountCode: string;
  budgetRowsByDept: Map<string, any[]>;
  monthMode: 'MONTH' | 'YTD';
  selectedMonth: number;
}): number {
  const rows = params.budgetRowsByDept.get(params.deptCode) || [];
  const found = rows.find(r => r.code === params.accountCode);
  if (!found) return 0;

  if (params.monthMode === 'MONTH') {
    return Number(found.values?.[params.selectedMonth - 1] || 0);
  } else {
    return (found.values || [])
      .slice(0, params.selectedMonth)
      .reduce((sum: number, v: any) => sum + Number(v || 0), 0);
  }
}

export function getDeptAccountActualAmount(params: {
  deptCode: string;
  accountCode: string;
  actualRows: any[];
  monthMode: 'MONTH' | 'YTD';
  selectedMonth: number;
}): number {
  let total = 0;
  params.actualRows.forEach(row => {
    const effectiveDept = row.attributedDeptCode || row.usageCode;
    if (effectiveDept !== params.deptCode || row.accountCode !== params.accountCode) return;

    const monthIndex = parseMonthIndex(row.period);
    if (!shouldIncludeMonth(monthIndex, params.monthMode, params.selectedMonth)) return;

    total += Number(row.completed || 0);
  });
  return total;
}

export function getHistoricalOverrideScore(params: {
  accountCode: string;
  accountName: string;
  deptCode: string;
  previousOverrides: AttributionOverride[] | unknown;
}): number {
  const previousOverrides = Array.isArray(params.previousOverrides)
    ? params.previousOverrides
    : [];

  const hasHistory = previousOverrides.some(
    ov => ov && typeof ov === 'object' && 'accountCode' in ov && 'newAssignedDeptCode' in ov &&
          (ov as any).accountCode === params.accountCode && (ov as any).newAssignedDeptCode === params.deptCode
  );
  return hasHistory ? 25 : 0;
}

export function getBudgetDominanceSignal(params: {
  accountCode: string;
  departments: any[];
  budgetRowsByDept: Map<string, any[]>;
  selectedMonth: number;
  monthMode: 'MONTH' | 'YTD';
}) {
  const rows = params.departments.map(dept => {
    const amount = getDeptAccountBudgetAmount({
      deptCode: dept.code,
      accountCode: params.accountCode,
      budgetRowsByDept: params.budgetRowsByDept,
      selectedMonth: params.selectedMonth,
      monthMode: params.monthMode,
    });

    return {
      deptCode: dept.code,
      deptName: dept.name,
      amount,
    };
  });

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  if (total <= 0) return null;

  const sorted = rows.sort((a, b) => b.amount - a.amount);
  const top = sorted[0];

  const share = top.amount / total;

  if (share >= 0.6) {
    return {
      deptCode: top.deptCode,
      deptName: top.deptName,
      budgetAmount: top.amount,
      share,
    };
  }

  return null;
}

export function getActualDominanceSignal(params: {
  accountCode: string;
  actualRows: any[];
  selectedMonth: number;
  monthMode: 'MONTH' | 'YTD';
}) {
  const byDept = new Map<string, number>();

  params.actualRows.forEach(row => {
    if (row.accountCode !== params.accountCode) return;

    const monthIndex = parseMonthIndex(row.period);
    if (!shouldIncludeMonth(monthIndex, params.monthMode, params.selectedMonth)) return;

    const deptCode = row.attributedDeptCode || row.usageCode;
    byDept.set(deptCode, (byDept.get(deptCode) || 0) + Number(row.completed || 0));
  });

  const rows = Array.from(byDept.entries())
    .map(([deptCode, amount]) => ({ deptCode, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  if (total <= 0 || rows.length === 0) return null;

  const top = rows[0];
  const share = top.amount / total;

  if (share >= 0.6) {
    return {
      deptCode: top.deptCode,
      amount: top.amount,
      share,
    };
  }

  return null;
}

export type AttributionExcludeReason =
  | 'PAYROLL'
  | 'TRAVEL'
  | 'VEHICLE'
  | 'WELFARE'
  | 'TRAINING'
  | 'MEETING'
  | 'BUSINESS_ACTIVITY'
  | 'OTHER_EXCLUDED';

export interface AttributionExcludeResult {
  excluded: boolean;
  reason?: AttributionExcludeReason;
  label?: string;
  matchedKeyword?: string;
}

function normalizeForAttribution(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[()（）\-_]/g, '')
    .toLowerCase();
}

const ATTRIBUTION_EXCLUDE_RULES: Array<{
  reason: AttributionExcludeReason;
  label: string;
  keywords: string[];
}> = [
  {
    reason: 'PAYROLL',
    label: '급여성 계정',
    keywords: [
      '급여',
      '임금',
      '상여',
      '성과금',
      '경영성과금',
      '퇴직금',
      '퇴직급여',
      '퇴직급여충당',
      '직책수당',
      '임원활동수당',
      '임원급여',
      '직원급여',
      '인건비',
      '연차수당',
    ],
  },
  {
    reason: 'VEHICLE',
    label: '차량 관련 계정',
    keywords: [
      '차량유지비',
      '차량유류지원비',
      '차량유류비',
      '유류비',
      '주차비',
      '통행료',
      '하이패스',
    ],
  },
  {
    reason: 'TRAVEL',
    label: '여비교통비 계정',
    keywords: [
      '여비교통비',
      '국내여비',
      '해외여비',
      '출장비',
      '교통비',
      '숙박비',
      '일비',
    ],
  },
  {
    reason: 'TRAINING',
    label: '교육훈련 계정',
    keywords: [
      '교육훈련비',
      '교육비',
      '훈련비',
      '세미나',
      '워크숍',
      '워크샵',
    ],
  },
  {
    reason: 'WELFARE',
    label: '복리후생 계정',
    keywords: [
      '직원중식비',
      '중식비',
      '식대',
      '복지카드비용',
      '복지카드',
      '복리후생비',
      '자녀교육비',
      '주택임차료',
      '건강검진',
      '경조사',
    ],
  },
  {
    reason: 'MEETING',
    label: '회의·간담회 계정',
    keywords: [
      '회의비',
      '직원간담회지원',
      '간담회',
      '부서별그룹활동지원',
      '그룹활동지원',
      '부서활동',
      '부서별활동',
    ],
  },
  {
    reason: 'BUSINESS_ACTIVITY',
    label: '업무활동경비 계정',
    keywords: [
      '업무활동경비',
      '활동지원',
      '업무추진',
      '업무추진비',
    ],
  },
];

export function getAttributionExcludeResult(
  accountCode: string,
  accountName: string
): AttributionExcludeResult {
  const text = normalizeForAttribution(`${accountCode} ${accountName}`);

  for (const rule of ATTRIBUTION_EXCLUDE_RULES) {
    const matchedKeyword = rule.keywords.find(keyword =>
      text.includes(normalizeForAttribution(keyword))
    );

    if (matchedKeyword) {
      return {
        excluded: true,
        reason: rule.reason,
        label: rule.label,
        matchedKeyword,
      };
    }
  }

  return { excluded: false };
}

export function isExcludedFromAttributionRecommendation(
  accountCode: string,
  accountName: string
): boolean {
  return getAttributionExcludeResult(accountCode, accountName).excluded;
}

export function recommendAttributionForRow(params: {
  row: any;
  year: string;
  planType: string;
  monthMode: 'MONTH' | 'YTD';
  selectedMonth: number;
  departments: any[];
  budgetRowsByDept: Map<string, any[]>;
  actualRows: any[];
  previousOverrides: AttributionOverride[] | unknown;
}): AttributionRecommendation | null {
  const rowAmount = Number(params.row.completed || 0);
  if (!rowAmount) return null;

  const accountCode = params.row.accountCode;
  const accountName = params.row.accountName;
  const originalDeptCode = params.row.usageCode;

  const excludeResult = getAttributionExcludeResult(accountCode, accountName);
  if (excludeResult.excluded) {
    return null;
  }

  const dominance = getBudgetDominanceSignal({
    accountCode,
    departments: params.departments,
    budgetRowsByDept: params.budgetRowsByDept,
    selectedMonth: params.selectedMonth,
    monthMode: params.monthMode,
  });

  const candidates = params.departments.map(dept => {
    const budgetAmount = getDeptAccountBudgetAmount({
      deptCode: dept.code,
      accountCode,
      budgetRowsByDept: params.budgetRowsByDept,
      monthMode: params.monthMode,
      selectedMonth: params.selectedMonth,
    });

    const actualAmount = getDeptAccountActualAmount({
      deptCode: dept.code,
      accountCode,
      actualRows: params.actualRows,
      monthMode: params.monthMode,
      selectedMonth: params.selectedMonth,
    });

    const remainingBudget = budgetAmount - actualAmount;
    const reasons: AttributionReason[] = [];

    if (budgetAmount > 0) {
      reasons.push({
        type: 'HAS_BUDGET',
        label: `${dept.name}에 동일 계정 예산이 있습니다.`,
        weight: 35,
      });
    }

    if (budgetAmount > 0 && remainingBudget >= rowAmount) {
      reasons.push({
        type: 'BUDGET_REMAINING',
        label: `${dept.name}의 예산 잔액이 실적금액 이상입니다.`,
        weight: 20,
      });
    }

    const originalBudget = getDeptAccountBudgetAmount({
      deptCode: originalDeptCode,
      accountCode,
      budgetRowsByDept: params.budgetRowsByDept,
      monthMode: params.monthMode,
      selectedMonth: params.selectedMonth,
    });

    if (dept.code !== originalDeptCode && originalBudget === 0 && budgetAmount > 0) {
      reasons.push({
        type: 'SOURCE_NO_BUDGET',
        label: `현재 부서에는 예산이 없고, ${dept.name}에는 예산이 있습니다.`,
        weight: 25,
      });
    }

    const keywordScore = getKeywordDeptMatchScore(accountName, dept.name);
    if (keywordScore > 0) {
      reasons.push({
        type: 'ACCOUNT_KEYWORD_MATCH',
        label: `계정명과 부서명이 업무 성격상 일치합니다.`,
        weight: keywordScore,
      });
    }

    const historicalScore = getHistoricalOverrideScore({
      accountCode,
      accountName,
      deptCode: dept.code,
      previousOverrides: params.previousOverrides,
    });

    if (historicalScore > 0) {
      reasons.push({
        type: 'HISTORICAL_PATTERN',
        label: `과거 같은 계정이 ${dept.name}으로 귀속된 이력이 있습니다.`,
        weight: historicalScore,
      });
    }

    if (dominance?.deptCode === dept.code && dept.code !== originalDeptCode) {
      reasons.push({
        type: 'PROCESS_RULE',
        label: `${dept.name}에 해당 계정 예산의 ${(dominance.share * 100).toFixed(0)}%가 편성되어 있습니다.`,
        weight: 20,
      });
    }

    const score = reasons.reduce((sum, r) => sum + r.weight, 0);

    return {
      deptCode: dept.code,
      deptName: dept.name,
      score,
      reasons,
      budgetAmount,
      actualAmount,
      remainingBudget,
      confidence: (score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
    };
  });

  const sorted = candidates
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) return null;

  const best = sorted[0];

  const effectiveCurrentDeptCode =
    params.row.attributedDeptCode || originalDeptCode;

  if (best.deptCode === effectiveCurrentDeptCode) {
    return null;
  }

  return {
    rowId: params.row.id,
    year: params.year,
    period: params.row.period || params.row.month,
    originalDeptCode,
    originalDeptName: params.row.usageDept || originalDeptCode,
    accountCode,
    accountName,
    amount: rowAmount,
    currentAttributedDeptCode: params.row.attributedDeptCode,
    recommendedDeptCode: best.deptCode,
    recommendedDeptName: best.deptName,
    confidence: best.confidence,
    score: best.score,
    candidates: sorted.slice(0, 5),
    reasons: best.reasons,
    riskLevel: best.score >= 70 ? 'HIGH' : best.score >= 45 ? 'MEDIUM' : 'LOW',
  };
}
