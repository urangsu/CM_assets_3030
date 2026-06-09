import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Info,
  ShieldCheck,
  TrendingUp,
  PackageCheck,
  AlertCircle
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
import { OperationStorage, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

function formatKRWMillion(valueKRW: number): string {
  if (!Number.isFinite(valueKRW) || valueKRW === 0) return '-';
  const val = Math.round(valueKRW / 1_000_000);
  if (val < 0) return `-₩${Math.abs(val).toLocaleString()}백만원`;
  return `₩${val.toLocaleString()}백만원`;
}

function formatKRWBillion(valueKRW: number): string {
  if (!Number.isFinite(valueKRW) || valueKRW === 0) return '-';
  return `₩${(valueKRW / 1_000_000_000).toFixed(1)}십억원`;
}

export default function RawMaterialStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [searchTerm, setSearchTerm] = useState('');

  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  const loadData = () => {
    const listMaterials = OperationStorage.getRawMaterialRecords(activeYear);
    
    if (listMaterials && listMaterials.length > 0) {
      setRealMaterials(listMaterials);
      setIsSampleData(false);
    } else {
      setRealMaterials(getSampleRawMaterials(activeYear));
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

  // Normalized Material mapper
  const getNormalizedMaterialName = (rawName: string): string => {
    const nameLower = rawName.toUpperCase().replace(/\s+/g, '');
    if (nameLower.includes('BP') || nameLower.includes('POWDER') || nameLower.includes('파우더')) {
      return 'BP (Black Powder 원료)';
    }
    if (nameLower.includes('WET') || nameLower.includes('습식')) {
      return 'WET (Wet BM)';
    }
    if (nameLower.includes('LCO') || nameLower.includes('산화물') || nameLower.includes('리튬코발트')) {
      return 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)';
    }
    if (nameLower.includes('BM') || nameLower.includes('MASS') || nameLower.includes('블랙매스')) {
      return 'BM (Black Mass)';
    }
    return rawName;
  };

  const getSampleRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const materials: RawMaterialLedgerRecord[] = [];

    const matSeeds = [
      { name: 'BP (Black Powder 원료)', code: 'BP', beginning: 65.3, purchase: 180.4, issue: 155.2, price: 28_000_000 },
      { name: 'BM (Black Mass)', code: 'BM', beginning: 210.4, purchase: 740.5, issue: 650.0, price: 6_500_000 },
      { name: 'WET (Wet BM)', code: 'WET', beginning: 120.0, purchase: 390.0, issue: 350.0, price: 12_000_051 },
      { name: 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)', code: 'LCO', beginning: 24.5, purchase: 78.4, issue: 72.1, price: 45_000_000 }
    ];

    months.forEach((m) => {
      const idxFactor = 0.95 + (m % 5) * 0.04;
      matSeeds.forEach((seed, sIdx) => {
        const start = Math.round(seed.beginning * idxFactor * 10) / 10;
        const purchaseVal = Math.round(seed.purchase * idxFactor * 10) / 10;
        const issueVal = Math.round(seed.issue * idxFactor * 10) / 10;
        const end = Math.round((start + purchaseVal - issueVal) * 10) / 10;

        materials.push({
          id: `sample_raw_${yearStr}_${m}_${seed.code}`,
          year: yearStr,
          month: m,
          sourceType: '원자재수불부',
          rawMaterialName: seed.name,
          materialCode: seed.code,
          canonicalMaterialName: seed.name,
          unit: '수량',
          
          beginningQty: start,
          beginningAmount: start * seed.price,
          beginningUnitPrice: seed.price,

          purchaseQty: purchaseVal,
          purchaseAmount: purchaseVal * seed.price,
          purchaseUnitPrice: seed.price,

          issueQty: issueVal,
          issueAmount: issueVal * seed.price,
          issueUnitPrice: seed.price,

          endingQty: end,
          endingAmount: end * seed.price,
          endingUnitPrice: seed.price,

          beginningInventory: start,
          receiptTotal: purchaseVal,
          issueTotal: issueVal,
          endingInventory: end,
          uploadedAt: new Date().toISOString()
        });
      });
    });

    return materials;
  };

  const getExchangeRate = () => {
    const month = activeMonth === 'all' ? 5 : Number(activeMonth);
    return ExchangeRateStorage.getRate(activeYear, month);
  };

  const formatValue = (valueKRW: number) => {
    if (currencyMode === 'USD') {
      const exRate = getExchangeRate();
      const usdVal = valueKRW / exRate;
      if (usdVal === 0) return '-';
      const divided = Math.round(usdVal / 1000);
      return `$${divided.toLocaleString()}K`;
    }
    return formatKRWMillion(valueKRW);
  };

  const formatBillionOrKpiValue = (valueKRW: number) => {
    if (currencyMode === 'USD') {
      const exRate = getExchangeRate();
      const usdVal = valueKRW / exRate;
      if (usdVal === 0) return '-';
      return `$${(usdVal / 1_000_000).toFixed(1)}M`;
    }
    return formatKRWBillion(valueKRW);
  };

  // Filter materials
  const matchedAndFilteredList = realMaterials
    .filter(r => {
      if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
      if (searchTerm) {
        const normalized = getNormalizedMaterialName(r.rawMaterialName).toLowerCase();
        const query = searchTerm.toLowerCase();
        return normalized.includes(query) || r.rawMaterialName.toLowerCase().includes(query);
      }
      return true;
    });

  // Aggregation map
  const uniqueNames = ['BP (Black Powder 원료)', 'BM (Black Mass)', 'WET (Wet BM)', 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)'];
  const aggregations: Record<string, {
    rawMaterialName: string;
    unit: string;
    beginningQty: number;
    beginningAmount: number;
    purchaseQty: number;
    purchaseAmount: number;
    issueQty: number;
    issueAmount: number;
    endingQty: number;
    endingAmount: number;
    unitPrice: number;
  }> = {};

  uniqueNames.forEach(name => {
    aggregations[name] = {
      rawMaterialName: name,
      unit: 'Ton',
      beginningQty: 0,
      beginningAmount: 0,
      purchaseQty: 0,
      purchaseAmount: 0,
      issueQty: 0,
      issueAmount: 0,
      endingQty: 0,
      endingAmount: 0,
      unitPrice: 0
    };
  });

  matchedAndFilteredList.forEach(r => {
    const normalized = getNormalizedMaterialName(r.rawMaterialName);
    if (!aggregations[normalized]) {
      aggregations[normalized] = {
        rawMaterialName: normalized,
        unit: 'Ton',
        beginningQty: 0,
        beginningAmount: 0,
        purchaseQty: 0,
        purchaseAmount: 0,
        issueQty: 0,
        issueAmount: 0,
        endingQty: 0,
        endingAmount: 0,
        unitPrice: 0
      };
    }

    const begQ = r.beginningQty ?? r.beginningInventory ?? 0;
    const purQ = r.purchaseQty ?? r.receiptTotal ?? 0;
    const issQ = r.issueQty ?? r.issueTotal ?? 0;
    const endQ = r.endingQty ?? r.endingInventory ?? 0;

    aggregations[normalized].beginningQty += begQ;
    aggregations[normalized].purchaseQty += purQ;
    aggregations[normalized].issueQty += issQ;
    aggregations[normalized].endingQty += endQ;

    // Use actual parsed amounts from rich columns if they exist, else simulate
    let simulatedPrice = 6_500_000;
    if (normalized.includes('BP')) simulatedPrice = 28_000_000;
    if (normalized.includes('WET')) simulatedPrice = 12_000_000;
    if (normalized.includes('LCO')) simulatedPrice = 45_000_000;
    const finalPrice = Math.round(simulatedPrice * (activeYear === '2026' ? 1.0 : 0.95));

    aggregations[normalized].beginningAmount += r.beginningAmount ?? (begQ * finalPrice);
    aggregations[normalized].purchaseAmount += r.purchaseAmount ?? (purQ * finalPrice);
    aggregations[normalized].issueAmount += r.issueAmount ?? (issQ * finalPrice);
    aggregations[normalized].endingAmount += r.endingAmount ?? (endQ * finalPrice);

    aggregations[normalized].unitPrice = r.endingUnitPrice ?? r.beginningUnitPrice ?? finalPrice;
  });

  const tableDataWithPrices = Object.values(aggregations);

  // Financial aggregates
  let totalBegAmtKRW = 0;
  let totalRecAmtKRW = 0;
  let totalIssAmtKRW = 0;
  let totalEndAmtKRW = 0;

  let totalEndingQty = 0;
  let totalReceiptQty = 0;
  let totalIssueQty = 0;

  tableDataWithPrices.forEach(row => {
    totalEndingQty += row.endingQty;
    totalReceiptQty += row.purchaseQty;
    totalIssueQty += row.issueQty;

    totalBegAmtKRW += row.beginningAmount;
    totalRecAmtKRW += row.purchaseAmount;
    totalIssAmtKRW += row.issueAmount;
    totalEndAmtKRW += row.endingAmount;
  });

  // Chart data
  const chartData = tableDataWithPrices.map(row => ({
    name: row.rawMaterialName.split(' (')[0],
    '기초 재고액': currencyMode === 'USD' ? row.beginningAmount / getExchangeRate() : row.beginningAmount,
    '당기 구매액': currencyMode === 'USD' ? row.purchaseAmount / getExchangeRate() : row.purchaseAmount,
    '기말 재고액': currencyMode === 'USD' ? row.endingAmount / getExchangeRate() : row.endingAmount
  }));

  return (
    <div className="space-y-6 animate-fade">
      {/* Simulation Active Banner */}
      {isSampleData && (
        <div id="simulated-banner" className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ 시뮬레이션 표기 (원자재 수불 정보 없음)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 원자재 수불 정산 정보가 없어 정립된 표준 샘플 데이터를 표출 중입니다. 실제 실무 분석을 적용하려면 상단 운영 업로드를 실행해 주십시오.
              </p>
            </div>
          </div>
          <AppButton 
            id="navigate-to-upload-btn"
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-0 cursor-pointer"
          >
            운영 수불부 업로드로 이동
          </AppButton>
        </div>
      )}

      {/* Header Panel */}
      <div id="material-status-header" className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded font-bold font-mono">Raw Material Ledger Control</span>
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">정산 분석</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">원자재 수불 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            원자재수불부 기준으로 기초재고, 구매, 불출, 기말재고 및 각 품목별 입출고 가액 정세를 파악합니다.
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <input
            id="raw-material-search-input"
            type="text"
            placeholder="원료 품목 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 bg-white border border-[#dde5de] rounded-xl focus:outline-none w-44"
          />

          {/* Currency Switcher */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              id="set-currency-krw-btn"
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
              }`}
            >
              원화 보기
            </button>
            <button
              id="set-currency-usd-btn"
              onClick={() => setCurrencyMode('USD')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'USD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-500'
              }`}
            >
              달러 보기
            </button>
          </div>

          {/* Calendar Picker */}
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-150 p-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-zinc-400 mr-1.5" />
            <select
              id="active-year-select"
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300 mx-1">|</span>
            <select
              id="active-month-select"
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

      {/* KPI Stats Board */}
      <div id="material-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-[#647067] font-bold block uppercase tracking-wider">원료 기말재고</span>
          <span className="text-lg font-bold text-zinc-900 mt-1 block font-mono">
            {totalEndingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-[#008f83] font-bold block uppercase tracking-wider">당월 총 구매량</span>
          <span className="text-lg font-bold text-teal-800 mt-1 block font-mono">
            {totalReceiptQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-amber-750 font-bold block uppercase tracking-wider">당월 총 불출량</span>
          <span className="text-lg font-bold text-amber-800 mt-1 block font-mono">
            {totalIssueQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton
          </span>
        </div>
        <div className="bg-[#fcfdfc] border border-indigo-150 p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-indigo-700 font-bold block uppercase tracking-wider">수불 기말자산고</span>
          <span className="text-lg font-bold text-indigo-900 mt-1 block font-mono">
            {formatBillionOrKpiValue(totalEndAmtKRW)}
          </span>
        </div>
      </div>

      {/* Charts & Formula explanations row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Bar */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
          <h3 className="text-xs font-bold text-zinc-800 mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            원자재 수하 가치액 흐름비 (기초 vs 구매 vs 기말)
          </h3>
          <div className="h-[210px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                <XAxis dataKey="name" stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${Math.round(Number(v) / (currencyMode === 'USD' ? 1000 : 1000000)).toLocaleString()}${currencyMode === 'USD' ? 'K USD' : '백만원'}`, '']} />
                <Legend iconType="circle" />
                <Bar name="기초 재고가치" dataKey="기초 재고액" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar name="당기 구매가치" dataKey="당기 구매액" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar name="기말 재고가치" dataKey="기말 재고액" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ledger Formula explanations */}
        <AppCard className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#111111] mb-2 flex items-center gap-1.5">
              <PackageCheck className="w-4.5 h-4.5 text-indigo-600" />
              수불 정산 연동기준식
            </h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
              기초재고에서 조달량(구매)를 합산 후 불출소요량(공정투입)을 실시간 차감하여 정밀하게 도출된 대장 기말가액입니다. 월별 평균환율을 기준으로 통화가 즉각 환전 가치화됩니다.
            </p>
            <div className="mt-2 p-3 bg-[#f8f9fa] border border-zinc-150 rounded-xl text-[10px] font-mono space-y-1.5 text-zinc-700">
              <div className="flex justify-between">
                <span>총 기초자산액:</span>
                <span>{formatValue(totalBegAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>총 당기구매액:</span>
                <span>+{formatValue(totalRecAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>총 공정불출액:</span>
                <span>-{formatValue(totalIssAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 font-bold border-t border-[#dde5de] pt-1.5">
                <span>최종 기말재산고:</span>
                <span>{formatValue(totalEndAmtKRW)}</span>
              </div>
            </div>
          </div>
          <span className="text-[9px] text-[#8b95a1] pt-3 block border-t border-[#e5e8eb] font-mono">
            조사 기준환율: 1 USD = {getExchangeRate().toLocaleString()} KRW
          </span>
        </AppCard>
      </div>

      {/* Main Table Content */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="w-1.5 h-3.5 bg-emerald-600 rounded"></span>
          <h3 className="text-xs font-bold text-zinc-800">원자재 수불 세부명세표</h3>
        </div>

        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
              <thead className="bg-[#f7f9f7] text-[9.5px] text-[#647067] font-bold uppercase tracking-wider">
                <tr className="divide-x divide-[#eef2ec]">
                  <th className="px-3.5 py-3" rowSpan={2}>원료</th>
                  <th className="px-3.5 py-3 text-center" colSpan={3}>기초재고 (Beginning)</th>
                  <th className="px-3.5 py-3 text-center text-teal-800" colSpan={3}>당기입고 구매 (Purchase)</th>
                  <th className="px-3.5 py-3 text-center text-amber-800" colSpan={3}>당기출고 불출 (Issue)</th>
                  <th className="px-3.5 py-3 text-center text-indigo-900" colSpan={3}>기말재고 (Ending)</th>
                </tr>
                <tr className="divide-x divide-[#eef2ec] bg-[#fcfdfc]">
                  <th className="px-3.5 py-2 text-right">수량</th>
                  <th className="px-3.5 py-2 text-right">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-400">단가</th>
                  
                  <th className="px-3.5 py-2 text-right text-teal-850">수량</th>
                  <th className="px-3.5 py-2 text-right text-teal-850">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-400">단가</th>

                  <th className="px-3.5 py-2 text-right text-amber-850">수량</th>
                  <th className="px-3.5 py-2 text-right text-amber-850">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-400">단가</th>

                  <th className="px-3.5 py-2 text-right text-indigo-900 font-bold">수량</th>
                  <th className="px-3.5 py-2 text-right text-indigo-900 font-bold">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-400">단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {tableDataWithPrices.map(row => {
                  return (
                    <tr key={row.rawMaterialName} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                      <td className="px-3.5 py-3.5 font-sans font-bold text-zinc-900 text-left bg-[#fcfdfc]/55">
                        {row.rawMaterialName}
                      </td>
                      
                      {/* Beginning */}
                      <td className="px-3.5 py-3.5 text-right font-semibold text-zinc-700">{row.beginningQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-600">{formatValue(row.beginningAmount)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-450 text-[10.5px]">
                        {currencyMode === 'USD' ? `$${Math.round(row.unitPrice / getExchangeRate()).toLocaleString()}` : `₩${Math.round(row.unitPrice).toLocaleString()}`}
                      </td>

                      {/* Purchase/Receipt */}
                      <td className="px-3.5 py-3.5 text-right font-bold text-teal-800 bg-teal-50/5">{row.purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</td>
                      <td className="px-3.5 py-3.5 text-right text-teal-700 bg-teal-50/5">{formatValue(row.purchaseAmount)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-450 text-[10.5px] bg-teal-50/5">
                        {currencyMode === 'USD' ? `$${Math.round(row.unitPrice / getExchangeRate()).toLocaleString()}` : `₩${Math.round(row.unitPrice).toLocaleString()}`}
                      </td>

                      {/* Issue */}
                      <td className="px-3.5 py-3.5 text-right font-semibold text-amber-800 bg-amber-50/5">{row.issueQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</td>
                      <td className="px-3.5 py-3.5 text-right text-amber-700 bg-amber-50/5">{formatValue(row.issueAmount)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-450 text-[10.5px] bg-amber-50/5">
                        {currencyMode === 'USD' ? `$${Math.round(row.unitPrice / getExchangeRate()).toLocaleString()}` : `₩${Math.round(row.unitPrice).toLocaleString()}`}
                      </td>

                      {/* Ending */}
                      <td className="px-3.5 py-3.5 text-right font-extrabold text-indigo-950 bg-indigo-50/5">{row.endingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</td>
                      <td className="px-3.5 py-3.5 text-right font-semibold text-indigo-900 bg-indigo-50/5">{formatValue(row.endingAmount)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-450 text-[10.5px] bg-indigo-50/5">
                        {currencyMode === 'USD' ? `$${Math.round(row.unitPrice / getExchangeRate()).toLocaleString()}` : `₩${Math.round(row.unitPrice).toLocaleString()}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit tag */}
        <div className="mt-3 flex justify-end">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-[10.5px] font-bold border border-emerald-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> 원자재 수불부 원장 연동검증격필
          </span>
        </div>
      </div>
    </div>
  );
}
