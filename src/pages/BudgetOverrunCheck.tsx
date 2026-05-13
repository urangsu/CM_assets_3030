import React, { useState } from 'react';
import { AlertTriangle, Download, Search } from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { getBudgetRowsByDeptYearPlan, getActualRowsByYear, isSalaryAccount } from '../lib/budgetAggregation';
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

    const overrunData: any[] = [];
    const qMonths = quarter === '전체' ? MONTHS : QUARTERS[quarter];

    budgetRows.forEach(row => {
      // 1. Permission Check
      if (!viewableDeptCodes.includes(row.attributedDeptCode)) return;
      if (isSalaryAccount(row.accountName) && !salaryAccess) return;
      
      // Filter by category
      if (accountCategory === '제조' && !row.accountCode.startsWith('A')) return;
      if (accountCategory === '판관' && !row.accountCode.startsWith('B')) return;

      const qBudget = qMonths.reduce((sum, m) => sum + (row.values[m] || 0), 0);
      const qActual = actualRows
        .filter(a => a.usageCode === row.attributedDeptCode && a.accountCode === row.accountCode && qMonths.includes(Number(a.period) - 1))
        .reduce((sum, a) => sum + a.amount, 0);

      const overrunAmount = Math.max(qActual - qBudget, 0);
      const balance = qBudget - qActual;
      const overrunRate = qBudget > 0 ? (qActual / qBudget) * 100 : 0;
      
      let status = '정상';
      if (qBudget === 0 && qActual > 0) status = '무예산 집행';
      else if (qActual > qBudget) status = '초과';

      if (overrunFilter === '초과 항목만' && status === '정상') return;

      overrunData.push({ ...row, qBudget, qActual, overrunAmount, balance, overrunRate, status });
    });

    setResults(overrunData);
    setSearched(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">예산 초과 점검</h1>
      
      <div className="grid grid-cols-6 gap-4 mb-6">
        <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded">조회</button>
      </div>

      {searched && results.length === 0 && (
        <div className="p-10 text-center text-gray-500">선택한 조건에 해당하는 예산 초과 항목이 없습니다.</div>
      )}
      
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
             <thead>
               <tr>
                 <th>부서</th>
                 <th>계정과목</th>
                 <th>분기예산</th>
                 <th>분기실적</th>
                 <th>초과금액</th>
                 <th>상태</th>
               </tr>
             </thead>
             <tbody>
               {results.map((r, i) => (
                 <tr key={i}>
                   <td>{depts.find(d => d.code === r.attributedDeptCode)?.name}</td>
                   <td>{r.accountName}</td>
                   <td>{r.qBudget.toLocaleString()}</td>
                   <td>{r.qActual.toLocaleString()}</td>
                   <td>{r.overrunAmount.toLocaleString()}</td>
                   <td>{r.status}</td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
