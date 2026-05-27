import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Search, Lock, Unlock, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { getAllDepartments, STORAGE_KEYS } from '../constants';
import { getSubmissionStatusMapKey, normalizeSubmissionStatus, BudgetStatus, unlockBudget, appendBudgetLockAuditLog, setSubmissionStatus } from '../lib/storageKeys';
import { useNavigate } from 'react-router-dom';

export default function BudgetLockManagement() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [year, planType]);

  const loadData = () => {
    const rawData = localStorage.getItem(STORAGE_KEYS.SUBMISSION_STATUS);
    const statuses = rawData ? JSON.parse(rawData) : {};
    
    const allDepts = getAllDepartments();
    const rows = allDepts.map(dept => {
      const key = getSubmissionStatusMapKey(dept.code, year, planType);
      const statusData = statuses[key] ? normalizeSubmissionStatus(statuses[key]) : { status: 'DRAFT' };
      
      return {
        deptCode: dept.code,
        deptName: dept.name,
        year,
        planType,
        ...statusData
      };
    });
    
    setData(rows);
  };

  const handleUnlock = (deptCode: string, deptName: string, currentStatus: string) => {
    const reason = window.prompt(`${deptCode} ${deptName}의 예산 잠금을 해제하시겠습니까?\n사유를 입력해주세요.`);
    if (reason !== null) {
      if (!reason.trim()) {
        window.alert('잠금 해제 사유를 입력해야 합니다.');
        return;
      }
      
      unlockBudget(deptCode, year, planType, currentUser?.name, reason);
      
      appendBudgetLockAuditLog({
        action: 'UNLOCK',
        deptCode,
        deptName,
        year,
        planType,
        beforeStatus: currentStatus,
        afterStatus: 'DRAFT',
        userCode: currentUser?.code,
        userName: currentUser?.name,
        reason
      });
      
      loadData();
    }
  };

  const handleAction = (deptCode: string, deptName: string, currentStatus: string, targetStatus: string, actionName: string) => {
    if (window.confirm(`${deptCode} ${deptName}의 상태를 [${actionName}] 하시겠습니까?`)) {
      setSubmissionStatus(deptCode, year, planType, {
        status: targetStatus as BudgetStatus,
        time: new Date().toLocaleString(),
        user: currentUser?.name,
        reason: `관리자 임의 변경 (${actionName})`,
      });
      
      appendBudgetLockAuditLog({
        action: actionName.includes('반려') ? 'REJECT' : (actionName.includes('승인') ? 'APPROVE' : 'UNLOCK'),
        deptCode,
        deptName,
        year,
        planType,
        beforeStatus: currentStatus,
        afterStatus: targetStatus,
        userCode: currentUser?.code,
        userName: currentUser?.name,
        reason: `관리자 임의 변경 (${actionName})`
      });
      
      loadData();
    }
  };

  const filteredData = data.filter(row => {
    const statusMatch = statusFilter === 'all' || row.status === statusFilter;
    const searchMatch = !searchTerm || row.deptCode.includes(searchTerm) || row.deptName.includes(searchTerm);
    return statusMatch && searchMatch;
  });

  const getStatusBadge = (status: BudgetStatus) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold">작성중</span>;
      case 'SUBMITTED': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">상신완료</span>;
      case 'REVIEWING': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-bold">검토중</span>;
      case 'APPROVED': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">승인완료</span>;
      case 'REJECTED': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">반려</span>;
      case 'LOCKED': return <span className="px-2 py-1 bg-zinc-800 text-white rounded-md text-xs font-bold font-semibold"><Lock className="w-3 h-3 inline mr-1"/>잠금</span>;
      default: return null;
    }
  };

  const isAdmin = currentUser?.code === '99999' || currentUser?.code === '32100';

  if (!isAdmin) {
    return (
      <div className="p-8">
        <PageHeader title="예산 잠금 관리" description="부서별 예산 제출 상태와 잠금을 관리합니다." />
        <div className="bg-white p-8 rounded-2xl border border-[#e5e8eb] shadow-sm text-center">
          <Lock className="w-12 h-12 text-[#8b95a1] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[#191f28] mb-2">접근 권한이 없습니다</h3>
          <p className="text-[#4e5968] text-sm">예산 잠금 관리는 기획재무그룹 또는 시스템 관리자만 접근 가능합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="예산 잠금 관리" 
        description="부서별 예산 제출 상태를 조회하고, 잠금 해제 등 관리자 조치를 수행합니다." 
      />

      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">조회 연도</label>
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32"
          >
            <option value="2024">2024년</option>
            <option value="2025">2025년</option>
            <option value="2026">2026년</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">계획 구분</label>
          <select 
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32"
          >
            <option value="경영계획">경영계획</option>
            <option value="수정경영계획">수정경영계획</option>
            <option value="1차 RP">1차 RP</option>
            <option value="2차 RP">2차 RP</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">상태</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32"
          >
            <option value="all">전체</option>
            <option value="DRAFT">작성중</option>
            <option value="SUBMITTED">상신완료</option>
            <option value="REVIEWING">검토중</option>
            <option value="APPROVED">승인완료</option>
            <option value="REJECTED">반려</option>
            <option value="LOCKED">잠금</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">부서 검색</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#8b95a1]" />
            </div>
            <input
              type="text"
              placeholder="부서코드, 부서명 입력"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-[42px] pl-10 pr-4 bg-[#f2f4f6] border-none rounded-xl text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e8eb] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-[#f9fafb] border-b border-[#e5e8eb]">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">부서코드</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">부서명</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">연도</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">계획구분</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">최근 처리일시</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">최근 처리자</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">메모사항</th>
                <th className="px-4 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {filteredData.length > 0 ? (
                filteredData.map(row => (
                  <tr key={`${row.deptCode}_${row.year}`} className="hover:bg-[#f9fafb]">
                    <td className="px-4 py-3 text-xs font-mono text-[#8b95a1]">{row.deptCode}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#191f28]">{row.deptName}</td>
                    <td className="px-4 py-3 text-xs text-[#4e5968]">{row.year}</td>
                    <td className="px-4 py-3 text-xs text-[#4e5968]">{row.planType}</td>
                    <td className="px-4 py-3">{getStatusBadge(row.status)}</td>
                    <td className="px-4 py-3 text-xs text-[#4e5968]">{row.time || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#4e5968]">{row.user || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#8b95a1] max-w-[200px] truncate" title={row.reason}>{row.reason || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {['APPROVED', 'LOCKED', 'SUBMITTED', 'REVIEWING'].includes(row.status) && (
                          <button 
                            onClick={() => handleUnlock(row.deptCode, row.deptName, row.status)}
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                            title="잠금 해제 (작성중으로 되돌리기)"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                        {['SUBMITTED', 'REVIEWING'].includes(row.status) && (
                          <>
                            <button
                               onClick={() => handleAction(row.deptCode, row.deptName, row.status, 'APPROVED', '승인 처리')}
                               className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                               title="승인 처리"
                            >
                               <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                               onClick={() => handleAction(row.deptCode, row.deptName, row.status, 'REJECTED', '반려 처리')}
                               className="p-1.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                               title="반려 처리"
                            >
                               <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {['DRAFT', 'REJECTED'].includes(row.status) && (
                          <button
                             onClick={() => handleAction(row.deptCode, row.deptName, row.status, 'APPROVED', '강제 승인 처리')}
                             className="text-xs px-2 py-1 bg-zinc-100 text-zinc-600 rounded hover:bg-zinc-200 transition-colors border border-zinc-200"
                             title="강제로 승인 상태로 변경"
                          >
                             강제 승인
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#8b95a1] text-sm">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
