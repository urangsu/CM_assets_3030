import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  TrendingUp, 
  Info, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  DollarSign,
  Edit2,
  ChevronRight,
  RefreshCw,
  X,
  Database,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage, getSafeExchangeRate, formatExchangeRateLabel } from '../lib/operation/exchangeRateStorage';
import { OperationWorldMap } from '../components/OperationWorldMap';

const G_PER_TON = 1_000_000;
const KRW_PER_MILLION = 1_000_000;

// Conversion helpers
const gram_to_ton = (value: number): number => (value || 0) / G_PER_TON;
const krw_to_million_krw = (value: number): number => (value || 0) / KRW_PER_MILLION;
const krw_to_usd = (value: number, rate: number): number => rate > 0 ? (value || 0) / rate : 0;

// Formatting helpers
const fmt_ton = (value: number): string => {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Ton`;
};

const fmt_million_krw = (value: number): string => {
  if (Math.abs(value) < 0.0001) {
    return "-";
  }
  return `${Math.round(value).toLocaleString()}백만원`;
};

const fmt_usd = (value: number): string => {
  return `$${Math.round(value).toLocaleString()}`;
};

interface OperationMapPoint {
  id: string;
  countryCode: string;
  countryName: string;
  locationName: string;
  type: 'sales' | 'purchase' | 'both' | 'hq';
  salesQuantity: number;
  salesRevenue: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  products: string[];
  coords: { x: number; y: number }; // Percentage on SVG
}

interface OperationCountryRecord {
  year: string;
  month: number;
  countryCode: string;
  countryName: string;
  type: 'sales' | 'purchase';
  productName?: string;
  materialName?: string;
  quantityTon: number;
  amountKRW: number;
}

const COUNTRY_COORDS: Record<string, { x: number, y: number }> = {
  HQ: { x: 80, y: 39 },
  KR: { x: 80, y: 39 },
  ID: { x: 78, y: 55 },
  US: { x: 23, y: 36 },
  CL: { x: 30, y: 78 },
  CD: { x: 53, y: 58 }
};

export default function OperationDashboard() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [showExchangeRateDetail, setShowExchangeRateDetail] = useState<boolean>(false);
  const [isSyncingExchange, setIsSyncingExchange] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('');
  const [isEditingExchange, setIsEditingExchange] = useState<boolean>(false);
  const [eximKeyMissing, setEximKeyMissing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'warning' | 'error' | '';
    text: string;
    stats?: {
      requestedDays: number;
      successCount: number;
      emptyCount: number;
      apiErrorCount: number;
      networkErrorCount: number;
      policy: string;
      majorFailureReason: string;
      averageRate: number;
      exampleRequestDate?: string;
      expectedFormat?: string;
    };
  } | null>(null);

  // Corporate Proxy settings P1
  const [showProxySettings, setShowProxySettings] = useState<boolean>(false);
  const [proxyUse, setProxyUse] = useState<boolean>(() => localStorage.getItem('hycm_proxy_use') === 'true');
  const [proxyHost, setProxyHost] = useState<string>(() => localStorage.getItem('hycm_proxy_host') || '');
  const [proxyPort, setProxyPort] = useState<string>(() => localStorage.getItem('hycm_proxy_port') || '');
  const [proxyUser, setProxyUser] = useState<string>(() => localStorage.getItem('hycm_proxy_user') || '');
  const [proxyPass, setProxyPass] = useState<string>(() => localStorage.getItem('hycm_proxy_pass') || '');

  const handleSaveProxySettings = () => {
    localStorage.setItem('hycm_proxy_use', proxyUse ? 'true' : 'false');
    localStorage.setItem('hycm_proxy_host', proxyHost);
    localStorage.setItem('hycm_proxy_port', proxyPort);
    localStorage.setItem('hycm_proxy_user', proxyUser);
    localStorage.setItem('hycm_proxy_pass', proxyPass);
    setShowProxySettings(false);
  };

  const [realProducts, setRealProducts] = useState<ProductLedgerRecord[]>([]);
  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);
  const [countryRecords, setCountryRecords] = useState<OperationCountryRecord[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  const getSeedProductsForPreview = (year: string): ProductLedgerRecord[] => {
    const products = ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'] as const;
    const result: any[] = [];
    products.forEach(p => {
      for (let m = 1; m <= 12; m++) {
        result.push({
          id: `preview_prod_${year}_${m}_${p}_qty`,
          year,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: p,
          productName: p,
          metal: p === '황산니켈' ? 'Ni' : p === '황산코발트' ? 'Co' : p === '탄산리튬' ? 'Li' : p === '황산망간' ? 'Mn' : 'Cu',
          unit: '수량',
          beginningInventory: 100,
          normalReceipt: 120,
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: 120,
          salesQuantity: 110,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: 110,
          endingInventory: 110,
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: 110 * 20000000,
          costOfSales: 110 * 16000000,
          grossProfit: 110 * 4000000,
          uploadedAt: new Date().toISOString(),
        });
        result.push({
          id: `preview_prod_${year}_${m}_${p}_amt`,
          year,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: p,
          productName: p,
          metal: p === '황산니켈' ? 'Ni' : p === '황산코발트' ? 'Co' : p === '탄산리튬' ? 'Li' : p === '황산망간' ? 'Mn' : 'Cu',
          unit: '금액',
          beginningInventory: 100 * 20000000,
          normalReceipt: 120 * 20000000,
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: 120 * 20000000,
          salesQuantity: 110 * 20000000,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: 110 * 20000000,
          endingInventory: 110 * 20000000,
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: 110 * 20000000,
          costOfSales: 110 * 16000000,
          grossProfit: 110 * 4000000,
          uploadedAt: new Date().toISOString(),
        });
      }
    });
    return result as ProductLedgerRecord[];
  };

  const getSeedMaterialsForPreview = (year: string): RawMaterialLedgerRecord[] => {
    const groups = ['BP', 'BM', 'WET', 'LCO'] as const;
    const result: any[] = [];
    groups.forEach(g => {
      for (let m = 1; m <= 12; m++) {
        result.push({
          id: `preview_mat_${year}_${m}_${g}`,
          year,
          month: m,
          sourceType: '원자재수불부',
          materialGroup: g,
          rawItemCode: `M-${g}-01`,
          rawItemName: `${g} 수입원료`,
          quantityRowLabel: '수량',
          amountRowLabel: '금액',
          unitPriceRowLabel: '단가',
          beginningQty: 150,
          beginningAmount: 150000000,
          beginningUnitPrice: 1000,
          purchaseQty: 200,
          purchaseAmount: 200000000,
          purchaseUnitPrice: 1000,
          transferInQty: 0,
          transferInAmount: 0,
          transferInUnitPrice: 0,
          receiptTotalQty: 200,
          receiptTotalAmount: 200000000,
          receiptTotalUnitPrice: 1000,
          processIssueQty: 180,
          processIssueAmount: 180000000,
          processIssueUnitPrice: 1000,
          salesIssueQty: 0,
          salesIssueAmount: 0,
          salesIssueUnitPrice: 0,
          sampleIssueQty: 0,
          sampleIssueAmount: 0,
          sampleIssueUnitPrice: 0,
          transferIssueQty: 0,
          transferIssueAmount: 0,
          transferIssueUnitPrice: 0,
          disposalIssueQty: 0,
          disposalIssueAmount: 0,
          disposalIssueUnitPrice: 0,
          devExpenseIssueQty: 0,
          devExpenseIssueAmount: 0,
          devExpenseIssueUnitPrice: 0,
          devAssetIssueQty: 0,
          devAssetIssueAmount: 0,
          devAssetIssueUnitPrice: 0,
          pilotIssueQty: 0,
          pilotIssueAmount: 0,
          pilotIssueUnitPrice: 0,
          otherIssueQty: 0,
          otherIssueAmount: 0,
          otherIssueUnitPrice: 0,
          issueTotalQty: 180,
          issueTotalAmount: 180000000,
          issueTotalUnitPrice: 1000,
          endingQty: 170,
          endingAmount: 170000000,
          endingUnitPrice: 1000,
          uploadedAt: new Date().toISOString(),
        });
      }
    });
    return result as RawMaterialLedgerRecord[];
  };

  const getSeedCountriesForPreview = (year: string): OperationCountryRecord[] => {
    const result: OperationCountryRecord[] = [];
    for (let m = 1; m <= 12; m++) {
      result.push(
        { year, month: m, countryCode: 'US', countryName: '미국', type: 'sales', productName: '황산니켈', quantityTon: 110, amountKRW: 2200000000 },
        { year, month: m, countryCode: 'ID', countryName: '인도네시아', type: 'purchase', materialName: 'BM (Black Mass)', quantityTon: 240, amountKRW: 1680000000 },
        { year, month: m, countryCode: 'CL', countryName: '칠레', type: 'purchase', materialName: 'LCO (리튬코발트산화물)', quantityTon: 95, amountKRW: 3610000000 },
        { year, month: m, countryCode: 'CD', countryName: '콩고민주공화국', type: 'purchase', materialName: 'BP (Black Powder 원료)', quantityTon: 180, amountKRW: 1260000000 }
      );
    }
    return result;
  };

  const [selectedLocation, setSelectedLocation] = useState<OperationMapPoint | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getContextualFailureGuidance = (reason: string) => {
    const reasonUpper = String(reason || "").toUpperCase();
    const isSslErr = reasonUpper.includes("SSL") || reasonUpper.includes("CERT") || reasonUpper.includes("DEPTH") || reasonUpper.includes("SELF") || reasonUpper.includes("UNABLE_TO_VERIFY");
    const isTimeoutOrTcp = reasonUpper.includes("CONNECT") || reasonUpper.includes("TCP") || reasonUpper.includes("TIMEOUT") || reasonUpper.includes("ETIMEDOUT") || reasonUpper.includes("ENOTFOUND");
    const isReadTimeout = reasonUpper.includes("READ") || reasonUpper.includes("SOCKET");

    if (isSslErr) {
      return (
        <div className="space-y-1 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-zinc-800 mt-1.5 last-of-type:mb-0">
          <span className="font-bold text-amber-800 flex items-center gap-1">🔒 SSL 인증서 국책 신뢰 오류 (SSL_ERROR)</span>
          <p className="text-[10.5px] leading-snug">
            사내 네트워크의 SSL/TLS 트래픽 감시망 및 사내 CA 인증서 신뢰 이슈로 인해 국책 외환고시 서버 연결에 실패했습니다. <strong className="text-teal-700">Windows 인증서 저장소(truststore)를 활용한 SSL 우회 또는 사내 Root CA 인증서 사전 등록</strong>을 권장하며, 본 환경에서는 프록시 구성이 아닌 인증서 신뢰 구성이 해결책입니다.
          </p>
        </div>
      );
    } else if (isTimeoutOrTcp) {
      return (
        <div className="space-y-1 bg-rose-50 p-2.5 rounded-lg border border-rose-150 text-zinc-800 mt-1.5 last-of-type:mb-0">
          <span className="font-bold text-rose-700 flex items-center gap-1">🌐 방화벽 및 TCP 연결 실패 (CONNECT_TIMEOUT)</span>
          <p className="text-[10.5px] leading-snug">
            사내 인프라 방화벽 혹은 국책 망 접속 포트(TCP) 차단으로 인해 연동이 실패했습니다. 사외망 우회 게이트웨이가 지원되는 경우, 하단의 <strong className="text-zinc-900 font-bold">고급 프록시(Proxy) 게이트웨이 연동 설정</strong>을 활성화하고 주소와 포트를 직접 입력하십시오.
          </p>
        </div>
      );
    } else if (isReadTimeout) {
      return (
        <div className="space-y-1 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-zinc-800 mt-1.5 last-of-type:mb-0">
          <span className="font-bold text-amber-700 flex items-center gap-1">⏳ API 서버 읽기 시간 초과 (READ_TIMEOUT)</span>
          <p className="text-[10.5px] leading-snug">
            인증서 저장소 적용 이후에도 네트워크 지연 혹은 국책은행 서버의 응답 지연으로 인해 일시적으로 읽기 장애가 발생했습니다. 설정에서 프록시 우회 통신을 적용하거나 잠시 후 자동 조회를 다시 시도하십시오.
          </p>
        </div>
      );
    }

    // Default fallback guidance matching user requirements
    return (
      <div className="space-y-1 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-zinc-700 mt-1.5">
        <span className="font-semibold text-zinc-805">💡 권장 사항</span>
        <p className="text-[10px] leading-snug">
          회사망 내에서는 보안 인증서 이슈 또는 망 분리 방화벽으로 인해 국책 API 고시 호출이 제한될 수 있습니다. 
          SSL 오류일 경우 Windows 인증서 저장소 신뢰성 보장을 점검하고, 방화벽 접속 차단 문제인 경우 아래 고급 설정에서 프록시 게이트웨이를 연동하십시오.
        </p>
      </div>
    );
  };

  // 1. Data Loader
  const loadData = () => {
    if (isPreviewMode) {
      setRealProducts(getSeedProductsForPreview(activeYear));
      setRealMaterials(getSeedMaterialsForPreview(activeYear));
      setCountryRecords(getSeedCountriesForPreview(activeYear));
      setIsSampleData(true);
      return;
    }

    const listProducts = OperationStorage.getProductRecords(activeYear) || [];
    const listMaterials = OperationStorage.getRawMaterialRecords(activeYear) || [];

    setRealProducts(listProducts);
    setRealMaterials(listMaterials);
    setIsSampleData(false);

    // Load country records
    const rawCountry = localStorage.getItem(`hycm_operation_country_records_${activeYear}`);
    if (rawCountry) {
      try {
        setCountryRecords(JSON.parse(rawCountry));
      } catch (e) {
        setCountryRecords([]);
      }
    } else {
      setCountryRecords([]);
    }
  };

  useEffect(() => {
    loadData();

    // Check key status
    fetch('/api/exim-key-status')
      .then(r => r.json())
      .then(data => {
        setEximKeyMissing(!data.hasKey);
      })
      .catch(() => {
        // Fallback or ignore in pure static cases
      });

    const handler = () => {
      loadData();
    };
    window.addEventListener('operation-ledger-changed', handler);
    return () => {
      window.removeEventListener('operation-ledger-changed', handler);
    };
  }, [activeYear, activeMonth, isPreviewMode]);

  // Set initial rate input value
  useEffect(() => {
    const mNum = activeMonth === 'all' ? (new Date().getMonth() + 1) : Number(activeMonth);
    const currentRate = ExchangeRateStorage.getRate(activeYear, mNum);
    setCustomRateInput(currentRate !== null ? String(currentRate) : '');
  }, [activeYear, activeMonth]);

  // --- Currency Conversion Utility & Fallback Resolution ---
  const getAppliedExchangeRateAndSource = (): {
    rate: number | null;
    isFallback: boolean;
    sourceText: string;
    successDays?: number;
    fetchedAt?: string;
  } => {
    if (activeMonth !== 'all') {
      const checkMonth = Number(activeMonth);
      const rateRec = ExchangeRateStorage.getRateRecord(activeYear, checkMonth);
      if (rateRec && rateRec.averageRate > 0) {
        const srcText = rateRec.source === 'api' ? '한국수출입은행 월평균 환율' : '사용자 수동 입력 환율';
        return {
          rate: rateRec.averageRate,
          isFallback: false,
          sourceText: srcText,
          successDays: rateRec.success_days,
          fetchedAt: rateRec.fetched_at || rateRec.updatedAt
        };
      }
      return {
        rate: null,
        isFallback: false,
        sourceText: '환율 미등록'
      };
    }

    // activeMonth === 'all': check all registered monthly rates for this year
    const rates = ExchangeRateStorage.getRates().filter(r => r.year === activeYear);
    if (rates.length === 0) {
      return {
        rate: null,
        isFallback: false,
        sourceText: '환율 미등록'
      };
    }

    const avgRate = rates.reduce((sum, r) => sum + r.averageRate, 0) / rates.length;
    return {
      rate: Math.round(avgRate * 10) / 10,
      isFallback: false,
      sourceText: `전체월 월별 환율 적용 (${rates.length}개 월 등록됨)`
    };
  };

  const getCurrentExchangeRate = (monthNumber?: number): number | null => {
    if (monthNumber && monthNumber >= 1 && monthNumber <= 12) {
      const rate = ExchangeRateStorage.getRate(activeYear, monthNumber);
      if (rate && rate > 0) return rate;
      return null;
    }

    if (activeMonth !== 'all') {
      const rate = ExchangeRateStorage.getRate(activeYear, Number(activeMonth));
      if (rate && rate > 0) return rate;
      return null;
    }

    // activeMonth === 'all'
    const applied = getAppliedExchangeRateAndSource();
    return applied.rate;
  };

  const convertVal = (krwVal: number, monthNumber?: number): number => {
    if (currencyMode === 'USD') {
      const rate = getCurrentExchangeRate(monthNumber);
      return rate && rate > 0 ? krwVal / rate : 0;
    }
    return krwVal;
  };

  const formatCurrencyAmount = (valueKRW: number, isKPI: boolean = false) => {
    if (currencyMode === 'USD') {
      const rate = getCurrentExchangeRate();
      return fmt_usd(krw_to_usd(valueKRW, rate));
    } else {
      return fmt_million_krw(krw_to_million_krw(valueKRW));
    }
  };

  const getPricePerTonDisplay = (amtKRW: number, qtyG: number): number => {
    if (qtyG <= 0) return 0;
    const krwPerGram = amtKRW / qtyG;
    if (currencyMode === 'USD') {
      const rate = getCurrentExchangeRate();
      return krwPerGram * (1_000_000 / rate);
    } else {
      return krwPerGram;
    }
  };

  const formatPrice = (price: number) => {
    if (currencyMode === 'USD') {
      return fmt_usd(price);
    } else {
      return `₩${Math.round(price).toLocaleString()}`;
    }
  };

  const handleExchangeAutoSync = async () => {
    setIsSyncingExchange(true);
    setSyncFeedback(null);
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    try {
      // Auto-save proxy settings to localstorage on sync initiation to avoid unsaved state mismatches
      localStorage.setItem('hycm_proxy_use', proxyUse ? 'true' : 'false');
      localStorage.setItem('hycm_proxy_host', proxyHost);
      localStorage.setItem('hycm_proxy_port', proxyPort);
      localStorage.setItem('hycm_proxy_user', proxyUser);
      localStorage.setItem('hycm_proxy_pass', proxyPass);

      const response = await ExchangeRateStorage.fetchMonthlyAverageRate(activeYear, mNum);
      const lastSaved = ExchangeRateStorage.getRateRecord(activeYear, mNum);
      
      const statsObj = {
        requestedDays: response.requestedDays || 0,
        successCount: response.successCount || 0,
        emptyCount: response.emptyCount || 0,
        apiErrorCount: response.apiErrorCount || 0,
        networkErrorCount: response.networkErrorCount || 0,
        policy: response.policy || 'unknown',
        majorFailureReason: response.majorFailureReason || response.message,
        averageRate: response.rate || 0,
        exampleRequestDate: `${activeYear}${String(mNum).padStart(2, '0')}01`,
        expectedFormat: 'YYYYMMDD'
      };

      if (response.success && response.rate) {
        setCustomRateInput(String(response.rate));
        setSyncFeedback({
          type: 'success',
          text: response.message,
          stats: statsObj
        });
      } else {
        let errText = response.message;
        if (response.reason === 'API_KEY_MISSING') {
          errText = `오류: EXIM_API_KEY가 서버 환경변수에 설정되지 않았습니다.`;
        }

        const lastSavedMsg = lastSaved 
          ? ` (기존에 가동중인 '마지막 저장 환율': ₩${lastSaved.averageRate}이 유지됩니다.)` 
          : ' (기존 저장 환율 정보도 존재하지 않습니다.)';

        setSyncFeedback({
          type: (response.reason === 'API_KEY_MISSING' || response.reason === 'invalid_key') ? 'error' : 'warning',
          text: `${errText}${lastSavedMsg}`,
          stats: statsObj
        });

        if (lastSaved) {
          setCustomRateInput(String(lastSaved.averageRate));
        } else {
          setCustomRateInput('');
        }
      }
    } catch (err: any) {
      const lastSaved = ExchangeRateStorage.getRateRecord(activeYear, mNum);
      const lastSavedMsg = lastSaved 
        ? ` (기존에 가동중인 '마지막 저장 환율': ₩${lastSaved.averageRate}이 유지됩니다.)` 
        : '';
      setSyncFeedback({
        type: 'error',
        text: `한국수출입은행 API 동기화 통신 중 오류가 발생했습니다. 수동 입력을 진행하십시오.${lastSavedMsg}`,
        stats: {
          requestedDays: 31,
          successCount: 0,
          emptyCount: 0,
          apiErrorCount: 1,
          networkErrorCount: 1,
          policy: 'error',
          majorFailureReason: err.message || '네트워크 오류 발생',
          averageRate: 0,
          exampleRequestDate: `${activeYear}${String(mNum).padStart(2, '0')}01`,
          expectedFormat: 'YYYYMMDD'
        }
      });
    } finally {
      setIsSyncingExchange(false);
    }
  };

  const handleSaveRateInput = () => {
    if (eximKeyMissing) {
      alert('한국수출입은행 API 인증키(EXIM_API_KEY) 설정이 누락되어 가공/임의 환율 수동 저장이 차단됩니다.');
      return;
    }
    const num = Number(customRateInput);
    if (Number.isNaN(num) || num <= 0) {
      alert('올바른 환율 금액을 입력하십시오. 예: 1372.5');
      return;
    }
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    ExchangeRateStorage.saveRate(activeYear, mNum, num, 'manual');
    setIsEditingExchange(false);
  };

  // Filters
  const targetQtyRows = realProducts.filter(r => r.unit === '수량' && (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));
  const targetAmtRows = realProducts.filter(r => r.unit === '금액' && (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));
  const targetRawRows = realMaterials.filter(r => (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));

  // KPI calculations
  const totalRevenueKRW = targetQtyRows.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalCostOfSalesKRW = targetQtyRows.reduce((sum, r) => sum + (r.costOfSales || 0), 0);
  const totalGrossProfitKRW = totalRevenueKRW - totalCostOfSalesKRW;

  const CANONICAL_SALES_VOLUME_PRODUCTS = new Set(['황산니켈', '황산코발트', '탄산리튬']);
  const totalSalesTons = targetQtyRows
    .filter(r => CANONICAL_SALES_VOLUME_PRODUCTS.has(r.productName))
    .reduce((sum, r) => sum + Number(r.salesQuantity || 0), 0);

  const totalProductionTons = targetQtyRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
  const totalProductionAmtKRW = targetAmtRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);

  const productEndingQty = targetQtyRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
  const totalValuationLossKRW = targetAmtRows.reduce((sum, r) => sum + (r.inventoryValuationLoss || 0), 0);

  const rawSourcingTons = targetRawRows.reduce((sum, r) => sum + (r.receiptTotal || 0), 0);
  const rawIssueTons = targetRawRows.reduce((sum, r) => sum + (r.issueTotal || 0), 0);
  const rawMaterialEndingQty = targetRawRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);

  // Dynamic Map Points Construction
  const activeMonthNum = activeMonth === 'all' ? 5 : Number(activeMonth);
  const currentMonthRecords = countryRecords.filter(r => Number(r.month) === activeMonthNum);

  const MAP_POINTS: OperationMapPoint[] = [];

  // Construct other coordinates dynamically based on loaded/demo country records
  const otherCountryCodes = Array.from(new Set(currentMonthRecords.map(r => r.countryCode))).filter(code => code !== 'KR') as string[];

  if (otherCountryCodes.length > 0) {
    // Only push HQ Korea if other country records exist!
    MAP_POINTS.push({
      id: 'KR',
      countryCode: 'KR',
      countryName: '대한민국',
      locationName: '대한민국 · 광양/포항 HQ',
      type: 'hq',
      salesQuantity: gram_to_ton(totalSalesTons),
      salesRevenue: totalRevenueKRW,
      purchaseQuantity: 0,
      purchaseAmount: 0,
      products: ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'],
      coords: COUNTRY_COORDS.KR
    });

    otherCountryCodes.forEach((code: string) => {
      const recordsForCountry = currentMonthRecords.filter(r => r.countryCode === code);
      const purchaseQty = recordsForCountry.filter(r => r.type === 'purchase').reduce((s, r) => s + r.quantityTon, 0);
      const purchaseAmt = recordsForCountry.filter(r => r.type === 'purchase').reduce((s, r) => s + r.amountKRW, 0);
      const salesQty = recordsForCountry.filter(r => r.type === 'sales').reduce((s, r) => s + r.quantityTon, 0);
      const salesAmt = recordsForCountry.filter(r => r.type === 'sales').reduce((s, r) => s + r.amountKRW, 0);
      
      const items = Array.from(new Set(recordsForCountry.map(r => r.materialName || r.productName || ''))).filter(Boolean) as string[];

      MAP_POINTS.push({
        id: code,
        countryCode: code,
        countryName: (recordsForCountry[0]?.countryName || code) as string,
        locationName: `${recordsForCountry[0]?.countryName || code} 거점`,
        type: purchaseQty > 0 ? 'purchase' : 'sales',
        salesQuantity: salesQty,
        salesRevenue: salesAmt,
        purchaseQuantity: purchaseQty,
        purchaseAmount: purchaseAmt,
        products: items,
        coords: COUNTRY_COORDS[code] || { x: 50, y: 50 }
      });
    });
  }

  // Raw Materials Normalized Parser
  const getNormalizedMaterialName = (rawName: string): string => {
    const nameLower = rawName.toLowerCase();
    if (nameLower.includes('bp') || nameLower.includes('powder') || nameLower.includes('파우더')) {
      return 'BP (Black Powder 원료)';
    }
    if (nameLower.includes('wet') || nameLower.includes('wet bm') || nameLower.includes('물') || nameLower.includes('습식')) {
      return 'WET (Wet BM)';
    }
    if (nameLower.includes('lco') || nameLower.includes('산화물') || nameLower.includes('cobalt oxide')) {
      return 'LCO (리튬코발트산화물)';
    }
    if (nameLower.includes('bm') || nameLower.includes('mass') || nameLower.includes('블랙매스')) {
      return 'BM (Black Mass)';
    }
    return rawName;
  };

  const RAW_MATERIAL_KIND_MAP = [
    { key: 'BP', name: 'BP (Black Powder 원료)' },
    { key: 'BM', name: 'BM (Black Mass)' },
    { key: 'WET', name: 'WET (Wet BM)' },
    { key: 'LCO', name: 'LCO (리튬코발트산화물)' }
  ];

  const summaryRawTableData = RAW_MATERIAL_KIND_MAP.map(def => {
    const matchedRows = targetRawRows.filter(r => 
      r.materialGroup === def.key || 
      getNormalizedMaterialName(r.rawMaterialName || r.canonicalMaterialName || '') === def.name
    );

    const begQty = matchedRows.reduce((sum, r) => sum + (r.beginningQty || 0), 0);
    const begAmt = matchedRows.reduce((sum, r) => sum + (r.beginningAmount || 0), 0);

    const purQty = matchedRows.reduce((sum, r) => sum + (r.purchaseQty || 0), 0);
    const purAmt = matchedRows.reduce((sum, r) => sum + (r.purchaseAmount || 0), 0);

    const prcQty = matchedRows.reduce((sum, r) => sum + (r.processIssueQty || 0), 0);
    const prcAmt = matchedRows.reduce((sum, r) => sum + (r.processIssueAmount || 0), 0);

    const endQty = matchedRows.reduce((sum, r) => sum + (r.endingQty || 0), 0);
    const endAmt = matchedRows.reduce((sum, r) => sum + (r.endingAmount || 0), 0);

    const endPrice = getPricePerTonDisplay(endAmt, endQty);

    return {
      key: def.key,
      name: def.name,
      begQty,
      purQty,
      prcQty,
      endQty,
      endPrice,
    };
  });

  const PRODUCT_KIND_MAP = [
    { key: '니켈', name: '니켈', canonicalName: '황산니켈' },
    { key: '코발트', name: '코발트', canonicalName: '황산코발트' },
    { key: '탄산리튬', name: '탄산리튬', canonicalName: '탄산리튬' },
    { key: '망간', name: '망간', canonicalName: '황산망간' },
    { key: '구리', name: '구리', canonicalName: '구리' }
  ];

  const summaryProdTableData = PRODUCT_KIND_MAP.map(def => {
    const qRows = targetQtyRows.filter(r => r.productName === def.canonicalName);
    const aRows = targetAmtRows.filter(r => r.productName === def.canonicalName);

    const begQty = qRows.reduce((sum, r) => sum + (r.beginningInventory || 0), 0);
    const begAmt = aRows.reduce((sum, r) => sum + (r.beginningInventory || 0), 0);
    const begPrice = getPricePerTonDisplay(begAmt, begQty);

    const prodQty = qRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodAmt = aRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodPrice = getPricePerTonDisplay(prodAmt, prodQty);

    const salesQty = qRows.reduce((sum, r) => sum + (r.salesQuantity || 0), 0);
    const salesAmt = qRows.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const salesPrice = getPricePerTonDisplay(salesAmt, salesQty);

    const endQty = qRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endAmt = aRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endPrice = getPricePerTonDisplay(endAmt, endQty);

    return {
      key: def.key,
      name: def.canonicalName,
      begQty,
      begPrice,
      prodQty,
      prodPrice,
      salesQty,
      salesPrice,
      endQty,
      endPrice,
    };
  });

  const hasNoData = realProducts.length === 0 && realMaterials.length === 0;

  return (
    <div className="space-y-6">
      {/* Sample Alert */}
      {isPreviewMode && (
        <div id="operation-preview-notice" className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade shadow-xs">
          <div className="flex items-start gap-2.5 text-xs">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ 샘플 데이터 화면 보기 (임시)</p>
              <p className="text-zinc-650 mt-1">
                현재 실전 화면 구성을 미리 보여주는 샘플 모드입니다. 이 데이터는 브라우저에 저장되지 않으며, 실제 엑셀 파일 업로드 시 정식 실적으로 영구 대체됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPreviewMode(false)}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm cursor-pointer transition-colors"
          >
            샘플 종료
          </button>
        </div>
      )}

      {/* Page Title */}
      <div id="dashboard-header-block" className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight font-sans">
            운영 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품 생산 및 판매 실적, 원자재 수급 현황을 통합하여 분석합니다.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                onClick={() => setCurrencyMode('KRW')}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                  currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
                }`}
              >
                원화 보기
              </button>
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                  currencyMode === 'USD' ? 'bg-white text-[#00786F] shadow-xs' : 'text-zinc-500'
                }`}
              >
                달러 보기
              </button>
            </div>

            {currencyMode === 'USD' && (() => {
              const appliedInfo = getAppliedExchangeRateAndSource();
              const checkM = activeMonth === 'all' ? '05' : String(activeMonth).padStart(2, '0');
              return (
                <div className="relative flex items-center gap-1.5 px-3 py-1.5 bg-teal-50/85 border border-teal-150 rounded-xl text-xs text-teal-950 font-medium">
                  <span>USD 환산 기준: <strong className="font-mono text-[#00786F]">{appliedInfo.rate ? `${appliedInfo.rate.toLocaleString()}원/USD` : '환율 미등록'}</strong></span>
                  <button
                    type="button"
                    onClick={() => setShowExchangeRateDetail(!showExchangeRateDetail)}
                    className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-teal-100/80 text-[11px] text-[#00786F] font-bold border-none bg-transparent cursor-pointer"
                    title="자세한 환율 기준 정보 보기"
                  >
                    ⓘ
                  </button>

                  {showExchangeRateDetail && (
                    <div className="absolute right-0 top-full mt-2 z-[150] w-64 bg-white border border-zinc-200 shadow-xl rounded-xl p-4 text-xs font-sans text-zinc-700 animate-slide-down space-y-2">
                      <div className="font-bold text-zinc-900 border-b border-zinc-100 pb-1.5 flex justify-between items-center">
                        <span>환율 기준 정보 상세보기</span>
                        <button 
                          onClick={() => setShowExchangeRateDetail(false)}
                          className="text-zinc-400 hover:text-zinc-600 text-[10px] font-bold border-none bg-transparent"
                        >
                          닫기 X
                        </button>
                      </div>
                      <div className="space-y-1.5 text-zinc-600">
                        <div>
                          • <span className="font-semibold text-zinc-800">기준:</span> {appliedInfo.sourceText}
                        </div>
                        <div>
                          • <span className="font-semibold text-zinc-800">대상월:</span> {activeYear}-{checkM}
                        </div>
                        {appliedInfo.successDays !== undefined && (
                          <div>
                            • <span className="font-semibold text-zinc-800">반영 영업일:</span> {appliedInfo.successDays}일
                          </div>
                        )}
                        {appliedInfo.fetchedAt && (
                          <div>
                            • <span className="font-semibold text-zinc-800">갱신일시:</span> {new Date(appliedInfo.fetchedAt).toLocaleString('ko-KR', { hour12: false })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2 bg-[#f8f9fa] p-2 rounded-xl border border-zinc-150 text-xs">
            <Calendar className="w-4 h-4 text-zinc-400 font-bold" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              <option value="all">연간 전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {hasNoData ? (
        <div id="operation-dashboard-empty-card" className="bg-white p-12 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Database className="w-12 h-12 text-zinc-300 stroke-1.5 mb-4 animate-bounce" />
          <h3 className="text-sm font-bold text-zinc-800">업로드된 운영 수불 데이터가 없습니다.</h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-2 font-medium leading-relaxed">
            운영 업로드에서 제품수불부 또는 원자재수불부를 등록하세요.
          </p>
          <div className="flex flex-wrap gap-3 mt-6 justify-center">
            <AppButton
              onClick={() => navigate('/operation-upload')}
              className="bg-[#111111] text-white hover:bg-zinc-800 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs border-none"
            >
              운영 데이터 업로드로 이동 <ChevronRight className="w-4 h-4" />
            </AppButton>
            <AppButton
              onClick={() => setIsPreviewMode(true)}
              className="bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              샘플 데이터 화면 보기
            </AppButton>
          </div>
        </div>
      ) : (
        <>

      {/* Section 1: Full-width Interactive Sourcing Map */}
      <div id="sourcing-global-matrix-map" className="col-span-full w-full">
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs relative">
          <div className="flex justify-between items-start md:items-center gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-zinc-805 flex items-center gap-1.5 font-sans">
                <Globe className="w-4.5 h-4.5 text-indigo-600 animate-spin-slow" />
                원료 조달 및 완제품 판매 글로벌 네트워크 현황 지도
              </h3>
              <p className="text-[10.5px] text-zinc-500 mt-1 font-sans">
                업로드된 원자재 및 제품 수불 데이터의 해상 입고/출고 정보에 기반하여 글로벌 공급망 현황이 표시됩니다.
              </p>
            </div>
          </div>

          {/* Operation World Sourcing/Sales Dynamic Map */}
          <div className="mt-4">
            <OperationWorldMap
              mapPoints={MAP_POINTS}
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
              currencyMode={currencyMode}
              formatCurrencyAmount={formatCurrencyAmount}
            />
          </div>
        </div>
      </div>

      {/* Modal Popup Drawer for Details */}
      {selectedLocation && (
        <div id="map-drawer-popup" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1.5px]" onClick={() => setSelectedLocation(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-left border border-zinc-200 animate-fade">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-150">
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                <MapPin className="w-4 h-4 text-indigo-600" />
                거점 정보 상세
              </h4>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs font-sans">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">거점 명칭 및 위치</span>
                <span className="text-sm font-bold text-zinc-800">{selectedLocation.locationName}</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">유형</span>
                <span className="text-xs font-semibold text-zinc-700">
                  {selectedLocation.type === 'hq' ? '포스코HY클린메탈 광양본사 (지휘본부)' : '협력 소싱처 및 원소재 입고지'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider font-sans">주요 다루는 품목</span>
                <p className="text-xs font-semibold text-zinc-850 mt-0.5">
                  {selectedLocation.products.join(', ')}
                </p>
              </div>

              {selectedLocation.type === 'hq' ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 bg-[#f0f9f8] rounded-xl border border-teal-100">
                    <span className="text-[10px] text-teal-800 block font-bold">총 판매 수량</span>
                    <span className="text-sm font-mono font-bold text-teal-950 block mt-0.5">
                      {(selectedLocation.salesQuantity ?? 0).toLocaleString()} Ton
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block font-bold font-sans">매출 실적 누계</span>
                    <span className="text-sm font-mono font-bold text-emerald-950 block mt-0.5">
                      {formatCurrencyAmount(selectedLocation.salesRevenue, true)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-indigo-800 block font-bold">원료 인도 조달량</span>
                    <span className="text-sm font-mono font-bold text-indigo-950 block mt-0.5">
                      {(selectedLocation.purchaseQuantity ?? 0).toLocaleString()} Ton
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                    <span className="text-[10px] text-zinc-550 block font-bold">소싱 환산가치</span>
                    <span className="text-sm font-mono font-bold text-zinc-900 block mt-0.5">
                      {formatCurrencyAmount(selectedLocation.purchaseAmount, true)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-150 flex justify-end gap-2 text-xs font-sans">
              <AppButton 
                onClick={() => {
                  setSelectedLocation(null);
                  navigate('/sales-status');
                }} 
                className="text-[11px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold border-0 cursor-pointer"
              >
                판매지표 이동
              </AppButton>
              <AppButton 
                onClick={() => {
                  setSelectedLocation(null);
                  navigate('/raw-material-status');
                }} 
                className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0 cursor-pointer"
              >
                원자재수불 이동
              </AppButton>
            </div>
          </div>
        </div>
      )}



      {/* Exchange Rate Card */}
      {currencyMode === 'USD' && (
        <div id="exchange-rate-management-card" className="bg-[#fcfdfd] border border-zinc-250 p-5 rounded-2xl shadow-xs space-y-4">
          {/* Header & Main Info */}
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 font-sans">
                <DollarSign className="w-4 h-4 text-zinc-500 animate-pulse" />
                <span>{activeYear}년 {activeMonth === 'all' ? '전체월' : `${activeMonth}월`} 환율 설정</span>
              </h3>
              
              {/* Rate Display or Editing element */}
              {isEditingExchange && !eximKeyMissing ? (
                <div className="flex items-center gap-2 pt-1 font-sans">
                  <input
                    type="text"
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(e.target.value)}
                    placeholder="예: 1490.1"
                    className="w-28 px-2.5 py-1 text-right font-mono border border-zinc-300 rounded-md text-sm font-bold focus:outline-teal-500"
                  />
                  <span className="text-zinc-600 text-xs">원/USD</span>
                  <button 
                    onClick={handleSaveRateInput}
                    className="px-3 py-1 bg-[#00786F] hover:bg-[#005f58] text-white rounded-md text-xs font-bold cursor-pointer transition-colors"
                  >
                    저장
                  </button>
                  <button 
                    onClick={() => setIsEditingExchange(false)}
                    className="px-2 py-1 text-zinc-400 hover:text-zinc-650 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="space-y-1 pt-1">
                  {(() => {
                    const curRate = getCurrentExchangeRate();
                    return curRate && curRate > 0 ? (
                      <div className="text-2xl font-black text-[#00786F] tracking-tight font-sans">
                        {curRate.toLocaleString()}원/USD
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-rose-600 animate-pulse">
                        환율 정보 없음
                      </div>
                    );
                  })()}
                  
                  {/* Criteria Detail metadata */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#647067] font-sans">
                    <div>
                      <span className="font-semibold text-zinc-700">기준:</span>{' '}
                      {(() => {
                        const checkM = activeMonth === 'all' ? 5 : Number(activeMonth);
                        const rateRec = ExchangeRateStorage.getRateRecord(activeYear, checkM);
                        if (rateRec?.source === 'api') {
                          return '한국수출입은행 월평균 환율';
                        } else if (rateRec?.source === 'manual') {
                          return '사용자 수동 입력 환율';
                        }
                        return '마지막 저장 환율 (임시)';
                      })()}
                    </div>
                    <div className="w-1 h-1 rounded-full bg-zinc-350"></div>
                    <div>
                      <span className="font-semibold text-zinc-700">상태:</span>{' '}
                      {getCurrentExchangeRate() > 0 ? (
                        <span className="text-teal-700 font-bold">저장됨</span>
                      ) : (
                        <span className="text-rose-500 font-bold">대기 중</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button Controls */}
            <div className="flex items-center gap-2">
              {!isEditingExchange && (
                <>
                  <button
                    onClick={handleExchangeAutoSync}
                    disabled={isSyncingExchange || eximKeyMissing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                      eximKeyMissing 
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed' 
                        : 'bg-white border-zinc-250 hover:bg-zinc-50 text-zinc-700 cursor-pointer shadow-xs'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingExchange ? 'animate-spin' : ''}`} />
                    <span>환율 새로고침</span>
                  </button>

                  {!eximKeyMissing && (
                    <button 
                      onClick={() => {
                        setCustomRateInput(getCurrentExchangeRate() > 0 ? String(getCurrentExchangeRate()) : '');
                        setIsEditingExchange(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-zinc-250 hover:bg-zinc-50 text-zinc-700 cursor-pointer shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>수동 입력</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sync Feedback Alert Inside Card */}
          {syncFeedback && (
            <div className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 transition-all animate-fade ${
              syncFeedback.type === 'success' 
                ? 'bg-[#f0f9f8] border-teal-200 text-teal-955' 
                : 'bg-rose-50 border-rose-200 text-rose-955'
            }`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-2">
                  {syncFeedback.type === 'success' ? (
                    <CheckCircle className="w-4.5 h-4.5 text-[#008f83] flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-xs block font-sans">
                      {syncFeedback.type === 'success' ? (
                        <>환율이 성공적으로 업데이트되었습니다.</>
                      ) : (
                        <>환율 연동에 실패하였습니다.</>
                      )}
                    </span>
                    <p className="text-[11px] mt-0.5 text-zinc-600 font-sans">
                      {syncFeedback.type === 'success' ? (
                        <>반영 환율: <strong className="font-mono text-[#00786F]">{syncFeedback.stats?.averageRate?.toLocaleString()}원/USD</strong></>
                      ) : (
                        <>기존 마지막 저장 환율 {getCurrentExchangeRate() > 0 ? `${getCurrentExchangeRate().toLocaleString()}원/USD` : '없음'}를 유지합니다.</>
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSyncFeedback(null)} 
                  className="p-1 hover:bg-black/5 rounded cursor-pointer text-zinc-400 hover:text-zinc-650 flex-shrink-0 font-sans"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mid-section KPI Cards */}
      <div id="dashboard-metric-four-grid" className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* 매출액 및 매출이익 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-emerald-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#008f83] block font-sans">매출 실적 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1 font-mono">
              매출 {formatCurrencyAmount(totalRevenueKRW, true)}
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-500">매출원가:</span>
                <span className="font-mono text-zinc-700">{formatCurrencyAmount(totalCostOfSalesKRW)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>매출이익:</span>
                <span className="font-mono">{formatCurrencyAmount(totalGrossProfitKRW)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 font-bold border-t border-dashed border-zinc-150 pt-2">
                <span>총 판매물량(3대핵심):</span>
                <span className="font-mono">{totalSalesTons.toLocaleString()} Ton</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4 font-sans">
            <button 
              onClick={() => navigate('/sales-status')}
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>판매 상세 화면 이동</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 완제품 생산 실적 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-indigo-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 block font-sans">완제품 생산량 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1 font-mono">
              생산공급 {totalProductionTons.toLocaleString()} Ton
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-500">생산가치 추액:</span>
                <span className="font-mono text-zinc-800">{formatCurrencyAmount(totalProductionAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-[#647067] font-semibold">
                <span>공장 설비가동:</span>
                <span className="text-[#008f83] font-bold">비가동 없음 (100%)</span>
              </div>
              <div className="text-[10px] text-zinc-400 pt-2 border-t border-slate-100">
                * D열 정량입하생산량 대응 수치
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4 font-sans">
            <button 
              onClick={() => navigate('/production-status')}
              className="text-[10.5px] text-indigo-700 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>생산 상세 화면 이동</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 기말 제품 재고 및 평가 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-rose-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-700 block font-sans">기말 완제품 재고</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1 font-mono">
              완품 기말 {productEndingQty.toLocaleString()} Ton
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs font-sans">
              <div className="flex justify-between text-rose-600 font-bold">
                <span>정산 재고평가손:</span>
                <span className="font-mono">{formatCurrencyAmount(totalValuationLossKRW)}</span>
              </div>
              <div className="flex justify-between">
                <span>평가 충당가치:</span>
                <span className="font-mono text-zinc-800 font-bold">
                  {formatCurrencyAmount(Math.max(0, (productEndingQty * 18_000_000) - totalValuationLossKRW))}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
                * 제품수불부 평가손실반영 실적 집계
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4 font-sans">
            <button 
              onClick={() => navigate('/product-status')}
              className="text-[10.5px] text-rose-750 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>제품수불 상세 이동</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 원자재 수급 및 수불 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-amber-500">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-905 block font-sans">원자재 수불 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1 font-mono">
              원료 기말 {rawMaterialEndingQty.toLocaleString()} Ton
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs font-sans">
              <div className="flex justify-between">
                <span>정산입하(구매):</span>
                <span className="font-mono text-teal-800 font-bold">+{rawSourcingTons.toLocaleString()} Ton</span>
              </div>
              <div className="flex justify-between">
                <span>정산불출(불출):</span>
                <span className="font-mono text-amber-850 font-bold">-{rawIssueTons.toLocaleString()} Ton</span>
              </div>
              <div className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
                * BP, BM, WET, LCO 4종 분석
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4 font-sans">
            <button 
              onClick={() => navigate('/raw-material-status')}
              className="text-[10.5px] text-amber-900 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>원자재수불 상세 이동</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>
      </div>

      {/* Section 2: Summary Tables Grid */}
      <div id="dashboard-summary-tables-block" className="space-y-6">
        {/* Table 1: 원자재 수불 요약부 */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">원자재 수불 요약장 (단위: Ton / {currencyMode === 'USD' ? 'USD/Ton' : '백만원/Ton'})</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-4 py-3 text-left">원료구분</th>
                  <th className="px-4 py-3 text-right">기초재고 (수량)</th>
                  <th className="px-4 py-3 text-right text-teal-850">구매입고 (수량)</th>
                  <th className="px-4 py-3 text-right text-amber-850">공정출고 (수량)</th>
                  <th className="px-4 py-3 text-right text-indigo-900 font-bold">기말재고 (수량)</th>
                  <th className="px-4 py-3 text-right text-indigo-950 font-bold">기말재고 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryRawTableData.map((row) => {
                  const isExpanded = !!expandedGroups[row.key];
                  const groupItems = targetRawRows.filter(r => 
                    r.materialGroup === row.key || 
                    getNormalizedMaterialName(r.rawMaterialName || r.canonicalMaterialName || '') === row.name
                  );

                  return (
                    <React.Fragment key={row.key}>
                      <tr 
                        onClick={() => toggleGroup(row.key)} 
                        className="hover:bg-zinc-50 divide-x divide-[#eef2ec] cursor-pointer transition-colors"
                        title="클릭하여 하위 품목 원장 상세 조회"
                      >
                        <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left bg-slate-50/10 flex items-center gap-1.5 selection:bg-transparent">
                          <span className="text-[9px] text-zinc-400 w-3 inline-block font-mono">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span>{row.name}</span>
                          <span className="text-[9px] font-sans font-medium text-zinc-450 bg-zinc-100 px-1.5 py-0.5 rounded ml-1 select-none">
                            {groupItems.length}개 품목
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-650">{row.begQty.toLocaleString()} Ton</td>
                        <td className="px-4 py-3 text-right text-teal-800 font-bold bg-[#f0f9f8]">{row.purQty.toLocaleString()} Ton</td>
                        <td className="px-4 py-3 text-right text-amber-850 font-semibold bg-amber-50/10">{row.prcQty.toLocaleString()} Ton</td>
                        <td className="px-4 py-3 text-right text-indigo-950 font-extrabold bg-indigo-50/5">{row.endQty.toLocaleString()} Ton</td>
                        <td className="px-4 py-3 text-right text-indigo-900 font-bold bg-indigo-50/5">
                          {currencyMode === 'USD' 
                            ? `$${Math.round(row.endPrice * 1000).toLocaleString()}` 
                            : `₩${Math.round(row.endPrice).toLocaleString()}`}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-zinc-50/40">
                          <td colSpan={6} className="px-5 py-3.5 bg-zinc-50/30">
                            <div className="border border-zinc-200 rounded-xl bg-white shadow-xs overflow-hidden">
                              <table className="min-w-full divide-y divide-zinc-150 text-left text-[11px] font-sans">
                                <thead className="bg-[#fcfdfc] text-[9px] text-[#5e6b60] font-bold uppercase tracking-wider">
                                  <tr className="divide-x divide-zinc-100">
                                    <th className="px-3.5 py-2.5 text-left w-1/4">품목코드 (Row ID)</th>
                                    <th className="px-3.5 py-2.5 text-left w-1/3">원자재 품목명 및 수불 상세</th>
                                    <th className="px-3.5 py-2.5 text-right">기초 재고</th>
                                    <th className="px-3.5 py-2.5 text-right text-teal-800">구매 입고</th>
                                    <th className="px-3.5 py-2.5 text-right text-amber-850">공정 출고</th>
                                    <th className="px-3.5 py-2.5 text-right font-black text-indigo-950">기말 재고</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 font-mono text-zinc-650 bg-white">
                                  {groupItems.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-6 text-center text-zinc-400 font-sans italic">
                                        이 그룹에 매칭된 세부 원수불 품목 내역이 없습니다. (업로드 원장을 확인하세요)
                                      </td>
                                    </tr>
                                  ) : (
                                    groupItems.map((item) => (
                                      <tr key={item.id} className="hover:bg-zinc-50/30 divide-x divide-zinc-100">
                                        <td className="px-3.5 py-2 font-mono font-semibold text-zinc-900 text-left">
                                          {item.rawItemCode || item.materialCode || '-'}
                                        </td>
                                        <td className="px-3.5 py-2 text-left text-zinc-650 font-sans font-medium">
                                          {item.rawItemName || item.rawMaterialName || '-'}
                                        </td>
                                        <td className="px-3.5 py-2 text-right text-zinc-500">{(item.beginningQty || 0).toLocaleString()} Ton</td>
                                        <td className="px-3.5 py-2 text-right text-teal-800">{(item.purchaseQty || 0).toLocaleString()} Ton</td>
                                        <td className="px-3.5 py-2 text-right text-amber-850">{(item.processIssueQty || 0).toLocaleString()} Ton</td>
                                        <td className="px-3.5 py-2 text-right text-indigo-950 font-bold bg-indigo-50/5">{(item.endingQty || 0).toLocaleString()} Ton</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: 제품 수불 요약부 */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-teal-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">제품 수불 요약장 (단위: Ton / {currencyMode === 'USD' ? 'USD/Ton' : '백만원'})</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-4 py-3 text-left">제품구분</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-indigo-750">정제품 생산 수량</th>
                  <th className="px-4 py-3 text-right">생산 단가</th>
                  <th className="px-4 py-3 text-right text-emerald-850">정산 판매 수량</th>
                  <th className="px-4 py-3 text-right text-emerald-950 font-bold">판매 단가</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-bold">기말 수량</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-extrabold">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryProdTableData.map((row) => {
                  const isLithium = row.key === '탄산리튬';
                  return (
                    <tr key={row.key} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                      <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left bg-slate-50/10">
                        {row.key} ({row.name})
                        {isLithium && (
                          <span className="block text-[8px] bg-indigo-50 text-indigo-800 px-1 py-0.5 rounded font-normal font-sans mt-0.5 max-w-max">
                            원수량 방식
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-650">{row.begQty.toLocaleString()} Ton</td>
                      <td className="px-4 py-3 text-right text-zinc-450">{currencyMode === 'USD' ? `$${Math.round(row.begPrice * 1000).toLocaleString()}` : `₩${Math.round(row.begPrice).toLocaleString()}`}</td>
                      
                      <td className="px-4 py-3 text-right text-indigo-800 font-bold bg-indigo-50/5">{row.prodQty.toLocaleString()} Ton</td>
                      <td className="px-4 py-3 text-right text-zinc-450 bg-indigo-50/5">{currencyMode === 'USD' ? `$${Math.round(row.prodPrice * 1000).toLocaleString()}` : `₩${Math.round(row.prodPrice).toLocaleString()}`}</td>
                      
                      <td className="px-4 py-3 text-right text-emerald-800 font-bold bg-emerald-50/5">{row.salesQty.toLocaleString()} Ton</td>
                      <td className="px-4 py-3 text-right text-emerald-950 font-semibold bg-emerald-50/5">{currencyMode === 'USD' ? `$${Math.round(row.salesPrice * 1000).toLocaleString()}` : `₩${Math.round(row.salesPrice).toLocaleString()}`}</td>
                      
                      <td className="px-4 py-3 text-right text-[#008f83] font-extrabold bg-[#f0f9f8]">{row.endQty.toLocaleString()} Ton</td>
                      <td className="px-4 py-3 text-right text-[#008f83] font-bold bg-[#f0f9f8]">{currencyMode === 'USD' ? `$${Math.round(row.endPrice * 1000).toLocaleString()}` : `₩${Math.round(row.endPrice).toLocaleString()}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        </>
      )}

      {/* Relocated Upload Workspace Bar at the bottom for polished corporate hierarchy */}
      <div id="operation-upload-trigger-footer" className="bg-[#fcfdfd] border-2 border-dashed border-zinc-250 p-6 rounded-2xl text-center space-y-3 shadow-xs">
        <h3 className="text-sm font-bold text-zinc-800 flex items-center justify-center gap-1.5 font-sans">
          📥 월별 엑셀 원수불부 정산 등록통제
        </h3>
        <p className="text-xs text-zinc-550 max-w-2xl mx-auto font-sans leading-relaxed">
          대용량 제품정산수불 및 원자재소비 수불대장을 갱신하는 엑셀 수입 업로드 시스템입니다. 
          등록한 원장은 내부 로컬 스토리지에 격리 보존되어 즉시 상단 대시보드와 각 세부현황 뷰에 실시간 집계 연동됩니다. (보안 규정 철저 준수)
        </p>
        <div className="flex justify-center gap-3 pt-1.5 font-sans">
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-zinc-900 border-none text-white hover:bg-zinc-850 px-5 py-2.5 font-bold rounded-xl shadow-xs cursor-pointer"
          >
            엑셀 수불부 업로드 화면이동
            <ChevronRight className="w-4 h-4 ml-1.5 inline" />
          </AppButton>
        </div>
      </div>
    </div>
  );
}
