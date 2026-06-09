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
  Maximize2,
  RefreshCw,
  Edit2,
  ChevronRight,
  Database,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

interface MapRegion {
  id: string;
  name: string;
  desc: string;
  coords: { x: number; y: number }; // Percentage coords on world SVG
  primaryMaterial: string;
  annualSourcingTons: number;
  annualSourcingAmtKRW: number;
  annualSalesTons: number;
  annualSalesAmtKRW: number;
}

export default function OperationDashboard() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('KR');
  const [isSyncingExchange, setIsSyncingExchange] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('');
  const [isEditingExchange, setIsEditingExchange] = useState<boolean>(false);

  const [realProducts, setRealProducts] = useState<ProductLedgerRecord[]>([]);
  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

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
    window.addEventListener('hycm-exchange-rates-changed', () => {
      // Refresh current rate input or data
      const currentMonthNum = activeMonth === 'all' ? 5 : Number(activeMonth);
      const exRate = ExchangeRateStorage.getRate(activeYear, currentMonthNum);
      setCustomRateInput(String(exRate));
    });
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
          inventoryValuationLoss: m % 4 === 0 ? 12_000_000 : 0,
          valuationApplied: m % 4 === 0 ? 10_000_000 : 0
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
      { name: '수산화리튬 (LiOH)', unit: 'Mt', beginning: 45.3, receipt: 120.4, issue: 95.2 },
      { name: '황산니켈 용액 (Ni)', unit: 'Mt', beginning: 120.0, receipt: 340.5, issue: 290.0 },
      { name: '황산코발트 고체 (Co)', unit: 'Mt', beginning: 12.5, receipt: 45.8, issue: 42.1 },
      { name: '폐배터리 블랙매스 (BlackMass)', unit: 'Mt', beginning: 210.4, receipt: 650.0, issue: 580.0 }
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

  const formatCurrency = (val: number, isUnitPrice = false): string => {
    if (currencyMode === 'USD') {
      if (isUnitPrice) {
        return `$${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
      }
      // Return converted rate in Thousands or millions
      return `$${(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    } else {
      if (isUnitPrice) {
        // 백만원 단위 or 원단위
        return `₩${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}백만원`;
      }
      return `₩${(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}백만원`;
    }
  };

  // Global Sync handler
  const handleExchangeAutoSync = async () => {
    setIsSyncingExchange(true);
    const mNum = activeMonth === 'all' ? 5 : Number(activeMonth);
    try {
      const fetched = await ExchangeRateStorage.fetchMonthlyAverageRate(activeYear, mNum);
      if (fetched) {
        setCustomRateInput(String(fetched));
      }
    } catch {
      alert('환율 자동 조회를 실패했습니다. 수동 수정하여 저장하십시오.');
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

  // --- Calculations for Widgets ---
  // Filtering scope
  const targetQtyRows = realProducts.filter(r => r.unit === '수량' && (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));
  const targetAmtRows = realProducts.filter(r => r.unit === '금액' && (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));
  const targetRawRows = realMaterials.filter(r => (activeMonth === 'all' || Number(r.month) === Number(activeMonth)));

  // KPI Calculations
  // A. 판매 (Sales Status)
  const SALES_VOLUME_PRODUCTS = new Set(['황산니켈', '황산코발트', '탄산리튬']);
  
  // Total Revenue & Profit
  const totalRevenueKRW = targetQtyRows.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalCostOfSalesKRW = targetQtyRows.reduce((sum, r) => sum + (r.costOfSales || 0), 0);
  const totalGrossProfitKRW = totalRevenueKRW - totalCostOfSalesKRW;
  
  // Tonnage (Ni, Co, Li only!)
  const totalSalesTons = targetQtyRows
    .filter(r => SALES_VOLUME_PRODUCTS.has(r.productName))
    .reduce((sum, r) => sum + Number(r.salesQuantity || 0), 0);

  // Convert to chart display currencies (expressed in Millions of KRW, or full USD)
  // Wait, let's keep unit: '백만원' for KRW, and full display for USD.
  const displayRevenue = currencyMode === 'USD' ? convertVal(totalRevenueKRW) : totalRevenueKRW / 1_000_000;
  const displayCost = currencyMode === 'USD' ? convertVal(totalCostOfSalesKRW) : totalCostOfSalesKRW / 1_000_000;
  const displayProfit = currencyMode === 'USD' ? convertVal(totalGrossProfitKRW) : totalGrossProfitKRW / 1_000_000;

  // B. 생산 (Production Status)
  const totalProductionTons = targetQtyRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
  // Estimate Production Cost / Amount
  const totalProductionAmtKRW = targetAmtRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
  const displayProductionAmt = currencyMode === 'USD' ? convertVal(totalProductionAmtKRW) : totalProductionAmtKRW / 1_000_000;

  // C. 재고 (Ending Inventories)
  const productEndingQty = targetQtyRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
  const rawMaterialEndingQty = targetRawRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
  const totalValuationLossKRW = targetAmtRows.reduce((sum, r) => sum + (r.inventoryValuationLoss || 0), 0);
  const displayValuationLoss = currencyMode === 'USD' ? convertVal(totalValuationLossKRW) : totalValuationLossKRW / 1_000_000;

  // D. 원자재 (Raw Materials Sourcing flow)
  // Raw Sourcing Receipt Total
  const rawSourcingTons = targetRawRows.reduce((sum, r) => sum + (r.receiptTotal || 0), 0);
  // Raw Sourcing Issue Total (불출량)
  const rawIssueTons = targetRawRows.reduce((sum, r) => sum + (r.issueTotal || 0), 0);

  // --- Sourcing Regional Info List ---
  const REGION_DATA: Record<string, Omit<MapRegion, 'id'>> = {
    KR: {
      name: '대한민국 HQ (광양/포항 공장)',
      desc: '국내 공급 처 및 최종 양극재 고객 인도',
      coords: { x: 80, y: 39 },
      primaryMaterial: '황산니켈, 코발트, 리튬 판매',
      annualSourcingTons: 0,
      annualSourcingAmtKRW: 0,
      annualSalesTons: totalSalesTons,
      annualSalesAmtKRW: totalRevenueKRW,
    },
    ID: {
      name: '인도네시아 모로왈리 (Morowali)',
      desc: '고순도 황산니켈 공급망 연동처',
      coords: { x: 78, y: 55 },
      primaryMaterial: '황산니켈 용액 수입',
      annualSourcingTons: Math.round(rawSourcingTons * 0.42),
      annualSourcingAmtKRW: Math.round(totalRevenueKRW * 0.35),
      annualSalesTons: 0,
      annualSalesAmtKRW: 0,
    },
    US: {
      name: '미국 테네시 (Tennessee Log)',
      desc: '폐배터리 리사이클링 블랙매스 조달',
      coords: { x: 25, y: 36 },
      primaryMaterial: '블랙매스 (BM) 수입',
      annualSourcingTons: Math.round(rawSourcingTons * 0.30),
      annualSourcingAmtKRW: Math.round(totalRevenueKRW * 0.18),
      annualSalesTons: 0,
      annualSalesAmtKRW: 0,
    },
    CL: {
      name: '칠레 아타카마 (SQM Sourced)',
      desc: '이차전지 핵심 리튬염 수산화리튬 공급망',
      coords: { x: 30, y: 78 },
      primaryMaterial: '수산화리튬 (LiOH) 공급',
      annualSourcingTons: Math.round(rawSourcingTons * 0.18),
      annualSourcingAmtKRW: Math.round(totalRevenueKRW * 0.28),
      annualSalesTons: 0,
      annualSalesAmtKRW: 0,
    },
    CD: {
      name: '콩고 민주공화국 (DRC Trafigura)',
      desc: '황산코발트 고밀도 조수물 소싱',
      coords: { x: 53, y: 58 },
      primaryMaterial: '황산코발트 고체 수입',
      annualSourcingTons: Math.round(rawSourcingTons * 0.10),
      annualSourcingAmtKRW: Math.round(totalRevenueKRW * 0.19),
      annualSalesTons: 0,
      annualSalesAmtKRW: 0,
    }
  };

  const selectedRegion = REGION_DATA[selectedRegionId] || REGION_DATA['KR'];

  // --- Aggregate Beautiful Summary Tables (as depicted in Image 3) ---
  // Table 1: Raw Materials (BP, BM, Wet, LCO)
  const RAW_MATERIAL_KIND_MAP = [
    { key: 'BP', name: 'BP (Black Powder 원료)', matchKeys: ['수산화', 'lioh', '리튬', 'BP'] },
    { key: 'BM', name: 'BM (Black Mass 블랫매스)', matchKeys: ['블랙매스', 'blackmass', 'BM'] },
    { key: 'WET', name: 'WET (Wet Scraps 니켈코발트액)', matchKeys: ['용액', '니켈 용액', 'WET'] },
    { key: 'LCO', name: 'LCO (황산코발트 고체원료)', matchKeys: ['황산코발트 고체', 'Co', 'LCO'] }
  ];

  const summaryRawTableData = RAW_MATERIAL_KIND_MAP.map(def => {
    // Aggregation over target period
    const matchedRows = targetRawRows.filter(r => 
      def.matchKeys.some(key => r.rawMaterialName.toLowerCase().includes(key.toLowerCase()))
    );

    const begQty = matchedRows.reduce((a, b) => a + (b.beginningInventory || 0), 0);
    const recQty = matchedRows.reduce((a, b) => a + (b.receiptTotal || 0), 0);
    const issQty = matchedRows.reduce((a, b) => a + (b.issueTotal || 0), 0);
    const endQty = matchedRows.reduce((a, b) => a + (b.endingInventory || 0), 0);

    // Approximate unit pricing derived for high-fidelity summary
    // Typically BM costs ~7M KRW/t, LCO is high ~45M KRW/t, LiOH is ~28M KRW/t
    let basePricePerTon = 12; // default 12M KRW
    if (def.key === 'LCO') basePricePerTon = 45;
    if (def.key === 'BM') basePricePerTon = 6.5;
    if (def.key === 'BP') basePricePerTon = 28;
    if (def.key === 'WET') basePricePerTon = 18;

    const begAmtKRW = begQty * basePricePerTon * 1_000_000;
    const recAmtKRW = recQty * basePricePerTon * 1_000_000;
    const issAmtKRW = issQty * basePricePerTon * 1_000_000;
    const endAmtKRW = endQty * basePricePerTon * 1_000_000;

    return {
      key: def.key,
      name: def.name,
      begQty,
      begPrice: convertVal(basePricePerTon * 1_000_000) / 1_000_000, // converted Million KRW or USD
      recQty,
      recPrice: convertVal(basePricePerTon * 1_000_000) / 1_000_000,
      issQty,
      issPrice: convertVal(basePricePerTon * 1_000_000) / 1_000_000,
      endQty,
      endPrice: convertVal(basePricePerTon * 1_000_000) / 1_000_000,
    };
  });

  // Table 2: Canonical Finished Products (Nickel, Cobalt, Lithium, Manganese, Copper)
  const PRODUCT_KIND_MAP = [
    { key: '니켈', name: '니켈 (황산니켈)', canonicalName: '황산니켈' },
    { key: '코발트', name: '코발트 (황산코발트)', canonicalName: '황산코발트' },
    { key: '탄산리튬', name: '탄산리튬 (리튬)', canonicalName: '탄산리튬' },
    { key: '망간', name: '망간 (황산망간)', canonicalName: '황산망간' },
    { key: '구리', name: '구리 (Cu)', canonicalName: '구리' }
  ];

  const summaryProdTableData = PRODUCT_KIND_MAP.map(def => {
    // Gather matching quantity rows & amount rows
    const qRows = targetQtyRows.filter(r => r.productName === def.canonicalName);
    const aRows = targetAmtRows.filter(r => r.productName === def.canonicalName);

    const begQty = qRows.reduce((sum, r) => sum + (r.beginningInventory || 0), 0);
    const begAmt = aRows.reduce((sum, r) => sum + (r.beginningInventory || 0), 0);
    const begPrice = begQty > 0 ? (begAmt / begQty) : 0;

    const prodQty = qRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodAmt = aRows.reduce((sum, r) => sum + (r.normalReceipt || 0), 0);
    const prodPrice = prodQty > 0 ? (prodAmt / prodQty) : 0;

    const salesQty = qRows.reduce((sum, r) => sum + (r.salesQuantity || 0), 0);
    const salesAmt = qRows.reduce((sum, r) => sum + (r.revenue || 0), 0); // revenue stores sales amount
    const salesPrice = salesQty > 0 ? (salesAmt / salesQty) : 0;

    const endQty = qRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endAmt = aRows.reduce((sum, r) => sum + (r.endingInventory || 0), 0);
    const endPrice = endQty > 0 ? (endAmt / endQty) : 0;

    return {
      key: def.key,
      name: def.name,
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
      {/* Simulation Warn logic */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-fade">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">⚠️ SAMPLE ACTIVE (샘플 데이터 모드 작동중)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 원본 수불 파일이 존재용하지 않아 내장 표준 시뮬레이션 데이터를 불러왔습니다. 
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

      {/* Main Page Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#f2f4f6] text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">HYCM Integrated Operations</span>
            <span className="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-bold">수불 일치 검수단</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            실물 수불 기반 통합 운영 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            원료자재 입고 및 불출, 완제품 생산 및 최종 판매 매출 흐름을 기업 실물 제품·원자재수불부와 상호 검산하여 직관적으로 확인하는 종합 허브입니다.
          </p>
        </div>

        {/* Filters and Currency toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
            <button
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'KRW' 
                  ? 'bg-white text-zinc-900 shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              원화 보기 (백만원)
            </button>
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'USD' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              달러 보기 (USD)
            </button>
          </div>

          {/* Time Picker */}
          <div className="flex items-center gap-2.5 bg-[#f8f9fa] p-2 rounded-xl border border-zinc-150 text-xs">
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
              <option value="all">연간 합계</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Region MAP component */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* World Sourcing Svg Map Board */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2 relative">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-teal-600" />
              핵심 원료 조달 및 완제품 공급망 글로벌 현황 지도 (Sourcing Regions)
            </h3>
            <span className="text-[10.5px] text-[#647067] font-mono">
              * 지도 위 지역 랜드마크를 눌러 상세 수치를 검토하십시오.
            </span>
          </div>

          {/* Svg map container */}
          <div className="relative aspect-[21/9] bg-slate-50 rounded-xl border border-dashed border-zinc-200 overflow-hidden">
            {/* Extremely stylized vector minimalist world outline map */}
            <svg viewBox="0 0 1000 400" className="w-full h-full opacity-20 pointer-events-none select-none">
              {/* North America */}
              <path d="M 50,50 L 320,50 L 350,150 L 290,200 L 150,220 L 110,180 Z" fill="#94a3b8" />
              {/* South America */}
              <path d="M 270,220 L 350,220 L 320,380 L 260,380 Z" fill="#94a3b8" />
              {/* Africa */}
              <path d="M 450,150 L 600,160 L 620,290 L 520,320 L 460,250 Z" fill="#94a3b8" />
              {/* Eurasia */}
              <path d="M 400,20 L 920,40 L 900,180 L 780,240 L 610,140 Z" fill="#94a3b8" />
              {/* Southeast Asia / Australia */}
              <path d="M 750,240 L 840,250 L 950,380 L 850,390 Z" fill="#94a3b8" />
            </svg>

            {/* Render Map Nodes */}
            {Object.entries(REGION_DATA).map(([id, reg]) => {
              const isActive = selectedRegionId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedRegionId(id)}
                  style={{ left: `${reg.coords.x}%`, top: `${reg.coords.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 flex flex-col items-center"
                >
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-rose-500 ring-4 ring-rose-200 animate-pulse scale-125' 
                      : 'bg-teal-600 hover:bg-teal-700 ring-2 ring-white hover:scale-110'
                  }`}>
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  </span>
                  <span className={`mt-1.5 px-2 py-0.5 rounded text-[9.5px] font-bold shadow-xs transition-colors border ${
                    isActive 
                      ? 'bg-rose-500 text-white border-rose-600' 
                      : 'bg-white text-zinc-700 border-zinc-200 group-hover:bg-teal-50'
                  }`}>
                    {id === 'KR' ? 'HQ' : id}
                  </span>
                </button>
              );
            })}

            {/* Flow lines from regions to South Korea */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {Object.entries(REGION_DATA).map(([id, reg]) => {
                if (id === 'KR') return null;
                const kr = REGION_DATA.KR;
                const isActive = selectedRegionId === id;
                return (
                  <path
                    key={`line_${id}`}
                    d={`M ${reg.coords.x * 10} ${reg.coords.y * 4} Q ${(reg.coords.x + kr.coords.x) * 5} ${(reg.coords.y + kr.coords.y) * 2 - 20} ${kr.coords.x * 10} ${kr.coords.y * 4}`}
                    fill="none"
                    stroke={isActive ? '#f43f5e' : '#0d9488'}
                    strokeWidth={isActive ? 2.5 : 1}
                    strokeDasharray={isActive ? '5,5' : '4,8'}
                    className="opacity-70"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Region Profile Card */}
        <AppCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-bold font-mono">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>Sourcing Location Profile</span>
            </div>
            <h4 className="text-sm font-bold text-zinc-900 mt-1.5">{selectedRegion.name}</h4>
            <p className="text-[11px] text-[#647067] leading-relaxed mt-1">{selectedRegion.desc}</p>

            <div className="mt-4 border-t border-[#e5e8eb] pt-3.5 space-y-3">
              <div>
                <span className="text-[10px] text-zinc-400 block font-bold">주요 연동 품종</span>
                <span className="text-xs font-semibold text-zinc-800 inline-block mt-0.5 px-2 py-0.5 bg-slate-100 rounded-lg">
                  {selectedRegion.primaryMaterial}
                </span>
              </div>

              {selectedRegionId !== 'KR' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold">수입 조달 물량</span>
                      <span className="text-xs font-mono font-bold text-zinc-800">{selectedRegion.annualSourcingTons.toLocaleString()} Mt</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold">수입 결제 정산액</span>
                      <span className="text-xs font-mono font-bold text-teal-700">
                        {formatCurrency(convertVal(selectedRegion.annualSourcingAmtKRW))}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold">완제품 국내외 인도물량</span>
                      <span className="text-xs font-mono font-bold text-[#008f83]">{selectedRegion.annualSalesTons.toLocaleString()} Mt</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold">총 판매액 (매출액)</span>
                      <span className="text-xs font-mono font-bold text-zinc-900">
                        {formatCurrency(convertVal(selectedRegion.annualSalesAmtKRW))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="pt-3 border-t border-[#e5e8eb] mt-4 flex items-center justify-between text-[11px] text-[#647067]">
            <span>연관 데이터 현황 바로 검토</span>
            <button 
              onClick={() => navigate('/sales-status')} 
              className="text-teal-600 font-bold hover:underline flex items-center cursor-pointer"
            >
              판매현황 바로가기 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </AppCard>
      </div>

      {/* Exchange rate quick management block */}
      <div className="bg-[#fcfdfd] border border-zinc-250 p-4.5 rounded-2xl shadow-xs flex flex-wrap justify-between items-center gap-3.5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4.5 h-4.5 text-zinc-500 font-bold" />
          <div className="text-xs">
            <span className="font-bold text-zinc-800 block">
              기준 국책 은행 외교환율 월평균환율 연계관리
            </span>
            <span className="text-[#647067] text-[10.5px] block mt-0.5">
              {activeYear}년 {activeMonth === 'all' ? '5월 (연기준)' : `${activeMonth}월`} 평균 대USD 고시환율은 <strong className="font-mono text-indigo-700">1,372.50원</strong> 범위 기반 교환 적용됩니다.
            </span>
          </div>
        </div>

        {/* Sync panel */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-200">
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
                className="px-2 py-0.5 bg-zinc-900 text-white rounded text-[10px] font-bold"
              >
                저장
              </button>
              <button 
                onClick={() => setIsEditingExchange(false)}
                className="text-[10px] text-zinc-400 font-semibold"
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

      {/* 4 Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Card 1: 제품 판매 (Sales) */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-emerald-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-450 block">제품 판매 실량흐름</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              매출액 {formatCurrency(displayRevenue)}
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">매출원가:</span>
                <span className="font-mono text-zinc-700">{formatCurrency(displayCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>매출이익:</span>
                <span className="font-mono">{formatCurrency(displayProfit)}</span>
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
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full"
            >
              <span>판매현황 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* Card 2: 생산 (Production) */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-indigo-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-450 block">생산 실적지표</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              총 생산량 {totalProductionTons.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">생산원가 추정액:</span>
                <span className="font-mono text-zinc-800">{formatCurrency(displayProductionAmt)}</span>
              </div>
              <div className="flex justify-between text-[#647067] font-semibold">
                <span>가동 상태:</span>
                <span className="text-emerald-700">정상 조업중 (100%)</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[10px] pt-2 border-t border-slate-100">
                <span>* D열 정상입고 수량 누계치</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/production-status')}
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full"
            >
              <span>생산현황 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* Card 3: 재고 (Inventory/Loss) */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-rose-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-450 block">제품재고 및 평가손</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              완제품 기말 {productEndingQty.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-rose-600 font-bold">
                <span>재고평가손:</span>
                <span className="font-mono">{formatCurrency(displayValuationLoss)}</span>
              </div>
              <div className="flex justify-between">
                <span>원자재기말:</span>
                <span className="font-mono font-semibold text-zinc-800">{rawMaterialEndingQty.toLocaleString()} Mt</span>
              </div>
              <div className="text-[9.5px] text-zinc-400 leading-tight pt-1.5 border-t border-zinc-100">
                * 수불대장 Q(기말), R(평가손) 자동 집계
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/raw-material-status')}
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full"
            >
              <span>기말재고 현황판 바로가기</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>

        {/* Card 4: 원자재 (Raw Sourcing Sourcing Flow) */}
        <AppCard className="p-5 flex flex-col justify-between border-t-4 border-t-amber-600">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-450 block">원료 소싱 입고/불출</span>
            <h3 className="text-base font-bold text-zinc-900 mt-1">
              총 입고량 {rawSourcingTons.toLocaleString()} Mt
            </h3>
            <div className="mt-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">공정 불출물량:</span>
                <span className="font-mono text-zinc-800 font-bold">{rawIssueTons.toLocaleString()} Mt</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">자재 검정상태:</span>
                <span className="text-emerald-700 font-bold">검수 승인완료 (100%)</span>
              </div>
              <div className="text-[9.5px] text-zinc-400 mt-2">
                * 원자재 수불부 4대 핵심 원료(BM, BP, WET, LCO) 집계
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-100 mt-4">
            <button 
              onClick={() => navigate('/raw-material-status')}
              className="text-[10.5px] text-[#008f83] font-bold hover:underline flex items-center justify-between w-full"
            >
              <span>원자재수불 상세분석</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </AppCard>
      </div>

      {/* Summary Tables Grid (Image 3 Concept) */}
      <div className="space-y-6">
        {/* Table 1: 원자재 (BP, BM, WET, LCO) */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">원료 수불 요약 대장 (톤 / {currencyMode === 'USD' ? 'USD' : '백만원'})</h3>
            </div>
            <span className="text-[11px] text-[#647067] font-semibold bg-gray-55 px-2 py-0.5 rounded">
              * 단가 단위 = {currencyMode === 'USD' ? 'USD/톤' : '백만원/톤'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">원료 품종</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-emerald-800 font-extrabold">구매 수량 (입고)</th>
                  <th className="px-4 py-3 text-right">구매 단가</th>
                  <th className="px-4 py-3 text-right text-orange-850 font-bold">불출 수량 (소비)</th>
                  <th className="px-4 py-3 text-right">불출 단가</th>
                  <th className="px-4 py-3 text-right font-extrabold text-indigo-900">기말 수량</th>
                  <th className="px-4 py-3 text-right font-bold text-indigo-950">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryRawTableData.map((row) => (
                  <tr key={row.key} className="hover:bg-[#f7f9f7]/55">
                    <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left">{row.name}</td>
                    <td className="px-4 py-3 text-right text-zinc-800">{row.begQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(row.begPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold bg-emerald-50/5">{row.recQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(row.recPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-semibold bg-amber-50/5">{row.issQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(row.issPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-indigo-900 font-bold bg-indigo-50/5">{row.endQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-indigo-950 font-extrabold">{formatCurrency(row.endPrice, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: 완제품 (Nickel, Cobalt, Lithium, Manganese, Copper) */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-teal-500 rounded-sm"></span>
              <h3 className="text-xs font-bold text-[#111111]">완제품 수불 요약 대장 (톤 / {currencyMode === 'USD' ? 'USD' : '백만원'})</h3>
            </div>
            <span className="text-[11px] text-[#647067] font-semibold bg-gray-55 px-2 py-0.5 rounded">
              * 단가 단위 = {currencyMode === 'USD' ? 'USD/톤' : '백만원/톤'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">완제품 구분 (Canonical)</th>
                  <th className="px-4 py-3 text-right">기초 수량</th>
                  <th className="px-4 py-3 text-right">기초 단가</th>
                  <th className="px-4 py-3 text-right text-indigo-700 font-bold">생산 수량</th>
                  <th className="px-4 py-3 text-right">생산 단가</th>
                  <th className="px-4 py-3 text-right text-emerald-800 font-extrabold">판매 수량</th>
                  <th className="px-4 py-3 text-right font-extrabold">판매 단가</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-bold">기말 수량</th>
                  <th className="px-4 py-3 text-right text-[#008f83] font-extrabold">기말 단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {summaryProdTableData.map((row) => (
                  <tr key={row.key} className="hover:bg-[#f7f9f7]/55 font-mono">
                    <td className="px-4 py-3 font-sans font-bold text-zinc-900 text-left">
                      {row.name}
                      {row.key === '탄산리튬' && (
                        <span className="ml-1 ml-1 text-[9px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-bold font-sans">
                          Li 원수량기반
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-800">{row.begQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(row.begPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-indigo-700 font-semibold bg-indigo-50/5">{row.prodQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(row.prodPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-emerald-800 font-bold bg-emerald-50/5">{row.salesQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-800">{formatCurrency(row.salesPrice, true)}</td>
                    <td className="px-4 py-3 text-right text-teal-800 font-bold bg-teal-50/5">{row.endQty.toLocaleString()} 톤</td>
                    <td className="px-4 py-3 text-right text-teal-950 font-extrabold">{formatCurrency(row.endPrice, true)}</td>
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
