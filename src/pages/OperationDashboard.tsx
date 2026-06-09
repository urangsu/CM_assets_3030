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
  }, [activeYear]);

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

        // Create 수량 record
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
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: revenue,
          costOfSales: costOfSales,
          grossProfit: grossProfit,
          uploadedAt: new Date().toISOString()
        };

        // Create 금액 record
        const recAmt: ProductLedgerRecord = {
          ...recQty,
          id: `seed_prod_${yearStr}_${m}_${p.name}_금액`,
          unit: '금액',
          beginningInventory: begQty * p.unitPrice * 0.8,
          normalReceipt: normalReceiptQty * p.unitPrice * 0.8,
          receiptTotal: normalReceiptQty * p.unitPrice * 0.8,
          endingInventory: (begQty + normalReceiptQty - rawQty) * p.unitPrice * 0.8,
          inventoryValuationLoss: m % 4 === 0 ? 120_000_000 : 0,
          valuationApplied: m % 4 === 0 ? 100_000_000 : 0
        };

        sampleRecords.push(recQty);
        sampleRecords.push(recAmt);
      });
    });

    return sampleRecords;
  };

  // Seed Raw Material Ledgers
  const getSeedRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const materials: RawMaterialLedgerRecord[] = [];

    const matSeeds = [
      { name: 'BP (Black Powder 원료)', unit: 'Mt', beginning: 65.3, receipt: 180.4, issue: 155.2 },
      { name: 'BM (Black Mass)', unit: 'Mt', beginning: 210.4, receipt: 740.5, issue: 650.0 },
      { name: 'WET (Wet BM)', unit: 'Mt', beginning: 120.0, receipt: 390.0, issue: 350.0 },
      { name: 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)', unit: 'Mt', beginning: 24.5, receipt: 78.4, issue: 72.1 }
    ];

    months.forEach((m) => {
      const idxFactor = 0.95 + (m % 5) * 0.04;
      matSeeds.forEach((seed, sIdx) => {
        const start = Math.round(seed.beginning * idxFactor * 10) / 10;
        const rec = Math.round(seed.receipt * idxFactor * 10) / 10;
        const iss = Math.round(seed.issue * idxFactor * 10) / 10;
        const end = Math.round((start + rec - iss) * 10) / 10;

        materials.push({
          id: `seed_raw_${yearStr}_${m}_${sIdx}`,
          year: yearStr,
          month: m,
          sourceType: '원자재수불부',
          rawMaterialName: seed.name,
          unit: seed.unit,
          beginningInventory: start,
          receiptTotal: rec,
          issueTotal: iss,
          endingInventory: end,
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

  // Monetary formatting rules according to instructions (₩19,210백만원 or $14.0M)
  const formatCurrencyAmount = (valueKRW: number) => {
    const rate = getCurrentExchangeRate();
    if (currencyMode === 'USD') {
      return `$${(valueKRW / rate / 1_000_000).toFixed(1)}M`;
    }
    return `₩${Math.round(valueKRW / 1_000_000).toLocaleString()}백만원`;
  };

  // Precise exact details
  const formatKRWMillion = (valueKRW: number) => {
    return `₩${Math.round(valueKRW / 1_000_000).toLocaleString()}백만원`;
  };

  const formatKRWBillion = (valueKRW: number) => {
    return `₩${(valueKRW / 1_000_000_000).toFixed(1)}십억원`;
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

  // Map Locations Definition
  const MAP_POINTS: OperationMapPoint[] = [
    {
      id: 'KR',
      countryCode: 'KR',
      countryName: '대한민국',
      locationName: '대한민국 · 광양/포항',
      type: 'hq',
      salesQuantity: totalSalesTons,
      salesRevenue: totalRevenueKRW,
      purchaseQuantity: 0,
      purchaseAmount: 0,
      products: ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'],
      coords: { x: 80, y: 39 }
    },
    {
      id: 'ID',
      countryCode: 'ID',
      countryName: '인도네시아',
      locationName: '인도네시아 · 모로왈리',
      type: 'purchase',
      salesQuantity: 0,
      salesRevenue: 0,
      purchaseQuantity: Math.round(rawSourcingTons * 0.42),
      purchaseAmount: Math.round(totalRevenueKRW * 0.35),
      products: ['WET (Wet BM)'],
      coords: { x: 78, y: 55 }
    },
    {
      id: 'US',
      countryCode: 'US',
      countryName: '미국',
      locationName: '미국 · 테네시',
      type: 'purchase',
      salesQuantity: 0,
      salesRevenue: 0,
      purchaseQuantity: Math.round(rawSourcingTons * 0.30),
      purchaseAmount: Math.round(totalRevenueKRW * 0.18),
      products: ['BM (Black Mass)'],
      coords: { x: 25, y: 36 }
    },
    {
      id: 'CL',
      countryCode: 'CL',
      countryName: '칠레',
      locationName: '칠레 · 아타카마',
      type: 'purchase',
      salesQuantity: 0,
      salesRevenue: 0,
      purchaseQuantity: Math.round(rawSourcingTons * 0.18),
      purchaseAmount: Math.round(totalRevenueKRW * 0.28),
      products: ['BP (Black Powder 원료)'],
      coords: { x: 30, y: 78 }
    },
    {
      id: 'CD',
      countryCode: 'CD',
      countryName: '콩고',
      locationName: '콩고 · 민주공화국',
      type: 'purchase',
      salesQuantity: 0,
      salesRevenue: 0,
      purchaseQuantity: Math.round(rawSourcingTons * 0.10),
      purchaseAmount: Math.round(totalRevenueKRW * 0.19),
      products: ['LCO (리튬코발트산화물, Lithium Cobalt Oxide)'],
      coords: { x: 53, y: 58 }
    }
  ];

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
      return 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)';
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
    { key: 'LCO', name: 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)' }
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
      {/* Simulation Warning Banner */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-fade">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">⚠️ SAMPLE ACTIVE (샘플 데이터 모드 작동중)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 원본 수불 파일이 존재하지 않아 내장 표준 시뮬레이션 데이터를 불러왔습니다. 
                정량 보고서를 위해선 [운영 업로드] 탭에서 수불부를 입력해 주시기 바랍니다.
              </p>
            </div>
          </div>
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-none shrink-0 cursor-pointer"
          >
            운영 업로드 바로가기
            <ChevronRight className="w-3.5 h-3.5 ml-1 inline" />
          </AppButton>
        </div>
      )}

      {/* Page Title */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#f2f4f6] text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">HYCM Integrated Operations</span>
            <span className="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-bold">수불 일치 검수단</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            운영 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품 판매, 생산, 원자재 수불, 재고 흐름을 수불부 기준으로 확인합니다.
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
      <div className="col-span-full w-full">
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs relative">
          <div className="flex justify-between items-start md:items-center gap-2 mb-3">
            <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              핵심 원료 조달 및 완제품 공급망 글로벌 현황 지도 (Sourcing Regions)
            </h3>
            <div className="text-right">
              <span className="text-[10.5px] text-amber-800 font-bold block">
                * 지도 위 지역 마커를 클릭하여 국가/거점 세부 실적을 확인하십시오.
              </span>
            </div>
          </div>

          {/* Svg map container */}
          <div className="relative h-[360px] lg:h-[420px] w-full bg-slate-50/75 rounded-xl border border-zinc-200 overflow-hidden flex flex-col justify-between p-4">
            {/* World outline SVG background */}
            <svg viewBox="0 0 1000 400" className="absolute inset-0 w-full h-full opacity-20 pointer-events-none select-none">
              <path d="M 50,50 L 320,50 L 350,150 L 290,200 L 150,220 L 110,180 Z" fill="#475569" />
              <path d="M 270,220 L 350,220 L 320,380 L 260,380 Z" fill="#475569" />
              <path d="M 450,150 L 600,160 L 620,290 L 520,320 L 460,250 Z" fill="#475569" />
              <path d="M 400,20 L 920,40 L 900,180 L 780,240 L 610,140 Z" fill="#475569" />
              <path d="M 750,240 L 840,250 L 950,380 L 850,390 Z" fill="#475569" />
            </svg>

            {/* Map lines rendering */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {MAP_POINTS.map((pt) => {
                if (pt.id === 'KR') return null;
                const kr = MAP_POINTS.find(p => p.id === 'KR')!;
                return (
                  <path
                    key={`line_${pt.id}`}
                    d={`M ${pt.coords.x * 10} ${pt.coords.y * 4} Q ${(pt.coords.x + kr.coords.x) * 5} ${(pt.coords.y + kr.coords.y) * 2 - 20} ${kr.coords.x * 10} ${kr.coords.y * 4}`}
                    fill="none"
                    stroke="#4338ca"
                    strokeWidth={1.5}
                    strokeDasharray="4,6"
                    className="opacity-40 animate-pulse"
                  />
                );
              })}
            </svg>

            {/* Location buttons */}
            {MAP_POINTS.map((pt) => (
              <button
                key={pt.id}
                onClick={() => setSelectedLocation(pt)}
                style={{ left: `${pt.coords.x}%`, top: `${pt.coords.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center group cursor-pointer"
              >
                <span className="w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-150 group-hover:scale-125 transition-transform flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                </span>
                <span className="mt-1 px-2 py-0.5 text-[9px] font-bold bg-white border border-indigo-200 text-indigo-950 rounded shadow-xs">
                  {pt.countryName}
                </span>
              </button>
            ))}

            {/* No other data warning according to guidelines */}
            <div className="absolute bottom-3 left-3 bg-zinc-900/85 text-xs text-white p-3 rounded-lg max-w-sm pointer-events-none">
              <span className="font-bold block">💡 국가별 상세 데이터 정책</span>
              <p className="text-[10px] text-zinc-300 mt-0.5">
                현재 업로드 자료에는 국가/거점 정보가 없어 대한민국 HQ 기준으로만 표시하고 연동 소싱율에 준하여 입하량을 가중 분출합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Popup for details */}
      {selectedLocation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setSelectedLocation(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 text-left animate-fade">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-150">
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                국가/거점 상세
              </h4>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">거점 명칭</span>
                <span className="text-sm font-bold text-zinc-800">{selectedLocation.locationName}</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">구분</span>
                <span className="text-xs font-semibold text-zinc-700">
                  {selectedLocation.type === 'hq' ? '제품 판매 / 원재 공급' : '원자재 입고 / 공급망 검정'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">주요 품목</span>
                <p className="text-xs font-medium text-zinc-800 mt-0.5">
                  {selectedLocation.products.join(', ')}
                </p>
              </div>

              {selectedLocation.type === 'hq' ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl">
                    <span className="text-[10px] text-zinc-450 block font-bold">판매물량</span>
                    <span className="text-sm font-mono font-bold text-indigo-950 block mt-0.5">
                      {selectedLocation.salesQuantity.toLocaleString()} Mt
                    </span>
                  </div>
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl">
                    <span className="text-[10px] text-zinc-450 block font-bold">매출액 (실적)</span>
                    <span className="text-sm font-mono font-bold text-indigo-900 block mt-0.5">
                      {formatCurrencyAmount(selectedLocation.salesRevenue)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 bg-teal-50/50 rounded-xl">
                    <span className="text-[10px] text-zinc-455 block font-bold">입하 조달량</span>
                    <span className="text-sm font-mono font-bold text-teal-950 block mt-0.5">
                      {selectedLocation.purchaseQuantity.toLocaleString()} Mt
                    </span>
                  </div>
                  <div className="p-2.5 bg-teal-50/50 rounded-xl">
                    <span className="text-[10px] text-zinc-455 block font-bold">거래 추산액</span>
                    <span className="text-sm font-mono font-bold text-teal-900 block mt-0.5">
                      {formatCurrencyAmount(selectedLocation.purchaseAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-150 flex justify-end gap-2 text-xs">
              <AppButton 
                onClick={() => {
                  setSelectedLocation(null);
                  navigate('/sales-status');
                }} 
                className="text-[11px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold border-0 cursor-pointer"
              >
                판매현황 보기
              </AppButton>
              <AppButton 
                onClick={() => {
                  setSelectedLocation(null);
                  navigate('/raw-material-status');
                }} 
                className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0 cursor-pointer"
              >
                원자재수불 보기
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* EXIM API Sync Feedback Alert */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border text-xs flex justify-between items-start gap-4 transition-all animate-fade ${
          syncFeedback.type === 'success' 
            ? 'bg-teal-50/75 border-teal-200 text-teal-900' 
            : syncFeedback.type === 'warning' 
            ? 'bg-amber-50/75 border-amber-250 text-amber-900' 
            : 'bg-rose-50/75 border-rose-200 text-rose-900'
        }`}>
          <div className="flex gap-2.5">
            {syncFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
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
              {syncFeedback.type === 'warning' && (
                <div className="mt-2 text-[10.5px] p-2 bg-white/70 rounded border border-amber-150 text-amber-950 font-medium">
                  <span className="font-bold text-amber-900 block">🔑 전용 인증키(EXIM_API_KEY) 발급 방법:</span>
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-amber-900">
                    <li>
                      <a 
                        href="https://www.koreaexim.go.kr/ir/HPHKIR055M01#tab2" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline text-teal-700 font-semibold hover:text-teal-900"
                      >
                        수출입은행 Open API 신청 페이지
                      </a>
                      에 직접 접속합니다.
                    </li>
                    <li>회원 가입 후 [인증키 신청] 메뉴에서 환율 정보용 API 키 즉시 발급</li>
                    <li>이 앱의 <code className="font-mono bg-amber-100 px-1 rounded text-red-700">.env</code> 파일 혹은 플랫폼 Secrets 설정에 <code className="font-mono bg-amber-100 px-1 rounded text-red-700">EXIM_API_KEY="인증키"</code> 등록 후 실시간 고시 단가를 즉시 연계 활용할 수 있습니다.</li>
                  </ol>
                </div>
              )}
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
            <span className="font-bold text-zinc-800 block">
              기준 국책 은행 외교환율 월평균환율 연계관리
            </span>
            <span className="text-[#647067] text-[10.5px] block mt-0.5">
              {activeYear}년 {activeMonth === 'all' ? '5월 (평균)' : `${activeMonth}월`} 대USD 고시환율은 <strong className="font-mono text-indigo-700">{getCurrentExchangeRate().toLocaleString()}원</strong> 범위 기반 교환 적용됩니다.
            </span>
          </div>
        </div>

        {/* Sync panel */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-100 text-xs">
          <span className="text-[11px] font-bold text-zinc-505 font-mono">
            {activeYear}년 {activeMonth === 'all' ? '5' : activeMonth}월 환율:
          </span>
          {isEditingExchange ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customRateInput}
                onChange={(e) => setCustomRateInput(e.target.value)}
                className="w-18 px-1.5 py-0.5 text-right font-mono border border-zinc-300 rounded text-xs font-bold"
              />
              <span className="text-zinc-500 text-xs">원</span>
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
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-indigo-700">
                {getCurrentExchangeRate().toLocaleString()}원
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
            자동 가져오기 (API)
          </button>
        </div>
      </div>

      {/* Mid-section KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* 판매 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-emerald-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#008f83] block">판매 현황 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              매출 {formatCurrencyAmount(totalRevenueKRW)}
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">매출원가:</span>
                <span className="font-mono text-zinc-700">{formatCurrencyAmount(totalCostOfSalesKRW)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>매출이익:</span>
                <span className="font-mono">{formatCurrencyAmount(totalGrossProfitKRW)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 font-bold border-t border-dashed border-zinc-150 pt-2">
                <span>총 판매물량 (N/C/LC):</span>
                <span className="font-mono">{totalSalesTons.toLocaleString()} Mt</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/sales-status')}
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>판매현황 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 생산 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-indigo-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 block">생산 실적 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              총 생산 {totalProductionTons.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">생산가치 추정액:</span>
                <span className="font-mono text-zinc-800">{formatCurrencyAmount(totalProductionAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-[#647067] font-semibold">
                <span>공장가동:</span>
                <span className="text-emerald-700">정상 가동중 (100%)</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[10px] pt-2 border-t border-slate-100">
                <span>* D열 정상생산입고량 기준</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/production-status')}
              className="text-[10.5px] text-indigo-700 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>생산현황 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 제품재고 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-rose-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-700 block">제품 재고 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              기말 {productEndingQty.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-rose-600 font-bold">
                <span>재고평가손실:</span>
                <span className="font-mono">{formatCurrencyAmount(totalValuationLossKRW)}</span>
              </div>
              <div className="flex justify-between">
                <span>보정 잔액:</span>
                <span className="font-mono text-zinc-800 font-bold">
                  {formatCurrencyAmount(Math.max(0, (productEndingQty * 18_000_000) - totalValuationLossKRW))}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
                * 기말 완품 수량 및 평가충당금 집계
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/product-status')}
              className="text-[10.5px] text-rose-750 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>제품수불 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* 원자재재고 KPI */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-amber-500">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-705 block">원자재 수불 지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              기말 {rawMaterialEndingQty.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>당기입수(구매):</span>
                <span className="font-mono text-teal-800 font-bold">+{rawSourcingTons.toLocaleString()} Mt</span>
              </div>
              <div className="flex justify-between">
                <span>공정불출(소비):</span>
                <span className="font-mono text-amber-850 font-bold">-{rawIssueTons.toLocaleString()} Mt</span>
              </div>
              <div className="text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
                * BP, BM, WET, LCO 4종 원장 통합
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/raw-material-status')}
              className="text-[10.5px] text-amber-900 font-bold hover:underline flex items-center justify-between w-full cursor-pointer"
            >
              <span>원자재수불 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>
      </div>

      {/* Section 3: Summary Tables Grid */}
      <div className="space-y-6">
        {/* Table 1: 원료 수불 요약부 */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">원료 수불 요약 대장 (톤 / {currencyMode === 'USD' ? 'USD' : '백만원'})</h3>
            </div>
            <span className="text-[11px] text-[#647067] font-semibold bg-zinc-100 px-2 py-0.5 rounded">
              * 단가 단위 = {currencyMode === 'USD' ? 'USD/톤' : '백만원/톤'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-4 py-3 text-left">원료</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-teal-850">구매 수량</th>
                  <th className="px-4 py-3 text-right">구매 단가</th>
                  <th className="px-4 py-3 text-right text-amber-850">불출 수량</th>
                  <th className="px-4 py-3 text-right">불출 단가</th>
                  <th className="px-4 py-3 text-right text-indigo-900 font-bold">기말 수량</th>
                  <th className="px-4 py-3 text-right text-indigo-950 font-bold">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryRawTableData.map((row) => (
                  <tr key={row.key} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                    <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left bg-slate-50/10">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600">{row.begQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-450">{currencyMode === 'USD' ? `$${Math.round(row.begPrice * 1000).toLocaleString()}` : `₩${Math.round(row.begPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-teal-800 font-bold bg-teal-50/5">{row.recQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-450 bg-teal-50/5">{currencyMode === 'USD' ? `$${Math.round(row.recPrice * 1000).toLocaleString()}` : `₩${Math.round(row.recPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-amber-800 font-semibold bg-amber-50/5">{row.issQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-450 bg-amber-50/5">{currencyMode === 'USD' ? `$${Math.round(row.issPrice * 1000).toLocaleString()}` : `₩${Math.round(row.issPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-indigo-950 font-extrabold bg-indigo-50/5">{row.endQty.toLocaleString()} 톤</td>
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
              <h3 className="text-xs font-bold text-[#111111]">제품 수불 요약 대장 (톤 / {currencyMode === 'USD' ? 'USD' : '백만원'})</h3>
            </div>
            <span className="text-[11px] text-[#647067] font-semibold bg-zinc-100 px-2 py-0.5 rounded">
              * 단가 단위 = {currencyMode === 'USD' ? 'USD/톤' : '백만원/톤'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-4 py-3 text-left">제품구분</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-indigo-750">생산 수량</th>
                  <th className="px-4 py-3 text-right">생산 단가</th>
                  <th className="px-4 py-3 text-right text-emerald-850">판매 수량</th>
                  <th className="px-4 py-3 text-right text-emerald-950 font-bold">판매 단가</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-bold">기말 수량</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-extrabold">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryProdTableData.map((row) => (
                  <tr key={row.key} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                    <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left bg-slate-50/10">
                      {row.key} ({row.name})
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600">{row.begQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-450">{currencyMode === 'USD' ? `$${Math.round(row.begPrice * 1000).toLocaleString()}` : `₩${Math.round(row.begPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-indigo-800 font-bold bg-indigo-50/5">{row.prodQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-450 bg-indigo-50/5">{currencyMode === 'USD' ? `$${Math.round(row.prodPrice * 1000).toLocaleString()}` : `₩${Math.round(row.prodPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-emerald-800 font-bold bg-emerald-50/5">{row.salesQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-emerald-950 font-semibold bg-emerald-50/5">{currencyMode === 'USD' ? `$${Math.round(row.salesPrice * 1000).toLocaleString()}` : `₩${Math.round(row.salesPrice).toLocaleString()}`}</td>
                    
                    <td className="px-4 py-3 text-right text-[#008f83] font-extrabold bg-teal-50/5">{row.endQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-[#008f83] font-bold bg-teal-50/5">{currencyMode === 'USD' ? `$${Math.round(row.endPrice * 1000).toLocaleString()}` : `₩${Math.round(row.endPrice).toLocaleString()}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
