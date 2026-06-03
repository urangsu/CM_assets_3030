export function calcVarianceRate(baseAmount: number, targetAmount: number): number | null {
  if (!Number.isFinite(baseAmount) || baseAmount === 0) return null;
  return (targetAmount - baseAmount) / baseAmount;
}

export function formatVarianceRate(rate: number | null | undefined, digits = 2): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '-';
  return `${rate > 0 ? '+' : ''}${(rate * 100).toFixed(digits)}%`;
}

export function toExcelPercentValue(rate: number | null | undefined): number | string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '';
  return rate;
}
