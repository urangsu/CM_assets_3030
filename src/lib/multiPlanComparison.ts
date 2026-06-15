import { BudgetPlanType, PlanType } from './planTypes';
import { normalizeCompareCode, normalizeDeptCode, resolveUnionMeta } from './varianceEngine';
import { classifyAccount, getAccountingType } from './accountClassification';
import { parseMonthIndex } from './monthFilter';
import { loadActualRows, loadBudgetRowsByDept } from './varianceDataLoader';
import { getEffectiveDeptCodeForActual } from './storageKeys';
import { AccountMeta } from './varianceAccountIndex';

export type MultiPlanDeptViewMode = 'ACCOUNT_TOTAL' | 'BY_DEPT';

export interface MultiPlanColumnConfig {
  id: string; // e.g. 'plan_경영계획' or 'actual'
  label: string;
  type: 'PLAN' | 'ACTUAL';
  year: string;
  planType: PlanType;
  sumEndMonth: number;
}

export interface MultiPlanCompareRow {
  rowKey: string;

  accountingType: string;
  accountClass: string;
  accountCode: string;
  accountName: string;

  writerDeptCode: string;
  writerDeptName: string;
  attributedDeptCode: string;
  attributedDeptName: string;

  monthlyByColumnId: Record<string, number[]>; // colId -> Array(12)
  totalByColumnId: Record<string, number>;      // colId -> sum up to sumEndMonth

  requiredIncreaseAmount: number;
}

const HR_DEPT_CODE = '32200';
const HR_DEPT_NAME = '경영지원그룹';

export function resolveWriterDeptForMultiPlan(row: any, allDepts: any[]) {
  const isSalary =
    row.accountClass === '직원급여' ||
    row.accountClass === '임원급여' ||
    row.accountClass === '급여' ||
    row.accountClass === '상여' ||
    row.accountClass === '임원활동수당' ||
    String(row.accountName || row.name || '').includes('급여') ||
    String(row.accountName || row.name || '').includes('상여') ||
    String(row.accountName || row.name || '').includes('임원활동수당');

  if (isSalary) {
    return {
      writerDeptCode: HR_DEPT_CODE,
      writerDeptName: HR_DEPT_NAME,
    };
  }

  const code = row.writerDeptCode || row.originalDeptCode || row.usageCode || row.deptCode || '';
  const resolvedDept = allDepts.find(d => d.code === code);
  const name = row.writerDeptName || row.originalDeptName || row.usageDept || row.deptName || (resolvedDept ? resolvedDept.name : code);

  return {
    writerDeptCode: code,
    writerDeptName: name,
  };
}

export function resolveAttributedDeptForMultiPlan(row: any, allDepts: any[]) {
  const code = row.attributedDeptCode || row.effectiveDeptCode || row.deptCode || row.usageCode || '';
  const resolvedDept = allDepts.find(d => d.code === code);
  const name = row.attributedDeptName || row.effectiveDeptName || row.deptName || row.usageDept || (resolvedDept ? resolvedDept.name : code);

  return {
    attributedDeptCode: code,
    attributedDeptName: name,
  };
}

export function getRowKey(params: {
  viewMode: MultiPlanDeptViewMode;
  writerDeptCode: string;
  attributedDeptCode: string;
  accountCode: string;
}) {
  const accountCode = normalizeCompareCode(params.accountCode);

  if (params.viewMode === 'BY_DEPT') {
    return [
      normalizeDeptCode(params.writerDeptCode),
      normalizeDeptCode(params.attributedDeptCode),
      accountCode,
    ].join('|');
  }

  return accountCode;
}

interface BuildMultiPlanRowsParams {
  year: string;
  selectedPlanTypes: BudgetPlanType[];
  planEndMonth: number;
  actualEndMonth: number;
  viewMode: MultiPlanDeptViewMode;
  deptCodes: string[];
  accountMetaMap: Map<string, AccountMeta>;
  hasSalaryAccess: boolean;
  includeSalaryRows: boolean;
  allDepts: any[];
  increaseBasisCol: string;
  increaseTargetCol: string;
}

export function buildMultiPlanComparisonRows(params: BuildMultiPlanRowsParams): {
  columns: MultiPlanColumnConfig[];
  rows: MultiPlanCompareRow[];
} {
  const {
    year,
    selectedPlanTypes,
    planEndMonth,
    actualEndMonth,
    viewMode,
    deptCodes,
    accountMetaMap,
    hasSalaryAccess,
    includeSalaryRows,
    allDepts,
    increaseBasisCol,
    increaseTargetCol,
  } = params;

  const deptCodesSet = new Set(deptCodes.map(c => normalizeDeptCode(c)));

  // 1. Build column configurations
  const columns: MultiPlanColumnConfig[] = [];
  selectedPlanTypes.forEach(planType => {
    columns.push({
      id: `plan_${planType}`,
      label: planType === '증액반영' ? '경영계획(증액반영)' : planType,
      type: 'PLAN',
      year,
      planType: planType as PlanType,
      sumEndMonth: planEndMonth,
    });
  });

  columns.push({
    id: 'actual',
    label: `실적(~${actualEndMonth}월)`,
    type: 'ACTUAL',
    year,
    planType: '실적',
    sumEndMonth: actualEndMonth,
  });

  // We will map rowKey -> MultiPlanCompareRow
  const rowMap = new Map<string, MultiPlanCompareRow>();

  // Helper to ensure row entry of rowMap is initialized
  function getOrInitRow(
    rowKey: string,
    meta: {
      accountCode: string;
      accountName: string;
      accountClass: string;
      accountingType: string;
      writerDeptCode: string;
      writerDeptName: string;
      attributedDeptCode: string;
      attributedDeptName: string;
    }
  ): MultiPlanCompareRow {
    let existing = rowMap.get(rowKey);
    if (!existing) {
      const monthlyByColumnId: Record<string, number[]> = {};
      const totalByColumnId: Record<string, number> = {};

      columns.forEach(col => {
        monthlyByColumnId[col.id] = Array(12).fill(0);
        totalByColumnId[col.id] = 0;
      });

      existing = {
        rowKey,
        accountingType: meta.accountingType,
        accountClass: meta.accountClass,
        accountCode: meta.accountCode,
        accountName: meta.accountName,
        writerDeptCode: viewMode === 'BY_DEPT' ? meta.writerDeptCode : '',
        writerDeptName: viewMode === 'BY_DEPT' ? meta.writerDeptName : '여러 부서',
        attributedDeptCode: viewMode === 'BY_DEPT' ? meta.attributedDeptCode : '',
        attributedDeptName: viewMode === 'BY_DEPT' ? meta.attributedDeptName : '여러 부서',
        monthlyByColumnId,
        totalByColumnId,
        requiredIncreaseAmount: 0,
      };
      rowMap.set(rowKey, existing);
    }
    return existing;
  }

  // 2. Load Plans (Budget Rows)
  columns.forEach(col => {
    if (col.type !== 'PLAN') return;

    const budgetRowsByDept = loadBudgetRowsByDept({
      year,
      planType: col.planType,
      deptCodes,
    });

    budgetRowsByDept.forEach((rows, dCode) => {
      rows.forEach((row: any) => {
        const rowDeptCode = normalizeDeptCode(row.attributedDeptCode || dCode);
        if (!deptCodesSet.has(rowDeptCode)) return;

        const meta = accountMetaMap.get(row.code);
        const name = meta?.name || row.name || `미등록 계정(${row.code})`;
        const accountClass = meta?.accountClass || classifyAccount(row.code, name);
        const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

        if (!hasSalaryAccess && isSalary) return;
        if (!includeSalaryRows && isSalary) return;

        const accountingType = meta?.accountingType || getAccountingType(row.code, name);
        const accountCode = normalizeCompareCode(row.code);

        // Resolve Departments
        const writerVal = resolveWriterDeptForMultiPlan({ ...row, accountClass }, allDepts);
        const attribVal = resolveAttributedDeptForMultiPlan({ ...row, accountClass }, allDepts);

        // Adjust attributed side
        attribVal.attributedDeptCode = rowDeptCode;
        const resolvedAttribDeptName = allDepts.find(d => d.code === rowDeptCode)?.name;
        attribVal.attributedDeptName = resolvedAttribDeptName || attribVal.attributedDeptName || rowDeptCode;

        const rowKey = getRowKey({
          viewMode,
          writerDeptCode: writerVal.writerDeptCode,
          attributedDeptCode: attribVal.attributedDeptCode,
          accountCode,
        });

        const compareRow = getOrInitRow(rowKey, {
          accountCode,
          accountName: name,
          accountClass,
          accountingType,
          writerDeptCode: writerVal.writerDeptCode,
          writerDeptName: writerVal.writerDeptName,
          attributedDeptCode: attribVal.attributedDeptCode,
          attributedDeptName: attribVal.attributedDeptName,
        });

        // Add monthly values
        for (let m = 0; m < 12; m++) {
          const val = Number(row.values?.[m] || 0);
          compareRow.monthlyByColumnId[col.id][m] += val;
        }
      });
    });
  });

  // 3. Load Actual
  const actualCol = columns.find(c => c.type === 'ACTUAL');
  if (actualCol) {
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
      const effectiveDeptCode = normalizeDeptCode(overriddenDeptCode || getEffectiveDeptCodeForActual(item));

      if (!deptCodesSet.has(effectiveDeptCode)) return;

      const periodStr = String(item.period || '');
      const mIndex = parseMonthIndex(periodStr);
      if (mIndex === null) return;

      const meta = accountMetaMap.get(item.accountCode);
      const name = meta?.name || item.accountName || `미등록 계정(${item.accountCode})`;
      const accountClass = meta?.accountClass || classifyAccount(item.accountCode, name);
      const isSalary = meta?.isSalary ?? (accountClass === '직원급여' || accountClass === '임원급여');

      if (!hasSalaryAccess && isSalary) return;
      if (!includeSalaryRows && isSalary) return;

      const accountingType = meta?.accountingType || getAccountingType(item.accountCode, name);
      const amount = Number(item.completed || 0);
      const accountCode = normalizeCompareCode(item.accountCode);

      // Resolve Departments
      const writerVal = resolveWriterDeptForMultiPlan({ ...item, accountClass }, allDepts);
      const attribVal = resolveAttributedDeptForMultiPlan({ ...item, accountClass }, allDepts);

      attribVal.attributedDeptCode = effectiveDeptCode;
      const resolvedAttribDeptName = allDepts.find(d => d.code === effectiveDeptCode)?.name;
      attribVal.attributedDeptName = resolvedAttribDeptName || attribVal.attributedDeptName || effectiveDeptCode;

      const rowKey = getRowKey({
        viewMode,
        writerDeptCode: writerVal.writerDeptCode,
        attributedDeptCode: attribVal.attributedDeptCode,
        accountCode,
      });

      const compareRow = getOrInitRow(rowKey, {
        accountCode,
        accountName: name,
        accountClass,
        accountingType,
        writerDeptCode: writerVal.writerDeptCode,
        writerDeptName: writerVal.writerDeptName,
        attributedDeptCode: attribVal.attributedDeptCode,
        attributedDeptName: attribVal.attributedDeptName,
      });

      compareRow.monthlyByColumnId[actualCol.id][mIndex] += amount;
    });
  }

  // 4. Calculate Totals (sum up to sumEndMonth for each column) and RequiredIncreaseAmount
  const finalRows: MultiPlanCompareRow[] = [];

  rowMap.forEach(row => {
    // Check if row has any non-zero value across columns to avoid empty records
    let hasAnyValue = false;

    columns.forEach(col => {
      // Compute total based on its sumEndMonth (1-indexed limit, 1~N)
      let sum = 0;
      for (let m = 0; m < col.sumEndMonth; m++) {
        sum += row.monthlyByColumnId[col.id][m];
      }
      row.totalByColumnId[col.id] = sum;

      // also check if any monthly cell is non-zero
      for (let m = 0; m < 12; m++) {
        if (row.monthlyByColumnId[col.id][m] !== 0) {
          hasAnyValue = true;
        }
      }
    });

    if (hasAnyValue) {
      const basisVal = row.totalByColumnId[increaseBasisCol] || 0;
      const targetVal = row.totalByColumnId[increaseTargetCol] || 0;
      row.requiredIncreaseAmount = targetVal - basisVal;

      finalRows.push(row);
    }
  });

  return {
    columns,
    rows: finalRows,
  };
}
