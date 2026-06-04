import { AccountClass, AccountingType, classifyAccount, getAccountingType, isSalaryAccountRow } from './accountClassification';
import { STORAGE_KEYS } from '../constants';

export interface AccountMeta {
  code: string;
  name: string;
  accountingType: AccountingType;
  accountClass: AccountClass;
  isSalary: boolean;
}

function normalizeAccountCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function buildAccountMetaIndex(params: {
  year: string;
  categories: any[];
  actualRows?: any[];
  budgetRowsByDept?: Map<string, any[]>;
}): Map<string, AccountMeta> {
  const map = new Map<string, AccountMeta>();

  const registerInMap = (code: string, name: string, forceOverwrite = true) => {
    const normalizedCode = normalizeAccountCode(code);
    const trimmedName = String(name ?? '').trim();
    if (!normalizedCode || !trimmedName || trimmedName.includes('미등록 계정')) {
      return;
    }

    if (!forceOverwrite && map.has(normalizedCode)) {
      return;
    }

    const accountingType = getAccountingType(normalizedCode, trimmedName);
    const accountClass = classifyAccount(normalizedCode, trimmedName);
    const isSalary = isSalaryAccountRow({
      accountCode: normalizedCode,
      accountName: trimmedName,
      accountClass,
    });

    map.set(normalizedCode, {
      code: normalizedCode,
      name: trimmedName,
      accountingType,
      accountClass,
      isSalary,
    });
  };

  // 1. Categories (INITIAL_CATEGORIES)
  if (Array.isArray(params.categories)) {
    params.categories.forEach((cat: any) => {
      if (cat && Array.isArray(cat.accounts)) {
        cat.accounts.forEach((acc: any) => {
          registerInMap(acc.code, acc.name, true);
        });
      }
    });
  }

  // 2. GLOBAL_ACCOUNTS from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    const globalCategories = raw ? JSON.parse(raw) : [];
    if (Array.isArray(globalCategories)) {
      globalCategories.forEach((cat: any) => {
        if (cat && Array.isArray(cat.accounts)) {
          cat.accounts.forEach((acc: any) => {
            registerInMap(acc.code, acc.name, true);
          });
        }
      });
    }
  } catch {
    // ignore
  }

  // 3. budgetRowsByDept
  if (params.budgetRowsByDept instanceof Map) {
    params.budgetRowsByDept.forEach((rows) => {
      if (Array.isArray(rows)) {
        rows.forEach((row: any) => {
          registerInMap(row.code, row.name, false);
        });
      }
    });
  }

  // 4. actualRows
  if (Array.isArray(params.actualRows)) {
    params.actualRows.forEach((row: any) => {
      registerInMap(row.accountCode, row.accountName, false);
    });
  }

  return map;
}
