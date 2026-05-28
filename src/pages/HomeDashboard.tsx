import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  AlertTriangle, 
  FileSpreadsheet, 
  BarChart3, 
  Upload, 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Database,
  ArrowUpRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  formatMillionWon, 
  formatWon, 
  formatMillionWonWithFull 
} from '../lib/formatters';
import { getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey, getSubmissionStatus } from '../lib/storageKeys';

// Reusable micro metric card inside HomeDashboard
interface MiniMetricCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ComponentType<any>;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  colorClass?: string;
}

function MiniMetricCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend, 
  trendType = 'neutral', 
  colorClass = 'text-brand-500 bg-brand-50' 
}: MiniMetricCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold text-[#647067] uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-[#111111] font-mono tracking-tight">{value}</h3>
        <div className="flex items-center mt-1.5 gap-2">
          <span className="text-xs text-[#8b95a1]">{subValue}</span>
          {trend && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              trendType === 'up' 
                ? 'bg-rose-50 text-rose-600' 
                : trendType === 'down' 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'bg-zinc-100 text-zinc-600'
            }`}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const getDefaultDashboardBasePeriod = () => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // JS 기준: 현재월 - 1. 5월이면 4

  if (month === 0) {
    year -= 1;
    month = 12;
  }

  return {
    year: String(year),
    month,
  };
};

const defaultBasePeriod = getDefaultDashboardBasePeriod();

function getMonthNumberFromActualRow(row: any): number {
  if (row.month) {
    const n = Number(row.month);
    return Number.isFinite(n) ? n : 0;
  }

  if (row.period) {
    const match = String(row.period).match(/(\d{1,2})월/);
    if (match) return Number(match[1]);
  }

  return 0;
}

function toCumulative(values: number[]): number[] {
  let sum = 0;
  return values.map(v => {
    sum += Number(v) || 0;
    return sum;
  });
}

export default function HomeDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataUpdateTime, setDataUpdateTime] = useState<string>('');
  
  // Real stats state
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [stats, setStats] = useState({
    totalBudget: 0,
    totalActual: 0,
    burnRate: 0,
    lockedDeptsCount: 0,
    viewableDeptsCount: 0,
    overrunDeptsCount: 0
  });

  // 1. Setup Dashboard Year and Month Selectors
  const [dashboardYear, setDashboardYear] = useState(() => {
    return localStorage.getItem('hycm_dashboard_year') || defaultBasePeriod.year;
  });

  const [dashboardBaseMonth, setDashboardBaseMonth] = useState(() => {
    return Number(localStorage.getItem('hycm_dashboard_base_month') || defaultBasePeriod.month);
  });

  const [appliedDashboardYear, setAppliedDashboardYear] = useState(dashboardYear);
  const [appliedDashboardBaseMonth, setAppliedDashboardBaseMonth] = useState(dashboardBaseMonth);

  const [dashboardDiagnostics, setDashboardDiagnostics] = useState({
    unassignedActualCount: 0,
    unassignedActualAmount: 0,
  });

  // Department Submission Progress Feed List
  const [deptFeed, setDeptFeed] = useState<any[]>([]);
  
  // Chart Data
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [deptContrastData, setDeptContrastData] = useState<any[]>([]);

  const navigate = useNavigate();

  const loadDashboardData = () => {
    setIsLoading(true);
    const savedUser = localStorage.getItem('current_user');
    if (!savedUser) {
      setIsLoading(false);
      return;
    }

    const u = JSON.parse(savedUser);
    setUser(u);

    const year = appliedDashboardYear;
    const planType = '경영계획';
    const baseMonth = appliedDashboardBaseMonth;
    const depts = getViewableDepts(u.code);
    
    // Check if real actual data is present in localStorage (Use getActualDataKey(year)!)
    const rawActuals = localStorage.getItem(getActualDataKey(year));
    let realActualRows: any[] = [];
    let hasRealActual = false;

    if (rawActuals) {
      try {
        const rows = JSON.parse(rawActuals);
        if (rows && rows.length > 0) {
          realActualRows = rows;
          hasRealActual = true;
          setIsDemoMode(false);
        }
      } catch (e) {
        console.error('Error parsing actuals', e);
      }
    }

    if (!hasRealActual) {
      setIsDemoMode(true);
    }

    // 1. Calculate realistic budgets from actual storage keys
    let calculatedTotalBudget = 0;
    let calculatedTotalActual = 0;
    let calculatedOverrunCount = 0;
    let calculatedLockedCount = 0;

    const computedDeptList: any[] = [];

    depts.forEach(dept => {
      // Budget data
      const budgetKey = getBudgetDataKey(dept.code, year, planType);
      const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
      let deptBudgetSum = 0;
      budgetRows.forEach((row: any) => {
        if (row.values) {
          row.values.slice(0, baseMonth).forEach((v: any) => {
            deptBudgetSum += (Number(v) || 0);
          });
        }
      });
      calculatedTotalBudget += deptBudgetSum;

      // Actual data for this dept
      let deptActualSum = 0;
      if (hasRealActual) {
        realActualRows.filter((r: any) => {
          const effectiveDeptCode = r.attributedDeptCode || r.usageCode;
          const monthNum = getMonthNumberFromActualRow(r);
          return effectiveDeptCode === dept.code && monthNum >= 1 && monthNum <= baseMonth;
        }).forEach((r: any) => {
          deptActualSum += (Number(r.completed) || 0);
          // If actual + planned exceeds allowed budget (including transfers/carried over or initial amount)
          const totalAllowed = (Number(r.amount) || 0) + (Number(r.additional) || 0) + (Number(r.transferred) || 0) + (Number(r.carriedOver) || 0);
          const currentSpent = (Number(r.planned) || 0) + (Number(r.completed) || 0);
          if (currentSpent > totalAllowed && totalAllowed > 0) {
            calculatedOverrunCount++;
          }
        });
        calculatedTotalActual += deptActualSum;
      }

      // Check Submission and Lock statuses
      const subStatus = getSubmissionStatus(dept.code, year, planType);
      const isLocked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(subStatus.status);
      if (isLocked) {
        calculatedLockedCount++;
      }

      computedDeptList.push({
        code: dept.code,
        name: dept.name,
        manager: dept.manager || '담당자 미정',
        budgetSum: deptBudgetSum,
        actualSum: deptActualSum,
        status: subStatus.status,
        statusLabel: subStatus.status === 'LOCKED' ? '잠금 상태' : subStatus.status === 'APPROVED' ? '승인 완료' : subStatus.status === 'SUBMITTED' ? '검토 대기' : '작성 중'
      });
    });

    // Feed Sorting (Locked & High Budget Depts on Top)
    computedDeptList.sort((a, b) => b.budgetSum - a.budgetSum);
    setDeptFeed(computedDeptList);

    // Diagnostics calculation & Chart Data
    let unassignedActualCount = 0;
    let unassignedActualAmount = 0;

    if (hasRealActual && calculatedTotalBudget > 0) {
      // Compute monthly distribution from real data
      const monthlyPlan = Array(12).fill(0);
      const monthlyAct = Array(12).fill(0);

      // Distribute Budgets (typically distributed or calculated by column monthly)
      depts.forEach(dept => {
        const budgetKey = getBudgetDataKey(dept.code, year, planType);
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
        budgetRows.forEach((row: any) => {
          if (row.values && row.values.length === 12) {
            row.values.forEach((v: any, mIdx: number) => {
              monthlyPlan[mIdx] += (Number(v) || 0);
            });
          }
        });
      });

      // Distribute Actual completions month by month if month column or period is available
      realActualRows.forEach((r: any) => {
        const monthNum = getMonthNumberFromActualRow(r);

        if (monthNum >= 1 && monthNum <= 12) {
          monthlyAct[monthNum - 1] += (Number(r.completed) || 0);
        } else {
          unassignedActualCount += 1;
          unassignedActualAmount += (Number(r.completed) || 0);
        }
      });

      // Build Monthly Cumulative Trend (1 to baseMonth)
      const cumulativePlan = toCumulative(monthlyPlan.slice(0, baseMonth));
      const cumulativeActual = toCumulative(monthlyAct.slice(0, baseMonth));

      const trendData = Array.from({ length: baseMonth }, (_, i) => ({
        month: `${i + 1}월`,
        '누계 예산': cumulativePlan[i],
        '누계 실적': cumulativeActual[i],
      }));
      setMonthlyTrendData(trendData);

      // Contrast top 6 departments
      const contrastData = computedDeptList.slice(0, 6).map(d => ({
        name: d.name,
        '편성 예산': d.budgetSum,
        '실제 집행': d.actualSum,
      }));
      setDeptContrastData(contrastData);

      setStats({
        totalBudget: calculatedTotalBudget,
        totalActual: calculatedTotalActual,
        burnRate: Number(((calculatedTotalActual / calculatedTotalBudget) * 100).toFixed(1)) || 0,
        lockedDeptsCount: calculatedLockedCount,
        viewableDeptsCount: depts.length,
        overrunDeptsCount: calculatedOverrunCount
      });

      setDashboardDiagnostics({
        unassignedActualCount,
        unassignedActualAmount,
      });
    } else {
      // Fallback Seed Data (Demo Simulation for high UX)
      const mockMonthlyTrendFull = [
        { month: '1월', '예산 계획': 85000000, '실제 집행': 72400000 },
        { month: '2월', '예산 계획': 85000000, '실제 집행': 79200000 },
        { month: '3월', '예산 계획': 90000000, '실제 집행': 88400000 },
        { month: '4월', '예산 계획': 90000000, '실제 GH': 92100000, '실제 집행': 92100000 },
        { month: '5월', '예산 계획': 95000000, '실제 집행': 41200000 }, // Mid-year
        { month: '6월', '예산 계획': 95000000, '실제 집행': 0 },
        { month: '7월', '예산 계획': 80000000, '실제 집행': 0 },
        { month: '8월', '예산 계획': 80000000, '실제 집행': 0 },
        { month: '9월', '예산 계획': 95000000, '실제 집행': 0 },
        { month: '10월', '예산 계획': 100000000, '실제 집행': 0 },
        { month: '11월', '예산 계획': 110000000, '실제 집행': 0 },
        { month: '12월', '예산 계획': 120000000, '실제 집행': 0 }
      ];

      const monthlyPlanSample = mockMonthlyTrendFull.map(item => item['예산 계획']);
      const monthlyActSample = mockMonthlyTrendFull.map(item => item['실제 집행'] || 0);

      const cumulativePlanSample = toCumulative(monthlyPlanSample.slice(0, baseMonth));
      const cumulativeActualSample = toCumulative(monthlyActSample.slice(0, baseMonth));

      const mockMonthlyTrend = Array.from({ length: baseMonth }, (_, i) => ({
        month: `${i + 1}월`,
        '누계 예산': cumulativePlanSample[i],
        '누계 실적': cumulativeActualSample[i],
      }));
      setMonthlyTrendData(mockMonthlyTrend);

      const mockDeptContrast = [
        { name: '기획재무그룹', '편성 예산': 145000000, '실제 집행': 68400000 },
        { name: '전략소싱그룹', '편성 예산': 120000000, '실제 집행': 74200000 },
        { name: '1공장', '편성 예산': 210000000, '실제 집행': 104500000 },
        { name: '인사행정그룹', '편성 예산': 95000000, '실제 집행': 42100000 },
        { name: '품질기술부', '편성 예산': 75000000, '실제 집행': 34800000 },
        { name: '안전환경센터', '편성 예산': 62000000, '실제 집행': 21400000 }
      ];

      // Slcing top 6 demo departments with some dummy scaling if needed
      const mockDeptContrastFiltered = mockDeptContrast.map(md => {
        // scale based on month
        const factor = baseMonth / 12;
        return {
          name: md.name,
          '편성 예산': Math.round(md['편성 예산'] * factor),
          '실제 집행': Math.round(md['실제 집행'] * (baseMonth <= 5 ? (baseMonth / 5) : 1) * 0.75)
        };
      });
      setDeptContrastData(mockDeptContrastFiltered);

      // In Demo, if calculated budget is 0, give standard simulated numbers
      const demoBudget = calculatedTotalBudget || 707000000;
      const demoActual = Math.round(demoBudget * 0.528 * (baseMonth / 12));
      setStats({
        totalBudget: demoBudget,
        totalActual: demoActual,
        burnRate: Number(((demoActual / demoBudget) * 100).toFixed(1)) || 52.8,
        lockedDeptsCount: calculatedLockedCount || 3,
        viewableDeptsCount: depts.length || 18,
        overrunDeptsCount: calculatedOverrunCount || 1
      });

      setDashboardDiagnostics({
        unassignedActualCount: 0,
        unassignedActualAmount: 0,
      });
    }

    // Set updated date
    const n = new Date();
    setDataUpdateTime(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [appliedDashboardYear, appliedDashboardBaseMonth]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-sm text-[#4e5968] font-medium font-sans">실시간 데이터 분석 중...</span>
      </div>
    );
  }

  // Visual Helper for warning colors
  const getBurnRateColor = (rate: number) => {
    if (rate >= 90) return 'bg-rose-500';
    if (rate >= 75) return 'bg-amber-500';
    return 'bg-[#008f83]'; // default brand (nickel-500)
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Control Section */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 font-sans tracking-wide uppercase">Operational Hub Active</span>
          </div>
          <h2 className="text-[22px] font-bold text-[#111111] leading-tight mt-1 font-sans">
            안녕하세요, <span className="text-[#008f83]">{user.name}</span>님
          </h2>
          <p className="text-sm text-[#647067] mt-0.5">
            포털 권한: <span className="font-semibold text-[#111111]">{user.role || '부서 사용자'}</span> ({user.department || '소속 부서'})
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Refresh Action */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f9f7] rounded-xl text-xs text-[#647067] border border-[#dde5de] font-mono justify-center">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>집계: {dataUpdateTime}</span>
          </div>

          {/* New Selector UI Control */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl text-xs border border-[#dde5de] shadow-sm justify-center">
            <span className="font-bold text-[#647067]">집계 기준:</span>
            <select
              value={dashboardYear}
              onChange={(e) => setDashboardYear(e.target.value)}
              className="h-7 rounded-lg border border-[#dde5de] bg-white px-2 text-xs font-semibold outline-none focus:border-[#008f83]"
            >
              <option value="2025">2025년</option>
              <option value="2026">2026년</option>
              <option value="2027">2027년</option>
            </select>
            <select
              value={dashboardBaseMonth}
              onChange={(e) => setDashboardBaseMonth(Number(e.target.value))}
              className="h-7 rounded-lg border border-[#dde5de] bg-white px-2 text-xs font-semibold outline-none focus:border-[#008f83]"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}월까지
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setAppliedDashboardYear(dashboardYear);
                setAppliedDashboardBaseMonth(dashboardBaseMonth);
                localStorage.setItem('hycm_dashboard_year', dashboardYear);
                localStorage.setItem('hycm_dashboard_base_month', String(dashboardBaseMonth));
              }}
              className="h-7 rounded-lg bg-[#008f83] px-3 text-xs font-bold text-white hover:bg-[#00746b] cursor-pointer transition-all shrink-0"
            >
              조회
            </button>
          </div>

          <button 
            onClick={loadDashboardData}
            className="flex items-center justify-center p-2 bg-white text-[#4e5968] border border-[#dde5de] rounded-xl text-xs font-bold hover:bg-[#f7f9f7] hover:border-[#c4cfc5] transition-all cursor-pointer shadow-sm h-9 md:h-auto"
            title="업데이트 데이터 동기화"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Demo Warning Card Banner */}
      {isDemoMode && (
        <div className="bg-[#fdf6f0] border-2 border-[#F7A059] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#fdf0e2] rounded-xl text-[#F7A059] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#111111] leading-snug">실적 원장 데이터가 없어 화면 확인용 샘플 데이터가 표시됩니다.</p>
              <p className="text-xs text-[#647067] mt-0.5 leading-relaxed">
                실적 시나리오 CSV 원본파일을 업로드하시면 자동 매칭 집계로 실시간 변경 및 검토가 가능합니다.
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/plan-actual-upload')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            실적 업로드하기
          </button>
        </div>
      )}

      {/* Diagnostics / Warning message banner for unassigned month actuals */}
      {dashboardDiagnostics.unassignedActualCount > 0 && (
        <div className="bg-[#fdfcf5] border border-[#e1dbb3] p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <div className="p-1 px-2 bg-amber-100 rounded text-amber-700 font-mono text-[10px] font-bold shrink-0">
            진단 로그
          </div>
          <div className="text-xs text-amber-800 leading-normal">
            회수된 실적 원장 데이터 중 <strong>월(Month) 정보가 누락/미지정된 항목 {dashboardDiagnostics.unassignedActualCount}건</strong>(집계 금액: {formatWon(dashboardDiagnostics.unassignedActualAmount)})이 발견되어, 현재{appliedDashboardYear}년 {appliedDashboardBaseMonth}월까지의 기간 분석 및 누계 집계에서 보수적으로 자동 차감/제외 분류되었습니다.
          </div>
        </div>
      )}

      {/* 3. Operational Metrics Matrix (Bento Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniMetricCard 
          title={`${appliedDashboardYear}년 ${appliedDashboardBaseMonth}월까지 편성 예산`} 
          value={formatMillionWon(stats.totalBudget)} 
          subValue={formatWon(stats.totalBudget)}
          icon={Calculator}
          colorClass="text-[#008f83] bg-teal-50"
        />
        <MiniMetricCard 
          title={`${appliedDashboardYear}년 1~${appliedDashboardBaseMonth}월 누적 실적`} 
          value={formatMillionWon(stats.totalActual)} 
          subValue={formatWon(stats.totalActual)}
          icon={FileSpreadsheet}
          trend={isDemoMode ? "샘플 데이터" : "실제 집행"}
          trendType={isDemoMode ? 'neutral' : 'down'}
          colorClass="text-[#718872] bg-emerald-50"
        />
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-[#647067] uppercase tracking-wider">누적 예산 집행률</span>
            <div className={`p-2 rounded-xl text-brand-600 bg-brand-50`}>
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-[#111111] font-mono tracking-tight">{stats.burnRate}%</h3>
            <div className="w-full bg-[#eef2ec] h-2 rounded-full mt-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getBurnRateColor(stats.burnRate)}`} 
                style={{ width: `${Math.min(stats.burnRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2.5 text-xs text-[#8b95a1]">
              <span>소진 한계 한도 잔여률</span>
              <span className="font-semibold text-[#4e5968]">{Math.max(100 - stats.burnRate, 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <MiniMetricCard 
          title="한도 초과/잠금 이상치" 
          value={`${stats.overrunDeptsCount}건 검출`} 
          subValue={`조회 대상 부서 ${stats.viewableDeptsCount}개 중`}
          icon={AlertTriangle}
          trend={stats.overrunDeptsCount > 0 ? "검토 필요" : "정상"}
          trendType={stats.overrunDeptsCount > 0 ? 'up' : 'down'}
          colorClass={stats.overrunDeptsCount > 0 ? "text-amber-600 bg-amber-50" : "text-[#718872] bg-zinc-100"}
        />
      </div>

      {/* 4. Visually Rich Analytics Charts Segment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Area Chart */}
        <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#eef2ec] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#111111]">전사 예산 대비 실적 누계 추이</h3>
                <p className="text-xs text-[#8b95a1] mt-0.5">{appliedDashboardYear}년 1월~{appliedDashboardBaseMonth}월 기준 누계 현황</p>
              </div>
              <span className="text-[10px] font-mono bg-[#eef2ec] px-2 py-0.5 rounded text-[#647067] uppercase">누계 기준</span>
            </div>
            <div className="h-[260px] w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8ca38d" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#8ca38d" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008f83" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#008f83" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                  <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis 
                    stroke="#8b95a1" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000).toLocaleString('ko-KR')}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatMillionWonWithFull(Number(value)), '']} 
                    contentStyle={{ border: '1px solid #dde5de', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" name="누계 예산" dataKey="누계 예산" stroke="#8ca38d" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPlan)" />
                  <Area type="monotone" name="누계 실적" dataKey="누계 실적" stroke="#008f83" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Department Horizontal Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#eef2ec] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#111111]">부서별 예산 대비 실적 Top 6</h3>
                <p className="text-xs text-[#8b95a1] mt-0.5">{appliedDashboardYear}년 1월~{appliedDashboardBaseMonth}월 누계 기준</p>
              </div>
              <span className="text-[10px] font-mono bg-[#eef2ec] px-2 py-0.5 rounded text-[#647067] uppercase">Top 6</span>
            </div>
            <div className="h-[260px] w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptContrastData} layout="vertical" margin={{ top: 5, right: 5, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2ec" />
                  <XAxis type="number" stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000).toLocaleString('ko-KR')}`} />
                  <YAxis dataKey="name" type="category" stroke="#111111" fontSize={10} axisLine={false} tickLine={false} width={80} />
                  <Tooltip 
                    formatter={(v: any) => [formatMillionWonWithFull(Number(v)), '']}
                    contentStyle={{ border: '1px solid #dde5de', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar name="편성 예산 누계" dataKey="편성 예산" fill="#c4cfc5" radius={[0, 4, 4, 0]} barSize={8} />
                  <Bar name="실제 집행 누계" dataKey="실제 집행" fill="#008f83" radius={[0, 4, 4, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Highly Professional App Workflow Roadmap Guide */}
      <div className="bg-white border border-[#dde5de] p-6 rounded-2xl shadow-sm">
        <h3 className="text-base font-bold text-[#111111] mb-1">{appliedDashboardYear}년 기업 계획 및 통합 통제 업무 수행 맵</h3>
        <p className="text-xs text-[#8b95a1] mb-5">효과적인 예산 집행 관리를 위해 아래 단계순으로 업무를 진행해 주시기 바랍니다.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Timeline Node 1 */}
          <div className="border border-[#dde5de] bg-[#f7f9f7] rounded-xl p-4 flex flex-col justify-between group hover:border-teal-500 transition-all">
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-[#008f83] font-bold">STEP 01</span>
                {isDemoMode ? (
                  <span className="text-[10px] bg-amber-50 text-amber-600 font-bold border border-amber-100 px-1.5 py-0.5 rounded-md">권고 진행</span>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <h4 className="text-sm font-bold text-[#111111] mt-2 leading-tight">실적 업로드 (Plan/Actual)</h4>
              <p className="text-[11px] text-[#647067] mt-1 leading-normal">원장 엑셀 명세를 포털로 업로드해 집계 기틀 확보</p>
            </div>
            <button 
              onClick={() => navigate('/plan-actual-upload')}
              className="flex items-center text-[11px] text-[#008f83] font-bold mt-4 cursor-pointer hover:underline"
            >
              업로드 도구 실행 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* Timeline Node 2 */}
          <div className="border border-[#dde5de] bg-[#f7f9f7] rounded-xl p-4 flex flex-col justify-between group hover:border-teal-500 transition-all">
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-[#008f83] font-bold">STEP 02</span>
                <span className="text-[10px] bg-zinc-100 text-[#4e5968] font-bold px-1.5 py-0.5 rounded-md">필수 전제</span>
              </div>
              <h4 className="text-sm font-bold text-[#111111] mt-2 leading-tight">계정 선택</h4>
              <p className="text-[11px] text-[#647067] mt-1 leading-normal">부서별 예산 작성 전 기입/통제할 전사 핵심 계정 지정</p>
            </div>
            <button 
              onClick={() => navigate('/account-selection')}
              className="flex items-center text-[11px] text-[#008f83] font-bold mt-4 cursor-pointer hover:underline"
            >
              계정 지정/할당 실행 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* Timeline Node 3 */}
          <div className="border border-[#dde5de] bg-[#f7f9f7] rounded-xl p-4 flex flex-col justify-between group hover:border-teal-500 transition-all">
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-[#008f83] font-bold">STEP 03</span>
                <span className="text-[10px] bg-zinc-100 text-[#4e5968] font-bold px-1.5 py-0.5 rounded-md">수립 기간</span>
              </div>
              <h4 className="text-sm font-bold text-[#111111] mt-2 leading-tight">예산 작성</h4>
              <p className="text-[11px] text-[#647067] mt-1 leading-normal">지정된 부서 계정과목 기반 수기 수립 및 연간 예산 확정</p>
            </div>
            <button 
              onClick={() => navigate('/budget-creation')}
              className="flex items-center text-[11px] text-[#008f83] font-bold mt-4 cursor-pointer hover:underline"
            >
              예산 신청 작성 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* Timeline Node 4 */}
          <div className="border border-[#dde5de] bg-[#f7f9f7] rounded-xl p-4 flex flex-col justify-between group hover:border-teal-500 transition-all">
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-[#008f83] font-bold">STEP 04</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold border border-emerald-100 px-1.5 py-0.5 rounded-md">실시간 통제됨</span>
              </div>
              <h4 className="text-sm font-bold text-[#111111] mt-2 leading-tight">예산 한도 점검</h4>
              <p className="text-[11px] text-[#647067] mt-1 leading-normal">기결정 한도 대비 초과 및 집행 잔액 상태 실시간 감사</p>
            </div>
            <button 
              onClick={() => navigate('/overrun-check')}
              className="flex items-center text-[11px] text-[#008f83] font-bold mt-4 cursor-pointer hover:underline"
            >
              경보 및 한도 점검 <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Live Department Stream Tracker Feed */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#eef2ec]">
          <h3 className="text-base font-bold text-[#111111]">실시간 부서별 계획서 제출 및 조절 모니터</h3>
          <p className="text-xs text-[#8b95a1] mt-0.5">결재 대상 전사 예산 수립 진행 실시간 통제 로그</p>
        </div>
        
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7]">
              <tr>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider">부서명 (Code)</th>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider">담당 마스터</th>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider text-right">총 편성 예산</th>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider text-right">실제 집행 누계</th>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider text-center">계획서 결제 상태</th>
                <th className="px-6 py-3 text-[11px] font-bold text-[#647067] uppercase tracking-wider text-center">통제 작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {deptFeed.slice(0, 10).map((dept, i) => {
                const isUnderDraft = dept.status === 'DRAFT' || !dept.status;
                const isApproved = ['APPROVED', 'LOCKED'].includes(dept.status);
                
                return (
                  <tr key={dept.code} className="hover:bg-[#f7f9f7] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111111]">{dept.name}</span>
                        <span className="text-[10px] font-mono text-[#8b95a1]">({dept.code})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[#4e5968]">{dept.manager}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium text-[#111111]" title={formatWon(dept.budgetSum)}>
                      {formatMillionWon(dept.budgetSum)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-[#4e5968]" title={formatWon(dept.actualSum)}>
                      {formatMillionWon(dept.actualSum)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isApproved 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : dept.status === 'SUBMITTED' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-zinc-50 text-zinc-600 border border-zinc-200'
                      }`}>
                        {dept.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => navigate('/budget-creation', { state: { initialDeptCode: dept.code } })}
                          className="px-2.5 py-1 border border-[#dde5de] hover:border-teal-500 hover:text-[#008f83] rounded-md text-[11px] font-bold text-[#4e5968] cursor-pointer transition-all bg-white"
                        >
                          예산 편성
                        </button>
                        <button 
                          onClick={() => navigate('/business-activity-budget', { state: { initialDeptCode: dept.code } })}
                          className="px-2.5 py-1 border border-[#dde5de] hover:border-teal-500 hover:text-[#008f83] rounded-md text-[11px] font-bold text-[#4e5968] cursor-pointer transition-all bg-white"
                          title="업무활동경비"
                        >
                          자동산출
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {deptFeed.length > 10 && (
          <div className="bg-[#f7f9f7] p-2.5 text-center border-t border-[#eef2ec]">
            <span className="text-[11px] text-[#647067] font-medium">뷰가 허용된 전체 {deptFeed.length}개 부서가 전부 집계되었습니다.</span>
          </div>
        )}
      </div>
    </div>
  );
}
