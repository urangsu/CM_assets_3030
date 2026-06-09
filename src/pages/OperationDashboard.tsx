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
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';
import { OperationWorldMap } from '../components/OperationWorldMap';

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
  const [isSyncingExchange, setIsSyncingExchange] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('');
  const [isEditingExchange, setIsEditingExchange] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'warning' | 'error' | '';
    text: string;
  } | null>(null);

  const [realProducts, setRealProducts] = useState<ProductLedgerRecord[]>([]);
  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);
  const [countryRecords, setCountryRecords] = useState<OperationCountryRecord[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<OperationMapPoint | null>(null);

  // 1. Data Loader
  const loadData = () => {
    const listProducts = OperationStorage.getProductRecords(activeYear);
    const listMaterials = OperationStorage.getRawMaterialRecords(activeYear);

    if ((listProducts && listProducts.length > 0) || (listMaterials && listMaterials.length > 0)) {
      setRealProducts(listProducts);
      setRealMaterials(listMaterials);
      setIsSampleData(false);
    } else {
      setRealProducts(getSeedProducts(activeYear));
      setRealMaterials(getSeedRawMaterials(activeYear));
      setIsSampleData(true);
    }

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

    const handler = () => {
      loadData();
    };
    window.addEventListener('operation-ledger-changed', handler);
    return () => {
      window.removeEventListener('operation-ledger-changed', handler);
    };
  }, [activeYear, activeMonth]);

  // Set initial rate input value
  useEffect(() => {
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    const currentRate = ExchangeRateStorage.getRate(activeYear, mNum);
    setCustomRateInput(String(currentRate));
  }, [activeYear, activeMonth]);

  // Seed Product Ledgers (5 Canonical Products only)
  const getSeedProducts = (yearStr: string): ProductLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const sampleRecords: ProductLedgerRecord[] = [];

    const products = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 120, unitPrice: 24_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 45, unitPrice: 58_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 85, unitPrice: 38_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 150, unitPrice: 12_000_000 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 300, unitPrice: 9_500_000 },
    ];

    months.forEach((m) => {
      const factor = 0.85 + Math.sin((m / 12) * Math.PI) * 0.3 + (m % 3) * 0.05;

      products.forEach((p) => {
        const rawQty = Math.round(p.baseQty * factor);
        const normalReceiptQty = Math.round(rawQty * 1.08); // production
        const begQty = Math.round(rawQty * 1.15);
        const revenue = Math.round(rawQty * p.unitPrice);
        const costOfSales = Math.round(revenue * (0.81 + (m % 5) * 0.02));
        const grossProfit = revenue - costOfSales;

        const recQty: ProductLedgerRecord = {
          id: `seed_prod_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: `${p.metal} ${p.name}`,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: begQty,
          normalReceipt: normalReceiptQty,
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: normalReceiptQty,
          salesQuantity: rawQty,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: rawQty,
          endingInventory: begQty + normalReceiptQty - rawQty,
          inventoryValuationLoss: 25_000_000,
          valuationApplied: 25_000_000,
          revenue: revenue,
          costOfSales: costOfSales,
          grossProfit: grossProfit,
          uploadedAt: new Date().toISOString()
        };

        const recAmt: ProductLedgerRecord = {
          ...recQty,
          id: `seed_prod_${yearStr}_${m}_${p.name}_금액`,
          unit: '금액',
          beginningInventory: begQty * p.unitPrice,
          normalReceipt: normalReceiptQty * p.unitPrice,
          receiptTotal: normalReceiptQty * p.unitPrice,
          salesQuantity: rawQty * p.unitPrice,
          issueTotal: rawQty * p.unitPrice,
          endingInventory: (begQty + normalReceiptQty - rawQty) * p.unitPrice
        };

        const recPrc: ProductLedgerRecord = {
          ...recQty,
          id: `seed_prod_${yearStr}_${m}_${p.name}_단가`,
          unit: '단가',
          beginningInventory: p.unitPrice,
          normalReceipt: p.unitPrice,
          receiptTotal: p.unitPrice,
          salesQuantity: p.unitPrice,
          issueTotal: p.unitPrice,
          endingInventory: p.unitPrice
        };

        sampleRecords.push(recQty, recAmt, recPrc);
      });
    });

    return sampleRecords;
  };

  // Seed Raw Material Ledgers (4 Canonical Materials only)
  const getSeedRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const materials: RawMaterialLedgerRecord[] = [];

    const rawKinds = [
      { key: 'BP', rawName: 'BP (Black Powder 원료)', baseQty: 180, prc: 28_000_000 },
      { key: 'BM', rawName: 'BM (Black Mass)', baseQty: 320, prc: 6_550_000 },
      { key: 'WET', rawName: 'WET (Wet BM)', baseQty: 240, prc: 12_000_000 },
      { key: 'LCO', rawName: 'LCO (리튬코발트산화물)', baseQty: 80, prc: 45_000_000 },
    ];

    months.forEach((m) => {
      const factor = 0.85 + Math.sin((m / 12) * Math.PI) * 0.25;

      rawKinds.forEach((k) => {
        const qty = Math.round(k.baseQty * factor);
        const scaleReceipt = Math.round(qty * 1.12);
        const scaleIssue = qty;
        const begQty = Math.round(qty * 0.95);

        materials.push({
          id: `seed_raw_${yearStr}_${m}_${k.key}`,
          year: yearStr,
          month: m,
          sourceType: '원자재수불부',
          rawMaterialName: k.rawName,
          unit: '수량',
          beginningInventory: begQty,
          receiptTotal: scaleReceipt,
          issueTotal: scaleIssue,
          endingInventory: begQty + scaleReceipt - scaleIssue,
          uploadedAt: new Date().toISOString()
        });
      });
    });

    return materials;
  };

  // --- Currency Conversion Utility ---
  const getCurrentExchangeRate = (monthNumber?: number): number => {
    const checkMonth = monthNumber || (activeMonth === 'all' ? 5 : Number(activeMonth));
    return ExchangeRateStorage.getRate(activeYear, checkMonth);
  };

  const convertVal = (krwVal: number, monthNumber?: number): number => {
    if (currencyMode === 'USD') {
      const rate = getCurrentExchangeRate(monthNumber);
      return krwVal / rate;
    }
    return krwVal;
  };

  // Precise exact details
  const formatKRWMillion = (valueKRW: number) => {
    if (valueKRW === 0) return '-';
    return `₩${Math.round(valueKRW / 1_000_000).toLocaleString()}백만원`;
  };

  const formatKRWBillion = (valueKRW: number) => {
    if (valueKRW === 0) return '-';
    return `₩${(valueKRW / 1_000_000_000).toFixed(1)}십억원`;
  };

  // Differentiate KPIs (Billion KRW / Million USD) vs Tables (Million KRW)
  const formatCurrencyAmount = (valueKRW: number, isKPI: boolean = false) => {
    const rate = getCurrentExchangeRate();
    if (currencyMode === 'USD') {
      const usdVal = valueKRW / rate;
      if (isKPI) {
        return `$${(usdVal / 1_000_000).toFixed(1)}M`;
      }
      return `$${Math.round(usdVal / 1_000).toLocaleString()}K`;
    }
    // KRW
    return isKPI ? formatKRWBillion(valueKRW) : formatKRWMillion(valueKRW);
  };

  const handleExchangeAutoSync = async () => {
    setIsSyncingExchange(true);
    setSyncFeedback(null);
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    try {
      const response = await ExchangeRateStorage.fetchMonthlyAverageRate(activeYear, mNum);
      if (response && response.rate) {
        setCustomRateInput(String(response.rate));
        setSyncFeedback({
          type: response.source === 'api' ? 'success' : 'warning',
          text: response.message || '환율 정보를 정상 조율했습니다.'
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        text: '한국수출입은행 API 조회 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주십시오.'
      });
    } finally {
      setIsSyncingExchange(false);
    }
  };

  const handleSaveRateInput = () => {
    const num = Number(customRateInput);
    if (Number.isNaN(num) || num <= 0) {
      alert('올바른 환율 금액을 입력하십시오. 예: 1372.5');
      return;
    }
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    ExchangeRateStorage.saveRate(activeYear, mNum, num, 'manual');
    setIsEditingExchange(false);
  };

  const seedDemoCountryRecords = () => {
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    const demo: OperationCountryRecord[] = [
      {
        year: activeYear,
        month: mNum,
        countryCode: 'ID',
        countryName: '인도네시아',
        type: 'purchase',
        materialName: 'WET (Wet BM)',
        quantityTon: Math.round(rawSourcingTons * 0.42) || 420,
        amountKRW: Math.round(totalRevenueKRW * 0.35) || 35000000000
      },
      {
        year: activeYear,
        month: mNum,
        countryCode: 'US',
        countryName: '미국',
        type: 'purchase',
        materialName: 'BM (Black Mass)',
        quantityTon: Math.round(rawSourcingTons * 0.3) || 300,
        amountKRW: Math.round(totalRevenueKRW * 0.18) || 18000000000
      },
      {
        year: activeYear,
        month: mNum,
        countryCode: 'CL',
        countryName: '칠레',
        type: 'purchase',
        materialName: 'BP (Black Powder 원료)',
        quantityTon: Math.round(rawSourcingTons * 0.18) || 180,
        amountKRW: Math.round(totalRevenueKRW * 0.28) || 28000000000
      },
      {
        year: activeYear,
        month: mNum,
        countryCode: 'CD',
        countryName: '콩고민주공화국',
        type: 'purchase',
        materialName: 'LCO (리튬코발트산화물)',
        quantityTon: Math.round(rawSourcingTons * 0.1) || 100,
        amountKRW: Math.round(totalRevenueKRW * 0.19) || 19000000000
      }
    ];
    localStorage.setItem(`hycm_operation_country_records_${activeYear}`, JSON.stringify(demo));
    loadData();
  };

  const clearCountryRecords = () => {
    localStorage.removeItem(`hycm_operation_country_records_${activeYear}`);
    loadData();
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

  // Always include HQ Korea
  MAP_POINTS.push({
    id: 'KR',
    countryCode: 'KR',
    countryName: '대한민국',
    locationName: '대한민국 · 광양/포항 HQ',
    type: 'hq',
    salesQuantity: totalSalesTons,
    salesRevenue: totalRevenueKRW,
    purchaseQuantity: 0,
    purchaseAmount: 0,
    products: ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'],
    coords: COUNTRY_COORDS.KR
  });

  // Construct other coordinates dynamically based on loaded/demo country records
  const uniqueCountryCodes = Array.from(new Set(currentMonthRecords.map(r => r.countryCode))) as string[];
  uniqueCountryCodes.forEach((code: string) => {
    if (code === 'KR') return;
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
    const matchedRows = targetRawRows.filter(r => getNormalizedMaterialName(r.rawMaterialName) === def.name);

    const begQty = matchedRows.reduce((a, b) => a + (b.beginningInventory || 0), 0);
    const recQty = matchedRows.reduce((a, b) => a + (b.receiptTotal || 0), 0);
    const issQty = matchedRows.reduce((a, b) => a + (b.issueTotal || 0), 0);
    const endQty = matchedRows.reduce((a, b) => a + (b.endingInventory || 0), 0);

    let basePricePerTon = 12; // default Millions
    if (def.key === 'LCO') basePricePerTon = 45;
    if (def.key === 'BM') basePricePerTon = 6.5;
    if (def.key === 'BP') basePricePerTon = 28;
    if (def.key === 'WET') basePricePerTon = 12;

    const priceConverted = convertVal(basePricePerTon * 1_000_000) / 1_000_000;

    return {
      key: def.key,
      name: def.name,
      begQty,
      begPrice: priceConverted,
      recQty,
      recPrice: priceConverted,
      issQty,
      issPrice: priceConverted,
      endQty,
      endPrice: priceConverted,
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
    const begPrice = begQty > 0 ? (begAmt / begQty) : 0;

    const prodQty = qRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodAmt = aRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodPrice = prodQty > 0 ? (prodAmt / prodQty) : 0;

    const salesQty = qRows.reduce((sum, r) => sum + (r.salesQuantity || 0), 0);
    const salesAmt = qRows.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const salesPrice = salesQty > 0 ? (salesAmt / salesQty) : 0;

    const endQty = qRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endAmt = aRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endPrice = endQty > 0 ? (endAmt / endQty) : 0;

    return {
      key: def.key,
      name: def.canonicalName,
      begQty,
      begPrice: convertVal(begPrice) / 1_000_000, 
      prodQty,
      prodPrice: convertVal(prodPrice) / 1_000_000,
      salesQty,
      salesPrice: convertVal(salesPrice) / 1_000_000,
      endQty,
      endPrice: convertVal(endPrice) / 1_000_000,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div id="dashboard-header-block" className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#f2f4f6] text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">HYCM Integrated Operations</span>
            <span className="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-bold">수불 일치 검수단</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            운영 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품 판매, 완제품 생산, 원자재 수하 및 기말고 가치 흐름을 통합 대조합니다.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
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
                currencyMode === 'USD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-500'
              }`}
            >
              달러 보기
            </button>
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
                {currentMonthRecords.length > 0 
                  ? '업로드된 국가별 실적에 따라 공급망 거점이 동적으로 정밀 표시됩니다.' 
                  : '제품수불부만 업로드된 기본 상태에서는 대한민국 HQ 본사 핀만 활성화됩니다. 아래 지원 버튼으로 시뮬레이션 지도를 켜 볼 수 있습니다.'}
              </p>
            </div>
            <div className="flex gap-1.5">
              {currentMonthRecords.length === 0 ? (
                <button
                  onClick={seedDemoCountryRecords}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                >
                  📡 지도 데모 수하 실적 로드
                </button>
              ) : (
                <button
                  onClick={clearCountryRecords}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                >
                  🗑️ 지도 실적 클리어 (본사만 표시)
                </button>
              )}
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
                      {selectedLocation.salesQuantity.toLocaleString()} Ton
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
                      {selectedLocation.purchaseQuantity.toLocaleString()} Ton
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

      {/* EXIM API Sync Feedback Alert */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border text-xs flex justify-between items-start gap-4 transition-all animate-fade ${
          syncFeedback.type === 'success' 
            ? 'bg-[#f0f9f8] border-teal-200 text-teal-900' 
            : syncFeedback.type === 'warning' 
            ? 'bg-amber-50/75 border-amber-250 text-amber-905' 
            : 'bg-rose-50/75 border-rose-200 text-rose-900'
        }`}>
          <div className="flex gap-2.5">
            {syncFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#008f83] flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                syncFeedback.type === 'warning' ? 'text-amber-500' : 'text-rose-500'
              }`} />
            )}
            <div>
              <span className="font-bold block">
                {syncFeedback.type === 'success' 
                  ? '한국수출입은행 실시간 환율 연동 성공' 
                  : syncFeedback.type === 'warning' 
                  ? '환율 연동 안내 (기본 환율 보정 적용)' 
                  : '환율 조회 처리 실패'}
              </span>
              <p className="text-[11px] mt-1 leading-relaxed">
                {syncFeedback.text}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSyncFeedback(null)} 
            className="p-1 hover:bg-black/5 rounded cursor-pointer text-zinc-400 hover:text-zinc-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Exchange Rate Bar */}
      <div className="bg-[#fcfdfd] border border-zinc-250 p-4.5 rounded-2xl shadow-xs flex flex-wrap justify-between items-center gap-3.5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4.5 h-4.5 text-zinc-500 font-bold" />
          <div className="text-xs">
            <span className="font-bold text-zinc-800 block font-sans">
              한국수출입은행 외환고시 월평균 상호 교환율
            </span>
            <span className="text-[#647067] text-[10.5px] block mt-0.5 font-sans">
              당월 고시환율은 <strong className="font-mono text-indigo-700">{getCurrentExchangeRate().toLocaleString()} 원/USD</strong> 기준으로 계수 변환 적용됩니다.
            </span>
          </div>
        </div>

        {/* Sync panel */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-100 text-xs">
          <span className="text-[11px] font-bold text-zinc-505 font-mono">
            {activeYear}년 {activeMonth === 'all' ? '5' : activeMonth}월 환율:
          </span>
          {isEditingExchange ? (
            <div className="flex items-center gap-1.5 font-mono">
              <input
                type="text"
                value={customRateInput}
                onChange={(e) => setCustomRateInput(e.target.value)}
                className="w-18 px-1.5 py-0.5 text-right font-mono border border-zinc-300 rounded text-xs font-bold"
              />
              <span className="text-zinc-500 text-xs font-sans">원</span>
              <button 
                onClick={handleSaveRateInput}
                className="px-2 py-0.5 bg-zinc-900 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                저장
              </button>
              <button 
                onClick={() => setIsEditingExchange(false)}
                className="text-[10px] text-zinc-400 font-semibold cursor-pointer"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono">
              <span className="font-mono font-bold text-indigo-700">
                {getCurrentExchangeRate().toLocaleString()} 원
              </span>
              <button 
                onClick={() => {
                  setCustomRateInput(String(getCurrentExchangeRate()));
                  setIsEditingExchange(true);
                }}
                className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-700 transition-colors"
                title="수동 수정"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="w-px h-4.5 bg-zinc-200 mx-1"></div>

          <button
            onClick={handleExchangeAutoSync}
            disabled={isSyncingExchange}
            className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 hover:bg-teal-100/80 text-[#008f83] border-none text-[10.5px] font-bold rounded-lg cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingExchange ? 'animate-spin' : ''}`} />
            자동 조회 (API)
          </button>
        </div>
      </div>

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

        {/* 원자재 수하 및 수불 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-amber-500">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-705 block font-sans">원자재 수하 지표</span>
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
        {/* Table 1: 원료 수불 요약부 */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">원야재 수불 요약장 (단위: Ton / {currencyMode === 'USD' ? 'USD/Ton' : '백만원'})</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-4 py-3 text-left">원료구분</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-teal-850">인도구매 수량</th>
                  <th className="px-4 py-3 text-right">구매 단가</th>
                  <th className="px-4 py-3 text-right text-amber-850">공정불출 수량</th>
                  <th className="px-4 py-3 text-right">불출 단가</th>
                  <th className="px-4 py-3 text-right text-indigo-900 font-bold">기말재고 수량</th>
                  <th className="px-4 py-3 text-right text-indigo-950 font-bold">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryRawTableData.map((row) => (
                  <tr key={row.key} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                    <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left bg-slate-50/10">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-650">{row.begQty.toLocaleString()} Ton</td>
                    <td className="px-4 py-3 text-right text-zinc-450">{currencyMode === 'USD' ? `$${Math.round(row.begPrice * 1000).toLocaleString()}` : `₩${Math.round(row.begPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-teal-800 font-bold bg-[#f0f9f8]">{row.recQty.toLocaleString()} Ton</td>
                    <td className="px-4 py-3 text-right text-zinc-450 bg-[#f0f9f8]">{currencyMode === 'USD' ? `$${Math.round(row.recPrice * 1000).toLocaleString()}` : `₩${Math.round(row.recPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-amber-850 font-semibold bg-amber-50/10">{row.issQty.toLocaleString()} Ton</td>
                    <td className="px-4 py-3 text-right text-zinc-450 bg-amber-50/10">{currencyMode === 'USD' ? `$${Math.round(row.issPrice * 1000).toLocaleString()}` : `₩${Math.round(row.issPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-indigo-950 font-extrabold bg-indigo-50/5">{row.endQty.toLocaleString()} Ton</td>
                    <td className="px-4 py-3 text-right text-indigo-900 font-bold bg-indigo-50/5">{currencyMode === 'USD' ? `$${Math.round(row.endPrice * 1000).toLocaleString()}` : `₩${Math.round(row.endPrice).toLocaleString()}`}</td>
                  </tr>
                ))}
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
