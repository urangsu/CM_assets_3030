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

  if (hasDeptCode && hasAccountCode && monthActualCount > 0) return 'ACTUAL_WIDE_MONTHLY';
  if (hasPeriod && hasAccountCode && hasDeptCode && hasCompleted) return 'ACTUAL_FLAT';
  if (hasPlanMeta && hasAccountCode && monthBudgetCount > 0) return 'PLAN_WIDE_MONTHLY';

  return 'UNKNOWN';
}

export interface PlanBudgetUploadRow {
  id: string;
  year: string;
  planType?: string;
  budgetType?: 'GENERAL' | 'INVESTMENT';
  managementCategory?: string;
  writerDeptCode?: string;
  writerDeptName?: string;
  attributedDeptCode: string;
  attributedDeptName?: string;
  code: string;
  name: string;
  detail?: string;
  calculation?: string;
  values: number[];
  sourceType?: 'UPLOAD';
}

export interface UploadParseResult {
  format: UploadFormat;
  sourceRowCount: number;
  generatedRowCount: number;
  actualRows: ActualData[];
  budgetRows: PlanBudgetUploadRow[];
  warningRows: ValidationIssue[];
  errorRows: ValidationIssue[];
}

export function parseActualWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  
  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const usageCode = String(record[normalizeHeader('귀속부서코드')] || '');
    const accountCode = String(record[normalizeHeader('계정코드')] || '');
    const usageDept = String(record[normalizeHeader('귀속부서')] || '');

    if (!usageCode || !accountCode) {
      errorRows.push({ rowNum, message: '부서코드 또는 계정코드가 없습니다.', severity: 'error' });
      return;
    }

    for (let i = 1; i <= 12; i++) {
        const val = getMonthActualValue(record, i);
        const completed = Number(val) || 0;
        
        if (completed !== 0) {
            actualRows.push({
                id: params.existingCount + actualRows.length + 1,
                year: params.year,
                period: `${i}월`,
                accountCode,
                accountName: String(record[normalizeHeader('계정명')] || ''),
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

  return { format: 'ACTUAL_WIDE_MONTHLY', sourceRowCount: params.records.length, generatedRowCount: actualRows.length, actualRows, budgetRows: [], warningRows: [], errorRows };
}

function getRecordValue(record: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

function getMonthActualValue(record: Record<string, unknown>, month: number) {
  const MONTH_EN_ALIASES = [
    '', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  const aliases = [
    `${month}월실적`,
    `${month}월 실적`,
    `${month}월`,
    `m${String(month).padStart(2, '0')}`,
    MONTH_EN_ALIASES[month],
  ];
  return getRecordValue(record, aliases);
}

export function parseActualFlatRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): UploadParseResult {
    const actualRows: ActualData[] = [];
    const errorRows: ValidationIssue[] = [];
    params.records.forEach((record, index) => {
        const rowNum = index + 2;
        const period = String(record[normalizeHeader('기간')] || '').trim();
        const accountCode = String(record[normalizeHeader('계정코드')] || '').trim();
        const usageCode = String(record[normalizeHeader('사용처코드')] || '').trim();
        const attributedDeptCode = String(record[normalizeHeader('귀속부서코드')] || '').trim();
        const completed = record[normalizeHeader('완료실적')];

        if (!period || !accountCode || (!usageCode && !attributedDeptCode) || isNaN(Number(completed))) {
          errorRows.push({ rowNum, message: '필수 항목 누락 또는 완료실적 숫자 아님', severity: 'error' });
          return;
        }

        actualRows.push({
            id: params.existingCount + actualRows.length + 1,
            year: String(record[normalizeHeader('연도')] || params.year),
            period,
            accountCode,
            accountName: String(record[normalizeHeader('계정명')] || ''),
            controlType: String(record[normalizeHeader('통제구분')] || ''),
            usageCode: usageCode || attributedDeptCode,
            usageDept: String(record[normalizeHeader('사용처')] || ''),
            amount: Number(record[normalizeHeader('예산')] || 0),
            additional: Number(record[normalizeHeader('추가')] || 0),
            transferred: Number(record[normalizeHeader('전용')] || 0),
            carriedOver: Number(record[normalizeHeader('이월')] || 0),
            planned: Number(record[normalizeHeader('계획')] || 0),
            completed: Number(completed || 0),
            balance: Number(record[normalizeHeader('잔액')] || 0),
            remarks: String(record[normalizeHeader('비고')] || '')
        });
    });
    return { format: 'ACTUAL_FLAT', sourceRowCount: params.records.length, generatedRowCount: actualRows.length, actualRows, budgetRows: [], warningRows: [], errorRows };
}

export function parsePlanWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): UploadParseResult {
    const budgetRows: PlanBudgetUploadRow[] = [];
    const errorRows: ValidationIssue[] = [];

    params.records.forEach((record, index) => {
        const rowNum = index + 2;
        const code = String(record[normalizeHeader('계정코드')] || '').trim();
        const name = String(record[normalizeHeader('계정명')] || '').trim();
        const attributedDeptCode = String(record[normalizeHeader('부서코드')] || '').trim();

        if (!code || !attributedDeptCode) {
            errorRows.push({ rowNum, message: '필수 항목 누락', severity: 'error' });
            return;
        }

        const values: number[] = [];
        for (let i = 1; i <= 12; i++) {
            const val = getMonthBudgetValue(record, i);
            values.push(Number(val) || 0);
        }

        budgetRows.push({
            id: `plan_${Date.now()}_${index}`,
            year: params.year,
            attributedDeptCode,
            code,
            name,
            values,
            sourceType: 'UPLOAD'
        });
    });

    return { format: 'PLAN_WIDE_MONTHLY', sourceRowCount: params.records.length, generatedRowCount: budgetRows.length, actualRows: [], budgetRows, warningRows: [], errorRows };
}

function getMonthBudgetValue(record: Record<string, unknown>, month: number) {
    const aliases = [
        `${month}월`,
        `${month}월예산`,
        `m${String(month).padStart(2, '0')}`,
    ];
    return getRecordValue(record, aliases);
}

export function parseUploadRecords(params: any): UploadParseResult {
    const format = detectUploadFormat(params.headers);
    if (format === 'ACTUAL_WIDE_MONTHLY') return parseActualWideMonthlyRows(params);
    if (format === 'ACTUAL_FLAT') return parseActualFlatRows(params);
    return parsePlanWideMonthlyRows(params);
}
