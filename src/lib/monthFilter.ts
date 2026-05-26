export type MonthMode = 'MONTH' | 'YTD';

export function parseMonthIndex(period: string | number | undefined | null): number | null {
  if (period === null || period === undefined) return null;

  const text = String(period).trim();

  const korean = text.match(/(\d{1,2})월/);
  if (korean) {
    const month = Number(korean[1]);
    return month >= 1 && month <= 12 ? month - 1 : null;
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric - 1;
  }

  return null;
}

export function shouldIncludeMonth(
  monthIndex: number | null,
  mode: MonthMode,
  selectedMonth: number
): boolean {
  if (monthIndex === null) return false;

  const selectedIndex = selectedMonth - 1;

  if (mode === 'MONTH') {
    return monthIndex === selectedIndex;
  }

  return monthIndex >= 0 && monthIndex <= selectedIndex;
}

export function getMonthModeLabel(mode: MonthMode, selectedMonth: number): string {
  if (mode === 'MONTH') return `${selectedMonth}월 단월 기준`;
  return `1월~${selectedMonth}월 누계 기준`;
}
