import React, { useState } from 'react';
import { AlertTriangle, Download, Search, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
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
  const [period, setPeriod] = useState('1Q');
  const [selectedDeptCode, setSelectedDeptCode] = useState('전체');
  const [accountCategory, setAccountCategory] = useState('전체');
  const [overrunFilter, setOverrunFilter] = useState('초과 항목만');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
    const overruns = monthlyDetails.filter(m => m.status !== '정상');
    if (overruns.length === 0) return '-';
    return overruns.map(m => {
      const type = m.status === '무예산 집행' ? '무예산' : '+';
      return `${m.month}월 ${type} ${m.overrunAmount.toLocaleString()}`;
    }).join(' / ');
  };

  const formatOverrunMonths = (months: number[]) => {
    if (!months || months.length === 0) return '-';
    return months.map(m => `${m}월`).join(', ');
  };

  const handleSearch = () => {
    const deptCodes = selectedDeptCode === '전체' 
      ? viewableDeptCodes 
      : [selectedDeptCode];

    const budgetRows = getBudgetRowsByDeptYearPlan(deptCodes, year, planType);
    const actualRows = getActualRowsByYear(year);
    let qMonths = MONTHS;
    if (period in QUARTERS) {
      qMonths = QUARTERS[period];
    } else if (period.endsWith('월')) {
      qMonths = [parseInt(period) - 1];
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
      if (accountCategory === '제조' && !row.accountCode.startsWith('A')) return false;
      if (accountCategory === '판관' && !row.accountCode.startsWith('B')) return false;
      if (accountCategory === '인건비 제외' && isSalaryAccountCode(row.accountCode)) return false;
      if (accountCategory === '인건비만 보기' && !isSalaryAccountCode(row.accountCode)) return false;
      
      const isInvest = typeof isInvestmentAccount !== 'undefined' ? isInvestmentAccount(row.accountCode) : false;
      if (accountCategory === '투자예산' && !isInvest) return false;
      if (accountCategory === '일반비용' && isInvest) return false;

      // 2. Filter by overrun status
      if (overrunFilter === '초과 항목만' && row.status === '정상') return false;

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
    // 엑셀 다운로드 (권한 필터는 이미 results에 반영되어 있음)
    import('xlsx').then(XLSX => {
      const data = results.map(r => ({
        '부서코드': r.deptCode,
        '부서명': depts.find(d => d.code === r.deptCode)?.name || '',
        '계정과목코드': r.accountCode,
        '계정과목': r.accountName,
        '초과월': formatOverrunMonths(r.overrunMonths),
        '초과월수': r.overrunMonths.length > 0 ? r.overrunMonths.length + '개월' : '-',
        '분기예산': r.qBudget,
        '분기실적': r.qActual,
        '초과금액': r.overrunAmount,
        '잔액': r.balance,
        '초과율(%)': r.overrunRate ? r.overrunRate.toFixed(2) + '%' : '예산 없음',
        '최대초과월': r.maxOverrunMonth ? r.maxOverrunMonth + '월' : '-',
        '최대초과금액': r.maxOverrunAmount,
        '연도예산': r.yBudget,
        '연도실적': r.yActual,
        '상태': r.status,
        '월별초과내역': formatMonthlyDetails(r.monthlyDetails)
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '예산초과점검');

      // Create detailed monthly sheet
      const detailsData: any[] = [];
      results.forEach(r => {
        const deptName = depts.find(d => d.code === r.deptCode)?.name || '';
        r.monthlyDetails.forEach((m: any) => {
          detailsData.push({
            '부서코드': r.deptCode,
            '부서': deptName,
            '계정과목코드': r.accountCode,
            '계정과목': r.accountName,
            '월': m.month + '월',
            '월예산': m.budget,
            '월실적': m.actual,
            '월초과금액': m.overrunAmount,
            '월잔액': m.balance,
            '상태': m.status
          });
        });
      });
      const wsDetails = XLSX.utils.json_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(wb, wsDetails, '월별상세');
      
      const deptName = selectedDeptCode === '전체' ? '전체부서' : (depts.find(d => d.code === selectedDeptCode)?.name || selectedDeptCode);
      XLSX.writeFile(wb, `예산초과점검_${year}_${planType}_${period}_${deptName}.xlsx`);
    });
  };

  return (
    <div className="p-6">
      <PageHeader 
        title={<><AlertTriangle className="inline-block w-6 h-6 text-cobalt-500 mr-2 -mt-1"/>예산 초과 점검</>}
        description="조직별/계정별 예산 집행 현황을 검토하고 초과 내역을 확인합니다."
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
        <FilterItem label="분석기간">
          <AppSelect value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="전체">전체 연도</option>
            <option value="1Q">1분기</option>
            <option value="2Q">2분기</option>
            <option value="3Q">3분기</option>
            <option value="4Q">4분기</option>
            <option value="1월">1월</option>
            <option value="2월">2월</option>
            <option value="3월">3월</option>
            <option value="4월">4월</option>
            <option value="5월">5월</option>
            <option value="6월">6월</option>
            <option value="7월">7월</option>
            <option value="8월">8월</option>
            <option value="9월">9월</option>
            <option value="10월">10월</option>
            <option value="11월">11월</option>
            <option value="12월">12월</option>
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
            <option value="전체">전체</option>
            <option value="일반비용">일반비용</option>
            <option value="투자예산">투자예산</option>
            <option value="제조">제조</option>
            <option value="판관">판관</option>
            <option value="인건비 제외">인건비 제외</option>
            {salaryAccess && <option value="인건비만 보기">인건비만 보기</option>}
          </AppSelect>
        </FilterItem>
        <FilterItem label="초과 여부">
          <AppSelect value={overrunFilter} onChange={(e) => setOverrunFilter(e.target.value)}>
            <option value="초과 항목만">초과 항목만</option>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard 
              title="초과 계정 수" 
              value={`${results.filter(r => r.status === '초과').length}건`}
              variant="warning"
            />
             <MetricCard 
              title="초과 금액 합계" 
              value={<BudgetAmount value={results.reduce((sum, r) => sum + r.overrunAmount, 0)} />}
              variant="warning"
            />
            <MetricCard 
              title="무예산 집행 건수" 
              value={`${results.filter(r => r.status === '무예산 집행').length}건`}
              variant="warning"
            />
            <MetricCard 
              title="조회 대상 부서 수" 
              value={`${new Set(results.map(r => r.deptCode)).size}개 부서`}
            />
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
                   <AppTableHead>초과월</AppTableHead>
                   <AppTableHead>초과월수</AppTableHead>
                   <AppTableHead className="text-right">분기예산</AppTableHead>
                   <AppTableHead className="text-right">분기실적</AppTableHead>
                   <AppTableHead className="text-right">초과금액</AppTableHead>
                   <AppTableHead className="text-right">잔액</AppTableHead>
                   <AppTableHead className="text-right">초과율</AppTableHead>
                   <AppTableHead>최대초과월</AppTableHead>
                   <AppTableHead className="text-right">최대초과금액</AppTableHead>
                   <AppTableHead className="text-right">연도예산</AppTableHead>
                   <AppTableHead className="text-right">연도실적</AppTableHead>
                   <AppTableHead className="text-center">상태</AppTableHead>
                 </tr>
               </AppTableHeader>
               <AppTableBody>
                 {results.map((r, i) => (
                   <React.Fragment key={i}>
                   <AppTableRow onClick={() => toggleRow(i)} className="cursor-pointer hover:bg-lithium-50/50">
                     <AppTableCell>
                        {expandedRows.has(i) ? <ChevronUp className="w-4 h-4 text-lithium-500" /> : <ChevronDown className="w-4 h-4 text-lithium-500" />}
                     </AppTableCell>
                     <AppTableCell className="text-lithium-600">{r.deptCode}</AppTableCell>
                     <AppTableCell>{depts.find(d => d.code === r.deptCode)?.name}</AppTableCell>
                     <AppTableCell className="text-lithium-500">{r.accountCode}</AppTableCell>
                     <AppTableCell>{r.accountName}</AppTableCell>
                     <AppTableCell className="text-cobalt-600 font-bold">{formatOverrunMonths(r.overrunMonths)}</AppTableCell>
                     <AppTableCell>{r.overrunMonths.length > 0 ? r.overrunMonths.length + '개월' : '-'}</AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qBudget} /></AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qActual} /></AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetAmount value={r.overrunAmount} tone={r.overrunAmount > 0 ? "warning" : "default"} />
                     </AppTableCell>
                     <AppTableCell className="text-right text-lithium-600"><BudgetAmount value={r.balance} /></AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetRate value={r.overrunRate} />
                     </AppTableCell>
                     <AppTableCell>{r.maxOverrunMonth ? `${r.maxOverrunMonth}월` : '-'}</AppTableCell>
                     <AppTableCell className="text-right text-cobalt-600 font-medium">
                        {r.maxOverrunAmount > 0 ? <BudgetAmount value={r.maxOverrunAmount} /> : '-'}
                     </AppTableCell>
                     <AppTableCell className="text-right text-lithium-500"><BudgetAmount value={r.yBudget} /></AppTableCell>
                     <AppTableCell className="text-right text-lithium-500"><BudgetAmount value={r.yActual} /></AppTableCell>
                     <AppTableCell className="text-center">
                       <OverrunBadge status={r.status} />
                     </AppTableCell>
                   </AppTableRow>
                   {expandedRows.has(i) && (
                     <AppTableRow className="bg-lithium-50/30">
                       <AppTableCell></AppTableCell>
                       <AppTableCell colSpan={16} className="p-0">
                         <div className="py-2 pr-6">
                           <table className="w-full text-xs ml-4 border border-lithium-200 bg-white rounded-lg overflow-hidden my-2 shadow-sm">
                             <thead className="bg-lithium-50 font-bold text-lithium-600">
                               <tr>
                                 <th className="px-3 py-2 text-left border-b border-lithium-200">월</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월예산</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월실적</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월초과금액</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월잔액</th>
                                 <th className="px-3 py-2 text-center border-b border-lithium-200">상태</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-lithium-100">
                               {r.monthlyDetails.map((m: any) => (
                                 <tr key={m.month} className="hover:bg-lithium-50/50">
                                   <td className="px-3 py-2 text-eco-black font-medium">{m.month}월</td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.budget.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-right text-eco-black">{m.actual.toLocaleString()}원</td>
                                   <td className={`px-3 py-2 text-right font-medium ${m.overrunAmount > 0 ? 'text-cobalt-600' : 'text-lithium-500'}`}>
                                     {m.overrunAmount > 0 ? `+${m.overrunAmount.toLocaleString()}원` : '-'}
                                   </td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.balance.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-center">
                                     <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                       m.status === '정상' ? 'bg-lithium-100 text-lithium-600' :
                                       m.status === '무예산 집행' ? 'bg-cobalt-50 text-cobalt-600' :
                                       'bg-cobalt-100 text-cobalt-700'
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
    </div>
  );
}
