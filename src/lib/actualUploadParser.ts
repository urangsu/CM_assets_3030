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

export type UploadFormat = 'MONTHLY_WIDE' | 'FLAT' | 'UNKNOWN';

export interface ActualUploadValidationResult {
  format: UploadFormat;
  sourceRowCount: number;
  generatedRowCount: number;
  actualRows: ActualData[];
  budgetRows: PlanBudgetUploadRow[];
  warningRows: ValidationIssue[];
  errorRows: ValidationIssue[];
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

function toHalfWidth(value: string): string {
  return value.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export function normalizeHeader(header: unknown): string {
  return toHalfWidth(String(header ?? ''))
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/[·・._\-/]/g, '')
    .toLowerCase();
}

export function parseAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = toHalfWidth(String(value))
    .trim()
    .replace(/,/g, '')
    .replace(/₩/g, '')
    .replace(/원/g, '')
    .replace(/\s/g, '');

  if (raw === '' || raw === '-') return 0;

  if (/^\(.+\)$/.test(raw)) {
    const inner = raw.slice(1, -1);
    const n = Number(inner);
    return Number.isFinite(n) ? -n : 0;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const HEADER_ALIASES = {
  deptCode: [
    '귀속부서코드',
    '귀속부서 code',
    '귀속부서',
    '사용처코드',
    '예산사용처코드',
    '작성부서코드',
    '부서코드',
    'deptcode',
    'usagecode',
    'departmentcode',
  ],
  accountCode: [
    '계정과목코드',
    '계정코드',
    '예산계정코드',
    '계정 code',
    'accountcode',
  ],
  usageDept: ['귀속부서명', '귀속부서', '사용처', '부서', '부서명', '예산사용처', 'usagedept'],
  period: ['기간', '월', 'period'],
  completed: ['완료실적', '실적', '집행완료', 'completed'],
  accountName: ['계정과목명', '계정과목', '계정명', '예산계정', '계정', 'accountname'],
  controlType: ['통제구분', '관리구분', 'controltype'],
  amount: ['예산', '예산금액', '금액', 'amount'],
  additional: ['추가', '추가예산'],
  transferred: ['전용', '전용예산'],
  carriedOver: ['이월', '이월예산'],
  planned: ['계획', '집행예정'],
  remarks: ['비고', '메모', 'remarks'],
};

function headerEquals(header: string, aliases: string[]): boolean {
  return aliases.some(alias => header === normalizeHeader(alias));
}

function hasAny(normalized: string[], aliases: string[]): boolean {
  return normalized.some(header => headerEquals(header, aliases));
}

const MONTH_EN_ALIASES = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function getMonthNumberFromHeader(header: string): number | null {
  const h = normalizeHeader(header);

  const numeric = h.match(/^(?:m)?0?([1-9]|1[0-2])(?:월)?(?:실적|예산|계획|금액)?$/);
  if (numeric) return Number(numeric[1]);

  const korean = h.match(/^([1-9]|1[0-2])월(?:실적|예산|계획|금액)?$/);
  if (korean) return Number(korean[1]);

  const englishIndex = MONTH_EN_ALIASES.indexOf(h);
  if (englishIndex >= 1) return englishIndex;

  return null;
}

function countMonthlyHeaders(headers: string[]): number {
  const months = new Set<number>();
  headers.forEach(header => {
    const month = getMonthNumberFromHeader(header);
    if (month !== null) months.add(month);
  });
  return months.size;
}

export function detectUploadFormat(headers: string[]): UploadFormat {
  const normalized = headers.map(normalizeHeader).filter(Boolean);

  const hasDeptCode = hasAny(normalized, HEADER_ALIASES.deptCode);
  const hasAccountCode = hasAny(normalized, HEADER_ALIASES.accountCode);
  const hasPeriod = hasAny(normalized, HEADER_ALIASES.period);
  const hasCompleted = hasAny(normalized, HEADER_ALIASES.completed);
  const monthCount = countMonthlyHeaders(normalized);

  if (hasDeptCode && hasAccountCode && monthCount >= 1) return 'MONTHLY_WIDE';
  if (hasPeriod && hasAccountCode && hasDeptCode && hasCompleted) return 'FLAT';

  return 'UNKNOWN';
}

function getRecordValue(record: Record<string, unknown>, aliases: string[]) {
  const normalizedAliasSet = new Set(aliases.map(normalizeHeader));
  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliasSet.has(normalizeHeader(key)) && value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function getMonthValue(record: Record<string, unknown>, month: number) {
  for (const [key, value] of Object.entries(record)) {
    if (getMonthNumberFromHeader(key) === month) {
      return value;
    }
  }
  return undefined;
}

export function parseWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
  planType?: string;
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  const warningRows: ValidationIssue[] = [];

  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) ?? '').trim();
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) ?? '').trim();
    const usageDept = String(getRecordValue(record, HEADER_ALIASES.usageDept) ?? '').trim();
    const accountName = String(getRecordValue(record, HEADER_ALIASES.accountName) ?? '').trim();

    if (!usageCode || !accountCode) {
      errorRows.push({ rowNum, message: '귀속부서코드 또는 계정과목코드가 없습니다.', severity: 'error' });
      return;
    }

    let generatedForRow = 0;
    for (let i = 1; i <= 12; i++) {
      const val = getMonthValue(record, i);
      const numericVal = parseAmount(val);

      if (numericVal !== 0) {
        const isActual = params.planType === '실적';
        actualRows.push({
          id: params.existingCount + actualRows.length + 1,
          year: params.year,
          period: `${i}월`,
          accountCode,
          accountName,
          controlType: '',
          usageCode,
          usageDept,
          amount: isActual ? 0 : numericVal,
          additional: 0,
          transferred: 0,
          carriedOver: 0,
          planned: 0,
          completed: isActual ? numericVal : 0,
          balance: isActual ? -numericVal : numericVal,
          remarks: isActual ? '실적DB 월별 업로드' : `${params.planType || '계획'} 월별 업로드`,
        });
        generatedForRow += 1;
      }
    }

    if (generatedForRow === 0) {
      warningRows.push({ rowNum, message: '1월~12월 금액이 모두 0이거나 비어 있습니다.', severity: 'warning' });
    }
  });

  return {
    format: 'MONTHLY_WIDE',
    sourceRowCount: params.records.length,
    generatedRowCount: actualRows.length,
    actualRows,
    budgetRows: [],
    warningRows,
    errorRows,
  };
}

export function parseFlatRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];

  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const period = String(getRecordValue(record, HEADER_ALIASES.period) ?? '').trim();
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) ?? '').trim();
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) ?? '').trim();
    const completedVal = getRecordValue(record, HEADER_ALIASES.completed);

    if (!period || !accountCode || !usageCode) {
      errorRows.push({ rowNum, message: '기간, 계정코드 또는 부서코드가 없습니다.', severity: 'error' });
      return;
    }

    const amount = parseAmount(getRecordValue(record, HEADER_ALIASES.amount));
    const additional = parseAmount(getRecordValue(record, HEADER_ALIASES.additional));
    const transferred = parseAmount(getRecordValue(record, HEADER_ALIASES.transferred));
    const carriedOver = parseAmount(getRecordValue(record, HEADER_ALIASES.carriedOver));
    const planned = parseAmount(getRecordValue(record, HEADER_ALIASES.planned));
    const completed = parseAmount(completedVal);
    const fallbackBalance = amount + additional + transferred + carriedOver - planned - completed;

    actualRows.push({
      id: params.existingCount + actualRows.length + 1,
      year: String(getRecordValue(record, ['연도']) ?? params.year),
      period,
      accountCode,
      accountName: String(getRecordValue(record, HEADER_ALIASES.accountName) ?? ''),
      controlType: String(getRecordValue(record, HEADER_ALIASES.controlType) ?? ''),
      usageCode,
      usageDept: String(getRecordValue(record, HEADER_ALIASES.usageDept) ?? ''),
      amount,
      additional,
      transferred,
      carriedOver,
      planned,
      completed,
      balance: parseAmount(getRecordValue(record, ['잔액'])) || fallbackBalance,
      remarks: String(getRecordValue(record, HEADER_ALIASES.remarks) ?? ''),
    });
  });

  return {
    format: 'FLAT',
    sourceRowCount: params.records.length,
    generatedRowCount: actualRows.length,
    actualRows,
    budgetRows: [],
    warningRows: [],
    errorRows,
  };
}

export function parseUploadRecords(params: {
  headers: string[];
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
  currentUser?: any;
  viewableDeptCodes?: string[];
  planType: string;
}): UploadParseResult {
  const format = detectUploadFormat(params.headers);
  if (format === 'MONTHLY_WIDE') return parseWideMonthlyRows(params);
  if (format === 'FLAT') return parseFlatRows(params);

  return {
    format: 'UNKNOWN',
    sourceRowCount: params.records.length,
    generatedRowCount: 0,
    actualRows: [],
    budgetRows: [],
    warningRows: [],
    errorRows: [
      {
        rowNum: 1,
        severity: 'error',
        message: '지원되는 헤더를 찾지 못했습니다. 예: 귀속부서코드 | 계정과목코드 | 계정과목 | 1월 | ... | 12월',
      },
    ],
  };
}
