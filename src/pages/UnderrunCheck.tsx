import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Search, 
  HelpCircle, 
  Clock, 
  TrendingDown, 
  Shuffle,
  ThumbsDown,
  CornerDownRight
} from 'lucide-react';
import { 
  formatMillionWon, 
  formatWon
} from '../lib/formatters';
import { getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey, getSubmissionStatus } from '../lib/storageKeys';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';
import ReviewDrawer, { ReviewItem } from '../components/budget/ReviewDrawer';

export default function UnderrunCheck() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const [monthMode, setMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const [underrunRows, setUnderrunRows] = useState<any[]>([]);
  const [totalUnderCount, setTotalUnderCount] = useState(0);

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

    const depts = getViewableDepts(currentUser.code);
    const viewableDeptCodes = depts.map(d => d.code);

    const checkActuals = localStorage.getItem(getActualDataKey('2026'));
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
        console.error(e);
      }
    } else {
      setIsDemoMode(true);
    }

    let itemsList: any[] = [];

    if (!hasRealData) {
      // High-fidelity Seed items having burn rates under 30% for immediate review
      const DEMO_LIST = [
        { dCode: '32100', dName: '기획재무그룹', aCode: 'A51400', aName: '소모품비', b: 15400000, r: 1200000, rSub: '전자 보조도구 소싱 지연' },
        { dCode: '32100', dName: '기획재무그룹', aCode: 'A51100', aName: '업무추진비', b: 8500000, r: 1100000, rSub: '회의 빈도 대폭 감소 공문' },
        { dCode: '32200', dName: '전략소싱그룹', aCode: 'A61100', aName: '공구기구비', b: 65000000, r: 4200000, rSub: '1공장 보헤미안 공정 축소' },
        { dCode: '32305', dName: '안전환경센터', aCode: 'A81000', aName: '온실가스설비', b: 140000000, r: 15000000, rSub: '설비 업그레이드 연말 이월' },
        { dCode: '32400', dName: '품질기술부', aCode: 'A61200', aName: '외주가공비', b: 55000000, r: 8000000, rSub: '자체 품질 정산 대체' }
      ];

      DEMO_LIST.forEach((x, idx) => {
        const submission = getSubmissionStatus(x.dCode, '2026', '경영계획');
        const rate = Number(((x.r / x.b) * 100).toFixed(1));

        itemsList.push({
          id: `demo-underrun-${x.dCode}-${x.aCode}`,
          deptCode: x.dCode,
          deptName: x.dName,
          accountCode: x.aCode,
          accountName: x.aName,
          budgetAmount: x.b,
          actualAmount: x.r,
          differenceAmount: x.b - x.r,
          burnRate: rate,
          anomalyType: 'UNDERRUN',
          remarks: x.rSub,
          status: submission.status,
          statusLabel: submission.status === 'APPROVED' ? '계획 승인' : '작성 중'
        });
      });
    } else {
      // Aggregate real
      depts.forEach(dept => {
        const budgetKey = getBudgetDataKey(dept.code, '2026', '경영계획');
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
        const deptActuals = rawActualRows.filter((r: any) => r.usageCode === dept.code);

        const deptAccountBudgets = new Map<string, any>();
        budgetRows.forEach((brow: any) => {
          let totalBudgetSum = 0;
          if (monthMode === 'MONTH') {
            totalBudgetSum = Number(brow.values[selectedMonth - 1] || 0);
          } else {
            totalBudgetSum = (brow.values || []).slice(0, selectedMonth).reduce((a: number, b: number) => a + Number(b || 0), 0);
          }

          deptAccountBudgets.set(brow.code, {
            accountCode: brow.code,
            accountName: brow.name,
            budgetAmount: totalBudgetSum,
            detail: brow.detail || ''
          });
        });

        // Actuals
        const deptAccountActuals = new Map<string, number>();
        deptActuals.forEach((arow: any) => {
          const mIndex = parseMonthIndex(arow.period);
          if (!shouldIncludeMonth(mIndex, monthMode, selectedMonth)) return;

          const completedSum = Number(arow.completed || 0);
          deptAccountActuals.set(arow.accountCode, (deptAccountActuals.get(arow.accountCode) || 0) + completedSum);
        });

        const allCodes = Array.from(deptAccountBudgets.keys());
        allCodes.forEach(acode => {
          const bInfo = deptAccountBudgets.get(acode);
          const actualVal = deptAccountActuals.get(acode) || 0;
          const budgetVal = bInfo.budgetAmount;

          const rate = budgetVal > 0 ? (actualVal / budgetVal) * 100 : 0;
          if (budgetVal > 1000000 && rate < 30) { // Underrun condition for visible budget items
            const submission = getSubmissionStatus(dept.code, '2026', '경영계획');
            itemsList.push({
              id: `real-underrun-${dept.code}-${acode}`,
              deptCode: dept.code,
              deptName: dept.name,
              accountCode: acode,
              accountName: bInfo.accountName,
              budgetAmount: budgetVal,
              actualAmount: actualVal,
              differenceAmount: budgetVal - actualVal,
              burnRate: Number(rate.toFixed(1)),
              anomalyType: 'UNDERRUN',
              remarks: bInfo.detail || '집행 계획 대비 심의 미배분',
              status: submission.status,
              statusLabel: submission.status === 'APPROVED' ? '승인 완료' : '검토 대기'
            });
          }
        });
      });
    }

    // Apply Reviews
    const activeReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    itemsList = itemsList.map(row => {
      if (activeReviews[row.id]) {
        return {
          ...row,
          status: activeReviews[row.id].status,
          statusLabel: activeReviews[row.id].status === 'APPROVED' ? '조정 최종 승인' : activeReviews[row.id].status === 'ACTION_REQ' ? '부서 통보 조치' : '임시 보류'
        };
      }
      return row;
    });

    const filtered = itemsList.filter(row => {
      if (selectedDept !== 'all' && row.deptCode !== selectedDept) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return (
          row.deptName.toLowerCase().includes(t) ||
          row.accountName.toLowerCase().includes(t) ||
          row.remarks.toLowerCase().includes(t)
        );
      }
      return true;
    });

    setUnderrunRows(filtered);
    setTotalUnderCount(filtered.length);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser, selectedDept, searchTerm, monthMode, selectedMonth]);

  const handleOpenReview = (row: any) => {
    setActiveReviewItem(row);
    setIsDrawerOpen(true);
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Clock className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-xs text-[#4e5968] mt-2 font-sans">미달 항목 관제 필터 분석 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-zinc-100 text-[#4e5968] px-2 py-0.5 rounded font-bold font-mono">Control Board</span>
          <span className="text-xs bg-emerald-50 text-[#008f83] border border-emerald-100 px-2 py-0.5 rounded font-bold">집행 소진 미달 (Under 30%)</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5">
          예산 집행 미달 자금 전입전출 관제판
        </h2>
        <p className="text-xs text-[#647067] mt-1 text-zinc-500">
          계획 대비 집행 실적이 너무 미미한 항목(소진 진척도 30% 미만)들을 추려 한도 삭감, 예산 전출, 회수가 필요한 불용성 예상 전도금을 검증합니다.
        </p>
      </div>

      {/* Metric Callouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-[#647067] block">검출된 불용 예후 항목</span>
          <span className="text-xl font-bold text-zinc-900 font-mono mt-1.5 block">{totalUnderCount}건</span>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-rose-600 block">회수/조치 요청 대상</span>
          <span className="text-xl font-bold text-rose-700 font-mono mt-1.5 block">
            {underrunRows.filter(r => r.burnRate < 10).length}건 (집행률 10% 미만 중점)
          </span>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-emerald-800 block">집행 완료 가치 추정</span>
          <span className="text-xl font-bold text-emerald-800 font-mono mt-1.5 block" title={formatWon(underrunRows.reduce((acc, row) => acc + row.actualAmount, 0))}>
            {formatMillionWon(underrunRows.reduce((acc, row) => acc + row.actualAmount, 0))}
          </span>
        </div>
      </div>

      {/* Tool Filters */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs flex flex-col sm:flex-row gap-3">
        <select
          value={monthMode}
          onChange={(e) => setMonthMode(e.target.value as MonthMode)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-32"
        >
          <option value="YTD">누계</option>
          <option value="MONTH">단월</option>
        </select>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-32"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-60"
        >
          <option value="all">전체 부서 조회</option>
          {getViewableDepts(currentUser.code).map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
            placeholder="부서명, 대리인, 계정 명세 검색..."
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">부서명 (코드)</th>
              <th className="px-5 py-3">계정명 (코드)</th>
              <th className="px-5 py-3 text-right">편성 예산</th>
              <th className="px-5 py-3 text-right">실제 집행</th>
              <th className="px-5 py-3 text-right">미소진 회수가능액</th>
              <th className="px-5 py-3 text-center">집행률 (30% 이하)</th>
              <th className="px-5 py-3">지연 사유 요약</th>
              <th className="px-5 py-3 text-center">결재 조치</th>
              <th className="px-5 py-3 text-center font-bold">통보</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {underrunRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-zinc-400 font-medium font-sans">
                  미집행 불용 예후가 30% 미만으로 도출된 부서 세목이 현재 발견되지 않았습니다.
                </td>
              </tr>
            ) : (
              underrunRows.map(row => (
                <tr key={row.id} className="hover:bg-[#f7f9f7]/60">
                  <td className="px-5 py-4 font-semibold text-[#111111]">
                    {row.deptName}
                    <span className="text-[10px] text-zinc-400 font-mono block font-normal">{row.deptCode}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-[#111111]">{row.accountName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono block font-normal">{row.accountCode}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-zinc-500">
                    {row.budgetAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-[#008f83]">
                    {row.actualAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-medium text-rose-600">
                    {row.differenceAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-[#111111] font-mono">{row.burnRate}%</span>
                      <div className="w-12 bg-zinc-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-zinc-400" style={{ width: `${row.burnRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-xs italic">
                    {row.remarks || '연말 일괄 정산 예정'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'APPROVED' ? 'bg-emerald-50 text-[#008f83]' : row.status === 'ACTION_REQ' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleOpenReview(row)}
                      className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#dde5de] text-zinc-700 hover:border-teal-500 hover:text-teal-600 font-semibold rounded cursor-pointer transition-all"
                    >
                      조치 상신/배전
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
