import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Filter, 
  AlertCircle,
  TrendingUp,
  Sliders,
  AlertTriangle
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
import { 
  formatMillionWon, 
  formatWon, 
  formatMillionWonWithFull 
} from '../lib/formatters';
import { getViewableDepts } from '../constants';
import { getActualDataKey } from '../lib/storageKeys';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';
import ReviewDrawer, { ReviewItem } from '../components/budget/ReviewDrawer';

export default function ExecutionLedger() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Filters
  const [year, setYear] = useState('2026');
  const [monthMode, setMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Page States
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    totalCount: 0,
    totalAmount: 0,
    averageAmount: 0,
    overrunLedgerCount: 0
  });

  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [accountBreakdown, setAccountBreakdown] = useState<any[]>([]);

  // Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewItem | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('current_user');
    if (u) {
      setCurrentUser(JSON.parse(u));
    }
  }, []);

  const loadData = () => {
    if (!currentUser) return;
    setIsLoading(true);

    const checkActuals = localStorage.getItem(getActualDataKey(year));
    let rawActualRows: any[] = [];
    let hasRealData = false;

    if (checkActuals) {
      try {
        const parsed = JSON.parse(checkActuals);
        if (parsed && parsed.length > 0) {
          rawActualRows = parsed;
          hasRealData = true;
          setIsDemoMode(false);
        }
      } catch (e) {
        console.error('Failed parse', e);
      }
    }

    if (!hasRealData) {
      setIsDemoMode(true);
    }

    const depts = getViewableDepts(currentUser.code);
    const viewableDeptCodes = depts.map(d => d.code);

    let processedRows: any[] = [];

    if (!hasRealData) {
      // Simulate rich Actual Data records
      const mockDates = ['01', '02', '03', '04', '05'];
      const mockAccounts = [
        { code: 'A51100', name: '업무추진비', cat: '판관경비' },
        { code: 'A51200', name: '업무활동비', cat: '판관경비' },
        { code: 'A51300', name: '여비교통비', cat: '판관경비' },
        { code: 'A51400', name: '소모품비', cat: '판관경비' },
        { code: 'A61100', name: '공구기구비', cat: '제조경비' },
        { code: 'A61200', name: '외주가공비', cat: '제조경비' },
        { code: 'A61500', name: '기타복리후생비', cat: '제조경비' },
        { code: 'A71000', name: '안전보건설비', cat: '투자예산' }
      ];

      depts.forEach((dept, dIdx) => {
        mockDates.forEach((m, mIdx) => {
          mockAccounts.forEach((account, aIdx) => {
            // Generate some ledger entries
            const amount = Math.floor((dIdx + 1) * (aIdx + 1) * (mIdx + 2) * 580000);
            const isAbnormal = dIdx === 1 && aIdx === 2 && mIdx === 3;
            
            processedRows.push({
              id: `demo-ledger-${dept.code}-${account.code}-${m}`,
              year: '2026',
              month: `${parseInt(m)}월`,
              accountCode: account.code,
              accountName: account.name,
              controlType: account.cat,
              usageCode: dept.code,
              usageDept: dept.name,
              amount: isAbnormal ? amount * 2.5 : amount,
              remarks: isAbnormal ? '설비 긴급 오버하울 교체 구매' : '분기정기 소요 분',
              status: 'DRAFT',
              statusLabel: '임시 작성 중'
            });
          });
        });
      });
    } else {
      // Real Data parsing
      rawActualRows.forEach((r: any, idx: number) => {
        // Find dept name
        const matchDept = depts.find(d => d.code === r.usageCode);
        if (currentUser.code !== '99999' && !viewableDeptCodes.includes(r.usageCode)) {
          return; // skip non-viewable
        }

        let rowMonth = '1월';
        if (r.month) rowMonth = `${parseInt(r.month)}월`;
        else if (r.period) {
          const match = r.period.match(/(\d+)월/);
          rowMonth = match ? `${match[1]}월` : r.period;
        }

        processedRows.push({
          id: r.id || `real-ledger-${idx}`,
          year: r.year || year,
          month: rowMonth,
          accountCode: r.accountCode,
          accountName: r.accountName,
          controlType: r.controlType || '판관경비',
          usageCode: r.usageCode,
          usageDept: matchDept ? matchDept.name : (r.usageDept || '외부 위탁부서'),
          amount: Number(r.completed || r.amount || 0),
          remarks: r.remarks || '',
          status: 'DRAFT',
          statusLabel: '검증 완료'
        });
      });
    }

    // Attach active reviews checks
    const activeReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    processedRows = processedRows.map(row => {
      if (activeReviews[row.id]) {
        const ar = activeReviews[row.id];
        return {
          ...row,
          status: ar.status,
          statusLabel: ar.status === 'APPROVED' ? '계획 승인' : ar.status === 'ACTION_REQ' ? '조치 요청' : ar.status === 'REJECTED' ? '집행 반려' : '임시 보류'
        };
      }
      return row;
    });

    // Apply Filter Logic
    const filtered = processedRows.filter(row => {
      const monthIdx = parseMonthIndex(row.month);
      if (!shouldIncludeMonth(monthIdx, monthMode, selectedMonth)) return false;

      if (selectedDept !== 'all' && row.usageCode !== selectedDept) return false;
      if (selectedCategory !== 'all' && row.controlType !== selectedCategory) return false;
      if (selectedStatus !== 'all' && row.status !== selectedStatus) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.accountName.toLowerCase().includes(term) ||
          row.accountCode.toLowerCase().includes(term) ||
          row.usageDept.toLowerCase().includes(term) ||
          row.remarks.toLowerCase().includes(term)
        );
      }
      return true;
    });

    setLedgerRows(filtered);

    // Compute metrics
    const sumAmount = filtered.reduce((a, b) => a + b.amount, 0);
    const avgAmount = filtered.length > 0 ? Math.round(sumAmount / filtered.length) : 0;
    const abnormalCount = filtered.filter(f => f.amount > 5000000).length; // Over 5M threshold is abnormal

    setKpis({
      totalCount: filtered.length,
      totalAmount: sumAmount,
      averageAmount: avgAmount,
      overrunLedgerCount: abnormalCount
    });

    // Monthly actual trend chart
    const monthSum = new Map<string, number>();
    Array.from({ length: 12 }, (_, i) => `${i + 1}월`).forEach(m => monthSum.set(m, 0));
    filtered.forEach(row => {
      monthSum.set(row.month, (monthSum.get(row.month) || 0) + row.amount);
    });
    setMonthlyTrend(Array.from(monthSum.entries()).map(([m, val]) => ({
      month: m,
      '실제 집행': val
    })));

    // Account breakdowns
    const acctSum = new Map<string, number>();
    filtered.forEach(row => {
      acctSum.set(row.accountName, (acctSum.get(row.accountName) || 0) + row.amount);
    });
    setAccountBreakdown(Array.from(acctSum.entries()).map(([name, sum]) => ({
      name: name.slice(0, 8),
      집행총액: sum
    })).sort((a, b) => b.집행총액 - a.집행총액).slice(0, 8));

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser, year, monthMode, selectedMonth, selectedDept, selectedCategory, selectedStatus, searchTerm]);

  const handleOpenReview = (row: any) => {
    setActiveReviewItem({
      id: row.id,
      deptCode: row.usageCode,
      deptName: row.usageDept,
      accountCode: row.accountCode,
      accountName: row.accountName,
      month: row.month,
      budgetAmount: row.amount * 0.9, // approximate budget for comparison inside review drawer
      actualAmount: row.amount,
      differenceAmount: Math.round(row.amount * 0.1),
      burnRate: 110,
      anomalyType: row.amount > 5000000 ? 'OVERRUN' : 'NORMAL'
    });
    setIsDrawerOpen(true);
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-sm text-[#4e5968] font-sans">실제 전도금 및 집행 장부 동기화 중...</span>
      </div>
    );
  }

  const uniqueDeptsList = getViewableDepts(currentUser.code);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-zinc-100 text-[#4e5968] px-2 py-0.5 rounded font-bold font-mono">Ledger Database</span>
            {isDemoMode && <span className="text-[10px] bg-[#fdf0e2] text-[#F7A059] border border-[#fbd6b4] px-1.5 py-0.5 rounded font-bold">SAMPLE CONTEXT</span>}
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            공장 및 부서 수급 실제 집행 내역 장부
          </h2>
          <p className="text-xs text-[#647067] mt-1">
            원장 Excel 양식 업로드 혹은 현장 직접 집금으로 적재된 전사 거래 세목 한도 집행 결과를 월별 통제 테이블로 열람합니다.
          </p>
        </div>
      </div>

      {/* 2. Advanced Multi-Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#111111] border-b border-[#eef2ec] pb-2.5">
          <Sliders className="w-3.5 h-3.5 text-[#008f83]" />
          <span>집행 원장 검색 관제실</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Year selection */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">회계 연도</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="2026">2026년 기준</option>
              <option value="2025">2025년 기준</option>
            </select>
          </div>

          {/* Month Mode */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">조회 기준</label>
            <select 
              value={monthMode}
              onChange={(e) => setMonthMode(e.target.value as MonthMode)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="YTD">누계</option>
              <option value="MONTH">단월</option>
            </select>
          </div>

          {/* Selected Month */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">기준 월</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">사용 부서</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="all">전체 부서 [All]</option>
              {uniqueDeptsList.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Account category */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">예산 성질 분류</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="all">전체 성질군</option>
              <option value="판관경비">판관경비 대분류</option>
              <option value="제조경비">제조 가공 경비</option>
              <option value="투자예산">투자 안전 부문</option>
            </select>
          </div>

          {/* Status tracking */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">검증 결재 상태</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="all">전체 결재 상태</option>
              <option value="DRAFT">검증 완료 / 자동 통과</option>
              <option value="ACTION_REQ">조치 요청 대상</option>
              <option value="APPROVED">조정 승인 완료</option>
              <option value="REJECTED">반려 및 자금 동결</option>
              <option value="HELD">검증 보류 중</option>
            </select>
          </div>
        </div>

        {/* Free-text Query */}
        <div className="relative group">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400 font-sans"
            placeholder="계정명, 계정코드, 사용부서명, 대리인, 집행 적요/비고 내용 검색..."
          />
        </div>
      </div>

      {/* 3. Operational KPIs Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">검색 집행 거래수</span>
          <span className="text-xl font-bold text-[#111111] mt-2 font-mono block">{kpis.totalCount}건</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-[#008f83] uppercase block tracking-wider">총 거래 누계 집행액</span>
          <span className="text-xl font-bold text-[#008f83] mt-2 font-mono block" title={formatWon(kpis.totalAmount)}>{formatMillionWon(kpis.totalAmount)}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">건별 평균 집행 고정비</span>
          <span className="text-xl font-bold text-[#111111] mt-2 font-mono block" title={formatWon(kpis.averageAmount)}>{formatMillionWon(kpis.averageAmount)}</span>
        </div>
        <div className="bg-amber-50/50 border border-[#fbd6b4] p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-[#F7A059] uppercase block tracking-wider">500만 이상 주요 지출건</span>
          <span className="text-xl font-bold text-amber-600 mt-2 font-mono block">{kpis.overrunLedgerCount}건 발견</span>
        </div>
      </div>

      {/* 4. Visual Charts Segment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area Chart */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
          <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#008f83]" /> 월별 실제 집행 흐름 분석
          </h3>
          <div className="h-[210px] w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000).toLocaleString('ko-KR')}`} />
                <Tooltip formatter={(value: any) => [formatMillionWonWithFull(Number(value)), '']} />
                <Legend iconType="circle" />
                <Line type="monotone" name="실제 집행" dataKey="실제 집행" stroke="#008f83" strokeWidth={2.5} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
          <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#008f83]" /> 품목계정별 집행집중도 top
          </h3>
          <div className="h-[210px] w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2ec" />
                <XAxis type="number" fontSize={9} stroke="#8b95a1" axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000).toLocaleString('ko-KR')}`} />
                <YAxis dataKey="name" type="category" fontSize={9} stroke="#111111" axisLine={false} tickLine={false} width={65} />
                <Tooltip formatter={(v: any) => [formatMillionWonWithFull(Number(v)), '']} />
                <Bar name="소진액" dataKey="집행총액" fill="#718872" radius={[0, 4, 4, 0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Execution Data Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#eef2ec] flex justify-between items-center bg-[#fcfdfe]">
          <div>
            <h3 className="text-sm font-bold text-[#111111]">통제 실적 원장 개별 리스트 ({ledgerRows.length}개 항목)</h3>
            <p className="text-[11px] text-[#647067] mt-0.5">조회 권한에 보정된 실제 집행 리스트 상세 내역 정보</p>
          </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7]">
              <tr className="text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <th className="px-5 py-3">연도/발생월</th>
                <th className="px-5 py-3">용도 부서명</th>
                <th className="px-5 py-3">계정 품명 (코드)</th>
                <th className="px-5 py-3">분류</th>
                <th className="px-5 py-3 text-right">집행 한도액</th>
                <th className="px-5 py-3 text-center">결재 검증상질</th>
                <th className="px-5 py-3">적요 및 비고</th>
                <th className="px-5 py-3 text-center">감사/수정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-zinc-400 font-medium">
                    해당 세목 조건에 매칭되는 집행 원장 데이터가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => {
                  const isHigh = row.amount >= 5000000;
                  
                  return (
                    <tr key={row.id} className="hover:bg-[#f7f9f7] transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono">
                        {row.year}년 <span className="text-teal-600 font-bold">{row.month}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-[#111111]">{row.usageDept}</span>
                        <span className="text-[10px] font-mono text-[#8b95a1] block">{row.usageCode}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-[#111111]">{row.accountName}</span>
                        <span className="text-[10px] font-mono text-[#8b95a1] block">{row.accountCode}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-zinc-500">
                        {row.controlType}
                      </td>
                      <td className={`px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold ${isHigh ? 'text-amber-600 text-sm' : 'text-[#111111]'}`}>
                        {row.amount.toLocaleString()}원
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'APPROVED' ? 'bg-emerald-50 text-[#008f83]' : row.status === 'ACTION_REQ' ? 'bg-amber-100 text-amber-700' : row.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate" title={row.remarks}>
                        {row.remarks || '-'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <button 
                          onClick={() => handleOpenReview(row)}
                          className="p-1 px-2 bg-white hover:bg-zinc-100 text-zinc-500 border border-[#dde5de] rounded-md hover:border-[#008f83] hover:text-[#008f83] cursor-pointer transition-all text-xs font-semibold"
                        >
                          의견검증
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReviewDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={activeReviewItem}
        onSave={loadData}
      />
    </div>
  );
}
