import React, { useState } from 'react';
import { AlertTriangle, Download, Search, AlertCircle } from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { getBudgetRowsByDeptYearPlan, getActualRowsByYear, isSalaryAccountCode, parsePeriodMonth } from '../lib/budgetAggregation';
import { canViewSalaryAccounts, getViewableDeptCodes } from '../lib/permissions';

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
  const [quarter, setQuarter] = useState('1Q');
  const [selectedDeptCode, setSelectedDeptCode] = useState('전체');
  const [accountCategory, setAccountCategory] = useState('전체');
  const [overrunFilter, setOverrunFilter] = useState('초과 항목만');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');

  const depts = getAllDepartments();
  const viewableDeptCodes = getViewableDeptCodes(currentUser);
  const salaryAccess = canViewSalaryAccounts(currentUser);

  const handleSearch = () => {
    const deptCodes = selectedDeptCode === '전체' 
      ? viewableDeptCodes 
      : [selectedDeptCode];

    const budgetRows = getBudgetRowsByDeptYearPlan(deptCodes, year, planType);
    const actualRows = getActualRowsByYear(year);

    const qMonths = quarter === '전체' ? MONTHS : QUARTERS[quarter];
    const unionKeys = new Set<string>();
    
    // Group Budgets
    const budgetMap = new Map<string, any>();
    budgetRows.forEach(row => {
      const key = `${row.attributedDeptCode}_${row.code}`;
      unionKeys.add(key);
      budgetMap.set(key, { ...row });
    });

    // Group Actuals
    const actualMap = new Map<string, { qActual: number, yActual: number, accountName: string }>();
    actualRows.forEach(a => {
      const monthIndex = parsePeriodMonth(a.period);
      const isQuarter = qMonths.includes(monthIndex);
      const isYear = true; // All are current year
      if (isYear) {
         const key = `${a.usageCode}_${a.accountCode}`;
         if (deptCodes.includes(a.usageCode)) unionKeys.add(key);
         
         const existing = actualMap.get(key) || { qActual: 0, yActual: 0, accountName: a.accountName || a.accountCode };
         
         // Use the `completed` value for actuals
         if (isQuarter) existing.qActual += a.completed || 0;
         existing.yActual += a.completed || 0;
         actualMap.set(key, existing);
      }
    });

    const overrunData: any[] = [];

    Array.from(unionKeys).forEach(key => {
      const [deptCode, accountCode] = key.split('_');
      
      // 1. Permission Check
      if (!viewableDeptCodes.includes(deptCode)) return;
      if (isSalaryAccountCode(accountCode) && !salaryAccess) return;
      
      // Filter by category
      if (accountCategory === '제조' && !accountCode.startsWith('A')) return;
      if (accountCategory === '판관' && !accountCode.startsWith('B')) return;

      const budgetRow = budgetMap.get(key);
      const actualRow = actualMap.get(key);

      const qBudget = budgetRow ? qMonths.reduce((sum: number, m: number) => sum + (budgetRow.values[m] || 0), 0) : 0;
      const yBudget = budgetRow ? budgetRow.values.reduce((sum: number, v: number) => sum + (v || 0), 0) : 0;
      
      const qActual = actualRow ? actualRow.qActual : 0;
      const yActual = actualRow ? actualRow.yActual : 0;

      const overrunAmount = Math.max(qActual - qBudget, 0);
      const balance = qBudget - qActual;
      const overrunRate = qBudget > 0 ? (qActual / qBudget) * 100 : 0;
      
      let status = '정상';
      if (qBudget === 0 && qActual > 0) status = '무예산 집행';
      else if (qActual > qBudget) status = '초과';

      if (overrunFilter === '초과 항목만' && status === '정상') return;

      const accountName = budgetRow?.name || budgetRow?.accountName || actualRow?.accountName || accountCode;

      overrunData.push({ 
        deptCode,
        accountCode,
        accountName,
        qBudget, 
        qActual, 
        overrunAmount, 
        balance, 
        overrunRate, 
        yBudget,
        yActual,
        status 
      });
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
        return b.overrunRate - a.overrunRate;
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
        '분기예산': r.qBudget,
        '분기실적': r.qActual,
        '초과금액': r.overrunAmount,
        '잔액': r.balance,
        '초과율(%)': r.overrunRate ? r.overrunRate.toFixed(2) + '%' : '예산 없음',
        '연도예산': r.yBudget,
        '연도실적': r.yActual,
        '상태': r.status
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '예산초과점검');
      
      const deptName = selectedDeptCode === '전체' ? '전체부서' : (depts.find(d => d.code === selectedDeptCode)?.name || selectedDeptCode);
      XLSX.writeFile(wb, `예산초과점검_${year}_${planType}_${quarter}_${deptName}.xlsx`);
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
        <FilterItem label="분기">
          <AppSelect value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            <option value="1Q">1Q</option>
            <option value="2Q">2Q</option>
            <option value="3Q">3Q</option>
            <option value="4Q">4Q</option>
            <option value="전체">전체</option>
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
                   <AppTableHead>부서코드</AppTableHead>
                   <AppTableHead>부서</AppTableHead>
                   <AppTableHead>계정과목코드</AppTableHead>
                   <AppTableHead>계정과목</AppTableHead>
                   <AppTableHead className="text-right">분기예산</AppTableHead>
                   <AppTableHead className="text-right">분기실적</AppTableHead>
                   <AppTableHead className="text-right">초과금액</AppTableHead>
                   <AppTableHead className="text-right">잔액</AppTableHead>
                   <AppTableHead className="text-right">초과율</AppTableHead>
                   <AppTableHead className="text-right">연도예산</AppTableHead>
                   <AppTableHead className="text-right">연도실적</AppTableHead>
                   <AppTableHead className="text-center">상태</AppTableHead>
                 </tr>
               </AppTableHeader>
               <AppTableBody>
                 {results.map((r, i) => (
                   <AppTableRow key={i}>
                     <AppTableCell className="text-lithium-600">{r.deptCode}</AppTableCell>
                     <AppTableCell>{depts.find(d => d.code === r.deptCode)?.name}</AppTableCell>
                     <AppTableCell className="text-lithium-500">{r.accountCode}</AppTableCell>
                     <AppTableCell>{r.accountName}</AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qBudget} /></AppTableCell>
                     <AppTableCell className="text-right"><BudgetAmount value={r.qActual} /></AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetAmount value={r.overrunAmount} tone={r.overrunAmount > 0 ? "warning" : "default"} />
                     </AppTableCell>
                     <AppTableCell className="text-right text-lithium-600"><BudgetAmount value={r.balance} /></AppTableCell>
                     <AppTableCell className="text-right">
                       <BudgetRate value={r.overrunRate} />
                     </AppTableCell>
                     <AppTableCell className="text-right text-lithium-500"><BudgetAmount value={r.yBudget} /></AppTableCell>
                     <AppTableCell className="text-right text-lithium-500"><BudgetAmount value={r.yActual} /></AppTableCell>
                     <AppTableCell className="text-center">
                       <OverrunBadge status={r.status} />
                     </AppTableCell>
                   </AppTableRow>
                 ))}
               </AppTableBody>
            </AppTable>
          </AppCard>
        </>
      )}
    </div>
  );
}
