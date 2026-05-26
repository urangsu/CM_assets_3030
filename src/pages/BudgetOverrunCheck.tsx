import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, Search, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';
import { classifyAccount, ACCOUNT_CLASS_OPTIONS } from '../lib/accountClassification';
import { getBudgetRowsByDeptYearPlan, getActualRowsByYear, isSalaryAccountCode, parsePeriodMonth, aggregateByDeptAccount } from '../lib/budgetAggregation';
import { canViewSalaryAccounts, getViewableDeptCodes } from '../lib/permissions';
import { isInvestmentAccount } from '../lib/accountMaster';

// Components
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar, FilterItem } from '../components/budget/FilterBar';
import { AppSelect } from '../components/ui/AppSelect';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { MetricCard } from '../components/budget/MetricCard';
import { AppTable, AppTableHeader, AppTableRow, AppTableHead, AppTableBody, AppTableCell } from '../components/ui/AppTable';
import { BudgetAmount } from '../components/budget/BudgetAmount';
import { BudgetRate } from '../components/budget/BudgetRate';
import { OverrunBadge } from '../components/budget/OverrunBadge';
import { ExportButtonGroup } from '../components/budget/ExportButtonGroup';
import { EmptyState } from '../components/ui/EmptyState';
import ReviewDrawer, { ReviewItem } from '../components/budget/ReviewDrawer';

const QUARTERS: Record<string, number[]> = {
  '1Q': [0, 1, 2],
  '2Q': [3, 4, 5],
  '3Q': [6, 7, 8],
  '4Q': [9, 10, 11],
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

export default function BudgetOverrunCheck() {
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [monthMode, setMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDeptCode, setSelectedDeptCode] = useState('전체');
  const [accountCategory, setAccountCategory] = useState('전체');
  const [overrunFilter, setOverrunFilter] = useState('초과 항목만');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewItem | null>(null);

  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');

  const depts = getAllDepartments();
  const viewableDeptCodes = getViewableDeptCodes(currentUser);
  const salaryAccess = canViewSalaryAccounts(currentUser);

  const toggleRow = (index: number) => {
    const next = new Set(expandedRows);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedRows(next);
  };

  const formatMonthlyDetails = (monthlyDetails: any[]) => {
    const abnormalities = monthlyDetails.filter(m => m.status !== '정상');
    if (abnormalities.length === 0) return '-';
    return abnormalities.map(m => {
      let label = '';
      let amount = 0;
      if (m.status === '무예산 집행') { label = '무예산'; amount = m.overrunAmount; }
      else if (m.status === '초과') { label = '초과'; amount = m.overrunAmount; }
      else if (m.status === '미달') { label = '미달'; amount = m.shortfallAmount; }
      return `${m.month}월 ${label} ${amount.toLocaleString()}`;
    }).join(' / ');
  };

  const formatListMonths = (months: number[]) => {
    if (!months || months.length === 0) return '-';
    return months.map(m => `${m}월`).join(', ');
  };

  const handleSearch = () => {
    const deptCodes = selectedDeptCode === '전체' 
      ? viewableDeptCodes 
      : [selectedDeptCode];

    const budgetRows = getBudgetRowsByDeptYearPlan(deptCodes, year, planType);
    const actualRows = getActualRowsByYear(year);
    
    let qMonths: number[] = [];
    if (monthMode === 'MONTH') {
      qMonths = [selectedMonth - 1];
    } else {
      qMonths = Array.from({ length: selectedMonth }, (_, i) => i);
    }

    const rawData = aggregateByDeptAccount({
      budgetRows,
      actualRows,
      months: qMonths,
      allowedDeptCodes: deptCodes,
      canViewSalary: salaryAccess
    });

    const overrunData = rawData.filter(row => {
      // 1. Filter by category
      if (accountCategory !== '전체') {
        const rowClass = classifyAccount(row.accountCode, row.accountName);
        if (rowClass !== accountCategory) return false;
      }

      // 2. Filter by overrun status
      if (overrunFilter === '초과 항목만' && row.status !== '초과') return false;
      if (overrunFilter === '미달 항목만' && row.status !== '미달') return false;
      if (overrunFilter === '무예산 집행만' && row.status !== '무예산 집행') return false;
      if (overrunFilter === '정상 항목만' && row.status !== '정상') return false;

      return true;
    });

    overrunData.sort((a, b) => {
      const statusOrder: Record<string, number> = { '초과': 1, '무예산 집행': 2, '정상': 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.overrunAmount !== b.overrunAmount) {
        return b.overrunAmount - a.overrunAmount;
      }
      if (a.overrunRate !== b.overrunRate) {
        return (b.overrunRate || 0) - (a.overrunRate || 0);
      }
      return a.deptCode.localeCompare(b.deptCode);
    });

    setResults(overrunData);
    setSearched(true);
  };

  const exportToExcel = () => {
    import('xlsx').then(XLSX => {
      const data = results.map(r => ({
        '부서코드': r.deptCode,
        '부서명': depts.find(d => d.code === r.deptCode)?.name || '',
        '계정과목코드': r.accountCode,
        '계정과목': r.accountName,
        '초과/미달월': r.status === '미달' ? formatListMonths(r.shortfallMonths) : formatListMonths(r.overrunMonths),
        '월수': (r.status === '미달' ? r.shortfallMonths.length : r.overrunMonths.length) > 0 ? (r.status === '미달' ? r.shortfallMonths.length : r.overrunMonths.length) + '개월' : '-',
        '기간예산': r.qBudget,
        '기간실적': r.qActual,
        '초과금액': r.overrunAmount,
        '미달금액': r.shortfallAmount,
        '잔액': r.balance,
        '초과율(%)': r.overrunRate ? r.overrunRate.toFixed(2) + '%' : '예산 없음',
        '미달률(%)': r.shortfallRate ? r.shortfallRate.toFixed(2) + '%' : '-',
        '집행률(%)': r.qBudget > 0 ? ((r.qActual / r.qBudget) * 100).toFixed(2) + '%' : '-',
        '최대초과월': r.maxOverrunMonth ? r.maxOverrunMonth + '월' : '-',
        '최대초과금액': r.maxOverrunAmount,
        '최대미달월': r.maxShortfallMonth ? r.maxShortfallMonth + '월' : '-',
        '최대미달금액': r.maxShortfallAmount,
        '연도예산': r.yBudget,
        '연도실적': r.yActual,
        '상태': r.status,
        '월별상세내역': formatMonthlyDetails(r.monthlyDetails)
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '예산점검');

      const detailsData: any[] = [];
      results.forEach(r => {
        const deptName = depts.find(d => d.code === r.deptCode)?.name || '';
        r.monthlyDetails.forEach((m: any) => {
          detailsData.push({
            '부서코드': r.deptCode,
            '부서명': deptName,
            '계정과목코드': r.accountCode,
            '계정과목': r.accountName,
            '월': m.month + '월',
            '월예산': m.budget,
            '월실적': m.actual,
            '월초과금액': m.overrunAmount,
            '월미달금액': m.shortfallAmount,
            '월잔액': m.balance,
            '상태': m.status
          });
        });
      });
      const wsDetails = XLSX.utils.json_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(wb, wsDetails, '월별상세');
      
      const deptName = selectedDeptCode === '전체' ? '전체부서' : (depts.find(d => d.code === selectedDeptCode)?.name || selectedDeptCode);
      const periodName = getMonthModeLabel(monthMode, selectedMonth);
      XLSX.writeFile(wb, `예산점검_${year}_${planType}_${periodName}_${deptName}.xlsx`);
    });
  };

  return (
    <div className="p-6">
      <PageHeader 
        title={<><AlertTriangle className="inline-block w-6 h-6 text-[#F7A059] mr-2 -mt-1"/>예산 초과 통제 보드</>}
        description="조직별/계정별 실제 집행 대비 예산 소진 현황을 검토하고 비정상적 초과 및 불용 내역을 검증 통제합니다."
      />
      
      <FilterBar 
        actions={
          <ExportButtonGroup>
            <AppButton variant="secondary" onClick={exportToExcel} leftIcon={<Download className="w-4 h-4" />}>
              엑셀 다운로드
            </AppButton>
            <AppButton variant="primary" onClick={handleSearch} leftIcon={<Search className="w-4 h-4" />}>
              조회
            </AppButton>
          </ExportButtonGroup>
        }
      >
        <FilterItem label="연도">
          <AppSelect value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2024">2024년</option>
            <option value="2025">2025년</option>
            <option value="2026">2026년</option>
            <option value="2027">2027년</option>
          </AppSelect>
        </FilterItem>
        <FilterItem label="계획구분">
          <AppSelect value={planType} onChange={(e) => setPlanType(e.target.value)}>
            <option value="경영계획">경영계획</option>
            <option value="수정경영계획">수정경영계획</option>
            <option value="1차RP">1차RP</option>
            <option value="2차RP">2차RP</option>
          </AppSelect>
        </FilterItem>
        <FilterItem label="조회 기준">
          <AppSelect value={monthMode} onChange={(e) => setMonthMode(e.target.value as MonthMode)}>
            <option value="YTD">누계</option>
            <option value="MONTH">단월</option>
          </AppSelect>
        </FilterItem>
        <FilterItem label="기준 월">
          <AppSelect value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m) => (
              <option key={m+1} value={m+1}>{m+1}월</option>
            ))}
          </AppSelect>
        </FilterItem>
        <FilterItem label="부서">
          <AppSelect value={selectedDeptCode} onChange={(e) => setSelectedDeptCode(e.target.value)}>
            <option value="전체">전체 조회 부서</option>
            {depts.filter(d => viewableDeptCodes.includes(d.code)).map(d => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </AppSelect>
        </FilterItem>
        <FilterItem label="계정구분">
          <AppSelect value={accountCategory} onChange={(e) => setAccountCategory(e.target.value)}>
            <option value="전체">전체 계정군</option>
            {ACCOUNT_CLASS_OPTIONS.filter(opt => opt !== '전체').map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </AppSelect>
        </FilterItem>
        <FilterItem label="상태 보기">
          <AppSelect value={overrunFilter} onChange={(e) => setOverrunFilter(e.target.value)}>
            <option value="초과 항목만">초과 항목만</option>
            <option value="미달 항목만">미달 항목만</option>
            <option value="무예산 집행만">무예산 집행만</option>
            <option value="정상 항목만">정상 항목만</option>
            <option value="전체 보기">전체 보기</option>
          </AppSelect>
        </FilterItem>
      </FilterBar>

      <div className="flex justify-between items-center text-sm text-lithium-500 mb-6 px-2">
        <span>* 조회 권한이 있는 부서의 데이터만 표시됩니다.<br/>* 급여성 계정은 권한이 있는 사용자에게만 표시됩니다.</span>
      </div>

      {!searched && (
        <EmptyState 
          icon={AlertCircle} 
          title="조회 대기 중" 
          description="필터 조건을 선택한 후 조회 버튼을 눌러 예산 초과 현황을 확인하세요."
        />
      )}

      {searched && results.length === 0 && (
        <EmptyState 
          icon={Search} 
          title="결과 없음" 
          description="해당 조건의 예산 내역이 존재하지 않습니다."
        />
      )}
      
      {searched && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <MetricCard title="초과 계정 수" value={`${results.filter(r => r.status === '초과').length}건`} variant="warning" />
            <MetricCard title="초과 금액 합계" value={<BudgetAmount value={results.reduce((sum, r) => sum + r.overrunAmount, 0)} />} variant="warning" />
            <MetricCard title="미달 계정 수" value={`${results.filter(r => r.status === '미달').length}건`} variant="success" />
            <MetricCard title="미달 금액 합계" value={<BudgetAmount value={results.reduce((sum, r) => sum + r.shortfallAmount, 0)} />} variant="success" />
            <MetricCard title="무예산 집행 건수" value={`${results.filter(r => r.status === '무예산 집행').length}건`} />
            <MetricCard title="조회 대상 부서 수" value={`${new Set(results.map(r => r.deptCode)).size}개 부서`} />
          </div>
          
          <AppCard className="overflow-hidden">
            <AppTable>
               <AppTableHeader>
                 <tr>
                   <AppTableHead className="w-8"></AppTableHead>
                   <AppTableHead>부서코드</AppTableHead>
                   <AppTableHead>부서</AppTableHead>
                   <AppTableHead>계정과목코드</AppTableHead>
                   <AppTableHead>계정과목</AppTableHead>
                   <AppTableHead>초과/미달월</AppTableHead>
                   <AppTableHead>월수</AppTableHead>
                   <AppTableHead className="text-right">기간예산</AppTableHead>
                   <AppTableHead className="text-right">기간실적</AppTableHead>
                   <AppTableHead className="text-right">초과금액</AppTableHead>
                   <AppTableHead className="text-right">미달금액</AppTableHead>
                   <AppTableHead className="text-right">잔액</AppTableHead>
                   <AppTableHead className="text-right">집행률(%)</AppTableHead>
                   <AppTableHead>최대발생월</AppTableHead>
                   <AppTableHead className="text-right">최대발생금</AppTableHead>
                   <AppTableHead className="text-right">연도예산</AppTableHead>
                   <AppTableHead className="text-right">연도실적</AppTableHead>
                   <AppTableHead className="text-center">상태</AppTableHead>
                   <AppTableHead className="text-center font-bold">의견/조치</AppTableHead>
                 </tr>
               </AppTableHeader>
               <AppTableBody>
                 {results.map((r, i) => (
                   <React.Fragment key={i}>
                   <AppTableRow onClick={() => toggleRow(i)} className="cursor-pointer hover:bg-zinc-50/50">
                     <AppTableCell onClick={(e) => { e.stopPropagation(); toggleRow(i); }}>
                        {expandedRows.has(i) ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                     </AppTableCell>
                     <AppTableCell className="text-zinc-600">{r.deptCode}</AppTableCell>
                     <AppTableCell>{depts.find(d => d.code === r.deptCode)?.name}</AppTableCell>
                     <AppTableCell className="text-zinc-500">{r.accountCode}</AppTableCell>
                     <AppTableCell>{r.accountName}</AppTableCell>
                     <AppTableCell className={r.status === '미달' ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{r.status === '미달' ? formatListMonths(r.shortfallMonths) : formatListMonths(r.overrunMonths)}</AppTableCell>
                     <AppTableCell>{(r.status === '미달' ? r.shortfallMonths.length : r.overrunMonths.length) > 0 ? (r.status === '미달' ? r.shortfallMonths.length : r.overrunMonths.length) + '개월' : '-'}</AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qBudget} /></AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qActual} /></AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetAmount value={r.overrunAmount} tone={r.overrunAmount > 0 ? "warning" : "default"} />
                     </AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetAmount value={r.shortfallAmount} tone={r.status === '미달' ? "success" : "default"} />
                     </AppTableCell>
                     <AppTableCell className="text-right text-zinc-600"><BudgetAmount value={r.balance} /></AppTableCell>
                     <AppTableCell className="text-right">
                       {r.qBudget > 0 ? <BudgetRate value={(r.qActual / r.qBudget) * 100} /> : <span className="text-zinc-450 text-xs">예산 없음</span>}
                     </AppTableCell>
                     <AppTableCell>{r.status === '미달' ? (r.maxShortfallMonth ? `${r.maxShortfallMonth}월` : '-') : (r.maxOverrunMonth ? `${r.maxOverrunMonth}월` : '-')}</AppTableCell>
                     <AppTableCell className="text-right font-medium">
                        {r.status === '미달' ? (r.maxShortfallAmount > 0 ? <span className="text-emerald-600"><BudgetAmount value={r.maxShortfallAmount} /></span> : '-') : (r.maxOverrunAmount > 0 ? <span className="text-rose-600"><BudgetAmount value={r.maxOverrunAmount} /></span> : '-')}
                     </AppTableCell>
                     <AppTableCell className="text-right text-zinc-500"><BudgetAmount value={r.yBudget} /></AppTableCell>
                     <AppTableCell className="text-right text-zinc-500"><BudgetAmount value={r.yActual} /></AppTableCell>
                     <AppTableCell className="text-center">
                       <OverrunBadge status={r.status} />
                     </AppTableCell>
                     <AppTableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           const subId = `overrun-${r.deptCode}-${r.accountCode}`;
                           const localReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
                           const savedReview = localReviews[subId];

                           setActiveReviewItem({
                             id: subId,
                             deptCode: r.deptCode,
                             deptName: depts.find(d => d.code === r.deptCode)?.name || r.deptCode,
                             accountCode: r.accountCode,
                             accountName: r.accountName,
                             budgetAmount: r.qBudget,
                             actualAmount: r.qActual,
                             differenceAmount: r.overrunAmount || r.shortfallAmount || 0,
                             burnRate: r.qBudget > 0 ? Number(((r.qActual / r.qBudget) * 100).toFixed(1)) : 100,
                             anomalyType: r.status === '초과' ? 'OVERRUN' : r.status === '무예산 집행' ? 'UNBUDGETED' : 'UNDERRUN',
                             remarks: `최대발생월: ${r.maxOverrunMonth || r.maxShortfallMonth || '-'}월`,
                             status: savedReview ? savedReview.status : 'DRAFT',
                             statusLabel: savedReview ? (savedReview.status === 'APPROVED' ? '조정 최종 승인' : savedReview.status === 'ACTION_REQ' ? '부서 통보 조치' : '보류') : '검토 대기'
                           });
                           setIsDrawerOpen(true);
                         }}
                         className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-[#dde5de] text-zinc-700 hover:border-teal-500 hover:text-teal-600 font-semibold rounded cursor-pointer transition-all"
                       >
                         조치 상신
                       </button>
                     </AppTableCell>
                   </AppTableRow>
                   {expandedRows.has(i) && (
                     <AppTableRow className="bg-zinc-50/10">
                       <AppTableCell></AppTableCell>
                       <AppTableCell colSpan={18} className="p-0 font-sans">
                         <div className="py-2 pr-6">
                           <table className="w-full text-xs ml-4 border border-zinc-200 bg-white rounded-lg overflow-hidden my-2 shadow-sm">
                             <thead className="bg-[#f7f9f7] font-bold text-zinc-600">
                               <tr>
                                 <th className="px-3 py-2 text-left border-b border-zinc-150">월</th>
                                 <th className="px-3 py-2 text-right border-b border-zinc-150">월예산</th>
                                 <th className="px-3 py-2 text-right border-b border-zinc-150">월실적</th>
                                 <th className="px-3 py-2 text-right border-b border-zinc-150">월초과금액</th>
                                 <th className="px-3 py-2 text-right border-b border-zinc-150">월미달금액</th>
                                 <th className="px-3 py-2 text-right border-b border-zinc-150">월잔액</th>
                                 <th className="px-3 py-2 text-center border-b border-zinc-150">상태</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-zinc-100">
                               {r.monthlyDetails.map((m: any) => (
                                 <tr key={m.month} className="hover:bg-zinc-50/30">
                                   <td className="px-3 py-2 text-zinc-900 font-medium">{m.month}월</td>
                                   <td className="px-3 py-2 text-right text-zinc-550">{m.budget.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-right text-zinc-900">{m.actual.toLocaleString()}원</td>
                                   <td className={`px-3 py-2 text-right font-medium ${m.overrunAmount > 0 ? 'text-rose-600' : 'text-zinc-400'}`}>
                                     {m.overrunAmount > 0 ? `+${m.overrunAmount.toLocaleString()}원` : '-'}
                                   </td>
                                   <td className={`px-3 py-2 text-right font-medium ${m.shortfallAmount > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                     {m.shortfallAmount > 0 ? `${m.shortfallAmount.toLocaleString()}원` : '-'}
                                   </td>
                                   <td className="px-3 py-2 text-right text-zinc-500">{m.balance.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-center">
                                     <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                       m.status === '정상' ? 'bg-zinc-50 text-zinc-600' :
                                       m.status === '미달' ? 'bg-emerald-50 text-emerald-600' :
                                       m.status === '무예산 집행' ? 'bg-rose-50 text-rose-600' :
                                       'bg-rose-105 text-rose-700'
                                     }`}>{m.status}</span>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       </AppTableCell>
                     </AppTableRow>
                   )}
                   </React.Fragment>
                 ))}
               </AppTableBody>
            </AppTable>
          </AppCard>
        </>
      )}

      <ReviewDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={activeReviewItem}
        onSave={handleSearch}
      />

      {/* Flow Assist Bridge Panel */}
      <div className="bg-[#fcfdfe] p-6 rounded-2xl border border-teal-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
            비즈니스 중요 플로우 연속성 가이드
          </h4>
          <p className="text-xs text-[#647067] mt-1">
            조직의 한도 오버런 및 무예산 항목 조사가 끝났습니까? 마지막 대미를 장식할 단계는 전사 계획과 실적을 부서/월/계정 단위로 정밀 비교 시각화하는 <strong className="text-teal-700">실적 및 계획 대비 비교분석</strong> 페이지입니다.
          </p>
        </div>
        <button
          onClick={() => navigate('/variance-comparison')}
          className="px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
        >
          실적-계획 비교분석 단계로 이동 →
        </button>
      </div>
    </div>
  );
}
