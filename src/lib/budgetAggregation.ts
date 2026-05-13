import { getBudgetDataKey, getActualDataKey } from './storageKeys';
import { SALARY_CATEGORIES } from '../constants';
import { INITIAL_CATEGORIES } from '../pages/AccountSelection';

export interface BudgetRow {
  code: string;
  accountName?: string;
  attributedDeptCode: string;
  values: number[];
  // ... other fields
}

export interface ActualData {
  id?: number;
  year?: string;
  period: string;
  accountCode: string;
  accountName?: string;
  usageCode: string;
  amount: number;
  completed: number; 
  // ... other fields
}

export function parsePeriodMonth(period: string | number): number | null {
  if (typeof period === 'number') return period - 1;
  const str = String(period).trim();
  const match = str.match(/(?:^\d{4}[-./])?(0?[1-9]|1[0-2])월?$/);
  if (match && match[1]) {
    return parseInt(match[1], 10) - 1;
  }
  const justNumbers = str.replace(/[^0-9]/g, '');
  if (justNumbers.length > 0) {
      if (justNumbers.length === 6) {
          const monthStr = justNumbers.slice(4);
          const month = parseInt(monthStr, 10);
          if (month >= 1 && month <= 12) return month - 1;
      }
      const num = parseInt(justNumbers, 10);
      if (num >= 1 && num <= 12) return num - 1;
  }
  return null;
}

export const getBudgetRowsByDeptYearPlan = (deptCodes: string[], year: string, planType: string): any[] => {
  let rows: any[] = [];
  deptCodes.forEach(deptCode => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const savedData = localStorage.getItem(key);
    if (savedData) {
      rows = [...rows, ...JSON.parse(savedData)];
    }
  });
  return rows;
};

export const getActualRowsByYear = (year: string): ActualData[] => {
  const savedData = localStorage.getItem(getActualDataKey(year));
  return savedData ? JSON.parse(savedData) : [];
};

export const isSalaryAccountCode = (accountCode: string) => {
  let isSalary = false;
  INITIAL_CATEGORIES.forEach(cat => {
    if (SALARY_CATEGORIES.includes(cat.name)) {
      if (cat.accounts.some((acc: any) => acc.code === accountCode)) {
        isSalary = true;
      }
    }
  });
  return isSalary;
};

export interface MonthlyDetail {
  month: number;
  budget: number;
  actual: number;
  overrunAmount: number;
  balance: number;
  status: '정상' | '초과' | '무예산 집행';
}

export interface DeptAccountSummary {
  deptCode: string;
  accountCode: string;
  accountName: string;
  qBudget: number;
  yBudget: number;
  qActual: number;
  yActual: number;
  balance: number;
  overrunAmount: number;
  overrunRate: number | null;
  status: '정상' | '초과' | '무예산 집행';
  overrunMonths: number[];
  maxOverrunMonth: number | null;
  maxOverrunAmount: number;
  monthlyDetails: MonthlyDetail[];
}

export function aggregateByDeptAccount(params: {
  budgetRows: BudgetRow[];
  actualRows: ActualData[];
  months: number[];
  allowedDeptCodes: string[];
  canViewSalary: boolean;
}): DeptAccountSummary[] {
  const { budgetRows, actualRows, months, allowedDeptCodes, canViewSalary } = params;
  const unionKeys = new Set<string>();

  const budgetMap = new Map<string, BudgetRow>();
  budgetRows.forEach(row => {
    const key = `${row.attributedDeptCode}_${row.code}`;
    unionKeys.add(key);
    budgetMap.set(key, { ...row });
  });

  const actualMap = new Map<string, { qActual: number, yActual: number, accountName: string, monthlyActuals: Record<number, number> }>();
  actualRows.forEach(a => {
    const monthIndex = parsePeriodMonth(a.period);
    if (monthIndex === null) return; // Skip invalid periods
    
    const isQuarter = months.includes(monthIndex);
    const key = `${a.usageCode}_${a.accountCode}`;
    
    // Only union if the dept is allowed (preventing random dept leakage via actuals)
    if (allowedDeptCodes.includes(a.usageCode)) {
      unionKeys.add(key);
    }

    const existing = actualMap.get(key) || { qActual: 0, yActual: 0, accountName: a.accountName || a.accountCode, monthlyActuals: {} };
    if (isQuarter) existing.qActual += a.completed || 0;
    existing.yActual += a.completed || 0;
    existing.monthlyActuals[monthIndex] = (existing.monthlyActuals[monthIndex] || 0) + (a.completed || 0);
    actualMap.set(key, existing);
  });

  const results: DeptAccountSummary[] = [];

  Array.from(unionKeys).forEach(key => {
    const [deptCode, accountCode] = key.split('_');

    // Filter by permissions
    if (!allowedDeptCodes.includes(deptCode)) return;
    if (!canViewSalary && isSalaryAccountCode(accountCode)) return;

    const budgetRow = budgetMap.get(key);
    const actualRow = actualMap.get(key);

    const qBudget = budgetRow ? months.reduce((sum, m) => sum + (budgetRow.values[m] || 0), 0) : 0;
    const yBudget = budgetRow ? budgetRow.values.reduce((sum, v) => sum + (v || 0), 0) : 0;

    const qActual = actualRow ? actualRow.qActual : 0;
    const yActual = actualRow ? actualRow.yActual : 0;

    const overrunAmount = Math.max(qActual - qBudget, 0);
    const balance = qBudget - qActual;
    const overrunRate = qBudget > 0 ? (qActual / qBudget) * 100 : null;

    let status: '정상' | '초과' | '무예산 집행' = '정상';
    if (qBudget === 0 && qActual > 0) status = '무예산 집행';
    else if (qActual > qBudget) status = '초과';

    const monthlyDetails: MonthlyDetail[] = [];
    const overrunMonths: number[] = [];
    let maxOverrunMonth: number | null = null;
    let maxOverrunAmount = 0;

    months.forEach(m => {
      const b = budgetRow ? (budgetRow.values[m] || 0) : 0;
      const a = actualRow ? (actualRow.monthlyActuals[m] || 0) : 0;
      const mOverrun = Math.max(a - b, 0);
      const mBalance = b - a;
      
      let mStatus: '정상' | '초과' | '무예산 집행' = '정상';
      if (b === 0 && a > 0) mStatus = '무예산 집행';
      else if (a > b) mStatus = '초과';

      if (mStatus !== '정상') {
        overrunMonths.push(m + 1); // 1-based month
        if (mOverrun > maxOverrunAmount) {
          maxOverrunAmount = mOverrun;
          maxOverrunMonth = m + 1;
        }
      }

      monthlyDetails.push({
        month: m + 1,
        budget: b,
        actual: a,
        overrunAmount: mOverrun,
        balance: mBalance,
        status: mStatus
      });
    });

    results.push({
      deptCode,
      accountCode,
      accountName: budgetRow?.accountName || actualRow?.accountName || accountCode,
      qBudget,
      yBudget,
      qActual,
      yActual,
      balance,
      overrunAmount,
      overrunRate,
      status,
      overrunMonths,
      maxOverrunMonth,
      maxOverrunAmount,
      monthlyDetails
    });
  });

  return results;
}

export function aggregateByAccount(params: {
  budgetRows: BudgetRow[];
  actualRows: ActualData[];
  months: number[];
  allowedDeptCodes: string[];
  canViewSalary: boolean;
}) {
  const result = aggregateByDeptAccount(params);
  // Group by accountCode
  const accountMap = new Map<string, any>();
  result.forEach(r => {
    if (!accountMap.has(r.accountCode)) {
      accountMap.set(r.accountCode, { ...r, deptCode: 'ALL' });
    } else {
      const existing = accountMap.get(r.accountCode);
      existing.qBudget += r.qBudget;
      existing.yBudget += r.yBudget;
      existing.qActual += r.qActual;
      existing.yActual += r.yActual;
      existing.overrunAmount = Math.max(existing.qActual - existing.qBudget, 0);
      existing.balance = existing.qBudget - existing.qActual;
      existing.overrunRate = existing.qBudget > 0 ? (existing.qActual / existing.qBudget) * 100 : null;
      if (existing.qBudget === 0 && existing.qActual > 0) existing.status = '무예산 집행';
      else if (existing.qActual > existing.qBudget) existing.status = '초과';
      else existing.status = '정상';
    }
  });
  return Array.from(accountMap.values());
}

export function aggregateByDept(params: {
  budgetRows: BudgetRow[];
  actualRows: ActualData[];
  months: number[];
  allowedDeptCodes: string[];
  canViewSalary: boolean;
}) {
  const result = aggregateByDeptAccount(params);
  // Group by deptCode
  const deptMap = new Map<string, any>();
  result.forEach(r => {
    if (!deptMap.has(r.deptCode)) {
      deptMap.set(r.deptCode, { ...r, accountCode: 'ALL', accountName: '전체' });
    } else {
      const existing = deptMap.get(r.deptCode);
      existing.qBudget += r.qBudget;
      existing.yBudget += r.yBudget;
      existing.qActual += r.qActual;
      existing.yActual += r.yActual;
      existing.overrunAmount = Math.max(existing.qActual - existing.qBudget, 0);
      existing.balance = existing.qBudget - existing.qActual;
      existing.overrunRate = existing.qBudget > 0 ? (existing.qActual / existing.qBudget) * 100 : null;
      if (existing.qBudget === 0 && existing.qActual > 0) existing.status = '무예산 집행';
      else if (existing.qActual > existing.qBudget) existing.status = '초과';
      else existing.status = '정상';
    }
  });
  return Array.from(deptMap.values());
}
