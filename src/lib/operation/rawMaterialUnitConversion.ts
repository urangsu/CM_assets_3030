import { toTon, toMillionKrwPerTon, formatTonDisplay, formatPriceDisplay } from './blendUnitConversion';

export { toTon, toMillionKrwPerTon, formatTonDisplay, formatPriceDisplay };

export function quantityKgToTon(qtyKg: number): number {
  return toTon(qtyKg, 'KG');
}
