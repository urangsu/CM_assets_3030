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
        const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${item.id}`;
        savedActualsMap.set(key, item.attributedDeptCode);
      }
    });

    const internalAggregated = new Map<string, { deptCode: string; accountCode: string; accountName: string; amount: number }>();

    actualRows.forEach(item => {
       const key = `${year}_${item.period}_${item.usageCode}_${item.accountCode}_${item.id}`;
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
      deptCodes: allDepts.map(d => d.code),
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
        const compositeKey = `${dCode}_${row.code}`;
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

  const baseMap = new Map<string, { code: string; name: string; amount: number }>();
  const targetMap = new Map<string, { code: string; name: string; amount: number }>();

  let baseMfg = 0;
  let baseSga = 0;
  let targetMfg = 0;
  let targetSga = 0;

  baseRows.forEach(row => {
    // Top-level department/accounting boundary filtering
    if (activeDept === 'mfg' && row.accountingType !== '제조') return;
    if (activeDept === 'sga' && row.accountingType !== '판관') return;

    // Filters for classification
    if (selectedAccountingType !== '전체' && row.accountingType !== selectedAccountingType) return;
    if (selectedAccountClass !== '전체' && row.accountClass !== selectedAccountClass) return;

    if (row.accountingType === '제조') baseMfg += row.amount;
    if (row.accountingType === '판관') baseSga += row.amount;

    const groupKey = groupBy === 'dept' ? row.deptCode : row.accountCode;
    const resolvedName = groupBy === 'dept'
      ? (allDepts.find(d => d.code === row.deptCode)?.name || row.deptCode)
      : row.accountName;

    const existing = baseMap.get(groupKey);
    if (existing) {
      existing.amount += row.amount;
    } else {
      baseMap.set(groupKey, { code: groupKey, name: resolvedName, amount: row.amount });
    }
  });

  targetRows.forEach(row => {
    // Top-level department/accounting boundary filtering
    if (activeDept === 'mfg' && row.accountingType !== '제조') return;
    if (activeDept === 'sga' && row.accountingType !== '판관') return;

    // Filters for classification
    if (selectedAccountingType !== '전체' && row.accountingType !== selectedAccountingType) return;
    if (selectedAccountClass !== '전체' && row.accountClass !== selectedAccountClass) return;

    if (row.accountingType === '제조') targetMfg += row.amount;
    if (row.accountingType === '판관') targetSga += row.amount;

    const groupKey = groupBy === 'dept' ? row.deptCode : row.accountCode;
    const resolvedName = groupBy === 'dept'
      ? (allDepts.find(d => d.code === row.deptCode)?.name || row.deptCode)
      : row.accountName;

    const existing = targetMap.get(groupKey);
    if (existing) {
      existing.amount += row.amount;
    } else {
      targetMap.set(groupKey, { code: groupKey, name: resolvedName, amount: row.amount });
    }
  });

  const allCodes = new Set([...baseMap.keys(), ...targetMap.keys()]);
  const rows: ComparisonRow[] = Array.from(allCodes).map(code => {
    const baseItem = baseMap.get(code);
    const targetItem = targetMap.get(code);
    const name = baseItem?.name || targetItem?.name || 'Unknown';

    const baseAmount = baseItem?.amount || 0;
    const targetAmount = targetItem?.amount || 0;
    const variance = targetAmount - baseAmount;
    const variancePercent = calcVarianceRate(baseAmount, targetAmount);

    const rowAccountingType = groupBy === 'dept' ? '전체' : getAccountingType(code, name);
    const rowAccountClass = groupBy === 'dept' ? '부서' : classifyAccount(code, name);

    const status = getVarianceStatus({
      baseAmount,
      targetAmount,
      basePlanType,
      targetPlanType,
    });

    const isSalary = isSalaryAccountRow({
      accountCode: groupBy === 'dept' ? '' : code,
      accountName: groupBy === 'dept' ? '' : name,
      accountClass: rowAccountClass,
    });

    return {
      key: code,
      code,
      name,
      accountingType: rowAccountingType,
      accountClass: rowAccountClass,
      accountCode: groupBy === 'dept' ? '' : code,
      accountName: groupBy === 'dept' ? '' : name,
      deptCode: groupBy === 'dept' ? code : '',
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
  .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

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
