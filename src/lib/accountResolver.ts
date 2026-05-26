import { INITIAL_CATEGORIES } from '../pages/AccountSelection';
import { STORAGE_KEYS, getAllDepartments } from '../constants';
import { getActualDataKey, getBudgetDataKey } from './storageKeys';

export type AccountResolveSource =
  | 'initial'
  | 'global'
  | 'budget'
  | 'actual'
  | 'fallback';

export interface ResolvedAccount {
  code: string;
  name: string;
  source: AccountResolveSource;
  isRegistered: boolean;
  uploadedName?: string;
  nameMismatch?: boolean;
}

function normalizeAccountCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .toLowerCase();
}

export function buildInitialAccountMap(): Map<string, string> {
  const map = new Map<string, string>();

  INITIAL_CATEGORIES.forEach((cat: any) => {
    cat.accounts.forEach((acc: any) => {
      const code = normalizeAccountCode(acc.code);
      const name = String(acc.name ?? '').trim();

      if (code && name) {
        map.set(code, name);
      }
    });
  });

  return map;
}

export function buildGlobalAccountMap(): Map<string, string> {
  const map = new Map<string, string>();

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    const categories = raw ? JSON.parse(raw) : [];

    categories.forEach((cat: any) => {
      (cat.accounts || []).forEach((acc: any) => {
        const code = normalizeAccountCode(acc.code);
        const name = String(acc.name ?? '').trim();

        if (code && name) {
          map.set(code, name);
        }
      });
    });
  } catch {
    // ignore
  }

  return map;
}

export function buildBudgetAccountMap(year?: string): Map<string, string> {
  const map = new Map<string, string>();

  try {
    const years = year ? [year] : ['2024', '2025', '2026', '2027'];
    const planTypes = ['경영계획', '수정경영계획', '1차 RP', '2차 RP'];

    getAllDepartments().forEach(dept => {
      years.forEach(y => {
        planTypes.forEach(planType => {
          const raw = localStorage.getItem(getBudgetDataKey(dept.code, y, planType));
          const rows = raw ? JSON.parse(raw) : [];

          rows.forEach((row: any) => {
            const code = normalizeAccountCode(row.code);
            const name = String(row.name ?? '').trim();

            if (code && name && !name.includes('미등록 계정')) {
              map.set(code, name);
            }
          });
        });
      });
    });
  } catch {
    // ignore
  }

  return map;
}

export function buildActualAccountMap(year?: string): Map<string, string> {
  const map = new Map<string, string>();

  try {
    const years = year ? [year] : ['2024', '2025', '2026', '2027'];

    years.forEach(y => {
      const raw = localStorage.getItem(getActualDataKey(y));
      const rows = raw ? JSON.parse(raw) : [];

      rows.forEach((row: any) => {
        const code = normalizeAccountCode(row.accountCode);
        const name = String(row.accountName ?? '').trim();

        if (code && name && !name.includes('미등록 계정')) {
          map.set(code, name);
        }
      });
    });
  } catch {
    // ignore
  }

  return map;
}

export function resolveAccountByCode(params: {
  accountCode: string;
  uploadedName?: string;
  year?: string;
}): ResolvedAccount {
  const code = normalizeAccountCode(params.accountCode);
  const uploadedName = String(params.uploadedName ?? '').trim();

  const sources: Array<[AccountResolveSource, Map<string, string>]> = [
    ['initial', buildInitialAccountMap()],
    ['global', buildGlobalAccountMap()],
    ['budget', buildBudgetAccountMap(params.year)],
    ['actual', buildActualAccountMap(params.year)],
  ];

  for (const [source, map] of sources) {
    const masterName = map.get(code);

    if (masterName) {
      return {
        code,
        name: masterName,
        source,
        isRegistered: true,
        uploadedName,
        nameMismatch:
          !!uploadedName &&
          normalizeName(uploadedName) !== normalizeName(masterName),
      };
    }
  }

  return {
    code,
    name: `미등록 계정(${code})`,
    source: 'fallback',
    isRegistered: false,
    uploadedName,
    nameMismatch: !!uploadedName,
  };
}
