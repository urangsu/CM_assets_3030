export interface ActualData {
  id: number;
  year: string;
  period: string;
  accountCode: string;
  accountName: string;
  controlType: string;
  usageCode: string;
  usageDept: string;
  amount: number;
  additional: number;
  transferred: number;
  carriedOver: number;
  planned: number;
  completed: number;
  balance: number;
  remarks: string;
}

export interface ValidationIssue {
  rowNum: number;
  field?: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ActualUploadValidationResult {
  format: UploadFormat;
  sourceRowCount: number;
  generatedRowCount: number;
  validRows: ActualData[];
  warningRows: ValidationIssue[];
  errorRows: ValidationIssue[];
}

export type UploadFormat =
  | 'ACTUAL_WIDE_MONTHLY'
  | 'ACTUAL_FLAT'
  | 'PLAN_WIDE_MONTHLY'
  | 'UNKNOWN';

export function normalizeHeader(header: unknown): string {
  return String(header || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}]/g, '')
    .toLowerCase();
}

const HEADER_ALIASES = {
  deptCode: ['귀속부서코드', '사용처코드', '부서코드', 'deptcode', 'usagecode'],
  accountCode: ['계정코드', '계정과목코드', 'accountcode'],
  usageDept: ['귀속부서', '사용처', '부서', '부서명', 'usagedept'],
  period: ['기간', '월', 'period'],
  completed: ['완료실적', '실적', 'completed'],
};

function hasAny(normalized: string[], aliases: string[]): boolean {
  return aliases.some(alias => normalized.includes(normalizeHeader(alias)));
}

function countMonthlyActualHeaders(normalized: string[]): number {
  return normalized.filter(h => /^\d+월(실적)?$/.test(h) || h === 'jan' || h === 'feb' || h === 'mar' || h === 'apr' || h === 'may' || h === 'jun' || h === 'jul' || h === 'aug' || h === 'sep' || h === 'oct' || h === 'nov' || h === 'dec').length;
}

function countMonthlyBudgetHeaders(normalized: string[]): number {
  return normalized.filter(h => /^\d+월?$/.test(h)).length;
}

export function detectUploadFormat(headers: string[]): UploadFormat {
  const normalized = headers.map(normalizeHeader);

  const hasDeptCode = hasAny(normalized, HEADER_ALIASES.deptCode);
  const hasAccountCode = hasAny(normalized, HEADER_ALIASES.accountCode);
  const hasUsageDept = hasAny(normalized, HEADER_ALIASES.usageDept);
  const hasPeriod = hasAny(normalized, HEADER_ALIASES.period);
  const hasCompleted = hasAny(normalized, HEADER_ALIASES.completed);
  const monthActualCount = countMonthlyActualHeaders(normalized);
  const monthBudgetCount = countMonthlyBudgetHeaders(normalized);
  const hasPlanMeta = normalized.some(h => ['투자여부', '일반구분', '예산유형', '관리구분'].includes(h));

  if (hasDeptCode && hasAccountCode && monthActualCount > 0) {
    return 'ACTUAL_WIDE_MONTHLY';
  }

  if (hasPeriod && hasAccountCode && hasDeptCode && hasCompleted) {
    return 'ACTUAL_FLAT';
  }

  if (hasPlanMeta && hasAccountCode && monthBudgetCount > 0) {
    return 'PLAN_WIDE_MONTHLY';
  }

  return 'UNKNOWN';
}
