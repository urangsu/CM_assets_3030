// A thin wrapper around localStorage for Budgets
import { getBudgetDataKey } from '../lib/storageKeys';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';

export function normalizeBudgetRows(rows: any[], deptCode: string): any[] {
  const map = new Map<string, any>();

  rows.forEach((rawRow) => {
    const code = String(rawRow.code || '').trim();
    if (!code) return;

    const attributedDeptCode = String(rawRow.attributedDeptCode || deptCode).trim();
    const key = `${attributedDeptCode}|${code}`;

    const values = Array.from({ length: 12 }, (_, i) =>
      Number(rawRow.values?.[i] || 0)
    );

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...rawRow,
        code,
        attributedDeptCode,
        values,
      });
      return;
    }

    // 예산 계정은 부서+계정 기준 1행이어야 한다.
    // 중복 row가 있으면 월별 값은 "뒤 row 우선"으로 병합한다.
    const mergedValues = Array.from({ length: 12 }, (_, i) => {
      const nextVal = Number(values[i] || 0);
      const prevVal = Number(existing.values?.[i] || 0);

      if (nextVal !== 0) return nextVal;
      return prevVal;
    });

    map.set(key, {
      ...existing,
      ...rawRow,
      code,
      attributedDeptCode,
      values: mergedValues,
    });
  });

  return Array.from(map.values());
}

export const BudgetRepository = {
  getRows: (deptCode: string, year: string, planType: string): any[] => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  saveRows: (deptCode: string, year: string, planType: string, rows: any[]): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const normalizedRows = normalizeBudgetRows(rows, deptCode);
    localStorage.setItem(key, JSON.stringify(normalizedRows));
    clearDataLoaderCache();
  },

  deleteRows: (deptCode: string, year: string, planType: string): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    localStorage.removeItem(key);
    clearDataLoaderCache();
  }
};

