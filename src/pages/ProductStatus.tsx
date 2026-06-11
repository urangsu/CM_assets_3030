import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Calendar, 
  HelpCircle, 
  FileSpreadsheet, 
  Settings,
  ChevronDown,
  ChevronRight,
  Info 
} from 'lucide-react';
import { AppCard } from '../components/ui/AppCard';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage, getSafeExchangeRate, formatExchangeRateLabel } from '../lib/operation/exchangeRateStorage';

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

export default function ProductStatus() {
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('5'); // Default is 5
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [records, setRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);
  
  // Track expanded product groups
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const toggleExpand = (prodName: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [prodName]: !prev[prodName]
    }));
  };

  const loadData = () => {
    const list = OperationStorage.getProductRecords(activeYear);
    const monthData = list.filter(r => Number(r.month) === Number(activeMonth));
    
    if (monthData && monthData.length > 0) {
      setRecords(monthData);
      setIsSampleData(false);
    } else {
      setRecords(getSeedProductRecords(activeYear, Number(activeMonth)));
      setIsSampleData(true);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('operation-ledger-changed', loadData);
    return () => {
      window.removeEventListener('operation-ledger-changed', loadData);
    };
  }, [activeYear, activeMonth]);

  // Seed detailed records for 3-row layout (수량, 금액, 단가)
  const getSeedProductRecords = (yearStr: string, mNum: number): ProductLedgerRecord[] => {
    const products = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 140, unitPrice: 24_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 52, unitPrice: 58_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 90, unitPrice: 38_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 165, unitPrice: 12_000_000 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 320, unitPrice: 9_500_000 },
    ];

    const factor = 0.85 + Math.sin((mNum / 12) * Math.PI) * 0.3 * (mNum % 2 ? 1.05 : 0.95);
    const result: ProductLedgerRecord[] = [];

    products.forEach(p => {
      const qVal = Math.round(p.baseQty * factor);
      const prcVal = p.unitPrice; // standard KRW price per ton

      // 1. 수량 row
      const qtyRec: ProductLedgerRecord = {
        id: `seed_prod_${yearStr}_${mNum}_${p.name}_수량`,
        year: yearStr,
        month: mNum,
        sourceType: '제품수불부',
        sourceRowStartIndex: 0,
        rawProductName: `${p.metal} ${p.name}`,
        productName: p.name,
        metal: p.metal,
        unit: '수량',
        beginningInventory: Math.round(qVal * 1.2),
        normalReceipt: Math.round(qVal * 1.1),
        transferReceipt: 5,
        returnReceipt: 1,
        otherReceipt: 2,
        receiptTotal: Math.round(qVal * 1.1) + 8,
        salesQuantity: qVal,
        reInput: 4,
        compensation: 0,
        sample: 1,
        transferIssue: 2,
        disposal: 0,
        otherIssue: 1,
        issueTotal: qVal + 8,
        endingInventory: Math.round(qVal * 1.25),
        inventoryValuationLoss: 25_000_000, // assign properly
        valuationApplied: 25_000_000,
        revenue: qVal * prcVal,
        costOfSales: Math.round(qVal * prcVal * 0.82),
        grossProfit: Math.round(qVal * prcVal * 0.18),
        uploadedAt: new Date().toISOString()
      };

      // 2. 금액 row (백만원 단위로 simulation, or full KRW)
      const amtRec: ProductLedgerRecord = {
        ...qtyRec,
        id: `seed_prod_${yearStr}_${mNum}_${p.name}_금액`,
        unit: '금액',
        beginningInventory: qtyRec.beginningInventory * prcVal,
        normalReceipt: qtyRec.normalReceipt * prcVal,
        transferReceipt: qtyRec.transferReceipt * prcVal,
        returnReceipt: qtyRec.returnReceipt * prcVal,
        otherReceipt: qtyRec.otherReceipt * prcVal,
        receiptTotal: qtyRec.receiptTotal * prcVal,
        salesQuantity: qtyRec.salesQuantity * prcVal,
        reInput: qtyRec.reInput * prcVal,
        compensation: 0,
        sample: qtyRec.sample * prcVal,
        transferIssue: qtyRec.transferIssue * prcVal,
        disposal: 0,
        otherIssue: qtyRec.otherIssue * prcVal,
        issueTotal: qtyRec.issueTotal * prcVal,
        endingInventory: qtyRec.endingInventory * prcVal,
        inventoryValuationLoss: 25_000_000,
        valuationApplied: 25_000_000
      };

      // 3. 단가 row
      const prcRec: ProductLedgerRecord = {
        ...qtyRec,
        id: `seed_prod_${yearStr}_${mNum}_${p.name}_단가`,
        unit: '단가',
        beginningInventory: prcVal,
        normalReceipt: prcVal,
        transferReceipt: prcVal,
        returnReceipt: prcVal,
        otherReceipt: prcVal,
        receiptTotal: prcVal,
        salesQuantity: prcVal,
        reInput: prcVal,
        compensation: 0,
        sample: prcVal,
        transferIssue: prcVal,
        disposal: 0,
        otherIssue: prcVal,
        issueTotal: prcVal,
        endingInventory: prcVal,
        inventoryValuationLoss: 0,
        valuationApplied: 0
      };

      result.push(qtyRec, amtRec, prcRec);
    });

    return result;
  };

  // Map exchange rate
  const exRate = getSafeExchangeRate(activeYear, Number(activeMonth));

  const formatQuantity = (val: number) => {
    if (val === 0) return '-';
    return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton`;
  };

  const formatMonetaryValue = (val: number, isUnitPrice: boolean = false) => {
    if (!Number.isFinite(val) || val === 0) return '-';

    if (currencyMode === 'USD') {
      if (!exRate) return '환율 미등록';
      const usdVal = val / exRate;

      if (isUnitPrice) {
        return `$${Math.round(usdVal).toLocaleString()}`;
      }

      return `$${(usdVal / 1_000_000).toFixed(2)}M`;
    }

    if (isUnitPrice) {
      return `₩${Math.round(val).toLocaleString()}`;
    }

    return formatKRWMillion(val);
  };

  const PRODUCTS_TO_SHOW = ['황산니켈', '황산코발트', '탄산리튬', '황산망간', '구리'];

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      {isSampleData && (
        <div id="simulated-warning-box" className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-2.5 shadow-sm animate-fade">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">⚠️ 샘플 데이터</span>
            <p className="text-zinc-650 mt-1">
              아직 업로드된 제품수불부가 없어 화면 확인용 샘플 데이터를 표시합니다. 실제 데이터는 운영 업로드에서 제품수불부를 등록하면 월 단위로 교체됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Missing Exchange Rate Warning Banner */}
      {currencyMode === 'USD' && !exRate && (
        <div id="exchange-rate-warning-box" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-fade">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">⚠️ 환율 미등록</span>
              <p className="text-zinc-650 mt-1">
                달러 보기에는 월평균환율이 필요합니다. 환율 관리에서 자동 연계하거나 수동 입력하세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/operation-dashboard'}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-colors cursor-pointer"
          >
            환율 입력
          </button>
        </div>
      )}

      {/* Header Panel */}
      <div id="product-status-header" className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">POSCO HYCM</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">제품 수불 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            황산니켈, 황산코발트, 탄산리튬 등 핵심 완제품의 정산 수량과 재고가치, 매출 성과를 1개 제품당 1행으로 확인합니다.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              id="product-currency-krw-btn"
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
              }`}
            >
              원화 (백만원)
            </button>
            <button
              id="product-currency-usd-btn"
              onClick={() => setCurrencyMode('USD')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'USD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-500'
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Time Picker */}
          <div className="flex items-center gap-2 bg-[#f8f9fa] p-2 rounded-xl border border-zinc-150 text-xs">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <select
              id="product-year-select"
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
              id="product-month-select"
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9fa] border-b border-[#dde5de] flex justify-between items-center text-xs">
          <span className="font-bold text-zinc-700 flex items-center gap-1.5 font-sans">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            POSCO HYCM {activeYear}년 {activeMonth}월 제품수불 결과 요약대장
          </span>
          <span className="text-zinc-400 font-mono text-[10px]">
            기준 환율: {formatExchangeRateLabel(exRate)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table id="product-summary-master-table" className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 border-r border-[#e5e8eb] w-[20px]"></th>
                <th className="px-3 py-3 border-r border-[#e5e8eb] min-w-[120px] text-zinc-700">제품명</th>
                <th className="px-2 py-3 border-r border-[#e5e8eb] text-center min-w-[60px]">단위</th>
                <th className="px-2 py-3 text-right">기초재고 수량</th>
                <th className="px-2 py-3 text-right bg-indigo-50/15">정상입고 수량</th>
                <th className="px-2 py-3 text-right">입고합계 수량</th>
                <th className="px-2 py-3 text-right">판매출고 수량</th>
                <th className="px-2 py-3 text-right">출고합계 수량</th>
                <th className="px-2 py-3 text-right font-extrabold text-zinc-900 border-r border-[#eef2ec]">기말재고 수량</th>
                <th className="px-2 py-3 text-right text-rose-600 font-bold">재고평가손</th>
                <th className="px-2 py-3 text-right text-indigo-850">평가손반영</th>
                <th className="px-2 py-3 text-right font-bold text-slate-800">매출액 (T)</th>
                <th className="px-2 py-3 text-right text-slate-700">매출원가 (T)</th>
                <th className="px-2 py-3 text-right font-extrabold text-emerald-800">매출이익 (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white font-mono text-[11px]">
              {PRODUCTS_TO_SHOW.map(name => {
                const qtyRow = records.find(r => r.productName === name && r.unit === '수량');
                const amtRow = records.find(r => r.productName === name && r.unit === '금액');
                const prcRow = records.find(r => r.productName === name && r.unit === '단가');
                const isExpanded = !!expandedProducts[name];

                if (!qtyRow) {
                  return (
                    <tr key={name} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 border-r border-[#eef2ec]"></td>
                      <td className="px-3 py-3 border-r border-[#eef2ec] font-sans font-medium text-zinc-550">{name}</td>
                      <td colSpan={12} className="px-2 py-3 text-center text-zinc-400 font-sans text-[11px]">
                        당월 수불 데이터가 없습니다.
                      </td>
                    </tr>
                  );
                }

                return (
                  <React.Fragment key={name}>
                    {/* Main Summary Row */}
                    <tr 
                      className={`hover:bg-[#f7f9f7]/40 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-indigo-50/5' : ''
                      }`}
                      onClick={() => toggleExpand(name)}
                    >
                      <td className="px-4 py-3 border-r border-[#e5e8eb] text-center">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500 mx-auto" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-3 py-3 border-r border-[#e5e8eb] font-sans font-bold text-zinc-900 text-left">
                        {name}
                        {name === '탄산리튬' && (
                          <span className="block text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-normal font-sans mt-0.5 max-w-fit">
                            원수량 기반
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 border-r border-[#e5e8eb] text-center font-bold text-zinc-400">
                        Ton
                      </td>

                      {/* Quantities */}
                      <td className="px-2 py-3 text-right">{formatQuantity(qtyRow.beginningInventory)}</td>
                      <td className="px-2 py-3 text-right bg-indigo-50/10 font-bold text-indigo-950">{formatQuantity(qtyRow.normalReceipt)}</td>
                      <td className="px-2 py-3 text-right">{formatQuantity(qtyRow.receiptTotal)}</td>
                      <td className="px-2 py-3 text-right font-semibold text-emerald-950">{formatQuantity(qtyRow.salesQuantity)}</td>
                      <td className="px-2 py-3 text-right">{formatQuantity(qtyRow.issueTotal)}</td>
                      <td className="px-2 py-3 text-right bg-zinc-50/50 font-extrabold text-zinc-900 border-r border-[#e5e8eb]">
                        {formatQuantity(qtyRow.endingInventory)}
                      </td>

                      {/* Valuation metrics */}
                      <td className="px-2 py-3 text-right text-rose-600 font-semibold">
                        {formatMonetaryValue(qtyRow.inventoryValuationLoss ?? 0)}
                      </td>
                      <td className="px-2 py-3 text-right text-indigo-800">
                        {formatMonetaryValue(qtyRow.valuationApplied ?? 0)}
                      </td>

                      {/* Revenue and Profit copied directly to Quantity record (under unit=Quantity, T-cols) */}
                      <td className="px-2 py-3 text-right font-bold text-slate-800 bg-[#fcfdfd]">
                        {formatMonetaryValue(qtyRow.revenue ?? 0)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {formatMonetaryValue(qtyRow.costOfSales ?? 0)}
                      </td>
                      <td className="px-2 py-3 text-right font-extrabold text-emerald-800 bg-[#fcfdfd]">
                        {formatMonetaryValue(qtyRow.grossProfit ?? 0)}
                      </td>
                    </tr>

                    {/* Explanded 3-Row Detail (Same layout as excel source sheet) */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/45 animate-fade">
                        <td colSpan={14} className="p-0 border-t border-[#eef2ec]">
                          <div className="p-4 bg-zinc-50/50 rounded-b-xl border-l-2 border-emerald-500 space-y-2">
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold font-sans">
                              {name} 수불부 원본 3행 정산상세
                            </span>

                            <table className="min-w-full text-left text-[10.5px] border border-[#eef2ec]">
                              <thead className="bg-[#fcfdfc] font-sans font-bold text-[#647067]">
                                <tr className="divide-x divide-[#eef2ec] border-b border-[#eef2ec]">
                                  <th className="px-2.5 py-1.5 w-[50px] text-center">단위행</th>
                                  <th className="px-2 py-1.5 text-right">기초재고</th>
                                  <th className="px-2 py-1.5 text-right bg-indigo-50/10">정상입고</th>
                                  <th className="px-2 py-1.5 text-right">이동입고</th>
                                  <th className="px-2 py-1.5 text-right">반품입고</th>
                                  <th className="px-2 py-1.5 text-right">기타입고</th>
                                  <th className="px-2 py-1.5 text-right font-bold bg-indigo-50/15">입고합계</th>
                                  <th className="px-2 py-1.5 text-right bg-emerald-50/10">판매출고</th>
                                  <th className="px-2 py-1.5 text-right">재투입</th>
                                  <th className="px-2 py-1.5 text-right">보상출고</th>
                                  <th className="px-2 py-1.5 text-right">견본출고</th>
                                  <th className="px-2 py-1.5 text-right">이동출고</th>
                                  <th className="px-2 py-1.5 text-right text-red-600">폐기</th>
                                  <th className="px-2 py-1.5 text-right">기타출고</th>
                                  <th className="px-2 py-1.5 text-right font-bold bg-emerald-50/15">출고합계</th>
                                  <th className="px-2 py-1.5 text-right font-bold bg-zinc-100">기말재고</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#eef2ec] bg-white">
                                {/* Qty */}
                                <tr className="divide-x divide-[#eef2ec]">
                                  <td className="px-2.5 py-1.5 font-bold text-center text-zinc-500 bg-[#fcfdfc]">수량</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.beginningInventory.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.normalReceipt.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.transferReceipt.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.returnReceipt.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.otherReceipt.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right font-bold text-indigo-950 bg-indigo-50/5">{qtyRow.receiptTotal.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right font-bold text-emerald-950 bg-emerald-50/5">{qtyRow.salesQuantity.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.reInput.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.compensation.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.sample.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.transferIssue.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right text-rose-650">{qtyRow.disposal.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right">{qtyRow.otherIssue.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right font-bold text-emerald-950 bg-emerald-50/5">{qtyRow.issueTotal.toLocaleString()}</td>
                                  <td className="px-2 py-1.5 text-right font-bold text-zinc-900 bg-zinc-50">{qtyRow.endingInventory.toLocaleString()}</td>
                                </tr>

                                {/* Amount */}
                                {amtRow && (
                                  <tr className="divide-x divide-[#eef2ec] bg-gray-50/20 text-zinc-600">
                                    <td className="px-2.5 py-1.5 font-bold text-center text-zinc-500 bg-[#fcfdfc]">금액</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.beginningInventory)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.normalReceipt)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.transferReceipt)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.returnReceipt)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.otherReceipt)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-indigo-50/5">{formatMonetaryValue(amtRow.receiptTotal)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-emerald-50/5">{formatMonetaryValue(amtRow.salesQuantity)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.reInput)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.compensation)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.sample)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.transferIssue)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.disposal)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(amtRow.otherIssue)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-emerald-50/5">{formatMonetaryValue(amtRow.issueTotal)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-zinc-50">{formatMonetaryValue(amtRow.endingInventory)}</td>
                                  </tr>
                                )}

                                {/* Price */}
                                {prcRow && (
                                  <tr className="divide-x divide-[#eef2ec] bg-[#fdfdfd] text-zinc-400">
                                    <td className="px-2.5 py-1.5 font-bold text-center text-zinc-400 bg-[#fcfdfc]">단가</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.beginningInventory, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.normalReceipt, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.transferReceipt, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.returnReceipt, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.otherReceipt, true)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-indigo-50/5">{formatMonetaryValue(prcRow.receiptTotal, true)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-emerald-50/5">{formatMonetaryValue(prcRow.salesQuantity, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.reInput, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.compensation, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.sample, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.transferIssue, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.disposal, true)}</td>
                                    <td className="px-2 py-1.5 text-right">{formatMonetaryValue(prcRow.otherIssue, true)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-emerald-50/5">{formatMonetaryValue(prcRow.issueTotal, true)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold bg-zinc-50">{formatMonetaryValue(prcRow.endingInventory, true)}</td>
                                  </tr>
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
    </div>
  );
}
