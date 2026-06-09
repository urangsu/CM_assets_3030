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

  async fetchMonthlyAverageRate(year: string, month: number): Promise<{ 
    success: boolean; 
    rate?: number; 
    source?: 'api'; 
    reason?: string; 
    message: string;
    requestedDays?: number;
    successCount?: number;
    emptyCount?: number;
    apiErrorCount?: number;
    networkErrorCount?: number;
    policy?: string;
    majorFailureReason?: string;
    details?: any[];
  }> {
    try {
      const useProxy = localStorage.getItem('hycm_proxy_use') || 'false';
      const proxyHost = localStorage.getItem('hycm_proxy_host') || '';
      const proxyPort = localStorage.getItem('hycm_proxy_port') || '';
      const proxyUser = localStorage.getItem('hycm_proxy_user') || '';
      const proxyPass = localStorage.getItem('hycm_proxy_pass') || '';

      let url = `/api/exim-monthly-average-rate?year=${year}&month=${month}`;
      if (useProxy === 'true') {
        url += `&useProxy=true&proxyHost=${encodeURIComponent(proxyHost)}&proxyPort=${encodeURIComponent(proxyPort)}&proxyUser=${encodeURIComponent(proxyUser)}&proxyPass=${encodeURIComponent(proxyPass)}`;
      } else {
        url += `&useProxy=false`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.averageRate) {
        this.saveRate(year, month, data.averageRate, 'api');
        return {
          success: true,
          rate: data.averageRate,
          source: 'api',
          message: `${year}년 ${month}월 한국수출입은행 월평균 환율 연계에 성공하였습니다!`,
          requestedDays: data.requestedDays,
          successCount: data.successCount,
          emptyCount: data.emptyCount,
          apiErrorCount: data.apiErrorCount,
          networkErrorCount: data.networkErrorCount,
          policy: data.policy,
          majorFailureReason: data.majorFailureReason,
          details: data.details
        };
      } else {
        return {
          success: false,
          reason: data.reason || data.status,
          message: data.message || `${year}년 ${month}월 기준 고시환율을 계산하지 못했습니다.`,
          requestedDays: data.requestedDays || 0,
          successCount: data.successCount || 0,
          emptyCount: data.emptyCount || 0,
          apiErrorCount: data.apiErrorCount || 0,
          networkErrorCount: data.networkErrorCount || 0,
          policy: data.policy || 'error',
          majorFailureReason: data.majorFailureReason || (data.message || '영업일 데이터 미진으로 환율 산출 실패'),
          details: data.details || []
        };
      }
    } catch (e: any) {
      console.error("[Exchange API Client Error]:", e);
      return {
        success: false,
        reason: "NETWORK_ERROR",
        message: '네트워크 연결 오류 또는 정적 배포 상태로 프록시가 작동하지 않습니다. 수동으로 환율을 기입하여 적용하십시오.',
        requestedDays: 0,
        successCount: 0,
        emptyCount: 0,
        apiErrorCount: 1,
        networkErrorCount: 1,
        policy: 'network_fail',
        majorFailureReason: e.message || '네트워크 장애',
        details: []
      };
    }
  }
};
