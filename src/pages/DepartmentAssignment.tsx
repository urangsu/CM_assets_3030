import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, RotateCcw, Save, Trash2, ArrowRight, Check, AlertCircle, Edit, List, RefreshCw } from 'lucide-react';
import { DEPARTMENTS, getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { usePermission } from '../lib/permissions';

interface DepartmentAssignmentOverride {
  id: string; // `${year}_${planType}_${sourceDeptCode}_${accountCode}_${originalAssignedDeptCode}`
  year: string;
  planType: string;

  sourceDeptCode: string;
  sourceDeptName: string;

  originalAssignedDeptCode: string;
  originalAssignedDeptName: string;

  newAssignedDeptCode: string;
  newAssignedDeptName: string;

  accountCode: string;
  accountName: string;

  reason: string;
  changedBy: string;
  changedAt: string;
}

export default function DepartmentAssignment() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, viewableDepts, viewableDeptCodes } = usePermission();

  // Filters state
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [selectedWriterDept, setSelectedWriterDept] = useState('all');
  const [selectedAttributedDept, setSelectedAttributedDept] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchAccount, setSearchAccount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded data state
  const [rawBudgetRows, setRawBudgetRows] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<DepartmentAssignmentOverride[]>([]);
  
  // Selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // Modal / Editing state
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'single' | 'batch'>('single');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [targetDeptCode, setTargetDeptCode] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load departments
  const allDepts = useMemo(() => getAllDepartments(), []);
  const writeableDepts = useMemo(() => {
    // Return viewable depts for this user
    return viewableDepts.length > 0 ? viewableDepts : allDepts.filter(d => d.code !== '99999');
  }, [viewableDepts, allDepts]);

  // Load original budget rows and overrides from local storage
  const loadData = () => {
    // 1. Load Overrides
    let savedOverrides: DepartmentAssignmentOverride[] = [];
    try {
      const stored = localStorage.getItem('hycm_department_assignment_overrides');
      if (stored) {
        savedOverrides = JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    setOverrides(savedOverrides);

    // 2. Load Budget Rows from all viewable/existing departments
    let rows: any[] = [];
    const deptsToLoad = allDepts.map(d => d.code);
    
    deptsToLoad.forEach(dc => {
      const key = getBudgetDataKey(dc, year, planType);
      const savedData = localStorage.getItem(key);
      if (savedData) {
        try {
          const loadedRows = JSON.parse(savedData);
          loadedRows.forEach((r: any) => {
            rows.push({
              ...r,
              // Keep original writer department code tracked
              writerDeptCode: r.writerDeptCode || dc,
              writerDeptName: r.writerDeptName || (allDepts.find(d => d.code === dc)?.name || dc),
              originalAttributedDeptCode: r.attributedDeptCode || dc,
              originalAttributedDeptName: r.attributedDeptName || (allDepts.find(d => d.code === dc)?.name || dc),
            });
          });
        } catch (e) {
          // ignore parsing errors
        }
      }
    });

    setRawBudgetRows(rows);
    setSelectedRowKeys(new Set());
  };

  useEffect(() => {
    loadData();
  }, [year, planType, allDepts]);

  // Combine rows with overrides for display
  const processedRows = useMemo(() => {
    const overrideMap = new Map<string, DepartmentAssignmentOverride>();
    overrides.forEach(ov => {
      if (ov.year === year && ov.planType === planType) {
        const key = `${ov.sourceDeptCode}_${ov.accountCode}_${ov.originalAssignedDeptCode}`;
        overrideMap.set(key, ov);
      }
    });

    return rawBudgetRows.map((r, index) => {
      const key = `${r.writerDeptCode}_${r.code}_${r.originalAttributedDeptCode}`;
      const ov = overrideMap.get(key);

      const annualTotal = Array.isArray(r.values) 
        ? r.values.reduce((sum: number, v: any) => sum + (Number(v) || 0), 0)
        : (Number(r.annualAmount) || 0);

      if (ov) {
        return {
          ...r,
          uniqueKey: `row_${index}`,
          currentAttributedDeptCode: ov.newAssignedDeptCode,
          currentAttributedDeptName: ov.newAssignedDeptName,
          status: 'CHANGED',
          changeReason: ov.reason,
          annualAmount: annualTotal,
          overrideId: ov.id
        };
      }

      return {
        ...r,
        uniqueKey: `row_${index}`,
        currentAttributedDeptCode: r.originalAttributedDeptCode,
        currentAttributedDeptName: r.originalAttributedDeptName,
        status: 'ORIGINAL',
        changeReason: '',
        annualAmount: annualTotal,
        overrideId: null
      };
    });
  }, [rawBudgetRows, overrides, year, planType]);

  // Apply listing filters
  const filteredRows = useMemo(() => {
    return processedRows.filter(r => {
      // 1. Writer dept filter
      if (selectedWriterDept !== 'all' && r.writerDeptCode !== selectedWriterDept) return false;

      // 2. Attributed dept filter
      if (selectedAttributedDept !== 'all' && r.currentAttributedDeptCode !== selectedAttributedDept) return false;

      // 3. Category (e.g. 제조 vs 판관)
      if (selectedCategory !== 'all') {
        const isMfg = (r.managementCategory === '제조' || r.budgetType === 'INVESTMENT' || r.code?.startsWith('5') || r.code?.startsWith('6'));
        if (selectedCategory === '제조' && !isMfg) return false;
        if (selectedCategory === '판관' && isMfg) return false;
      }

      // 4. Account Code search
      if (searchAccount && !r.code.includes(searchAccount)) return false;

      // 5. Query Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const accountMatch = r.name?.toLowerCase().includes(query);
        const detailMatch = r.detail?.toLowerCase().includes(query);
        const codeMatch = r.code.includes(query);
        if (!accountMatch && !detailMatch && !codeMatch) return false;
      }

      return true;
    });
  }, [processedRows, selectedWriterDept, selectedAttributedDept, selectedCategory, searchAccount, searchQuery]);

  // Handle row selection
  const toggleRowSelection = (key: string) => {
    setSelectedRowKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRowKeys.size === filteredRows.length) {
      setSelectedRowKeys(new Set());
    } else {
      setSelectedRowKeys(new Set(filteredRows.map(r => r.uniqueKey)));
    }
  };

  // Open single change modal
  const openSingleChange = (row: any) => {
    setModalType('single');
    setEditingRow(row);
    setTargetDeptCode(row.currentAttributedDeptCode);
    setChangeReason(row.changeReason || '');
    setIsChangeModalOpen(true);
  };

  // Open batch change modal
  const openBatchChange = () => {
    if (selectedRowKeys.size === 0) {
      alert('변경할 항목을 최소 한 건 이상 선택하세요.');
      return;
    }
    setModalType('batch');
    setEditingRow(null);
    setTargetDeptCode('');
    setChangeReason('');
    setIsChangeModalOpen(true);
  };

  // Save override values
  const handleSaveOverride = () => {
    if (!targetDeptCode) {
      alert('귀속할 새로운 부서를 선택해 주세요.');
      return;
    }

    const matchedTargetDeptName = allDepts.find(d => d.code === targetDeptCode)?.name || targetDeptCode;
    const operatorName = currentUser?.name || '기획재무담당';

    let updatedOverrides = [...overrides];

    if (modalType === 'single' && editingRow) {
      const key = `${year}_${planType}_${editingRow.writerDeptCode}_${editingRow.code}_${editingRow.originalAttributedDeptCode}`;
      
      // Remove existing for this combination
      updatedOverrides = updatedOverrides.filter(ov => ov.id !== key);

      // If changed back to original, we just delete the override
      if (targetDeptCode !== editingRow.originalAttributedDeptCode) {
        const newOverride: DepartmentAssignmentOverride = {
          id: key,
          year,
          planType,
          sourceDeptCode: editingRow.writerDeptCode,
          sourceDeptName: editingRow.writerDeptName,
          originalAssignedDeptCode: editingRow.originalAttributedDeptCode,
          originalAssignedDeptName: editingRow.originalAttributedDeptName,
          newAssignedDeptCode: targetDeptCode,
          newAssignedDeptName: matchedTargetDeptName,
          accountCode: editingRow.code,
          accountName: editingRow.name || '',
          reason: changeReason || '단건 부서 귀속 조정',
          changedBy: operatorName,
          changedAt: new Date().toLocaleString()
        };
        updatedOverrides.push(newOverride);
      }
    } else if (modalType === 'batch') {
      // For batch changes, construct overrides for each selected row
      const selectedItems = filteredRows.filter(r => selectedRowKeys.has(r.uniqueKey));
      
      selectedItems.forEach(item => {
        const key = `${year}_${planType}_${item.writerDeptCode}_${item.code}_${item.originalAttributedDeptCode}`;
        
        // Remove existing
        updatedOverrides = updatedOverrides.filter(ov => ov.id !== key);

        if (targetDeptCode !== item.originalAttributedDeptCode) {
          const newOverride: DepartmentAssignmentOverride = {
            id: key,
            year,
            planType,
            sourceDeptCode: item.writerDeptCode,
            sourceDeptName: item.writerDeptName,
            originalAssignedDeptCode: item.originalAttributedDeptCode,
            originalAssignedDeptName: item.originalAttributedDeptName,
            newAssignedDeptCode: targetDeptCode,
            newAssignedDeptName: matchedTargetDeptName,
            accountCode: item.code,
            accountName: item.name || '',
            reason: changeReason || '일괄 부서 귀속 조정',
            changedBy: operatorName,
            changedAt: new Date().toLocaleString()
          };
          updatedOverrides.push(newOverride);
        }
      });
    }

    localStorage.setItem('hycm_department_assignment_overrides', JSON.stringify(updatedOverrides));
    setOverrides(updatedOverrides);
    setIsChangeModalOpen(false);
    setSelectedRowKeys(new Set());
    
    // Trigger feedback message
    setFeedbackMsg({
      type: 'success',
      text: '부서 귀속 변경 정보가 override 테이블에 성공적으로 안전하게 저장되었습니다.'
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Cancel / Reset override
  const handleCancelOverride = (row: any) => {
    if (!row.overrideId) return;

    if (window.confirm('선택하신 조정건의 귀속 설정을 취소하고 원본 부서로 복구하시겠습니까?')) {
      const updated = overrides.filter(ov => ov.id !== row.overrideId);
      localStorage.setItem('hycm_department_assignment_overrides', JSON.stringify(updated));
      setOverrides(updated);
      
      setFeedbackMsg({
        type: 'success',
        text: '귀속 조정이 취소되고 원본 정보로 정상 복구되었습니다.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  // Quick reset all filters
  const resetFilters = () => {
    setSelectedWriterDept('all');
    setSelectedAttributedDept('all');
    setSelectedCategory('all');
    setSearchAccount('');
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col gap-5 p-1">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#008f83] rounded-full"></span>
            <h1 className="text-xl font-bold tracking-tight text-eco-black">부서 귀속 변경 (Department Assignment)</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            작성부서와 귀속부서가 다른 예산 항목의 귀속 관계를 안전하게 재할당하고 보정하는 Control Panel 운영 페이지입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white border border-zinc-200 rounded focus:border-[#008f83] outline-none"
          >
            <option value="2025">2025년</option>
            <option value="2026">2026년</option>
            <option value="2027">2027년</option>
          </select>
          <select 
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white border border-zinc-200 rounded focus:border-[#008f83] outline-none"
          >
            <option value="경영계획">경영계획</option>
            <option value="수정예산">수정예산</option>
          </select>
          <button 
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded transition border border-zinc-200 font-medium"
          >
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>
      </div>

      {/* 2026 Navigation Flow Assist Card */}
      <div className="bg-[#f2faf7] border border-[#ddeae5] p-4.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 shadow-xs">
        <div>
          <span className="text-xs bg-[#008f83] text-white px-2 py-0.5 rounded font-bold font-mono font-sans shadow-xs">FLOW CONSOLE</span>
          <h4 className="text-sm font-bold text-zinc-900 mt-1.5 font-sans">📂 실적 부서 귀속 관계 조정 제어판</h4>
          <p className="text-xs text-zinc-500 mt-0.5 font-sans">수정된 계정 및 부서 귀속 관계를 점검하시고, 다음 단계인 [예산 작성]으로 즉시 이동하여 예산을 기재하십시오.</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => navigate('/account-selection')}
            className="flex-1 sm:flex-none px-4 py-2 border border-zinc-250 hover:border-zinc-350 text-zinc-700 bg-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs font-sans"
          >
            &larr; 계정 선택 (전 단계)
          </button>
          <button
            onClick={() => navigate('/budget-creation')}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#008f83] hover:bg-[#00746b] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm font-sans"
          >
            예산 작성하기 &rarr;
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-3 text-xs rounded border flex items-center gap-2 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
          <Filter className="w-3.5 h-3.5 text-[#008f83]" />
          조회 조건
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">작성 부서</label>
            <select
              value={selectedWriterDept}
              onChange={(e) => setSelectedWriterDept(e.target.value)}
              className="w-full px-2 py-1.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded focus:bg-white focus:border-[#008f83] outline-none"
            >
              <option value="all">전체 작성부서</option>
              {allDepts.map(d => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">귀속 부서 (현재 상태 기준)</label>
            <select
              value={selectedAttributedDept}
              onChange={(e) => setSelectedAttributedDept(e.target.value)}
              className="w-full px-2 py-1.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded focus:bg-white focus:border-[#008f83] outline-none"
            >
              <option value="all">전체 귀속부서</option>
              {allDepts.map(d => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">계정 구분</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded focus:bg-white focus:border-[#008f83] outline-none"
            >
              <option value="all">전체 계정구분</option>
              <option value="제조">제조 경비</option>
              <option value="판관">일반 관리비 (판관)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">계정 코드 직접 검색</label>
            <input
              type="text"
              placeholder="예: 501100..."
              value={searchAccount}
              onChange={(e) => setSearchAccount(e.target.value)}
              className="w-full px-2 py-1.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded focus:bg-white focus:border-[#008f83] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">상세 내용 및 텍스트</label>
            <div className="relative">
              <input
                type="text"
                placeholder="검색어 입력..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded focus:bg-white focus:border-[#008f83] outline-none"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-zinc-100 pt-2.5 mt-1">
          <div className="text-xs text-zinc-500 font-medium">
            검색 결과: <strong className="text-[#008f83] font-bold">{filteredRows.length}</strong>건 / 전체 {processedRows.length}건
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 rounded transition font-medium"
            >
              <RotateCcw className="w-3 h-3" /> 필터 초기화
            </button>
            <button
              onClick={openBatchChange}
              disabled={selectedRowKeys.size === 0}
              className="flex items-center gap-1.5 px-3.5 py-1 text-xs bg-[#008f83] hover:bg-[#00786f] text-white rounded transition border border-[#008f83] disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              선택 ({selectedRowKeys.size}건) 일괄 귀속부서 변경
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-zinc-500" />
            <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-widest">부서 예산 귀속 조정 매트릭스</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
              <span>귀속 변경됨: {overrides.length}개</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-[11px] font-semibold">
                <th className="py-2.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedRowKeys.size === filteredRows.length}
                    onChange={toggleAllSelection}
                    className="rounded border-zinc-300 text-[#008f83] focus:ring-[#008f83]"
                  />
                </th>
                <th className="py-2.5 px-3">작성부서 (코드/명)</th>
                <th className="py-2.5 px-3 text-center w-6"></th>
                <th className="py-2.5 px-3">귀속부서 (현재 상태)</th>
                <th className="py-2.5 px-3">계정코드</th>
                <th className="py-2.5 px-3">계정명</th>
                <th className="py-2.5 px-3 text-right">체결 예산총액</th>
                <th className="py-2.5 px-3 text-center">수행 상태</th>
                <th className="py-2.5 px-4 text-center">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400 font-medium">
                    필터링 조건 또는 선택 연도에 부합하는 예산 등록 항목을 찾지 못했습니다.<br/>
                    <span className="text-[11px] block mt-1 text-zinc-400">우측 상단 연도를 교체하거나 부서 필터를 조정해 보세요.</span>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isRowSelected = selectedRowKeys.has(row.uniqueKey);
                  return (
                    <tr 
                      key={row.uniqueKey}
                      className={`hover:bg-zinc-50 transition ${row.status === 'CHANGED' ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleRowSelection(row.uniqueKey)}
                          className="rounded border-zinc-300 text-[#008f83] focus:ring-[#008f83]"
                        />
                      </td>
                      <td className="py-3 px-3 text-zinc-700 font-medium font-mono">
                        <span className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-[11px] mr-1.5">{row.writerDeptCode}</span>
                        {row.writerDeptName}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-center">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {row.status === 'CHANGED' ? (
                            <>
                              <span className="bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold">
                                {row.currentAttributedDeptCode}
                              </span>
                              <span className="text-amber-800 font-bold">{row.currentAttributedDeptName}</span>
                              <span className="text-[10px] text-zinc-400 line-through">({row.originalAttributedDeptCode}) {row.originalAttributedDeptName}</span>
                            </>
                          ) : (
                            <>
                              <span className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono">{row.originalAttributedDeptCode}</span>
                              <span className="text-zinc-600">{row.originalAttributedDeptName}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-600 font-bold">{row.code}</td>
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-semibold text-zinc-800">{row.name}</p>
                          {row.detail && <p className="text-[10px] text-zinc-400 truncate max-w-xs">{row.detail}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold font-mono text-zinc-850">
                        {row.annualAmount ? row.annualAmount.toLocaleString() : '0'} 원
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.status === 'CHANGED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            귀속 변경됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                            기본 원본
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openSingleChange(row)}
                            className="p-1 text-zinc-500 hover:text-[#008f83] hover:bg-zinc-100 rounded transition"
                            title="귀속 변경"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {row.status === 'CHANGED' && (
                            <button
                              onClick={() => handleCancelOverride(row)}
                              className="p-1 text-[#d92d20] hover:bg-rose-50 rounded transition"
                              title="조정 취소"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override List Audit Trail */}
      {overrides.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden p-4">
          <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
            실시간 부서 귀속 변경 Override 이력 (Audit Trail {overrides.length}건)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600 border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-semibold">
                  <th className="py-2 px-3">계정항목</th>
                  <th className="py-2 px-3">조정 전 부서</th>
                  <th className="py-2 px-3 text-center w-6"></th>
                  <th className="py-2 px-3">조정 후 귀속부서</th>
                  <th className="py-2 px-3 text-center">사유 / 변경자</th>
                  <th className="py-2 px-3 text-right">일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {overrides.map(ov => (
                  <tr key={ov.id} className="hover:bg-zinc-50/50">
                    <td className="py-2 px-3">
                      <span className="font-mono text-[11px] font-bold text-zinc-700">[{ov.accountCode}]</span> {ov.accountName}
                    </td>
                    <td className="py-2 px-3">{ov.originalAssignedDeptName || ov.sourceDeptName}</td>
                    <td className="py-2 px-3 text-center text-zinc-400">→</td>
                    <td className="py-2 px-3 text-eco-black font-extrabold">{ov.newAssignedDeptName}</td>
                    <td className="py-2 px-3 text-zinc-500">
                      <p className="text-zinc-800 font-medium">{ov.reason}</p>
                      <p className="text-[10px] text-zinc-400">변경: {ov.changedBy}</p>
                    </td>
                    <td className="py-2 px-3 text-right text-[10px] text-zinc-400 font-mono">
                      {ov.changedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Change Modal */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl overflow-hidden w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-eco-black">
                {modalType === 'single' ? '귀속부서 재지정 (조정)' : '일괄 귀속부서 재지정 (일괄 조정)'}
              </h3>
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 transition text-lg"
              >
                &times;
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4 text-xs text-zinc-700">
              {modalType === 'single' && editingRow && (
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200 flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-semibold">계정 과목</span>
                    <strong className="text-eco-black">[{editingRow.code}] {editingRow.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-semibold">체결 원본부서</span>
                    <span className="text-zinc-700">({editingRow.writerDeptCode}) {editingRow.writerDeptName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-semibold">체결 예산금액</span>
                    <span className="text-zinc-700 font-semibold font-mono">{editingRow.annualAmount?.toLocaleString()} 원</span>
                  </div>
                </div>
              )}

              {modalType === 'batch' && (
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  선택하신 <strong className="text-[#008f83] font-bold">{selectedRowKeys.size}건</strong>의 예산 항목을 지정 부서로 귀속 변경합니다.
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  새로운 배정/귀속부서 선택
                </label>
                <select
                  value={targetDeptCode}
                  onChange={(e) => setTargetDeptCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-zinc-700 bg-white border border-zinc-300 rounded focus:border-[#008f83] focus:ring-1 focus:ring-[#008f83] outline-none"
                >
                  <option value="">-- 귀속 부서를 고르세요 --</option>
                  {allDepts.map(d => (
                    <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  귀속 변경 사유 작성 (Audit log 저장용)
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  rows={3}
                  placeholder="예: 전략소싱그룹 내 마케팅섹션으로 편입, 또는 타부서 사용경비 귀속 정정 등 사유를 기록하세요."
                  className="w-full px-3 py-2 text-xs text-zinc-700 bg-white border border-zinc-300 rounded focus:border-[#008f83] focus:ring-1 focus:ring-[#008f83] outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsChangeModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-zinc-100 text-zinc-650 border border-zinc-200 rounded font-bold transition"
              >
                닫기
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-1.5 bg-[#008f83] hover:bg-[#00786f] text-white rounded font-bold border border-[#008f83] transition shadow-sm"
              >
                저장 및 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
