import { AccountMeta } from './varianceAccountIndex';
import { parseMonthIndex, shouldIncludeMonth, MonthMode } from './monthFilter';
import { loadActualRows, loadBudgetRowsByDept } from './varianceDataLoader';
import { getEffectiveDeptCodeForActual } from './storageKeys';
import { classifyAccount, getAccountingType } from './accountClassification';
import { calcVarianceRate } from './varianceMath';
import { getVarianceStatus, normalizeCompareCode, normalizeDeptCode, resolveUnionMeta } from './varianceEngine';

export interface MonthlyMatrixItem {
  deptCode: string;
  deptName: string;
  accountCode: string;
  accountName: string;
  accountClass: string;
  accountingType: string;
  isSalary: boolean;
  monthly: number[]; // Array of size 12 for 1~12월 values
}

export interface MonthlyCompareMatrixRow {
  deptCode?: string;
  deptName?: string;
  accountClass: string;
  accountingType: string;
  accountCode: string;
  accountName: string;
  targetMonthly: number[];
  baseMonthly: number[];
  targetTotal: number;
  baseTotal: number;
  variance: number;
  varianceRate: number | null;
  status: string;
  isSalary?: boolean;
}

/**
 * Builds monthly matrix for a given dataset (either Plan/Budget or Actuals)
 */
export function buildMonthlyMatrix(params: {
  year: string;
  planType: string;
  monthMode: MonthMode;
  selectedMonth: number;
  deptCodes: string[];
  accountMetaMap: Map<string, AccountMeta>;
  hasSalaryAccess: boolean;
  includeSalaryRows: boolean;
  allDepts: any[];
}): Map<string, MonthlyMatrixItem> {
  const {
    year,
    planType,
    monthMode,
    selectedMonth,
    deptCodes,
    accountMetaMap,
    hasSalaryAccess,
    includeSalaryRows,
    allDepts,
  } = params;

  const deptCodesSet = new Set(deptCodes);
  const matrix = new Map<string, MonthlyMatrixItem>();

  const getDeptName = (c: string) => {
    const d = allDepts.find(x => x.code === c);
    return d ? d.name : c;
  };

  if (planType === '실적') {
    const actualRows = loadActualRows(year);

    // load overrides
    const savedActualsMap = new Map<string, string>();
    actualRows.forEach(item => {
      if (item.attributedDeptCode) {
        const itemId = item.id || item.sourceRowId || item.rowNo || item._rowIndex || 'no-id';
        const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${itemId}`;
        savedActualsMap.set(key, item.attributedDeptCode);
      }
    });

    actualRows.forEach(item => {
      const itemId = item.id || item.sourceRowId || item.rowNo || item._rowIndex || 'no-id';
      const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${itemId}`;
      const overriddenDeptCode = savedActualsMap.get(key);
      const effectiveDeptCode = overriddenDeptCode || getEffectiveDeptCodeForActual(item);

      if (!deptCodesSet.has(effectiveDeptCode)) return;

      const periodStr = String(item.period || '');
      const mIndex = parseMonthIndex(periodStr);
      if (mIndex === null) return;
      
      // Filter by month constraints
      if (!shouldIncludeMonth(mIndex, monthMode, selectedMonth)) return;

      const meta = accountMetaMap.get(item.accountCode);
      const name = meta?.name || item.accountName || `미등록 계정(${item.accountCode})`;
      const accountClass = meta?.accountClass || classifyAccount(item.accountCode, name);
      const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

      if (!hasSalaryAccess && isSalary) return;
      if (!includeSalaryRows && isSalary) return;

      const accountingType = meta?.accountingType || getAccountingType(item.accountCode, name);
      const amount = Number(item.completed || 0);

      const accountCode = normalizeCompareCode(item.accountCode);
      const deptCode = normalizeDeptCode(effectiveDeptCode);
      const mapKey = `${deptCode}|${accountCode}`;
      let itemInMap = matrix.get(mapKey);
      if (!itemInMap) {
        itemInMap = {
          deptCode: deptCode,
          deptName: getDeptName(deptCode),
          accountCode: accountCode,
          accountName: name,
          accountClass,
          accountingType,
          isSalary,
          monthly: Array(12).fill(0),
        };
        matrix.set(mapKey, itemInMap);
      }
      itemInMap.monthly[mIndex] += amount;
    });

  } else {
    // Budget
    const budgetRowsByDept = loadBudgetRowsByDept({
      year,
      planType,
      deptCodes,
    });

    budgetRowsByDept.forEach((rows, dCode) => {
      rows.forEach((row: any) => {
        const rowDeptCode = row.attributedDeptCode || dCode;

        if (!deptCodesSet.has(rowDeptCode)) return;

        const meta = accountMetaMap.get(row.code);
        const name = meta?.name || row.name || `미등록 계정(${row.code})`;
        const accountClass = meta?.accountClass || classifyAccount(row.code, name);
        const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

        if (!hasSalaryAccess && isSalary) return;
        if (!includeSalaryRows && isSalary) return;

        const accountingType = meta?.accountingType || getAccountingType(row.code, name);

        const accountCode = normalizeCompareCode(row.code);
        const rowDeptCodeNormalized = normalizeDeptCode(rowDeptCode);
        const mapKey = `${rowDeptCodeNormalized}|${accountCode}`;
        let itemInMap = matrix.get(mapKey);
        if (!itemInMap) {
          itemInMap = {
            deptCode: rowDeptCodeNormalized,
            deptName: getDeptName(rowDeptCodeNormalized),
            accountCode: accountCode,
            accountName: name,
            accountClass,
            accountingType,
            isSalary,
            monthly: Array(12).fill(0),
          };
          matrix.set(mapKey, itemInMap);
        }

        for (let m = 0; m < 12; m++) {
          if (shouldIncludeMonth(m, monthMode, selectedMonth)) {
            const amount = Number(row.values?.[m] || 0);
            itemInMap.monthly[m] += amount;
          }
        }
      });
    });
  }

  return matrix;
}

/**
 * Build comparison rows for Account-level sheet (aggregated by accountCode)
 */
export function buildAccountMonthlyCompareRows(params: {
  baseMatrix: Map<string, MonthlyMatrixItem>;
  targetMatrix: Map<string, MonthlyMatrixItem>;
  exportMonths: number[];
  basePlanType: string;
  targetPlanType: string;
  activeDept: string;
  selectedAccountingType: string;
  selectedAccountClass: string;
}): MonthlyCompareMatrixRow[] {
  const {
    baseMatrix,
    targetMatrix,
    exportMonths,
    basePlanType,
    targetPlanType,
    activeDept,
    selectedAccountingType,
    selectedAccountClass,
  } = params;

  const baseAccountMap = new Map<string, any>();

  baseMatrix.forEach(item => {
    const code = normalizeCompareCode(item.accountCode);
    let existing = baseAccountMap.get(code);
    if (!existing) {
      existing = {
        code,
        name: item.accountName,
        amount: 0,
        accountCode: code,
        accountName: item.accountName,
        accountClass: item.accountClass,
        accountingType: item.accountingType,
        isSalary: item.isSalary,
        monthly: Array(12).fill(0),
      };
      baseAccountMap.set(code, existing);
    }
    for (let m = 0; m < 12; m++) {
      existing.monthly[m] += item.monthly[m];
    }
  });

  const targetAccountMap = new Map<string, any>();

  targetMatrix.forEach(item => {
    const code = normalizeCompareCode(item.accountCode);
    let existing = targetAccountMap.get(code);
    if (!existing) {
      existing = {
        code,
        name: item.accountName,
        amount: 0,
        accountCode: code,
        accountName: item.accountName,
        accountClass: item.accountClass,
        accountingType: item.accountingType,
        isSalary: item.isSalary,
        monthly: Array(12).fill(0),
      };
      targetAccountMap.set(code, existing);
    }
    for (let m = 0; m < 12; m++) {
      existing.monthly[m] += item.monthly[m];
    }
  });

  const allAccountCodes = new Set([...baseAccountMap.keys(), ...targetAccountMap.keys()]);

  const rows: MonthlyCompareMatrixRow[] = Array.from(allAccountCodes).map(code => {
    const base = baseAccountMap.get(code);
    const target = targetAccountMap.get(code);
    
    // Resolve unified canonical meta
    const unionMeta = resolveUnionMeta(base, target);

    const baseMonthly = exportMonths.map(m => base ? base.monthly[m - 1] : 0);
    const targetMonthly = exportMonths.map(m => target ? target.monthly[m - 1] : 0);

    const baseTotal = baseMonthly.reduce((a, b) => a + b, 0);
    const targetTotal = targetMonthly.reduce((a, b) => a + b, 0);
    const variance = targetTotal - baseTotal;
    const varianceRate = calcVarianceRate(baseTotal, targetTotal);

    const status = getVarianceStatus({
      baseAmount: baseTotal,
      targetAmount: targetTotal,
      basePlanType,
      targetPlanType,
    });

    return {
      accountClass: unionMeta.accountClass,
      accountingType: unionMeta.accountingType,
      accountCode: unionMeta.accountCode,
      accountName: unionMeta.accountName,
      targetMonthly,
      baseMonthly,
      targetTotal,
      baseTotal,
      variance,
      varianceRate,
      status,
      isSalary: unionMeta.isSalary,
    };
  })
  .filter(row => row.baseTotal !== 0 || row.targetTotal !== 0)
  .filter(row => {
    if (activeDept === 'mfg' && row.accountingType !== '제조') return false;
    if (activeDept === 'sga' && row.accountingType !== '판관') return false;
    if (selectedAccountingType !== '전체' && row.accountingType !== selectedAccountingType) return false;
    if (selectedAccountClass !== '전체' && row.accountClass !== selectedAccountClass) return false;
    return true;
  });

  return rows;
}

/**
 * Builds details rows for department or group sheets (preserves deptCode and is not aggregated by account alone)
 */
export function buildDeptMonthlyCompareRows(params: {
  baseMatrix: Map<string, MonthlyMatrixItem>;
  targetMatrix: Map<string, MonthlyMatrixItem>;
  exportMonths: number[];
  basePlanType: string;
  targetPlanType: string;
  deptCodes: string[];
}): MonthlyCompareMatrixRow[] {
  const {
    baseMatrix,
    targetMatrix,
    exportMonths,
    basePlanType,
    targetPlanType,
    deptCodes,
  } = params;

  const deptCodesSet = new Set(deptCodes);
  const keys = new Set([...baseMatrix.keys(), ...targetMatrix.keys()]);

  const rows: MonthlyCompareMatrixRow[] = [];

  keys.forEach(key => {
    const base = baseMatrix.get(key);
    const target = targetMatrix.get(key);
    const ref = base || target!;

    if (!deptCodesSet.has(ref.deptCode)) return;

    const baseMonthly = exportMonths.map(m => base ? base.monthly[m - 1] : 0);
    const targetMonthly = exportMonths.map(m => target ? target.monthly[m - 1] : 0);

    const baseTotal = baseMonthly.reduce((sum, v) => sum + v, 0);
    const targetTotal = targetMonthly.reduce((sum, v) => sum + v, 0);
    const variance = targetTotal - baseTotal;
    const varianceRate = calcVarianceRate(baseTotal, targetTotal);

    const status = getVarianceStatus({
      baseAmount: baseTotal,
      targetAmount: targetTotal,
      basePlanType,
      targetPlanType,
    });

    rows.push({
      deptCode: ref.deptCode,
      deptName: ref.deptName,
      accountClass: ref.accountClass,
      accountingType: ref.accountingType,
      accountCode: ref.accountCode,
      accountName: ref.accountName,
      targetMonthly,
      baseMonthly,
      targetTotal,
      baseTotal,
      variance,
      varianceRate,
      status,
      isSalary: ref.isSalary,
    });
  });

  return rows;
}
