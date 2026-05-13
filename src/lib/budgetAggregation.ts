import { getBudgetDataKey, getActualDataKey } from './storageKeys';
import { SALARY_CATEGORIES } from '../constants';

export interface BudgetRow {
  code: string;
  attributedDeptCode: string;
  values: number[];
  // ... other fields
}

export interface ActualData {
  usageCode: string;
  accountCode: string;
  amount: number;
  period: string; // 1-12
  completed: boolean;
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

export const isSalaryAccount = (accountName: string) => {
  return SALARY_CATEGORIES.some(catAccountName => accountName.includes(catAccountName));
};
