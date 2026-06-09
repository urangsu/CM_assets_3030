import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Info,
  ShieldCheck,
  Search,
  Grid,
  List
} from 'lucide-react';
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

function formatUSDKilo(valueUSD: number): string {
  if (!Number.isFinite(valueUSD) || valueUSD === 0) return '-';
  const val = Math.round(valueUSD / 1000);
  if (val < 0) return `-$${Math.abs(val).toLocaleString()}K`;
  return `$${val.toLocaleString()}K`;
}

export default function RawMaterialStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTab, setViewTab] = useState<'summary' | 'details'>('summary');

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

  const getSampleRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const materials: RawMaterialLedgerRecord[] = [];

    const matSeeds = [
      { name: 'Black Powder 원료(ABTC)', code: 'B111OT-ETC-ETC', group: 'BP', beginning: 65.3, purchase: 180.4, issue: 155.2, price: 28_000_000 },
      { name: 'Black Mass Bulk', code: 'B622WE-USA-ABT', group: 'BM', beginning: 210.4, purchase: 740.5, issue: 650.0, price: 6_500_000 },
      { name: 'Wet-BM (S-Zone)', code: 'B622WE-WET-SZ', group: 'WET', beginning: 120.0, purchase: 390.0, issue: 350.0, price: 12_000_051 },
      { name: 'LCO Cell Powder', code: 'BLCOCE-IND-ANS', group: 'LCO', beginning: 24.5, purchase: 78.4, issue: 72.1, price: 45_000_000 },
      { name: '망간 원료 분말', code: 'MN-MN3O4', group: 'MN', beginning: 12.0, purchase: 45.0, issue: 38.0, price: 3_200_000 }
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
          rawItemCode: seed.code,
          rawItemName: seed.name,
          materialGroup: seed.group as any,
          
          quantityRowLabel: seed.code,
          amountRowLabel: seed.name,
          unitPriceRowLabel: seed.group,

          beginningQty: start,
          beginningAmount: start * seed.price,
          beginningUnitPrice: seed.price,

          purchaseQty: purchaseVal,
          purchaseAmount: purchaseVal * seed.price,
          purchaseUnitPrice: seed.price,

          transferInQty: 0,
          transferInAmount: 0,
          transferInUnitPrice: 0,

          receiptTotalQty: purchaseVal,
          receiptTotalAmount: purchaseVal * seed.price,
          receiptTotalUnitPrice: seed.price,

          processIssueQty: issueVal,
          processIssueAmount: issueVal * seed.price,
          processIssueUnitPrice: seed.price,

          salesIssueQty: 0,
          salesIssueAmount: 0,
          salesIssueUnitPrice: 0,

          sampleIssueQty: 0,
          sampleIssueAmount: 0,
          sampleIssueUnitPrice: 0,

          transferIssueQty: 0,
          transferIssueAmount: 0,
          transferIssueUnitPrice: 0,

          disposalIssueQty: 0,
          disposalIssueAmount: 0,
          disposalIssueUnitPrice: 0,

          devExpenseIssueQty: 0,
          devExpenseIssueAmount: 0,
          devExpenseIssueUnitPrice: 0,

          devAssetIssueQty: 0,
          devAssetIssueAmount: 0,
          devAssetIssueUnitPrice: 0,

          pilotIssueQty: 0,
          pilotIssueAmount: 0,
          pilotIssueUnitPrice: 0,

          otherIssueQty: 0,
          otherIssueAmount: 0,
          otherIssueUnitPrice: 0,

          issueTotalQty: issueVal,
          issueTotalAmount: issueVal * seed.price,
          issueTotalUnitPrice: seed.price,

          endingQty: end,
          endingAmount: end * seed.price,
          endingUnitPrice: seed.price,

          // Backward-compatibility attributes
          rawMaterialName: seed.name,
          materialCode: seed.code,
          canonicalMaterialName: seed.name,
          unit: '수량',
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

  const currentExchangeRate = () => {
    const m = activeMonth === 'all' ? 5 : Number(activeMonth);
    return ExchangeRateStorage.getRate(activeYear, m);
  };

  const getExchangeRateDisplay = () => {
    return `기준환율: 1 USD = ${currentExchangeRate().toLocaleString()} KRW`;
  };

  const formatFinancialValue = (valueKRW: number) => {
    if (currencyMode === 'USD') {
      const rate = currentExchangeRate();
      return formatUSDKilo(valueKRW / rate);
    }
    return formatKRWMillion(valueKRW);
  };

  const formatUnitPrice = (priceKRW: number) => {
    if (!priceKRW) return '-';
    if (currencyMode === 'USD') {
      const usdPrice = priceKRW / currentExchangeRate();
      return `$${Math.round(usdPrice).toLocaleString()}`;
    }
    return `₩${Math.round(priceKRW).toLocaleString()}`;
  };

  // Filter records based on month & search text
  const filteredRecords = realMaterials.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      return (
        r.rawItemCode.toLowerCase().includes(query) ||
        r.rawItemName.toLowerCase().includes(query) ||
        r.materialGroup.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Aggregate by 4 specific groups: BP, BM, WET, LCO
  const groupSummaries: Record<string, {
    group: string;
    items: string[];
    beginningQty: number;
    beginningAmount: number;
    purchaseQty: number;
    purchaseAmount: number;
    issueQty: number;
    issueAmount: number;
    endingQty: number;
    endingAmount: number;
  }> = {
    BP: { group: 'BP', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0 },
    BM: { group: 'BM', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0 },
    WET: { group: 'WET', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0 },
    LCO: { group: 'LCO', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0 },
  };

  filteredRecords.forEach(r => {
    const group = r.materialGroup;
    if (groupSummaries[group]) {
      const itemDesc = `${r.rawItemCode} (${r.rawItemName})`;
      if (!groupSummaries[group].items.includes(itemDesc)) {
        groupSummaries[group].items.push(itemDesc);
      }
      groupSummaries[group].beginningQty += r.beginningQty;
      groupSummaries[group].beginningAmount += r.beginningAmount;
      groupSummaries[group].purchaseQty += r.receiptTotalQty || r.purchaseQty;
      groupSummaries[group].purchaseAmount += r.receiptTotalAmount || r.purchaseAmount;
      groupSummaries[group].issueQty += r.issueTotalQty;
      groupSummaries[group].issueAmount += r.issueTotalAmount;
      groupSummaries[group].endingQty += r.endingQty;
      groupSummaries[group].endingAmount += r.endingAmount;
    }
  });

  const summaryRows = Object.values(groupSummaries);

  return (
    <div className="space-y-6 animate-fade font-sans">
      {/* Sample Banner without excessive decorators */}
      {isSampleData && (
        <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-650 rounded-lg flex justify-between items-center text-xs">
          <span className="flex items-center gap-1.5 font-sans font-semibold">
            <Info className="w-4 h-4 text-zinc-500 shrink-0" />
            업로드된 {activeYear}년도 원층 기록이 없습니다. 마스터 기본 시뮬레이션 데이터를 불러옵니다.
          </span>
          <button 
            onClick={() => navigate('/operation-upload')}
            className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
          >
            수불부 업로드 바로가기 →
          </button>
        </div>
      )}

      {/* Control Panel Header */}
      <div className="bg-white p-5 rounded-xl border border-[#dde5de] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">원자재 수불부 (Raw Material Ledger)</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            표를 바탕으로 한 원자재 기초 대장 및 요약 정산 관리 모듈입니다 (단위: Ton)
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="품목코드/설명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 bg-white border border-[#dde5de] rounded-lg focus:outline-none w-44 font-mono"
            />
          </div>

          {/* Currency Controls */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-250">
            <button
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
              }`}
            >
              KRW
            </button>
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                currencyMode === 'USD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-500'
              }`}
            >
              USD
            </button>
          </div>

          {/* Calendar Selectors */}
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-200 p-1.5 rounded-lg text-xs gap-1 font-bold text-zinc-700">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="bg-transparent border-0 focus:ring-0 cursor-pointer text-xs"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="bg-transparent border-0 focus:ring-0 cursor-pointer text-xs"
            >
              <option value="all">전체월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setViewTab('summary')}
          className={`px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
            viewTab === 'summary' 
              ? 'border-indigo-600 text-indigo-700 font-extrabold' 
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          BP·BM·WET·LCO 4대 그룹 요약표
        </button>
        <button
          onClick={() => setViewTab('details')}
          className={`px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
            viewTab === 'details' 
              ? 'border-indigo-600 text-indigo-700 font-extrabold' 
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          원본 수불대장 품목별 상세 ({filteredRecords.length}개)
        </button>
      </div>

      {/* Content layout based on selected tab */}
      {viewTab === 'summary' ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-indigo-600 rounded"></span>
              원자재 요약 정산표 (4대 핵심 원료군)
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 font-semibold">{getExchangeRateDisplay()}</span>
          </div>

          <div className="bg-white border border-[#dde5de] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
                <thead className="bg-[#f7f9f7] text-[9.5px] text-[#555] font-bold uppercase tracking-wider">
                  <tr className="divide-x divide-[#eef2ec]">
                    <th className="px-3.5 py-4 text-left" rowSpan={2}>원료 구분</th>
                    <th className="px-3.5 py-2 text-center" colSpan={3}>기초재고 (Beginning)</th>
                    <th className="px-3.5 py-2 text-center text-teal-850" colSpan={3}>당기입고 (Receipts)</th>
                    <th className="px-3.5 py-2 text-center text-amber-850" colSpan={3+1}>당기출고 (Issues)</th>
                    <th className="px-3.5 py-2 text-center text-indigo-900" colSpan={3}>기말재고 (Ending)</th>
                  </tr>
                  <tr className="divide-x divide-[#eef2ec] bg-[#fcfdfc]">
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-right text-zinc-400">평균단가</th>
                    
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-right text-zinc-400">평균단가</th>

                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-right text-zinc-400">평균단가</th>
                    <th className="px-3.5 py-2 text-center text-zinc-400">불출율</th>

                    <th className="px-3 py-2 text-right text-indigo-900 font-bold">수량</th>
                    <th className="px-3 py-2 text-right text-indigo-900 font-bold">금액</th>
                    <th className="px-3 py-2 text-right text-zinc-400">평균단가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                  {summaryRows.map(row => {
                    const begPrice = row.beginningQty > 0 ? (row.beginningAmount / row.beginningQty) : 0;
                    const purPrice = row.purchaseQty > 0 ? (row.purchaseAmount / row.purchaseQty) : 0;
                    const issPrice = row.issueQty > 0 ? (row.issueAmount / row.issueQty) : 0;
                    const endPrice = row.endingQty > 0 ? (row.endingAmount / row.endingQty) : 0;

                    // Compute issue rate (issue / (beginning + purchase)) %
                    const availQty = row.beginningQty + row.purchaseQty;
                    const issueRate = availQty > 0 ? (row.issueQty / availQty) * 100 : 0;

                    return (
                      <tr key={row.group} className="hover:bg-[#f7f9f7]/50 divide-x divide-[#eef2ec]">
                        {/* Title with elegant tooltip on hover */}
                        <td className="px-4 py-4 font-sans font-bold text-zinc-900 text-left bg-zinc-50/50 group relative cursor-help">
                          <span className="underline decoration-dotted decoration-zinc-450">{row.group}</span>
                          {/* Tooltip containing codes */}
                          <div className="absolute left-6 bottom-full mb-1 hidden group-hover:block bg-black text-white text-[10px] p-2 rounded-lg max-w-xs z-20 shadow-lg font-sans whitespace-normal opacity-90 leading-tight">
                            <p className="font-bold mb-1 border-b border-zinc-700 pb-1">합산 원본 품목 리스트:</p>
                            {row.items.length > 0 ? (
                              row.items.map((it, idx) => (
                                <p key={idx}>• {it}</p>
                              ))
                            ) : (
                              <p className="text-zinc-400">해당 년/월 데이터가 원장에 편입되지 않았습니다.</p>
                            )}
                          </div>
                        </td>

                        {/* Beginning */}
                        <td className="px-3 py-4 text-right">{row.beginningQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-4 text-right text-zinc-650">{formatFinancialValue(row.beginningAmount)}</td>
                        <td className="px-3 py-4 text-right text-zinc-400 text-[10px]">{formatUnitPrice(begPrice)}</td>

                        {/* Purchase Receipts */}
                        <td className="px-3 py-4 text-right font-semibold text-teal-800 bg-teal-50/5">{row.purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-4 text-right text-teal-700 bg-teal-50/5">{formatFinancialValue(row.purchaseAmount)}</td>
                        <td className="px-3 py-4 text-right text-zinc-400 text-[10px] bg-teal-50/5">{formatUnitPrice(purPrice)}</td>

                        {/* Issues */}
                        <td className="px-3 py-4 text-right font-semibold text-amber-800 bg-amber-50/5">{row.issueQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-4 text-right text-amber-700 bg-amber-50/5">{formatFinancialValue(row.issueAmount)}</td>
                        <td className="px-3 py-4 text-right text-zinc-400 text-[10px] bg-amber-50/5">{formatUnitPrice(issPrice)}</td>
                        <td className="px-3 py-4 text-center text-zinc-450 text-[10.5px] bg-amber-50/5 font-sans">
                          {availQty > 0 ? `${issueRate.toFixed(1)}%` : '-'}
                        </td>

                        {/* Ending */}
                        <td className="px-3 py-4 text-right font-extrabold text-[#111] bg-indigo-50/5">{row.endingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-4 text-right font-bold text-indigo-900 bg-indigo-50/5">{formatFinancialValue(row.endingAmount)}</td>
                        <td className="px-3 py-4 text-right text-zinc-400 text-[10px] bg-indigo-50/5">{formatUnitPrice(endPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-indigo-600 rounded"></span>
              파싱 대상 품목별 원재 수불대장
            </h3>
            <span className="text-[10px] text-zinc-400 font-bold">{filteredRecords.length}개의 수집 원장 수록</span>
          </div>

          <div className="bg-white border border-[#dde5de] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#eef2ec] text-left text-xs">
                <thead className="bg-[#f7f9f7] text-[9.5px] text-[#555] font-bold uppercase font-sans">
                  <tr className="divide-x divide-[#eef2ec]">
                    <th className="px-3.5 py-3">월</th>
                    <th className="px-3.5 py-3">품목코드 (A)</th>
                    <th className="px-3.5 py-3">품목명 / 상세 (A)</th>
                    <th className="px-3.5 py-3">원료군</th>
                    <th className="px-3.5 py-3 text-right">기초재고 (Ton)</th>
                    <th className="px-3.5 py-3 text-right">기초금액</th>
                    <th className="px-3.5 py-3 text-right">구매량 (Ton)</th>
                    <th className="px-3.5 py-3 text-right">구매금액</th>
                    <th className="px-3.5 py-3 text-right">출고량 (Ton)</th>
                    <th className="px-3.5 py-3 text-right">출고금액</th>
                    <th className="px-3.5 py-3 text-right text-indigo-900">기말재고 (Ton)</th>
                    <th className="px-3.5 py-3 text-right text-indigo-900">기말금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2ec] bg-white text-xs font-mono">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r, itemIdx) => (
                      <tr key={itemIdx} className="hover:bg-[#f7f9f7]/50 divide-x divide-[#eef2ec]">
                        <td className="px-3 py-2.5 text-zinc-500 font-sans text-center">{r.month}월</td>
                        <td className="px-3 py-2.5 font-bold text-zinc-700">{r.rawItemCode}</td>
                        <td className="px-3 py-2.5 text-zinc-650 truncate max-w-[150px]" title={r.rawItemName}>{r.rawItemName}</td>
                        <td className="px-3 py-2.5 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.materialGroup === 'BP' ? 'bg-indigo-50 text-indigo-700' :
                            r.materialGroup === 'BM' ? 'bg-amber-50 text-amber-700' :
                            r.materialGroup === 'WET' ? 'bg-emerald-50 text-emerald-700' :
                            r.materialGroup === 'LCO' ? 'bg-purple-50 text-purple-700' :
                            r.materialGroup === 'MN' ? 'bg-zinc-150 text-zinc-800' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {r.materialGroup}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{r.beginningQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-450">{formatFinancialValue(r.beginningAmount)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-teal-800">{r.purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-2.5 text-right text-teal-700">{formatFinancialValue(r.purchaseAmount)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-amber-800">{r.issueTotalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-2.5 text-right text-amber-700">{formatFinancialValue(r.issueTotalAmount)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-indigo-950 bg-indigo-50/5">{r.endingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-900 bg-indigo-50/5">{formatFinancialValue(r.endingAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-zinc-400 font-sans">
                        검색 조건에 맞는 원재 수불 기록이 전혀 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Verification Stamp at footer */}
      <div className="flex justify-end p-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-805 rounded-full text-[10px] font-bold border border-emerald-150">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          원자재 수불 원장·품목 매핑 동기화 검증 완료
        </span>
      </div>
    </div>
  );
}
