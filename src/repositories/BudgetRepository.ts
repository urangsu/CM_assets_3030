// A thin wrapper around localStorage for Budgets
import { getBudgetDataKey, readBudgetData } from '../lib/storageKeys';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';
import { getPlanTypeAliases, normalizePlanType } from '../lib/planTypes';
import { STORAGE_KEYS } from '../constants';
import { safeJsonParse } from '../lib/safeStorage';

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

export function normalizeActualRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  rows.forEach((rawRow) => {
    const year = String(rawRow.year || '').trim();
    const period = String(rawRow.period || '').trim();
    const usageCode = String(rawRow.usageCode || '').trim();
    const accountCode = String(rawRow.accountCode || '').trim();

    if (!usageCode || !accountCode || !period || !year) return;

    const key = `${year}|${period}|${usageCode}|${accountCode}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...rawRow,
        year,
        period,
        usageCode,
        accountCode,
      });
      return;
    }

    // 뒤 행 우선 덮어쓰기 방식으로 머지하여 중복 제거
    map.set(key, {
      ...existing,
      ...rawRow,
      year,
      period,
      usageCode,
      accountCode,
    });
  });

  return Array.from(map.values());
}

function removeLegacyBudgetKeysAfterNormalizedSave(deptCode: string, year: string, planType: string) {
  const normalized = normalizePlanType(planType);
  const normalizedKey = getBudgetDataKey(deptCode, year, normalized);

  getPlanTypeAliases(planType).forEach(alias => {
    const key = `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${alias}`;
    if (key !== normalizedKey) {
      localStorage.removeItem(key);
    }
  });
}

export const BudgetRepository = {
  getRows: (deptCode: string, year: string, planType: string): any[] => {
    const raw = readBudgetData(deptCode, year, planType);
    const parsed = safeJsonParse<any[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  },

  saveRows: (deptCode: string, year: string, planType: string, rows: any[]): void => {
    const key = getBudgetDataKey(deptCode, year, planType);
    const normalizedRows = normalizeBudgetRows(rows, deptCode);
    localStorage.setItem(key, JSON.stringify(normalizedRows));
    removeLegacyBudgetKeysAfterNormalizedSave(deptCode, year, planType);
    clearDataLoaderCache();
  },

  deleteRows: (deptCode: string, year: string, planType: string): void => {
    const normalized = normalizePlanType(planType);

    for (const candidate of getPlanTypeAliases(planType)) {
      const key = `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${candidate}`;
      localStorage.removeItem(key);
    }

    const normalizedKey = getBudgetDataKey(deptCode, year, normalized);
    localStorage.removeItem(normalizedKey);

    clearDataLoaderCache();
  }
};

