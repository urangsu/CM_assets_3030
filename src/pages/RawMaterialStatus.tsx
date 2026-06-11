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
import { ExchangeRateStorage, getSafeExchangeRate, formatExchangeRateLabel } from '../lib/operation/exchangeRateStorage';

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    BP: false,
    BM: false,
    WET: false,
    LCO: false
  });

  const loadData = () => {
    const listMaterials = OperationStorage.getRawMaterialRecords(activeYear);
    setRealMaterials(listMaterials || []);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('operation-ledger-changed', loadData);
    return () => {
      window.removeEventListener('operation-ledger-changed', loadData);
    };
  }, [activeYear]);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const currentExchangeRate = () => {
    const m = activeMonth === 'all' ? 5 : Number(activeMonth);
    return getSafeExchangeRate(activeYear, m);
  };

  const getExchangeRateDisplay = () => {
    const rate = currentExchangeRate();
    return `기준환율: ${formatExchangeRateLabel(rate)}`;
  };

  const formatFinancialValue = (valueKRW: number) => {
    if (currencyMode === 'USD') {
      const rate = currentExchangeRate();
      if (!rate) return '환율 미등록';
      return formatUSDKilo(valueKRW / rate);
    }
    return formatKRWMillion(valueKRW);
  };

  const formatUnitPrice = (priceKRW: number) => {
    if (!priceKRW) return '-';
    if (currencyMode === 'USD') {
      const rate = currentExchangeRate();
      if (!rate) return '환율 미등록';
      const usdPrice = priceKRW / rate;
      return `$${Math.round(usdPrice).toLocaleString()}`;
    }
    return `₩${Math.round(priceKRW).toLocaleString()}`;
  };

  // Filter records based on month & search text
  const filteredRecords = realMaterials.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      const code = (r.rawItemCode || '').toLowerCase();
      const name = (r.rawItemName || r.rawMaterialName || '').toLowerCase();
      const grp = (r.materialGroup || '').toLowerCase();
      return (
        code.includes(query) ||
        name.includes(query) ||
        grp.includes(query)
      );
    }
    return true;
  });

  // Aggregate by specific groups
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
    records: RawMaterialLedgerRecord[];
  }> = {
    BP: { group: 'BP', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0, records: [] },
    BM: { group: 'BM', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0, records: [] },
    WET: { group: 'WET', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0, records: [] },
    LCO: { group: 'LCO', items: [], beginningQty: 0, beginningAmount: 0, purchaseQty: 0, purchaseAmount: 0, issueQty: 0, issueAmount: 0, endingQty: 0, endingAmount: 0, records: [] },
  };

  filteredRecords.forEach(r => {
    const group = r.materialGroup || '기타';
    if (!groupSummaries[group]) {
      groupSummaries[group] = {
        group,
        items: [],
        beginningQty: 0,
        beginningAmount: 0,
        purchaseQty: 0,
        purchaseAmount: 0,
        issueQty: 0,
        issueAmount: 0,
        endingQty: 0,
        endingAmount: 0,
        records: []
      };
    }
    
    const labelCode = r.rawItemCode || '';
    const labelName = r.rawItemName || r.rawMaterialName || '';
    const itemDesc = `${labelCode} (${labelName})`;
    
    if (!groupSummaries[group].items.includes(itemDesc)) {
      groupSummaries[group].items.push(itemDesc);
    }
    groupSummaries[group].records.push(r);
    groupSummaries[group].beginningQty += r.beginningQty || 0;
    groupSummaries[group].beginningAmount += r.beginningAmount || 0;
    groupSummaries[group].purchaseQty += r.receiptTotalQty || r.purchaseQty || 0;
    groupSummaries[group].purchaseAmount += r.receiptTotalAmount || r.purchaseAmount || 0;
    groupSummaries[group].issueQty += r.issueTotalQty || 0;
    groupSummaries[group].issueAmount += r.issueTotalAmount || 0;
    groupSummaries[group].endingQty += r.endingQty || 0;
    groupSummaries[group].endingAmount += r.endingAmount || 0;
  });

  const getSubItemsForGroup = (groupRecords: RawMaterialLedgerRecord[]) => {
    const aggregated: Record<string, {
      rawItemCode: string;
      rawItemName: string;
      beginningQty: number;
      beginningAmount: number;
      purchaseQty: number;
      purchaseAmount: number;
      issueQty: number;
      issueAmount: number;
      endingQty: number;
      endingAmount: number;
    }> = {};

    groupRecords.forEach(r => {
      const code = r.rawItemCode || 'UNKNOWN';
      if (!aggregated[code]) {
        aggregated[code] = {
          rawItemCode: code,
          rawItemName: r.rawItemName || r.rawMaterialName || '',
          beginningQty: 0,
          beginningAmount: 0,
          purchaseQty: 0,
          purchaseAmount: 0,
          issueQty: 0,
          issueAmount: 0,
          endingQty: 0,
          endingAmount: 0,
        };
      }
      aggregated[code].beginningQty += r.beginningQty || 0;
      aggregated[code].beginningAmount += r.beginningAmount || 0;
      aggregated[code].purchaseQty += r.receiptTotalQty || r.purchaseQty || 0;
      aggregated[code].purchaseAmount += r.receiptTotalAmount || r.purchaseAmount || 0;
      aggregated[code].issueQty += r.issueTotalQty || 0;
      aggregated[code].issueAmount += r.issueTotalAmount || 0;
      aggregated[code].endingQty += r.endingQty || 0;
      aggregated[code].endingAmount += r.endingAmount || 0;
    });

    return Object.values(aggregated);
  };

  const SUMMARY_GROUPS = ['BP', 'BM', 'WET', 'LCO'];
  const summaryRows = SUMMARY_GROUPS.map(g => groupSummaries[g]).filter(Boolean);

  return (
    <div className="space-y-6 animate-fade font-sans">
      {/* Empty State Banner when no real ledger exists */}
      {realMaterials.length === 0 && (
        <div className="p-4 bg-[#fff9db] border border-amber-250 text-amber-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs w-full">
          <span className="flex items-center gap-2 font-sans font-semibold">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            업로드된 {activeYear}년도 원자재 수불 기록이 없습니다. 수불부 엑셀 파일을 업로드해 주십시오.
          </span>
          <button 
            onClick={() => navigate('/operation-upload')}
            className="px-3 py-1 bg-[#00786F] hover:bg-[#005f58] text-white font-bold text-[10px] rounded-lg cursor-pointer shrink-0"
          >
            수불부 업로드 화면 이동 →
          </button>
        </div>
      )}

      {/* Missing Exchange Rate Warning Banner */}
      {currencyMode === 'USD' && !currentExchangeRate() && (
        <div id="exchange-rate-warning-box" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-fade">
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
            onClick={() => navigate('/operation-dashboard')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-colors cursor-pointer"
          >
            환율 입력
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
                    <th className="px-3.5 py-4 text-left" rowSpan={2}>원료 구분 (클릭시 세부 전개)</th>
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

                    const isExpanded = !!expandedGroups[row.group];
                    const subItems = getSubItemsForGroup(row.records);

                    return (
                      <React.Fragment key={row.group}>
                        {/* Parent Group Summary Row */}
                        <tr 
                          onClick={() => toggleGroup(row.group)}
                          className="hover:bg-[#f7f9f7]/70 divide-x divide-[#eef2ec] cursor-pointer transition-colors"
                        >
                          {/* Title with collapse state caret */}
                          <td className="px-4 py-3.5 font-sans font-bold text-zinc-900 text-left bg-zinc-50/50 flex items-center gap-2 select-none">
                            <span className="text-zinc-500 text-[10px] w-4 shrink-0 text-center">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span className="underline decoration-dotted decoration-zinc-450 font-extrabold text-zinc-950">
                              {row.group}
                            </span>
                            <span className="text-[10px] text-indigo-650 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded ml-1">
                              {subItems.length}개 품목
                            </span>
                          </td>

                          {/* Beginning */}
                          <td className="px-3 py-3.5 text-right font-medium">{row.beginningQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="px-3 py-3.5 text-right text-zinc-650">{formatFinancialValue(row.beginningAmount)}</td>
                          <td className="px-3 py-3.5 text-right text-zinc-400 text-[10px]">{formatUnitPrice(begPrice)}</td>

                          {/* Purchase Receipts */}
                          <td className="px-3 py-3.5 text-right font-semibold text-teal-800 bg-teal-50/5">{row.purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="px-3 py-3.5 text-right text-teal-700 bg-teal-50/5">{formatFinancialValue(row.purchaseAmount)}</td>
                          <td className="px-3 py-3.5 text-right text-zinc-400 text-[10px] bg-teal-50/5">{formatUnitPrice(purPrice)}</td>

                          {/* Issues */}
                          <td className="px-3 py-3.5 text-right font-semibold text-amber-800 bg-amber-50/5">{row.issueQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="px-3 py-3.5 text-right text-amber-700 bg-amber-50/5">{formatFinancialValue(row.issueAmount)}</td>
                          <td className="px-3 py-3.5 text-right text-zinc-400 text-[10px] bg-amber-50/5">{formatUnitPrice(issPrice)}</td>
                          <td className="px-3 py-3.5 text-center text-zinc-450 text-[10.5px] bg-amber-50/5 font-sans">
                            {availQty > 0 ? `${issueRate.toFixed(1)}%` : '-'}
                          </td>

                          {/* Ending */}
                          <td className="px-3 py-3.5 text-right font-extrabold text-[#111] bg-indigo-50/5">{row.endingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="px-3 py-3.5 text-right font-bold text-indigo-900 bg-indigo-50/5">{formatFinancialValue(row.endingAmount)}</td>
                          <td className="px-3 py-3.5 text-right text-zinc-400 text-[10px] bg-indigo-50/5">{formatUnitPrice(endPrice)}</td>
                        </tr>

                        {/* Collapsible Sub Item Rows */}
                        {isExpanded && (
                          subItems.length > 0 ? (
                            subItems.map((sub, sIdx) => {
                              const subBegPrice = sub.beginningQty > 0 ? (sub.beginningAmount / sub.beginningQty) : 0;
                              const subPurPrice = sub.purchaseQty > 0 ? (sub.purchaseAmount / sub.purchaseQty) : 0;
                              const subIssPrice = sub.issueQty > 0 ? (sub.issueAmount / sub.issueQty) : 0;
                              const subEndPrice = sub.endingQty > 0 ? (sub.endingAmount / sub.endingQty) : 0;
                              const subAvailQty = sub.beginningQty + sub.purchaseQty;
                              const subIssueRate = subAvailQty > 0 ? (sub.issueQty / subAvailQty) * 100 : 0;

                              return (
                                <tr key={`${row.group}_sub_${sub.rawItemCode}`} className="bg-zinc-50/50 hover:bg-zinc-100/80 divide-x divide-[#eef2ec] transition-colors">
                                  {/* Sub-item Header */}
                                  <td className="px-6 py-2.5 text-left font-sans text-[11px] text-zinc-650 max-w-[220px] truncate" title={`${sub.rawItemCode} - ${sub.rawItemName}`}>
                                    <span className="text-zinc-400 mr-2 font-mono">└─</span>
                                    <span className="font-bold text-zinc-900 font-mono">{sub.rawItemCode}</span>
                                    <span className="block text-[10px] text-zinc-500 font-normal truncate pl-5 mt-0.5">{sub.rawItemName}</span>
                                  </td>

                                  {/* Beginning */}
                                  <td className="px-3 py-2.5 text-right text-zinc-605 text-[11px]">{sub.beginningQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className="px-3 py-2.5 text-right text-zinc-500 text-[11px]">{formatFinancialValue(sub.beginningAmount)}</td>
                                  <td className="px-3 py-2.5 text-right text-zinc-400 text-[9.5px]">{formatUnitPrice(subBegPrice)}</td>

                                  {/* Purchase / Receipts */}
                                  <td className="px-3 py-2.5 text-right text-teal-800 font-medium text-[11px] bg-teal-5/10">{sub.purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className="px-3 py-2.5 text-right text-teal-700 text-[11px] bg-teal-5/10">{formatFinancialValue(sub.purchaseAmount)}</td>
                                  <td className="px-3 py-2.5 text-right text-zinc-400 text-[9.5px] bg-teal-5/10">{formatUnitPrice(subPurPrice)}</td>

                                  {/* Issues */}
                                  <td className="px-3 py-2.5 text-right text-amber-800 font-medium text-[11px] bg-amber-5/10">{sub.issueQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className="px-3 py-2.5 text-right text-amber-700 text-[11px] bg-amber-5/10">{formatFinancialValue(sub.issueAmount)}</td>
                                  <td className="px-3 py-2.5 text-right text-zinc-400 text-[9.5px] bg-amber-5/10">{formatUnitPrice(subIssPrice)}</td>
                                  <td className="px-3 py-2.5 text-center text-zinc-450 text-[10px] bg-amber-5/10 font-sans">
                                    {subAvailQty > 0 ? `${subIssueRate.toFixed(1)}%` : '-'}
                                  </td>

                                  {/* Ending */}
                                  <td className="px-3 py-2.5 text-right text-zinc-900 font-bold text-[11px] bg-indigo-5/10">{sub.endingQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className="px-3 py-2.5 text-right text-indigo-850 text-[11px] bg-indigo-5/10">{formatFinancialValue(sub.endingAmount)}</td>
                                  <td className="px-3 py-2.5 text-right text-zinc-400 text-[9.5px] bg-indigo-5/10">{formatUnitPrice(subEndPrice)}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={13} className="px-8 py-4 text-center text-zinc-400 bg-zinc-50/30 font-sans text-xs italic">
                                💡 해당 {row.group} 원료군에 소속되어 정산/기록된 품목이 데이터 원장에 존재하지 않습니다. 수불부를 확인하여 주십시오.
                              </td>
                            </tr>
                          )
                        )}
                      </React.Fragment>
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
