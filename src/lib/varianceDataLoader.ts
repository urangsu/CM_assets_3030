import { getActualDataKey, readBudgetData } from './storageKeys';

// Memory cache for parsed datasets to guarantee maximum performance and zero redundant JSON.parse calls
const actualRowsCache = new Map<string, any[]>();
const budgetRowsCache = new Map<string, any[]>();

export function clearDataLoaderCache() {
  actualRowsCache.clear();
  budgetRowsCache.clear();
}

export function loadActualRows(year: string): any[] {
  if (actualRowsCache.has(year)) {
    return actualRowsCache.get(year)!;
  }

  try {
    const key = getActualDataKey(year);
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    if (Array.isArray(rows)) {
      actualRowsCache.set(year, rows);
      return rows;
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
      const rows = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rows)) {
        budgetRowsCache.set(cacheKey, rows);
        result.set(deptCode, rows);
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
