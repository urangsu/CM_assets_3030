import { getAllDepartments } from '../constants';
import { resolveAccountByCode } from './accountResolver';
import { parsePeriodMonth } from './budgetAggregation';

export interface ActualData {
  id: number;
  year: string;
  period: string;
  periodMonth?: number;
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
  sourceRowId?: string;
  sourceFileFingerprint?: string;
  attributedDeptCode?: string;
  uploadBatchId?: string;
  sourceSheetName?: string;
  sourceRowNumber?: number;
  documentNo?: string;
  documentLineNo?: string;
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
  | 'BUDGET_ADJUSTMENT_FLAT'
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

export function detectUploadType(headers: string[]): UploadFormat {
  const normalized = headers.map(normalizeHeader);

  const hasDeptCode = hasAny(normalized, HEADER_ALIASES.deptCode);
  const hasAccountCode = hasAny(normalized, HEADER_ALIASES.accountCode);
  const hasPeriod = hasAny(normalized, HEADER_ALIASES.period);
  const hasCompletedOrAmount = hasAny(normalized, HEADER_ALIASES.completed) || hasAny(normalized, HEADER_ALIASES.amount);
  const monthCount = countMonthlyActualHeaders(normalized);

  const hasAdjustmentHeader = hasAny(normalized, ['증감액', '증액', '조정액', '조정금액', '금액', 'amount']);

  if (hasDeptCode && hasAccountCode && monthCount >= 1) return 'MONTHLY_WIDE';
  if (hasPeriod && hasDeptCode && hasAccountCode && hasAdjustmentHeader) return 'BUDGET_ADJUSTMENT_FLAT';
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

export function normalizeSelectedActualMonths(months?: number[]): number[] {
  if (!months) return Array.from({ length: 12 }, (_, i) => i + 1);
  const valid = months
    .filter(m => typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b);
  return Array.from(new Set(valid));
}

export function parseWideMonthlyRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
  planType?: string;
  uploadKind?: string;
  uploadBatchId?: string;
  sourceSheetName?: string;
  sourceFileFingerprint?: string;
  selectedActualMonths?: number[];
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  const warningRows: ValidationIssue[] = [];

  const isActual = params.uploadKind === 'monthlyActual' || params.planType === '실적';
  const normSelectedMonths = isActual && params.selectedActualMonths !== undefined
    ? normalizeSelectedActualMonths(params.selectedActualMonths)
    : null;

  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) || '').trim();
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) || '').trim();
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

    const uploadedAccountName = String(getRecordValue(record, HEADER_ALIASES.accountName) || '').trim();
    const resolvedAccount = resolveAccountByCode({
      accountCode,
      uploadedName: uploadedAccountName,
      year: params.year
    });

    if (resolvedAccount.isRegistered && resolvedAccount.nameMismatch) {
      warningRows.push({
        rowNum,
        field: 'accountName',
        message: `업로드 계정명 "${resolvedAccount.uploadedName}"이 기준 계정명 "${resolvedAccount.name}"과 다릅니다. 계정코드 ${resolvedAccount.code} 기준으로 기준 계정명을 적용했습니다.`,
        severity: 'warning'
      });
    }

    if (!resolvedAccount.isRegistered) {
      warningRows.push({
        rowNum,
        field: 'accountCode',
        message: `계정코드 ${resolvedAccount.code}는 예산 계정 선택/계정마스터에 없습니다. 실적 행은 임시로 표시하지만, 계정 코드 관리에서 정식 등록이 필요합니다.`,
        severity: 'warning'
      });
    }

    const sourceRowIdVal = (() => {
      const rawId = getRecordValue(record, ['sourcerowid', 'rowid', 'uniqueid', '원천id', '원천ID', '행id', '행ID']);
      return rawId !== undefined && rawId !== null && String(rawId).trim() !== '' ? String(rawId).trim() : undefined;
    })();

    for (let i = 1; i <= 12; i++) {
      if (normSelectedMonths && !normSelectedMonths.includes(i)) {
        continue;
      }

      const val = getMonthValue(record, i);
      const numericVal = parseAmount(val);

      if (numericVal !== 0) {
        const documentNo = String(getRecordValue(record, ['전표번호', '전표', 'documentno', 'voucherno', 'documentNo', 'voucherNo']) || '').trim() || undefined;
        const documentLineNo = String(getRecordValue(record, ['전표행번호', '행번호', 'documentlineno', 'lineno', 'documentLineNo', 'lineNo']) || '').trim() || undefined;

        actualRows.push({
          id: params.existingCount + actualRows.length + 1,
          sourceRowId: sourceRowIdVal,
          sourceFileFingerprint: params.sourceFileFingerprint,
          year: params.year,
          period: `${i}월`,
          periodMonth: i,
          accountCode: resolvedAccount.code,
          accountName: resolvedAccount.name,
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
          remarks: isActual ? '실적DB wide upload' : '계획 upload',
          uploadBatchId: params.uploadBatchId || 'batch_' + Date.now(),
          sourceSheetName: params.sourceSheetName || 'Sheet1',
          sourceRowNumber: rowNum,
          documentNo,
          documentLineNo
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
  planType?: string;
  uploadKind?: string;
  uploadBatchId?: string;
  sourceSheetName?: string;
  sourceFileFingerprint?: string;
  selectedActualMonths?: number[];
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  const warningRows: ValidationIssue[] = [];

  const isActual = params.uploadKind === 'monthlyActual' || params.planType === '실적';
  const normSelectedMonths = isActual && params.selectedActualMonths !== undefined
    ? normalizeSelectedActualMonths(params.selectedActualMonths)
    : null;

  params.records.forEach((record, index) => {
    const rowNum = index + 2;
    const period = String(getRecordValue(record, HEADER_ALIASES.period) || '').trim();
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) || '').trim();
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) || '').trim();
    const providedUsageDept = String(getRecordValue(record, HEADER_ALIASES.usageDept) || '').trim();
    const completedVal = getRecordValue(record, HEADER_ALIASES.completed);

    if (!period || !accountCode || !usageCode) {
      errorRows.push({ rowNum, message: '필수 항목 누락', severity: 'error' });
      return;
    }

    const monthIndexFromPeriod = parsePeriodMonth(period);
    const rowMonth = monthIndexFromPeriod !== null ? monthIndexFromPeriod + 1 : null;

    if (isActual && normSelectedMonths) {
      if (rowMonth === null) {
        warningRows.push({
          rowNum,
          field: 'period',
          message: `${rowNum}행: 기간 값(${period})에서 월을 판별할 수 없어 가져오기에서 제외했습니다.`,
          severity: 'warning'
        });
        return;
      }
      if (!normSelectedMonths.includes(rowMonth)) {
        return;
      }
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

    const uploadedAccountName = String(getRecordValue(record, HEADER_ALIASES.accountName) || '').trim();
    const resolvedAccount = resolveAccountByCode({
      accountCode,
      uploadedName: uploadedAccountName,
      year: params.year
    });

    if (resolvedAccount.isRegistered && resolvedAccount.nameMismatch) {
      warningRows.push({
        rowNum,
        field: 'accountName',
        message: `업로드 계정명 "${resolvedAccount.uploadedName}"이 기준 계정명 "${resolvedAccount.name}"과 다릅니다. 계정코드 ${resolvedAccount.code} 기준으로 기준 계정명을 적용했습니다.`,
        severity: 'warning'
      });
    }

    if (!resolvedAccount.isRegistered) {
      warningRows.push({
        rowNum,
        field: 'accountCode',
        message: `계정코드 ${resolvedAccount.code}는 예산 계정 선택/계정마스터에 없습니다. 실적 행은 임시로 표시하지만, 계정 코드 관리에서 정식 등록이 필요합니다.`,
        severity: 'warning'
      });
    }

    const documentNo = String(getRecordValue(record, ['전표번호', '전표', 'documentno', 'voucherno', 'documentNo', 'voucherNo']) || '').trim() || undefined;
    const documentLineNo = String(getRecordValue(record, ['전표행번호', '행번호', 'documentlineno', 'lineno', 'documentLineNo', 'lineNo']) || '').trim() || undefined;

    const sourceRowIdVal = (() => {
      const rawId = getRecordValue(record, ['sourcerowid', 'rowid', 'uniqueid', '원천id', '원천ID', '행id', '행ID']);
      return rawId !== undefined && rawId !== null && String(rawId).trim() !== '' ? String(rawId).trim() : undefined;
    })();

    actualRows.push({
      id: params.existingCount + actualRows.length + 1,
      sourceRowId: sourceRowIdVal,
      sourceFileFingerprint: params.sourceFileFingerprint,
      year: String(getRecordValue(record, ['연도']) || params.year),
      period,
      periodMonth: monthIndexFromPeriod !== null ? monthIndexFromPeriod + 1 : undefined,
      accountCode: resolvedAccount.code,
      accountName: resolvedAccount.name,
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
      remarks: String(getRecordValue(record, HEADER_ALIASES.remarks) || ''),
      uploadBatchId: params.uploadBatchId || 'batch_' + Date.now(),
      sourceSheetName: params.sourceSheetName || 'Sheet1',
      sourceRowNumber: rowNum,
      documentNo,
      documentLineNo
    });
  });
  return { format: 'FLAT', sourceRowCount: params.records.length, generatedRowCount: actualRows.length, actualRows, budgetRows: [], warningRows, errorRows };
}

export function parseBudgetAdjustmentRows(params: {
  records: Record<string, unknown>[];
  year: string;
  existingCount: number;
  uploadBatchId?: string;
  sourceSheetName?: string;
  sourceFileFingerprint?: string;
}): UploadParseResult {
  const actualRows: ActualData[] = [];
  const errorRows: ValidationIssue[] = [];
  const warningRows: ValidationIssue[] = [];

  params.records.forEach((record, index) => {
    const rowNum = index + 2;

    const rowYear = String(getRecordValue(record, ['연도', 'year']) || params.year).trim();
    const period = String(getRecordValue(record, ['월', '기간', 'period']) || '').trim();
    const accountCode = String(getRecordValue(record, HEADER_ALIASES.accountCode) || '').trim();
    const accountName = String(getRecordValue(record, HEADER_ALIASES.accountName) || '').trim();
    const usageCode = String(getRecordValue(record, HEADER_ALIASES.deptCode) || '').trim();
    const usageDept = String(getRecordValue(record, HEADER_ALIASES.usageDept) || '').trim();
    const amount = parseAmount(getRecordValue(record, ['증감액', '증액', '조정액', '금액', 'amount']));

    const monthIndex = parsePeriodMonth(period);

    if (!rowYear || monthIndex === null || !accountCode || !usageCode) {
      errorRows.push({
        rowNum,
        message: '연도, 월, 계정코드, 부서코드, 증감액 중 필수 항목이 누락되었습니다.',
        severity: 'error',
      });
      return;
    }

    const resolvedDept = resolveDepartmentName(usageCode, usageDept);
    const resolvedAccount = resolveAccountByCode({
      accountCode,
      uploadedName: accountName,
      year: rowYear,
    });

    const documentNo = String(getRecordValue(record, ['전표번호', '전표', 'documentno', 'voucherno', 'documentNo', 'voucherNo']) || '').trim() || undefined;
    const documentLineNo = String(getRecordValue(record, ['전표행번호', '행번호', 'documentlineno', 'lineno', 'documentLineNo', 'lineNo']) || '').trim() || undefined;

    const sourceRowIdVal = (() => {
      const rawId = getRecordValue(record, ['sourcerowid', 'rowid', 'uniqueid', '원천id', '원천ID', '행id', '행ID']);
      return rawId !== undefined && rawId !== null && String(rawId).trim() !== '' ? String(rawId).trim() : undefined;
    })();

    actualRows.push({
      id: params.existingCount + actualRows.length + 1,
      sourceRowId: sourceRowIdVal,
      sourceFileFingerprint: params.sourceFileFingerprint,
      year: rowYear,
      period: `${monthIndex + 1}월`,
      periodMonth: monthIndex + 1,
      accountCode: resolvedAccount.code,
      accountName: resolvedAccount.name,
      controlType: 'D.부서',
      usageCode,
      usageDept: resolvedDept.name || usageDept || usageCode,
      amount,
      additional: amount,
      transferred: 0,
      carriedOver: 0,
      planned: 0,
      completed: 0,
      balance: amount,
      remarks: '증액반영 업로드',
      uploadBatchId: params.uploadBatchId || 'batch_' + Date.now(),
      sourceSheetName: params.sourceSheetName || 'Sheet1',
      sourceRowNumber: rowNum,
      documentNo,
      documentLineNo
    });
  });

  return {
    format: 'BUDGET_ADJUSTMENT_FLAT',
    sourceRowCount: params.records.length,
    generatedRowCount: actualRows.length,
    actualRows,
    budgetRows: [],
    warningRows,
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
  uploadKind?: string;
  uploadBatchId?: string;
  sourceSheetName?: string;
  sourceFileFingerprint?: string;
  selectedActualMonths?: number[];
}): UploadParseResult {
  const isActualUpload = params.planType === '실적' || params.uploadKind === 'monthlyActual';

  if (isActualUpload && params.selectedActualMonths !== undefined) {
    const normMonths = normalizeSelectedActualMonths(params.selectedActualMonths);
    if (normMonths.length === 0) {
      return {
        format: detectUploadType(params.headers),
        sourceRowCount: params.records.length,
        generatedRowCount: 0,
        actualRows: [],
        budgetRows: [],
        warningRows: [],
        errorRows: [{
          rowNum: 0,
          message: '가져올 실적 월을 한 개 이상 선택해주세요.',
          severity: 'error'
        }]
      };
    }
  }

  const format = detectUploadType(params.headers);

  let result: UploadParseResult;

  if (params.planType === '증액반영') {
    if (format === 'MONTHLY_WIDE') {
      result = parseWideMonthlyRows(params);
    } else {
      result = parseBudgetAdjustmentRows(params);
    }
  } else if (format === 'MONTHLY_WIDE') {
    result = parseWideMonthlyRows(params);
  } else if (format === 'FLAT') {
    result = parseFlatRows(params);
  } else {
    result = { format: 'UNKNOWN', sourceRowCount: params.records.length, generatedRowCount: 0, actualRows: [], budgetRows: [], warningRows: [], errorRows: [] };
  }

  if (isActualUpload && params.records.length > 0 && result.actualRows.length === 0 && result.errorRows.length === 0) {
    result.errorRows.push({
      rowNum: 0,
      message: '선택한 월에 해당하는 실적 데이터가 없습니다. 파일의 기간 형식과 선택 월을 확인해주세요.',
      severity: 'error'
    });
  }

  return result;
}

export function findHeaderRowIndex(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const headers = (rows[i] || []).map(String);
    const format = detectUploadType(headers);
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

export function isProbablyBudgetAdjustmentRow(row: any[]): boolean {
  if (row.length < 5) return false;
  const year = String(row[0] ?? '').trim();
  const period = String(row[1] ?? '').trim();
  const accountCode = String(row[2] ?? '').trim();
  const accountName = String(row[3] ?? '').trim();
  const deptCode = String(row[4] ?? '').trim();
  const deptName = String(row[5] ?? '').trim();
  const amount = String(row[6] ?? '').trim();

  const looksYear = /^20\d{2}$/.test(year);
  const looksMonth = /^(0?[1-9]|1[0-2])월?$/.test(period);
  const looksAccount = /^[A-Z]?\d{5,}/i.test(accountCode);
  const looksDept = /^[0-9A-Za-z_-]{2,20}$/.test(deptCode);
  const normalizedAmount = amount.replace(/,/g, '').replace(/₩/g, '').replace(/원/g, '').replace(/\s/g, '');

  return looksYear && looksMonth && looksAccount && !!accountName && looksDept && !!deptName && normalizedAmount !== '' && !Number.isNaN(Number(normalizedAmount));
}

export function buildBudgetAdjustmentHeaders(): string[] {
  return ['연도', '월', '계정코드', '계정명', '부서코드', '부서명', '증감액'];
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
