import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';

export default function ProductionStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const [realRecords, setRealRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  const loadData = () => {
    const list = OperationStorage.getProductRecords(activeYear);
    if (list && list.length > 0) {
      setRealRecords(list);
      setIsSampleData(false);
    } else {
      // Use sample data matching the 5 canonical products for production
      setRealRecords(getSampleProductionData(activeYear));
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

  // Production sample data generator
  const getSampleProductionData = (yearStr: string): ProductLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const sampleRecords: ProductLedgerRecord[] = [];

    const products = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 130, unitPrice: 24_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 50, unitPrice: 58_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 90, unitPrice: 38_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 160, unitPrice: 12_000_000 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 320, unitPrice: 9_500_000 },
    ];

    months.forEach((m) => {
      const factor = 0.9 + Math.sin((m / 6) * Math.PI) * 0.15 + (m % 4) * 0.03;

      products.forEach((p) => {
        const prodQty = Math.round(p.baseQty * factor);
        const prodAmt = Math.round(prodQty * p.unitPrice * 0.85); // approximate production cost

        // Create qty record
        const recQty: ProductLedgerRecord = {
          id: `sample_prod_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: `${p.metal} ${p.name}`,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: Math.round(prodQty * p.unitPrice),
          normalReceipt: prodQty, // D열 정상입고 = 생산량
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: prodQty,
          salesQuantity: Math.round(prodQty * 0.95),
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: Math.round(prodQty * 0.95),
          endingInventory: Math.round(prodQty * 1.1),
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: prodQty * p.unitPrice,
          costOfSales: prodQty * p.unitPrice * 0.8,
          grossProfit: prodQty * p.unitPrice * 0.2,
          uploadedAt: new Date().toISOString()
        };

        // Lithium conversion
        if (p.name === '탄산리튬') {
          const rate = 18.75;
          recQty.conversionRate = rate;
          recQty.convertedSalesQuantity = recQty.salesQuantity / (rate / 100);
          recQty.convertedProductionQuantity = prodQty / (rate / 100);
          recQty.convertedEndingInventory = recQty.endingInventory / (rate / 100);
        } else {
          recQty.convertedSalesQuantity = recQty.salesQuantity;
          recQty.convertedProductionQuantity = prodQty;
          recQty.convertedEndingInventory = recQty.endingInventory;
        }

        // Create amt record
        const recAmt: ProductLedgerRecord = {
          ...recQty,
          id: `sample_prod_${yearStr}_${m}_${p.name}_금액`,
          unit: '금액',
          normalReceipt: prodAmt,
        };

        sampleRecords.push(recQty);
        sampleRecords.push(recAmt);
      });
    });

    return sampleRecords;
  };

  // 1. Separate unit types
  const qtyRecords = realRecords.filter(r => r.unit === '수량');
  const amtRecords = realRecords.filter(r => r.unit === '금액');

  // Filter records based on selected dropdown month/search
  const filteredQtyRecords = qtyRecords.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterProduct !== 'all' && r.productName !== filterProduct) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q) || r.rawProductName.toLowerCase().includes(q);
    }
    return true;
  });

  // Aggregate by canonical product
  const CANONICAL_PRODUCTS = [
    { name: '황산니켈' as const, metal: 'Ni' as const },
    { name: '황산코발트' as const, metal: 'Co' as const },
    { name: '탄산리튬' as const, metal: 'Li' as const },
    { name: '황산망간' as const, metal: 'Mn' as const },
    { name: '구리' as const, metal: 'Cu' as const },
  ];

  const productAggregatesMap = new Map<string, {
    productName: '황산니켈' | '황산코발트' | '탄산리튬' | '황산망간' | '구리';
    metal: 'Ni' | 'Co' | 'Li' | 'Mn' | 'Cu';
    productionQty: number;      // normalReceipt on '수량'
    convertedQty: number;       // convertedProductionQuantity on '수량'
    productionAmt: number;      // normalReceipt on '금액'
  }>();

  CANONICAL_PRODUCTS.forEach(p => {
    productAggregatesMap.set(p.name, {
      productName: p.name,
      metal: p.metal,
      productionQty: 0,
      convertedQty: 0,
      productionAmt: 0,
    });
  });

  // Calculate aggregates for filtered period
  filteredQtyRecords.forEach(qRec => {
    const existing = productAggregatesMap.get(qRec.productName);
    if (existing) {
      existing.productionQty += qRec.normalReceipt || 0;
      existing.convertedQty += qRec.convertedProductionQuantity || qRec.normalReceipt || 0;
      
      // Look up corresponding amount row to sum production amount
      const matchingAmt = amtRecords.find(a => a.productName === qRec.productName && Number(a.month) === Number(qRec.month));
      if (matchingAmt) {
        existing.productionAmt += matchingAmt.normalReceipt || 0;
      }
    }
  });

  const aggregateList = Array.from(productAggregatesMap.values()).filter(item => {
    if (filterProduct !== 'all' && item.productName !== filterProduct) return false;
    return true;
  });

  // KPI Calculations
  const totalProduction = aggregateList.reduce((acc, item) => acc + item.productionQty, 0);
  const totalConvertedProduction = aggregateList.reduce((acc, item) => acc + item.convertedQty, 0);
  const totalProductionAmtSum = aggregateList.reduce((acc, item) => acc + item.productionAmt, 0);

  // Carbonate Lithium Converted KPI
  const lithiumAgg = productAggregatesMap.get('탄산리튬');
  const lithiumConvertedProd = lithiumAgg ? lithiumAgg.convertedQty : 0;

  // Month-on-month (MoM) calculation
  let MoMText = '이동 평균 유지';
  let MoMValue = 0;
  let isMoMUp = true;

  if (activeMonth !== 'all') {
    const prevMonth = Number(activeMonth) - 1;
    const currentMonthQty = qtyRecords.filter(r => Number(r.month) === Number(activeMonth));
    const currentSum = currentMonthQty.reduce((acc, r) => acc + (r.normalReceipt || 0), 0);

    if (prevMonth >= 1) {
      const prevMonthQty = qtyRecords.filter(r => Number(r.month) === prevMonth);
      const prevSum = prevMonthQty.reduce((acc, r) => acc + (r.normalReceipt || 0), 0);
      
      if (prevSum > 0) {
        MoMValue = ((currentSum - prevSum) / prevSum) * 100;
        isMoMUp = MoMValue >= 0;
        MoMText = `${MoMValue >= 0 ? '전월 대비 증가' : '전월 대비 감소'} (${Math.abs(MoMValue).toFixed(1)}%)`;
      } else {
        MoMText = '직전월 데이터 없음';
      }
    } else {
      MoMText = '연초 기준점 (1월)';
    }
  } else {
    MoMText = '연간 안정 운영상태';
  }

  // Monthly trend for Recharts Area
  const monthlyTrendData = Array.from({ length: 12 }, (_, i) => {
    const mNum = i + 1;
    const monthQtyRows = qtyRecords.filter(r => Number(r.month) === mNum);
    const normalProd = monthQtyRows.reduce((acc, r) => acc + (r.normalReceipt || 0), 0);
    const convertedProd = monthQtyRows.reduce((acc, r) => acc + (r.convertedProductionQuantity || r.normalReceipt || 0), 0);

    return {
      month: `${mNum}월`,
      '일반 생산량': normalProd,
      'Li 보정 환산량': convertedProd
    };
  });

  return (
    <div className="space-y-6">
      {/* Banner / Warning indicator if viewing sample data */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs animate-fade">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">⚠️ SAMPLE DATA (샘플 시뮬레이션 활용중)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 제품수불부 원본 자료가 없으므로 화면 설명용 샘플 데이터가 가동 중입니다. 
                실제 생산수불을 반영하려면 [운영 업로드]에서 엑셀 수불부를 업로드해 주십시오.
              </p>
            </div>
          </div>
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-0 shrink-0"
          >
            운영 수불부 업로드로 이동
            <ChevronRight className="w-3.5 h-3.5 ml-1 inline" />
          </AppButton>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-zinc-100 text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">Factory Floor</span>
            <span className="text-xs bg-teal-50 text-[#008f83] px-2 py-0.5 rounded font-bold">수불부 자동 생산량</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            제품 수불 연동 생산 실적 판넬
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품수불부의 &apos;D열 정상입고&apos; 열을 기준으로 집계된 당기 정품 생산 실량 및 LCO/NCM 보정 단위의 환산 실적을 진단합니다.
          </p>
        </div>

        {/* Global Year/Month Filters */}
        <div className="flex items-center gap-2.5 bg-[#f8f9fa] p-2 rounded-xl border border-zinc-150">
          <Calendar className="w-4 h-4 text-zinc-400 font-bold" />
          <select
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 cursor-pointer"
          >
            {['2024', '2025', '2026', '2027', '2028'].map(yr => (
              <option key={yr} value={yr}>{yr}년</option>
            ))}
          </select>

          <span className="text-zinc-300">|</span>

          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 cursor-pointer"
          >
            <option value="all">연간 전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={String(m)}>{m}월 합산</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-[#647067] font-bold block">총 생산량 (D열 정상입고)</span>
          <span className="text-xl font-bold text-zinc-900 font-mono mt-1 block">{totalProduction.toLocaleString()} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-[#008f83] font-bold block font-sans">보정 환산 생산 총중량</span>
          <span className="text-xl font-bold text-[#008f83] font-mono mt-1 block">{totalConvertedProduction.toLocaleString()} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-zinc-500 font-bold block">탄산리튬 환산 생산실적</span>
          <span className="text-xl font-bold text-purple-700 font-mono mt-1 block">{lithiumConvertedProd.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mt</span>
        </div>
        <div className={`p-5 rounded-xl shadow-xs border ${
          activeMonth !== 'all' && MoMValue < 0 
            ? 'bg-rose-50/50 border-rose-150' 
            : 'bg-emerald-50/50 border-emerald-150'
        }`}>
          <span className="text-xs text-[#008f83] font-bold block">전월 대비 생산 증감 (MoM)</span>
          <div className="flex items-center gap-1.5 mt-1">
            {activeMonth !== 'all' && MoMValue !== 0 ? (
              isMoMUp ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0 font-bold" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0 font-bold" />
              )
            ) : null}
            <span className={`text-md font-bold font-mono ${
              activeMonth !== 'all' && MoMValue < 0 ? 'text-rose-700' : 'text-emerald-800'
            }`}>
              {MoMText}
            </span>
          </div>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-xs font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#008f83]" /> {activeYear}년 제품 수불 월별 원 생산량 vs Li 보정 환산 생산량 추이
        </h3>
        <div className="h-[210px] w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
              <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} Mt`, '']} />
              <Legend iconType="circle" />
              <Area type="monotone" name="일반 생산량 (수량)" dataKey="일반 생산량" stroke="#008f83" fill="#e2ede3" strokeWidth={2} />
              <Area type="monotone" name="Li 보정 환산 생산량" dataKey="Li 보정 환산량" stroke="#3182ce" fill="#ebf8ff" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Selector */}
      <div className="bg-white p-4.5 rounded-xl border border-[#dde5de] flex items-center gap-3">
        <span className="text-xs font-bold text-[#333333] font-sans">조회 제품 필터:</span>
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-60"
        >
          <option value="all">전체 Canonical 제품군 [All]</option>
          <option value="황산니켈">황산니켈 (Ni)</option>
          <option value="황산코발트">황산코발트 (Co)</option>
          <option value="탄산리튬">탄산리튬 (Li)</option>
          <option value="황산망간">황산망간 (Mn)</option>
          <option value="구리">구리 (Cu)</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
            placeholder="제품명 원본 텍스트 매치 검색..."
          />
        </div>
      </div>

      {/* Production DataTable Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">정품 생산 품목명</th>
              <th className="px-5 py-3 text-center">연동 메탈</th>
              <th className="px-5 py-3 text-right font-bold">생산 실물량 (Mt)</th>
              <th className="px-5 py-3 text-right">보정 환산 생산량 (Mt)</th>
              <th className="px-5 py-3 text-right">생산금액 (D열 금액)</th>
              <th className="px-5 py-3 text-right">평균 생산 기회단가 / Mt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {aggregateList.map((row) => {
              const avgPrice = row.productionQty > 0 ? Math.round(row.productionAmt / row.productionQty) : 0;
              return (
                <tr key={row.productName} className="hover:bg-[#f7f9f7]/55">
                  <td className="px-5 py-3.5 font-bold text-zinc-900">
                    {row.productName}
                    {row.productName === '탄산리튬' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-55 text-indigo-700 rounded text-[9px] font-bold">Li 보정형</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-zinc-500 font-mono">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px]">{row.metal}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-800">{row.productionQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt</td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-700 font-bold bg-indigo-50/5">{row.convertedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt</td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-550">₩{row.productionAmt.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-400">₩{avgPrice.toLocaleString()}/Mt</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
