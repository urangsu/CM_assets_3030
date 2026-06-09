import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Calendar, 
  ArrowUpRight,
  ArrowDownRight,
  Info 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

// Conversion utility for production quantities
// display_qty = raw_qty / 1000 (지정: "raw가 kg일 때만")
// tick_format = "#,##0.0" (keeps one trailing decimal digit)
function formatQty(rawQty: number): string {
  if (!Number.isFinite(rawQty) || rawQty === 0) return '-';
  const isRawKg = rawQty > 1000;
  const display_qty = isRawKg ? rawQty / 1000 : rawQty;
  return display_qty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function ProductionStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const [realRecords, setRealRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  // Load production records or fallback to seeds
  const loadData = () => {
    const list = OperationStorage.getProductRecords(activeYear);
    if (list && list.length > 0) {
      setRealRecords(list);
      setIsSampleData(false);
    } else {
      setRealRecords(getSeedProductionRecords(activeYear));
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

  // Seed detailed records for simulation
  const getSeedProductionRecords = (yearStr: string): ProductLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const result: ProductLedgerRecord[] = [];

    const products = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 130, unitPrice: 24_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 48, unitPrice: 58_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 85, unitPrice: 38_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 155, unitPrice: 12_000_000 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 310, unitPrice: 9_500_000 },
    ];

    months.forEach(m => {
      const factor = 0.88 + Math.sin((m / 6) * Math.PI) * 0.18;
      products.forEach(p => {
        const prodQty = Math.round(p.baseQty * factor);
        const prodAmt = prodQty * p.unitPrice * 0.78; // estimated production cost value

        const rec: ProductLedgerRecord = {
          id: `seed_prod_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: p.name,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: Math.round(prodQty * 1.15),
          normalReceipt: prodQty, // normalReceipt (정상입고) on quantity is the designated production quantity!
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: prodQty,
          salesQuantity: Math.round(prodQty * 0.94),
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: Math.round(prodQty * 0.94),
          endingInventory: Math.round(prodQty * 1.25),
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: prodQty * p.unitPrice,
          costOfSales: prodQty * p.unitPrice * 0.81,
          grossProfit: prodQty * p.unitPrice * 0.19,
          uploadedAt: new Date().toISOString()
        };

        // Lithium conversion
        if (p.name === '탄산리튬') {
          const rate = 18.75;
          rec.conversionRate = rate;
          rec.convertedProductionQuantity = prodQty / (rate / 100);
          rec.convertedSalesQuantity = rec.salesQuantity / (rate / 100);
          rec.convertedEndingInventory = rec.endingInventory / (rate / 100);
        } else {
          rec.convertedProductionQuantity = prodQty;
          rec.convertedSalesQuantity = rec.salesQuantity;
          rec.convertedEndingInventory = rec.endingInventory;
        }

        result.push(rec);

        // Add corresponding '금액' row for price calculation
        const recAmt: ProductLedgerRecord = {
          ...rec,
          id: `seed_prod_${yearStr}_${m}_${p.name}_금액`,
          unit: '금액',
          normalReceipt: prodAmt,
        };
        result.push(recAmt);
      });
    });

    return result;
  };

  // Convert and Format Currency
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
    return `₩${Math.round(val / 1_000_000).toLocaleString()}M`;
  };

  // Separate records
  const qtyRecords = realRecords.filter(r => r.unit === '수량');
  const amtRecords = realRecords.filter(r => r.unit === '금액');

  const filteredQtyRecords = qtyRecords.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterProduct !== 'all' && r.productName !== filterProduct) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q);
    }
    return true;
  });

  // Aggregates map
  const CANONICAL_PRODUCTS = [
    { name: '황산니켈' as const, metal: 'Ni' as const },
    { name: '황산코발트' as const, metal: 'Co' as const },
    { name: '탄산리튬' as const, metal: 'Li' as const },
    { name: '황산망간' as const, metal: 'Mn' as const },
    { name: '구리' as const, metal: 'Cu' as const },
  ];

  const productAggMap = new Map<string, {
    productName: '황산니켈' | '황산코발트' | '탄산리튬' | '황산망간' | '구리';
    metal: 'Ni' | 'Co' | 'Li' | 'Mn' | 'Cu';
    productionQty: number; // normalReceipt qty
    convertedQty: number; // convertedProductionQuantity qty
    productionAmt: number; // normalReceipt amt
  }>();

  CANONICAL_PRODUCTS.forEach(p => {
    productAggMap.set(p.name, {
      productName: p.name,
      metal: p.metal,
      productionQty: 0,
      convertedQty: 0,
      productionAmt: 0
    });
  });

  filteredQtyRecords.forEach(qRec => {
    const existing = productAggMap.get(qRec.productName);
    if (existing) {
      existing.productionQty += qRec.normalReceipt || 0;
      existing.convertedQty += qRec.convertedProductionQuantity || qRec.normalReceipt || 0;

      const amtRow = amtRecords.find(a => a.productName === qRec.productName && Number(a.month) === Number(qRec.month));
      if (amtRow) {
        existing.productionAmt += amtRow.normalReceipt || 0;
      }
    }
  });

  const finalTableData = Array.from(productAggMap.values()).filter(item => {
    if (filterProduct !== 'all' && item.productName !== filterProduct) return false;
    return true;
  });

  // KPIs
  const totalProductionTons = finalTableData.reduce((acc, item) => acc + item.productionQty, 0);
  const totalConvertedProductionTons = finalTableData.reduce((acc, item) => acc + item.convertedQty, 0);
  const totalProductionAmtValue = finalTableData.reduce((acc, item) => acc + item.productionAmt, 0);
  const productCount = new Set(filteredQtyRecords.map(r => r.productName)).size || finalTableData.length;

  const lithiumObj = productAggMap.get('탄산리튬');
  const lithiumConvertedProd = lithiumObj ? lithiumObj.convertedQty : 0;

  // MoM
  let MoMText = '안정적 생산중';
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
        MoMText = `${MoMValue >= 0 ? '전월대비 증가' : '전월대비 감소'} (${Math.abs(MoMValue).toFixed(1)}%)`;
      } else {
        MoMText = '직전 월 데이터 누락';
      }
    } else {
      MoMText = '연초 첫 정산 (1월)';
    }
  } else {
    MoMText = '연간 누적 생산 지표';
  }

  // Monthly Chart Feed
  const monthlyAreaTrend = Array.from({ length: 12 }, (_, i) => {
    const mNum = i + 1;
    const monthQtyRows = qtyRecords.filter(r => Number(r.month) === mNum);
    const normalProd = monthQtyRows.reduce((acc, r) => acc + (r.normalReceipt || 0), 0);
    const convertedProd = monthQtyRows.reduce((acc, r) => acc + (r.convertedProductionQuantity || r.normalReceipt || 0), 0);

    const getDisplayQty = (raw: number) => {
      const isRawKg = raw > 1000;
      return isRawKg ? raw / 1000 : raw;
    };

    return {
      month: `${mNum}월`,
      '생산실물량': parseFloat(getDisplayQty(normalProd).toFixed(1)),
      '환산량': parseFloat(getDisplayQty(convertedProd).toFixed(1))
    };
  });

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-2.5 text-xs">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ RUNNING SAMPLE (생산 샘플 모드)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 제품수불 정보가 모자라 정수 샘플 데이터가 표시됩니다. 실무 엑셀을 업로드하시려면 운영 업로드로 이동하십시오.
              </p>
            </div>
          </div>
          <AppButton
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-none"
          >
            운영 업로드 바로가기
          </AppButton>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-[#008f83]/10 text-[#008f83] px-2 py-0.5 rounded font-bold font-sans">실무 생산현황</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">생산 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품수불부의 정상입고(D열) 컬럼 데이터를 연계 추출하여 실제 제조 공장의 정품 인출 생산량 및 탄산리튬 환산 실질 지표를 비교합니다.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
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
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-150 p-2 rounded-xl text-xs font-sans">
            <Calendar className="w-4 h-4 text-zinc-400 mr-1.5" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700 text-xs"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300 mx-1">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700 text-xs"
            >
              <option value="all">연간 전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10.5px] text-[#647067] font-bold block font-sans">총 생산량 (톤)</span>
          <span className="text-xl font-bold text-zinc-900 font-mono mt-1 block">{formatQty(totalProductionTons)} 톤</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10.5px] text-teal-800 font-bold block">생산금액</span>
          <span className="text-xl font-bold text-teal-700 font-mono mt-1 block">
            {formatCurrency(convertAmount(totalProductionAmtValue))}
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10.5px] text-indigo-700 font-bold block font-sans">제품 수</span>
          <span className="text-xl font-bold text-indigo-805 font-mono mt-1 block">{productCount}개 구분</span>
        </div>
        <div className="bg-[#f0fcf9] border border-teal-150 p-5 rounded-2xl shadow-xs">
          <span className="text-[10.5px] text-teal-800 font-bold block">전월 대비 (vs Previous Month)</span>
          <span className="text-sm font-bold text-emerald-800 mt-1.5 block font-sans">
            {MoMText}
          </span>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-xs font-bold text-[#111111] mb-4 flex items-center gap-2 font-sans">
          <Activity className="w-4 h-4 text-[#008f83]" /> {activeYear}년 월별 완제품 생산 실물량 vs 보충 환산량 추세 (단위: 톤)
        </h3>
        <div className="h-[210px] w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyAreaTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
              <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis 
                stroke="#8b95a1" 
                fontSize={10} 
                axisLine={false} 
                tickLine={false} 
                label={{ value: '생산량(톤)', angle: -90, position: 'insideLeft', offset: -5 }}
                tickFormatter={(v: any) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              />
              <Tooltip formatter={(v: any) => [`${parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 톤`, '']} />
              <Legend iconType="circle" />
              <Area type="monotone" name="생산 실물량 (톤)" dataKey="생산실물량" stroke="#008f83" fill="#e2ede3" strokeWidth={2} />
              <Area type="monotone" name="보정 환산 생산량 (톤)" dataKey="환산량" stroke="#3182ce" fill="#ebf8ff" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtration Selector */}
      <div className="bg-white p-4 rounded-xl border border-[#dde5de] flex items-center gap-3">
        <span className="text-xs font-bold text-zinc-700">핵심제품 필터:</span>
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:outline-none focus:border-teal-500 w-full sm:w-60"
        >
          <option value="all">전체 Canonical 핵심제품군 [All]</option>
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
            className="w-full text-xs p-2 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:bg-white focus:outline-none"
            placeholder="제품명 검색..."
          />
        </div>
      </div>

      {/* Production Details Table */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider font-sans">
            <tr>
              <th className="px-5 py-3.5">제품명구분</th>
              <th className="px-5 py-3.5 text-center">연동메탈</th>
              <th className="px-5 py-3.5 text-right font-extrabold text-zinc-800">생산 실물량 (톤)</th>
              <th className="px-5 py-3.5 text-right font-bold text-indigo-700">보정 환산 생산량 (톤)</th>
              <th className="px-5 py-3.5 text-right font-semibold">정가 금액 가치</th>
              <th className="px-5 py-3.5 text-right">평균 환산 추이가격 / 톤</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {finalTableData.map(row => {
              const displayAmt = convertAmount(row.productionAmt);
              
              // display_qty = raw_qty / 1000 (지정: "raw가 kg일 때만")
              const isRawKgVal = row.productionQty > 1000;
              const displayProdQty = isRawKgVal ? row.productionQty / 1000 : row.productionQty;
              const displayConvertedQty = isRawKgVal ? row.convertedQty / 1000 : row.convertedQty;

              const avgPrc = displayProdQty > 0 ? (displayAmt / displayProdQty) : 0;

              return (
                <tr key={row.productName} className="hover:bg-[#f7f9f7]/55 font-mono">
                  <td className="px-5 py-3.5 font-bold font-sans text-zinc-900">{row.productName}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-zinc-405">
                    <span className="bg-slate-100 text-zinc-650 text-[10px] px-2.5 py-0.5 rounded font-mono">{row.metal}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-zinc-950 font-bold">
                    {formatQty(row.productionQty)} 톤
                  </td>
                  <td className="px-5 py-3.5 text-right text-indigo-850 font-extrabold bg-indigo-50/5">
                    {formatQty(row.convertedQty)} 톤
                  </td>
                  <td className="px-5 py-3.5 text-right text-zinc-700">{formatCurrency(displayAmt)}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-450">{formatCurrency(avgPrc)}/톤</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
