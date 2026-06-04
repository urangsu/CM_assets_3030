// A thin wrapper around localStorage for Budgets
import { getBudgetDataKey } from '../lib/storageKeys';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';

export const BudgetRepository = {
  getRows: (deptCode: string, year: string, planType: string): any[] => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  saveRows: (deptCode: string, year: string, planType: string, rows: any[]): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    localStorage.setItem(key, JSON.stringify(rows));
    clearDataLoaderCache();
  },

  deleteRows: (deptCode: string, year: string, planType: string): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    localStorage.removeItem(key);
    clearDataLoaderCache();
  }
};
