import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  Search, 
  HelpCircle, 
  Clock, 
  Trash2, 
  TrendingUp, 
  ShieldAlert,
  CornerDownRight
} from 'lucide-react';
import { getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey, getSubmissionStatus } from '../lib/storageKeys';
import ReviewDrawer, { ReviewItem } from '../components/budget/ReviewDrawer';

export default function UnbudgetedCheck() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const [unbudgetedRows, setUnbudgetedRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalLeakAmount, setTotalLeakAmount] = useState(0);

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
      // High-fidelity Mock items for Unbudgeted expenditures
      const DEMO_LIST = [
        { dCode: '32100', dName: '기획재무그룹', aCode: 'A71000', aName: '안전보건설비', r: 4500000, desc: '안전 장비 비정기 돌발 교체 소싱' },
        { dCode: '32200', dName: '전략소싱그룹', aCode: 'A51400', aName: '소모품비', r: 1800000, desc: '부서 특별 교안 인쇄대금 오집행' },
        { dCode: '32400', dName: '품질기술부', aCode: 'A61100', aName: '공구기구비', r: 2300000, desc: '외주 검수용 지오메트릭 툴 긴급 취득' }
      ];

      DEMO_LIST.forEach((x, idx) => {
        const submission = getSubmissionStatus(x.dCode, '2026', '경영계획');
        itemsList.push({
          id: `demo-unbudgeted-${x.dCode}-${x.aCode}`,
          deptCode: x.dCode,
          deptName: x.dName,
          accountCode: x.aCode,
          accountName: x.aName,
          budgetAmount: 0,
          actualAmount: x.r,
          differenceAmount: x.r, // Positive means leak
          burnRate: 100, // undefined technically, so 100% representation
          anomalyType: 'UNBUDGETED',
          remarks: x.desc,
          status: submission.status,
          statusLabel: '전산 미승인 집행'
        });
      });
    } else {
      // Find items in Real Actuals that do NOT have a matching budget item or budget is 0
      depts.forEach(dept => {
        const budgetKey = getBudgetDataKey(dept.code, '2026', '경영계획');
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
        const deptActuals = rawActualRows.filter((r: any) => r.usageCode === dept.code);

        const deptAccountBudgets = new Map<string, number>();
        budgetRows.forEach((brow: any) => {
          const totalBudgetSum = (brow.values || []).reduce((a: number, b: number) => a + Number(b || 0), 0);
          deptAccountBudgets.set(brow.code, totalBudgetSum);
        });

        const actualAccounts = new Map<string, { name: string, amount: number, remarks: string }>();
        deptActuals.forEach((arow: any) => {
          const completedSum = Number(arow.completed || 0);
          const existing = actualAccounts.get(arow.accountCode) || { name: arow.accountName, amount: 0, remarks: arow.remarks || '' };
          actualAccounts.set(arow.accountCode, {
            name: arow.accountName,
            amount: existing.amount + completedSum,
            remarks: existing.remarks || arow.remarks
          });
        });

        // Find match
        actualAccounts.forEach((val, acode) => {
          const budgetAllocated = deptAccountBudgets.get(acode) || 0;
          if (budgetAllocated === 0 && val.amount > 0) {
            const submission = getSubmissionStatus(dept.code, '2026', '경영계획');
            itemsList.push({
              id: `real-unbudgeted-${dept.code}-${acode}`,
              deptCode: dept.code,
              deptName: dept.name,
              accountCode: acode,
              accountName: val.name,
              budgetAmount: 0,
              actualAmount: val.amount,
              differenceAmount: val.amount,
              burnRate: 100,
              anomalyType: 'UNBUDGETED',
              remarks: val.remarks || '사전 수립 예산 장부에 해당 계정 부재',
              status: submission.status,
              statusLabel: submission.status === 'APPROVED' ? '계획 승인' : '무규격 소진'
            });
          }
        });
      });
    }

    // Attach reviews
    const activeReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    itemsList = itemsList.map(row => {
      if (activeReviews[row.id]) {
        return {
          ...row,
          status: activeReviews[row.id].status,
          statusLabel: activeReviews[row.id].status === 'APPROVED' ? '추후 변경 승인' : activeReviews[row.id].status === 'ACTION_REQ' ? '조치 요청 통보' : '보류 조치'
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

    const sumLeak = filtered.reduce((acc, r) => acc + r.actualAmount, 0);

    setUnbudgetedRows(filtered);
    setTotalCount(filtered.length);
    setTotalLeakAmount(sumLeak);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser, selectedDept, searchTerm]);

  const handleOpenReview = (row: any) => {
    setActiveReviewItem(row);
    setIsDrawerOpen(true);
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Clock className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-xs text-[#4e5968] mt-2 font-sans">무예산 오집행 원장 확인 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded font-bold">Unallocated Risk Auditing</span>
          <span className="text-xs bg-red-100 text-rose-700 px-2 py-0.5 rounded font-bold text-[10px] font-mono">무예산 집행 통제</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5">
          편성 예산 항목 부재 (무예산) 집행 점검 및 해명
        </h2>
        <p className="text-xs text-[#647067] mt-1 text-zinc-500">
          사전 경영 대분류 세목 승인을 득하지 않고 변칙 지출된 전사 예산외 실제 집행 항목들을 검증 및 모니터링하여 경질이나 긴급 예산 조정을 상신합니다.
        </p>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-[#647067] block">검출된 예산 외 직지출 건수</span>
          <span className="text-xl font-bold text-rose-600 font-mono mt-1.5 block">{totalCount}건 검출</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-zinc-500 block">무예산 실제 누적 방출액</span>
          <span className="text-xl font-bold text-[#111111] font-mono mt-1.5 block">{totalLeakAmount.toLocaleString()}원</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-100 p-5 rounded-2xl shadow-xs">
          <span className="text-xs text-[#008f83] block">감사 및 소명 처리율</span>
          <span className="text-xl font-bold text-[#008f83] font-mono mt-1.5 block">
            {Math.round((unbudgetedRows.filter(r => r.status && r.status !== 'DRAFT').length / (totalCount || 1)) * 100)}%
          </span>
        </div>
      </div>

      {/* Filtering */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs flex flex-col sm:flex-row gap-3">
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-60"
        >
          <option value="all">전체 부서 조회 [All]</option>
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
            placeholder="부서명, 품명 코드 및 사유 입력 해명 조사..."
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">부서명 (코드)</th>
              <th className="px-5 py-3">사용 계정명 (코드)</th>
              <th className="px-5 py-3 text-right">사전 편성 예산</th>
              <th className="px-5 py-3 text-right">실제 비정기 집행</th>
              <th className="px-5 py-3 text-right">집행 편차 (누수액)</th>
              <th className="px-5 py-3 text-center">승인 대조율</th>
              <th className="px-5 py-3">소명 사유 및 해명</th>
              <th className="px-5 py-3 text-center">검증결재상질</th>
              <th className="px-5 py-3 text-center font-bold">감사</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {unbudgetedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-zinc-400 font-medium font-sans">
                  비정상 무예산 집행 내역이 발견되지 않았습니다. 전사 규격 통제가 올바르게 집행 중입니다.
                </td>
              </tr>
            ) : (
              unbudgetedRows.map(row => (
                <tr key={row.id} className="hover:bg-[#f7f9f7]/60">
                  <td className="px-5 py-4 font-semibold text-[#111111]">
                    {row.deptName}
                    <span className="text-[10px] text-zinc-400 font-mono block font-normal">{row.deptCode}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-[#111111]">{row.accountName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono block font-normal">{row.accountCode}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-zinc-400">
                    0원
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-rose-600">
                    {row.actualAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-rose-600 font-medium">
                    +{row.actualAmount.toLocaleString()}원
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] font-mono uppercase">
                      UNBUDGETED
                    </span>
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-xs truncate max-w-xs" title={row.remarks}>
                    {row.remarks || '소명 보류 중'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'APPROVED' ? 'bg-emerald-50 text-[#008f83]' : row.status === 'ACTION_REQ' ? 'bg-amber-100 text-amber-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleOpenReview(row)}
                      className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#dde5de] text-rose-600 hover:border-rose-500 rounded cursor-pointer transition-all font-semibold"
                    >
                      해빙 / 감사
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
