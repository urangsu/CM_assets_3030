import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Search, 
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  Filter, 
  CheckCircle,
  HelpCircle,
  Eye,
  FileSpreadsheet,
  TrendingUp,
  Award
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  formatMillionWon, 
  formatWon, 
  formatMillionWonWithFull 
} from '../lib/formatters';
import { getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey, getSubmissionStatus } from '../lib/storageKeys';
import { resolveAccountByCode } from '../lib/accountResolver';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';
import { classifyAccount, ACCOUNT_CLASS_OPTIONS } from '../lib/accountClassification';
import ReviewDrawer, { ReviewItem } from '../components/budget/ReviewDrawer';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BudgetStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Filters
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [monthMode, setMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState('all');
  const [selectedApproval, setSelectedApproval] = useState('all');

  // Page States
  const [kpis, setKpis] = useState({
    totalBudget: 0,
    totalActual: 0,
    remaining: 0,
    burnRate: 0,
    overrunCount: 0,
    underrunCount: 0,
    unbudgetedCount: 0
  });

  const [tableRows, setTableRows] = useState<any[]>([]);
  const [chartMonthly, setChartMonthly] = useState<any[]>([]);
  const [chartDept, setChartDept] = useState<any[]>([]);
  const [chartAccount, setChartAccount] = useState<any[]>([]);

  // Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewItem | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('current_user');
    if (u) {
      setCurrentUser(JSON.parse(u));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'approval') {
      setSelectedApproval('SUBMITTED');
    } else {
      setSelectedApproval('all');
    }
  }, [activeTab]);

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
        console.error('Failed to parse actual rows', e);
      }
    }

    if (!hasRealData) {
      setIsDemoMode(true);
    }

    const depts = getViewableDepts(currentUser.code);

    let mainAggregate: any[] = [];

    if (!hasRealData) {
      // Simulate High-Fidelity Demo Data
      const DEMO_ACCOUNTS = [
        { code: 'A51100', name: '업무추진비', cat: '임원판공비' },
        { code: 'A51200', name: '업무활동비', cat: '부서경비' },
        { code: 'A51300', name: '여비교통비', cat: '부서경비' },
        { code: 'A51400', name: '소모품비', cat: '일반물품비' },
        { code: 'A61100', name: '공구기구비', cat: '제조경비' },
        { code: 'A61200', name: '외주가공비', cat: '제조경비' },
        { code: 'A61500', name: '기타복리후생비', cat: '인건비성' },
        { code: 'A71000', name: '안전보건설비', cat: '안전투자' },
        { code: 'A81000', name: '온실가스설비', cat: '에너지환경' }
      ];

      depts.forEach((dept, dIdx) => {
        const subStatus = getSubmissionStatus(dept.code, year, planType);
        
        DEMO_ACCOUNTS.forEach((account, aIdx) => {
          // Generate realistic figures based on index seed
          const seedValue = (dIdx + 1) * (aIdx + 2) * 2300000;
          const isUnbudgeted = dIdx === 1 && aIdx === 3; // unbudgeted
          const isUnderrun = dIdx === 2 && aIdx === 5; // underrun
          const isOverrun = dIdx === 3 && aIdx === 1; // overrun

          let budgetAmount = isUnbudgeted ? 0 : seedValue;
          let actualAmount = isUnbudgeted 
            ? 3500000 
            : isUnderrun 
            ? Math.floor(seedValue * 0.15) 
            : isOverrun 
            ? Math.floor(seedValue * 1.35) 
            : Math.floor(seedValue * 0.82);

          let diff = budgetAmount - actualAmount;
          let rate = budgetAmount > 0 ? Number(((actualAmount / budgetAmount) * 100).toFixed(1)) : 0;
          
          let anomaly: 'OVERRUN' | 'UNDERRUN' | 'UNBUDGETED' | 'NORMAL' = 'NORMAL';
          if (isUnbudgeted) anomaly = 'UNBUDGETED';
          else if (actualAmount > budgetAmount) anomaly = 'OVERRUN';
          else if (rate < 30) anomaly = 'UNDERRUN';

          mainAggregate.push({
            id: `demo-${dept.code}-${account.code}`,
            deptCode: dept.code,
            deptName: dept.name,
            accountCode: account.code,
            accountName: account.name,
            accountCategory: classifyAccount(account.code, account.name),
            budgetAmount,
            actualAmount,
            differenceAmount: diff < 0 ? Math.abs(diff) : -diff, // negative represents surplus, positive represents deficit (as in actual overrun)
            burnRate: rate,
            anomalyType: anomaly,
            status: subStatus.status,
            statusLabel: subStatus.status === 'LOCKED' ? '잠금 완료' : subStatus.status === 'APPROVED' ? '승인 완료' : subStatus.status === 'SUBMITTED' ? '검토 대기' : '작성 중'
          });
        });
      });
    } else {
      // Aggregate REAL from localStorage
      depts.forEach(dept => {
        const subStatus = getSubmissionStatus(dept.code, year, planType);
        
        // 1. Fetch Budgets
        const budgetKey = getBudgetDataKey(dept.code, year, planType);
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');

        // 2. Fetch Actuals for this dept
        const deptActuals = rawActualRows.filter((r: any) => r.usageCode === dept.code);

        // Track budget accounts
        const deptAccountBudgets = new Map<string, any>();
        budgetRows.forEach((brow: any) => {
          let budgetSum = 0;
          if (monthMode === 'MONTH') {
            budgetSum = Number((brow.values || [])[selectedMonth - 1] || 0);
          } else {
            budgetSum = (brow.values || []).slice(0, selectedMonth).reduce((a: number, b: number) => a + Number(b || 0), 0);
          }

          deptAccountBudgets.set(brow.code, {
            accountCode: brow.code,
            accountName: brow.name,
            budgetAmount: budgetSum,
            detail: brow.detail || ''
          });
        });

        // Track actual accounts
        const deptAccountActuals = new Map<string, number>();
        deptActuals.forEach((arow: any) => {
          const monthIdx = parseMonthIndex(arow.period ?? arow.month);
          if (shouldIncludeMonth(monthIdx, monthMode, selectedMonth)) {
            const completedSum = Number(arow.completed || 0);
            deptAccountActuals.set(arow.accountCode, (deptAccountActuals.get(arow.accountCode) || 0) + completedSum);
          }
        });

        // Merge all Account Codes
        const allAccountCodes = Array.from(new Set([...Array.from(deptAccountBudgets.keys()), ...Array.from(deptAccountActuals.keys())]));

        allAccountCodes.forEach(acode => {
          const resolvedAccount = resolveAccountByCode({ accountCode: acode, uploadedName: '', year });
          const bInfo = deptAccountBudgets.get(acode) || { accountCode: acode, accountName: resolvedAccount.name, budgetAmount: 0 };
          const actualAmount = deptAccountActuals.get(acode) || 0;
          const budgetAmount = bInfo.budgetAmount;
          
          const finalAccountName = resolvedAccount.name;

          const diff = budgetAmount - actualAmount;
          const rate = budgetAmount > 0 ? Number(((actualAmount / budgetAmount) * 100).toFixed(1)) : 0;

          let anomaly: 'OVERRUN' | 'UNDERRUN' | 'UNBUDGETED' | 'NORMAL' = 'NORMAL';
          if (budgetAmount === 0 && actualAmount > 0) {
            anomaly = 'UNBUDGETED';
          } else if (actualAmount > budgetAmount) {
            anomaly = 'OVERRUN';
          } else if (rate < 30) {
            anomaly = 'UNDERRUN';
          }

          mainAggregate.push({
            id: `real-${dept.code}-${acode}`,
            deptCode: dept.code,
            deptName: dept.name,
            accountCode: acode,
            accountName: finalAccountName,
            accountCategory: classifyAccount(acode, finalAccountName),
            budgetAmount,
            actualAmount,
            differenceAmount: diff < 0 ? Math.abs(diff) : -diff,
            burnRate: rate,
            anomalyType: anomaly,
            status: subStatus.status,
            statusLabel: subStatus.status === 'LOCKED' ? '잠금 완료' : subStatus.status === 'APPROVED' ? '승인 완료' : subStatus.status === 'SUBMITTED' ? '검토 대기' : '작성 중'
          });
        });
      });
    }

    // Apply active reviews from localStorage to update statuses override
    const activeReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    mainAggregate = mainAggregate.map(row => {
      if (activeReviews[row.id]) {
        return {
          ...row,
          status: activeReviews[row.id].status,
          statusLabel: activeReviews[row.id].status === 'APPROVED' ? '계획 승인' : activeReviews[row.id].status === 'ACTION_REQ' ? '조치 요청' : activeReviews[row.id].status === 'REJECTED' ? '집행 반려' : '임시 보류'
        };
      }
      return row;
    });

    // Populate table rows based on filters
    const filteredRows = mainAggregate.filter(row => {
      // 1. Dept filter
      if (selectedDept !== 'all' && row.deptCode !== selectedDept) return false;
      // 2. Category Filter
      if (selectedCategory !== 'all' && row.accountCategory !== selectedCategory) return false;
      // 3. Approval / status filter
      if (selectedApproval !== 'all' && row.status !== selectedApproval) return false;
      // 4. Anomaly filter
      if (selectedAnomaly !== 'all' && row.anomalyType !== selectedAnomaly) return false;
      // 5. Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.deptName.toLowerCase().includes(term) ||
          row.deptCode.toLowerCase().includes(term) ||
          row.accountName.toLowerCase().includes(term) ||
          row.accountCode.toLowerCase().includes(term)
        );
      }
      return true;
    });

    setTableRows(filteredRows);

    // Recompute total KPIs
    let sumBudget = 0;
    let sumActual = 0;
    let ovCount = 0;
    let unCount = 0;
    let unBudgets = 0;

    filteredRows.forEach(row => {
      sumBudget += row.budgetAmount;
      sumActual += row.actualAmount;
      if (row.anomalyType === 'OVERRUN') ovCount++;
      if (row.anomalyType === 'UNDERRUN') unCount++;
      if (row.anomalyType === 'UNBUDGETED') unBudgets++;
    });

    setKpis({
      totalBudget: sumBudget,
      totalActual: sumActual,
      remaining: Math.max(0, sumBudget - sumActual),
      burnRate: sumBudget > 0 ? Number(((sumActual / sumBudget) * 100).toFixed(1)) : 0,
      overrunCount: ovCount,
      underrunCount: unCount,
      unbudgetedCount: unBudgets
    });

    // Build Charts representation
    // 1. Monthly (Simulated monthly or built from real)
    let months = Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}월`, '예산 계획': 0, '실제 집행': 0 }));
    if (hasRealData) {
      depts.forEach(dept => {
        const budgetKey = getBudgetDataKey(dept.code, year, planType);
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
        budgetRows.forEach((brow: any) => {
          if (brow.values && brow.values.length === 12) {
            brow.values.forEach((v: any, mIdx: number) => {
              months[mIdx]['예산 계획'] += (Number(v) || 0);
            });
          }
        });
      });
      rawActualRows.forEach((arow: any) => {
        let monthNum = 0;
        if (arow.month) monthNum = Number(arow.month);
        else if (arow.period) {
          const match = arow.period.match(/(\d+)월/);
          if (match) monthNum = parseInt(match[1]);
        }
        if (monthNum >= 1 && monthNum <= 12) {
          months[monthNum - 1]['실제 집행'] += (Number(arow.completed) || 0);
        }
      });
    } else {
      months = [
        { month: '1월', '예산 계획': sumBudget * 0.08, '실제 집행': sumActual * 0.07 },
        { month: '2월', '예산 계획': sumBudget * 0.08, '실제 집행': sumActual * 0.09 },
        { month: '3월', '예산 계획': sumBudget * 0.09, '실제 집행': sumActual * 0.11 },
        { month: '4월', '예산 계획': sumBudget * 0.09, '실제 집행': sumActual * 0.12 },
        { month: '5월', '예산 계획': sumBudget * 0.10, '실제 집행': sumActual * 0.05 },
        { month: '6월', '예산 계획': sumBudget * 0.10, '실제 집행': 0 },
        { month: '7월', '예산 계획': sumBudget * 0.08, '실제 집행': 0 },
        { month: '8월', '예산 계획': sumBudget * 0.08, '실제 집행': 0 },
        { month: '9월', '예산 계획': sumBudget * 0.10, '실제 집행': 0 },
        { month: '10월', '예산 계획': sumBudget * 0.08, '실제 집행': 0 },
        { month: '11월', '예산 계획': sumBudget * 0.06, '실제 집행': 0 },
        { month: '12월', '예산 계획': sumBudget * 0.06, '실제 집행': 0 }
      ];
    }
    setChartMonthly(months);

    // 2. Dept Top 10 by rate
    const deptsAggregate = new Map<string, { name: string, b: number, a: number }>();
    filteredRows.forEach(row => {
      const prev = deptsAggregate.get(row.deptName) || { name: row.deptName, b: 0, a: 0 };
      deptsAggregate.set(row.deptName, {
        name: row.deptName,
        b: prev.b + row.budgetAmount,
        a: prev.a + row.actualAmount
      });
    });
    const deptsChartData = Array.from(deptsAggregate.values()).map(d => ({
      name: d.name,
      '예산 한도': d.b,
      '실제 집행': d.a,
      집행률: d.b > 0 ? Math.round((d.a / d.b) * 100) : 0
    })).sort((a, b) => b.집행률 - a.집행률).slice(0, 10);
    setChartDept(deptsChartData);

    // 3. Account Top 10 spending
    const acctsAggregate = new Map<string, { name: string, val: number }>();
    filteredRows.forEach(row => {
      const prev = acctsAggregate.get(row.accountName) || { name: row.accountName, val: 0 };
      acctsAggregate.set(row.accountName, {
        name: row.accountName,
        val: prev.val + row.actualAmount
      });
    });
    const acctsChartData = Array.from(acctsAggregate.values()).map(a => ({
      name: a.name.slice(0, 7),
      집행액: a.val
    })).sort((a, b) => b.집행액 - a.집행액).slice(0, 6);
    setChartAccount(acctsChartData);

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser, year, planType, monthMode, selectedMonth, selectedDept, selectedCategory, selectedAnomaly, selectedApproval, activeTab]);

  const handleOpenReview = (row: any) => {
    setActiveReviewItem({
      id: row.id,
      deptCode: row.deptCode,
      deptName: row.deptName,
      accountCode: row.accountCode,
      accountName: row.accountName,
      month: getMonthModeLabel(monthMode, selectedMonth),
      budgetAmount: row.budgetAmount,
      actualAmount: row.actualAmount,
      differenceAmount: row.budgetAmount - row.actualAmount,
      burnRate: row.burnRate,
      anomalyType: row.anomalyType
    });
    setIsDrawerOpen(true);
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Clock className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-sm text-[#4e5968] font-medium font-sans">실시간 예산 데이터 검토 중...</span>
      </div>
    );
  }

  const uniqueDeptsList = getViewableDepts(currentUser.code);

  return (
    <div className="space-y-6">
      {/* 1. Header with metadata context */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-[#008f83] px-2 py-0.5 rounded font-bold font-mono">
              {activeTab === 'overview' ? '2026 Audit Board' : '2026 Approval Portal'}
            </span>
            {isDemoMode && <span className="text-[10px] bg-[#fdf0e2] text-[#F7A059] border border-[#fbd6b4] px-1.5 py-0.5 rounded-md font-bold">SAMPLE DATA ACTIVE</span>}
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            {activeTab === 'overview' ? '부서별 예산 편성 대비 실적 현황 관제실' : '예산 조정 제출 및 심사 승인 관제판'}
          </h2>
          <p className="text-xs text-[#647067] mt-1">
            {activeTab === 'overview' 
              ? '부서 지정 경비 및 현장 제조 예산의 한도, 누적 실적, 실시간 잔액 및 통제 소진율을 통합 전도합니다.' 
              : '각 부서에서 신청한 월별 세목의 편성 예산을 조정하고 최종 승인 가결 또는 보류/조치 요구 처리를 수행합니다.'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#f7f9f7] border border-[#dde5de] px-4 py-2 rounded-xl text-xs font-mono">
          <Clock className="w-4 h-4 text-zinc-400" />
          <span>권한: {currentUser.role} {currentUser.department}</span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-[#dde5de] gap-1.5">
        <button
          onClick={() => navigate('/budget-status?tab=overview')}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 -mb-[2px] cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-[#008f83] text-[#008f83] bg-white rounded-t-xl border-t border-x border-[#dde5de]'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-[#dde5de]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          예산 현황 (Overview)
        </button>
        <button
          onClick={() => navigate('/budget-status?tab=approval')}
          className={`px-5 py-3 text-xs font-bold transition border-b-2 -mb-[2px] cursor-pointer flex items-center gap-2 ${
            activeTab === 'approval'
              ? 'border-[#008f83] text-[#008f83] bg-white rounded-t-xl border-t border-x border-[#dde5de]'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-[#dde5de]'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          예산 제출/승인 현황 (Approval Status)
        </button>
      </div>

      {/* Dynamic Tab Context notice */}
      {activeTab === 'approval' && (
        <div className="bg-[#fcf8f2] border border-[#fbd6b4] text-zinc-700 p-4.5 rounded-2xl text-xs flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-4.5 h-4.5 text-[#F7A059] flex-shrink-0" />
          <div>
            <b>[결재 승인 관제 모드]</b> 현재 제출된 예산 조정안을 심사하고 승인 및 반려 처리하는 전용 관제 보기입니다. 아래 목록에서 각 세목 우측의 <b>\'검증\'</b> 버튼을 클릭하여 결재를 수행하십시오.
          </div>
        </div>
      )}

      {/* 2. Controls and Multi-Filters */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#333333] border-b border-[#eef2ec] pb-2.5">
          <Filter className="w-3.5 h-3.5 text-[#008f83]" />
          <span>다차원 관제 필터링 엔진</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Year */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">연도</label>
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="2026">2026년 회계</option>
              <option value="2025">2025년 회계</option>
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

          {/* Division */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">계획구분</label>
            <select 
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="경영계획">경영계획</option>
              <option value="수수계획">수수계획</option>
            </select>
          </div>

          {/* Dept */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">조회 대상 부서</label>
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

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">계정 분류</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="all">전체 계정군</option>
              {ACCOUNT_CLASS_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Anomaly Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans text-rose-600">집행 주의 상태</label>
            <select 
              value={selectedAnomaly}
              onChange={(e) => setSelectedAnomaly(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-rose-200 rounded-xl focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="all">전체 집행 궤적</option>
              <option value="OVERRUN">초과 경보 (OVERRUN)</option>
              <option value="UNDERRUN">낮은 집행률 (UNDERRUN)</option>
              <option value="UNBUDGETED">무예산 집행 (UNBUDGETED)</option>
              <option value="NORMAL">정상 소진 (NORMAL)</option>
            </select>
          </div>

          {/* Approval filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#647067] mb-1 font-sans">검증 결재 상태</label>
            <select 
              value={selectedApproval}
              onChange={(e) => setSelectedApproval(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
            >
              <option value="all">전체 결재상태</option>
              <option value="DRAFT">임시 작성 중 (DRAFT)</option>
              <option value="ACTION_REQ">조치 요청 접수</option>
              <option value="APPROVED">계획 승인 가결 (APPROVED)</option>
              <option value="REJECTED">집행 반려 상태 (REJECTED)</option>
              <option value="LOCKED">잠금 완료 (LOCKED)</option>
            </select>
          </div>
        </div>

        {/* Text Search Input */}
        <div className="relative group">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400 font-sans"
            placeholder="부서명, 부서코드, 계정코드, 예산 세목 계정명을 입력하여 정확하게 추출합니다."
          />
        </div>
      </div>

      {/* 3. Operational KPIs Header Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">{monthMode === 'MONTH' ? `${selectedMonth}월` : `1월~${selectedMonth}월`} 편성 예산</span>
          <span className="text-lg font-bold text-[#111111] mt-2 font-mono block" title={formatWon(kpis.totalBudget)}>{formatMillionWon(kpis.totalBudget)}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">{monthMode === 'MONTH' ? `${selectedMonth}월` : `1월~${selectedMonth}월`} 집행 금액</span>
          <span className="text-lg font-bold text-[#008f83] mt-2 font-mono block" title={formatWon(kpis.totalActual)}>{formatMillionWon(kpis.totalActual)}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">{monthMode === 'MONTH' ? `${selectedMonth}월` : `1월~${selectedMonth}월`} 잔여 한도</span>
          <span className="text-lg font-bold text-zinc-700 mt-2 font-mono block" title={formatWon(kpis.remaining)}>{formatMillionWon(kpis.remaining)}</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-[#647067] uppercase block tracking-wider">{monthMode === 'MONTH' ? `${selectedMonth}월` : `1월~${selectedMonth}월`} 집행률</span>
          <span className="text-lg font-bold text-[#008f83] mt-2 font-mono block">{kpis.burnRate}%</span>
        </div>
        
        {/* Alerts count */}
        <div className="bg-amber-50/70 border border-[#fbd6b4] p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-[#F7A059] uppercase block tracking-wider">초과 경보</span>
          <span className="text-lg font-bold text-amber-600 mt-2 font-mono block">{kpis.overrunCount}건</span>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 p-4.5 rounded-2xl shadow-xs text-center">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">미달 건수</span>
          <span className="text-lg font-bold text-zinc-600 mt-2 font-mono block">{kpis.underrunCount}건</span>
        </div>
        <div className="bg-rose-50 border border-rose-200 p-4.5 rounded-2xl shadow-xs text-center col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-rose-500 block tracking-wider">무예산 집행</span>
          <span className="text-lg font-bold text-rose-600 mt-2 font-mono block">{kpis.unbudgetedCount}건</span>
        </div>
      </div>

      {/* 4. Double Visualizer Charts panel */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Month Cumulative Sparklines */}
          <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
            <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#008f83]" /> 월간 누적 집행 동기화 궤적
            </h3>
            <div className="h-[230px] w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartMonthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4cfc5" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#c4cfc5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008f83" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#008f83" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                  <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000).toLocaleString('ko-KR')}`} />
                  <Tooltip formatter={(value: any) => [formatMillionWonWithFull(Number(value)), '']} />
                  <Legend iconType="circle" />
                  <Area type="monotone" name="예산 계획" dataKey="예산 계획" stroke="#c4cfc5" strokeWidth={1.5} fill="url(#gPlan)" />
                  <Area type="monotone" name="실제 집행" dataKey="실제 집행" stroke="#008f83" strokeWidth={2.5} fill="url(#gAct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Accounts breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
            <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#008f83]" /> 소진액 TOP 계정 (누계)
            </h3>
            <div className="h-[230px] w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAccount} layout="vertical" margin={{ left: 5, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2ec" />
                  <XAxis type="number" fontSize={9} stroke="#8b95a1" axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000).toLocaleString('ko-KR')}`} />
                  <YAxis dataKey="name" type="category" fontSize={9} stroke="#111111" axisLine={false} tickLine={false} width={65} />
                  <Tooltip formatter={(v: any) => [formatMillionWonWithFull(Number(v)), '']} />
                  <Bar name="실제 집행" dataKey="집행액" fill="#008f83" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 5. Main Audit Grid Table */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#eef2ec] flex justify-between items-center bg-[#fcfdfe]">
          <div>
            <h3 className="text-sm font-bold text-[#111111]">
              {activeTab === 'overview' 
                ? `예산 집행 상세 감사 정보판 (${tableRows.length}건 정기 검증)` 
                : `부서별 예산 조정안 결제 승인판 (${tableRows.length}건 대기)`
              }
            </h3>
            <p className="text-[11px] text-[#647067] mt-0.5">
              {activeTab === 'overview' 
                ? '편성 예산 대비 누계 지출액 대조 상세 테이블' 
                : '각 세목 우측의 검증 버튼을 클릭하여 최종 결재액 승인과 반려, 조치 요구 처리를 진행하십시오.'
              }
            </p>
          </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7]">
              <tr className="text-[10px] text-[#647067] font-bold uppercase tracking-wider">
                <th className="px-5 py-3">부서명 (코드)</th>
                <th className="px-5 py-3">계정명 (코드)</th>
                <th className="px-5 py-3">계정구분</th>
                <th className="px-5 py-3">조회 기준</th>
                <th className="px-5 py-3 text-right">예산</th>
                <th className="px-5 py-3 text-right">실제 집행</th>
                <th className="px-5 py-3 text-right">잔여 한도</th>
                <th className="px-5 py-3 text-center">집행률</th>
                <th className="px-5 py-3 text-center">집행상질</th>
                <th className="px-5 py-3 text-center">검증결재상질</th>
                <th className="px-5 py-3 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-zinc-400 font-medium">
                    해당 세목 조건에 매칭되는 예산 감사 데이터가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                tableRows.map((row, rIdx) => {
                  const isOver = row.anomalyType === 'OVERRUN';
                  const isUnb = row.anomalyType === 'UNBUDGETED';
                  
                  return (
                    <tr key={row.id} className="hover:bg-[#f7f9f7] transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-[#111111]">{row.deptName}</span>
                        <span className="text-[10px] font-mono text-[#8b95a1] block">{row.deptCode}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-[#111111]">{row.accountName}</span>
                        <span className="text-[10px] font-mono text-[#8b95a1] block">{row.accountCode}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-zinc-500">
                        {row.accountCategory}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-zinc-500 font-medium">
                        {monthMode === 'MONTH' ? `${selectedMonth}월` : `1월~${selectedMonth}월`}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono text-zinc-500" title={formatWon(row.budgetAmount)}>
                        {formatMillionWon(row.budgetAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-medium text-[#111111]" title={formatWon(row.actualAmount)}>
                        {formatMillionWon(row.actualAmount)}
                      </td>
                      <td className={`px-5 py-3.5 whitespace-nowrap text-right font-mono ${row.differenceAmount > 0 && isOver ? 'text-rose-500' : 'text-emerald-600'}`} title={formatWon(row.differenceAmount)}>
                        {row.differenceAmount > 0 && isOver ? `+${formatMillionWon(row.differenceAmount)}` : formatMillionWon(row.differenceAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center font-mono font-bold text-zinc-800">
                        {row.burnRate}%
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isOver ? 'bg-amber-50 text-[#F7A059] border border-[#fbd6b4]' : isUnb ? 'bg-rose-50 text-rose-700 border border-rose-150' : row.anomalyType === 'UNDERRUN' ? 'bg-zinc-100 text-[#4e5968]' : 'bg-emerald-50 text-[#008f83]'
                        }`}>
                          {row.anomalyType === 'OVERRUN' ? '초과 경보' : row.anomalyType === 'UNDERRUN' ? '집행 미달' : row.anomalyType === 'UNBUDGETED' ? '무예산' : '정상 통제'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'APPROVED' ? 'bg-emerald-50 text-[#008f83]' : row.status === 'ACTION_REQ' ? 'bg-amber-100 text-amber-700' : row.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        <button 
                          onClick={() => handleOpenReview(row)}
                          className="p-1 px-2.5 bg-white hover:bg-zinc-100 text-zinc-600 border border-[#dde5de] rounded-md hover:border-teal-500 hover:text-teal-600 cursor-pointer font-semibold transition-all"
                        >
                          검증
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

      {/* Review Drawer common portal setup */}
      <ReviewDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={activeReviewItem}
        onSave={loadData}
      />
    </div>
  );
}
