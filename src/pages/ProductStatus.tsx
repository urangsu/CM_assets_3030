import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Calendar, 
  HelpCircle, 
  FileSpreadsheet, 
  Settings,
  ChevronDown,
  Info 
} from 'lucide-react';
import { AppCard } from '../components/ui/AppCard';
import { OperationStorage, ProductLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

export default function ProductStatus() {
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('5'); // Default is 5
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [records, setRecords] = useState<ProductLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

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
        inventoryValuationLoss: 0,
        valuationApplied: 0,
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
  const exRate = ExchangeRateStorage.getRate(activeYear, Number(activeMonth));

  const formatValue = (val: number, unit: '수량' | '금액' | '단가', isMonetaryField: boolean) => {
    // If it's a structural quantity field, return with decimal places and no conversion
    if (unit === '수량' && !isMonetaryField) {
      if (val === 0) return '-';
      return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // Monetary Field Formatting
    if (isMonetaryField || unit === '금액' || unit === '단가') {
      if (val === 0) return '-';
      
      let converted = val;
      if (currencyMode === 'USD') {
        converted = val / exRate;
        if (unit === '단가') {
          return `$${converted.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
        }
        // In USD, show direct converted amount (or divide by 1000 for thousand USD? Full formatting is very standard and legible)
        return `$${Math.round(converted).toLocaleString()}`;
      } else {
        // In KRW
        if (unit === '단가') {
          return `₩${val.toLocaleString()}`;
        }
        // Convert full KRW to millions (백만원) for table output to preserve tidy layout
        const krmM = val / 1_000_000;
        return `₩${Math.round(krmM).toLocaleString()}M`;
      }
    }

    return val === 0 ? '-' : val.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-2.5 shadow-sm animate-fade">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">⚠️ 시뮬레이션 표기 (수불 정보 없음)</span>
            <p className="text-zinc-600 mt-0.5">
              현재 {activeYear}년 {activeMonth}월 제품수불 결과가 업로드되지 않았습니다. 실무 흐름을 보여주기 위해 정성 규격 샘플 데이터가 가동 중입니다.
            </p>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">실무 엑셀 대장 (이미지 1)</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">제품 수불 현황 상세표</h2>
          <p className="text-xs text-zinc-500 mt-1">
            황산니켈, 황산코발트, 탄산리튬 등 핵심 완제품의 기초재고, 당기입합계, 세부 출고항목 및 기말수불 전체를 수불대장 원본 규격으로 확인합니다.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
              }`}
            >
              원화 (백만원M)
            </button>
            <button
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
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Standard Product Subeul Sheet Table (Matching Image 1 EXACTLY!) */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9fa] border-b border-[#dde5de] flex justify-between items-center text-xs">
          <span className="font-bold text-zinc-700 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            POSCO HYCM {activeYear}년 {activeMonth}월 제품수불 정산 장부
          </span>
          <span className="text-zinc-400 font-mono text-[10px]">
            기준 환율: 1 USD = {exRate.toLocaleString()} KRW
          </span>
        </div>

        <div className="overflow-x-auto">
          {/* Grid Layout of Detailed Columns */}
          <table className="min-w-full divide-y divide-[#eef2ec] text-left text-[11px]">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-3 py-3 border-r border-[#e5e8eb] min-w-[90px] text-zinc-700 sticky left-0 bg-[#f7f9f7] z-10">제품명</th>
                <th className="px-2 py-3 border-r border-[#e5e8eb] text-center min-w-[50px] sticky left-[90px] bg-[#f7f9f7] z-10">단위</th>
                <th className="px-2 py-3 text-right text-zinc-600">기초재고</th>
                <th className="px-2 py-3 text-right bg-indigo-50/25">정상입고</th>
                <th className="px-2 py-3 text-right">이동입고</th>
                <th className="px-2 py-3 text-right">반품입고</th>
                <th className="px-2 py-3 text-right">기타입고</th>
                <th className="px-2 py-3 text-right font-extrabold bg-indigo-50/40 text-indigo-900 border-r border-[#eef2ec]">입고합계</th>
                <th className="px-2 py-3 text-right bg-emerald-50/25 font-bold">판매출고</th>
                <th className="px-2 py-3 text-right">재투입</th>
                <th className="px-2 py-3 text-right">보상출고</th>
                <th className="px-2 py-3 text-right">견본출고</th>
                <th className="px-2 py-3 text-right">이동출고</th>
                <th className="px-2 py-3 text-right text-red-700">폐기</th>
                <th className="px-2 py-3 text-right">기타출고</th>
                <th className="px-2 py-3 text-right font-extrabold bg-emerald-50/40 text-emerald-900 border-r border-[#eef2ec]">출고합계</th>
                <th className="px-2 py-3 text-right font-extrabold bg-zinc-100 text-zinc-900">기말재고</th>
                <th className="px-2 py-3 text-right text-rose-600 font-bold">재고평가손</th>
                <th className="px-2 py-3 text-right text-indigo-850">평가손반영</th>
                <th className="px-2 py-3 text-right font-bold text-slate-800">매출액 (T)</th>
                <th className="px-2 py-3 text-right text-slate-705">매출원가 (T)</th>
                <th className="px-2 py-3 text-right font-extrabold text-emerald-800">매출이익 (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white font-mono text-[10.5px]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={22} className="text-center py-8 text-zinc-400 font-sans">
                    표시할 제품 수불 정보가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const isQty = row.unit === '수량';
                  const isAmt = row.unit === '금액';
                  const isPrice = row.unit === '단가';

                  // Apply styling classes based on unit type and rows
                  let bgClass = "hover:bg-[#f7f9f7]/35";
                  if (row.unit === '단가') bgClass += " bg-[#fcfdfd] text-zinc-500 text-[10px]";
                  if (row.unit === '금액') bgClass += " bg-gray-50/30";

                  // Check if this is the start of a product group to merge cell with Rowspan=3
                  const isFirstRow = idx % 3 === 0;

                  return (
                    <tr key={row.id} className={bgClass}>
                      {isFirstRow && (
                        <td 
                          rowSpan={3} 
                          className="px-3 py-3 border-r border-[#e5e8eb] font-sans font-bold text-zinc-900 align-middle text-left bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#dde5de]"
                        >
                          {row.productName}
                          {row.productName === '탄산리튬' && (
                            <span className="block text-[8px] bg-indigo-55 text-indigo-700 px-1 py-0.5 rounded font-normal font-sans mt-0.5">
                              Li 원수량기반
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2 border-r border-[#e5e8eb] text-center font-bold text-zinc-500 sticky left-[90px] bg-white z-10 shadow-[1px_0_0_0_#dde5de]">
                        {row.unit}
                      </td>

                      {/* 기초재고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.beginningInventory, row.unit, false)}</td>

                      {/* 정상입고 */}
                      <td className="px-2 py-2 text-right bg-indigo-50/10 font-bold text-indigo-950">{formatValue(row.normalReceipt, row.unit, false)}</td>

                      {/* 이동입고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.transferReceipt, row.unit, false)}</td>

                      {/* 반품입고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.returnReceipt, row.unit, false)}</td>

                      {/* 기타입고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.otherReceipt, row.unit, false)}</td>

                      {/* 당기입합계 */}
                      <td className="px-2 py-2 text-right bg-indigo-50/20 text-indigo-900 font-extrabold border-r border-[#eef2ec]">{formatValue(row.receiptTotal, row.unit, false)}</td>

                      {/* 판매 (출고) */}
                      <td className="px-2 py-2 text-right bg-emerald-50/10 font-extrabold text-emerald-900">{formatValue(row.salesQuantity, row.unit, false)}</td>

                      {/* 재투입 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.reInput, row.unit, false)}</td>

                      {/* 보상 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.compensation, row.unit, false)}</td>

                      {/* 견본 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.sample, row.unit, false)}</td>

                      {/* 이동출고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.transferIssue, row.unit, false)}</td>

                      {/* 폐기 */}
                      <td className="px-2 py-2 text-right font-semibold text-rose-750">{formatValue(row.disposal, row.unit, false)}</td>

                      {/* 기타출고 */}
                      <td className="px-2 py-2 text-right">{formatValue(row.otherIssue, row.unit, false)}</td>

                      {/* 출고합계 */}
                      <td className="px-2 py-2 text-right bg-emerald-50/20 text-emerald-950 font-extrabold border-r border-[#eef2ec]">{formatValue(row.issueTotal, row.unit, false)}</td>

                      {/* 기말재고 */}
                      <td className="px-2 py-2 text-right bg-zinc-50 font-bold text-zinc-900">{formatValue(row.endingInventory, row.unit, false)}</td>

                      {/* 재고평가손 */}
                      <td className="px-2 py-2 text-right text-rose-600 font-semibold">{formatValue(row.inventoryValuationLoss, row.unit, true)}</td>

                      {/* 평가손반영 */}
                      <td className="px-2 py-2 text-right text-indigo-800">{formatValue(row.valuationApplied, row.unit, true)}</td>

                      {/* 매출액 (T-Col 수량행) */}
                      <td className="px-2 py-2 text-right bg-[#fcfdfd] text-[#111111] font-bold">
                        {isQty ? formatValue(row.revenue, '금액', true) : '-'}
                      </td>

                      {/* 매출원가 (T-Col 금액행) */}
                      <td className="px-2 py-2 text-right bg-[#fcfdfd]">
                        {isQty ? formatValue(row.costOfSales, '금액', true) : '-'}
                      </td>

                      {/* 매출이익 (T-Col 단가행) */}
                      <td className="px-2 py-2 text-right bg-[#fcfdfd] font-extrabold text-teal-800">
                        {isQty ? formatValue(row.grossProfit, '금액', true) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
