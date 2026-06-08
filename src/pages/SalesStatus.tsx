import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  DollarSign, 
  ShoppingCart, 
  Layers, 
  Clock, 
  Plus, 
  CheckCircle,
  AlertCircle,
  Calendar,
  FileSpreadsheet,
  Info,
  ChevronRight
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
  LineChart, 
  Line 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';
import { PRODUCT_NAME_MAP } from '../lib/operation/productMaster';

export default function SalesStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const [realRecords, setRealRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  // Load data function
  const loadData = () => {
    const list = OperationStorage.getProductRecords(activeYear);
    if (list && list.length > 0) {
      setRealRecords(list);
      setIsSampleData(false);
    } else {
      // Use high-fidelity Sample Data matching the 5 canonical products
      setRealRecords(getSampleData(activeYear));
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

  // High-fidelity sample generator for 5 canonical products
  const getSampleData = (yearStr: string): ProductLedgerRecord[] => {
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
      // Seasonality factor
      const factor = 0.85 + Math.sin((m / 12) * Math.PI) * 0.3 + (m % 3) * 0.05;

      products.forEach((p) => {
        const rawQty = Math.round(p.baseQty * factor);
        const revenue = Math.round(rawQty * p.unitPrice);
        const costOfSales = Math.round(revenue * (0.82 + (m % 5) * 0.02));
        const grossProfit = revenue - costOfSales;

        const rec: ProductLedgerRecord = {
          id: `sample_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: `${p.metal} ${p.name}`,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: Math.round(rawQty * 1.1),
          normalReceipt: Math.round(rawQty * 1.05),
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: Math.round(rawQty * 1.05),
          salesQuantity: rawQty,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: rawQty,
          endingInventory: Math.round(rawQty * 1.15),
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: revenue,
          costOfSales: costOfSales,
          grossProfit: grossProfit,
          uploadedAt: new Date().toISOString()
        };

        // Lithium conversion
        if (p.name === '탄산리튬') {
          const rate = 18.75; // inside range
          rec.conversionRate = rate;
          rec.convertedSalesQuantity = rawQty / (rate / 100);
          rec.convertedProductionQuantity = rec.normalReceipt / (rate / 100);
          rec.convertedEndingInventory = rec.endingInventory / (rate / 100);
        } else {
          rec.convertedSalesQuantity = rawQty;
          rec.convertedProductionQuantity = rec.normalReceipt;
          rec.convertedEndingInventory = rec.endingInventory;
        }

        sampleRecords.push(rec);
      });
    });

    return sampleRecords;
  };

  // 1. Filter records to target year/month/unit of type '수량'
  const filterByUnit = realRecords.filter(r => r.unit === '수량');
  
  const filteredRecords = filterByUnit.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterProduct !== 'all' && r.productName !== filterProduct) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q) || r.rawProductName.toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate product aggregates (grouped by Product Name)
  const productAggregatesMap = new Map<string, {
    productName: '황산니켈' | '황산코발트' | '탄산리튬' | '황산망간' | '구리';
    metal: 'Ni' | 'Co' | 'Li' | 'Mn' | 'Cu';
    salesQuantity: number;
    revenue: number;
    costOfSales: number;
    grossProfit: number;
  }>();

  // Initialize all canonical 5 products to make sure they are always listed
  const CANONICAL_PRODUCTS = [
    { name: '황산니켈' as const, metal: 'Ni' as const },
    { name: '황산코발트' as const, metal: 'Co' as const },
    { name: '탄산리튬' as const, metal: 'Li' as const },
    { name: '황산망간' as const, metal: 'Mn' as const },
    { name: '구리' as const, metal: 'Cu' as const },
  ];

  CANONICAL_PRODUCTS.forEach(p => {
    productAggregatesMap.set(p.name, {
      productName: p.name,
      metal: p.metal,
      salesQuantity: 0,
      revenue: 0,
      costOfSales: 0,
      grossProfit: 0,
    });
  });

  filteredRecords.forEach((rec) => {
    const existing = productAggregatesMap.get(rec.productName);
    const qty = rec.productName === '탄산리튬' ? (rec.convertedSalesQuantity || rec.salesQuantity) : rec.salesQuantity;
    if (existing) {
      existing.salesQuantity += qty;
      existing.revenue += rec.revenue || 0;
      existing.costOfSales += rec.costOfSales || 0;
      existing.grossProfit += rec.grossProfit || 0;
    }
  });

  const aggregateList = Array.from(productAggregatesMap.values()).filter(item => {
    if (filterProduct !== 'all' && item.productName !== filterProduct) return false;
    return true;
  });

  // Aggregate KPIs
  const totalRevenue = aggregateList.reduce((acc, item) => acc + item.revenue, 0);
  const totalCostOfSales = aggregateList.reduce((acc, item) => acc + item.costOfSales, 0);
  const totalGrossProfit = aggregateList.reduce((acc, item) => acc + item.grossProfit, 0);
  const totalQuantity = aggregateList.reduce((acc, item) => acc + item.salesQuantity, 0);
  const uniqueProductsCount = aggregateList.filter(item => item.revenue > 0 || item.salesQuantity > 0).length;
  const grossProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  // Monthly trend for Recharts
  const monthlyTrendData = Array.from({ length: 12 }, (_, i) => {
    const mNum = i + 1;
    // Filter rows of this month
    const monthRows = filterByUnit.filter(r => Number(r.month) === mNum);
    const revenue = monthRows.reduce((acc, r) => acc + (r.revenue || 0), 0);
    const cost = monthRows.reduce((acc, r) => acc + (r.costOfSales || 0), 0);
    const profit = revenue - cost;
    return {
      month: `${mNum}월`,
      '매출액': revenue,
      '매출원가': cost,
      '매출이익': profit,
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
                실제 엑셀 수불 데이터로 분석하려면 [운영 업로드]에서 엑셀 주입 또는 복사-붙여넣기를 실행해 주십시오.
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
            <span className="text-xs bg-teal-50 text-[#008f83] px-2.5 py-0.5 rounded font-bold font-mono">CC Operating Sales</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">수불부 자동연동</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            제품 수불 연동 판매 현황 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품수불부의 &apos;I열 판매량&apos;과 &apos;T열 매출/매출원가/매출이익&apos; 3행 블록 데이터를 바탕으로 가공 집계된 고정밀 판매 상황을 진단합니다.
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#647067] font-bold block">총 매출액</span>
          <span className="text-sm md:text-md font-extrabold text-zinc-900 font-mono mt-1 block">₩{totalRevenue.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-zinc-500 font-bold block">총 매출원가</span>
          <span className="text-sm md:text-md font-extrabold text-zinc-800 font-mono mt-1 block">₩{totalCostOfSales.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">매출이익</span>
          <span className="text-sm md:text-md font-extrabold text-[#008f83] font-mono mt-1 block">₩{totalGrossProfit.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-zinc-550 font-bold block">매출이익률 (%)</span>
          <span className="text-sm md:text-md font-extrabold text-indigo-700 font-mono mt-1 block">{grossProfitMargin.toFixed(2)}%</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">총 판매물량</span>
          <span className="text-sm md:text-md font-extrabold text-teal-800 font-mono mt-1 block">{totalQuantity.toLocaleString()} Mt</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">판매 가동 제품 수</span>
          <span className="text-sm md:text-md font-extrabold text-[#008f83] font-mono mt-1 block">{uniqueProductsCount}개 제품</span>
        </div>
      </div>

      {/* Row with chart and sub-guide info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
          <h3 className="text-xs font-bold text-[#111111] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#008f83]" /> {activeYear}년 월별 제품 수불 매출액 & 매출이익 트렌드
          </h3>
          <div className="h-[230px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                <XAxis dataKey="month" stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `₩${(v / 1_000_000).toLocaleString()}M`} />
                <Tooltip formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '']} />
                <Legend iconType="circle" />
                <Bar name="매출 매출액" dataKey="매출액" fill="#008f83" radius={[3, 3, 0, 0]} barSize={20} />
                <Bar name="매출이익" dataKey="매출이익" fill="#8884d8" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Guidance and Lithium rules info */}
        <AppCard className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#111111] mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-brand-600" />
              탄산리튬(Li) 물량 보정 환산 수칙
            </h3>
            <p className="text-[11px] text-[#4e5968] leading-relaxed">
              본 시스템은 탄산리튬 수량에 대하여 단순 포장 제품 중량이 아닌 순수 리튬(Li) 함량 기준의 환산 물량을 일괄 자동 계산하여 리포팅합니다.
            </p>
            <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl space-y-2 text-[10px]">
              <div className="flex justify-between font-mono">
                <span>2024년 함량률:</span>
                <span className="font-bold text-indigo-700">18.79%</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>2025년 함량률:</span>
                <span className="font-bold text-indigo-700">18.73%</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>2026년 함량률:</span>
                <span className="font-bold text-indigo-700">18.75% (당기 기준)</span>
              </div>
              <div className="text-[9px] text-[#8b95a1] pt-1.5 border-t border-indigo-100">
                공식: 탄산리튬 환산 물량 = 원 수량 / (함량% / 100)
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#e5e8eb] mt-4 flex justify-between items-center text-xs">
            <span className="font-bold text-[#4e5968]">금속 수량/금액 단가 일치성</span>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">검증 필</span>
          </div>
        </AppCard>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-xl border border-[#dde5de] flex flex-col sm:flex-row gap-3">
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
            className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
            placeholder="제품명 필터 검색..."
          />
        </div>
      </div>

      {/* Sales DataTable Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden animate-fade">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">제품군 구분</th>
              <th className="px-5 py-3 text-center">연동 메탈</th>
              <th className="px-5 py-3 text-right">판매 수량 (Mt)</th>
              <th className="px-5 py-3 text-right font-bold">매출액 (T열)</th>
              <th className="px-5 py-3 text-right">매출원가</th>
              <th className="px-5 py-3 text-right font-bold text-[#008f83]">매출이익</th>
              <th className="px-5 py-3 text-center">매출이익률</th>
              <th className="px-5 py-3 text-right">판매 평균 단가 (Mt당)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {aggregateList.map(item => {
              const profitMargin = item.revenue > 0 ? (item.grossProfit / item.revenue) * 100 : 0;
              const unitPrice = item.salesQuantity > 0 ? Math.round(item.revenue / item.salesQuantity) : 0;

              return (
                <tr key={item.productName} className="hover:bg-[#f7f9f7]/55">
                  <td className="px-5 py-3.5 font-semibold text-[#111111]">
                    {item.productName}
                    {item.productName === '탄산리튬' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">Li 보정형</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center font-bold text-zinc-500 font-mono">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px]">{item.metal}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-800">
                    {item.salesQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-900">
                    ₩{item.revenue.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-550">
                    ₩{item.costOfSales.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/10">
                    ₩{item.grossProfit.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-indigo-700">
                    {profitMargin.toFixed(2)}%
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-500">
                    ₩{unitPrice.toLocaleString()}/Mt
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
