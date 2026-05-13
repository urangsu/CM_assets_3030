// A thin wrapper around localStorage for Budgets
import { getBudgetDataKey } from '../lib/storageKeys';

export const BudgetRepository = {
  getRows: (deptCode: string, year: string, planType: string): any[] => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  saveRows: (deptCode: string, year: string, planType: string, rows: any[]): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    localStorage.setItem(key, JSON.stringify(rows));
  }
};
