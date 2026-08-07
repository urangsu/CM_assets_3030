export type LedgerQuantityUnit = 'KG' | 'TON';
export type LedgerPriceUnit = 'KRW_PER_KG' | 'KRW_PER_TON' | 'MKRW_PER_TON';

/**
 * Converts ledger quantity (default KG) to tons.
 * 968,425 kg -> 968.425 ton.
 * If input is 0 or invalid, returns 0 (NO arbitrary default like 50).
 */
export function toTon(quantity: number, unit: LedgerQuantityUnit = 'KG'): number {
  if (!quantity || isNaN(quantity) || quantity <= 0) return 0;
  if (unit === 'KG') {
    return quantity / 1000;
  }
  return quantity;
}

/**
 * Converts ledger unit price to Million KRW / ton.
 * e.g., 10,155 KRW/kg * 1,000 kg/t = 10,155,000 KRW/t = 10.155 Million KRW/t.
 */
export function toMillionKrwPerTon(price: number, unit: LedgerPriceUnit = 'KRW_PER_KG'): number {
  if (!price || isNaN(price) || price <= 0) return 0;
  if (unit === 'KRW_PER_KG') {
    return price / 1000;
  }
  if (unit === 'KRW_PER_TON') {
    return price / 1_000_000;
  }
  return price;
}

/**
 * Formats display value for tons in UI without decimal places.
 * e.g., 968.425 -> "968 t" or "968"
 */
export function formatTonDisplay(valueTon: number, showSuffix = true): string {
  const rounded = Math.round(valueTon || 0);
  const formatted = rounded.toLocaleString();
  return showSuffix ? `${formatted} t` : formatted;
}

/**
 * Formats price in Million KRW / ton with 1-2 decimal places.
 */
export function formatPriceDisplay(valueMillionKrw: number): string {
  if (!valueMillionKrw || isNaN(valueMillionKrw)) return '0.0';
  return valueMillionKrw.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
}
