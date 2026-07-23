export const ACTUAL_IMPORT_MONTHS_STORAGE_KEY = 'hycm_actual_import_selected_months';

export const ALL_ACTUAL_IMPORT_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export interface MonthSelectableRow {
  periodMonth?: number | string;
  period?: unknown;
  month?: unknown;
}

export function normalizeSelectedMonths(months: Iterable<number>): number[] {
  return Array.from(new Set(Array.from(months)
    .map(Number)
    .filter(month => Number.isInteger(month) && month >= 1 && month <= 12)))
    .sort((a, b) => a - b);
}

export function readSelectedActualImportMonths(storage?: Pick<Storage, 'getItem'>): number[] {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) return [...ALL_ACTUAL_IMPORT_MONTHS];

  try {
    const raw = targetStorage.getItem(ACTUAL_IMPORT_MONTHS_STORAGE_KEY);
    if (!raw) return [...ALL_ACTUAL_IMPORT_MONTHS];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_ACTUAL_IMPORT_MONTHS];

    return normalizeSelectedMonths(parsed);
  } catch {
    return [...ALL_ACTUAL_IMPORT_MONTHS];
  }
}

export function writeSelectedActualImportMonths(
  months: Iterable<number>,
  storage?: Pick<Storage, 'setItem'>,
): number[] {
  const normalized = normalizeSelectedMonths(months);
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);

  if (targetStorage) {
    targetStorage.setItem(ACTUAL_IMPORT_MONTHS_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function resolveRowMonth(row: MonthSelectableRow): number | null {
  const directCandidates = [row.periodMonth, row.month];
  for (const candidate of directCandidates) {
    const numeric = Number(candidate);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  }

  const period = String(row.period ?? '').trim();
  if (!period) return null;

  const yearMonthMatch = period.match(/(?:^|[-./])0?([1-9]|1[0-2])(?:월)?$/);
  if (yearMonthMatch) return Number(yearMonthMatch[1]);

  const koreanMonthMatch = period.match(/^0?([1-9]|1[0-2])월/);
  if (koreanMonthMatch) return Number(koreanMonthMatch[1]);

  const numeric = Number(period);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;

  return null;
}

export function filterRowsBySelectedMonths<T extends MonthSelectableRow>(
  rows: readonly T[],
  selectedMonths: Iterable<number>,
): T[] {
  const selected = new Set(normalizeSelectedMonths(selectedMonths));
  if (selected.size === 0) return [];

  return rows.filter(row => {
    const month = resolveRowMonth(row);
    return month !== null && selected.has(month);
  });
}

export function formatSelectedMonths(months: Iterable<number>): string {
  const normalized = normalizeSelectedMonths(months);
  if (normalized.length === 0) return '선택 없음';
  if (normalized.length === 12) return '1~12월 전체';
  return normalized.map(month => `${month}월`).join(', ');
}
