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
  accountName: ['계정명', '계정과목', 'accountname'],
  controlType: ['통제구분', '관리구분', 'controltype'],
  amount: ['예산', '금액'],
  additional: ['추가'],
  transferred: ['전용'],
  carriedOver: ['이월'],
  planned: ['계획'],
  remarks: ['비고']
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

export function parseActualWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): ActualUploadValidationResult {
  const validRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  
  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const usageCode = String(record[normalizeHeader('귀속부서코드')] || '');
    const accountCode = String(record[normalizeHeader('계정코드')] || '');
    const usageDept = String(record[normalizeHeader('귀속부서')] || '');

    if (!usageCode || !accountCode) {
      errorRows.push({ rowNum, message: '부서코드 또는 계정코드가 없습니다.' });
      return;
    }

    // Process months
    for (let i = 1; i <= 12; i++) {
        const key = normalizeHeader(`${i}월실적`) || normalizeHeader(`${i}월`);
        const val = record[key];
        const completed = Number(val) || 0;
        
        if (completed !== 0) {
            validRows.push({
                id: params.existingCount + validRows.length + 1,
                year: params.year,
                period: `${i}월`,
                accountCode,
                accountName: '',
                controlType: '',
                usageCode,
                usageDept,
                amount: 0,
                additional: 0,
                transferred: 0,
                carriedOver: 0,
                planned: 0,
                completed,
                balance: -completed,
                remarks: '실적DB wide upload'
            });
        }
    }
  });

  return {
    format: 'ACTUAL_WIDE_MONTHLY',
    sourceRowCount: params.records.length,
    generatedRowCount: validRows.length,
    validRows,
    warningRows: [],
    errorRows
  };
}

export function parseActualFlatRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): ActualUploadValidationResult {
    const validRows: ActualData[] = [];
    params.records.forEach((record, index) => {
        validRows.push({
            id: params.existingCount + validRows.length + 1,
            year: String(record[normalizeHeader('연도')] || params.year),
            period: String(record[normalizeHeader('기간')] || ''),
            accountCode: String(record[normalizeHeader('계정코드')] || ''),
            accountName: String(record[normalizeHeader('계정명')] || ''),
            controlType: String(record[normalizeHeader('통제구분')] || ''),
            usageCode: String(record[normalizeHeader('사용처코드')] || ''),
            usageDept: String(record[normalizeHeader('사용처')] || ''),
            amount: Number(record[normalizeHeader('예산')] || 0),
            additional: Number(record[normalizeHeader('추가')] || 0),
            transferred: Number(record[normalizeHeader('전용')] || 0),
            carriedOver: Number(record[normalizeHeader('이월')] || 0),
            planned: Number(record[normalizeHeader('계획')] || 0),
            completed: Number(record[normalizeHeader('완료실적')] || 0),
            balance: Number(record[normalizeHeader('잔액')] || 0),
            remarks: String(record[normalizeHeader('비고')] || '')
        });
    });
    return {
        format: 'ACTUAL_FLAT',
        sourceRowCount: params.records.length,
        generatedRowCount: validRows.length,
        validRows,
        warningRows: [],
        errorRows: []
    };
}

export function parsePlanWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): ActualUploadValidationResult {
    // This maintains existing logic, basically returning empty validRows for now
    // as the prompt says wide actual doesn't touch planning.
    return {
        format: 'PLAN_WIDE_MONTHLY',
        sourceRowCount: params.records.length,
        generatedRowCount: 0,
        validRows: [],
        warningRows: [],
        errorRows: []
    };
}

export function parseUploadRecords(params: any): ActualUploadValidationResult {
    const format = detectUploadFormat(params.headers);
    if (format === 'ACTUAL_WIDE_MONTHLY') return parseActualWideMonthlyRows(params);
    if (format === 'ACTUAL_FLAT') return parseActualFlatRows(params);
    return parsePlanWideMonthlyRows(params);
}
