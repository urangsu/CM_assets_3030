import { getBudgetDataKey, getActualDataKey, readBudgetData } from './storageKeys';
import { SALARY_CATEGORIES, DEPARTMENTS } from '../constants';
import { INITIAL_CATEGORIES } from '../pages/AccountSelection';

export interface BudgetRow {
  id?: number | string;
  year?: string;
  planType?: string;
  
  budgetType?: 'GENERAL' | 'INVESTMENT';
  managementCategory?: '제조' | '판관' | '안전' | '환경' | '연구' | '투자';
  
  writerDeptCode?: string;
  writerDeptName?: string;
  
  attributedDeptCode: string;
  attributedDeptName?: string;
  
  code: string;
  name?: string;
  
  accountCode?: string;
  accountName?: string;
  
  detail?: string;
  calculation?: string;
  
  annualAmount?: number;
  values: number[];
  
  sourceType?: 'MANUAL' | 'UPLOAD' | 'BUSINESS_ACTIVITY_AUTO' | 'TRANSFER';
  sourceFormulaId?: string;
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
  let allDepts: any[] = [];
  try {
    const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];
    const customDepts = customUsers.map((u: any) => ({ code: u.code }));
    allDepts = [...DEPARTMENTS, ...customDepts];
  } catch (e) {
    allDepts = DEPARTMENTS;
  }
  const uniqueDeptCodes = Array.from(new Set(allDepts.map(item => item.code)));

  // Load rows from all departments to support cross-department assignments
  let allRawRows: any[] = [];
  uniqueDeptCodes.forEach(dc => {
    const savedData = readBudgetData(dc, year, planType);
    if (savedData) {
      try {
        const rows = JSON.parse(savedData);
        rows.forEach((r: any) => {
          if (!r.writerDeptCode) {
            r.writerDeptCode = dc;
          }
        });
        allRawRows = [...allRawRows, ...rows];
      } catch (e) {
         // Silently fail or track
      }
    }
  });

  // Apply overrides
  let overrides: any[] = [];
  try {
    const ovs = localStorage.getItem('hycm_department_assignment_overrides');
    if (ovs) {
      overrides = JSON.parse(ovs);
    }
  } catch (e) {
    // ignore
  }

  const overrideMap = new Map<string, any>();
  overrides.forEach(ov => {
    const oKey = `${ov.year}_${ov.planType}_${ov.sourceDeptCode}_${ov.accountCode}_${ov.originalAssignedDeptCode}`;
    overrideMap.set(oKey, ov);
  });

  const processedRows = allRawRows.map(row => {
    const sDeptCode = row.writerDeptCode || row.attributedDeptCode;
    const aCode = row.code || row.accountCode;
    const oAssignedDept = row.attributedDeptCode;

    const oKey = `${year}_${planType}_${sDeptCode}_${aCode}_${oAssignedDept}`;
    const matchedOverride = overrideMap.get(oKey);

    if (matchedOverride) {
      return {
        ...row,
        attributedDeptCode: matchedOverride.newAssignedDeptCode,
        attributedDeptName: matchedOverride.newAssignedDeptName,
        isCustomAssigned: true
      };
    }
    return row;
  });

  return processedRows.filter(row => deptCodes.includes(row.attributedDeptCode));
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
  shortfallAmount: number;
  balance: number;
  status: '정상' | '초과' | '무예산 집행' | '미달';
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
  shortfallAmount: number;
  shortfallRate: number | null;
  status: '정상' | '초과' | '무예산 집행' | '미달';
  overrunMonths: number[];
  maxOverrunMonth: number | null;
  maxOverrunAmount: number;
  shortfallMonths: number[];
  maxShortfallMonth: number | null;
  maxShortfallAmount: number;
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
    const shortfallAmount = Math.max(qBudget - qActual, 0);
    const balance = qBudget - qActual;
    const overrunRate = qBudget > 0 ? (qActual / qBudget) * 100 : null;
    const shortfallRate = qBudget > 0 ? (shortfallAmount / qBudget) * 100 : null;

    let status: '정상' | '초과' | '무예산 집행' | '미달' = '정상';
    if (qBudget === 0 && qActual > 0) status = '무예산 집행';
    else if (qActual > qBudget) status = '초과';
    else if (qBudget > 0 && (qActual / qBudget) < 0.3) status = '미달';

    const monthlyDetails: MonthlyDetail[] = [];
    const overrunMonths: number[] = [];
    let maxOverrunMonth: number | null = null;
    let maxOverrunAmount = 0;
    
    const shortfallMonths: number[] = [];
    let maxShortfallMonth: number | null = null;
    let maxShortfallAmount = 0;

    months.forEach(m => {
      const b = budgetRow ? (budgetRow.values[m] || 0) : 0;
      const a = actualRow ? (actualRow.monthlyActuals[m] || 0) : 0;
      const mOverrun = Math.max(a - b, 0);
      const mShortfall = Math.max(b - a, 0);
      const mBalance = b - a;
      
      let mStatus: '정상' | '초과' | '무예산 집행' | '미달' = '정상';
      if (b === 0 && a > 0) mStatus = '무예산 집행';
      else if (a > b) mStatus = '초과';
      else if (b > 0 && (a / b) < 0.3) mStatus = '미달';

      if (mStatus === '초과' || mStatus === '무예산 집행') {
        overrunMonths.push(m + 1); // 1-based month
        if (mOverrun > maxOverrunAmount) {
          maxOverrunAmount = mOverrun;
          maxOverrunMonth = m + 1;
        }
      } else if (mStatus === '미달') {
        shortfallMonths.push(m + 1);
        if (mShortfall > maxShortfallAmount) {
          maxShortfallAmount = mShortfall;
          maxShortfallMonth = m + 1;
        }
      }

      monthlyDetails.push({
        month: m + 1,
        budget: b,
        actual: a,
        overrunAmount: mOverrun,
        shortfallAmount: mShortfall,
        balance: mBalance,
        status: mStatus
      });
    });

    results.push({
      deptCode,
      accountCode,
      accountName: budgetRow?.accountName || budgetRow?.name || actualRow?.accountName || accountCode,
      qBudget,
      yBudget,
      qActual,
      yActual,
      balance,
      overrunAmount,
      overrunRate,
      shortfallAmount,
      shortfallRate,
      status,
      overrunMonths,
      maxOverrunMonth,
      maxOverrunAmount,
      shortfallMonths,
      maxShortfallMonth,
      maxShortfallAmount,
      monthlyDetails
    });
  });

  return results;
}

export interface MonthlySummary {
  month: number;
  budget: number;
  actual: number;
  overrunAmount: number;
  shortfallAmount: number;
  balance: number;
  status: '정상' | '초과' | '무예산 집행' | '미달';
}

export interface AccountSummary {
  accountCode: string;
  accountName: string;
  qBudget: number;
  qActual: number;
  yBudget: number;
  yActual: number;
  balance: number;
  overrunAmount: number;
  overrunRate: number | null;
  usedDeptCount: number;
  overrunDeptCount: number;
  noBudgetDeptCount: number;
  monthlyDetails: MonthlySummary[];
}

export interface DeptSummary {
  deptCode: string;
  deptName?: string;
  qBudget: number;
  qActual: number;
  yBudget: number;
  yActual: number;
  balance: number;
  overrunAmount: number;
  overrunRate: number | null;
  overrunAccountCount: number;
  noBudgetAccountCount: number;
  monthlyDetails: MonthlySummary[];
}

export function aggregateByAccount(params: {
  budgetRows: BudgetRow[];
  actualRows: ActualData[];
  months: number[];
  allowedDeptCodes: string[];
  canViewSalary: boolean;
}): AccountSummary[] {
  const result = aggregateByDeptAccount(params);
  const accountMap = new Map<string, AccountSummary>();
  result.forEach(r => {
    if (!accountMap.has(r.accountCode)) {
      accountMap.set(r.accountCode, {
        accountCode: r.accountCode,
        accountName: r.accountName,
        qBudget: r.qBudget,
        qActual: r.qActual,
        yBudget: r.yBudget,
        yActual: r.yActual,
        balance: r.balance,
        overrunAmount: r.overrunAmount,
        overrunRate: r.overrunRate,
        usedDeptCount: 1,
        overrunDeptCount: r.status === '초과' ? 1 : 0,
        noBudgetDeptCount: r.status === '무예산 집행' ? 1 : 0,
        monthlyDetails: r.monthlyDetails.map(m => ({...m}))
      });
    } else {
      const existing = accountMap.get(r.accountCode)!;
      existing.qBudget += r.qBudget;
      existing.yBudget += r.yBudget;
      existing.qActual += r.qActual;
      existing.yActual += r.yActual;
      existing.usedDeptCount += 1;
      if (r.status === '초과') existing.overrunDeptCount += 1;
      if (r.status === '무예산 집행') existing.noBudgetDeptCount += 1;

      r.monthlyDetails.forEach((m, idx) => {
        if (!existing.monthlyDetails[idx]) {
          existing.monthlyDetails[idx] = {...m};
        } else {
          existing.monthlyDetails[idx].budget += m.budget;
          existing.monthlyDetails[idx].actual += m.actual;
          existing.monthlyDetails[idx].overrunAmount += m.overrunAmount;
          existing.monthlyDetails[idx].shortfallAmount += m.shortfallAmount;
        }
      });
    }
  });

  Array.from(accountMap.values()).forEach(acc => {
    acc.overrunAmount = Math.max(acc.qActual - acc.qBudget, 0);
    acc.balance = acc.qBudget - acc.qActual;
    acc.overrunRate = acc.qBudget > 0 ? (acc.qActual / acc.qBudget) * 100 : null;
    acc.monthlyDetails.forEach(m => {
      m.overrunAmount = Math.max(m.actual - m.budget, 0);
      m.shortfallAmount = Math.max(m.budget - m.actual, 0);
      m.balance = m.budget - m.actual;
      if (m.budget === 0 && m.actual > 0) m.status = '무예산 집행';
      else if (m.actual > m.budget) m.status = '초과';
      else if (m.budget > 0 && m.actual < m.budget) m.status = '미달';
      else m.status = '정상';
    });
  });

  return Array.from(accountMap.values());
}

export function aggregateByDept(params: {
  budgetRows: BudgetRow[];
  actualRows: ActualData[];
  months: number[];
  allowedDeptCodes: string[];
  canViewSalary: boolean;
}): DeptSummary[] {
  const result = aggregateByDeptAccount(params);
  const deptMap = new Map<string, DeptSummary>();
  result.forEach(r => {
    if (!deptMap.has(r.deptCode)) {
      deptMap.set(r.deptCode, {
        deptCode: r.deptCode,
        qBudget: r.qBudget,
        qActual: r.qActual,
        yBudget: r.yBudget,
        yActual: r.yActual,
        balance: r.balance,
        overrunAmount: r.overrunAmount,
        overrunRate: r.overrunRate,
        overrunAccountCount: r.status === '초과' ? 1 : 0,
        noBudgetAccountCount: r.status === '무예산 집행' ? 1 : 0,
        monthlyDetails: r.monthlyDetails.map(m => ({...m}))
      });
    } else {
      const existing = deptMap.get(r.deptCode)!;
      existing.qBudget += r.qBudget;
      existing.yBudget += r.yBudget;
      existing.qActual += r.qActual;
      existing.yActual += r.yActual;
      if (r.status === '초과') existing.overrunAccountCount += 1;
      if (r.status === '무예산 집행') existing.noBudgetAccountCount += 1;

      r.monthlyDetails.forEach((m, idx) => {
        if (!existing.monthlyDetails[idx]) {
          existing.monthlyDetails[idx] = {...m};
        } else {
          existing.monthlyDetails[idx].budget += m.budget;
          existing.monthlyDetails[idx].actual += m.actual;
          existing.monthlyDetails[idx].overrunAmount += m.overrunAmount;
          existing.monthlyDetails[idx].shortfallAmount += m.shortfallAmount;
        }
      });
    }
  });

  Array.from(deptMap.values()).forEach(d => {
    d.overrunAmount = Math.max(d.qActual - d.qBudget, 0);
    d.balance = d.qBudget - d.qActual;
    d.overrunRate = d.qBudget > 0 ? (d.qActual / d.qBudget) * 100 : null;
    d.monthlyDetails.forEach(m => {
      m.overrunAmount = Math.max(m.actual - m.budget, 0);
      m.shortfallAmount = Math.max(m.budget - m.actual, 0);
      m.balance = m.budget - m.actual;
      if (m.budget === 0 && m.actual > 0) m.status = '무예산 집행';
      else if (m.actual > m.budget) m.status = '초과';
      else if (m.budget > 0 && m.actual < m.budget) m.status = '미달';
      else m.status = '정상';
    });
  });

  return Array.from(deptMap.values());
}
