import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Filter, 
  Search, 
  RotateCcw, 
  Save, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  List, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  History, 
  X, 
  Undo2,
  Trash2,
  SlidersHorizontal,
  FileCheck
} from 'lucide-react';
import { getAllDepartments } from '../constants';
import { getBudgetDataKey, getActualDataKey } from '../lib/storageKeys';
import { usePermission } from '../lib/permissions';
import { 
  recommendAttributionForRow, 
  AttributionRecommendation, 
  AttributionAuditLog 
} from '../lib/deptAttributionRecommender';

interface RecommendationRow {
  rowId: string | number;
  row: any;
  period: string;
  monthIndex: number;
  accountCode: string;
  accountName: string;
  originalDeptCode: string;
  originalDeptName: string;
  currentAttributedDeptCode?: string;
  currentAttributedDeptName?: string;
  recommendedDeptCode: string;
  recommendedDeptName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: { label: string; weight: number }[];
  status: '대기' | '적용됨' | '무시됨' | '수동 변경';
  amount: number;
}

export default function DepartmentAssignment() {
  const navigate = useNavigate();
  const { currentUser } = usePermission();

  // Filter States
  const [year, setYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [monthMode, setMonthMode] = useState<'SINGLE' | 'YTD'>('YTD');
  const [selectedWriterDept, setSelectedWriterDept] = useState('all');
  const [selectedAttributedDept, setSelectedAttributedDept] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedConfidence, setSelectedConfidence] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded Raw Data States
  const [actualRowsList, setActualRowsList] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Selected Row for Details (Master-Detail)
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);

  // Bulk / Multi-Selection Keys
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());

  // Hidden/Excluded Recommendation Row IDs (Ignored)
  const [excludedRowIds, setExcludedRowIds] = useState<Set<string | number>>(() => {
    try {
      const stored = localStorage.getItem('cleanmetal_excluded_attribution_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const allDepts = useMemo(() => getAllDepartments(), []);

  // Budget Rows cache to score recommendations
  const budgetRowsByDept = useMemo(() => {
    const map = new Map<string, any[]>();
    allDepts.forEach(d => {
      const bKey = getBudgetDataKey(d.code, year, '경영계획');
      const savedData = localStorage.getItem(bKey);
      if (savedData) {
        try {
          map.set(d.code, JSON.parse(savedData));
        } catch (e) {
          console.error(e);
        }
      }
    });
    return map;
  }, [allDepts, year]);

  // Load Initial Storage Data
  const loadData = () => {
    // 1. Overrides
    try {
      const stored = localStorage.getItem('hycm_department_assignment_overrides');
      if (stored) setOverrides(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }

    // 2. Actuals
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

    // 3. Audit Logs
    try {
      const storedLogs = localStorage.getItem('hycm_attribution_audit_log');
      if (storedLogs) setAuditLogs(JSON.parse(storedLogs));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [year]);

  // Helper: Month parser
  const getPeriodMonthIndex = (period: string): number => {
    if (!period) return 12;
    const num = parseInt(period.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 12 : num;
  };

  // Convert Ignored recommendation updates to local storage
  const saveExcludedRowIds = (nextSet: Set<string | number>) => {
    setExcludedRowIds(nextSet);
    localStorage.setItem('cleanmetal_excluded_attribution_ids', JSON.stringify(Array.from(nextSet)));
  };

  // Log Audit trail to Local Storage
  const saveAuditLog = (params: {
    rowId: string | number;
    action: 'APPLY' | 'MANUAL_CHANGE' | 'REVERT' | 'IGNORE';
    accountCode: string;
    accountName: string;
    originalDeptCode: string;
    originalDeptName: string;
    beforeAttributedDeptCode?: string;
    beforeAttributedDeptName?: string;
    afterAttributedDeptCode?: string;
    afterAttributedDeptName?: string;
    reasons: string[];
    score: number;
  }) => {
    const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
    let actionLabel = '';
    switch (params.action) {
      case 'APPLY': actionLabel = '추천 적용'; break;
      case 'MANUAL_CHANGE': actionLabel = '수동 변경'; break;
      case 'REVERT': actionLabel = '원복'; break;
      case 'IGNORE': actionLabel = '추천 무시'; break;
    }

    const newLog = {
      id: `${Date.now()}_log_${Math.random().toString(36).substring(2, 7)}`,
      time: new Date().toLocaleString(),
      action: actionLabel,
      accountCode: params.accountCode,
      accountName: params.accountName,
      originalDeptName: `[${params.originalDeptCode}] ${params.originalDeptName}`,
      beforeAttributedDeptName: params.beforeAttributedDeptCode 
        ? `[${params.beforeAttributedDeptCode}] ${params.beforeAttributedDeptName}` 
        : '원 사용처 기준',
      afterAttributedDeptName: params.afterAttributedDeptCode 
        ? `[${params.afterAttributedDeptCode}] ${params.afterAttributedDeptName}` 
        : '원 사용처 기준',
      user: currentUser?.name || '기획재무담당',
      reason: params.reasons.join(', '),
    };

    const nextLogs = [newLog, ...currentLogs];
    localStorage.setItem('hycm_attribution_audit_log', JSON.stringify(nextLogs));
    setAuditLogs(nextLogs);
  };

  // Construct All Recommendation rows dynamically
  const allRecommendationRows = useMemo(() => {
    const result: RecommendationRow[] = [];

    actualRowsList.forEach((row: any) => {
      // Avoid planType constraints for actuals recommender
      const rec = recommendAttributionForRow({
        row,
        year,
        planType: '경영계획',
        monthMode: 'YTD',
        selectedMonth: 12,
        departments: allDepts,
        budgetRowsByDept,
        actualRows: actualRowsList,
        previousOverrides: overrides,
      });

      const isIgnored = excludedRowIds.has(row.id);
      const hasOverride = row.attributedDeptCode && row.attributedDeptCode !== row.usageCode;
      const isManual = row.attributionSource === 'manual' || (hasOverride && (!rec || row.attributedDeptCode !== rec.recommendedDeptCode));

      if (rec || hasOverride || isIgnored) {
        let status: '대기' | '적용됨' | '무시됨' | '수동 변경' = '대기';
        if (isIgnored) {
          status = '무시됨';
        } else if (row.attributedDeptCode === (rec?.recommendedDeptCode || '')) {
          status = '적용됨';
        } else if (isManual) {
          status = '수동 변경';
        }

        result.push({
          rowId: row.id,
          row,
          period: row.period || row.month || '12월',
          monthIndex: getPeriodMonthIndex(row.period || row.month),
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptCode: row.usageCode,
          originalDeptName: row.usageDept || row.usageCode,
          currentAttributedDeptCode: row.attributedDeptCode,
          currentAttributedDeptName: row.attributedDeptName,
          recommendedDeptCode: rec ? rec.recommendedDeptCode : '',
          recommendedDeptName: rec ? rec.recommendedDeptName : '',
          confidence: rec ? rec.confidence : 'LOW',
          score: rec ? rec.score : 0,
          reasons: rec ? rec.reasons : [{ label: '부서 직접 지정 변경', weight: 0 }],
          status,
          amount: Number(row.completed || row.amount || 0),
        });
      }
    });

    return result.sort((a, b) => b.score - a.score);
  }, [actualRowsList, year, allDepts, budgetRowsByDept, overrides, excludedRowIds]);

  // Apply UI Filters
  const filteredRecommendationRows = useMemo(() => {
    return allRecommendationRows.filter(item => {
      // Month
      if (selectedMonth !== 'all') {
        const monthIndex = getPeriodMonthIndex(item.period);
        if (monthMode === 'YTD') {
          if (monthIndex > Number(selectedMonth)) return false;
        } else {
          if (monthIndex !== Number(selectedMonth)) return false;
        }
      }

      // Original Dept
      if (selectedWriterDept !== 'all' && item.originalDeptCode !== selectedWriterDept) return false;

      // Recommended Dept
      if (selectedAttributedDept !== 'all' && item.recommendedDeptCode !== selectedAttributedDept) return false;

      // Cost Nature (비용 성격)
      if (selectedCategory !== 'all') {
        const isMfg = item.accountCode.startsWith('5') || item.accountCode.startsWith('6');
        if (selectedCategory === '제조' && !isMfg) return false;
        if (selectedCategory === '판관' && isMfg) return false;
      }

      // Confidence
      if (selectedConfidence !== 'all' && item.confidence !== selectedConfidence) return false;

      // Status
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      // Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const codeMatch = item.accountCode.includes(query);
        const nameMatch = item.accountName.toLowerCase().includes(query);
        const origCodeMatch = item.originalDeptCode.includes(query);
        const origNameMatch = item.originalDeptName.toLowerCase().includes(query);
        const recCodeMatch = item.recommendedDeptCode?.includes(query);
        const recNameMatch = item.recommendedDeptName?.toLowerCase().includes(query);
        const reasonMatch = item.reasons.some(r => r.label.toLowerCase().includes(query));

        if (!codeMatch && !nameMatch && !origCodeMatch && !origNameMatch && !recCodeMatch && !recNameMatch && !reasonMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allRecommendationRows, selectedMonth, monthMode, selectedWriterDept, selectedAttributedDept, selectedCategory, selectedConfidence, selectedStatus, searchQuery]);

  // Selected Detail Row reference
  const activeDetailRow = useMemo(() => {
    if (selectedRowId === null) return null;
    return allRecommendationRows.find(r => r.rowId === selectedRowId) || null;
  }, [allRecommendationRows, selectedRowId]);

  // Dynamic Statistics Counters
  const stats = useMemo(() => {
    return {
      totalPending: allRecommendationRows.filter(r => r.status === '대기').length,
      highConfidence: allRecommendationRows.filter(r => r.status === '대기' && r.confidence === 'HIGH').length,
      applied: allRecommendationRows.filter(r => r.status === '적용됨' || r.status === '수동 변경').length,
      ignored: allRecommendationRows.filter(r => r.status === '무시됨').length,
    };
  }, [allRecommendationRows]);

  // Actions: Apply recommended department attribution
  const handleApplyRecommendation = (rowId: string | number, recDeptCode: string, recDeptName: string, reasons: string[], score: number) => {
    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    let targetRow: any = null;

    const updated = storedActuals.map((row: any) => {
      if (row.id !== rowId) return row;
      targetRow = row;
      return {
        ...row,
        usageCode: row.usageCode, // Keep original untouched
        usageDept: row.usageDept, // Keep original untouched
        attributedDeptCode: recDeptCode,
        attributedDeptName: recDeptName,
        attributionSource: 'recommendation',
        attributionScore: score,
        attributionReasons: reasons,
        attributionUpdatedAt: new Date().toISOString(),
      };
    });

    if (targetRow) {
      localStorage.setItem(actKey, JSON.stringify(updated));
      saveAuditLog({
        rowId,
        action: 'APPLY',
        accountCode: targetRow.accountCode,
        accountName: targetRow.accountName,
        originalDeptCode: targetRow.usageCode,
        originalDeptName: targetRow.usageDept || targetRow.usageCode,
        beforeAttributedDeptCode: targetRow.attributedDeptCode,
        beforeAttributedDeptName: targetRow.attributedDeptName,
        afterAttributedDeptCode: recDeptCode,
        afterAttributedDeptName: recDeptName,
        reasons,
        score,
      });

      setFeedbackMsg({
        type: 'success',
        text: `[${targetRow.accountName}] 의 귀속부서가 [${recDeptName}] 추천 부서로 성공적으로 적용되었습니다.`
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
      loadData();
    }
  };

  // Actions: Manual attribute change
  const handleApplyManualChange = (rowId: string | number, selectedDeptCode: string) => {
    if (!selectedDeptCode) return;
    const dept = allDepts.find(d => d.code === selectedDeptCode);
    if (!dept) return;

    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    let targetRow: any = null;

    const updated = storedActuals.map((row: any) => {
      if (row.id !== rowId) return row;
      targetRow = row;
      return {
        ...row,
        usageCode: row.usageCode, // Keep original untouched
        usageDept: row.usageDept, // Keep original untouched
        attributedDeptCode: dept.code,
        attributedDeptName: dept.name,
        attributionSource: 'manual',
        attributionScore: 0,
        attributionReasons: ['업무담당자 수동 보정 변경'],
        attributionUpdatedAt: new Date().toISOString(),
      };
    });

    if (targetRow) {
      localStorage.setItem(actKey, JSON.stringify(updated));
      saveAuditLog({
        rowId,
        action: 'MANUAL_CHANGE',
        accountCode: targetRow.accountCode,
        accountName: targetRow.accountName,
        originalDeptCode: targetRow.usageCode,
        originalDeptName: targetRow.usageDept || targetRow.usageCode,
        beforeAttributedDeptCode: targetRow.attributedDeptCode,
        beforeAttributedDeptName: targetRow.attributedDeptName,
        afterAttributedDeptCode: dept.code,
        afterAttributedDeptName: dept.name,
        reasons: ['수동 변경 지정 적용'],
        score: 0,
      });

      setFeedbackMsg({
        type: 'success',
        text: `[${targetRow.accountName}] 의 귀속부서가 [${dept.name}] (수동)으로 적용되었습니다.`
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
      loadData();
    }
  };

  // Actions: Revert to original attribution
  const handleRevertAttribution = (rowId: string | number) => {
    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    let targetRow: any = null;

    const updated = storedActuals.map((row: any) => {
      if (row.id !== rowId) return row;
      targetRow = row;

      const {
        attributedDeptCode,
        attributedDeptName,
        attributionSource,
        attributionScore,
        attributionReasons,
        attributionUpdatedAt,
        ...rest
      } = row;
      return rest;
    });

    if (targetRow) {
      localStorage.setItem(actKey, JSON.stringify(updated));
      saveAuditLog({
        rowId,
        action: 'REVERT',
        accountCode: targetRow.accountCode,
        accountName: targetRow.accountName,
        originalDeptCode: targetRow.usageCode,
        originalDeptName: targetRow.usageDept || targetRow.usageCode,
        beforeAttributedDeptCode: targetRow.attributedDeptCode,
        beforeAttributedDeptName: targetRow.attributedDeptName,
        afterAttributedDeptCode: undefined,
        afterAttributedDeptName: undefined,
        reasons: ['원본 사용처 기준으로 귀속부서 복원'],
        score: 0,
      });

      setFeedbackMsg({
        type: 'success',
        text: `[${targetRow.accountName}] 의 지정 귀속부서가 성공적으로 제거(원본 부서 기준으로 원복)되었습니다.`
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
      loadData();
    }
  };

  // Actions: Ignore single recommendation
  const handleIgnoreRecommendation = (rowId: string | number) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    nextSet.add(rowId);
    saveExcludedRowIds(nextSet);

    const matchRec = allRecommendationRows.find(r => r.rowId === rowId);
    if (matchRec) {
      saveAuditLog({
        rowId,
        action: 'IGNORE',
        accountCode: matchRec.accountCode,
        accountName: matchRec.accountName,
        originalDeptCode: matchRec.originalDeptCode,
        originalDeptName: matchRec.originalDeptName,
        beforeAttributedDeptCode: matchRec.currentAttributedDeptCode,
        beforeAttributedDeptName: matchRec.currentAttributedDeptName,
        afterAttributedDeptCode: undefined,
        afterAttributedDeptName: '추천 제외됨 (사용자 무시)',
        reasons: ['사용자 추천 제외 등록 수동 수행'],
        score: matchRec.score,
      });
    }

    setFeedbackMsg({
      type: 'success',
      text: '선택하신 귀속 추천 항목을 무시 처리하여 제외 리스트에 등록했습니다.'
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Undo Ignored state
  const handleUndoIgnore = (rowId: string | number) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    nextSet.delete(rowId);
    saveExcludedRowIds(nextSet);

    setFeedbackMsg({
      type: 'success',
      text: '무시 처리가 해제되어 정상 대기 상태로 복구되었습니다.'
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Higher confidence bulk apply
  const handleBulkApplyHighConfidence = () => {
    const highPending = allRecommendationRows.filter(r => r.status === '대기' && r.confidence === 'HIGH');
    if (highPending.length === 0) {
      alert('일괄 적용 가능한 "높음" 신뢰도의 대기 상태 추천 항목이 정의되어 있지 않습니다.');
      return;
    }

    if (!window.confirm(`높은 신뢰도 추천 ${highPending.length}건을 적용하시겠습니까?\n\n원 사용처는 변경하지 않고, 분석용 귀속부서만 적용됩니다.\n적용 결과는 예산현황, 비교분석, 초과·미달 항목 집계에 반영됩니다.`)) {
      return;
    }

    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    const opName = currentUser?.name || '기획재무담당';
    const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
    let updateCount = 0;
    const newLogs: any[] = [];

    const updated = storedActuals.map((row: any) => {
      const isHigh = highPending.find(h => h.rowId === row.id);
      if (isHigh) {
        updateCount++;
        const reasons = isHigh.reasons.map(r => r.label);

        newLogs.push({
          id: `${Date.now()}_bulk_${Math.random().toString(36).substring(2, 7)}`,
          time: new Date().toLocaleString(),
          action: '추천 적용 (일괄)',
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
          beforeAttributedDeptName: row.attributedDeptCode 
            ? `[${row.attributedDeptCode}] ${row.attributedDeptName}` 
            : '원 사용처 기준',
          afterAttributedDeptName: `[${isHigh.recommendedDeptCode}] ${isHigh.recommendedDeptName}`,
          user: opName,
          reason: `[높은 신뢰도 일괄] ${reasons.join(', ')}`,
        });

        return {
          ...row,
          usageCode: row.usageCode,
          usageDept: row.usageDept,
          attributedDeptCode: isHigh.recommendedDeptCode,
          attributedDeptName: isHigh.recommendedDeptName,
          attributionSource: 'recommendation',
          attributionScore: isHigh.score,
          attributionReasons: reasons,
          attributionUpdatedAt: new Date().toISOString(),
        };
      }
      return row;
    });

    localStorage.setItem(actKey, JSON.stringify(updated));
    localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([...newLogs, ...currentLogs]));

    setFeedbackMsg({
      type: 'success',
      text: `총 ${updateCount}건의 높은 신뢰도 추천 항목을 실적 데이터에 일괄 보정 결전 처리했습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Bulk Action Applied Selected
  const handleApplySelectedRows = () => {
    if (selectedRowIds.size === 0) {
      alert('적용할 항목들을 먼저 테이블 좌측 체크박스 형태로 선택해 주세요.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      alert('선택된 항목 중 적용할 대기 상태 추천 건이 없습니다.');
      return;
    }

    if (!window.confirm(`선택한 추천 ${targets.length}건을 일개 부서 귀속 처리하시겠습니까?`)) {
      return;
    }

    const actKey = getActualDataKey(year);
    const storedActuals = JSON.parse(localStorage.getItem(actKey) || '[]');
    const opName = currentUser?.name || '기획재무담당';
    const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
    const newLogs: any[] = [];
    let count = 0;

    const updated = storedActuals.map((row: any) => {
      const match = targets.find(t => t.rowId === row.id);
      if (match) {
        count++;
        const reasons = match.reasons.map(r => r.label);

        newLogs.push({
          id: `${Date.now()}_sel_${Math.random().toString(36).substring(2, 7)}`,
          time: new Date().toLocaleString(),
          action: '추천 적용 (선택)',
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
          beforeAttributedDeptName: row.attributedDeptCode 
            ? `[${row.attributedDeptCode}] ${row.attributedDeptName}` 
            : '원 사용처 기준',
          afterAttributedDeptName: `[${match.recommendedDeptCode}] ${match.recommendedDeptName}`,
          user: opName,
          reason: reasons.join(', '),
        });

        return {
          ...row,
          usageCode: row.usageCode,
          usageDept: row.usageDept,
          attributedDeptCode: match.recommendedDeptCode,
          attributedDeptName: match.recommendedDeptName,
          attributionSource: 'recommendation',
          attributionScore: match.score,
          attributionReasons: reasons,
          attributionUpdatedAt: new Date().toISOString(),
        };
      }
      return row;
    });

    localStorage.setItem(actKey, JSON.stringify(updated));
    localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([...newLogs, ...currentLogs]));

    setFeedbackMsg({
      type: 'success',
      text: `선택하신 ${count}건에 대해 실적 귀속부서 추천을 안전 보정 적용했습니다.`
    });
    setSelectedRowIds(new Set());
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Bulk Action Ignore Selected
  const handleIgnoreSelectedRows = () => {
    if (selectedRowIds.size === 0) {
      alert('추천을 무시할 항목들을 체크박스 형태로 선택해 주세요.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      alert('선택된 항목 중 무시 처리(숨김)할 대기 상태 추천 건이 없습니다.');
      return;
    }

    if (!window.confirm(`선택한 추천 ${targets.length}건을 무시 처리하여 제외시키겠습니까?`)) {
      return;
    }

    const nextSet = new Set<string | number>(excludedRowIds);
    const currentLogs = JSON.parse(localStorage.getItem('hycm_attribution_audit_log') || '[]');
    const newLogs: any[] = [];

    targets.forEach(item => {
      nextSet.add(item.rowId);
      newLogs.push({
        id: `${Date.now()}_selig_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '추천 무시 (선택)',
        accountCode: item.accountCode,
        accountName: item.accountName,
        originalDeptName: `[${item.originalDeptCode}] ${item.originalDeptName}`,
        beforeAttributedDeptName: item.currentAttributedDeptCode 
          ? `[${item.currentAttributedDeptCode}] ${item.currentAttributedDeptName}` 
          : '원 사용처 기준',
        afterAttributedDeptName: '사용자 추천 제외 처리 (숨김)',
        user: currentUser?.name || '업무담당자',
        reason: '목록 선택 일괄 추천 무시 제외 등록',
      });
    });

    saveExcludedRowIds(nextSet);
    localStorage.setItem('hycm_attribution_audit_log', JSON.stringify([...newLogs, ...currentLogs]));

    setFeedbackMsg({
      type: 'success',
      text: `${targets.length}건의 항목이 무시 처리 제외 완료되었습니다.`
    });
    setSelectedRowIds(new Set());
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Formatting helpers
  const formatMillionWon = (val: number): string => {
    const mil = val / 1000000;
    if (mil > 0 && mil < 1) {
      return `${mil.toFixed(1)}백만원`;
    }
    return `${Math.round(mil).toLocaleString()}백만원`;
  };

  const getConfidenceLabel = (conf: 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (conf === 'HIGH') return '높음';
    if (conf === 'MEDIUM') return '중간';
    return '낮음';
  };

  // Multi-select actions helper
  const handleToggleSelectRow = (id: string | number) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAllSelect = () => {
    const pendingInPage = filteredRecommendationRows.filter(r => r.status === '대기');
    if (selectedRowIds.size === pendingInPage.length && pendingInPage.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(pendingInPage.map(r => r.rowId)));
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedMonth('all');
    setMonthMode('YTD');
    setSelectedWriterDept('all');
    setSelectedAttributedDept('all');
    setSelectedCategory('all');
    setSelectedConfidence('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col gap-5 p-1 font-sans">
      
      {/* 1. Header Area without AI/Engine/Algorithm/Recommender slop */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between border-b pb-4 border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-[#008f83] rounded-full"></span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">실적 귀속부서 관리</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            업로드된 실적의 원 사용처는 보존하고, 예산·실적 분석에 사용할 귀속부서를 별도로 보정합니다.
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <label className="text-xs font-semibold text-zinc-650">연도:</label>
          <select 
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-2.5 py-1.5 text-xs text-zinc-700 bg-white border border-zinc-200 rounded focus:border-[#008f83] outline-none font-medium"
          >
            <option value="2025">2025년</option>
            <option value="2026">2026년</option>
            <option value="2027">2027년</option>
          </select>
          <button 
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded transition font-bold"
          >
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 text-xs rounded-lg border flex items-center gap-2 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. Compact Statistics Summary Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="flex flex-col gap-1 pl-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">추천 대상</span>
          <span className="text-xl font-black text-zinc-800">{stats.totalPending}건</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-zinc-250 md:pl-4">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">신뢰도 높음</span>
          <span className="text-xl font-black text-emerald-600">{stats.highConfidence}건</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-zinc-250 md:pl-4">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">보정 적용됨</span>
          <span className="text-xl font-black text-[#008f83]">{stats.applied}건</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-zinc-250 md:pl-4">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">무시/제외됨</span>
          <span className="text-xl font-black text-zinc-500">{stats.ignored}건</span>
        </div>
      </div>

      {/* 3. Filter Controls Panel */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl flex flex-col gap-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-450" />
          상세 필터 조정
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2.5">
          {/* Month Mode Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">조회 기준</span>
            <div className="grid grid-cols-2 border border-zinc-200 rounded overflow-hidden">
              <button
                onClick={() => setMonthMode('SINGLE')}
                className={`py-1 text-[10px] font-bold ${monthMode === 'SINGLE' ? 'bg-[#008f83] text-white' : 'bg-white text-zinc-600'}`}
              >
                단월
              </button>
              <button
                onClick={() => setMonthMode('YTD')}
                className={`py-1 text-[10px] font-bold ${monthMode === 'YTD' ? 'bg-[#008f83] text-white' : 'bg-white text-zinc-600'}`}
              >
                누계
              </button>
            </div>
          </div>

          {/* Month Value */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">기준 월</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 YTD</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1)}>{i + 1}월</option>
              ))}
            </select>
          </div>

          {/* Original Dept */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">원 사용처</span>
            <select
              value={selectedWriterDept}
              onChange={(e) => setSelectedWriterDept(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 부서</option>
              {allDepts.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Recommended Dept */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">추천 귀속부서</span>
            <select
              value={selectedAttributedDept}
              onChange={(e) => setSelectedAttributedDept(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 부서</option>
              {allDepts.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">비용 성격</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 성격</option>
              <option value="제조">제조 비용</option>
              <option value="판관">판관 비용</option>
            </select>
          </div>

          {/* Confidence */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">신뢰도</span>
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 신뢰도</option>
              <option value="HIGH">높음 (HIGH)</option>
              <option value="MEDIUM">중간 (MEDIUM)</option>
              <option value="LOW">낮음 (LOW)</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">상태</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="all">전체 상태</option>
              <option value="대기">대기</option>
              <option value="적용됨">적용됨</option>
              <option value="무시됨">무시됨</option>
              <option value="수동 변경">수동 변경</option>
            </select>
          </div>

          {/* Text Search */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-[10px] font-bold text-zinc-400">검색</span>
            <div className="relative">
              <input
                type="text"
                placeholder="계정코드, 명, 부서, 사유 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-1.5 pl-7 pr-3 border border-zinc-200 rounded focus:border-[#008f83] outline-none font-medium"
              />
              <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Clear Filter / Control Buttons row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100">
          <button 
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 transition font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 필터 초기화
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApplyHighConfidence}
              disabled={stats.highConfidence === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold text-white transition-all select-none ${
                stats.highConfidence > 0 ? 'bg-[#008f83] hover:bg-[#00746b] cursor-pointer' : 'bg-zinc-300 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              높은 신뢰도 일괄 적용 ({stats.highConfidence}건)
            </button>

            <button
              onClick={handleApplySelectedRows}
              disabled={selectedRowIds.size === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border transition ${
                selectedRowIds.size > 0 
                  ? 'border-[#008f83] text-[#008f83] bg-emerald-50/20 hover:bg-emerald-50/50 cursor-pointer'
                  : 'border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed'
              }`}
            >
              선택 항목 적용 ({selectedRowIds.size}건)
            </button>

            <button
              onClick={handleIgnoreSelectedRows}
              disabled={selectedRowIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              선택 항목 무시 ({selectedRowIds.size}건)
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border transition ${
                showHistory ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              이력 {showHistory ? '닫기' : '보기'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Contents Area: Multi Columns split layout for Master-Detail UI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column representing the Single-Row Table list */}
        <div className={`flex flex-col gap-4 ${activeDetailRow ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700">귀속 추천 목록</span>
              <span className="text-[11.5px] font-mono text-zinc-500">
                조회 결과: <strong>{filteredRecommendationRows.length}</strong>건 / 유효 {allRecommendationRows.length}건
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-250 text-zinc-450 font-bold text-[10.5px] select-none">
                    <th className="py-2.5 px-3 w-8 text-center">
                      <input 
                        type="checkbox"
                        checked={
                          filteredRecommendationRows.length > 0 &&
                          filteredRecommendationRows.filter(r => r.status === '대기').every(r => selectedRowIds.has(r.rowId))
                        }
                        onChange={handleToggleAllSelect}
                        className="rounded accent-[#008f83]"
                      />
                    </th>
                    <th className="py-2.5 px-2 text-center w-12">기간</th>
                    <th className="py-2.5 px-3 w-24">계정코드</th>
                    <th className="py-2.5 px-3">계정명</th>
                    <th className="py-2.5 px-3">원 사용처</th>
                    <th className="py-2.5 px-3">현재 귀속부서</th>
                    <th className="py-2.5 px-3">추천 귀속부서</th>
                    <th className="py-2.5 px-3 text-right">실적 금액</th>
                    <th className="py-2.5 px-2 text-center">신뢰도</th>
                    <th className="py-2.5 px-2 text-center">사유수</th>
                    <th className="py-2.5 px-2 text-center w-16">상태</th>
                    <th className="py-2.5 px-3 text-center w-24">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 font-sans">
                  {filteredRecommendationRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-14 text-center text-zinc-400">
                        지정된 조건에 부합하는 귀속 추천 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRecommendationRows.map(item => {
                      const isSelected = selectedRowId === item.rowId;
                      const isChecked = selectedRowIds.has(item.rowId);

                      return (
                        <tr 
                          key={item.rowId}
                          onClick={() => setSelectedRowId(item.rowId)}
                          className={`hover:bg-zinc-50/60 transition-all cursor-pointer ${
                            isSelected ? 'bg-emerald-50/20 border-l-2 border-[#008f83]' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {item.status === '대기' ? (
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectRow(item.rowId)}
                                className="rounded accent-[#008f83]"
                              />
                            ) : (
                              <span className="text-zinc-300 font-mono text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-medium text-zinc-500">{item.period}</td>
                          <td className="py-3 px-3 font-mono font-bold text-zinc-700">{item.accountCode}</td>
                          <td className="py-3 px-3 font-bold text-zinc-900 truncate max-w-[140px]" title={item.accountName}>
                            {item.accountName}
                          </td>
                          <td className="py-3 px-3 text-zinc-600 truncate max-w-[120px]" title={item.originalDeptName}>
                            [{item.originalDeptCode}] {item.originalDeptName}
                          </td>
                          <td className="py-3 px-3">
                            {item.currentAttributedDeptCode ? (
                              <span className="text-[#008f83] font-semibold truncate block max-w-[120px]" title={item.currentAttributedDeptName}>
                                [{item.currentAttributedDeptCode}] {item.currentAttributedDeptName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-medium font-sans">원 사용처 기준</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {item.recommendedDeptCode ? (
                              <span className="text-[#008f83] font-bold truncate block max-w-[120px]" title={item.recommendedDeptName}>
                                [{item.recommendedDeptCode}] {item.recommendedDeptName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-zinc-800" title={`${item.amount.toLocaleString()}원`}>
                            {formatMillionWon(item.amount)}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {item.recommendedDeptCode ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                item.confidence === 'HIGH' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : item.confidence === 'MEDIUM' 
                                  ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                  : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                              }`}>
                                {getConfidenceLabel(item.confidence)}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-zinc-500">{item.reasons.length}개</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.status === '적용됨' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : item.status === '무시됨' 
                                ? 'bg-zinc-200 text-zinc-600' 
                                : item.status === '수동 변경' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              {item.status === '대기' && (
                                <>
                                  <button
                                    onClick={() => handleApplyRecommendation(
                                      item.rowId, 
                                      item.recommendedDeptCode, 
                                      item.recommendedDeptName, 
                                      item.reasons.map(r => r.label), 
                                      item.score
                                    )}
                                    className="px-1.5 py-0.5 bg-[#008f83] hover:bg-[#00746b] text-white rounded font-bold transition text-[10px] select-none cursor-pointer"
                                  >
                                    적용
                                  </button>
                                  <button
                                    onClick={() => handleIgnoreRecommendation(item.rowId)}
                                    className="px-1.5 py-0.5 bg-zinc-150 border border-zinc-200 hover:bg-zinc-200 text-zinc-600 rounded font-bold transition text-[10px] select-none cursor-pointer"
                                  >
                                    무시
                                  </button>
                                </>
                              )}
                              {(item.status === '적용됨' || item.status === '수동 변경') && (
                                <button
                                  onClick={() => handleRevertAttribution(item.rowId)}
                                  className="px-1.5 py-0.5 border border-red-200 text-red-650 hover:bg-red-50 rounded font-bold transition text-[10px] select-none cursor-pointer"
                                  title="원 사용처 기준으로 귀속 원복"
                                >
                                  원복
                                </button>
                              )}
                              {item.status === '무시됨' && (
                                <button
                                  onClick={() => handleUndoIgnore(item.rowId)}
                                  className="px-1.5 py-0.5 border border-zinc-300 text-zinc-600 hover:bg-zinc-100 rounded font-semibold transition text-[10px] select-none cursor-pointer"
                                >
                                  무시취소
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
        </div>

        {/* Right Column: Detailed Recommendation Drawer panel */}
        {activeDetailRow && (
          <div className="lg:col-span-4 flex flex-col gap-4 animate-in slide-in-from-right duration-250">
            <div className="bg-white border border-zinc-200 rounded-xl shadow-md overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#008f83] text-white font-bold text-xs flex items-center justify-between">
                <span>귀속 추천 상세</span>
                <button 
                  onClick={() => setSelectedRowId(null)}
                  className="text-white.80 hover:text-white p-0.5 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs font-sans">
                
                {/* Account Section */}
                <div className="flex flex-col gap-2 border-b pb-3 border-zinc-100">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">계정 정보</div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500 font-medium">계정코드</span>
                      <span className="font-mono font-bold text-zinc-800">{activeDetailRow.accountCode}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500 font-medium">계정과목명</span>
                      <span className="font-bold text-zinc-800 text-right">{activeDetailRow.accountName}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500 font-medium">발생 기간</span>
                      <span className="font-bold text-zinc-700">{activeDetailRow.period} 실적</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-zinc-500 font-medium">실적금액</span>
                      <span className="font-mono font-black text-[#008f83] text-sm">
                        {activeDetailRow.amount.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>

                {/* Departments Comparison */}
                <div className="flex flex-col gap-2 border-b pb-3 border-zinc-100">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">부서 정보</div>
                  <div className="flex flex-col gap-1.5 bg-zinc-50 p-2.5 rounded border border-zinc-150">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-500">원 사용처</span>
                      <span className="font-bold text-zinc-700">
                        [{activeDetailRow.originalDeptCode}] {activeDetailRow.originalDeptName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1">
                      <span className="text-zinc-500">현재 귀속부서</span>
                      <span className="font-bold text-zinc-800">
                        {activeDetailRow.currentAttributedDeptCode ? (
                          <span className="text-[#008f83]">
                            [{activeDetailRow.currentAttributedDeptCode}] {activeDetailRow.currentAttributedDeptName}
                          </span>
                        ) : (
                          <span className="text-zinc-450">원 사용처 기준 동일</span>
                        )}
                      </span>
                    </div>
                    {activeDetailRow.recommendedDeptCode && (
                      <div className="flex justify-between items-center text-[11px] border-t border-dashed border-zinc-200 mt-1.5 pt-1.5">
                        <span className="text-zinc-500 font-bold text-[#008f83]">추천 귀속부서</span>
                        <span className="font-extrabold text-[#008f83]">
                          [{activeDetailRow.recommendedDeptCode}] {activeDetailRow.recommendedDeptName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Score and Reasons Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">귀속 추천 사유</div>
                    {activeDetailRow.score > 0 && (
                      <span className="text-[10.5px] font-mono text-[#008f83] font-bold">
                        수렴 점수: {activeDetailRow.score}점 ({getConfidenceLabel(activeDetailRow.confidence)})
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {activeDetailRow.reasons.map((rs, i) => (
                      <li key={i} className="bg-zinc-50/50 p-2 rounded border border-zinc-150 text-[10.5px] text-zinc-650 flex items-start gap-1">
                        <span className="text-emerald-500 font-semibold">•</span>
                        <div>
                          <span>{rs.label}</span>
                          {rs.weight > 0 && (
                            <strong className="text-zinc-700 ml-1">+{rs.weight}점</strong>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Operational Actions */}
                <div className="flex flex-col gap-2 pt-3 border-t border-zinc-150">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">보정 작업 처리</div>
                  
                  {activeDetailRow.status === '대기' && activeDetailRow.recommendedDeptCode && (
                    <button
                      onClick={() => handleApplyRecommendation(
                        activeDetailRow.rowId, 
                        activeDetailRow.recommendedDeptCode, 
                        activeDetailRow.recommendedDeptName, 
                        activeDetailRow.reasons.map(r => r.label), 
                        activeDetailRow.score
                      )}
                      className="w-full py-2 bg-[#008f83] hover:bg-[#00746b] text-white font-bold rounded transition text-center select-none cursor-pointer shadow-xs"
                    >
                      추천 적용
                    </button>
                  )}

                  {/* Manual Dropdown Selector */}
                  <div className="flex flex-col gap-1.5 mt-1.5 p-2 bg-zinc-50 rounded border border-zinc-150">
                    <span className="text-[10px] font-semibold text-zinc-500">수동 변경 부서 선택</span>
                    <div className="flex gap-1">
                      <select
                        id="manual-dept-select"
                        className="flex-1 text-[11px] py-1 border border-zinc-200 bg-white rounded outline-none font-medium text-zinc-700 focus:border-[#008f83]"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleApplyManualChange(activeDetailRow.rowId, val);
                            e.target.value = ""; // Reset index
                          }
                        }}
                      >
                        <option value="">수동 변경할 부서 선택</option>
                        {allDepts.map(dp => (
                          <option key={dp.code} value={dp.code}>{dp.name} ({dp.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {activeDetailRow.status === '대기' && (
                      <button
                        onClick={() => handleIgnoreRecommendation(activeDetailRow.rowId)}
                        className="py-1.5 border border-zinc-250 hover:bg-zinc-100 text-zinc-600 font-bold rounded transition text-center select-none cursor-pointer"
                      >
                        추천 무시
                      </button>
                    )}
                    {activeDetailRow.status === '무시됨' && (
                      <button
                        onClick={() => handleUndoIgnore(activeDetailRow.rowId)}
                        className="col-span-2 py-1.5 border border-[#008f83] text-[#008f83] hover:bg-emerald-50 rounded font-bold transition text-center select-none cursor-pointer"
                      >
                        무시 취소
                      </button>
                    )}
                    {(activeDetailRow.status === '적용됨' || activeDetailRow.status === '수동 변경') && (
                      <button
                        onClick={() => handleRevertAttribution(activeDetailRow.rowId)}
                        className="col-span-2 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded transition text-center select-none cursor-pointer"
                      >
                        귀속 원복
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* 5. Audit History Log Table representation (Collapsible Section) */}
      {showHistory && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mt-2 animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-3 bg-zinc-800 text-white font-bold text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              최근 귀속부서 보정 변경 이력
            </span>
            <button
              onClick={() => {
                if (window.confirm('모든 로컬 이력을 비우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                  localStorage.removeItem('hycm_attribution_audit_log');
                  setAuditLogs([]);
                }
              }}
              className="text-red-300 hover:text-red-200 font-semibold"
            >
              이력 비우기
            </button>
          </div>
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-500 font-bold font-sans text-[10.5px]">
                  <th className="py-2.5 px-4 w-40">시간</th>
                  <th className="py-2.5 px-3 w-24">작업</th>
                  <th className="py-2.5 px-3">계정과목 (코드/명)</th>
                  <th className="py-2.5 px-3">원본 사용처</th>
                  <th className="py-2.5 px-3">변경 전 귀속부서</th>
                  <th className="py-2.5 px-3">변경 후 귀속부서</th>
                  <th className="py-2.5 px-3 text-center w-24">처리자</th>
                  <th className="py-2.5 px-4">사유 및 상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 font-sans text-zinc-650">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-zinc-400">
                      최근 감지 및 사용자 처리 귀속 조정 감사 이력이 존재하지 않습니다.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-zinc-400">{log.time}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.action === '추천 적용' || log.action?.includes('일괄')
                            ? 'bg-emerald-100 text-emerald-800' 
                            : log.action === '수동 변경' 
                            ? 'bg-blue-100 text-blue-800' 
                            : log.action === '원복' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-zinc-100 text-zinc-650'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span className="font-mono bg-zinc-50 border px-1 rounded mr-2 text-zinc-500">
                          {log.accountCode}
                        </span>
                        {log.accountName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-zinc-600">{log.originalDeptName}</td>
                      <td className="py-2.5 px-3 text-zinc-500">
                        {log.beforeAttributedDeptName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900">
                        {log.afterAttributedDeptName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-zinc-550 font-medium">{log.user}</td>
                      <td className="py-2.5 px-4 font-mono text-zinc-500 max-w-[200px] truncate" title={log.reason}>
                        {log.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
