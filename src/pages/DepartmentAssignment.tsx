import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Filter, 
  Search, 
  RotateCcw, 
  Save, 
  Trash2, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Edit, 
  List, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  History, 
  X, 
  HelpCircle, 
  AlertTriangle,
  ThumbsUp,
  Sliders
} from 'lucide-react';
import { getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey } from '../lib/storageKeys';
import { usePermission } from '../lib/permissions';
import { 
  recommendAttributionForRow, 
  AttributionRecommendation, 
  AttributionAuditLog, 
  AttributionCandidate 
} from '../lib/deptAttributionRecommender';

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

  // Active Screen Tab: 'budget' (예산 귀속 관리) or 'actual_recommend' (실적 귀속 추천)
  const [activeTab, setActiveTab] = useState<'budget' | 'actual_recommend'>('budget');

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
  const [actualRowsList, setActualRowsList] = useState<any[]>([]);

  // Selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // Modal / Editing state
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'single' | 'batch'>('single');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [targetDeptCode, setTargetDeptCode] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Hidden recommendation row IDs (추천 제외 일시 등록)
  const [excludedRowIds, setExcludedRowIds] = useState<Set<string | number>>(() => {
    try {
      const stored = localStorage.getItem('cleanmetal_excluded_attribution_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Recent attribution audit logs state
  const [auditLogs, setAuditLogs] = useState<AttributionAuditLog[]>([]);

  // Load departments
  const allDepts = useMemo(() => getAllDepartments(), []);

  // Budget Rows mapped by department for fast lookup in recommendation scorer
  const budgetRowsByDept = useMemo(() => {
    const map = new Map<string, any[]>();
    allDepts.forEach(d => {
      const bKey = getBudgetDataKey(d.code, year, planType);
      const savedData = localStorage.getItem(bKey);
      if (savedData) {
        try {
          map.set(d.code, JSON.parse(savedData));
        } catch (e) {
          console.error(`Failed to load budget rows for ${d.code}`, e);
        }
      }
    });
    return map;
  }, [allDepts, year, planType, overrides]);

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
              writerDeptCode: r.writerDeptCode || dc,
              writerDeptName: r.writerDeptName || (allDepts.find(d => d.code === dc)?.name || dc),
              originalAttributedDeptCode: r.attributedDeptCode || dc,
              originalAttributedDeptName: r.attributedDeptName || (allDepts.find(d => d.code === dc)?.name || dc),
            });
          });
        } catch (e) {
          console.error(e);
        }
      }
    });

    setRawBudgetRows(rows);
    setSelectedRowKeys(new Set());

    // 3. Load actual rows for the selected year
    const actKey = getActualDataKey(year);
    const savedActuals = localStorage.getItem(actKey);
    if (savedActuals) {
      try {
        setActualRowsList(JSON.parse(savedActuals));
      } catch (e) {
        console.error(e);
      }
    } else {
      setActualRowsList([]);
    }

    // 4. Load Audit History logs
    try {
      const storedLogs = localStorage.getItem('hycm_attribution_audit_log');
      if (storedLogs) {
        setAuditLogs(JSON.parse(storedLogs));
      } else {
        setAuditLogs([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, planType, allDepts]);

  // Read URL query parameters on load to trigger auto-filter and switch to recommendations
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qAccount = params.get('searchAccount');
    const qQuery = params.get('searchQuery');
    const qYear = params.get('year');
    if (qAccount) {
      setSearchAccount(qAccount);
      setActiveTab('actual_recommend');
    }
    if (qQuery) {
      setSearchQuery(qQuery);
      setActiveTab('actual_recommend');
    }
    if (qYear) {
      setYear(qYear);
    }
  }, []);

  // Save excluded recommendation row IDs to localStorage
  const saveExcludedRowIds = (nextSet: Set<string | number>) => {
    setExcludedRowIds(nextSet);
    localStorage.setItem('cleanmetal_excluded_attribution_ids', JSON.stringify(Array.from(nextSet)));
  };

  // Combine rows with overrides for display (Budget rows tab)
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

  // Apply listing filters for Budget Rows
  const filteredRows = useMemo(() => {
    return processedRows.filter(r => {
      if (selectedWriterDept !== 'all' && r.writerDeptCode !== selectedWriterDept) return false;
      if (selectedAttributedDept !== 'all' && r.currentAttributedDeptCode !== selectedAttributedDept) return false;

      if (selectedCategory !== 'all') {
        const isMfg = (r.managementCategory === '제조' || r.budgetType === 'INVESTMENT' || r.code?.startsWith('5') || r.code?.startsWith('6'));
        if (selectedCategory === '제조' && !isMfg) return false;
        if (selectedCategory === '판관' && isMfg) return false;
      }

      if (searchAccount && !r.code.includes(searchAccount)) return false;

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

  // Generate recommendations based on the core algorithm helper for all actual rows
  const attributionRecommendations = useMemo(() => {
    const list: AttributionRecommendation[] = [];
    actualRowsList.forEach((row: any) => {
      // 1. Skip if row ID is in the user excluded list
      if (excludedRowIds.has(row.id)) return;

      // 2. Calculate recommendation
      const rec = recommendAttributionForRow({
        row,
        year,
        planType,
        monthMode: 'YTD', // Default to YTD analysis
        selectedMonth: 12, // Aggregate analysis for whole year alignment
        departments: allDepts,
        budgetRowsByDept,
        actualRows: actualRowsList,
        previousOverrides: overrides as any[],
      });

      if (rec) {
        list.push(rec);
      }
    });

    // Sort by recommendation score descending (highest confidence first)
    return list.sort((a, b) => b.score - a.score);
  }, [actualRowsList, year, planType, allDepts, budgetRowsByDept, overrides, excludedRowIds]);

  // Filter actualRows on screen for display/control below the recommendation cards
  const filteredActualRows = useMemo(() => {
    return actualRowsList.filter(row => {
      const effectiveDept = row.attributedDeptCode || row.usageCode;
      if (selectedAttributedDept !== 'all' && effectiveDept !== selectedAttributedDept) return false;
      if (selectedWriterDept !== 'all' && row.usageCode !== selectedWriterDept) return false;

      if (searchAccount && !row.accountCode.includes(searchAccount)) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const acctNameMatch = row.accountName?.toLowerCase().includes(query);
        const codeMatch = row.accountCode?.includes(query);
        const remMatch = row.remarks?.toLowerCase().includes(query);
        if (!acctNameMatch && !codeMatch && !remMatch) return false;
      }

      return true;
    });
  }, [actualRowsList, selectedAttributedDept, selectedWriterDept, searchAccount, searchQuery]);

  // Handle single and bulk row selection on budget table
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

  // Open single change modal for Budget Rows
  const openSingleChange = (row: any) => {
    setModalType('single');
    setEditingRow(row);
    setTargetDeptCode(row.currentAttributedDeptCode);
    setChangeReason(row.changeReason || '');
    setIsChangeModalOpen(true);
  };

  // Open batch change modal for Budget Rows
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

  // Custom single recommendation apply action (for an actual row)
  const handleApplySingleAttribution = (rowId: string | number, recDeptCode: string) => {
    const matchedDept = allDepts.find(d => d.code === recDeptCode);
    const matchedDeptName = matchedDept ? matchedDept.name : recDeptCode;

    const rec = attributionRecommendations.find(r => r.rowId === rowId);

    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');

    const opName = currentUser?.name || '업무담당자';

    let foundTarget = false;
    const nextActuals = storedActuals.map((row: any) => {
      if (row.id === rowId) {
        foundTarget = true;
        
        // Write Audit history log
        const newLog: AttributionAuditLog = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          year,
          period: row.period || row.month || '12월',
          rowId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptCode: row.usageCode,
          originalDeptName: row.usageDept || row.usageCode,
          beforeAttributedDeptCode: row.attributedDeptCode,
          beforeAttributedDeptName: row.attributedDeptName,
          afterAttributedDeptCode: recDeptCode,
          afterAttributedDeptName: matchedDeptName,
          score: rec ? rec.score : 0,
          reasons: rec ? rec.reasons.map((rn: any) => rn.label) : ['수동 부서 지정'],
          action: 'APPLY',
          userCode: currentUser?.code,
          userName: opName,
          time: new Date().toLocaleString(),
        };

        const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
        localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([newLog, ...currentLogs]));

        return {
          ...row,
          attributedDeptCode: recDeptCode,
          attributedDeptName: matchedDeptName,
        };
      }
      return row;
    });

    if (foundTarget) {
      localStorage.setItem(actKey, JSON.stringify(nextActuals));
      setFeedbackMsg({
        type: 'success',
        text: `실적 전표에 귀속부서 [${matchedDeptName}]가 정합성 높게 주입되었습니다. 감사 이력에 실시간 반영되었습니다.`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
      loadData(); // reload
    }
  };

  // Bulk Apply all HIGH confidence recommendations for actual rows
  const handleBulkApplyHighConfidence = () => {
    const highRecs = attributionRecommendations.filter(r => r.confidence === 'HIGH');
    if (highRecs.length === 0) {
      alert('일괄 적용할 HIGH 신뢰도 추천 건이 현재 없습니다. 필터나 제외 항목을 점검하세요.');
      return;
    }

    if (!window.confirm(`안전 수렴: 신뢰도 "HIGH" 필터링된 총 ${highRecs.length}건을 일괄 적용하시겠습니까?\n이 작업은 실적전표 귀속부서 정보(attributedDeptCode/Name)를 한 번에 안전 배정합니다.`)) {
      return;
    }

    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    let updateCount = 0;

    const opName = currentUser?.name || '업무담당자';
    const auditLogsToSave: AttributionAuditLog[] = [];

    const nextActuals = storedActuals.map((row: any) => {
      const rec = highRecs.find(h => h.rowId === row.id);
      if (rec) {
        updateCount++;
        const newLog: AttributionAuditLog = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          year,
          period: row.period || row.month || '12월',
          rowId: row.id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptCode: row.usageCode,
          originalDeptName: row.usageDept || row.usageCode,
          beforeAttributedDeptCode: row.attributedDeptCode,
          beforeAttributedDeptName: row.attributedDeptName,
          afterAttributedDeptCode: rec.recommendedDeptCode,
          afterAttributedDeptName: rec.recommendedDeptName,
          score: rec.score,
          reasons: rec.reasons.map((rn: any) => rn.label),
          action: 'BULK_APPLY',
          userCode: currentUser?.code,
          userName: opName,
          time: new Date().toLocaleString(),
        };
        auditLogsToSave.push(newLog);

        return {
          ...row,
          attributedDeptCode: rec.recommendedDeptCode,
          attributedDeptName: rec.recommendedDeptName,
        };
      }
      return row;
    });

    localStorage.setItem(actKey, JSON.stringify(nextActuals));

    const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
    localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([...auditLogsToSave, ...currentLogs]));

    setFeedbackMsg({
      type: 'success',
      text: `${updateCount}건의 고인내(HIGH신뢰) 실적 귀속이 일괄 주입되고 이력 추적 테이블에 안전하게 반영되었습니다.`,
    });
    setTimeout(() => setFeedbackMsg(null), 3800);
    loadData(); // reload
  };

  // Dismiss / Temp Hide recommendation card (추천 제외 등록)
  const handleExcludeRecommendationCard = (rowId: string | number) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    nextSet.add(rowId);
    saveExcludedRowIds(nextSet);

    // Save logs audit trail
    const rec = attributionRecommendations.find(r => r.rowId === rowId);
    if (rec) {
      const auditLog: AttributionAuditLog = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        year,
        period: rec.period,
        rowId,
        accountCode: rec.accountCode,
        accountName: rec.accountName,
        originalDeptCode: rec.originalDeptCode,
        originalDeptName: rec.originalDeptName,
        beforeAttributedDeptCode: rec.currentAttributedDeptCode,
        afterAttributedDeptCode: 'IGNORED_EXCLUDED',
        afterAttributedDeptName: '사용자 추천 제외 처리',
        score: rec.score,
        reasons: ['추천 카드 제외 (숨김)'],
        action: 'IGNORE',
        userCode: currentUser?.code,
        userName: currentUser?.name || '기획재무담당',
        time: new Date().toLocaleString(),
      };
      const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
      localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([auditLog, ...currentLogs]));
    }

    setFeedbackMsg({
      type: 'success',
      text: '선택하신 추천 항목 카드가 안전하게 무시/제외되었습니다.',
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData(); // refresh lists
  };

  // Restore deleted/cancelled override for Budget Rows
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
      loadData();
    }
  };

  // Save budget overrides values
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
      updatedOverrides = updatedOverrides.filter(ov => ov.id !== key);

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
      const selectedItems = filteredRows.filter(r => selectedRowKeys.has(r.uniqueKey));
      
      selectedItems.forEach(item => {
        const key = `${year}_${planType}_${item.writerDeptCode}_${item.code}_${item.originalAttributedDeptCode}`;
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
    
    setFeedbackMsg({
      type: 'success',
      text: '부서 귀속 변경 정보가 override 테이블에 성공적으로 안전하게 저장되었습니다.'
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
    loadData();
  };

  // Reset all currently active filters
  const resetFilters = () => {
    setSelectedWriterDept('all');
    setSelectedAttributedDept('all');
    setSelectedCategory('all');
    setSearchAccount('');
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col gap-5 p-1 font-sans">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#008f83] rounded-full"></span>
            <h1 className="text-xl font-bold tracking-tight text-eco-black">부서 귀속 관리 모듈</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            작성 부서와 계정 귀속 부서 간의 관계를 보정하고, 실적 전표의 비정상 귀속부서를 귀속추천 알고리즘 기반으로 점검·적용합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white border border-zinc-200 rounded focus:border-[#008f83] outline-none font-medium"
          >
            <option value="2025">2025년</option>
            <option value="2026">2026년</option>
            <option value="2027">2027년</option>
          </select>
          <select 
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white border border-zinc-200 rounded focus:border-[#008f83] outline-none font-medium"
          >
            <option value="경영계획">경영계획</option>
            <option value="수정경영계획">수정경영계획</option>
          </select>
          <button 
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded transition border border-zinc-200 font-bold"
          >
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>
      </div>

      {/* Screen Tabs Selector */}
      <div className="border-b border-zinc-200 flex gap-4 mt-1">
        <button
          onClick={() => {
            setActiveTab('budget');
            resetFilters();
          }}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 -mb-px rounded-t-lg flex items-center gap-2 ${
            activeTab === 'budget'
              ? 'border-[#008f83] text-[#008f83] bg-emerald-50/20'
              : 'border-transparent text-text-secondary hover:text-eco-black'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          예산 귀속 관리 (기본)
        </button>
        <button
          onClick={() => {
            setActiveTab('actual_recommend');
            resetFilters();
          }}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 -mb-px rounded-t-lg flex items-center gap-2 ${
            activeTab === 'actual_recommend'
              ? 'border-[#008f83] text-[#008f83] bg-emerald-50/20'
              : 'border-transparent text-text-secondary hover:text-eco-black'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          실적 귀속 부서 추천 (AI 알고리즘)
          {attributionRecommendations.length > 0 && (
            <span className="bg-red-500 text-white rounded-full text-[9px] px-1.5 py-0.5 ml-1 font-sans font-black">
              {attributionRecommendations.length}
            </span>
          )}
        </button>
      </div>

      {feedbackMsg && (
        <div className={`p-4 text-xs rounded-xl border flex items-center gap-2 shadow-xs transition-all ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-55 bg-emerald-50 text-emerald-800 border-emerald-200 animate-in fade-in duration-150' 
            : 'bg-rose-50 text-rose-800 border-rose-200 animate-in fade-in duration-150'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{feedbackMsg.text}</span>
        </div>
      )}

      {/* VIEW 1: ACTUAL ATRIBUTION RECOMMENDATION VIEW */}
      {activeTab === 'actual_recommend' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          
          {/* Statistics summary top-box */}
          <div className="bg-gradient-to-r from-emerald-950/5 to-cobalt-950/5 border border-emerald-100/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#008f83] text-white px-2 py-0.5 rounded font-black font-mono">추천 동작대조</span>
                <span className="text-xs text-zinc-500 font-bold">감지된 오귀속 실적전표 복원 분석</span>
              </div>
              <h2 className="text-base font-extrabold text-zinc-900 mt-2">
                📂 전표 실적 정적 귀속 자율 추천 엔진 (Attribution Recommender)
              </h2>
              <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
                예산이 편성되지 않았거나 키워드 일치율이 높은 타 부서의 예산 집행권으로 귀속되는 것이 타당한 실적들을 자동 탐지했습니다.
                <strong> HIGH 신뢰도</strong>건은 수동 검토 없이 대조 즉시 배정 반영할 수 있습니다.
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {attributionRecommendations.filter(r => r.confidence === 'HIGH').length > 0 ? (
                <button
                  onClick={handleBulkApplyHighConfidence}
                  className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md hover:shadow-lg cursor-pointer select-none"
                >
                  <CheckCircle2 size={14} />
                  HIGH 신뢰도 건 일괄 자동적용 ({attributionRecommendations.filter(r => r.confidence === 'HIGH').length}건)
                </button>
              ) : (
                <span className="text-xs text-zinc-400 font-bold font-mono border border-dashed border-zinc-200/60 p-2.5 rounded-xl">
                  ✓ 해결할 고확신 추천 없음
                </span>
              )}
            </div>
          </div>

          {/* Cards Panel (Carousel format grid) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#008f83]" />
                정교 추천 카드 대시보드 (총 {attributionRecommendations.length}개 유효)
              </h3>
              {excludedRowIds.size > 0 && (
                <button
                  onClick={() => {
                    saveExcludedRowIds(new Set());
                    loadData();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-800 font-black flex items-center gap-1"
                >
                  [ 제외 내역 전체 초기화 ]
                </button>
              )}
            </div>

            {attributionRecommendations.length === 0 ? (
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-10 text-center text-zinc-400 text-xs">
                ✨ 현재 필터링 조건 또는 선택 연도 내에 생성된 추천 항목이 없습니다.<br/>
                <span className="text-[10px] mt-1.5 block text-zinc-400">오버라이드 이력을 추가하거나, 실적 전표에 새로운 데이터를 주입해 보세요.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 max-h-[440px] overflow-y-auto pr-1">
                {attributionRecommendations.map((rec) => (
                  <div 
                    key={rec.rowId}
                    className="bg-white border border-zinc-200 rounded-2xl p-4.5 flex flex-col justify-between hover:shadow-md transition-all relative hover:border-[#008f83]/50 group"
                  >
                    {/* Exclude card item close X button */}
                    <button
                      onClick={() => handleExcludeRecommendationCard(rec.rowId)}
                      title="추천에서 제외 (숨김)"
                      className="absolute top-3.5 right-3.5 text-zinc-300 hover:text-zinc-600 group-hover:block cursor-pointer select-none p-0.5 hover:bg-zinc-100 rounded"
                    >
                      <X size={14} />
                    </button>

                    <div>
                      {/* Header and Confidence score badges */}
                      <div className="flex gap-1.5 items-center mb-2.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded font-mono ${
                          rec.confidence === 'HIGH' 
                            ? 'bg-emerald-55 bg-emerald-100 text-emerald-800 border border-emerald-200/60' 
                            : rec.confidence === 'MEDIUM' 
                            ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                            : 'bg-cobalt-50 text-cobalt-700'
                        }`}>
                          신뢰도 {rec.confidence} ({rec.score}점)
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400">{rec.period} 전표</span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 line-clamp-1 mb-1 font-mono">
                        <span className="bg-zinc-100 text-zinc-600 px-1 rounded mr-1">[{rec.accountCode}]</span>
                        {rec.accountName}
                      </h4>
                      <p className="text-xs font-black text-[#008f83] mb-3.5">
                        실적 금액: {rec.amount.toLocaleString()} 원
                      </p>

                      {/* Before / After comparison flow block */}
                      <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-xl flex flex-col gap-2 mb-3.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-medium">원래 사용처</span>
                          <span className="text-zinc-600 font-medium truncate max-w-[130px]">
                            ({rec.originalDeptCode}) {rec.originalDeptName}
                          </span>
                        </div>
                        <div className="flex items-center justify-center text-zinc-300">
                          <ArrowRight size={13} className="animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-extrabold text-[#008f83]">귀속 추천부서</span>
                          <span className="text-[#008f83] font-black text-right truncate max-w-[140px]">
                            ({rec.recommendedDeptCode}) {rec.recommendedDeptName}
                          </span>
                        </div>
                      </div>

                      {/* Recommend Reasons lists */}
                      <div className="mb-4">
                        <p className="text-[10px] text-zinc-400 font-bold mb-1 flex items-center gap-1">
                          <Sparkles size={10} className="text-emerald-500" />
                          추천 사유 및 신호 점수
                        </p>
                        <ul className="text-[10.5px] text-zinc-500 font-mono space-y-1">
                          {rec.reasons.map((rs, ri) => (
                            <li key={ri} className="flex items-start gap-1">
                              <span className="text-emerald-600 font-extrabold">•</span>
                              <span>{rs.label} <strong className="text-zinc-700 font-bold">({rs.weight > 0 ? `+${rs.weight}` : rs.weight}pt)</strong></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quick apply or Manual Selection control block */}
                    <div className="flex flex-col gap-2 pt-3 border-t border-zinc-100">
                      <div className="flex gap-1.5 justify-between">
                        <button
                          onClick={() => handleApplySingleAttribution(rec.rowId, rec.recommendedDeptCode)}
                          className="flex-1 py-1 px-2.5 bg-[#008f83] hover:bg-[#00746b] text-white font-black text-[11px] rounded transition shadow-xs text-center cursor-pointer select-none"
                        >
                          추천 부서로 확정 적용
                        </button>
                      </div>

                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9.5px] text-zinc-400 font-semibold flex-shrink-0">수동 변경:</span>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleApplySingleAttribution(rec.rowId, e.target.value);
                            }
                          }}
                          className="w-full text-[10px] py-1 border border-zinc-200 bg-white rounded text-zinc-600 focus:border-[#008f83] outline-none font-medium"
                          defaultValue=""
                        >
                          <option value="">-- 타부서 기재배정 --</option>
                          {allDepts.map(dp => (
                            <option key={dp.code} value={dp.code}>{dp.name} ({dp.code})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table actualRows filters and ledger tracking lists */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-zinc-500" />
                <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-widest">전형적 전표 실적 목록 및 귀속 대조 수치</h2>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500">
                조합 필터 결과: {filteredActualRows.length}개 / 전체 {actualRowsList.length}개 실적
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold font-sans text-[11px]">
                    <th className="py-2.5 px-4">전표ID</th>
                    <th className="py-2.5 px-3">발생월</th>
                    <th className="py-2.5 px-3">계정과목 (코드/명)</th>
                    <th className="py-2.5 px-3">전표 원본 실사용처 부서</th>
                    <th className="py-2.5 px-3">현재 지정 귀속부서</th>
                    <th className="py-2.5 px-3 text-right">집행 금액</th>
                    <th className="py-2.5 px-3 text-center">대진 결과 및 강도</th>
                    <th className="py-2.5 px-4 text-center">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-sans">
                  {filteredActualRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400">
                        필터 기준에 부합하는 발생 전표 실적이 존재하지 않습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredActualRows.map(row => {
                      const rec = attributionRecommendations.find(r => r.rowId === row.id);
                      const hasOverride = row.attributedDeptCode && row.attributedDeptCode !== row.usageCode;

                      return (
                        <tr key={row.id} className={`hover:bg-zinc-50/55 transition ${hasOverride ? 'bg-emerald-50/30' : ''}`}>
                          <td className="py-3 px-4 font-mono font-bold text-zinc-400">{row.id}</td>
                          <td className="py-3 px-3 font-mono text-zinc-600 font-bold">{row.period || row.month || '12월'}</td>
                          <td className="py-3 px-3">
                            <span className="bg-zinc-100 text-zinc-800 font-mono text-[10.5px] px-1 py-0.5 rounded font-bold mr-1.5">
                              {row.accountCode}
                            </span>
                            <span className="text-zinc-900 font-bold font-sans">{row.accountName}</span>
                          </td>
                          <td className="py-3 px-3 text-zinc-600 font-medium">
                            ({row.usageCode}) {row.usageDept || row.usageCode}
                          </td>
                          <td className="py-3 px-3">
                            {hasOverride ? (
                              <div className="flex items-center gap-1 text-[#008f83] font-extrabold font-sans">
                                <span>[{row.attributedDeptCode}]</span>
                                <span>{row.attributedDeptName}</span>
                                <span className="text-[10px] text-zinc-400 font-medium font-sans">
                                  (수동보정 완료)
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400">원본동일 (보정 대기)</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-[#008f83]">
                            {Number(row.completed || row.amount || 0).toLocaleString()} 원
                          </td>
                          <td className="py-3 px-3 text-center">
                            {rec ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                ✦ 귀속 추천 가능 ({rec.confidence})
                              </span>
                            ) : hasOverride ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">
                                ✓ 보정 적용 완료
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-50 text-zinc-400 border border-zinc-100">
                                데이터 일치 (정상)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rec ? (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleApplySingleAttribution(row.id, rec.recommendedDeptCode)}
                                  className="text-[10px] bg-[#008f83] text-white hover:bg-[#00746b] px-2 py-1 rounded transition cursor-pointer select-none font-extrabold"
                                >
                                  추천적용
                                </button>
                                <button
                                  onClick={() => handleExcludeRecommendationCard(row.id)}
                                  className="text-[10px] text-zinc-500 hover:text-red-600 px-1 py-1 rounded transition cursor-pointer font-bold"
                                  title="목록 추천에서 숨기기"
                                >
                                  제외
                                </button>
                              </div>
                            ) : hasOverride ? (
                              <button
                                onClick={() => {
                                  // Restore back to original
                                  if (window.confirm('실적 귀속수정을 재초기화 하시고 원본으로 되돌리시겠습니까?')) {
                                    const actKey = getActualDataKey(year);
                                    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
                                    const next = storedActuals.map((r: any) => {
                                      if (r.id === row.id) {
                                        const { attributedDeptCode, attributedDeptName, ...rest } = r;
                                        return rest;
                                      }
                                      return r;
                                    });
                                    localStorage.setItem(actKey, JSON.stringify(next));
                                    setFeedbackMsg({
                                      type: 'success',
                                      text: '성공적으로 초기 원본귀속으로 전표가 안전하게 초기 배정되었습니다.',
                                    });
                                    setTimeout(() => setFeedbackMsg(null), 3000);
                                    loadData();
                                  }
                                }}
                                className="text-[10px] hover:text-red-600 font-bold"
                              >
                                귀속 되돌리기
                              </button>
                            ) : (
                              <span className="text-[10.5px] text-zinc-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ATTRIBUTION RECENT HISTORY LOGS */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden p-4.5">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500" />
              자율 보정 및 감사 이력 흔적 추적 (Audit Trail Logs - 로컬보관)
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3 block">감사 로그 테이블에 등록된 변경 이력이 아직 없습니다.</p>
            ) : (
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-xs text-zinc-600 border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-semibold font-sans">
                      <th className="py-2 px-3">전표 ID</th>
                      <th className="py-2 px-3">계정과목</th>
                      <th className="py-2 px-3">이전 부서</th>
                      <th className="py-2 px-3 text-center w-6">→</th>
                      <th className="py-2 px-3">최종 귀속배정</th>
                      <th className="py-2 px-3">동작 성격 및 내문</th>
                      <th className="py-2 px-3 text-right">변경자 / 처리시각</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-zinc-400">{log.rowId}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="font-mono text-zinc-700 font-bold mr-1">[{log.accountCode}]</span>
                          {log.accountName}
                        </td>
                        <td className="py-2 px-3 text-zinc-500">{log.originalDeptName || log.originalDeptCode}</td>
                        <td className="py-2 px-3 text-center text-zinc-400">→</td>
                        <td className="py-2 px-3 font-extrabold text-eco-black">{log.afterAttributedDeptName}</td>
                        <td className="py-2 px-3 text-zinc-500">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-700">익션: {log.action}</span>
                            <span className="text-[10px] text-zinc-400 truncate max-w-[280px]">공식근거: {log.reasons?.join(', ')}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-[10px] text-zinc-400 font-mono">
                          <p className="font-medium text-zinc-600">{log.userName}</p>
                          <p>{log.time}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ORIGINAL BUDGET ASSIGNMENT VIEW */}
      {activeTab === 'budget' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          
          {/* Navigation Flow Assist Card */}
          <div className="bg-[#f2faf7] border border-[#ddeae5] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 shadow-xs">
            <div>
              <span className="text-xs bg-[#008f83] text-white px-2 py-0.5 rounded font-bold font-mono font-sans shadow-xs">진행 단계</span>
              <h4 className="text-sm font-bold text-zinc-900 mt-1.5 font-sans">📂 예산 부서 귀속 관계 조정 제어판</h4>
              <p className="text-xs text-zinc-500 mt-0.5 font-sans">부서장 귀속 변경이 필요한 예산안을 안전하게 재할당하고 보정하는 관리 인터페이스입니다.</p>
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

          {/* Filters Bar */}
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
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span>
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
                    <th className="py-2.5 px-3 text-center">변경 상태</th>
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
                                초기값
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openSingleChange(row)}
                                className="p-1 text-[#008f83] hover:bg-zinc-100 rounded transition cursor-pointer select-none"
                                title="귀속 변경"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {row.status === 'CHANGED' && (
                                <button
                                  onClick={() => handleCancelOverride(row)}
                                  className="p-1 text-[#d92d20] hover:bg-rose-50 rounded transition cursor-pointer select-none"
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
                실시간 부서 귀속 변경 Override 이력 ({overrides.length}건)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600 border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-semibold text-[11px]">
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
        </div>
      )}

      {/* Change Modal for Budget Overrides */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl overflow-hidden w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-eco-black font-sans">
                {modalType === 'single' ? '귀속부서 재지정 (조정)' : '일괄 귀속부서 재지정 (일괄 조정)'}
              </h3>
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="text-zinc-450 hover:text-zinc-700 transition text-lg font-medium cursor-pointer"
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
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200 font-medium">
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
                  className="w-full px-3 py-2 text-xs text-zinc-700 bg-white border border-zinc-300 rounded focus:border-[#008f83] focus:ring-1 focus:ring-[#008f83] outline-none font-semibold"
                >
                  <option value="">-- 귀속 부서를 고르세요 --</option>
                  {allDepts.map(d => (
                    <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
                  귀속 변경 사유 작성 (이력 저장용)
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  rows={3}
                  placeholder="예: 전략소싱그룹 내 마케팅섹션으로 편입, 또는 타부서 사용경비 귀속 정정 등 사유를 기록하세요."
                  className="w-full px-3 py-2 text-xs text-zinc-700 bg-white border border-zinc-300 rounded focus:border-[#008f83] focus:ring-1 focus:ring-[#008f83] outline-none resize-none font-medium"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsChangeModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-zinc-100 text-zinc-650 border border-zinc-200 rounded font-bold transition cursor-pointer"
              >
                닫기
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-1.5 bg-[#008f83] hover:bg-[#00786f] text-white rounded font-bold border border-[#008f83] transition shadow-sm cursor-pointer"
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
