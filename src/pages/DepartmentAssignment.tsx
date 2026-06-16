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
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { usePermission } from '../lib/permissions';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';
import { safeLocalStorageGet, safeJsonParse } from '../lib/safeStorage';
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
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  score: number;
  reasons: { label: string; weight: number }[];
  status: '대기' | '적용됨' | '무시됨' | '수동 변경';
  amount: number;
  excludeReason?: string;
}

interface GroupedRecommendationRow {
  groupId: string;
  accountCode: string;
  accountName: string;
  originalDeptCode: string;
  originalDeptName: string;
  currentAttributedDeptCode?: string;
  currentAttributedDeptName?: string;
  recommendedDeptCode: string;
  recommendedDeptName: string;
  months: RecommendationRow[];
  monthLabels: string;
  totalAmount: number;
  maxScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  status: '대기' | '적용됨' | '무시됨' | '수동 변경';
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
  type AttributionDataFilter =
    | '실적'
    | '경영계획'
    | '수정경영계획'
    | '1차 RP'
    | '2차 RP';

  const [planType, setPlanType] = useState<AttributionDataFilter>('실적');

  const recommendationPlanType = useMemo(() => {
    return planType === '실적' ? '경영계획' : planType;
  }, [planType]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [monthMode, setMonthMode] = useState<'SINGLE' | 'YTD'>('YTD');
  const [selectedWriterDept, setSelectedWriterDept] = useState('all');
  const [selectedAttributedDept, setSelectedAttributedDept] = useState('all');
  const [selectedAccountingType, setSelectedAccountingType] = useState('전체');
  const [selectedAccountClass, setSelectedAccountClass] = useState('전체');
  const [selectedConfidence, setSelectedConfidence] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('대기');
  const [activeAttributionTab, setActiveAttributionTab] = useState<'ALL' | 'RECOMMENDED' | 'EXCLUDED' | 'APPLIED' | 'IGNORED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExcludedAccounts, setShowExcludedAccounts] = useState(false);
  const [isRecommendationListOpen, setIsRecommendationListOpen] = useState(true);
  const [isManualGridOpen, setIsManualGridOpen] = useState(false);
  const [manualRowsLoaded, setManualRowsLoaded] = useState(false);

  const [recommendationSort, setRecommendationSort] = useState<SortConfig<RecommendationSortKey> | null>({
    key: 'accountCode',
    direction: 'asc',
  });
  const [recommendationViewMode, setRecommendationViewMode] = useState<'GROUPED' | 'ROW'>('GROUPED');
  const [selectedRecommendationGroupIds, setSelectedRecommendationGroupIds] = useState<Set<string>>(new Set());
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

  // Reusable inline Alert/Confirm State & Helpers
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => void;
    isAlert?: boolean;
  }>({
    open: false,
    title: '',
    description: '',
    confirmText: '확인',
    onConfirm: () => {},
    isAlert: false
  });

  const showConfirm = (title: string, description: string, onConfirm: () => void, confirmText = '확인') => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, open: false }));
      },
      isAlert: false
    });
  };

  const showAlert = (title: string, description: string) => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmText: '확인',
      onConfirm: () => {
        setConfirmState(prev => ({ ...prev, open: false }));
      },
      isAlert: true
    });
  };

  // Loaded Raw Data States
  const [actualRowsList, setActualRowsList] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [historyModalTab, setHistoryModalTab] = useState<'ATTRIBUTION' | 'UPLOAD'>('ATTRIBUTION');

  const reloadAuditLogs = () => {
    setAuditLogs(safeLocalStorageGet<any[]>('hycm_attribution_audit_log', []));
    setUploadHistory(safeLocalStorageGet<any[]>('hycm_actual_upload_history', []));
  };

  const appendAttributionAuditLogs = (newLogs: any[]) => {
    try {
      const currentRaw = safeLocalStorageGet<unknown>('hycm_attribution_audit_log', []);
      const currentLogs = Array.isArray(currentRaw) ? currentRaw : [];
      const nextLogs = [...newLogs, ...currentLogs];
      localStorage.setItem('hycm_attribution_audit_log', JSON.stringify(nextLogs));
      setAuditLogs(nextLogs);
    } catch (e) {
      console.error(e);
    }
  };

  const getStoredActualRows = (): any[] => {
    const actKey = getActualDataKey(year);
    const raw = safeLocalStorageGet<unknown>(actKey, []);

    if (!Array.isArray(raw)) {
      localStorage.setItem(actKey, JSON.stringify([]));
      return [];
    }

    return raw;
  };

  const resetAttributionSelections = () => {
    setSelectedRowIds(new Set());
    setSelectedRecommendationGroupIds(new Set());
    setSelectedRowId(null);
    setSelectedGroupId(null);
    setEditingAttributionRowId(null);
    setEditingGroupRowId(null);
    setDraftAttributedDeptCode('');
  };

  // Selected Row for Details (Master-Detail)
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [editingAttributionRowId, setEditingAttributionRowId] = useState<string | number | null>(null);
  const [editingGroupRowId, setEditingGroupRowId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draftAttributedDeptCode, setDraftAttributedDeptCode] = useState('');

  const [columnWidths, setColumnWidths] = useState<Record<AttributionColumnKey, number>>(() => {
    const saved = safeLocalStorageGet<Record<string, any> | null>(ATTRIBUTION_COL_WIDTHS_KEY, null);
    return saved ? { ...DEFAULT_ATTRIBUTION_COL_WIDTHS, ...saved } : DEFAULT_ATTRIBUTION_COL_WIDTHS;
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
    const stored = safeLocalStorageGet<any[]>('cleanmetal_excluded_attribution_ids', []);
    return new Set(stored);
  });

  const [deptMasterVersion, setDeptMasterVersion] = useState(0);

  useEffect(() => {
    const handleDeptMasterChanged = () => {
      setDeptMasterVersion(v => v + 1);
    };

    window.addEventListener('storage', handleDeptMasterChanged);
    window.addEventListener('custom-users-changed', handleDeptMasterChanged);
    window.addEventListener('department-master-changed', handleDeptMasterChanged);

    return () => {
      window.removeEventListener('storage', handleDeptMasterChanged);
      window.removeEventListener('custom-users-changed', handleDeptMasterChanged);
      window.removeEventListener('department-master-changed', handleDeptMasterChanged);
    };
  }, []);

  const allDepts = useMemo(() => getAllDepartments(), [deptMasterVersion]);

  const viewableDepts = useMemo(() => {
    if (!currentUser) return [];
    if (['99999', '32100'].includes(currentUser.code)) return getAllDepartments();
    return getViewableDepts(currentUser.code);
  }, [currentUser, deptMasterVersion]);

  function sameDeptCode(a: unknown, b: unknown) {
    return String(a ?? '').trim() === String(b ?? '').trim();
  }

  function getEffectiveDeptCode(row: any) {
    return String(row?.attributedDeptCode || row?.usageCode || '').trim();
  }

  function resolveDeptLabel(code: unknown, fallback?: string) {
    const normalized = String(code ?? '').trim();
    const dept = allDepts.find(d => sameDeptCode(d.code, normalized));

    if (dept) return `[${dept.code}] ${dept.name}`;
    if (fallback) return `[${normalized}] ${fallback} · 미등록`;
    return `[${normalized}] 미등록 부서`;
  }

  function renderDeptCellContent(code: unknown, name?: string) {
    const normalized = String(code ?? '').trim();
    const dept = allDepts.find(d => sameDeptCode(d.code, normalized));
    if (dept) {
      return (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-zinc-500">[{dept.code}]</span>
          <span className="font-medium text-zinc-900">{dept.name}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-zinc-400">[{normalized}]</span>
        <span className="text-zinc-500 italic truncate max-w-[120px]">{name || '미등록 부서'}</span>
        <span className="inline-flex items-center rounded bg-red-50 px-1 py-0.5 text-[9px] font-bold text-red-650 ring-1 ring-inset ring-red-600/15 select-none shrink-0">
          미등록
        </span>
      </span>
    );
  }

  // Budget Rows cache to score recommendations
  const budgetRowsByDept = useMemo(() => {
    const map = new Map<string, any[]>();
    allDepts.forEach(d => {
      const bKey = getBudgetDataKey(d.code, year, recommendationPlanType);
      const savedData = safeLocalStorageGet<any[] | null>(bKey, null);
      if (savedData) {
        map.set(d.code, savedData);
      }
    });
    return map;
  }, [allDepts, year, recommendationPlanType]);

  // Helper: Month parser
  const getPeriodMonthIndex = (period: string): number => {
    const idx = parsePeriodMonth(period);
    if (idx !== null) return idx + 1;

    const text = String(period || '').trim();

    const ymdMatch = text.match(/20\d{2}[-./년\s]*(0?[1-9]|1[0-2])/);
    if (ymdMatch) return Number(ymdMatch[1]);

    const monthMatch = text.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])\s*월?/);
    if (monthMatch) return Number(monthMatch[1]);

    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;

    return 12;
  };

  const getActualRowMonth = (row: any): number => {
    if (!row) return 12;
    const targetRow = row.row ? row.row : row;
    if (targetRow.periodMonth !== undefined && Number(targetRow.periodMonth) >= 1 && Number(targetRow.periodMonth) <= 12) {
      return Number(targetRow.periodMonth);
    }
    return getPeriodMonthIndex(targetRow.period || targetRow.month);
  };

  // Load Initial Storage Data
  const loadData = () => {
    // 1. Overrides
    const rawOverrides = safeLocalStorageGet<unknown>('hycm_department_assignment_overrides', []);
    const normalizedOverrides = Array.isArray(rawOverrides) ? rawOverrides : [];

    if (!Array.isArray(rawOverrides)) {
      localStorage.setItem('hycm_department_assignment_overrides', JSON.stringify([]));
    }
    setOverrides(normalizedOverrides);

    // 2. Actuals
    const actKey = getActualDataKey(year);
    const rawActuals = safeLocalStorageGet<unknown>(actKey, []);
    const parsed = Array.isArray(rawActuals) ? rawActuals : [];

    if (!Array.isArray(rawActuals)) {
      localStorage.setItem(actKey, JSON.stringify([]));
    }

    if (parsed.length > 0) {
      try {
        const normalizedRows = parsed.map((row: any) => {
          return {
            ...row,
            usageCode: String(row.usageCode ?? '').trim(),
            accountCode: String(row.accountCode ?? '').trim(),
            attributedDeptCode: row.attributedDeptCode
              ? String(row.attributedDeptCode).trim()
              : row.attributedDeptCode,
            periodMonth:
              Number(row.periodMonth) >= 1 && Number(row.periodMonth) <= 12
                ? Number(row.periodMonth)
                : getPeriodMonthIndex(row.period || row.month),
          };
        });
        setActualRowsList(normalizedRows);
        localStorage.setItem(actKey, JSON.stringify(normalizedRows));
      } catch (e) {
        console.error(e);
        setActualRowsList([]);
      }
    } else {
      setActualRowsList([]);
    }

    // 3. Audit Logs
    reloadAuditLogs();
  };

  useEffect(() => {
    loadData();
  }, [year]);

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

    appendAttributionAuditLogs([newLog]);
  };

  // Construct All Recommendation rows dynamically
  const allRecommendationRows = useMemo(() => {
    const result: RecommendationRow[] = [];
    if (!currentUser) return [];

    const isFinanceOrAdmin = ['99999', '32100'].includes(currentUser.code);
    const recDepts = isFinanceOrAdmin ? allDepts : viewableDepts;

    actualRowsList.forEach((row: any) => {
      // 권한 부서 필터링 (사용자별 조회 가능 부서에 해당하는 실적만 대상으로 삼음) using sameDeptCode
      const isViewable = viewableDepts.some(d => 
        sameDeptCode(d.code, row.usageCode) || 
        (row.attributedDeptCode && sameDeptCode(d.code, row.attributedDeptCode))
      );
      if (!isViewable) return;

      const rec = recommendAttributionForRow({
        row,
        year,
        planType: recommendationPlanType,
        monthMode: monthMode === 'SINGLE' ? 'MONTH' : 'YTD',
        selectedMonth: selectedMonth === 'all' ? 12 : Number(selectedMonth),
        departments: recDepts,
        budgetRowsByDept,
        actualRows: actualRowsList,
        previousOverrides: overrides,
      });

      const excludeResult = getAttributionExcludeResult(row.accountCode, row.accountName);
      const isIgnored = excludedRowIds.has(row.id);
      const hasOverride = row.attributedDeptCode && !sameDeptCode(row.attributedDeptCode, row.usageCode);
      const isManual = row.attributionSource === 'manual' || (hasOverride && (!rec || !sameDeptCode(row.attributedDeptCode, rec.recommendedDeptCode)));

      let status: '대기' | '적용됨' | '무시됨' | '수동 변경' = '대기';
      if (isIgnored) {
        status = '무시됨';
      } else if (row.attributedDeptCode && rec && sameDeptCode(row.attributedDeptCode, rec.recommendedDeptCode)) {
        status = '적용됨';
      } else if (isManual) {
        status = '수동 변경';
      } else if (hasOverride) {
        status = '적용됨';
      }

      const isActuallyExcluded = excludeResult.excluded;

      result.push({
        rowId: row.id,
        row,
        period: row.period || row.month || `${row.periodMonth || 12}월`,
        monthIndex: getActualRowMonth(row),
        accountCode: row.accountCode,
        accountName: row.accountName,
        originalDeptCode: row.usageCode,
        originalDeptName: row.usageDept || row.usageCode,
        currentAttributedDeptCode: row.attributedDeptCode,
        currentAttributedDeptName: row.attributedDeptName,
        recommendedDeptCode: rec ? rec.recommendedDeptCode : '',
        recommendedDeptName: rec ? rec.recommendedDeptName : '',
        confidence: rec ? rec.confidence : (isActuallyExcluded ? 'NONE' : 'LOW'),
        score: rec ? rec.score : 0,
        reasons: rec ? rec.reasons : (isActuallyExcluded ? [{ label: `${excludeResult.label} (추천 분류 배제)`, weight: 0 }] : [{ label: '부서 직접 지정 변경', weight: 0 }]),
        status,
        amount: Number(row.completed || row.amount || 0),
        excludeReason: isActuallyExcluded ? excludeResult.label : undefined,
      });
    });

    return result.sort((a, b) => {
      const accountCompare = String(a.accountCode || '').localeCompare(
        String(b.accountCode || ''),
        'ko-KR',
        { numeric: true, sensitivity: 'base' }
      );
      if (accountCompare !== 0) return accountCompare;

      const originalDeptCompare = String(a.originalDeptCode || '').localeCompare(
        String(b.originalDeptCode || ''),
        'ko-KR',
        { numeric: true, sensitivity: 'base' }
      );
      if (originalDeptCompare !== 0) return originalDeptCompare;

      const recommendedDeptCompare = String(a.recommendedDeptCode || '').localeCompare(
        String(b.recommendedDeptCode || ''),
        'ko-KR',
        { numeric: true, sensitivity: 'base' }
      );
      if (recommendedDeptCompare !== 0) return recommendedDeptCompare;

      return Number(a.monthIndex || 99) - Number(b.monthIndex || 99);
    });
  }, [actualRowsList, year, allDepts, viewableDepts, recommendationPlanType, monthMode, selectedMonth, budgetRowsByDept, overrides, excludedRowIds, currentUser]);

  // Apply UI Filters
  const filteredRecommendationRows = useMemo(() => {
    return allRecommendationRows.filter(item => {
      // 1. Filter by active tab first
      if (activeAttributionTab === 'RECOMMENDED') {
        if (item.excludeReason) return false;
        if (item.status !== '대기') return false;
        if (!item.recommendedDeptCode) return false;
      } else if (activeAttributionTab === 'EXCLUDED') {
        if (!item.excludeReason) return false;
      } else if (activeAttributionTab === 'APPLIED') {
        if (item.status !== '적용됨' && item.status !== '수동 변경') return false;
      } else if (activeAttributionTab === 'IGNORED') {
        if (item.status !== '무시됨') return false;
      }
      // If 'ALL', show everything.

      // Month
      if (selectedMonth !== 'all') {
        const monthIndex = getActualRowMonth(item.row || item);
        if (monthMode === 'YTD') {
          if (monthIndex > Number(selectedMonth)) return false;
        } else {
          if (monthIndex !== Number(selectedMonth)) return false;
        }
      }

      // Original Dept using sameDeptCode
      if (selectedWriterDept !== 'all' && !sameDeptCode(item.originalDeptCode, selectedWriterDept)) return false;

      // Recommended Dept using sameDeptCode
      if (selectedAttributedDept !== 'all') {
        const effectiveDept = item.currentAttributedDeptCode || item.originalDeptCode;
        if (!sameDeptCode(effectiveDept, selectedAttributedDept)) return false;
      }

      // Accounting Type & Account Class Filter (회계 구분, 비용 성격)
      const accountingType = getAccountingType(item.accountCode, item.accountName);
      const accountClass = classifyAccount(item.accountCode, item.accountName);

      if (selectedAccountingType !== '전체' && accountingType !== selectedAccountingType) return false;
      if (selectedAccountClass !== '전체' && accountClass !== selectedAccountClass) return false;

      // Confidence
      if (selectedConfidence !== 'all' && item.confidence !== selectedConfidence) return false;

      // Status
      if (activeAttributionTab === 'ALL') {
        if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      }

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
  }, [allRecommendationRows, activeAttributionTab, selectedMonth, monthMode, selectedWriterDept, selectedAttributedDept, selectedAccountingType, selectedAccountClass, selectedConfidence, selectedStatus, searchQuery]);

  // Tab counts for badge display
  const tabCounts = useMemo(() => {
    let allCount = 0;
    let recCount = 0;
    let excCount = 0;
    let appCount = 0;
    let ignCount = 0;

    allRecommendationRows.forEach(item => {
      // Standard UI filters: Month
      if (selectedMonth !== 'all') {
        const monthIndex = getActualRowMonth(item.row || item);
        if (monthMode === 'YTD') {
          if (monthIndex > Number(selectedMonth)) return;
        } else {
          if (monthIndex !== Number(selectedMonth)) return;
        }
      }

      // Original Dept using sameDeptCode
      if (selectedWriterDept !== 'all' && !sameDeptCode(item.originalDeptCode, selectedWriterDept)) return;

      // Recommended Dept using sameDeptCode
      if (selectedAttributedDept !== 'all') {
        const effectiveDept = item.currentAttributedDeptCode || item.originalDeptCode;
        if (!sameDeptCode(effectiveDept, selectedAttributedDept)) return;
      }

      // Accounting Type & Account Class Filter
      const accountingType = getAccountingType(item.accountCode, item.accountName);
      const accountClass = classifyAccount(item.accountCode, item.accountName);
      if (selectedAccountingType !== '전체' && accountingType !== selectedAccountingType) return;
      if (selectedAccountClass !== '전체' && accountClass !== selectedAccountClass) return;

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
          return;
        }
      }

      allCount++;

      if (item.excludeReason) {
        excCount++;
      } else if (item.status === '무시됨') {
        ignCount++;
      } else if (item.status === '적용됨' || item.status === '수동 변경') {
        appCount++;
      } else if (item.status === '대기' && item.recommendedDeptCode) {
        recCount++;
      }
    });

    return {
      ALL: allCount,
      RECOMMENDED: recCount,
      EXCLUDED: excCount,
      APPLIED: appCount,
      IGNORED: ignCount,
    };
  }, [allRecommendationRows, selectedMonth, monthMode, selectedWriterDept, selectedAttributedDept, selectedAccountingType, selectedAccountClass, searchQuery]);

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

        if (key === 'accountCode') {
          const accountCompare = String(a.accountCode || '').localeCompare(
            String(b.accountCode || ''),
            'ko-KR',
            { numeric: true, sensitivity: 'base' }
          );
          if (accountCompare !== 0) {
            return recommendationSort.direction === 'asc' ? accountCompare : -accountCompare;
          }

          const deptCompare = String(a.originalDeptCode || '').localeCompare(
            String(b.originalDeptCode || ''),
            'ko-KR',
            { numeric: true, sensitivity: 'base' }
          );
          if (deptCompare !== 0) return deptCompare;

          const recCompare = String(a.recommendedDeptCode || '').localeCompare(
            String(b.recommendedDeptCode || ''),
            'ko-KR',
            { numeric: true, sensitivity: 'base' }
          );
          if (recCompare !== 0) return recCompare;

          return Number(a.monthIndex || 99) - Number(b.monthIndex || 99);
        }

        if (key === 'period') {
          const aMonth = Number(a.monthIndex || 0);
          const bMonth = Number(b.monthIndex || 0);
          if (aMonth !== bMonth) {
            return recommendationSort.direction === 'asc' ? aMonth - bMonth : bMonth - aMonth;
          }
          return String(a.accountCode || '').localeCompare(
            String(b.accountCode || ''),
            'ko-KR',
            { numeric: true, sensitivity: 'base' }
          );
        }

        if (key === 'amount') {
          const aAmt = Number(a.amount || 0);
          const bAmt = Number(b.amount || 0);
          if (aAmt !== bAmt) {
            return recommendationSort.direction === 'asc' ? aAmt - bAmt : bAmt - aAmt;
          }
          const accountCompare = String(a.accountCode || '').localeCompare(
            String(b.accountCode || ''),
            'ko-KR',
            { numeric: true, sensitivity: 'base' }
          );
          if (accountCompare !== 0) return accountCompare;
          return Number(a.monthIndex || 99) - Number(b.monthIndex || 99);
        }

        let aValue: string | number = '';
        let bValue: string | number = '';

        if (key === 'originalDept') {
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

  const getRecommendationGroupKey = (row: RecommendationRow) => {
    return [
      row.accountCode,
      row.accountName,
      row.originalDeptCode,
      row.recommendedDeptCode || '',
      row.status,
    ].join('|');
  };

  const groupedRecommendationRows = useMemo(() => {
    const map = new Map<string, GroupedRecommendationRow>();

    filteredAndSortedRecommendationRows.forEach(row => {
      const key = getRecommendationGroupKey(row);

      if (!map.has(key)) {
        map.set(key, {
          groupId: key,
          accountCode: row.accountCode,
          accountName: row.accountName,
          originalDeptCode: row.originalDeptCode,
          originalDeptName: row.originalDeptName,
          currentAttributedDeptCode: row.currentAttributedDeptCode,
          currentAttributedDeptName: row.currentAttributedDeptName,
          recommendedDeptCode: row.recommendedDeptCode,
          recommendedDeptName: row.recommendedDeptName,
          months: [],
          monthLabels: '',
          totalAmount: 0,
          maxScore: 0,
          confidence: row.confidence,
          status: row.status,
        });
      }

      const group = map.get(key)!;
      group.months.push(row);
      group.totalAmount += row.amount || 0;
      group.maxScore = Math.max(group.maxScore, row.score || 0);

      const confidenceRank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
      if (confidenceRank[row.confidence] > confidenceRank[group.confidence]) {
        group.confidence = row.confidence;
      }
    });

    const formatGroupMonthLabel = (months: any[]) => {
      const indices = months.map(m => m.monthIndex).sort((a: number, b: number) => a - b);
      const unique = Array.from(new Set(indices));
      if (unique.length === 12) return '전체 12개월';
      
      let consecutive = true;
      for (let i = 1; i < unique.length; i++) {
        if (unique[i] !== unique[i - 1] + 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive && unique.length > 2) {
        return `${unique[0]}~${unique[unique.length - 1]}월`;
      }
      return unique.map(m => `${m}월`).join(', ');
    };

    return Array.from(map.values()).map(group => ({
      ...group,
      months: group.months.sort((a, b) => a.monthIndex - b.monthIndex),
      monthLabels: formatGroupMonthLabel(group.months),
    }));
  }, [filteredAndSortedRecommendationRows]);

  const visibleGroupedRows = useMemo(() => {
    return groupedRecommendationRows.slice(0, recVisibleCount);
  }, [groupedRecommendationRows, recVisibleCount]);

  // Excluded Rows construction
  const excludedRecommendationRows = useMemo(() => {
    if (!showExcludedAccounts) return [];
    
    const result: any[] = [];
    actualRowsList.forEach((row: any) => {
      // 권한 부서 필터링 (사용자별 조회 가능 부서에 해당하는 실적만 대상으로 삼음)
      const isViewable = viewableDepts.some(d => sameDeptCode(d.code, row.usageCode) || (row.attributedDeptCode && sameDeptCode(d.code, row.attributedDeptCode)));
      if (!isViewable) return;

      const excludeResult = getAttributionExcludeResult(row.accountCode, row.accountName);
      if (excludeResult.excluded) {
        // Apply Month filter
        if (selectedMonth !== 'all') {
          const monthIndex = getActualRowMonth(row);
          if (monthMode === 'YTD') {
            if (monthIndex > Number(selectedMonth)) return;
          } else {
            if (monthIndex !== Number(selectedMonth)) return;
          }
        }

        // Original Dept filter
        if (selectedWriterDept !== 'all' && !sameDeptCode(row.usageCode, selectedWriterDept)) return;

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
      const isViewable = viewableDepts.some(d => sameDeptCode(d.code, row.usageCode) || (row.attributedDeptCode && sameDeptCode(d.code, row.attributedDeptCode)));
      if (!isViewable) return false;

      if (selectedMonth !== 'all') {
        const monthIndex = getActualRowMonth(row);
        if (monthMode === 'YTD') {
          if (monthIndex > Number(selectedMonth)) return false;
        } else {
          if (monthIndex !== Number(selectedMonth)) return false;
        }
      }

      if (selectedWriterDept !== 'all' && !sameDeptCode(row.usageCode, selectedWriterDept)) {
        return false;
      }

      if (selectedAttributedDept !== 'all') {
        const effectiveDept = row.attributedDeptCode || row.usageCode;
        if (!sameDeptCode(effectiveDept, selectedAttributedDept)) return false;
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
    const storedActuals = getStoredActualRows();
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
      clearDataLoaderCache();
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
      resetAttributionSelections();
      loadData();
    }
  };

  // Actions: Manual attribute change
  const handleApplyManualChange = (rowId: string | number, selectedDeptCode: string) => {
    if (!selectedDeptCode) return;
    const dept = allDepts.find(d => d.code === selectedDeptCode);
    if (!dept) return;

    const actKey = getActualDataKey(year);
    const storedActuals = getStoredActualRows();
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
      clearDataLoaderCache();
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
      resetAttributionSelections();
      loadData();
    }
  };

  // Actions: Revert to original attribution
  const handleRevertAttribution = (rowId: string | number) => {
    const actKey = getActualDataKey(year);
    const storedActuals = getStoredActualRows();
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
      clearDataLoaderCache();
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
      resetAttributionSelections();
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
    resetAttributionSelections();
    loadData();
  };

  // Undo Ignored state
  const handleUndoIgnore = (rowId: string | number) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    nextSet.delete(rowId);
    saveExcludedRowIds(nextSet);

    const matchRec = allRecommendationRows.find(r => r.rowId === rowId);
    if (matchRec) {
      saveAuditLog({
        rowId,
        action: 'REVERT',
        accountCode: matchRec.accountCode,
        accountName: matchRec.accountName,
        originalDeptCode: matchRec.originalDeptCode,
        originalDeptName: matchRec.originalDeptName,
        beforeAttributedDeptCode: undefined,
        beforeAttributedDeptName: '추천 제외됨 (사용자 무시)',
        afterAttributedDeptCode: matchRec.recommendedDeptCode || undefined,
        afterAttributedDeptName: matchRec.recommendedDeptCode 
          ? `[${matchRec.recommendedDeptCode}] ${matchRec.recommendedDeptName}` 
          : '원 사용처 기준',
        reasons: ['추천 무시 취소'],
        score: matchRec.score,
      });
    }

    setFeedbackMsg({
      type: 'success',
      text: '무시 처리가 해제되어 정상 대기 상태로 복구되었습니다.'
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    resetAttributionSelections();
    loadData();
  };

  const handleApplyRecommendationGroup = (group: GroupedRecommendationRow) => {
    const actKey = getActualDataKey(year);
    const storedActuals = getStoredActualRows();
    const targetIds = new Set(group.months.filter(m => m.status === '대기').map(m => m.rowId));
    if (targetIds.size === 0) return;

    const newLogs: any[] = [];
    const updated = storedActuals.map((row: any) => {
      if (!targetIds.has(row.id)) return row;
      
      const reasons = group.months[0]?.reasons.map(r => r.label) || [];
      const score = group.months[0]?.score || 0;

      newLogs.push({
        id: `${Date.now()}_grp_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '집계 귀속 적용 (계정 묶음)',
        accountCode: row.accountCode,
        accountName: row.accountName,
        originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
        beforeAttributedDeptName: row.attributedDeptName || '원 사용처 기준',
        afterAttributedDeptName: `[${group.recommendedDeptCode}] ${group.recommendedDeptName}`,
        user: currentUser?.name || '업무담당자',
        reason: '계정 묶음 귀속추천 적용 (' + group.monthLabels + ')',
      });

      return {
        ...row,
        usageCode: row.usageCode,
        usageDept: row.usageDept,
        attributedDeptCode: group.recommendedDeptCode,
        attributedDeptName: group.recommendedDeptName,
        attributionSource: 'recommendation',
        attributionScore: score,
        attributionReasons: reasons,
        attributionUpdatedAt: new Date().toISOString(),
      };
    });

    localStorage.setItem(actKey, JSON.stringify(updated));
    clearDataLoaderCache();
    appendAttributionAuditLogs(newLogs);

    setFeedbackMsg({
      type: 'success',
      text: `[${group.accountName}] 계정 묶음 ${targetIds.size}건에 추천 귀속부서 [${group.recommendedDeptName}]를 적용하였습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    resetAttributionSelections();
    loadData();
  };

  const handleIgnoreRecommendationGroup = (group: GroupedRecommendationRow) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    const newLogs: any[] = [];
    
    group.months.forEach(m => {
      nextSet.add(m.rowId);
      newLogs.push({
        id: `${Date.now()}_grpig_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '추천 무시 (계정 묶음)',
        accountCode: m.accountCode,
        accountName: m.accountName,
        originalDeptName: `[${m.originalDeptCode}] ${m.originalDeptName}`,
        beforeAttributedDeptName: m.currentAttributedDeptName || '원 사용처 기준',
        afterAttributedDeptName: '추천 제외됨 (사용자 무시)',
        user: currentUser?.name || '업무담당자',
        reason: '계정 묶음 귀속추천 제외 설정 (' + group.monthLabels + ')',
      });
    });

    saveExcludedRowIds(nextSet);
    appendAttributionAuditLogs(newLogs);

    setFeedbackMsg({
      type: 'success',
      text: `[${group.accountName}] 계정 묶음 ${group.months.length}건을 추천 무시 처리했습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    resetAttributionSelections();
    loadData();
  };

  const handleApplyManualChangeGroup = (group: GroupedRecommendationRow, selectedDeptCode: string) => {
    if (!selectedDeptCode) return;
    const dept = allDepts.find(d => d.code === selectedDeptCode);
    if (!dept) return;

    const actKey = getActualDataKey(year);
    const storedActuals = getStoredActualRows();
    const targetIds = new Set(group.months.map(m => m.rowId));

    const newLogs: any[] = [];
    const updated = storedActuals.map((row: any) => {
      if (!targetIds.has(row.id)) return row;

      newLogs.push({
        id: `${Date.now()}_grpmn_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '수동 보정 적용 (계정 묶음)',
        accountCode: row.accountCode,
        accountName: row.accountName,
        originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
        beforeAttributedDeptName: row.attributedDeptName || '원 사용처 기준',
        afterAttributedDeptName: `[${dept.code}] ${dept.name}`,
        user: currentUser?.name || '업무담당자',
        reason: '계정 묶음 수동 변경 지정',
      });

      return {
        ...row,
        usageCode: row.usageCode,
        usageDept: row.usageDept,
        attributedDeptCode: dept.code,
        attributedDeptName: dept.name,
        attributionSource: 'manual',
        attributionScore: 0,
        attributionReasons: ['업무담당자 수동 보정 변경 (계정 묶음)'],
        attributionUpdatedAt: new Date().toISOString(),
      };
    });

    localStorage.setItem(actKey, JSON.stringify(updated));
    clearDataLoaderCache();
    appendAttributionAuditLogs(newLogs);

    setFeedbackMsg({
      type: 'success',
      text: `[${group.accountName}] 계정 묶음 ${targetIds.size}건의 귀속부서를 [${dept.name}] (수동)으로 적용하였습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    resetAttributionSelections();
    loadData();
  };

  const handleRevertAttributionGroup = (group: GroupedRecommendationRow) => {
    const actKey = getActualDataKey(year);
    const storedActuals = getStoredActualRows();
    const targetIds = new Set(group.months.map(m => m.rowId));

    const newLogs: any[] = [];
    const updated = storedActuals.map((row: any) => {
      if (!targetIds.has(row.id)) return row;

      newLogs.push({
        id: `${Date.now()}_grprv_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '지정 귀속 복원 (계정 묶음)',
        accountCode: row.accountCode,
        accountName: row.accountName,
        originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
        beforeAttributedDeptName: row.attributedDeptName || '원 사용처 기준',
        afterAttributedDeptName: '원 사용처 기준',
        user: currentUser?.name || '업무담당자',
        reason: '계정 묶음 원본 부서 기준으로 복원 (' + group.monthLabels + ')',
      });

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

    localStorage.setItem(actKey, JSON.stringify(updated));
    clearDataLoaderCache();
    appendAttributionAuditLogs(newLogs);

    setFeedbackMsg({
      type: 'success',
      text: `[${group.accountName}] 계정 묶음 ${targetIds.size}건의 지정 귀속부서를 제거하고 원본 부서 기준으로 원복하였습니다.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    resetAttributionSelections();
    loadData();
  };

  const handleUndoIgnoreGroup = (group: GroupedRecommendationRow) => {
    const nextSet = new Set<string | number>(excludedRowIds);
    group.months.forEach(m => {
      nextSet.delete(m.rowId);
    });
    saveExcludedRowIds(nextSet);

    const newLogs: any[] = [];
    group.months.forEach(m => {
      newLogs.push({
        id: `${Date.now()}_grpund_${Math.random().toString(36).substring(2, 7)}`,
        time: new Date().toLocaleString(),
        action: '무시 조정 취소 (계정 묶음)',
        accountCode: m.accountCode,
        accountName: m.accountName,
        originalDeptName: `[${m.originalDeptCode}] ${m.originalDeptName}`,
        beforeAttributedDeptName: '추천 제외됨 (사용자 무시)',
        afterAttributedDeptName: m.recommendedDeptCode 
          ? `[${m.recommendedDeptCode}] ${m.recommendedDeptName}` 
          : '원 사용처 기준',
        user: currentUser?.name || '업무담당자',
        reason: '계정 묶음 귀속추천 무시 제외 해제',
      });
    });

    appendAttributionAuditLogs(newLogs);

    setFeedbackMsg({
      type: 'success',
      text: `계정 묶음 ${group.months.length}건의 추천 제외 설정을 해제했습니다.`
    });
    setSelectedRecommendationGroupIds(prev => {
      const next = new Set(prev);
      next.delete(group.groupId);
      return next;
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
    loadData();
  };

  // Actions: Bulk Action Applied Selected
  const handleApplySelectedRows = () => {
    if (recommendationViewMode === 'GROUPED') {
      if (selectedRecommendationGroupIds.size === 0) {
        showAlert('선택 항목 적용', '선택한 그룹 항목이 없습니다.');
        return;
      }

      const targets = groupedRecommendationRows.filter(
        g => selectedRecommendationGroupIds.has(g.groupId)
      );

      const actionableRowIds = new Set<string | number>();
      targets.forEach(g => {
        g.months.filter(m => m.status === '대기').forEach(m => {
          actionableRowIds.add(m.rowId);
        });
      });

      if (actionableRowIds.size === 0) {
        showAlert('선택 항목 적용', '선택한 그룹 중 적용 가능한 대기 상태 추천 건이 없습니다.');
        return;
      }

      showConfirm(
        '선택 항목 적용',
        `선택한 ${targets.length}개 그룹 (총 ${actionableRowIds.size}건의 월별 항목)을 추천 귀속부서로 적용하시겠습니까?`,
        () => {
          const actKey = getActualDataKey(year);
          const storedActuals = getStoredActualRows();
          const opName = currentUser?.name || '기획재무담당';
          const newLogs: any[] = [];
          let count = 0;

          const updated = storedActuals.map((row: any) => {
            if (actionableRowIds.has(row.id)) {
              count++;
              let matchRow: any = null;
              for (const g of targets) {
                const found = g.months.find(m => m.rowId === row.id);
                if (found) {
                  matchRow = found;
                  break;
                }
              }

              const recDeptCode = matchRow?.recommendedDeptCode || '';
              const recDeptName = matchRow?.recommendedDeptName || '';
              const reasons = matchRow ? matchRow.reasons.map((r: any) => r.label) : [];

              newLogs.push({
                id: `${Date.now()}_sel_${Math.random().toString(36).substring(2, 7)}`,
                time: new Date().toLocaleString(),
                action: '추천 적용 (계정 묶음 선택)',
                accountCode: row.accountCode,
                accountName: row.accountName,
                originalDeptName: `[${row.usageCode}] ${row.usageDept || row.usageCode}`,
                beforeAttributedDeptName: row.attributedDeptCode 
                  ? `[${row.attributedDeptCode}] ${row.attributedDeptName}` 
                  : '원 사용처 기준',
                afterAttributedDeptName: `[${recDeptCode}] ${recDeptName}`,
                user: opName,
                reason: '계정 묶음 선택 일괄 적용 - ' + reasons.join(', '),
              });

              return {
                ...row,
                usageCode: row.usageCode,
                usageDept: row.usageDept,
                attributedDeptCode: recDeptCode,
                attributedDeptName: recDeptName,
                attributionSource: 'recommendation',
                attributionScore: matchRow?.score || 0,
                attributionReasons: reasons,
                attributionUpdatedAt: new Date().toISOString(),
              };
            }
            return row;
          });

          localStorage.setItem(actKey, JSON.stringify(updated));
          appendAttributionAuditLogs(newLogs);
          clearDataLoaderCache();

          setFeedbackMsg({
            type: 'success',
            text: `선택하신 ${targets.length}개 그룹 (총 ${count}건)에 대해 실적 귀속부서를 적용했습니다.`
          });
          resetAttributionSelections();
          setTimeout(() => setFeedbackMsg(null), 3000);
          loadData();
        },
        '적용'
      );
      return;
    }

    if (selectedRowIds.size === 0) {
      showAlert('선택 항목 적용', '선택한 항목이 없습니다.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      showAlert('선택 항목 적용', '선택한 항목 중 적용 가능한 추천 건이 없습니다.');
      return;
    }

    showConfirm(
      '선택 항목 적용',
      `선택한 ${targets.length}건을 추천 귀속부서로 적용하시겠습니까?`,
      () => {
        const actKey = getActualDataKey(year);
        const storedActuals = getStoredActualRows();
        const opName = currentUser?.name || '기획재무담당';
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
        appendAttributionAuditLogs(newLogs);
        clearDataLoaderCache();

        setFeedbackMsg({
          type: 'success',
          text: `선택하신 ${count}건에 대해 실적 귀속부서를 적용했습니다.`
        });
        resetAttributionSelections();
        setTimeout(() => setFeedbackMsg(null), 3000);
        loadData();
      },
      '적용'
    );
  };

  // Actions: Bulk Action Ignore Selected
  const handleIgnoreSelectedRows = () => {
    if (recommendationViewMode === 'GROUPED') {
      if (selectedRecommendationGroupIds.size === 0) {
        showAlert('선택 항목 무시', '선택한 그룹 항목이 없습니다.');
        return;
      }

      const targets = groupedRecommendationRows.filter(
        g => selectedRecommendationGroupIds.has(g.groupId)
      );

      const actionableRowIds = new Set<string | number>();
      targets.forEach(g => {
        g.months.forEach(m => {
          actionableRowIds.add(m.rowId);
        });
      });

      if (actionableRowIds.size === 0) {
        showAlert('선택 항목 무시', '선택한 그룹 중 무시 가능한 추천 건이 없습니다.');
        return;
      }

      showConfirm(
        '선택 항목 무시',
        `선택한 ${targets.length}개 그룹 (총 ${actionableRowIds.size}건의 월별 항목)을 추천 귀속에서 무시하여 제외하시겠습니까?`,
        () => {
          const nextSet = new Set<string | number>(excludedRowIds);
          const newLogs: any[] = [];

          targets.forEach(g => {
            g.months.forEach(item => {
              nextSet.add(item.rowId);
              newLogs.push({
                id: `${Date.now()}_selig_${Math.random().toString(36).substring(2, 7)}`,
                time: new Date().toLocaleString(),
                action: '추천 무시 (계정 묶음 선택)',
                accountCode: item.accountCode,
                accountName: item.accountName,
                originalDeptName: `[${item.originalDeptCode}] ${item.originalDeptName}`,
                beforeAttributedDeptName: item.currentAttributedDeptCode 
                  ? `[${item.currentAttributedDeptCode}] ${item.currentAttributedDeptName}` 
                  : '원 사용처 기준',
                afterAttributedDeptName: '사용자 추천 제외 처리 (숨김)',
                user: currentUser?.name || '업무담당자',
                reason: '계정 묶음 선택 일괄 무시 처리',
              });
            });
          });

          saveExcludedRowIds(nextSet);
          appendAttributionAuditLogs(newLogs);

          setFeedbackMsg({
            type: 'success',
            text: `선택하신 ${targets.length}개 그룹 (총 ${actionableRowIds.size}건)의 항목이 추천 무시 처리되었습니다.`
          });
          resetAttributionSelections();
          setTimeout(() => setFeedbackMsg(null), 3000);
          loadData();
        },
        '무시'
      );
      return;
    }

    if (selectedRowIds.size === 0) {
      showAlert('선택 항목 무시', '선택한 항목이 없습니다.');
      return;
    }

    const targets = filteredRecommendationRows.filter(
      r => selectedRowIds.has(r.rowId) && r.status === '대기'
    );

    if (targets.length === 0) {
      showAlert('선택 항목 무시', '선택한 항목 중 무시 처리 가능한 추천 건이 없습니다.');
      return;
    }

    showConfirm(
      '선택 항목 무시',
      `선택한 ${targets.length}건을 추천 귀속에서 제외하시겠습니까?`,
      () => {
        const nextSet = new Set<string | number>(excludedRowIds);
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
        appendAttributionAuditLogs(newLogs);

        setFeedbackMsg({
          type: 'success',
          text: `${targets.length}건의 항목이 추천 무시 처리되었습니다.`
        });
        resetAttributionSelections();
        setTimeout(() => setFeedbackMsg(null), 3000);
        loadData();
      },
      '무시'
    );
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

  const handleToggleSelectGroup = (groupId: string) => {
    setSelectedRecommendationGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleToggleAllSelectGroups = () => {
    const actionableGroups = groupedRecommendationRows.filter(g => g.months.some(m => m.status === '대기'));
    const allSelected = actionableGroups.length > 0 && actionableGroups.every(g => selectedRecommendationGroupIds.has(g.groupId));
    if (allSelected) {
      setSelectedRecommendationGroupIds(new Set());
    } else {
      setSelectedRecommendationGroupIds(new Set(actionableGroups.map(g => g.groupId)));
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setPlanType('실적');
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
          {/* Plan Type (데이터 구분) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-zinc-400">데이터 구분</span>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value as any)}
              className="px-2 py-1 text-xs border border-[#008f83] rounded bg-white font-medium text-zinc-800"
            >
              <option value="실적">실적</option>
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
            {planType === '실적' && (
              <span className="mt-0.5 text-[9px] leading-tight text-zinc-400">
                추천 기준: 경영계획
              </span>
            )}
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
              onClick={handleApplySelectedRows}
              disabled={recommendationViewMode === 'GROUPED' ? selectedRecommendationGroupIds.size === 0 : selectedRowIds.size === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border transition ${
                (recommendationViewMode === 'GROUPED' ? selectedRecommendationGroupIds.size > 0 : selectedRowIds.size > 0)
                  ? 'border-[#008f83] text-[#008f83] bg-emerald-50/20 hover:bg-emerald-50/50 cursor-pointer'
                  : 'border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed'
              }`}
            >
              {recommendationViewMode === 'GROUPED'
                ? `선택 계정 묶음 추천 적용 (${selectedRecommendationGroupIds.size}개 그룹)`
                : `선택 개별 항목 추천 적용 (${selectedRowIds.size}건)`}
            </button>

            <button
              onClick={handleIgnoreSelectedRows}
              disabled={recommendationViewMode === 'GROUPED' ? selectedRecommendationGroupIds.size === 0 : selectedRowIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recommendationViewMode === 'GROUPED'
                ? `선택 계정 묶음 추천 무시 (${selectedRecommendationGroupIds.size}개 그룹)`
                : `선택 개별 항목 추천 무시 (${selectedRowIds.size}건)`}
            </button>

            <button
              onClick={() => {
                reloadAuditLogs();
                setShowHistory(!showHistory);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-bold border transition transition-all cursor-pointer ${
                showHistory ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? '이력 닫기' : '귀속 보정 이력'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Contents Area: Full width table representation with inline detail rows */}
      <div className="flex flex-col gap-4">
        
        {/* Tabs Control */}
        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-xl max-w-fit border border-zinc-200">
          <button
            type="button"
            onClick={() => {
              setActiveAttributionTab('ALL');
              setSelectedRowId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeAttributionTab === 'ALL'
                ? 'bg-white text-[#008f83] shadow-sm'
                : 'text-zinc-600 hover:text-[#008f83] hover:bg-white/50'
            }`}
          >
            전체 실적 [ALL]
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeAttributionTab === 'ALL' ? 'bg-[#008f83] text-white' : 'bg-zinc-200 text-zinc-650'
            }`}>
              {tabCounts.ALL}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveAttributionTab('RECOMMENDED');
              setSelectedRowId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeAttributionTab === 'RECOMMENDED'
                ? 'bg-white text-[#008f83] shadow-sm'
                : 'text-zinc-600 hover:text-[#008f83] hover:bg-white/50'
            }`}
          >
            추천 필요 [RECOMMENDED]
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeAttributionTab === 'RECOMMENDED' ? 'bg-[#008f83] text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {tabCounts.RECOMMENDED}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveAttributionTab('EXCLUDED');
              setSelectedRowId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeAttributionTab === 'EXCLUDED'
                ? 'bg-white text-[#008f83] shadow-sm'
                : 'text-zinc-600 hover:text-[#008f83] hover:bg-white/50'
            }`}
          >
            추천 제외 [EXCLUDED]
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeAttributionTab === 'EXCLUDED' ? 'bg-[#008f83] text-white' : 'bg-red-100 text-red-800'
            }`}>
              {tabCounts.EXCLUDED}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveAttributionTab('APPLIED');
              setSelectedRowId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeAttributionTab === 'APPLIED'
                ? 'bg-white text-[#008f83] shadow-sm'
                : 'text-zinc-600 hover:text-[#008f83] hover:bg-white/50'
            }`}
          >
            보정 적용 [APPLIED]
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeAttributionTab === 'APPLIED' ? 'bg-[#008f83] text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {tabCounts.APPLIED}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveAttributionTab('IGNORED');
              setSelectedRowId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeAttributionTab === 'IGNORED'
                ? 'bg-white text-[#008f83] shadow-sm'
                : 'text-zinc-600 hover:text-[#008f83] hover:bg-white/50'
            }`}
          >
            무시됨 [IGNORED]
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeAttributionTab === 'IGNORED' ? 'bg-[#008f83] text-white' : 'bg-zinc-200 text-zinc-600'
            }`}>
              {tabCounts.IGNORED}
            </span>
          </button>
        </div>

        {/* Table list is full width */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex flex-col items-start gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-800">1. 귀속 추천 목록 (추천 귀속부서 목록)</span>
                <span className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100">AI 자동 부서추천</span>
              </div>
              <span className="text-[11px] text-zinc-500">
                경영계획 예산 배치 기준 및 타 부서 실적 사용 이력을 분석하여 귀속 보정이 유력한 실적을 자동으로 추출하여 추천합니다.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11.5px] font-mono text-zinc-500">
                조회 결과:{' '}
                <strong>
                  {recommendationViewMode === 'GROUPED'
                    ? `${groupedRecommendationRows.length}개 그룹`
                    : `${filteredAndSortedRecommendationRows.length}건`}
                </strong>{' '}
                / 전체 {allRecommendationRows.length}건
              </span>
              <span className="text-zinc-350">|</span>
              <div className="flex bg-zinc-200/60 p-0.5 rounded-lg border border-zinc-200/30">
                <button
                  type="button"
                  onClick={() => {
                    setRecommendationViewMode('GROUPED');
                    setSelectedRowId(null);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition select-none ${
                    recommendationViewMode === 'GROUPED'
                      ? 'bg-[#008f83] text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  계정별 묶음 보기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecommendationViewMode('ROW');
                    setSelectedRowId(null);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition select-none ${
                    recommendationViewMode === 'ROW'
                      ? 'bg-[#008f83] text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  건별 상세 보기
                </button>
              </div>
              <span className="text-zinc-350">|</span>
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
                                recommendationViewMode === 'GROUPED'
                                  ? (groupedRecommendationRows.filter(g => g.months.some(m => m.status === '대기')).length > 0 &&
                                     groupedRecommendationRows.filter(g => g.months.some(m => m.status === '대기')).every(g => selectedRecommendationGroupIds.has(g.groupId)))
                                  : (filteredAndSortedRecommendationRows.length > 0 &&
                                     filteredAndSortedRecommendationRows.filter(r => r.status === '대기').every(r => selectedRowIds.has(r.rowId)))
                              }
                              onChange={
                                recommendationViewMode === 'GROUPED'
                                  ? handleToggleAllSelectGroups
                                  : handleToggleAllSelect
                              }
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
                {recommendationViewMode === 'GROUPED' ? (
                  groupedRecommendationRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-zinc-400">
                        지정된 조건에 부합하는 귀속 추천 그룹이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    visibleGroupedRows.map(group => {
                      const isSelected = selectedGroupId === group.groupId;
                      const isChecked = selectedRecommendationGroupIds.has(group.groupId);

                      // Determine uniform or mixed status
                      const pendingCount = group.months.filter(m => m.status === '대기').length;
                      const appliedCount = group.months.filter(m => m.status === '적용됨').length;
                      const manualCount = group.months.filter(m => m.status === '수동 변경').length;
                      const ignoredCount = group.months.filter(m => m.status === '무시됨').length;

                      let statusBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                          대기
                        </span>
                      );
                      if (pendingCount === group.months.length) {
                        statusBadge = <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">대기</span>;
                      } else if (appliedCount === group.months.length) {
                        statusBadge = <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">적용됨</span>;
                      } else if (ignoredCount === group.months.length) {
                        statusBadge = <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 text-zinc-600 font-bold">무시됨</span>;
                      } else if (manualCount === group.months.length) {
                        statusBadge = <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold">수동 변경</span>;
                      } else {
                        statusBadge = (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 cursor-help"
                            title={`대기: ${pendingCount}건, 적용: ${appliedCount}건, 수정: ${manualCount}건, 무시: ${ignoredCount}건`}
                          >
                            혼합상태 ({group.months.length}건)
                          </span>
                        );
                      }

                      // Uniform current department code
                      const uniqueCurrentCodes = Array.from(new Set(group.months.map(m => m.currentAttributedDeptCode || '')));
                      const isUniformCurrent = uniqueCurrentCodes.length === 1;
                      const uniformCode = uniqueCurrentCodes[0];
                      const uniformName = group.months.find(m => m.currentAttributedDeptCode === uniformCode)?.currentAttributedDeptName || '';

                      return (
                        <React.Fragment key={group.groupId}>
                          <tr 
                            onClick={() => {
                              setEditingGroupRowId(null);
                              setDraftAttributedDeptCode('');
                              setSelectedGroupId(prev => prev === group.groupId ? null : group.groupId);
                            }}
                            className={`hover:bg-zinc-50/60 transition-all cursor-pointer ${
                              isSelected ? 'bg-emerald-50/20 border-l-2 border-[#008f83]' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {group.months.some(m => m.status === '대기') ? (
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectGroup(group.groupId)}
                                  className="rounded accent-[#008f83]"
                                />
                              ) : (
                                <span className="text-zinc-300 font-mono text-[10px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono font-medium text-zinc-500">
                              <span className="inline-block px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded text-[10px] font-bold">
                                {group.monthLabels}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-zinc-700">{group.accountCode}</td>
                            <td className="py-3 px-3">
                              <span className="block truncate font-bold text-zinc-900" title={group.accountName}>
                                {group.accountName}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="block truncate text-zinc-650" title={`[${group.originalDeptCode}] ${group.originalDeptName}`}>
                                {renderDeptCellContent(group.originalDeptCode, group.originalDeptName)}
                              </span>
                            </td>
                            <td
                              className="py-3 px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupId(null);
                                setEditingGroupRowId(prev => {
                                  const next = prev === group.groupId ? null : group.groupId;
                                  if (next !== null) {
                                    setDraftAttributedDeptCode(
                                      uniformCode || group.originalDeptCode
                                    );
                                  }
                                  return next;
                                });
                              }}
                            >
                              {editingGroupRowId === group.groupId ? (
                                <div className="min-w-[220px] rounded-lg border border-[#008f83]/30 bg-white p-2 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                  <div className="mb-1 text-[10px] font-bold text-zinc-500">
                                    그룹 전체 귀속부서 변경
                                  </div>
                                  <select
                                    value={draftAttributedDeptCode}
                                    onChange={(e) => setDraftAttributedDeptCode(e.target.value)}
                                    className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium outline-none focus:border-[#008f83]"
                                  >
                                    <option value={group.originalDeptCode}>
                                      원 사용처 기준 [{group.originalDeptCode}] {group.originalDeptName}
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
                                      onClick={() => {
                                        setEditingGroupRowId(null);
                                        setDraftAttributedDeptCode('');
                                      }}
                                      className="rounded border border-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                                    >
                                      취소
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!draftAttributedDeptCode) return;
                                        if (draftAttributedDeptCode === group.originalDeptCode) {
                                          handleRevertAttributionGroup(group);
                                        } else {
                                          handleApplyManualChangeGroup(group, draftAttributedDeptCode);
                                        }
                                        setEditingGroupRowId(null);
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
                                  title="그룹 전체 귀속부서 변경"
                                >
                                  {isUniformCurrent && uniformCode ? (
                                    <span className="block truncate font-semibold text-[#008f83]">
                                      {renderDeptCellContent(uniformCode, uniformName)}
                                    </span>
                                  ) : !isUniformCurrent ? (
                                    <span className="block truncate font-bold text-indigo-600">
                                      혼합 ({uniqueCurrentCodes.length}개 부서)
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
                              {group.recommendedDeptCode ? (
                                <span
                                  className="block truncate text-left font-bold text-[#008f83]"
                                  title="귀속 추천 정보"
                                >
                                  {renderDeptCellContent(group.recommendedDeptCode, group.recommendedDeptName)}
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-mono">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-zinc-800" title={`${(group.totalAmount || 0).toLocaleString()}원`}>
                              {formatMillionWon(group.totalAmount || 0)}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {statusBadge}
                            </td>
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-center">
                                {pendingCount > 0 && (
                                  <>
                                    <button
                                      onClick={() => handleApplyRecommendationGroup(group)}
                                      className="px-1.5 py-0.5 bg-[#008f83] hover:bg-[#00746b] text-white rounded font-bold transition text-[10px] select-none cursor-pointer"
                                    >
                                      적용
                                    </button>
                                    <button
                                      onClick={() => handleIgnoreRecommendationGroup(group)}
                                      className="px-1.5 py-0.5 bg-zinc-150 border border-zinc-200 hover:bg-zinc-200 text-zinc-650 rounded font-bold transition text-[10px] select-none cursor-pointer"
                                    >
                                      무시
                                    </button>
                                  </>
                                )}
                                {pendingCount === 0 && (appliedCount > 0 || manualCount > 0) && (
                                  <button
                                    onClick={() => handleRevertAttributionGroup(group)}
                                    className="px-1.5 py-0.5 border border-red-200 text-red-650 hover:bg-red-50 rounded font-bold transition text-[10px] select-none cursor-pointer"
                                    title="그룹 전체 원 사용처 기준으로 귀속 원복"
                                  >
                                    원복
                                  </button>
                                )}
                                {pendingCount === 0 && ignoredCount > 0 && (
                                  <button
                                    onClick={() => handleUndoIgnoreGroup(group)}
                                    className="px-1.5 py-0.5 border border-zinc-300 text-zinc-650 hover:bg-zinc-100 rounded font-semibold transition text-[10px] select-none cursor-pointer"
                                  >
                                    무시취소
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {isSelected && (
                            <tr className="bg-zinc-50 border-t border-b border-zinc-200 pointer-events-auto">
                              <td colSpan={10} className="p-4" onClick={(e) => e.stopPropagation()}>
                                <div className="bg-white rounded-lg border border-zinc-200 shadow-xs p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-zinc-700">
                                      [계정별 세부 항목] {group.accountCode} - {group.accountName} ({group.months.length}건)
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => setSelectedGroupId(null)}
                                      className="text-[11px] text-[#008f83] hover:underline cursor-pointer select-none"
                                    >
                                      접기 ▲
                                    </button>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                      <thead>
                                        <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                                          <th className="py-2 px-2 text-center" style={{ width: '60px' }}>선택</th>
                                          <th className="py-2 px-2 text-center" style={{ width: '80px' }}>기간</th>
                                          <th className="py-2 px-2 text-left" style={{ width: '180px' }}>원 사용처</th>
                                          <th className="py-2 px-2 text-left" style={{ width: '220px' }}>현재 귀속부서</th>
                                          <th className="py-2 px-2 text-left" style={{ width: '220px' }}>귀속 추천부서</th>
                                          <th className="py-2 px-2 text-right" style={{ width: '120px' }}>실적 금액</th>
                                          <th className="py-2 px-2 text-center" style={{ width: '120px' }}>귀속 상태</th>
                                          <th className="py-2 px-2 text-center" style={{ width: '120px' }}>작업</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100">
                                        {group.months.map(subItem => {
                                          const isSubChecked = selectedRowIds.has(subItem.rowId);
                                          return (
                                            <tr key={subItem.rowId} className="hover:bg-zinc-50/50">
                                              <td className="py-2 px-2 text-center">
                                                {subItem.status === '대기' ? (
                                                  <input 
                                                    type="checkbox"
                                                    checked={isSubChecked}
                                                    onChange={() => handleToggleSelectRow(subItem.rowId)}
                                                    className="rounded accent-[#008f83] cursor-pointer"
                                                  />
                                                ) : (
                                                  <span className="text-zinc-300">-</span>
                                                )}
                                              </td>
                                              <td className="py-2 px-2 text-center font-mono font-medium text-zinc-500">{subItem.period}</td>
                                              <td className="py-2 px-2 text-left truncate max-w-[180px]" title={`[${subItem.originalDeptCode}] ${subItem.originalDeptName}`}>
                                                [{subItem.originalDeptCode}] {subItem.originalDeptName}
                                              </td>
                                              <td className="py-2 px-2 text-left">
                                                {editingAttributionRowId === subItem.rowId ? (
                                                  <div className="rounded border border-[#008f83]/30 bg-white p-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                      value={draftAttributedDeptCode}
                                                      onChange={(e) => setDraftAttributedDeptCode(e.target.value)}
                                                      className="w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-[10px] focus:border-[#008f83]"
                                                    >
                                                      <option value={subItem.originalDeptCode}>
                                                        원 사용처 [{subItem.originalDeptCode}]
                                                      </option>
                                                      {allDepts.map(d => (
                                                        <option key={d.code} value={d.code}>
                                                          [{d.code}] {d.name}
                                                        </option>
                                                      ))}
                                                    </select>
                                                    <div className="mt-1 flex justify-end gap-1 text-[9px]">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setEditingAttributionRowId(null);
                                                          setDraftAttributedDeptCode('');
                                                        }}
                                                        className="px-1 border border-zinc-200 rounded text-zinc-500 hover:bg-zinc-50"
                                                      >
                                                        취소
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (!draftAttributedDeptCode) return;
                                                          if (draftAttributedDeptCode === subItem.originalDeptCode) {
                                                            handleRevertAttribution(subItem.rowId);
                                                          } else {
                                                            handleApplyManualChange(subItem.rowId, draftAttributedDeptCode);
                                                          }
                                                          setEditingAttributionRowId(null);
                                                          setDraftAttributedDeptCode('');
                                                        }}
                                                        className="px-1 bg-[#008f83] text-white rounded hover:bg-[#00746b]"
                                                      >
                                                        적용
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingAttributionRowId(subItem.rowId);
                                                      setDraftAttributedDeptCode(subItem.currentAttributedDeptCode || subItem.originalDeptCode);
                                                    }}
                                                    className="text-left font-medium text-zinc-650 hover:bg-zinc-100 px-1 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                                  >
                                                    {subItem.currentAttributedDeptCode ? (
                                                      <span className="text-[#008f83] font-bold">
                                                        [{subItem.currentAttributedDeptCode}] {subItem.currentAttributedDeptName}
                                                      </span>
                                                    ) : (
                                                      <span className="text-zinc-400">원 사용처 기준</span>
                                                    )}
                                                    <span className="text-[9px] text-[#008f83] hover:underline shrink-0">변경</span>
                                                  </button>
                                                )}
                                              </td>
                                              <td className="py-2 px-2 text-left truncate max-w-[200px]" title={`[${subItem.recommendedDeptCode}] ${subItem.recommendedDeptName}`}>
                                                [{subItem.recommendedDeptCode}] {subItem.recommendedDeptName}
                                              </td>
                                              <td className="py-2 px-2 text-right font-mono text-zinc-800 font-medium">
                                                {formatMillionWon(subItem.amount)}
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <span className={`px-1 rounded text-[9px] font-bold ${
                                                  subItem.status === '적용됨' 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : subItem.status === '무시됨' 
                                                    ? 'bg-zinc-200 text-zinc-600' 
                                                    : subItem.status === '수동 변경' 
                                                    ? 'bg-blue-100 text-blue-800' 
                                                    : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                  {subItem.status}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1 justify-center text-[9px]">
                                                  {subItem.status === '대기' && (
                                                    <>
                                                      <button
                                                        onClick={() => handleApplyRecommendation(
                                                          subItem.rowId, 
                                                          subItem.recommendedDeptCode, 
                                                          subItem.recommendedDeptName, 
                                                          subItem.reasons.map(r => r.label), 
                                                          subItem.score
                                                        )}
                                                        className="px-1 py-0.5 bg-[#008f83] text-white rounded font-bold hover:bg-[#00746b] cursor-pointer"
                                                      >
                                                        적용
                                                      </button>
                                                      <button
                                                        onClick={() => handleIgnoreRecommendation(subItem.rowId)}
                                                        className="px-1 py-0.5 border border-zinc-200 text-zinc-600 rounded bg-zinc-50 hover:bg-zinc-100 cursor-pointer"
                                                      >
                                                        무시
                                                      </button>
                                                    </>
                                                  )}
                                                  {(subItem.status === '적용됨' || subItem.status === '수동 변경') && (
                                                    <button
                                                      onClick={() => handleRevertAttribution(subItem.rowId)}
                                                      className="px-1 py-0.5 border border-red-200 text-red-650 hover:bg-red-50 rounded cursor-pointer"
                                                    >
                                                      원복
                                                    </button>
                                                  )}
                                                  {subItem.status === '무시됨' && (
                                                    <button
                                                      onClick={() => handleUndoIgnore(subItem.rowId)}
                                                      className="px-1 py-0.5 border border-zinc-300 text-zinc-650 hover:bg-zinc-100 rounded cursor-pointer"
                                                    >
                                                      무시취소
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )
                ) : filteredAndSortedRecommendationRows.length === 0 ? (
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
                            <span className="block truncate text-zinc-650" title={`[${item.originalDeptCode}] ${item.originalDeptName}`}>
                              {renderDeptCellContent(item.originalDeptCode, item.originalDeptName)}
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
                                    {renderDeptCellContent(item.currentAttributedDeptCode, item.currentAttributedDeptName)}
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
                                {renderDeptCellContent(item.recommendedDeptCode, item.recommendedDeptName)}
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
        <div
          onClick={() => {
            setIsManualGridOpen(prev => {
              const next = !prev;
              if (next) setManualRowsLoaded(true);
              return next;
            });
          }}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-zinc-50 border-b border-zinc-200 cursor-pointer text-left select-none"
        >
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-800">2. 전체 실적 직접 보정 목록 (전체 실적 데이터 목록)</span>
              <span className="inline-block px-1.5 py-0.5 bg-[#008f83]/10 text-[#008f83] text-[10px] font-bold rounded border border-[#008f83]/20">전체 실적 대상</span>
            </div>
            <span className="text-[11px] text-zinc-500">
              추천 대상 여부와 무관하게 업로드된 모든 실적 데이터를 이 테이블에서 직접 찾고 귀속부서를 선택하여 개별 보정할 수 있습니다. (클릭하여 열기)
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
        </div>

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
                          {renderDeptCellContent(row.originalDeptCode, row.originalDeptName)}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[180px]">
                          {row.currentDeptCode !== row.originalDeptCode ? (
                            <span className="font-bold text-[#008f83]" title={`[${row.currentDeptCode}] ${row.currentDeptName}`}>
                              {renderDeptCellContent(row.currentDeptCode, row.currentDeptName)}
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



      {/* 5. Audit History Log Table representation (Absolute Dialog Modal) */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4" id="history-modal-overlay">
          <div className="w-[1000px] max-w-[calc(100vw-32px)] max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-5 py-4 text-white">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-[#008f83]" />
                  실적 및 귀속 처리 감사 이력
                </h3>
                <p className="mt-0.5 text-[11px] text-zinc-300">
                  귀속부서 추천 반영/수동 변경/원복/무시 보정 이력 및 실적 업로드 로그를 한눈에 모니터링합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 shadow-xs cursor-pointer transition"
              >
                닫기
              </button>
            </div>

            {/* Modal Tab Controller */}
            <div className="px-5 py-2.5 bg-zinc-100/70 border-b border-zinc-200 flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryModalTab('ATTRIBUTION')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${
                  historyModalTab === 'ATTRIBUTION' 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-600 hover:text-zinc-805 hover:bg-zinc-200'
                }`}
              >
                귀속 보정 이력 ({auditLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryModalTab('UPLOAD')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${
                  historyModalTab === 'UPLOAD' 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-600 hover:text-zinc-805 hover:bg-zinc-200'
                }`}
              >
                실적 업로드 이력 ({uploadHistory.length})
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto max-h-[calc(85vh-130px)]">
              {/* TAB 1: Attribution Change History */}
              {historyModalTab === 'ATTRIBUTION' && (
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-bold">
                      총 {auditLogs.length}건의 귀속 보정 이력이 존재합니다.
                    </span>
                    {auditLogs.length > 0 && (
                      <button
                        onClick={() => {
                          showConfirm(
                            '이력 전체 비우기',
                            '모든 로컬 귀속 보정 이력을 비우시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                            () => {
                              localStorage.removeItem('hycm_attribution_audit_log');
                              setAuditLogs([]);
                            },
                            '비우기'
                          );
                        }}
                        className="text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 font-bold text-[11px] px-2.5 py-1 rounded-md transition cursor-pointer"
                      >
                        귀속 이력 전체 비우기
                      </button>
                    )}
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold font-sans text-[10.5px]">
                          <th className="py-2.5 px-4 w-40">시간</th>
                          <th className="py-2.5 px-3 w-28">작업</th>
                          <th className="py-2.5 px-3">계정과목 (코드/명)</th>
                          <th className="py-2.5 px-3">원본 사용처</th>
                          <th className="py-2.5 px-3">변경 전 귀속부서</th>
                          <th className="py-2.5 px-3">변경 후 귀속부서</th>
                          <th className="py-2.5 px-3 text-center w-24">처리자</th>
                          <th className="py-2.5 px-4">사유 및 상세</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-sans text-zinc-650">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-14 text-center text-zinc-500 leading-relaxed font-sans">
                              <div className="text-zinc-700 font-extrabold text-[12.5px] mb-1">
                                아직 귀속부서 보정 이력이 없습니다.
                              </div>
                              <div className="text-[11px] text-zinc-400 max-w-md mx-auto">
                                실적 업로드만으로는 이력이 생성되지 않으며, 추천 적용·수동 변경·원복·무시 처리 시 이력이 기록됩니다.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-50/55 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-medium text-zinc-400">{log.time}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold inline-block ${
                                  log.action?.includes('일괄') || log.action?.includes('적용')
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : log.action === '수동 변경' 
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                    : log.action === '원복' 
                                    ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                                    : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-zinc-800">
                                <span className="font-mono bg-zinc-100 text-zinc-500 text-[10px] px-1 py-0.5 rounded mr-1.5">
                                  {log.accountCode}
                                </span>
                                {log.accountName}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-zinc-500">{log.originalDeptName}</td>
                              <td className="py-2.5 px-3 text-zinc-455">
                                {log.beforeAttributedDeptName}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-zinc-900">
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

              {/* TAB 2: Actuals Upload History */}
              {historyModalTab === 'UPLOAD' && (
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-bold">
                      총 {uploadHistory.length}건의 업로드 저장 이력이 존재합니다.
                    </span>
                    {uploadHistory.length > 0 && (
                      <button
                        onClick={() => {
                          showConfirm(
                            '업로드 이력 전체 비우기',
                            '모든 로컬 업로드 이력을 비우시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                            () => {
                              localStorage.removeItem('hycm_actual_upload_history');
                              setUploadHistory([]);
                            },
                            '비우기'
                          );
                        }}
                        className="text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 font-bold text-[11px] px-2.5 py-1 rounded-md transition cursor-pointer"
                      >
                        업로드 이력 전체 비우기
                      </button>
                    )}
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold font-sans text-[10.5px]">
                          <th className="py-2.5 px-4 w-44">시간</th>
                          <th className="py-2.5 px-3 w-16 text-center">연도</th>
                          <th className="py-2.5 px-3 w-24 text-center">업로드 대상</th>
                          <th className="py-2.5 px-3 w-28 text-right">반영 행(Row) 수</th>
                          <th className="py-2.5 px-3 text-center w-24">처리자</th>
                          <th className="py-2.5 px-4">월별 반영 상세 요약</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-sans text-zinc-650">
                        {uploadHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-14 text-center text-zinc-400 font-sans">
                              <div className="text-zinc-600 font-bold text-[12.5px] mb-1">
                                아직 업로드 저장 이력이 존재하지 않습니다.
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                실적 업로드 엑셀 업로드 완료 후 데이터 저장 시 보정이력이 아닌 업로드 이력으로 여기에 자동 로깅됩니다.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          uploadHistory.map((history) => (
                            <tr key={history.id} className="hover:bg-zinc-50/55 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-medium text-zinc-400">{history.time}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-zinc-700">{history.year}년</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                                  history.target === '실적' 
                                    ? 'bg-[#008f83]/10 text-[#008f83]' 
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  {history.target}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-800">
                                {history.rowCount?.toLocaleString()}건
                              </td>
                              <td className="py-2.5 px-3 text-center text-zinc-550 font-medium">{history.user}</td>
                              <td className="py-2.5 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(history.monthSummary || {}).map(([m, cnt]) => (
                                    <span key={m} className="inline-flex items-center gap-1 bg-zinc-100 border border-zinc-200/60 text-[10px] px-1.5 py-0.5 rounded text-zinc-600 font-mono font-semibold">
                                      {m === '미지정' ? '미지정' : `${m}월`}: <span className="text-[#008f83] font-bold">{cnt}건</span>
                                    </span>
                                  ))}
                                </div>
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
          </div>
        </div>
      )}

      {/* Dynamic Overlay Confirm / Alert Modal */}
      {confirmState.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" id="att-confirm-modal-overlay">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border border-zinc-150 shadow-2xl animate-in zoom-in-95 duration-200" id="att-confirm-modal-card">
            <div className="p-5" id="att-confirm-modal-body">
              <div className="flex items-center gap-2.5 mb-2.5" id="att-confirm-modal-header">
                <span className="w-2.5 h-2.5 rounded-full bg-[#008f83]" />
                <h3 className="text-[13px] font-black tracking-tight text-zinc-900">{confirmState.title}</h3>
              </div>
              <p className="text-xs text-zinc-650 leading-relaxed font-medium">
                {confirmState.description}
              </p>
            </div>
            <div className="bg-zinc-50 border-t border-zinc-150 px-4 py-3 flex justify-end gap-2" id="att-confirm-modal-footer">
              {!confirmState.isAlert && (
                <button
                  type="button"
                  onClick={() => setConfirmState(prev => ({ ...prev, open: false }))}
                  className="px-3 py-1.5 bg-[#f0f0f0] hover:bg-[#e4e4e4] text-zinc-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  id="att-btn-cancel"
                >
                  취소
                </button>
              )}
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className="px-3 py-1.5 bg-[#008f83] hover:bg-[#007b71] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                id="att-btn-confirm"
              >
                {confirmState.confirmText}
              </button>
            </div>
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
