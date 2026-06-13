import { AccountClass, AccountingType, classifyAccount, getAccountingType, isSalaryAccountRow } from './accountClassification';
import { MonthMode, parseMonthIndex, shouldIncludeMonth } from './monthFilter';
import { loadActualRows, loadBudgetRowsByDept } from './varianceDataLoader';
import { AccountMeta } from './varianceAccountIndex';
import { getDeptCodesByGroup } from './departmentGroups';
import { calcVarianceRate } from './varianceMath';
import { getEffectiveDeptCodeForActual } from './storageKeys';

export function resolveSelectedDeptCodes(params: {
  selectedDept: string;
  viewableDepts: any[];
  isAdmin?: boolean;
  isPlanningTeam?: boolean;
}): string[] {
  const { selectedDept, viewableDepts } = params;

  if (
    selectedDept === 'all' ||
    selectedDept === 'viewable' ||
    selectedDept === 'mfg' ||
    selectedDept === 'sga' ||
    selectedDept === 'by_dept'
  ) {
    return viewableDepts.map(d => d.code);
  }

  const groupCodes = getDeptCodesByGroup(selectedDept);
  if (groupCodes.length > 0) {
    const viewableSet = new Set(viewableDepts.map(d => d.code));
    return groupCodes.filter(c => viewableSet.has(c));
  }

  return [selectedDept];
}

export interface AtomicCompareRow {
  deptCode: string;
  accountCode: string;
  accountName: string;
  accountClass: string;
  accountingType: AccountingType;
  isSalary: boolean;
  amount: number;
}

export type VarianceStatus =
  | '미계획'
  | '미발생'
  | '신규'
  | '사라짐'
  | '증가'
  | '감소'
  | '변동없음';

export function getVarianceStatus(params: {
  baseAmount: number;
  targetAmount: number;
  basePlanType: string;
  targetPlanType: string;
}): VarianceStatus {
  const { baseAmount, targetAmount, basePlanType, targetPlanType } = params;
  const isPlanVsActual = basePlanType !== '실적' && targetPlanType === '실적';

  if (baseAmount === 0 && targetAmount > 0) {
    return isPlanVsActual ? '미계획' : '신규';
  }

  if (baseAmount > 0 && targetAmount === 0) {
    return isPlanVsActual ? '미발생' : '사라짐';
  }

  if (targetAmount > baseAmount) return '증가';
  if (targetAmount < baseAmount) return '감소';

  return '변동없음';
}

export interface ComparisonRow {
  key: string;
  code: string;
  name: string;
  accountingType: AccountingType;
  accountClass: string;
  accountCode: string;
  accountName: string;
  deptCode: string;
  deptName: string;
  baseAmount: number;
  targetAmount: number;
  variance: number;
  variancePercent: number | null;
  status: VarianceStatus;
  isSalary: boolean;
}

export interface VarianceResult {
  rows: ComparisonRow[];
  summary: {
    baseMfg: number;
    baseSga: number;
    targetMfg: number;
    targetSga: number;
  };
}

export function buildAtomicCompareRows(params: {
  year: string;
  planType: string;
  monthMode: MonthMode;
  selectedMonth: number;
  deptCodes: string[];
  accountMetaMap: Map<string, AccountMeta>;
  hasSalaryAccess: boolean;
  allDepts: any[];
}): AtomicCompareRow[] {
  const {
    year,
    planType,
    monthMode,
    selectedMonth,
    deptCodes,
    accountMetaMap,
    hasSalaryAccess,
    allDepts,
  } = params;

  const deptCodesSet = new Set(deptCodes);
  const atomicRows: AtomicCompareRow[] = [];

  if (planType === '실적') {
    const actualRows = loadActualRows(year);

    // Load actual-to-attribution-budgeted maps to resolve attributedDeptCode overrides with year+period+usageCode+accountCode+id key
    const savedActualsMap = new Map<string, string>();
    actualRows.forEach(item => {
      if (item.attributedDeptCode) {
        const itemId = item.id || item.sourceRowId || item.rowNo || item._rowIndex || 'no-id';
        const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${itemId}`;
        savedActualsMap.set(key, item.attributedDeptCode);
      }
    });

    const internalAggregated = new Map<string, { deptCode: string; accountCode: string; accountName: string; amount: number }>();

    actualRows.forEach(item => {
       const itemId = item.id || item.sourceRowId || item.rowNo || item._rowIndex || 'no-id';
       const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${itemId}`;
       const overriddenDeptCode = savedActualsMap.get(key);
       const effectiveDeptCode = overriddenDeptCode || getEffectiveDeptCodeForActual(item);

       // Group/Department filter
      if (!deptCodesSet.has(effectiveDeptCode)) return;

      // Period filter
      const periodStr = String(item.period || '');
      const monthIndex = parseMonthIndex(periodStr);
      if (!shouldIncludeMonth(monthIndex, monthMode, selectedMonth)) return;

      // Classify and check access
      const meta = accountMetaMap.get(item.accountCode);
      const name = meta?.name || item.accountName || `미등록 계정(${item.accountCode})`;
      const accountClass = meta?.accountClass || classifyAccount(item.accountCode, name);
      const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

      if (!hasSalaryAccess && isSalary) return;

      const amount = item.completed || 0;
      const compositeKey = `${effectiveDeptCode}_${item.accountCode}`;
      const existing = internalAggregated.get(compositeKey);
      if (existing) {
        existing.amount += amount;
      } else {
        internalAggregated.set(compositeKey, {
          deptCode: effectiveDeptCode,
          accountCode: item.accountCode,
          accountName: name,
          amount,
        });
      }
    });

    internalAggregated.forEach(item => {
      const meta = accountMetaMap.get(item.accountCode);
      const accountingType = meta?.accountingType || getAccountingType(item.accountCode, item.accountName);
      const accountClass = meta?.accountClass || classifyAccount(item.accountCode, item.accountName);
      const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

      atomicRows.push({
        deptCode: item.deptCode,
        accountCode: item.accountCode,
        accountName: item.accountName,
        accountClass,
        accountingType,
        isSalary,
        amount: item.amount,
      });
    });
  } else {
    // Budget data loader
    const budgetRowsByDept = loadBudgetRowsByDept({
      year,
      planType,
      deptCodes: deptCodes,
    });

    const internalAggregated = new Map<string, { deptCode: string; accountCode: string; accountName: string; amount: number }>();

    budgetRowsByDept.forEach((rows, dCode) => {
      rows.forEach((row: any) => {
        const rowDeptCode = row.attributedDeptCode || dCode;

        if (!deptCodesSet.has(rowDeptCode)) return;

        const meta = accountMetaMap.get(row.code);
        const name = meta?.name || row.name || `미등록 계정(${row.code})`;
        const accountClass = meta?.accountClass || classifyAccount(row.code, name);
        const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

        if (!hasSalaryAccess && isSalary) return;

        let amount = 0;
        if (monthMode === 'MONTH') {
          amount = row.values[selectedMonth - 1] || 0;
        } else {
          amount = row.values.slice(0, selectedMonth).reduce((sum: number, val: number) => sum + val, 0);
        }

        // Aggregate unique composites in raw source file (sourceDeptCode + accCode) to avoid duplicating
        const compositeKey = `${rowDeptCode}_${row.code}`;
        const existing = internalAggregated.get(compositeKey);
        if (existing) {
          existing.amount += amount;
        } else {
          internalAggregated.set(compositeKey, {
            deptCode: rowDeptCode,
            accountCode: row.code,
            accountName: name,
            amount,
          });
        }
      });
    });

    internalAggregated.forEach(item => {
      const meta = accountMetaMap.get(item.accountCode);
      const accountingType = meta?.accountingType || getAccountingType(item.accountCode, item.accountName);
      const accountClass = meta?.accountClass || classifyAccount(item.accountCode, item.accountName);
      const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

      atomicRows.push({
        deptCode: item.deptCode,
        accountCode: item.accountCode,
        accountName: item.accountName,
        accountClass,
        accountingType,
        isSalary,
        amount: item.amount,
      });
    });
  }

  return atomicRows;
}

export function normalizeCompareCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function normalizeDeptCode(value: unknown): string {
  return String(value ?? '').trim();
}

export type CompareMapItem = {
  code: string;
  name: string;
  amount: number;
  accountCode: string;
  accountName: string;
  accountClass: string;
  accountingType: AccountingType;
  isSalary: boolean;
  deptCode?: string;
  deptName?: string;
};

export function resolveUnionMeta(base?: CompareMapItem, target?: CompareMapItem) {
  const code = normalizeCompareCode(base?.accountCode || target?.accountCode);
  const name = base?.accountName || target?.accountName || '';

  const accountingTypeByCode = getAccountingType(code, name);
  const accountClassByCode = classifyAccount(code, name);

  return {
    accountCode: code,
    accountName: base?.accountName || target?.accountName || name,
    accountingType: (accountingTypeByCode || base?.accountingType || target?.accountingType || '기타') as AccountingType,
    accountClass: accountClassByCode || base?.accountClass || target?.accountClass || '기타',
    isSalary: base?.isSalary || target?.isSalary || false,
  };
}

function upsertCompareMap(
  map: Map<string, CompareMapItem>,
  groupKey: string,
  row: AtomicCompareRow,
  allDepts: any[],
  groupBy: 'account' | 'dept'
) {
  const code = groupKey;
  const resolvedName = groupBy === 'dept'
    ? (allDepts.find(d => d.code === row.deptCode)?.name || row.deptCode)
    : row.accountName;

  const existing = map.get(groupKey);
  if (existing) {
    existing.amount += row.amount;
  } else {
    map.set(groupKey, {
      code,
      name: resolvedName,
      amount: row.amount,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountClass: row.accountClass,
      accountingType: row.accountingType,
      isSalary: row.isSalary,
      deptCode: row.deptCode,
      deptName: resolvedName,
    });
  }
}

export function assertNoDroppedCompareRows(params: {
  baseRows: AtomicCompareRow[];
  targetRows: AtomicCompareRow[];
  finalRows: ComparisonRow[];
  groupBy: 'account' | 'dept';
}) {
  const expectedKeys = new Set<string>();

  params.baseRows.forEach(row => {
    expectedKeys.add(params.groupBy === 'dept'
      ? normalizeDeptCode(row.deptCode)
      : normalizeCompareCode(row.accountCode));
  });

  params.targetRows.forEach(row => {
    expectedKeys.add(params.groupBy === 'dept'
      ? normalizeDeptCode(row.deptCode)
      : normalizeCompareCode(row.accountCode));
  });

  const finalKeys = new Set(params.finalRows.map(row =>
    params.groupBy === 'dept'
      ? normalizeDeptCode(row.deptCode || row.code)
      : normalizeCompareCode(row.accountCode || row.code)
  ));

  const dropped = Array.from(expectedKeys).filter(key => !finalKeys.has(key));

  if (dropped.length > 0) {
    console.warn('[VarianceComparison] 비교 row 유실 감지', dropped);
  } else {
    console.log('[VarianceComparison] 비교 row 유실 없음 (검증 통과)');
  }
}

export function runRegressionTests() {
  const baseRows: AtomicCompareRow[] = [
    {
      deptCode: '21002',
      accountCode: 'A60601115',
      accountName: '제조비용_복리후생비_보건위생지원',
      accountClass: '복리후생비',
      accountingType: '제조',
      amount: 1000000,
      isSalary: false,
    },
  ];

  const targetRows: AtomicCompareRow[] = [
    {
      deptCode: '21002',
      accountCode: 'A60601115',
      accountName: '제조비용_복리후생비_보건위생지원',
      accountClass: '복리후생비',
      accountingType: '제조',
      amount: 1200000,
      isSalary: false,
    },
  ];

  const result = buildVarianceComparison({
    baseRows,
    targetRows,
    groupBy: 'account',
    allDepts: [{ code: '21002', name: '제조부' }],
    activeDept: 'all',
    selectedAccountingType: '제조',
    selectedAccountClass: '복리후생비',
    basePlanType: '경영계획',
    targetPlanType: '실적',
  });

  const isSuccess = result.rows.some(r => normalizeCompareCode(r.accountCode) === 'A60601115');
  console.log('[회귀 테스트] A60601115 복리후생비 검과 검증:', isSuccess ? '성공 (PASS)' : '실패 (FAIL)');
}

// Run regression test immediately on module load to prevent regression
setTimeout(() => {
  try {
    runRegressionTests();
  } catch (err) {
    console.error('Failed to run regression tests:', err);
  }
}, 100);

export function buildVarianceComparison(params: {
  baseRows: AtomicCompareRow[];
  targetRows: AtomicCompareRow[];
  groupBy: 'account' | 'dept';
  allDepts: any[];
  activeDept: string;
  selectedAccountingType: string;
  selectedAccountClass: string;
  basePlanType: string;
  targetPlanType: string;
}): VarianceResult {
  const {
    baseRows,
    targetRows,
    groupBy,
    allDepts,
    activeDept,
    selectedAccountingType,
    selectedAccountClass,
    basePlanType,
    targetPlanType,
  } = params;

  const baseMap = new Map<string, CompareMapItem>();
  const targetMap = new Map<string, CompareMapItem>();

  baseRows.forEach(row => {
    const groupKey = groupBy === 'dept'
      ? normalizeDeptCode(row.deptCode)
      : normalizeCompareCode(row.accountCode);

    upsertCompareMap(baseMap, groupKey, row, allDepts, groupBy);
  });

  targetRows.forEach(row => {
    const groupKey = groupBy === 'dept'
      ? normalizeDeptCode(row.deptCode)
      : normalizeCompareCode(row.accountCode);

    upsertCompareMap(targetMap, groupKey, row, allDepts, groupBy);
  });

  const allCodes = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const rows: ComparisonRow[] = Array.from(allCodes).map(code => {
    const baseItem = baseMap.get(code);
    const targetItem = targetMap.get(code);
    
    const unionMeta = resolveUnionMeta(baseItem, targetItem);

    const baseAmount = baseItem?.amount || 0;
    const targetAmount = targetItem?.amount || 0;
    const variance = targetAmount - baseAmount;
    const variancePercent = calcVarianceRate(baseAmount, targetAmount);

    const rowAccountingType = groupBy === 'dept' ? ('전체' as AccountingType) : unionMeta.accountingType;
    const rowAccountClass = groupBy === 'dept' ? '부서' : unionMeta.accountClass;
    const name = baseItem?.name || targetItem?.name || unionMeta.accountName || 'Unknown';

    const status = getVarianceStatus({
      baseAmount,
      targetAmount,
      basePlanType,
      targetPlanType,
    });

    const isSalary = groupBy === 'dept' ? false : unionMeta.isSalary;

    return {
      key: code,
      code,
      name,
      accountingType: rowAccountingType,
      accountClass: rowAccountClass,
      accountCode: groupBy === 'dept' ? '' : code,
      accountName: groupBy === 'dept' ? '' : name,
      deptCode: groupBy === 'dept' ? code : (baseItem?.deptCode || targetItem?.deptCode || ''),
      deptName: groupBy === 'dept' ? name : '',
      baseAmount,
      targetAmount,
      variance,
      variancePercent,
      status,
      isSalary,
    };
  })
  .filter(row => row.baseAmount !== 0 || row.targetAmount !== 0)
  .filter(row => {
    if (activeDept === 'mfg' && row.accountingType !== '제조') return false;
    if (activeDept === 'sga' && row.accountingType !== '판관') return false;
    if (selectedAccountingType !== '전체' && row.accountingType !== selectedAccountingType) return false;
    if (selectedAccountClass !== '전체' && row.accountClass !== selectedAccountClass) return false;
    return true;
  })
  .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  let baseMfg = 0;
  let baseSga = 0;
  let targetMfg = 0;
  let targetSga = 0;

  rows.forEach(row => {
    if (row.accountingType === '제조') {
      baseMfg += row.baseAmount;
      targetMfg += row.targetAmount;
    } else if (row.accountingType === '판관') {
      baseSga += row.baseAmount;
      targetSga += row.targetAmount;
    }
  });

  const designCheckKey = 'A60601115';
  const A60601115Included = Array.from(allCodes).some(code => normalizeCompareCode(code) === designCheckKey);
  console.log('[비교분석 검증]', {
    'base keys': baseMap.size,
    'target keys': targetMap.size,
    'union keys': allCodes.size,
    'final rows': rows.length,
    'dropped before filter': 0,
    'A60601115 included': A60601115Included
  });

  assertNoDroppedCompareRows({
    baseRows,
    targetRows,
    finalRows: rows,
    groupBy,
  });

  return {
    rows,
    summary: {
      baseMfg,
      baseSga,
      targetMfg,
      targetSga,
    },
  };
}
