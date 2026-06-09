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

export default function RawMaterialStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [searchTerm, setSearchTerm] = useState('');

  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  // Standard Material Prices per ton in KRW
  const DEFAULT_MATERIAL_UNIT_PRICES_KRW: Record<string, number> = {
    'BP (Black Powder 원료)': 28_000_000,
    'BM (Black Mass)': 6_500_000,
    'WET (Wet BM)': 12_000_000,
    'LCO (리튬코발트산화물, Lithium Cobalt Oxide)': 45_000_000,
  };

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

  const getSampleRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
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
          id: `sample_raw_${yearStr}_${m}_${sIdx}`,
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

  // Convert Monetary values
  const getExchangeRate = () => {
    const month = activeMonth === 'all' ? 5 : Number(activeMonth);
    return ExchangeRateStorage.getRate(activeYear, month);
  };

  const convertAmountValue = (valueKRW: number) => {
    if (currencyMode === 'USD') {
      return valueKRW / getExchangeRate();
    }
    return valueKRW;
  };

  const formatCurrencyValue = (valueKRW: number) => {
    const value = convertAmountValue(valueKRW);
    if (currencyMode === 'USD') {
      return `$${Math.round(value / 1000).toLocaleString()}K`;
    }
    return `₩${React.version ? Math.round(value / 1_000_000).toLocaleString() : ''}백만원`;
  };

  const formatCurrencyBillionOrThousand = (valueKRW: number) => {
    const value = convertAmountValue(valueKRW);
    if (currencyMode === 'USD') {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    return `₩${(value / 1_000_000_000).toFixed(2)}십억원`;
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
    receiptQty: number;
    issueQty: number;
    endingQty: number;
  }> = {};

  uniqueNames.forEach(name => {
    aggregations[name] = {
      rawMaterialName: name,
      unit: 'Mt',
      beginningQty: 0,
      receiptQty: 0,
      issueQty: 0,
      endingQty: 0
    };
  });

  matchedAndFilteredList.forEach(r => {
    const normalized = getNormalizedMaterialName(r.rawMaterialName);
    if (!aggregations[normalized]) {
      aggregations[normalized] = {
        rawMaterialName: normalized,
        unit: r.unit || 'Mt',
        beginningQty: 0,
        receiptQty: 0,
        issueQty: 0,
        endingQty: 0
      };
    }
    aggregations[normalized].beginningQty += r.beginningInventory || 0;
    aggregations[normalized].receiptQty += r.receiptTotal || 0;
    aggregations[normalized].issueQty += r.issueTotal || 0;
    aggregations[normalized].endingQty += r.endingInventory || 0;
  });

  const detailRows = Object.values(aggregations);

  // Financial aggregates
  let totalBegAmtKRW = 0;
  let totalRecAmtKRW = 0;
  let totalIssAmtKRW = 0;
  let totalEndAmtKRW = 0;

  let totalEndingQty = 0;
  let totalReceiptQty = 0;
  let totalIssueQty = 0;

  const tableDataWithPrices = detailRows.map(row => {
    const basePrice = DEFAULT_MATERIAL_UNIT_PRICES_KRW[row.rawMaterialName] || 6_500_000;
    
    // Dynamic price adjustment based on current exchange rate / year index
    const adjustedUnitPrice = basePrice * (activeYear === '2026' ? 1.0 : 0.95);
    
    totalEndingQty += row.endingQty;
    totalReceiptQty += row.receiptQty;
    totalIssueQty += row.issueQty;

    const begAmt = row.beginningQty * adjustedUnitPrice;
    const recAmt = row.receiptQty * adjustedUnitPrice;
    const issAmt = row.issueQty * adjustedUnitPrice;
    const endAmt = row.endingQty * adjustedUnitPrice;

    totalBegAmtKRW += begAmt;
    totalRecAmtKRW += recAmt;
    totalIssAmtKRW += issAmt;
    totalEndAmtKRW += endAmt;

    return {
      ...row,
      unitPrice: adjustedUnitPrice,
      beginningAmt: begAmt,
      receiptAmt: recAmt,
      issueAmt: issAmt,
      endingAmt: endAmt
    };
  });

  // Chart data
  const chartData = tableDataWithPrices.map(row => ({
    name: row.rawMaterialName.split(' (')[0],
    '기초 재고액': convertAmountValue(row.beginningAmt),
    '당기 구매액': convertAmountValue(row.receiptAmt),
    '기말 재고액': convertAmountValue(row.endingAmt)
  }));

  return (
    <div className="space-y-6 animate-fade">
      {/* Simulation Active Banner */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ RUNNING SAMPLE (재고 샘플 모드)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 원자재 수불 정보가 없는 경우 정량 규명 모형 데이터가 출력됩니다. 실물 정산을 위해 운영 업로드 탭을 이용하십시오.
              </p>
            </div>
          </div>
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-0 cursor-pointer"
          >
            운영 수불부 업로드로 이동
          </AppButton>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded font-bold font-mono">Raw Material Ledger Control</span>
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">정산 분석</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">원자재 수불 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            원자재수불부 기준으로 기초재고, 구매, 불출, 기말재고를 확인합니다.
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <input
            type="text"
            placeholder="원료 품목 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 bg-white border border-[#dde5de] rounded-xl focus:outline-none w-44"
          />

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

          {/* Calendar Picker */}
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-150 p-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-zinc-400 mr-1.5" />
            <select
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-[#647067] font-bold block uppercase tracking-wider">원료 기말재고</span>
          <span className="text-lg font-bold text-zinc-900 mt-1 block font-mono">
            {totalEndingQty.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-[#008f83] font-bold block uppercase tracking-wider">당월 구매량</span>
          <span className="text-lg font-bold text-teal-800 mt-1 block font-mono">
            {totalReceiptQty.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-amber-750 font-bold block uppercase tracking-wider">당월 불출량</span>
          <span className="text-lg font-bold text-amber-800 mt-1 block font-mono">
            {totalIssueQty.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-[#fcfdfc] border border-indigo-150 p-4.5 rounded-xl text-left shadow-xs">
          <span className="text-[10px] text-indigo-700 font-bold block uppercase tracking-wider">재고금액</span>
          <span className="text-lg font-bold text-indigo-900 mt-1 block font-mono">
            {formatCurrencyBillionOrThousand(totalEndAmtKRW)}
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
                <Tooltip formatter={(v: any) => [`${Math.round(Number(v)).toLocaleString()}`, '']} />
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
                <span>{formatCurrencyValue(totalBegAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>총 당기구매액:</span>
                <span>+{formatCurrencyValue(totalRecAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>총 공정불출액:</span>
                <span>-{formatCurrencyValue(totalIssAmtKRW)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 font-bold border-t border-[#dde5de] pt-1.5">
                <span>최종 기말재산고:</span>
                <span>{formatCurrencyValue(totalEndAmtKRW)}</span>
              </div>
            </div>
          </div>
          <span className="text-[9px] text-[#8b95a1] pt-3 block border-t border-[#e5e8eb] font-mono">
            조사 기준환율: 1 USD = {getExchangeRate().toLocaleString()} KRW
          </span>
        </AppCard>
      </div>

      {/* Main Table Content */}
      <div className="animate-fade">
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
                  <th className="px-3.5 py-2 text-right text-zinc-450">단가</th>
                  
                  <th className="px-3.5 py-2 text-right text-teal-850">수량</th>
                  <th className="px-3.5 py-2 text-right text-teal-850">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-450">단가</th>

                  <th className="px-3.5 py-2 text-right text-amber-850">수량</th>
                  <th className="px-3.5 py-2 text-right text-amber-850">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-450">단가</th>

                  <th className="px-3.5 py-2 text-right text-indigo-900 font-bold">수량</th>
                  <th className="px-3.5 py-2 text-right text-indigo-900 font-bold">금액</th>
                  <th className="px-3.5 py-2 text-right text-zinc-450">단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                {tableDataWithPrices.map(row => {
                  const unitPriceConverted = convertAmountValue(row.unitPrice);
                  
                  return (
                    <tr key={row.rawMaterialName} className="hover:bg-[#f7f9f7]/55 divide-x divide-[#eef2ec]">
                      <td className="px-3.5 py-3.5 font-sans font-bold text-zinc-900 text-left bg-[#fcfdfc]/55">
                        {row.rawMaterialName}
                      </td>
                      
                      {/* Beginning */}
                      <td className="px-3.5 py-3.5 text-right font-semibold text-zinc-700">{row.beginningQty.toLocaleString()} Mt</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-600">{formatCurrencyValue(row.beginningAmt)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-400 text-[10.5px]">{formatCurrencyValue(row.unitPrice)}</td>

                      {/* Purchase/Receipt */}
                      <td className="px-3.5 py-3.5 text-right font-bold text-teal-800 bg-teal-50/5">{row.receiptQty.toLocaleString()} Mt</td>
                      <td className="px-3.5 py-3.5 text-right text-teal-700 bg-teal-50/5">{formatCurrencyValue(row.receiptAmt)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-400 text-[10.5px] bg-teal-50/5">{formatCurrencyValue(row.unitPrice)}</td>

                      {/* Issue */}
                      <td className="px-3.5 py-3.5 text-right font-semibold text-amber-800 bg-amber-50/5">{row.issueQty.toLocaleString()} Mt</td>
                      <td className="px-3.5 py-3.5 text-right text-amber-700 bg-amber-50/5">{formatCurrencyValue(row.issueAmt)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-400 text-[10.5px] bg-amber-50/5">{formatCurrencyValue(row.unitPrice)}</td>

                      {/* Ending */}
                      <td className="px-3.5 py-3.5 text-right font-extrabold text-indigo-950 bg-indigo-50/5">{row.endingQty.toLocaleString()} Mt</td>
                      <td className="px-3.5 py-3.5 text-right font-semibold text-indigo-900 bg-indigo-50/5">{formatCurrencyValue(row.endingAmt)}</td>
                      <td className="px-3.5 py-3.5 text-right text-zinc-400 text-[10.5px] bg-indigo-50/5">{formatCurrencyValue(row.unitPrice)}</td>
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
