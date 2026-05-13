import React, { useState } from 'react';
import { AlertTriangle, Download, Search } from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { getBudgetRowsByDeptYearPlan, getActualRowsByYear, isSalaryAccountCode, parsePeriodMonth } from '../lib/budgetAggregation';
import { canViewSalaryAccounts, getViewableDeptCodes } from '../lib/permissions';

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
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-eco-black"><AlertTriangle className="text-cobalt-500"/> 예산 초과 점검</h1>
      
      <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm mb-6">
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">연도</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="2024">2024년</option>
              <option value="2025">2025년</option>
              <option value="2026">2026년</option>
              <option value="2027">2027년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">계획구분</label>
            <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차RP">1차RP</option>
              <option value="2차RP">2차RP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">분기</label>
            <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="1Q">1Q</option>
              <option value="2Q">2Q</option>
              <option value="3Q">3Q</option>
              <option value="4Q">4Q</option>
              <option value="전체">전체</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">부서</label>
            <select value={selectedDeptCode} onChange={(e) => setSelectedDeptCode(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="전체">전체 조회 부서</option>
              {depts.filter(d => viewableDeptCodes.includes(d.code)).map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">계정구분</label>
            <select value={accountCategory} onChange={(e) => setAccountCategory(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="전체">전체</option>
              <option value="제조">제조</option>
              <option value="판관">판관</option>
              <option value="인건비 제외">인건비 제외</option>
              {salaryAccess && <option value="인건비만 보기">인건비만 보기</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-text-secondary">초과 여부</label>
            <select value={overrunFilter} onChange={(e) => setOverrunFilter(e.target.value)} className="w-full p-2 border border-lithium-200 rounded-xl focus:ring-2 focus:ring-nickel-500 outline-none transition-all">
              <option value="초과 항목만">초과 항목만</option>
              <option value="전체 보기">전체 보기</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center text-sm text-text-secondary">
          <span>* 조회 권한이 있는 부서의 데이터만 표시됩니다.<br/>* 급여성 계정은 권한이 있는 사용자에게만 표시됩니다.</span>
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="flex items-center px-4 py-2 border border-lithium-200 rounded-xl bg-white hover:bg-lithium-50 transition-colors"><Download className="w-4 h-4 mr-2" /> 엑셀 다운로드</button>
            <button onClick={handleSearch} className="flex items-center bg-nickel-600 text-white px-6 py-2 rounded-xl hover:bg-nickel-700 shadow-sm transition-all"><Search className="w-4 h-4 mr-2" />조회</button>
          </div>
        </div>
      </div>

      {!searched && (
        <div className="p-20 text-center text-text-tertiary font-medium bg-white rounded-2xl border border-lithium-200 shadow-sm">조건을 선택한 후 조회 버튼을 눌러 주세요.</div>
      )}

      {searched && results.length === 0 && (
        <div className="p-20 text-center text-text-tertiary font-medium bg-white rounded-2xl border border-lithium-200 shadow-sm">선택한 조건에 해당하는 예산 초과 항목이 없습니다.</div>
      )}
      
      {searched && results.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
             <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm">
               <div className="text-sm text-text-secondary mb-1">초과 계정 수</div>
               <div className="text-2xl font-black text-cobalt-600">{results.filter(r => r.status === '초과').length}건</div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm">
               <div className="text-sm text-text-secondary mb-1">초과 금액 합계</div>
               <div className="text-2xl font-black text-cobalt-600">{results.reduce((sum, r) => sum + r.overrunAmount, 0).toLocaleString()}원</div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm">
               <div className="text-sm text-text-secondary mb-1">무예산 집행 건수</div>
               <div className="text-2xl font-black text-cobalt-500">{results.filter(r => r.status === '무예산 집행').length}건</div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm">
               <div className="text-sm text-text-secondary mb-1">조회 대상 부서 수</div>
               <div className="text-2xl font-black text-eco-black">{new Set(results.map(r => r.deptCode)).size}개 부서</div>
             </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-lithium-200 text-sm">
               <thead className="bg-lithium-50">
                 <tr>
                   <th className="px-4 py-4 text-left text-text-secondary font-bold">부서코드</th>
                   <th className="px-4 py-4 text-left text-text-secondary font-bold">부서</th>
                   <th className="px-4 py-4 text-left text-text-secondary font-bold">계정과목코드</th>
                   <th className="px-4 py-4 text-left text-text-secondary font-bold">계정과목</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">분기예산</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">분기실적</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">초과금액</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">잔액</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">초과율</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">연도예산</th>
                   <th className="px-4 py-4 text-right text-text-secondary font-bold">연도실적</th>
                   <th className="px-4 py-4 text-center text-text-secondary font-bold">상태</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-lithium-100">
                 {results.map((r, i) => (
                   <tr key={i} className="hover:bg-lithium-50/50 transition-colors">
                     <td className="px-4 py-3 text-text-secondary">{r.deptCode}</td>
                     <td className="px-4 py-3 font-medium text-eco-black">{depts.find(d => d.code === r.deptCode)?.name}</td>
                     <td className="px-4 py-3 text-text-tertiary">{r.accountCode}</td>
                     <td className="px-4 py-3 font-medium text-eco-black">{r.accountName}</td>
                     <td className="px-4 py-3 text-right font-medium">{r.qBudget.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right">{r.qActual.toLocaleString()}</td>
                     <td className={`px-4 py-3 text-right font-bold ${r.overrunAmount > 0 ? 'text-cobalt-600' : 'text-eco-black'}`}>{r.overrunAmount.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right text-text-secondary">{r.balance.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right text-text-tertiary">{r.overrunRate ? r.overrunRate.toFixed(1) + '%' : '예산 없음'}</td>
                     <td className="px-4 py-3 text-right text-text-tertiary">{r.yBudget.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right text-text-tertiary">{r.yActual.toLocaleString()}</td>
                     <td className="px-4 py-3 text-center">
                       <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                         r.status === '초과' ? 'bg-cobalt-100 text-cobalt-700' : 
                         r.status === '무예산 집행' ? 'bg-cobalt-50 text-cobalt-600' : 
                         'bg-nickel-50 text-nickel-700'
                       }`}>
                         {r.status}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
