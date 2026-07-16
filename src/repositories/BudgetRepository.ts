// A thin wrapper around localStorage for Budgets
import { getBudgetDataKey, readBudgetData } from '../lib/storageKeys';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';
import { getPlanTypeAliases, normalizePlanType, isValidPlanType, normalizePlanTypeForWrite, inspectLegacyPlanType } from '../lib/planTypes';
import { STORAGE_KEYS } from '../constants';
import { safeJsonParse } from '../lib/safeStorage';
import { getActualSourceIdentity } from '../lib/actualIdentity';

function hasExplicitMonthlyValue(rawValues: unknown, index: number): boolean {
  if (!Array.isArray(rawValues)) return false;
  if (!(index in rawValues)) return false;

  const value = rawValues[index];
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function normalizeBudgetRows(rows: any[], deptCode: string): any[] {
  const map = new Map<string, any>();

  rows.forEach((rawRow) => {
    const code = String(rawRow.code || '').trim();
    if (!code) return;

    const attributedDeptCode = String(rawRow.attributedDeptCode || deptCode).trim();
    const key = `${attributedDeptCode}|${code}`;

    const values = Array.from({ length: 12 }, (_, i) =>
      hasExplicitMonthlyValue(rawRow.values, i) ? (Number(rawRow.values[i]) || 0) : 0
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
    const mergedValues = Array.from({ length: 12 }, (_, index) => {
      if (hasExplicitMonthlyValue(rawRow.values, index)) {
        return Number(rawRow.values[index]) || 0;
      }

      return Number(existing.values?.[index]) || 0;
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
  const mapWithIdentity = new Map<string, any>();
  const rowsWithoutIdentity: any[] = [];

  rows.forEach((rawRow) => {
    const year = String(rawRow.year || '').trim();
    const period = String(rawRow.period || '').trim();
    const usageCode = String(rawRow.usageCode || '').trim();
    const accountCode = String(rawRow.accountCode || '').trim();

    if (!usageCode || !accountCode || !period || !year) return;

    const identity = getActualSourceIdentity(rawRow);
    if (identity) {
      mapWithIdentity.set(identity, {
        ...rawRow,
        year,
        period,
        usageCode,
        accountCode,
      });
    } else {
      rowsWithoutIdentity.push({
        ...rawRow,
        year,
        period,
        usageCode,
        accountCode,
        diagnostic: 'DUPLICATE_IDENTITY_MISSING',
        diagnosticError: 'DUPLICATE_IDENTITY_MISSING',
      });
    }
  });

  return [...Array.from(mapWithIdentity.values()), ...rowsWithoutIdentity];
}

function removeLegacyBudgetKeysAfterNormalizedSave(deptCode: string, year: string, planType: string) {
  const normalized = normalizePlanType(planType);
  if (!normalized) return;
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
    const inspection = inspectLegacyPlanType(planType);
    if (!inspection.isSupported) {
      return [{
        code: 'INVALID_PLAN_TYPE',
        status: 'unsupported-plan-type',
        originalPlanType: planType,
        storageKey: `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${planType}`
      }];
    }
    const raw = readBudgetData(deptCode, year, planType);
    const parsed = safeJsonParse<any[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  },

  saveRows: (deptCode: string, year: string, planType: string, rows: any[]): void => {
    const safePlanType = normalizePlanTypeForWrite(planType);
    const key = getBudgetDataKey(deptCode, year, safePlanType);
    const normalizedRows = normalizeBudgetRows(rows, deptCode);
    localStorage.setItem(key, JSON.stringify(normalizedRows));
    removeLegacyBudgetKeysAfterNormalizedSave(deptCode, year, safePlanType);
    clearDataLoaderCache();
  },

  deleteRows: (deptCode: string, year: string, planType: string): void => {
    const safePlanType = normalizePlanTypeForWrite(planType);
    for (const candidate of getPlanTypeAliases(safePlanType)) {
      const key = `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${candidate}`;
      localStorage.removeItem(key);
    }

    const normalizedKey = getBudgetDataKey(deptCode, year, safePlanType);
    localStorage.removeItem(normalizedKey);

    clearDataLoaderCache();
  }
};

