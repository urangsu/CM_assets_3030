import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Search, Lock, Unlock, CheckCircle2, XCircle } from 'lucide-react';
import { getAllDepartments, STORAGE_KEYS } from '../constants';
import { getSubmissionStatusMapKey, normalizeSubmissionStatus, BudgetStatus, appendBudgetLockAuditLog, setSubmissionStatus } from '../lib/storageKeys';
import { useNavigate } from 'react-router-dom';

type LockActionType = 'UNLOCK' | 'REJECT' | 'APPROVE' | 'DRAFT';

export default function BudgetLockManagement() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [data, setData] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  const [actionModal, setActionModal] = useState<{
    open: boolean;
    action: LockActionType | null;
    deptCode: string;
    deptName: string;
    currentStatus: BudgetStatus;
    targetStatus: BudgetStatus;
    title: string;
    description: string;
    reason: string;
  }>({
    open: false,
    action: null,
    deptCode: '',
    deptName: '',
    currentStatus: 'DRAFT',
    targetStatus: 'DRAFT',
    title: '',
    description: '',
    reason: '',
  });

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
  }, [year, planType, currentUser?.code]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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

  const getStatusLabel = (status: BudgetStatus) => {
    switch (status) {
      case 'DRAFT': return '작성중';
      case 'SUBMITTED': return '상신완료';
      case 'REVIEWING': return '검토중';
      case 'APPROVED': return '승인완료';
      case 'REJECTED': return '반려';
      case 'LOCKED': return '잠금';
      default: return status;
    }
  };

  const openActionModal = (params: {
    action: LockActionType;
    deptCode: string;
    deptName: string;
    currentStatus: BudgetStatus;
    targetStatus: BudgetStatus;
  }) => {
    const actionLabels = {
      UNLOCK: '잠금 해제',
      REJECT: '반려 처리',
      APPROVE: '승인 처리',
      DRAFT: '작성중 전환',
    };

    setActionModal({
      open: true,
      ...params,
      title: `${params.deptName} ${actionLabels[params.action]}`,
      description:
        `${params.deptCode} ${params.deptName}의 ${year}년 ${planType} 상태를 ` +
        `[${getStatusLabel(params.currentStatus)}]에서 [${getStatusLabel(params.targetStatus)}] 상태로 변경합니다.`,
      reason: '',
    });
  };

  const confirmStatusChange = () => {
    if (!actionModal.open || !actionModal.action) return;

    const requiresReason = ['UNLOCK', 'REJECT', 'DRAFT'].includes(actionModal.action);

    if (requiresReason && !actionModal.reason.trim()) {
      setToastMessage('처리 사유를 입력해주세요.');
      return;
    }

    const beforeStatus = actionModal.currentStatus;
    const afterStatus = actionModal.targetStatus;
    const finalReason = actionModal.reason.trim() || `관리자 ${actionModal.title}`;

    setSubmissionStatus(actionModal.deptCode, year, planType, {
      status: afterStatus,
      time: new Date().toLocaleString(),
      user: currentUser?.name || currentUser?.code,
      deptName: actionModal.deptName,
      reason: finalReason,
    });

    appendBudgetLockAuditLog({
      action:
        actionModal.action === 'UNLOCK' || actionModal.action === 'DRAFT'
          ? 'UNLOCK'
          : actionModal.action === 'REJECT'
            ? 'REJECT'
            : 'APPROVE',
      deptCode: actionModal.deptCode,
      deptName: actionModal.deptName,
      year,
      planType,
      beforeStatus,
      afterStatus,
      userCode: currentUser?.code,
      userName: currentUser?.name,
      reason: actionModal.reason.trim(),
    });

    setData(prev => prev.map(row => {
      if (row.deptCode !== actionModal.deptCode) return row;
      return {
        ...row,
        status: afterStatus,
        time: new Date().toLocaleString(),
        user: currentUser?.name || currentUser?.code,
        reason: finalReason,
      };
    }));

    setActionModal(prev => ({ ...prev, open: false }));
    setTimeout(loadData, 0);

    setToastMessage(
      `${actionModal.deptName} ${year}년 ${planType} 상태가 ${getStatusLabel(afterStatus)}(으)로 변경되었습니다.`
    );
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

      {toastMessage && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">조회 연도</label>
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32 outline-none appearance-none"
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
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32 outline-none appearance-none"
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
            className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 w-32 outline-none appearance-none"
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
              className="w-full h-[42px] pl-10 pr-4 bg-[#f2f4f6] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
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
                  <tr key={`${row.deptCode}_${row.year}_${row.planType}`} className="hover:bg-[#f9fafb]">
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
                            onClick={() => openActionModal({
                              action: 'UNLOCK',
                              deptCode: row.deptCode,
                              deptName: row.deptName,
                              currentStatus: row.status,
                              targetStatus: 'DRAFT',
                            })}
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                            title="잠금 해제 (작성중으로 되돌리기)"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                        {['SUBMITTED', 'REVIEWING'].includes(row.status) && (
                          <>
                            <button
                               onClick={() => openActionModal({
                                action: 'APPROVE',
                                deptCode: row.deptCode,
                                deptName: row.deptName,
                                currentStatus: row.status,
                                targetStatus: 'APPROVED',
                               })}
                               className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                               title="승인 처리"
                            >
                               <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                               onClick={() => openActionModal({
                                action: 'REJECT',
                                deptCode: row.deptCode,
                                deptName: row.deptName,
                                currentStatus: row.status,
                                targetStatus: 'REJECTED',
                               })}
                               className="p-1.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                               title="반려 처리"
                            >
                               <XCircle className="w-4 h-4" />
                            </button>
                          </>
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

      {actionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-gray-900">{actionModal.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {actionModal.description}
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">부서</span>
                <strong>{actionModal.deptCode} {actionModal.deptName}</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">현재 상태</span>
                <strong>{getStatusLabel(actionModal.currentStatus)}</strong>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">변경 상태</span>
                <strong>{getStatusLabel(actionModal.targetStatus)}</strong>
              </div>
            </div>

            <label className="block mt-4 text-xs font-bold text-gray-500">
              처리 사유 {['UNLOCK', 'REJECT', 'DRAFT'].includes(actionModal.action || '') && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={actionModal.reason}
              onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="예: 실적 업로드 반영을 위한 관리자 잠금 해제"
              className="mt-1 w-full min-h-[96px] rounded-xl border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActionModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmStatusChange}
                className="px-4 py-2 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900 transition-colors"
              >
                변경 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
