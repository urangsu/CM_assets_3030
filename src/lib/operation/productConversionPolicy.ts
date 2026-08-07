export interface ProductConversionPolicy {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  productName: string;
  metalContentPct: number; // Percentage of metal in finished product (e.g., Li in Carbonate Lithium = 18.75%)
}

export const DEFAULT_PRODUCT_CONVERSION_POLICIES: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', ProductConversionPolicy> = {
  NI: { metal: 'NI', productName: '황산니켈', metalContentPct: 100 },
  CO: { metal: 'CO', productName: '황산코발트', metalContentPct: 100 },
  LC: { metal: 'LC', productName: '탄산리튬', metalContentPct: 18.75 }, // Li content in Carbonate Lithium
  MN: { metal: 'MN', productName: '황산망간', metalContentPct: 100 },
  CU: { metal: 'CU', productName: '구리', metalContentPct: 100 }
};

/**
 * Converts recovered metal tons to finished product tons.
 * e.g., 10 tons of recovered Li metal / 18.75% = 53.33 tons of Carbonate Lithium.
 */
export function convertMetalToProductTon(
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU',
  recoveredMetalTon: number,
  customContentPct?: number
): number {
  if (!recoveredMetalTon || recoveredMetalTon <= 0) return 0;
  const policy = DEFAULT_PRODUCT_CONVERSION_POLICIES[metal];
  const contentPct = customContentPct ?? policy.metalContentPct;
  if (!contentPct || contentPct <= 0) return recoveredMetalTon;
  return recoveredMetalTon / (contentPct / 100);
}
