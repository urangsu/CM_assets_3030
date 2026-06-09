export interface MonthlyExchangeRate {
  year: string;
  month: number;
  currency: 'USD';
  averageRate: number;
  source: 'api' | 'manual';
  updatedAt: string;
}

const STORAGE_KEY = 'hycm_exchange_rates';

export const ExchangeRateStorage = {
  getRates(): MonthlyExchangeRate[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  getRate(year: string, month: number): number | null {
    const rates = this.getRates();
    const found = rates.find(r => r.year === year && Number(r.month) === Number(month));
    return found ? found.averageRate : null;
  },

  getRateRecord(year: string, month: number): MonthlyExchangeRate | null {
    const rates = this.getRates();
    return rates.find(r => r.year === year && Number(r.month) === Number(month)) || null;
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

  async fetchMonthlyAverageRate(year: string, month: number): Promise<{ success: boolean; rate?: number; source?: 'api'; reason?: string; message: string }> {
    try {
      const response = await fetch(`/api/exim-monthly-average-rate?year=${year}&month=${month}`);
      const data = await response.json();
      
      if (data.success && data.averageRate) {
        this.saveRate(year, month, data.averageRate, 'api');
        return {
          success: true,
          rate: data.averageRate,
          source: 'api',
          message: `${year}년 ${month}월 한국수출입은행 월평균 환율 연계에 성공하였습니다! (영업일 수: ${data.businessDayCount}일, 적용 환율: ₩${data.averageRate.toLocaleString()})`
        };
      } else {
        return {
          success: false,
          reason: data.reason,
          message: data.message || `${year}년 ${month}월 기준 고시환율을 가져오지 못했습니다.`
        };
      }
    } catch (e: any) {
      console.error("[Exchange API Client Error]:", e);
      return {
        success: false,
        reason: "NETWORK_ERROR",
        message: '네트워크 연결 오류 또는 정적 배포 상태로 프록시가 작동하지 않습니다. 수동으로 환율을 기입하여 적용하십시오.'
      };
    }
  }
};
