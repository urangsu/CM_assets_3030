import { getAllDepartments } from '../constants';

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
  | 'MONTHLY_WIDE'
  | 'FLAT'
  | 'UNKNOWN';

export function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
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

  // 회계식 음수: (1000)
  if (/^\(.+\)$/.test(raw)) {
    const inner = raw.slice(1, -1);
    const n = Number(inner);
    return Number.isFinite(n) ? -n : 0;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
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

const HEADER_ALIASES = {
  deptCode: ['귀속부서코드', '사용처코드', '작성부서코드', '부서코드', 'deptcode', 'usagecode', '예산사용처코드', 'departmentcode'],
  accountCode: ['계정코드', '계정과목코드', '예산계정코드', 'accountcode'],
  usageDept: ['귀속부서', '사용처', '부서', '부서명', '귀속부서명', '예산사용처', 'usagedept'],
  period: ['기간', '월', 'period'],
  completed: ['완료실적', '실적', '집행완료', 'completed'],
  accountName: ['계정명', '계정과목', '계정', '예산계정', '계정과목명', 'accountname'],
  controlType: ['통제구분', '관리구분', '예산통제구분', 'controltype'],
  amount: ['예산', '금액', '예산금액'],
  additional: ['추가', '추가예산'],
  transferred: ['전용', '전용예산'],
  carriedOver: ['이월', '이월예산'],
  planned: ['계획', '집행예정'],
  balance: ['잔액', '예산잔액'],
  remarks: ['비고']
};

function hasAny(normalized: string[], aliases: string[]): boolean {
  return aliases.some(alias => normalized.includes(normalizeHeader(alias)));
}

function countMonthlyActualHeaders(normalized: string[]): number {
  return normalized.filter(h => /^\d+월(실적|예산|계획|금액)?$/.test(h) || /^0?\d월$/.test(h) || /^m\d{2}$/.test(h) || h === 'jan' || h === 'feb' || h === 'mar' || h === 'apr' || h === 'may' || h === 'jun' || h === 'jul' || h === 'aug' || h === 'sep' || h === 'oct' || h === 'nov' || h === 'dec').length;
}

export function detectUploadFormat(headers: string[]): UploadFormat {
  const normalized = headers.map(normalizeHeader);

  const hasDeptCode = hasAny(normalized, HEADER_ALIASES.deptCode);
  const hasAccountCode = hasAny(normalized, HEADER_ALIASES.accountCode);
  const hasPeriod = hasAny(normalized, HEADER_ALIASES.period);
  const hasCompletedOrAmount = hasAny(normalized, HEADER_ALIASES.completed) || hasAny(normalized, HEADER_ALIASES.amount);
  const monthCount = countMonthlyActualHeaders(normalized);

  if (hasDeptCode && hasAccountCode && monthCount >= 1) return 'MONTHLY_WIDE';
  if (hasPeriod && hasDeptCode && hasAccountCode && hasCompletedOrAmount) return 'FLAT';

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

function resolveDepartmentName(deptCode: string, providedName?: string): { name: string; resolved: boolean } {
  const provided = String(providedName ?? '').trim();
  if (provided) return { name: provided, resolved: true };

  const code = String(deptCode ?? '').trim();
  if (!code) return { name: '', resolved: false };

  const dept = getAllDepartments().find(d => String(d.code).trim() === code);
  if (dept?.name) return { name: dept.name, resolved: true };

  return { name: '', resolved: false };
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
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) || '');
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) || '');
    const providedUsageDept = String(getRecordValue(record, HEADER_ALIASES.usageDept) || '').trim();

    if (!usageCode || !accountCode) {
      errorRows.push({ rowNum, message: '부서코드 또는 계정코드가 없습니다.', severity: 'error' });
      return;
    }

    const resolvedDept = resolveDepartmentName(usageCode, providedUsageDept);
    if (!resolvedDept.resolved) {
      warningRows.push({
        rowNum,
        field: 'usageDept',
        message: `예산사용처코드 ${usageCode}에 해당하는 부서명을 찾지 못했습니다.`,
        severity: 'warning'
      });
    }

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
                accountName: String(getRecordValue(record, HEADER_ALIASES.accountName) || ''),
                controlType: 'D.부서',
                usageCode,
                usageDept: resolvedDept.name,
                amount: isActual ? 0 : numericVal,
                additional: 0,
                transferred: 0,
                carriedOver: 0,
                planned: 0,
                completed: isActual ? numericVal : 0,
                balance: isActual ? -numericVal : numericVal,
                remarks: isActual ? '실적DB wide upload' : '계획 upload'
            });
        }
    }
  });

  return { format: 'MONTHLY_WIDE', sourceRowCount: params.records.length, generatedRowCount: actualRows.length, actualRows, budgetRows: [], warningRows, errorRows };
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

function getMonthValue(record: Record<string, unknown>, month: number) {
  const MONTH_EN_ALIASES = [
    '', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  const aliases = [
    `${month}월`,
    `0${month}월`,
    `${month}월실적`,
    `${month}월 실적`,
    `${month}월예산`,
    `${month}월 예산`,
    `m${String(month).padStart(2, '0')}`,
    MONTH_EN_ALIASES[month],
  ];
  return getRecordValue(record, aliases);
}

export function parseFlatRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
}): UploadParseResult {
    const actualRows: ActualData[] = [];
    const errorRows: ValidationIssue[] = [];
    const warningRows: ValidationIssue[] = [];
    params.records.forEach((record, index) => {
        const rowNum = index + 2;
        const period = String(getRecordValue(record, HEADER_ALIASES.period) || '').trim();
        const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) || '').trim();
        const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) || '').trim();
        const providedUsageDept = String(getRecordValue(record, HEADER_ALIASES.usageDept) || '').trim();
        const completedVal = getRecordValue(record, HEADER_ALIASES.completed);

        if (!period || !accountCode || !usageCode ) {
          errorRows.push({ rowNum, message: '필수 항목 누락', severity: 'error' });
          return;
        }

        const resolvedDept = resolveDepartmentName(usageCode, providedUsageDept);
        if (!resolvedDept.resolved) {
          warningRows.push({
            rowNum,
            field: 'usageDept',
            message: `예산사용처코드 ${usageCode}에 해당하는 부서명을 찾지 못했습니다.`,
            severity: 'warning'
          });
        }

        actualRows.push({
            id: params.existingCount + actualRows.length + 1,
            year: String(getRecordValue(record, ['연도']) || params.year),
            period,
            accountCode,
            accountName: String(getRecordValue(record, HEADER_ALIASES.accountName) || ''),
            controlType: String(getRecordValue(record, HEADER_ALIASES.controlType) || '').trim() || 'D.부서',
            usageCode,
            usageDept: resolvedDept.name,
            amount: parseAmount(getRecordValue(record, HEADER_ALIASES.amount)),
            additional: parseAmount(getRecordValue(record, HEADER_ALIASES.additional)),
            transferred: parseAmount(getRecordValue(record, HEADER_ALIASES.transferred)),
            carriedOver: parseAmount(getRecordValue(record, HEADER_ALIASES.carriedOver)),
            planned: parseAmount(getRecordValue(record, HEADER_ALIASES.planned)),
            completed: parseAmount(completedVal),
            balance: parseAmount(getRecordValue(record, ['잔액'])),
            remarks: String(getRecordValue(record, HEADER_ALIASES.remarks) || '')
        });
    });
    return { format: 'FLAT', sourceRowCount: params.records.length, generatedRowCount: actualRows.length, actualRows, budgetRows: [], warningRows, errorRows };
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
    
    // Fallback if not matching specifically
    return { format: 'UNKNOWN', sourceRowCount: params.records.length, generatedRowCount: 0, actualRows: [], budgetRows: [], warningRows: [], errorRows: [] };
}

export function findHeaderRowIndex(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const headers = (rows[i] || []).map(String);
    const format = detectUploadFormat(headers);
    if (format !== 'UNKNOWN') return i;
  }
  return -1;
}

export function isProbablyHeaderlessMonthlyRow(row: any[]): boolean {
  const deptCode = String(row[0] ?? '').trim();
  const accountCode = String(row[1] ?? '').trim();
  const accountName = String(row[2] ?? '').trim();

  if (!deptCode || !accountCode || !accountName) return false;

  const looksLikeDeptCode = /^[0-9A-Za-z_-]{2,20}$/.test(deptCode);
  const looksLikeAccountCode = /^[A-Z]?\d{5,}|[A-Z]\d{5,}$/i.test(accountCode);
  const hasAmountColumns = row.slice(3).some(cell => {
    const text = String(cell ?? '').trim();
    if (!text) return false;
    const normalized = text.replace(/,/g, '').replace(/원/g, '').replace(/₩/g, '').replace(/\s/g, '');
    return normalized !== '' && normalized !== '-' && !Number.isNaN(Number(normalized));
  });

  return looksLikeDeptCode && looksLikeAccountCode && hasAmountColumns;
}

export function buildHeaderlessMonthlyHeaders(row: any[], startMonth: number): string[] {
  const amountColumnCount = Math.max(0, row.length - 3);

  const monthHeaders = Array.from({ length: amountColumnCount }, (_, index) => {
    const month = startMonth + index;
    return month <= 12 ? `${month}월` : `초과월${index + 1}`;
  });

  return ['귀속부서코드', '계정과목코드', '계정과목', ...monthHeaders];
}

export function parsePastedText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(row => row.trim() !== '')
    .map(row => row.split('\t'));
}
