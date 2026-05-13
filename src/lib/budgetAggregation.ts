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

export function parsePeriodMonth(period: string | number): number {
  if (typeof period === 'number') return period - 1;
  const str = String(period).trim();
  const match = str.match(/(?:^\d{4}[-./])?(0?[1-9]|1[0-2])월?$/);
  if (match && match[1]) {
    return parseInt(match[1], 10) - 1;
  }
  const justNumbers = str.replace(/[^0-9]/g, '');
  if (justNumbers.length > 0) {
      if (justNumbers.length === 6) {
          return parseInt(justNumbers.slice(4), 10) - 1;
      }
      return parseInt(justNumbers, 10) - 1;
  }
  return 0;
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

export const aggregateByAccount = () => {}; // placeholder for future
export const aggregateByDept = () => {}; // placeholder for future
export const aggregateByDeptAccount = () => {}; // placeholder for future
