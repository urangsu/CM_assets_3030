import { getActualDataKey, readBudgetData, clearEffectiveDeptCache } from './storageKeys';
import { safeJsonParse } from './safeStorage';

// Memory cache for parsed datasets to guarantee maximum performance and zero redundant JSON.parse calls
const actualRowsCache = new Map<string, any[]>();
const budgetRowsCache = new Map<string, any[]>();

export function clearDataLoaderCache() {
  actualRowsCache.clear();
  budgetRowsCache.clear();
  clearEffectiveDeptCache();
}

export function loadActualRows(year: string): any[] {
  if (actualRowsCache.has(year)) {
    return actualRowsCache.get(year)!;
  }

  const key = getActualDataKey(year);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = safeJsonParse<unknown>(raw, null);
      if (parsed === null) {
        console.warn(`[varianceDataLoader] Failed to parse actual rows for key: ${key}. Returned null/invalid JSON.`);
      } else if (!Array.isArray(parsed)) {
        console.warn(`[varianceDataLoader] Actual rows data for key: ${key} is not an array`, parsed);
      } else {
        actualRowsCache.set(year, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Failed to load actual rows for year ${year}`, e);
  }

  actualRowsCache.set(year, []);
  return [];
}

export function loadBudgetRowsByDept(params: {
  year: string;
  planType: string;
  deptCodes: string[];
}): Map<string, any[]> {
  const result = new Map<string, any[]>();

  params.deptCodes.forEach(deptCode => {
    const cacheKey = `${deptCode}_${params.year}_${params.planType}`;
    if (budgetRowsCache.has(cacheKey)) {
      result.set(deptCode, budgetRowsCache.get(cacheKey)!);
      return;
    }

    try {
      const raw = readBudgetData(deptCode, params.year, params.planType);
      if (raw) {
        const parsed = safeJsonParse<unknown>(raw, null);
        if (parsed === null) {
          console.warn(`[varianceDataLoader] Failed to parse budget rows for deptCode: ${deptCode}, year: ${params.year}, planType: ${params.planType}. Returned null/invalid JSON.`);
          result.set(deptCode, []);
        } else if (!Array.isArray(parsed)) {
          console.warn(`[varianceDataLoader] Budget rows data for deptCode: ${deptCode}, year: ${params.year}, planType: ${params.planType} is not an array`, parsed);
          result.set(deptCode, []);
        } else {
          budgetRowsCache.set(cacheKey, parsed);
          result.set(deptCode, parsed);
        }
      } else {
        result.set(deptCode, []);
      }
    } catch (e) {
      console.error(`Failed to load budget rows for depth ${deptCode} inside loadBudgetRowsByDept`, e);
      result.set(deptCode, []);
    }
  });

  return result;
}
