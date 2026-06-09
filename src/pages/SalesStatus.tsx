import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  Calendar, 
  Info,
  DollarSign,
  Briefcase,
  Layers,
  ArrowUpRight 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

export default function SalesStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const [realRecords, setRealRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  // Load Real or Sample Data
  const loadData = () => {
    const list = OperationStorage.getProductRecords(activeYear);
    if (list && list.length > 0) {
      setRealRecords(list);
      setIsSampleData(false);
    } else {
      setRealRecords(getSeedRecords2026(activeYear));
      setIsSampleData(true);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('operation-ledger-changed', loadData);
    return () => {
      window.removeEventListener('operation-ledger-changed', loadData);
    };
  }, [activeYear]);

  // Seed Data Generator centered on Products
  const getSeedRecords2026 = (yearStr: string): ProductLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const result: ProductLedgerRecord[] = [];

    const productBases = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 110, unitPrice: 24_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 40, unitPrice: 58_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 80, unitPrice: 38_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 140, unitPrice: 12_000_000 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 280, unitPrice: 9_500_000 }
    ];

    months.forEach(m => {
      const factor = 0.9 + Math.sin((m / 12) * Math.PI) * 0.25;
      productBases.forEach(p => {
        const qty = Math.round(p.baseQty * factor);
        const revenue = qty * p.unitPrice;
        const costOfSales = Math.round(revenue * 0.81);
        const grossProfit = revenue - costOfSales;

        const recQty: ProductLedgerRecord = {
          id: `seed_sales_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: p.name,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: Math.round(qty * 1.2),
          normalReceipt: Math.round(qty * 1.1),
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: Math.round(qty * 1.1),
          salesQuantity: qty,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: qty,
          endingInventory: Math.round(qty * 1.3),
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue,
          costOfSales,
          grossProfit,
          uploadedAt: new Date().toISOString()
        };
        result.push(recQty);
      });
    });

    return result;
  };

  // Convert values with currency rates
  const getExchangeRate = (mNum?: number) => {
    const month = mNum || (activeMonth === 'all' ? 5 : Number(activeMonth));
    return ExchangeRateStorage.getRate(activeYear, month);
  };

  const convertAmount = (krwVal: number, mNum?: number) => {
    if (currencyMode === 'USD') {
      return krwVal / getExchangeRate(mNum);
    }
    return krwVal;
  };

  const formatCurrency = (val: number) => {
    if (currencyMode === 'USD') {
      return `$${Math.round(val).toLocaleString()}`;
    }
    // Show in million KRW
    return `₩${Math.round(val / 1_000_000).toLocaleString()}백만원`;
  };

  // Filter records to target month & unit of type '수량'
  const filterByUnit = realRecords.filter(r => r.unit === '수량');

  const filteredRecords = filterByUnit.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterProduct !== 'all' && r.productName !== filterProduct) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q);
    }
    return true;
  });

  // KPI calculations based on filtered records
  const totalRevenueKRW = filteredRecords.reduce((acc, r) => acc + (r.revenue || 0), 0);
  const totalCostKRW = filteredRecords.reduce((acc, r) => acc + (r.costOfSales || 0), 0);
  const totalProfitKRW = totalRevenueKRW - totalCostKRW;
  const marginPercent = totalRevenueKRW > 0 ? (totalProfitKRW / totalRevenueKRW) * 100 : 0;

  // N/C/LC ONLY volume calculation (황산니켈, 황산코발트, 탄산리튬)
  const SALES_VOLUME_PRODUCTS = new Set(['황산니켈', '황산코발트', '탄산리튬']);
  const totalQuantityTons = filteredRecords
    .filter(r => SALES_VOLUME_PRODUCTS.has(r.productName))
    .reduce((acc, r) => acc + (r.salesQuantity || 0), 0);

  const productCount = new Set(filteredRecords.map(r => r.productName)).size;

  // Aggregate stats per Product for table
  const finalTableData = ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'].map(pName => {
    const matched = filteredRecords.filter(r => r.productName === pName);
    const salesQty = matched.reduce((acc, r) => acc + (r.salesQuantity || 0), 0);
    const rev = matched.reduce((acc, r) => acc + (r.revenue || 0), 0);
    const cos = matched.reduce((acc, r) => acc + (r.costOfSales || 0), 0);
    const endingQty = matched.reduce((acc, r) => acc + (r.endingInventory || 0), 0);
    const profit = rev - cos;
    const profitMargin = rev > 0 ? (profit / rev) * 100 : 0;
    const avgPrice = salesQty > 0 ? (rev / salesQty) : 0;

    let metal = 'Ni';
    if (pName === '황산코발트') metal = 'Co';
    if (pName === '탄산리튬') metal = 'Li';
    if (pName === '황산망간') metal = 'Mn';
    if (pName === '구리') metal = 'Cu';

    return {
      productName: pName,
      metal,
      salesQty,
      revenue: rev,
      costOfSales: cos,
      grossProfit: profit,
      profitMargin,
      avgPrice,
      endingQty
    };
  }).filter(item => {
    if (filterProduct !== 'all' && item.productName !== filterProduct) return false;
    return true;
  });

  // Monthly trend chart dataset
  const monthlyChartTrend = Array.from({ length: 12 }, (_, i) => {
    const mNum = i + 1;
    const mRows = filterByUnit.filter(r => Number(r.month) === mNum);
    const revenue = mRows.reduce((acc, r) => acc + (r.revenue || 0), 0);
    const profit = revenue - mRows.reduce((acc, r) => acc + (r.costOfSales || 0), 0);

    return {
      month: `${mNum}월`,
      '매출액': convertAmount(revenue, mNum),
      '매출이익': convertAmount(profit, mNum),
    };
  });

  return (
    <div className="space-y-6 animate-fade">
      {/* Sample Alert */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-2.5 text-xs">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ RUNNING SAMPLE (샘플 데이터 모드)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 제품수불 정보가 없습니다. 상세 데이터 파싱 및 수불 현황을 확인하려면 [운영 업로드] 페이지에서 엑셀 수불부를 올려주십시오.
              </p>
            </div>
          </div>
          <AppButton
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-none cursor-pointer"
          >
            운영 업로드 바로가기
          </AppButton>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-slate-100 text-zinc-550 px-2 py-0.5 rounded font-bold">운영 대시보드 연계</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">판매 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품수불부의 판매수량, 매출액, 매출원가, 매출이익을 확인합니다.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 animate-fade">
          {/* Currency Switcher */}
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

          {/* Time Picker */}
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-150 p-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-zinc-400 mr-1.5" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300 mx-1">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              <option value="all">연간 합계</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-[#647067] font-bold block">총 매출액</span>
          <span className="text-sm font-extrabold font-mono text-zinc-900 block mt-1">
            {formatCurrency(convertAmount(totalRevenueKRW))}
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-zinc-500 font-bold block">총 매출원가</span>
          <span className="text-sm font-extrabold font-mono text-zinc-700 block mt-1">
            {formatCurrency(convertAmount(totalCostKRW))}
          </span>
        </div>
        <div className="bg-[#fcfdfc] border border-[#dde5de] p-4 rounded-xl text-center shadow-sm">
          <span className="text-[10px] text-[#008f83] font-bold block">매출이익</span>
          <span className="text-sm font-extrabold font-mono text-[#008f83] block mt-1">
            {formatCurrency(convertAmount(totalProfitKRW))}
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-zinc-450 font-bold block">매출이익률</span>
          <span className="text-sm font-extrabold font-mono text-indigo-700 block mt-1">
            {marginPercent.toFixed(1)}%
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-zinc-500 font-bold block">총 판매물량 (N/C/LC)</span>
          <span className="text-sm font-extrabold font-mono text-[#008f83] block mt-1">
            {totalQuantityTons.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-[#008f83] font-bold block">제품 수</span>
          <span className="text-sm font-extrabold font-mono text-teal-800 block mt-1">
            {productCount}개 구분
          </span>
        </div>
      </div>

      {/* Chart Row */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-xs font-bold text-zinc-800 mb-4 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          {activeYear}년 월별 매출액 및 매출이익 트렌드 ({currencyMode === 'USD' ? 'USD' : '백만원'})
        </h3>
        <div className="h-[210px] w-full font-mono text-[9px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f2" vertical={false} />
              <XAxis dataKey="month" fontSize={9} stroke="#a0aab2" axisLine={false} tickLine={false} />
              <YAxis fontSize={9} stroke="#a0aab2" axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`${Math.round(Number(value)).toLocaleString()}`, '']} />
              <Legend iconType="circle" />
              <Bar name="매출 매출액" dataKey="매출액" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar name="매출이익" dataKey="매출이익" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="space-y-4">
        {/* Simple Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:outline-none focus:border-teal-500 w-full sm:w-64"
          >
            <option value="all">전체 제품</option>
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
              className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:outline-none focus:bg-white"
              placeholder="제품명 필터..."
            />
          </div>
        </div>

        {/* Detailed Sales table */}
        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">제품명</th>
                <th className="px-5 py-3.5 text-center">금속</th>
                <th className="px-5 py-3.5 text-right">판매수량 (Mt)</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-zinc-800">매출액</th>
                <th className="px-5 py-3.5 text-right">매출원가</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-teal-800 bg-emerald-50/10">매출이익</th>
                <th className="px-5 py-3.5 text-center font-bold text-indigo-700">매출이익률</th>
                <th className="px-5 py-3.5 text-right">판매단가 (Mt당)</th>
                <th className="px-5 py-3.5 text-right font-bold text-slate-800">기말재고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {finalTableData.map(item => {
                const displayRev = convertAmount(item.revenue);
                const displayCos = convertAmount(item.costOfSales);
                const displayProfit = displayRev - displayCos;
                const displayAvgPrice = convertAmount(item.avgPrice);

                return (
                  <tr key={item.productName} className="hover:bg-[#f7f9f7]/55 font-mono">
                    <td className="px-5 py-3.5 font-bold font-sans text-zinc-900">{item.productName}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-zinc-400">
                      <span className="bg-slate-100 text-zinc-705 text-[10px] px-2 py-0.5 rounded font-mono">{item.metal}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-900 font-bold">{item.salesQty.toLocaleString()} Mt</td>
                    <td className="px-5 py-3.5 text-right font-bold text-zinc-950">{formatCurrency(displayRev)}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-550">{formatCurrency(displayCos)}</td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-teal-800 bg-teal-50/5">{formatCurrency(displayProfit)}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-indigo-700">{item.profitMargin.toFixed(1)}%</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{formatCurrency(displayAvgPrice)}/Mt</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-indigo-900">{item.endingQty.toLocaleString()} Mt</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
