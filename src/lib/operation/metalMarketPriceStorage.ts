export interface MetalMarketPriceSet {
  year: string;
  month: number;
  values: {
    NI?: number;
    CO?: number;
    LC?: number;
    MN?: number;
    CU?: number;
  };
  recoveryRates?: {
    NI?: number;
    CO?: number;
    LC?: number;
    MN?: number;
    CU?: number;
  };
  source?: string;
  note?: string;
  updatedAt: string;
}

export const DEFAULT_RECOVERY_RATES = {
  NI: 98.0,
  CO: 97.0,
  LC: 92.0,
  MN: 69.0,
  CU: 89.0
};

const METAL_PRICES_PREFIX = 'hycm_metal_market_prices_';

export const MetalMarketPriceStorage = {
  getPricesKey(year: string): string {
    return `${METAL_PRICES_PREFIX}${year}`;
  },

  getMarketPrices(year: string): MetalMarketPriceSet[] {
    const key = this.getPricesKey(year);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  getMarketPriceForMonth(year: string, month: number): MetalMarketPriceSet | null {
    const list = this.getMarketPrices(year);
    const found = list.find(p => Number(p.month) === Number(month));
    return found || null;
  },

  saveMarketPriceForMonth(priceSet: MetalMarketPriceSet): void {
    const list = this.getMarketPrices(priceSet.year);
    const idx = list.findIndex(p => Number(p.month) === Number(priceSet.month));
    if (idx >= 0) {
      list[idx] = priceSet;
    } else {
      list.push(priceSet);
    }
    localStorage.setItem(this.getPricesKey(priceSet.year), JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('metal-market-prices-changed'));
    }
  }
};
