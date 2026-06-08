export const PRODUCT_NAME_MAP = [
  {
    match: ['Ni 황산니켈', '황산니켈', 'MP-NSH', '황산니켈(Ni)', 'Ni황산니켈'],
    canonicalProductName: '황산니켈' as const,
    metal: 'Ni' as const,
  },
  {
    match: ['Co 황산코발트', '황산코발트', 'MP-CSH', '황산코발트(Co)', 'Co황산코발트'],
    canonicalProductName: '황산코발트' as const,
    metal: 'Co' as const,
  },
  {
    match: ['Li 탄산리튬', '탄산리튬', 'MP-LCA', '탄산리튬(Li)', 'Li탄산리튬'],
    canonicalProductName: '탄산리튬' as const,
    metal: 'Li' as const,
  },
  {
    match: ['Mn 황산망간', '황산망간', 'MP-MSM', '황산망간(Mn)', 'Mn황산망간'],
    canonicalProductName: '황산망간' as const,
    metal: 'Mn' as const,
  },
  {
    match: ['Cu 구리', '구리', 'MP-CUP', '구리(Cu)', 'Cu구리'],
    canonicalProductName: '구리' as const,
    metal: 'Cu' as const,
  },
] as const;

export type ProductNameType = typeof PRODUCT_NAME_MAP[number]['canonicalProductName'];
export type MetalType = typeof PRODUCT_NAME_MAP[number]['metal'];

export const DEFAULT_LITHIUM_CONVERSION_RATES: Record<string, number> = {
  '2024': 18.79,
  '2025': 18.73,
  '2026': 18.75,
};

const LITHIUM_RATES_KEY = 'hycm_lithium_conversion_rates';

export function getLithiumConversionRates(): Record<string, number> {
  const stored = localStorage.getItem(LITHIUM_RATES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse lithium conversion rates from localStorage', e);
    }
  }
  return { ...DEFAULT_LITHIUM_CONVERSION_RATES };
}

export function saveLithiumConversionRates(rates: Record<string, number>): void {
  localStorage.setItem(LITHIUM_RATES_KEY, JSON.stringify(rates));
}

export function getLithiumConversionRateForYear(year: string): number {
  const rates = getLithiumConversionRates();
  return rates[year] || rates['2026'] || 18.75;
}

export function resolveProductByRawName(rawName: string) {
  const clean = rawName.replace(/\s+/g, '').toLowerCase();
  for (const p of PRODUCT_NAME_MAP) {
    if (
      p.match.some((m) =>
        clean.includes(m.replace(/\s+/g, '').toLowerCase()) ||
        m.replace(/\s+/g, '').toLowerCase().includes(clean)
      )
    ) {
      return p;
    }
  }
  return null;
}
