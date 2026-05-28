import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey } from '../lib/storageKeys';
import { usePermission } from '../lib/permissions';
import { 
  recommendAttributionForRow, 
  getAttributionExcludeResult,
  AttributionRecommendation, 
  AttributionAuditLog 
} from '../lib/deptAttributionRecommender';
import {
  classifyAccount,
  getAccountingType,
  ACCOUNT_CLASS_OPTIONS,
  ACCOUNTING_TYPE_OPTIONS,
} from '../lib/accountClassification';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T extends string> {
  key: T;
  direction: SortDirection;
}

type RecommendationSortKey =
  | 'period'
  | 'accountCode'
  | 'accountName'
  | 'originalDept'
  | 'currentDept'
  | 'recommendedDept'
  | 'amount'
  | 'status';

type ManualSortKey =
  | 'period'
  | 'accountCode'
  | 'accountName'
  | 'originalDept'
  | 'currentDept'
  | 'amount'
  | 'status';

function parsePeriodValue(value: unknown): number {
  const text = String(value ?? '').trim();
  const match = text.match(/(\d{1,2})/);
  if (match) return Number(match[1]);
  return 999;
}

function parseMillionAmount(value: string): number | null {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n * 1_000_000 : null;
}

function getAttributionState(row: any) {
  if (!row.attributedDeptCode) return '원 사용처 기준';
  if (row.attributionSource === 'manual') return '수동 변경';
  if (row.attributionSource === 'recommendation') return '추천 적용';
  return '귀속 변경';
}

function SortIcon<T extends string>({
  sort,
  columnKey,
}: {
  sort: SortConfig<T> | null;
  columnKey: T;
}) {
  if (!sort || sort.key !== columnKey) {
    return <span className="ml-1 text-zinc-300">↕</span>;
  }

  return (
    <span className="ml-1 text-[#008f83]">
      {sort.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function SortableFilterHeader<T extends string>({
  title,
  columnKey,
  sort,
  onSort,
  filterValue,
  onFilterChange,
  filterType = 'text',
  options = [],
  align = 'left',
}: {
  title: string;
  columnKey: T;
  sort: SortConfig<T> | null;
  onSort: (key: T) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterType?: 'text' | 'select' | 'none';
  options?: Array<{ value: string; label: string }>;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 min-w-0 w-full h-full justify-between">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={[
          'flex items-center gap-0.5 text-[10.5px] font-bold text-zinc-500 hover:text-zinc-900 w-full cursor-pointer select-none',
          align === 'right' ? 'justify-end text-right' : '',
          align === 'center' ? 'justify-center text-center' : '',
          align === 'left' ? 'justify-start text-left' : '',
        ].join(' ')}
      >
        <span className="truncate">{title}</span>
        <SortIcon sort={sort} columnKey={columnKey} />
      </button>

      {filterType === 'text' && onFilterChange && (
        <input
          value={filterValue || ''}
          onChange={(e) => onFilterChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="필터"
          className="h-6 w-full rounded border border-zinc-200 bg-white px-1.5 text-[10px] outline-none focus:border-[#008f83] font-normal text-zinc-800"
        />
      )}

      {filterType === 'select' && onFilterChange && (
        <select
          value={filterValue || ''}
          onChange={(e) => onFilterChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-full rounded border border-zinc-200 bg-white px-1 text-[10px] outline-none focus:border-[#008f83] font-medium text-zinc-700"
        >
          <option value="">전체</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function AmountRangeHeader<T extends string>({
  title,
  columnKey,
  sort,
  onSort,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  title: string;
  columnKey: T;
  sort: SortConfig<T> | null;
  onSort: (key: T) => void;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 min-w-0 w-full h-full justify-between">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="flex items-center justify-end gap-0.5 text-[10.5px] font-bold text-zinc-500 hover:text-zinc-900 w-full cursor-pointer select-none"
      >
        <span className="truncate">{title}</span>
        <SortIcon sort={sort} columnKey={columnKey} />
      </button>

      <div className="flex gap-1">
        <input
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="이상(백만)"
          inputMode="numeric"
          className="h-6 w-1/2 rounded border border-zinc-200 px-1 text-[10px] text-right outline-none focus:border-[#008f83] font-normal text-zinc-800"
        />
        <input
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="이하(백만)"
          inputMode="numeric"
          className="h-6 w-1/2 rounded border border-zinc-200 px-1 text-[10px] text-right outline-none focus:border-[#008f83] font-normal text-zinc-800"
        />
      </div>
    </div>
  );
}

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

const DEFAULT_ATTRIBUTION_COL_WIDTHS = {
  select: 44,
  period: 64,
  accountCode: 120,
  accountName: 300,
  originalDept: 220,
  currentDept: 230,
  recommendedDept: 230,
  amount: 120,
  status: 90,
  actions: 120,
};

type AttributionColumnKey = keyof typeof DEFAULT_ATTRIBUTION_COL_WIDTHS;

const ATTRIBUTION_COL_WIDTHS_KEY = 'hycm_attribution_column_widths';

export default function DepartmentAssignment() {
  const navigate = useNavigate();
  const { currentUser } = usePermission();

  // Filter States
  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState<'경영계획' | '수정경영계획' | '1차 RP' | '2차 RP'>('경영계획');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [monthMode, setMonthMode] = useState<'SINGLE' | 'YTD'>('YTD');
  const [selectedWriterDept, setSelectedWriterDept] = useState('all');
  const [selectedAttributedDept, setSelectedAttributedDept] = useState('all');
  const [selectedAccountingType, setSelectedAccountingType] = useState('전체');
  const [selectedAccountClass, setSelectedAccountClass] = useState('전체');
  const [selectedConfidence, setSelectedConfidence] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('대기');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExcludedAccounts, setShowExcludedAccounts] = useState(false);
  const [isRecommendationListOpen, setIsRecommendationListOpen] = useState(true);
  const [isManualGridOpen, setIsManualGridOpen] = useState(false);
  const [manualRowsLoaded, setManualRowsLoaded] = useState(false);

  const [recommendationSort, setRecommendationSort] = useState<SortConfig<RecommendationSortKey> | null>(null);
  const [manualSort, setManualSort] = useState<SortConfig<ManualSortKey> | null>(null);

  const [recommendationColumnFilters, setRecommendationColumnFilters] = useState({
    period: '',
    accountCode: '',
    accountName: '',
    originalDept: '',
    currentDept: '',
    recommendedDept: '',
    amountMin: '',
    amountMax: '',
    status: '',
  });

  const [manualColumnFilters, setManualColumnFilters] = useState({
    period: '',
    accountCode: '',
    accountName: '',
    originalDept: '',
    currentDept: '',
    amountMin: '',
    amountMax: '',
    status: '',
  });

  const [manualVisibleCount, setManualVisibleCount] = useState(100);
  const [recVisibleCount, setRecVisibleCount] = useState(100);

  function toggleSort<T extends string>(
    key: T,
    setSort: React.Dispatch<React.SetStateAction<SortConfig<T> | null>>
  ) {
    setSort(prev => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  // Loaded Raw Data States
  const [actualRowsList, setActualRowsList] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Selected Row for Details (Master-Detail)
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [editingAttributionRowId, setEditingAttributionRowId] = useState<string | number | null>(null);
  const [draftAttributedDeptCode, setDraftAttributedDeptCode] = useState('');

  const [columnWidths, setColumnWidths] = useState<Record<AttributionColumnKey, number>>(() => {
    try {
      const saved = localStorage.getItem(ATTRIBUTION_COL_WIDTHS_KEY);
      return saved
        ? { ...DEFAULT_ATTRIBUTION_COL_WIDTHS, ...JSON.parse(saved) }
        : DEFAULT_ATTRIBUTION_COL_WIDTHS;
    } catch {
      return DEFAULT_ATTRIBUTION_COL_WIDTHS;
    }
  });

  useEffect(() => {
    localStorage.setItem(ATTRIBUTION_COL_WIDTHS_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

  const MIN_ATTRIBUTION_COL_WIDTHS: Record<AttributionColumnKey, number> = {
    select: 40,
    period: 52,
    accountCode: 90,
    accountName: 140,
    originalDept: 120,
    currentDept: 130,
    recommendedDept: 130,
    amount: 90,
    status: 70,
    actions: 90,
  };

  function resizeColumn(key: AttributionColumnKey, nextWidth: number) {
    setColumnWidths(prev => ({
      ...prev,
      [key]: Math.max(MIN_ATTRIBUTION_COL_WIDTHS[key], Math.min(nextWidth, 640)),
    }));
  }
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  function handleSelectDetailRow(rowId: string | number) {
    setSelectedRowId(prev => {
      const next = prev === rowId ? null : rowId;

      if (next !== null) {
        setTimeout(() => {
          rowRefs.current[String(rowId)]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }, 0);
      }

      return next;
    });
  }

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

  const viewableDepts = useMemo(() => {
    if (!currentUser) return [];
    if (['99999', '32100'].includes(currentUser.code)) return getAllDepartments();
    return getViewableDepts(currentUser.code);
  }, [currentUser]);

  // Budget Rows cache to score recommendations
  const budgetRowsByDept = useMemo(() => {
    const map = new Map<string, any[]>();
    allDepts.forEach(d => {
      const bKey = getBudgetDataKey(d.code, year, planType);
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
  }, [allDepts, year, planType]);

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
    if (!currentUser) return [];

    const isFinanceOrAdmin = ['99999', '32100'].includes(currentUser.code);
    const recDepts = isFinanceOrAdmin ? allDepts : viewableDepts;

    actualRowsList.forEach((row: any) => {
      // 권한 부서 필터링 (사용자별 조회 가능 부서에 해당하는 실적만 대상으로 삼음)
      const isViewable = viewableDepts.some(d => d.code === row.usageCode || (row.attributedDeptCode && d.code === row.attributedDeptCode));
      if (!isViewable) return;

      const rec = recommendAttributionForRow({
        row,
        year,
        planType,
        monthMode: monthMode === 'SINGLE' ? 'MONTH' : 'YTD',
        selectedMonth: selectedMonth === 'all' ? 12 : Number(selectedMonth),
        departments: recDepts,
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
  }, [actualRowsList, year, allDepts, viewableDepts, planType, monthMode, selectedMonth, budgetRowsByDept, overrides, excludedRowIds, currentUser]);

  // Apply UI Filters
  const filteredRecommendationRows = useMemo(() => {
    return allRecommendationRows.filter(item => {
      const effectiveCurrentDeptCode =
        item.currentAttributedDeptCode || item.originalDeptCode;

      if (!item.recommendedDeptCode) return false;
      if (item.recommendedDeptCode === effectiveCurrentDeptCode) return false;

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

      // Accounting Type & Account Class Filter (회계 구분, 비용 성격)
      const accountingType = getAccountingType(item.accountCode, item.accountName);
      const accountClass = classifyAccount(item.accountCode, item.accountName);

      if (selectedAccountingType !== '전체' && accountingType !== selectedAccountingType) return false;
      if (selectedAccountClass !== '전체' && accountClass !== selectedAccountClass) return false;

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
  }, [allRecommendationRows, selectedMonth, monthMode, selectedWriterDept, selectedAttributedDept, selectedAccountingType, selectedAccountClass, selectedConfidence, selectedStatus, searchQuery]);

  // Combined Column Filters and Sort for Recommendation Grid
  const filteredAndSortedRecommendationRows = useMemo(() => {
    let rows = [...filteredRecommendationRows];

    const f = recommendationColumnFilters;

    rows = rows.filter(row => {
      if (f.period && !String(row.period).includes(f.period)) return false;
      if (f.accountCode && !row.accountCode.toLowerCase().includes(f.accountCode.toLowerCase())) return false;
      if (f.accountName && !row.accountName.toLowerCase().includes(f.accountName.toLowerCase())) return false;

      const originalDeptText = `[${row.originalDeptCode}] ${row.originalDeptName}`;
      if (f.originalDept && !originalDeptText.toLowerCase().includes(f.originalDept.toLowerCase())) return false;

      const currentDeptText = row.currentAttributedDeptCode
        ? `[${row.currentAttributedDeptCode}] ${row.currentAttributedDeptName}`
        : '원 사용처 기준';

      if (f.currentDept && !currentDeptText.toLowerCase().includes(f.currentDept.toLowerCase())) return false;

      const recommendedDeptText = row.recommendedDeptCode
        ? `[${row.recommendedDeptCode}] ${row.recommendedDeptName}`
        : '';

      if (f.recommendedDept && !recommendedDeptText.toLowerCase().includes(f.recommendedDept.toLowerCase())) return false;

      const minAmount = parseMillionAmount(f.amountMin);
      const maxAmount = parseMillionAmount(f.amountMax);

      if (minAmount !== null && row.amount < minAmount) return false;
      if (maxAmount !== null && row.amount > maxAmount) return false;

      if (f.status && row.status !== f.status) return false;

      return true;
    });

    if (recommendationSort) {
      rows.sort((a, b) => {
        const key = recommendationSort.key;

        let aValue: string | number = '';
        let bValue: string | number = '';

        if (key === 'period') {
          aValue = parsePeriodValue(a.period);
          bValue = parsePeriodValue(b.period);
        } else if (key === 'amount') {
          aValue = a.amount || 0;
          bValue = b.amount || 0;
        } else if (key === 'originalDept') {
          aValue = `${a.originalDeptCode} ${a.originalDeptName}`;
          bValue = `${b.originalDeptCode} ${b.originalDeptName}`;
        } else if (key === 'currentDept') {
          aValue = `${a.currentAttributedDeptCode || a.originalDeptCode} ${a.currentAttributedDeptName || a.originalDeptName}`;
          bValue = `${b.currentAttributedDeptCode || b.originalDeptCode} ${b.currentAttributedDeptName || b.originalDeptName}`;
        } else if (key === 'recommendedDept') {
          aValue = `${a.recommendedDeptCode || ''} ${a.recommendedDeptName || ''}`;
          bValue = `${b.recommendedDeptCode || ''} ${b.recommendedDeptName || ''}`;
        } else {
          aValue = String(a[key] ?? '');
          bValue = String(b[key] ?? '');
        }

        const result =
          typeof aValue === 'number' && typeof bValue === 'number'
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), 'ko-KR', {
                numeric: true,
                sensitivity: 'base',
              });

        return recommendationSort.direction === 'asc' ? result : -result;
      });
    }

    return rows;
  }, [filteredRecommendationRows, recommendationColumnFilters, recommendationSort]);

  const visibleRecommendationRows = useMemo(() => {
    return filteredAndSortedRecommendationRows.slice(0, recVisibleCount);
  }, [filteredAndSortedRecommendationRows, recVisibleCount]);

  // Excluded Rows construction
  const excludedRecommendationRows = useMemo(() => {
    if (!showExcludedAccounts) return [];
    
    const result: any[] = [];
    actualRowsList.forEach((row: any) => {
      // 권한 부서 필터링 (사용자별 조회 가능 부서에 해당하는 실적만 대상으로 삼음)
      const isViewable = viewableDepts.some(d => d.code === row.usageCode || (row.attributedDeptCode && d.code === row.attributedDeptCode));
      if (!isViewable) return;

      const excludeResult = getAttributionExcludeResult(row.accountCode, row.accountName);
      if (excludeResult.excluded) {
        // Apply Month filter
        if (selectedMonth !== 'all') {
          const monthIndex = getPeriodMonthIndex(row.period || row.month);
          if (monthMode === 'YTD') {
            if (monthIndex > Number(selectedMonth)) return;
          } else {
            if (monthIndex !== Number(selectedMonth)) return;
          }
        }

        // Original Dept filter
        if (selectedWriterDept !== 'all' && row.usageCode !== selectedWriterDept) return;

        // Search Query filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const codeMatch = row.accountCode.includes(query);
          const nameMatch = row.accountName.toLowerCase().includes(query);
          const origCodeMatch = row.usageCode.includes(query);

          if (!codeMatch && !nameMatch && !origCodeMatch) {
            return;
          }
        }

        result.push({
          rowId: row.id,
          period: row.period || row.month || '12월',
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptCode: row.usageCode,
          originalDeptName: row.usageDept || row.usageCode,
          amount: Number(row.completed || row.amount || 0),
          excludeReason: excludeResult.label,
          matchedKeyword: excludeResult.matchedKeyword,
        });
      }
    });

    return result;
  }, [actualRowsList, viewableDepts, showExcludedAccounts, selectedMonth, monthMode, selectedWriterDept, searchQuery]);

  // Selected Detail Row reference
  const activeDetailRow = useMemo(() => {
    if (selectedRowId === null) return null;
    return allRecommendationRows.find(r => r.rowId === selectedRowId) || null;
  }, [allRecommendationRows, selectedRowId]);

  // Filter for manual selection list (independent of wait status or recommendations)
  const filteredActualRowsForManualGrid = useMemo(() => {
    return actualRowsList.filter((row: any) => {
      const isViewable = viewableDepts.some(d => d.code === row.usageCode || (row.attributedDeptCode && d.code === row.attributedDeptCode));
      if (!isViewable) return false;

      if (selectedMonth !== 'all') {
        const monthIndex = getPeriodMonthIndex(row.period);
        if (monthMode === 'YTD') {
          if (monthIndex > Number(selectedMonth)) return false;
        } else {
          if (monthIndex !== Number(selectedMonth)) return false;
        }
      }

      if (selectedWriterDept !== 'all' && row.usageCode !== selectedWriterDept) {
        return false;
      }

      if (selectedAttributedDept !== 'all') {
        const effectiveDept = row.attributedDeptCode || row.usageCode;
        if (effectiveDept !== selectedAttributedDept) return false;
      }

      const accountingType = getAccountingType(row.accountCode, row.accountName);
      const accountClass = classifyAccount(row.accountCode, row.accountName);

      if (selectedAccountingType !== '전체' && accountingType !== selectedAccountingType) return false;
      if (selectedAccountClass !== '전체' && accountClass !== selectedAccountClass) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const codeMatch = (row.accountCode || '').includes(query);
        const nameMatch = (row.accountName || '').toLowerCase().includes(query);
        const origCodeMatch = (row.usageCode || '').includes(query);
        const origNameMatch = (row.usageDept || '').toLowerCase().includes(query);
        const attrCodeMatch = (row.attributedDeptCode || '').includes(query);
        const attrNameMatch = (row.attributedDeptName || '').toLowerCase().includes(query);

        if (!codeMatch && !nameMatch && !origCodeMatch && !origNameMatch && !attrCodeMatch && !attrNameMatch) {
          return false;
        }
      }

      return true;
    });
  }, [actualRowsList, viewableDepts, selectedMonth, monthMode, selectedWriterDept, selectedAttributedDept, selectedAccountingType, selectedAccountClass, searchQuery]);

  // Lazy-load mapping of manual rows: mapped only when manualRowsLoaded is true
  const manualRows = useMemo(() => {
    if (!manualRowsLoaded) return [];

    return filteredActualRowsForManualGrid.map((row: any) => {
      const effectiveDeptCode = row.attributedDeptCode || row.usageCode;
      const effectiveDeptName = row.attributedDeptName || row.usageDept || row.usageCode;

      return {
        rowId: row.id,
        period: row.period || row.month || '12월',
        accountCode: row.accountCode,
        accountName: row.accountName,
        originalDeptCode: row.usageCode,
        originalDeptName: row.usageDept || row.usageCode,
        currentDeptCode: effectiveDeptCode,
        currentDeptName: effectiveDeptName,
        amount: Number(row.completed || row.amount || 0),
        attributionSource: row.attributionSource || 'original',
        status: getAttributionState(row),
      };
    });
  }, [manualRowsLoaded, filteredActualRowsForManualGrid]);

  // Combined Column Filters and Sort for Manual Direct Correction Grid
  const filteredAndSortedManualRows = useMemo(() => {
    if (!manualRowsLoaded) return [];

    let rows = [...manualRows];

    const f = manualColumnFilters;

    rows = rows.filter(row => {
      if (f.period && !String(row.period).includes(f.period)) return false;
      if (f.accountCode && !row.accountCode.toLowerCase().includes(f.accountCode.toLowerCase())) return false;
      if (f.accountName && !row.accountName.toLowerCase().includes(f.accountName.toLowerCase())) return false;

      const originalDeptText = `[${row.originalDeptCode}] ${row.originalDeptName}`;
      if (f.originalDept && !originalDeptText.toLowerCase().includes(f.originalDept.toLowerCase())) return false;

      const currentDeptText = `[${row.currentDeptCode}] ${row.currentDeptName}`;
      if (f.currentDept && !currentDeptText.toLowerCase().includes(f.currentDept.toLowerCase())) return false;

      const minAmount = parseMillionAmount(f.amountMin);
      const maxAmount = parseMillionAmount(f.amountMax);

      if (minAmount !== null && row.amount < minAmount) return false;
      if (maxAmount !== null && row.amount > maxAmount) return false;

      if (f.status && row.status !== f.status) return false;

      return true;
    });

    if (manualSort) {
      rows.sort((a, b) => {
        const key = manualSort.key;

        let aValue: string | number = '';
        let bValue: string | number = '';

        if (key === 'period') {
          aValue = parsePeriodValue(a.period);
          bValue = parsePeriodValue(b.period);
        } else if (key === 'amount') {
          aValue = a.amount || 0;
          bValue = b.amount || 0;
        } else if (key === 'originalDept') {
          aValue = `${a.originalDeptCode} ${a.originalDeptName}`;
          bValue = `${b.originalDeptCode} ${b.originalDeptName}`;
        } else if (key === 'currentDept') {
          aValue = `${a.currentDeptCode} ${a.currentDeptName}`;
          bValue = `${b.currentDeptCode} ${b.currentDeptName}`;
        } else {
          aValue = String(a[key] ?? '');
          bValue = String(b[key] ?? '');
        }

        const result =
          typeof aValue === 'number' && typeof bValue === 'number'
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), 'ko-KR', {
                numeric: true,
                sensitivity: 'base',
              });

        return manualSort.direction === 'asc' ? result : -result;
      });
    }

    return rows;
  }, [manualRowsLoaded, manualRows, manualColumnFilters, manualSort]);

  const visibleManualRows = useMemo(() => {
    return filteredAndSortedManualRows.slice(0, manualVisibleCount);
  }, [filteredAndSortedManualRows, manualVisibleCount]);

  // Dynamic Statistics Counters
  const stats = useMemo(() => {
    const actionableCount = allRecommendationRows.filter(row => {
      const effectiveCurrentDeptCode = row.currentAttributedDeptCode || row.originalDeptCode;
      return row.recommendedDeptCode && row.recommendedDeptCode !== effectiveCurrentDeptCode && row.status === '대기';
    }).length;

    const totalActualsCount = actualRowsList.length;
    const appliedCount = actualRowsList.filter(row => row.attributedDeptCode).length;
    const ignoredCount = excludedRowIds.size;

    const highConfidenceCount = allRecommendationRows.filter(row => {
      const effectiveCurrentDeptCode = row.currentAttributedDeptCode || row.originalDeptCode;
      return row.recommendedDeptCode && row.recommendedDeptCode !== effectiveCurrentDeptCode && row.status === '대기' && row.confidence === 'HIGH';
    }).length;

    return {
      totalPending: actionableCount,
      allActuals: totalActualsCount,
      applied: appliedCount,
      ignored: ignoredCount,
      highConfidence: highConfidenceCount,
    };
  }, [allRecommendationRows, actualRowsList, excludedRowIds]);

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
        reasons: ['추천 무시'],
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
    const highPending = allRecommendationRows.filter(r => {
      const effectiveCurrentDeptCode = r.currentAttributedDeptCode || r.originalDeptCode;
      return r.status === '대기' && r.confidence === 'HIGH' && r.recommendedDeptCode && r.recommendedDeptCode !== effectiveCurrentDeptCode;
    });
    if (highPending.length === 0) {
      alert('권장 항목 일괄 적용 대상이 없습니다.');
      return;
    }

    if (!window.confirm(`권장 항목 ${highPending.length}건을 추천 귀속부서로 적용하시겠습니까?`)) {
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
      text: `총 ${updateCount}건에 대해 실적 귀속부서 일괄 적용했습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Bulk Action Applied Selected
  const handleApplySelectedRows = () => {
    if (selectedRowIds.size === 0) {
      alert('선택한 항목이 없습니다.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      alert('선택한 항목 중 적용 가능한 추천 건이 없습니다.');
      return;
    }

    if (!window.confirm(`선택한 ${targets.length}건을 추천 귀속부서로 적용하시겠습니까?`)) {
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
      text: `선택하신 ${count}건에 대해 실적 귀속부서를 적용했습니다.`
    });
    setSelectedRowIds(new Set());
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Bulk Action Ignore Selected
  const handleIgnoreSelectedRows = () => {
    if (selectedRowIds.size === 0) {
      alert('선택한 항목이 없습니다.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      alert('선택한 항목 중 무시 처리 가능한 추천 건이 없습니다.');
      return;
    }

    if (!window.confirm(`선택한 ${targets.length}건을 추천 귀속에서 제외하시겠습니까?`)) {
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
      text: `${targets.length}건의 항목이 추천 무시 처리되었습니다.`
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
    setPlanType('경영계획');
    setSelectedMonth('all');
    setMonthMode('YTD');
    setSelectedWriterDept('all');
    setSelectedAttributedDept('all');
    setSelectedAccountingType('전체');
    setSelectedAccountClass('전체');
    setSelectedConfidence('all');
    setSelectedStatus('대기');
    setSearchQuery('');
    setShowExcludedAccounts(false);
  };

  if (viewableDepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[440px] border border-zinc-200 rounded-xl bg-zinc-50 p-8 text-center font-sans gap-3">
        <AlertCircle className="w-10 h-10 text-zinc-400" />
        <h3 className="text-base font-bold text-zinc-800">조회 가능한 실적 귀속 데이터가 없습니다.</h3>
        <p className="text-xs text-zinc-500 max-w-sm">소속 부서 또는 권한 설정을 확인해주세요.</p>
      </div>
    );
  }

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
          <span className="text-[11px] font-bold text-zinc-400 uppercase">전체 실적</span>
          <span className="text-xl font-black text-zinc-800">{stats.allActuals}건</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-zinc-250 md:pl-4">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">보정 적용됨</span>
          <span className="text-xl font-black text-[#008f83]">{stats.applied}건</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-zinc-250 md:pl-4">
          <span className="text-[11px] font-bold text-zinc-400 uppercase">무시됨</span>
          <span className="text-xl font-black text-zinc-500">{stats.ignored}건</span>
        </div>
      </div>

      {/* 3. Filter Controls Panel */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl flex flex-col gap-3.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-450" />
          상세 필터 조정
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-2.5">
          {/* Plan Type (계획 구분) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">계획 구분</span>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value as any)}
              className="px-2 py-1 text-xs border border-[#008f83] rounded bg-white font-medium text-zinc-800"
            >
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
          </div>

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
              <option value="all">전체 누계</option>
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
              {(['99999', '32100'].includes(currentUser?.code || '') ? allDepts : viewableDepts).map(d => (
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
              {(['99999', '32100'].includes(currentUser?.code || '') ? allDepts : viewableDepts).map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Accounting Type (회계 구분) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">회계 구분</span>
            <select
              value={selectedAccountingType}
              onChange={(e) => setSelectedAccountingType(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="전체">전체</option>
              {ACCOUNTING_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Account Class (비용 성격) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">비용 성격</span>
            <select
              value={selectedAccountClass}
              onChange={(e) => setSelectedAccountClass(e.target.value)}
              className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white font-medium"
            >
              <option value="전체">전체</option>
              {ACCOUNT_CLASS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
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
              <option value="HIGH">높음</option>
              <option value="MEDIUM">중간</option>
              <option value="LOW">낮음</option>
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
              <option value="all">전체</option>
              <option value="대기">대기</option>
              <option value="적용됨">적용됨</option>
              <option value="무시됨">무시됨</option>
              <option value="수동 변경">수동 변경</option>
            </select>
          </div>

          {/* Text Search */}
          <div className="flex flex-col gap-1 lg:col-span-1">
            <span className="text-[10px] font-bold text-zinc-400">검색</span>
            <div className="relative">
              <input
                type="text"
                placeholder="계정코드, 계정명, 부서, 사유 검색"
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
          <div className="flex items-center gap-4">
            <button 
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 transition font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 필터 초기화
            </button>
            <span className="text-zinc-300">|</span>
            <button
              type="button"
              onClick={() => {
                setColumnWidths(DEFAULT_ATTRIBUTION_COL_WIDTHS);
                localStorage.removeItem(ATTRIBUTION_COL_WIDTHS_KEY);
              }}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 transition font-bold cursor-pointer"
            >
              컬럼 너비 초기화
            </button>
            <span className="text-zinc-300">|</span>
            <label className="flex items-center gap-1.5 text-[11px] text-[#008f83] hover:text-[#00746b] transition font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showExcludedAccounts}
                onChange={(e) => setShowExcludedAccounts(e.target.checked)}
                className="rounded accent-[#008f83] cursor-pointer"
              />
              추천 제외 계정 보기
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApplyHighConfidence}
              disabled={stats.highConfidence === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold text-white transition-all select-none ${
                stats.highConfidence > 0 ? 'bg-[#008f83] hover:bg-[#00746b] cursor-pointer' : 'bg-zinc-300 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              권장 항목 일괄 적용 ({stats.highConfidence}건)
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

      {/* 4. Main Contents Area: Full width table representation with inline detail rows */}
      <div className="flex flex-col gap-4">
        
        {/* Table list is full width */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700">귀속 추천 목록</span>
            <div className="flex items-center gap-2.5">
              <span className="text-[11.5px] font-mono text-zinc-500">
                조회 결과: <strong>{filteredAndSortedRecommendationRows.length}</strong>건 / 전체 {allRecommendationRows.length}건
              </span>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={() => {
                  setRecommendationColumnFilters({
                    period: '',
                    accountCode: '',
                    accountName: '',
                    originalDept: '',
                    currentDept: '',
                    recommendedDept: '',
                    amountMin: '',
                    amountMax: '',
                    status: '',
                  });
                  setRecommendationSort(null);
                }}
                className="text-[11px] font-bold text-[#008f83] hover:underline cursor-pointer select-none"
              >
                목록 필터 초기화
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={() => setIsRecommendationListOpen(prev => !prev)}
                className="text-xs font-bold text-[#008f83] hover:underline cursor-pointer select-none"
              >
                {isRecommendationListOpen ? '접기 ▲' : '펼치기 ▼'}
              </button>
            </div>
          </div>

          {isRecommendationListOpen && (
            <>
              <div className="overflow-x-auto">
              <table
                className="table-fixed border-collapse text-xs text-left"
                style={{
                  width: (Object.keys(columnWidths) as AttributionColumnKey[]).reduce((sum, key) => sum + columnWidths[key], 0),
                  minWidth: (Object.keys(columnWidths) as AttributionColumnKey[]).reduce((sum, key) => sum + columnWidths[key], 0)
                }}
              >
                <colgroup>
                  <col style={{ width: columnWidths.select }} />
                  <col style={{ width: columnWidths.period }} />
                  <col style={{ width: columnWidths.accountCode }} />
                  <col style={{ width: columnWidths.accountName }} />
                  <col style={{ width: columnWidths.originalDept }} />
                  <col style={{ width: columnWidths.currentDept }} />
                  <col style={{ width: columnWidths.recommendedDept }} />
                  <col style={{ width: columnWidths.amount }} />
                  <col style={{ width: columnWidths.status }} />
                  <col style={{ width: columnWidths.actions }} />
                </colgroup>
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-250 text-zinc-450 font-bold text-[10.5px] select-none h-[64px]">
                    <th className="p-0 text-center">
                      <ResizableAttributionHeader
                        title={
                          <div className="flex h-full items-center justify-center">
                            <input 
                              type="checkbox"
                              checked={
                                filteredAndSortedRecommendationRows.length > 0 &&
                                filteredAndSortedRecommendationRows.filter(r => r.status === '대기').every(r => selectedRowIds.has(r.rowId))
                              }
                              onChange={handleToggleAllSelect}
                              className="rounded accent-[#008f83] cursor-pointer"
                            />
                          </div>
                        }
                        columnKey="select"
                        align="center"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="기간"
                            columnKey="period"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.period}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, period: value }))
                            }
                            align="center"
                          />
                        }
                        columnKey="period"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="계정코드"
                            columnKey="accountCode"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.accountCode}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, accountCode: value }))
                            }
                          />
                        }
                        columnKey="accountCode"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="계정명"
                            columnKey="accountName"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.accountName}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, accountName: value }))
                            }
                          />
                        }
                        columnKey="accountName"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="원 사용처"
                            columnKey="originalDept"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.originalDept}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, originalDept: value }))
                            }
                          />
                        }
                        columnKey="originalDept"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="현재 귀속부서"
                            columnKey="currentDept"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.currentDept}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, currentDept: value }))
                            }
                          />
                        }
                        columnKey="currentDept"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="추천 귀속부서"
                            columnKey="recommendedDept"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.recommendedDept}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, recommendedDept: value }))
                            }
                          />
                        }
                        columnKey="recommendedDept"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <AmountRangeHeader
                            title="실적 금액"
                            columnKey="amount"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            minValue={recommendationColumnFilters.amountMin}
                            maxValue={recommendationColumnFilters.amountMax}
                            onMinChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, amountMin: value }))
                            }
                            onMaxChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, amountMax: value }))
                            }
                          />
                        }
                        columnKey="amount"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title={
                          <SortableFilterHeader
                            title="상태"
                            columnKey="status"
                            sort={recommendationSort}
                            onSort={(key) => toggleSort(key, setRecommendationSort)}
                            filterValue={recommendationColumnFilters.status}
                            onFilterChange={(value) =>
                              setRecommendationColumnFilters(prev => ({ ...prev, status: value }))
                            }
                            filterType="select"
                            options={[
                              { value: '대기', label: '대기' },
                              { value: '적용됨', label: '적용됨' },
                              { value: '무시됨', label: '무시됨' },
                              { value: '수동 변경', label: '수동 변경' },
                            ]}
                            align="center"
                          />
                        }
                        columnKey="status"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                    <th className="p-0">
                      <ResizableAttributionHeader
                        title="작업"
                        columnKey="actions"
                        align="center"
                        columnWidths={columnWidths}
                        onResize={resizeColumn}
                      />
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-zinc-150 font-sans">
                {filteredAndSortedRecommendationRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-zinc-400">
                      지정된 조건에 부합하는 귀속 추천 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  visibleRecommendationRows.map(item => {
                    const isSelected = selectedRowId === item.rowId;
                    const isChecked = selectedRowIds.has(item.rowId);

                    return (
                      <React.Fragment key={item.rowId}>
                        <tr 
                          ref={(el) => {
                            rowRefs.current[String(item.rowId)] = el;
                          }}
                          onClick={() => {
                            setEditingAttributionRowId(null);
                            setDraftAttributedDeptCode('');
                            handleSelectDetailRow(item.rowId);
                          }}
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
                          <td className="py-3 px-3">
                            <span className="block truncate font-bold text-zinc-900" title={item.accountName}>
                              {item.accountName}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="block truncate text-zinc-600" title={`[${item.originalDeptCode}] ${item.originalDeptName}`}>
                              [{item.originalDeptCode}] {item.originalDeptName}
                            </span>
                          </td>
                          <td
                            className="py-3 px-3"
                            onClick={(e) => {
                              e.stopPropagation();

                              setSelectedRowId(null);

                              setEditingAttributionRowId(prev => {
                                const next = prev === item.rowId ? null : item.rowId;

                                if (next !== null) {
                                  setDraftAttributedDeptCode(
                                    item.currentAttributedDeptCode ||
                                    item.originalDeptCode ||
                                    ''
                                  );
                                }

                                return next;
                              });
                            }}
                          >
                            {editingAttributionRowId === item.rowId ? (
                              <div className="min-w-[220px] rounded-lg border border-[#008f83]/30 bg-white p-2 shadow-sm">
                                <div className="mb-1 text-[10px] font-bold text-zinc-500">
                                  현재 귀속부서 변경
                                </div>

                                <select
                                  value={draftAttributedDeptCode}
                                  onChange={(e) => setDraftAttributedDeptCode(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium outline-none focus:border-[#008f83]"
                                >
                                  <option value={item.originalDeptCode}>
                                    원 사용처 기준 [{item.originalDeptCode}] {item.originalDeptName}
                                  </option>

                                  {allDepts.map(dept => (
                                    <option key={dept.code} value={dept.code}>
                                      [{dept.code}] {dept.name}
                                    </option>
                                  ))}
                                </select>

                                <div className="mt-2 flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAttributionRowId(null);
                                      setDraftAttributedDeptCode('');
                                    }}
                                    className="rounded border border-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                                  >
                                    취소
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();

                                      if (!draftAttributedDeptCode) return;

                                      if (draftAttributedDeptCode === item.originalDeptCode) {
                                        handleRevertAttribution(item.rowId);
                                      } else {
                                        handleApplyManualChange(item.rowId, draftAttributedDeptCode);
                                      }

                                      setEditingAttributionRowId(null);
                                      setDraftAttributedDeptCode('');
                                    }}
                                    className="rounded bg-[#008f83] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#00746b] cursor-pointer"
                                  >
                                    적용
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="group flex max-w-[160px] items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-emerald-50 cursor-pointer"
                                title="현재 귀속부서 변경"
                              >
                                {item.currentAttributedDeptCode ? (
                                  <span className="block truncate font-semibold text-[#008f83]">
                                    [{item.currentAttributedDeptCode}] {item.currentAttributedDeptName}
                                  </span>
                                ) : (
                                  <span className="font-medium text-zinc-400">
                                    원 사용처 기준
                                  </span>
                                )}

                                <span className="text-[10px] text-zinc-300 group-hover:text-[#008f83] shrink-0">
                                  변경
                                </span>
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {item.recommendedDeptCode ? (
                              <button
                                type="button"
                                className="block truncate text-left font-bold text-[#008f83] hover:underline cursor-pointer"
                                title="귀속 추천 상세 보기"
                              >
                                [{item.recommendedDeptCode}] {item.recommendedDeptName}
                              </button>
                            ) : (
                              <span className="text-zinc-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-zinc-800" title={`${item.amount.toLocaleString()}원`}>
                            {formatMillionWon(item.amount)}
                          </td>

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
                                    className="px-1.5 py-0.5 bg-zinc-150 border border-zinc-200 hover:bg-zinc-200 text-zinc-650 rounded font-bold transition text-[10px] select-none cursor-pointer"
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
                                  className="px-1.5 py-0.5 border border-zinc-300 text-zinc-650 hover:bg-zinc-100 rounded font-semibold transition text-[10px] select-none cursor-pointer"
                                >
                                  무시취소
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className="bg-emerald-50/5 hover:bg-emerald-50/5 pointer-events-auto">
                            <td colSpan={10} className="p-0 border-t border-b border-emerald-100/50">
                              <InlineAttributionDetailRow
                                item={item}
                                allDepts={allDepts}
                                onClose={() => setSelectedRowId(null)}
                                onApply={() => handleApplyRecommendation(
                                  item.rowId, 
                                  item.recommendedDeptCode, 
                                  item.recommendedDeptName, 
                                  item.reasons.map(r => r.label), 
                                  item.score
                                )}
                                onManualChange={(deptCode) => handleApplyManualChange(item.rowId, deptCode)}
                                onRevert={() => handleRevertAttribution(item.rowId)}
                                onIgnore={() => handleIgnoreRecommendation(item.rowId)}
                                onUndoIgnore={() => handleUndoIgnore(item.rowId)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {recVisibleCount < filteredAndSortedRecommendationRows.length && (
            <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-center">
              <button
                type="button"
                onClick={() => setRecVisibleCount(prev => prev + 100)}
                className="px-4 py-2 text-xs font-bold text-[#008f83] hover:bg-emerald-50 border border-zinc-200 bg-white rounded-md shadow-xs cursor-pointer select-none"
              >
                추천 항목 100건 더 보기 (남은 건수: {filteredAndSortedRecommendationRows.length - recVisibleCount}건)
              </button>
            </div>
          )}
            </>
          )}
        </div>

      </div>

      {/* 4.5 실적 귀속부서 직접 수정 (Directly Modify Actual Department Assignment grid) */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mt-4">
        <button
          type="button"
          onClick={() => {
            setIsManualGridOpen(prev => {
              const next = !prev;
              if (next) setManualRowsLoaded(true);
              return next;
            });
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200 cursor-pointer text-left select-none"
        >
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-700">실적 귀속부서 수동 직접 보정</span>
              <span className="inline-block px-1.5 py-0.5 bg-[#008f83]/10 text-[#008f83] text-[10px] font-bold rounded">전체 실적 대상</span>
            </div>
            <span className="text-[11px] text-zinc-500">
              추천 목록에 없는 실적도 전체 실적 대상에서 직접 찾아 귀속부서를 수정 및 보정할 수 있습니다. (클릭하여 열기)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isManualGridOpen && (
              <>
                <span className="text-[11.5px] font-mono text-zinc-500">
                  필터링 결과: <strong>{filteredAndSortedManualRows.length}</strong>건 / 전체 <strong>{actualRowsList.length}</strong>건
                </span>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManualColumnFilters({
                      period: '',
                      accountCode: '',
                      accountName: '',
                      originalDept: '',
                      currentDept: '',
                      amountMin: '',
                      amountMax: '',
                      status: '',
                    });
                    setManualSort(null);
                  }}
                  className="text-[11px] font-bold text-[#008f83] hover:underline cursor-pointer select-none"
                >
                  직접 보정 필터 초기화
                </button>
                <span className="text-zinc-300">|</span>
              </>
            )}
            <span className="text-xs font-bold text-[#008f83] hover:underline">
              {isManualGridOpen ? '접기 ▲' : '펼치기 ▼'}
            </span>
          </div>
        </button>

        {isManualGridOpen && manualRowsLoaded && (
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left border-collapse text-xs min-w-[1020px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-[10.5px] select-none h-[64px]">
                  <th className="p-0 w-16">
                    <SortableFilterHeader
                      title="기간"
                      columnKey="period"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.period}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, period: value }))
                      }
                      align="center"
                    />
                  </th>
                  <th className="p-0 w-28">
                    <SortableFilterHeader
                      title="계정코드"
                      columnKey="accountCode"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.accountCode}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, accountCode: value }))
                      }
                    />
                  </th>
                  <th className="p-0 min-w-[180px]">
                    <SortableFilterHeader
                      title="계정명"
                      columnKey="accountName"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.accountName}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, accountName: value }))
                      }
                    />
                  </th>
                  <th className="p-0 min-w-[170px]">
                    <SortableFilterHeader
                      title="원 사용처 (발생부서)"
                      columnKey="originalDept"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.originalDept}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, originalDept: value }))
                      }
                    />
                  </th>
                  <th className="p-0 min-w-[180px]">
                    <SortableFilterHeader
                      title="현재 귀속부서"
                      columnKey="currentDept"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.currentDept}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, currentDept: value }))
                      }
                    />
                  </th>
                  <th className="p-2.5 px-3 w-64 text-xs font-bold text-zinc-500 text-left">
                    귀속부서 수동 지정
                  </th>
                  <th className="p-0 w-36">
                    <AmountRangeHeader
                      title="실적 금액"
                      columnKey="amount"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      minValue={manualColumnFilters.amountMin}
                      maxValue={manualColumnFilters.amountMax}
                      onMinChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, amountMin: value }))
                      }
                      onMaxChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, amountMax: value }))
                      }
                    />
                  </th>
                  <th className="p-0 w-24">
                    <SortableFilterHeader
                      title="상태"
                      columnKey="status"
                      sort={manualSort}
                      onSort={(key) => toggleSort(key, setManualSort)}
                      filterValue={manualColumnFilters.status}
                      onFilterChange={(value) =>
                        setManualColumnFilters(prev => ({ ...prev, status: value }))
                      }
                      filterType="select"
                      options={[
                        { value: '원 사용처 기준', label: '원 사용처 기준' },
                        { value: '수동 변경', label: '수동 변경' },
                        { value: '추천 적용', label: '추천 적용' },
                        { value: '귀속 변경', label: '귀속 변경' },
                      ]}
                      align="center"
                    />
                  </th>
                  <th className="p-2.5 px-3 w-20 text-center text-xs font-bold text-zinc-500">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 font-sans">
                {filteredAndSortedManualRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">
                      지정된 필터 조건에 부합하는 실적 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  visibleManualRows.map((row) => {
                    return (
                      <tr key={row.rowId} className="hover:bg-zinc-50/75 transition">
                        <td className="py-2 px-3 text-center font-mono text-zinc-500">
                          {row.period}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-zinc-700">
                          {row.accountCode}
                        </td>
                        <td className="py-2 px-3 font-bold text-zinc-900 truncate max-w-[160px]" title={row.accountName}>
                          {row.accountName}
                        </td>
                        <td className="py-2 px-3 text-zinc-650 truncate max-w-[180px]" title={`[${row.originalDeptCode}] ${row.originalDeptName}`}>
                          [{row.originalDeptCode}] {row.originalDeptName}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[180px]">
                          {row.currentDeptCode !== row.originalDeptCode ? (
                            <span className="font-bold text-[#008f83]" title={`[${row.currentDeptCode}] ${row.currentDeptName}`}>
                              [{row.currentDeptCode}] {row.currentDeptName}
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-medium font-sans">원 사용처 기준 동일</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.currentDeptCode !== row.originalDeptCode ? row.currentDeptCode : ''}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                handleRevertAttribution(row.rowId);
                              } else {
                                handleApplyManualChange(row.rowId, e.target.value);
                              }
                            }}
                            className="h-7 w-full max-w-[220px] rounded border border-zinc-200 bg-white px-1.5 text-[11px] font-medium text-zinc-700 focus:border-[#008f83] outline-none cursor-pointer"
                          >
                            <option value="">원 사용처 기준 (부서 미선택)</option>
                            {allDepts.map(dept => (
                              <option key={dept.code} value={dept.code}>
                                [{dept.code}] {dept.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-zinc-800">
                          {row.amount.toLocaleString()}원
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.status === '수동 변경'
                              ? 'bg-blue-100 text-blue-800'
                              : row.status === '추천 적용'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === '귀속 변경'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {row.currentDeptCode !== row.originalDeptCode ? (
                            <button
                              type="button"
                              onClick={() => handleRevertAttribution(row.rowId)}
                              className="px-2 py-0.5 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-900 rounded font-bold transition text-[10px] select-none cursor-pointer"
                            >
                              원복
                            </button>
                          ) : (
                            <span className="text-zinc-300 font-mono text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {isManualGridOpen && manualRowsLoaded && manualVisibleCount < filteredAndSortedManualRows.length && (
          <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-center">
            <button
              type="button"
              onClick={() => setManualVisibleCount(prev => prev + 100)}
              className="px-4 py-2 text-xs font-bold text-[#008f83] hover:bg-emerald-50 border border-zinc-200 bg-white rounded-md shadow-xs cursor-pointer select-none"
            >
              직접 보정 100건 더 보기 (남은 건수: {filteredAndSortedManualRows.length - manualVisibleCount}건)
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Excluded Accounts section */}
      {showExcludedAccounts && (
        <div className="bg-white border border-red-150 rounded-xl shadow-xs overflow-hidden mt-3 p-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between border-b border-zinc-100 pb-2.5 mb-3 gap-2">
            <h3 className="text-xs font-bold text-red-650 flex items-center gap-1.5">
              <X className="w-4 h-4 text-red-500" />
              추천 제외 대상 계정 실적 ({excludedRecommendationRows.length}건)
            </h3>
            <span className="text-[10.5px] text-zinc-500 font-medium">※ 사람, 복지, 출장, 간담회 등 오탐 방지를 위해 추천 대상에서 분류 배제된 실적입니다.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-500 font-bold text-[10.5px] select-none">
                  <th className="py-2 px-3 w-16 text-center">기간</th>
                  <th className="py-2 px-3 w-24">계정코드</th>
                  <th className="py-2 px-3 w-48">계정명</th>
                  <th className="py-2 px-3">원 사용처</th>
                  <th className="py-2 px-3 text-right w-28">실적 금액</th>
                  <th className="py-2 px-3 text-center w-36">제외 사유</th>
                  <th className="py-2 px-3 text-center w-36">매칭 키워드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-sans">
                {excludedRecommendationRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      필터에 해당하는 추천 제외 대상 실적이 없습니다.
                    </td>
                  </tr>
                ) : (
                  excludedRecommendationRows.map((item) => (
                    <tr key={item.rowId} className="hover:bg-zinc-50 transition">
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-500">{item.period}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-700">{item.accountCode}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900 truncate max-w-[180px]" title={item.accountName}>
                        {item.accountName}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-650 truncate max-w-[200px]" title={item.originalDeptName}>
                        [{item.originalDeptCode}] {item.originalDeptName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-800">
                        {item.amount.toLocaleString()}원
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 font-bold text-[10px] rounded-sm">
                          {item.excludeReason}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-1.5 py-0.5 bg-zinc-100 text-zinc-600 font-mono text-[10px] rounded">
                          {item.matchedKeyword}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



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

function ResizableAttributionHeader({
  title,
  columnKey,
  align = 'left',
  columnWidths,
  onResize,
}: {
  title: React.ReactNode;
  columnKey: AttributionColumnKey;
  align?: 'left' | 'center' | 'right';
  columnWidths: Record<AttributionColumnKey, number>;
  onResize: (key: AttributionColumnKey, width: number) => void;
}) {
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);
  const [resizing, setResizing] = React.useState(false);

  const width = columnWidths[columnKey];

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setResizing(true);
  };

  React.useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      onResize(columnKey, startWidthRef.current + diff);
    };

    const handleMouseUp = () => {
      setResizing(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, columnKey, onResize]);

  return (
    <div
      className={[
        'relative flex h-full items-center py-1 select-none w-full',
        align === 'center' ? 'justify-center text-center' : '',
        align === 'right' ? 'justify-end text-right' : '',
        align === 'left' ? 'justify-start text-left' : '',
      ].join(' ')}
      style={{ width }}
    >
      <div className="w-full h-full flex-1 min-w-0">{title}</div>

      <button
        type="button"
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#008f83]/30 z-10"
      />
    </div>
  );
}

function InlineAttributionDetailRow({
  item,
  allDepts,
  onClose,
  onApply,
  onManualChange,
  onRevert,
  onIgnore,
  onUndoIgnore,
}: {
  item: any;
  allDepts: any[];
  onClose: () => void;
  onApply: () => void;
  onManualChange: (deptCode: string) => void;
  onRevert: () => void;
  onIgnore: () => void;
  onUndoIgnore: () => void;
}) {
  const [manualDeptCode, setManualDeptCode] = useState('');

  // Confidence helper
  const getConfidenceLabel = (conf: string) => {
    if (conf === 'HIGH') return '높음';
    if (conf === 'MEDIUM') return '보통';
    return '낮음';
  };

  return (
    <div className="mx-3 my-3 rounded-xl border border-emerald-150 bg-white shadow-md overflow-hidden animate-in slide-in-from-top duration-200">
      <div className="flex items-center justify-between px-4 py-3 bg-[#008f83] text-white">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-sans">귀속 추천 상세</span>
          <span className="text-[11px] font-mono opacity-80">
            {item.period} · {item.accountCode}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white hover:text-emerald-100 p-0.5 rounded transition text-xs font-bold"
        >
          상세 닫기
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-4 text-xs font-sans">
        {/* Info Column 1: Account Info */}
        <section className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-3">
          <h4 className="mb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">계정 정보</h4>
          <InfoLine label="계정코드" value={item.accountCode} />
          <InfoLine label="계정과목명" value={item.accountName} />
          <InfoLine label="발생 기간" value={`${item.period} 실적`} />
          <InfoLine label="실적금액" value={`${item.amount.toLocaleString()}원`} strong />
        </section>

        {/* Info Column 2: Department Comparison */}
        <section className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-3">
          <h4 className="mb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">부서 정보</h4>
          <InfoLine label="원 사용처" value={`[${item.originalDeptCode}] ${item.originalDeptName}`} />
          <InfoLine
            label="현재 귀속부서"
            value={
              item.currentAttributedDeptCode
                ? `[${item.currentAttributedDeptCode}] ${item.currentAttributedDeptName}`
                : '원 사용처 기준 동일'
            }
          />
          <InfoLine
            label="추천 귀속부서"
            value={
              item.recommendedDeptCode
                ? `[${item.recommendedDeptCode}] ${item.recommendedDeptName}`
                : '-'
            }
            strong
          />
        </section>

        {/* Info Column 3: Recommendations Reasons */}
        <section className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">귀속 추천 사유</h4>
            {item.score > 0 && (
              <span className="text-[10.5px] font-mono font-bold text-[#008f83]">
                {item.score}점 ({getConfidenceLabel(item.confidence)})
              </span>
            )}
          </div>
          <ul className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {item.reasons && item.reasons.length > 0 ? (
              item.reasons.map((r: any, index: number) => (
                <li key={index} className="rounded border border-zinc-150 bg-white px-2 py-1.5 text-[10.5px] text-zinc-600 flex items-start gap-1">
                  <span className="text-emerald-500 font-semibold">•</span>
                  <div>
                    <span>{r.label}</span>
                    {r.weight > 0 && <strong className="ml-1 text-zinc-700">+{r.weight}점</strong>}
                  </div>
                </li>
              ))
            ) : (
              <li className="text-zinc-400 text-center py-4">사유가 분석되지 않았습니다.</li>
            )}
          </ul>
        </section>
      </div>

      {/* Footer block: Manual change dropdown and action buttons */}
      <div className="flex flex-col gap-3 border-t border-zinc-150 bg-zinc-50/80 px-4 py-3 xl:flex-row xl:items-center xl:justify-between font-sans">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold text-zinc-500">수동 변경 부서 선택</span>
          <select
            value={manualDeptCode}
            onChange={(e) => setManualDeptCode(e.target.value)}
            className="h-8 max-w-xs rounded border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 focus:border-[#008f83] outline-none"
          >
            <option value="">수동 변경할 부서 선택</option>
            {allDepts.map(dept => (
              <option key={dept.code} value={dept.code}>
                [{dept.code}] {dept.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!manualDeptCode}
            onClick={() => {
              onManualChange(manualDeptCode);
              setManualDeptCode('');
            }}
            className="h-8 rounded bg-zinc-800 hover:bg-zinc-900 px-3 text-xs font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            변경 적용
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <span className="text-[10px] text-zinc-400 font-bold mr-2 uppercase">처리</span>

          {item.status === '대기' && item.recommendedDeptCode && (
            <button
              type="button"
              onClick={onApply}
              className="h-8 rounded bg-[#008f83] hover:bg-[#00746b] px-3.5 text-xs font-bold text-white transition cursor-pointer shadow-xs"
            >
              추천 적용
            </button>
          )}

          {item.status === '대기' && (
            <button
              type="button"
              onClick={onIgnore}
              className="h-8 rounded border border-zinc-250 bg-white hover:bg-zinc-50 px-3 text-xs font-bold text-zinc-650 transition cursor-pointer"
            >
              추천 무시
            </button>
          )}

          {(item.status === '적용됨' || item.status === '수동 변경') && (
            <button
              type="button"
              onClick={onRevert}
              className="h-8 rounded border border-red-200 bg-white hover:bg-red-50 px-3 text-xs font-bold text-red-650 transition cursor-pointer"
            >
              귀속 원복
            </button>
          )}

          {item.status === '무시됨' && (
            <button
              type="button"
              onClick={onUndoIgnore}
              className="h-8 rounded border border-emerald-500 bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 px-3 text-xs transition cursor-pointer"
            >
              추천 무시 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 font-sans text-xs">
      <span className="shrink-0 text-zinc-550 font-medium">{label}</span>
      <span className={`text-right truncate max-w-[180px] ${strong ? 'font-black text-[#008f83] text-[12px]' : 'font-bold text-zinc-800'}`}>
        {value}
      </span>
    </div>
  );
}
