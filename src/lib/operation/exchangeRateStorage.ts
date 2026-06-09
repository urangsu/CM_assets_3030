export interface MonthlyExchangeRate {
  year: string;
  month: number;
  currency: 'USD';
  averageRate: number;
  source: 'api' | 'manual';
  updatedAt: string;
}

const STORAGE_KEY = 'hycm_exchange_rates';

// Standard high-fidelity mock monthly rates for typical years
const DEFAULT_RATES_2026: Record<number, number> = {
  1: 1345.5,
  2: 1352.2,
  3: 1360.8,
  4: 1368.4,
  5: 1372.5,
  6: 1375.0,
  7: 1370.2,
  8: 1365.4,
  9: 1362.1,
  10: 1369.8,
  11: 1376.3,
  12: 1380.5,
};

export const ExchangeRateStorage = {
  getRates(): MonthlyExchangeRate[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed initial rates
      const seeded: MonthlyExchangeRate[] = [];
      const years = ['2024', '2025', '2026', '2027', '2028'];
      years.forEach(yr => {
        for (let m = 1; m <= 12; m++) {
          // Adjust rate slightly based on year and month to make it look realistic
          const baseRate = yr === '2026' ? (DEFAULT_RATES_2026[m] || 1350) : 1300 + (m * 4) + (Number(yr) % 5) * 15;
          seeded.push({
            year: yr,
            month: m,
            currency: 'USD',
            averageRate: baseRate,
            source: 'manual',
            updatedAt: new Date().toISOString(),
          });
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  getRate(year: string, month: number): number {
    const rates = this.getRates();
    const found = rates.find(r => r.year === year && Number(r.month) === Number(month));
    return found ? found.averageRate : 1350; // fallback to default
  },

  saveRate(year: string, month: number, rate: number, source: 'api' | 'manual' = 'manual'): void {
    const rates = this.getRates();
    const filtered = rates.filter(r => !(r.year === year && Number(r.month) === Number(month)));
    const updated: MonthlyExchangeRate = {
      year,
      month,
      currency: 'USD',
      averageRate: rate,
      source,
      updatedAt: new Date().toISOString(),
    };
    const combined = [...filtered, updated];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
    window.dispatchEvent(new Event('hycm-exchange-rates-changed'));
  },

  // Mock auto fetch provider mimicking actual server proxy integration
  async fetchMonthlyAverageRate(year: string, month: number): Promise<number | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    // Provide a slightly randomized realistic rate
    const seedBase = DEFAULT_RATES_2026[month] || 1350;
    const variation = (Math.random() - 0.5) * 10;
    const finalRate = Math.round((seedBase + variation) * 10) / 10;
    
    this.saveRate(year, month, finalRate, 'api');
    return finalRate;
  }
};
