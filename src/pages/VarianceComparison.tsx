import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, Minus, Download, FileSpreadsheet, Presentation, FileText, X, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, readBudgetData, getEffectiveDeptCodeForActual } from '../lib/storageKeys';
import { getDeptGroups, getDeptCodesByGroup, DeptGroup } from '../lib/departmentGroups';
import { normalizePlanType } from '../lib/planTypes';
import { usePermission } from '../lib/permissions';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { classifyAccount, ACCOUNT_CLASS_OPTIONS, ACCOUNTING_TYPE_OPTIONS, AccountClass, AccountingType, getAccountingType, isSalaryAccountRow } from '../lib/accountClassification';
import { isInvestmentAccount } from '../lib/accountMaster';
import { resolveAccountByCode } from '../lib/accountResolver';
import { ChartCard } from '../components/charts/ChartCard';
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';

import { buildAccountMetaIndex, AccountMeta } from '../lib/varianceAccountIndex';
import { loadActualRows, loadBudgetRowsByDept } from '../lib/varianceDataLoader';
import { buildAtomicCompareRows, buildVarianceComparison, resolveSelectedDeptCodes, AtomicCompareRow as EngineAtomicCompareRow, getVarianceStatus, VarianceStatus, resolveUnionMeta, normalizeCompareCode } from '../lib/varianceEngine';
import { calcVarianceRate, formatVarianceRate, toExcelPercentValue } from '../lib/varianceMath';
import { buildMonthlyMatrix, buildAccountMonthlyCompareRows, buildDeptMonthlyCompareRows, MonthlyCompareMatrixRow } from '../lib/varianceMonthlyExport';
import { BudgetPlanType } from '../lib/planTypes';
import { AppButton } from '../components/ui/AppButton';
import {
  MultiPlanDeptViewMode,
  MultiPlanCompareRow,
  MultiPlanColumnConfig,
  buildMultiPlanComparisonRows,
  resolveWriterDeptForMultiPlan,
  resolveAttributedDeptForMultiPlan,
  getRowKey
} from '../lib/multiPlanComparison';

let cachedPretendardBase64: string | null = null;
let XLSX: any = null;

function setFormulaCell(ws: any, rowIndex: number, colIndex: number, formula: string, numFmt?: string) {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  ws[addr] = {
    t: 'n',
    f: formula,
    ...(numFmt ? { z: numFmt } : {}),
  };
}

function cellRef(rowIndex: number, colIndex: number) {
  return XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
}

function colRef(colIndex: number) {
  return XLSX.utils.encode_col(colIndex);
}

function rowNo(rowIndex: number) {
  return rowIndex + 1;
}

function makeSumFormula(rowIndex: number, startCol: number, endCol: number) {
  const start = cellRef(rowIndex, startCol);
  const end = cellRef(rowIndex, endCol);
  return `SUM(${start}:${end})`;
}

function makeVarianceFormula(rowIndex: number, targetTotalCol: number, baseTotalCol: number) {
  return `${cellRef(rowIndex, targetTotalCol)}-${cellRef(rowIndex, baseTotalCol)}`;
}

function makeVarianceRateFormula(rowIndex: number, targetTotalCol: number, baseTotalCol: number) {
  const target = cellRef(rowIndex, targetTotalCol);
  const base = cellRef(rowIndex, baseTotalCol);
  return `IF(${base}=0,"",(${target}-${base})/${base})`;
}

function makeAccountingTypeSumFormula(
  accountingType: '제조' | '판관',
  colIndex: number,
  firstDataRow: number,
  lastDataRow: number
) {
  const accountingTypeCol = '$B';
  const col = colRef(colIndex);
  return `SUMIF(${accountingTypeCol}$${rowNo(firstDataRow)}:${accountingTypeCol}$${rowNo(lastDataRow)},"${accountingType}",${col}$${rowNo(firstDataRow)}:${col}$${rowNo(lastDataRow)})`;
}

function getCompareRowCode(row: any, isDeptMode: boolean): string {
  return isDeptMode
    ? row.deptCode || row.code || row.key || ''
    : row.accountCode || row.code || row.key || '';
}

function getCompareRowName(row: any, isDeptMode: boolean): string {
  return isDeptMode
    ? row.deptName || row.name || row.accountName || ''
    : row.accountName || row.name || '';
}

function getMultiPlanDeptDisplay(row: any, selectedDept: string, allDepts: any[], effectiveViewMode: string) {
  if (effectiveViewMode === 'BY_DEPT') {
    return {
      writerDeptCode: row.writerDeptCode || '',
      writerDeptName: row.writerDeptName || '',
      attributedDeptCode: row.attributedDeptCode || '',
      attributedDeptName: row.attributedDeptName || '',
    };
  }

  if (selectedDept === 'all' || selectedDept === 'viewable') {
    return {
      writerDeptCode: '',
      writerDeptName: '전체',
      attributedDeptCode: '',
      attributedDeptName: '전체',
    };
  }

  if (selectedDept === 'mfg') {
    return {
      writerDeptCode: '',
      writerDeptName: '제조 전체',
      attributedDeptCode: '',
      attributedDeptName: '제조 전체',
    };
  }

  if (selectedDept === 'sga') {
    return {
      writerDeptCode: '',
      writerDeptName: '판관 전체',
      attributedDeptCode: '',
      attributedDeptName: '판관 전체',
    };
  }

  const dept = allDepts.find(d => d.code === selectedDept);
  return {
    writerDeptCode: selectedDept,
    writerDeptName: dept?.name || selectedDept,
    attributedDeptCode: selectedDept,
    attributedDeptName: dept?.name || selectedDept,
  };
}

const getStatusBadgeStyle = (status: VarianceStatus) => {
  switch (status) {
    case '미계획':
      return 'text-[#0369a1] bg-[#f0f9ff] border border-[#bae6fd]';
    case '미발생':
      return 'text-[#c2410c] bg-[#fff7ed] border border-[#fed7aa]';
    case '증가':
      return 'text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca]';
    case '감소':
      return 'text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0]';
    case '변동없음':
      return 'text-[#4b5563] bg-[#f3f4f6]';
    case '사라짐':
      return 'text-[#4b5563] bg-[#f3f4f6] border border-[#d1d5db]';
    default:
      return 'bg-lithium-100 text-text-secondary';
  }
};

export default function VarianceComparison() {
  const { currentUser, isAdmin, isPlanningTeam, hasSalaryAccess, viewableDeptCodes, viewableDepts } = usePermission();

  const getUserInitDept = () => {
    if (currentUser) {
      if (isAdmin || isPlanningTeam) return 'all';
      const viewable = getViewableDepts(currentUser.code);
      return viewable.length > 0 ? viewable[0].code : currentUser.code;
    }
    return 'all';
  };

  const [baseYear, setBaseYear] = useState(() => localStorage.getItem('variance_baseYear') || '2026');
  const [basePlanType, setBasePlanType] = useState(() => normalizePlanType(localStorage.getItem('variance_basePlanType') || '경영계획'));
  const [baseMonthMode, setBaseMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [baseSelectedMonth, setBaseSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  
  const [targetYear, setTargetYear] = useState(() => localStorage.getItem('variance_targetYear') || '2026');
  const [targetPlanType, setTargetPlanType] = useState(() => normalizePlanType(localStorage.getItem('variance_targetPlanType') || '실적'));
  const [targetMonthMode, setTargetMonthMode] = useState<'MONTH' | 'YTD'>('YTD');
  const [targetSelectedMonth, setTargetSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  
  const [selectedDept, setSelectedDept] = useState(() => localStorage.getItem('variance_dept') || getUserInitDept());
  
  const [selectedAccountingType, setSelectedAccountingType] = useState<AccountingType>(() => {
    const old = localStorage.getItem('variance_accountCategory');
    if (old === '투자예산') return '투자';
    return (localStorage.getItem('variance_accountingType') as AccountingType) || '전체';
  });

  const [selectedAccountClass, setSelectedAccountClass] = useState<AccountClass>(() => {
    const old = localStorage.getItem('variance_accountCategory');
    if (old === '투자예산' || old === '일반비용') return '전체';
    if (old && ACCOUNT_CLASS_OPTIONS.includes(old as AccountClass)) return old as AccountClass;
    return (localStorage.getItem('variance_accountClass') as AccountClass) || '전체';
  });

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const tab = queryParams.get('tab') || 'default';
  const isDeptComparisonMode = tab === 'dept' || selectedDept === 'by_dept';
  const [increaseBasisCol, setIncreaseBasisCol] = useState('plan_증액반영');
  const [increaseTargetCol, setIncreaseTargetCol] = useState('plan_2차 RP');

  const [selectedPlanTypes, setSelectedPlanTypes] = useState<BudgetPlanType[]>([
    '증액반영',
    '1차 RP',
    '2차 RP',
  ]);
  const [planEndMonth, setPlanEndMonth] = useState<number>(12);
  const [actualEndMonth, setActualEndMonth] = useState<number>(5);
  const [multiPlanViewMode, setMultiPlanViewMode] = useState<MultiPlanDeptViewMode>('ACCOUNT_TOTAL');

  const queryDeptCode = queryParams.get('deptCode');
  const queryBaseYear = queryParams.get('baseYear');
  const queryBasePlanType = queryParams.get('basePlanType');
  const queryBaseMonthMode = queryParams.get('baseMonthMode') as MonthMode | null;
  const queryBaseMonth = queryParams.get('baseMonth');
  const queryTargetYear = queryParams.get('targetYear');
  const queryTargetPlanType = queryParams.get('targetPlanType');
  const queryTargetMonthMode = queryParams.get('targetMonthMode') as MonthMode | null;
  const queryTargetMonth = queryParams.get('targetMonth');
  const source = queryParams.get('source');
  const fromDashboardTop6 = source === 'dashboard-top6';

  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    if (queryBaseYear) setBaseYear(queryBaseYear);
    if (queryBasePlanType) setBasePlanType(normalizePlanType(queryBasePlanType));
    if (queryBaseMonthMode === 'MONTH' || queryBaseMonthMode === 'YTD') {
      setBaseMonthMode(queryBaseMonthMode);
    }
    if (queryBaseMonth) {
      setBaseSelectedMonth(Number(queryBaseMonth));
    }

    if (queryTargetYear) setTargetYear(queryTargetYear);
    if (queryTargetPlanType) setTargetPlanType(normalizePlanType(queryTargetPlanType));
    if (queryTargetMonthMode === 'MONTH' || queryTargetMonthMode === 'YTD') {
      setTargetMonthMode(queryTargetMonthMode);
    }
    if (queryTargetMonth) {
      setTargetSelectedMonth(Number(queryTargetMonth));
    }

    if (queryDeptCode) {
      const hasPermission = isAdmin || isPlanningTeam || (
        viewableDeptCodes instanceof Set 
          ? viewableDeptCodes.has(queryDeptCode) 
          : Array.isArray(viewableDeptCodes) 
            ? (viewableDeptCodes as string[]).includes(queryDeptCode) 
            : false
      );

      if (hasPermission) {
        setSelectedDept(queryDeptCode);
        setPermissionError(null);
      } else {
        setSelectedDept(getUserInitDept());
        setPermissionError('해당 부서에 대한 조회 권한이 없어 기본 조회 부서로 이동했습니다.');
      }
      setSelectedDepartment(null);
      return;
    }

    if (tab === 'time') {
      setSelectedDept('all');
      setBasePlanType('경영계획');
      setTargetPlanType('실적');
    } else if (tab === 'dept') {
      setSelectedDept('by_dept');
    } else if (tab === 'account') {
      setSelectedDept('all');
      setSelectedAccountingType('전체');
      setSelectedAccountClass('전체');
    } else if (tab === 'multi_plan') {
      // 사용자가 이미 고른 부서를 유지한다.
      // selectedDept가 없거나 권한 밖일 때만 기본값으로 보정한다.
      setSelectedAccountingType(prev => prev || '전체');
      setSelectedAccountClass(prev => prev || '전체');
    } else if (tab === 'default') {
      const initDept = getUserInitDept();
      setSelectedDept(initDept);
      setBasePlanType('경영계획');
      setTargetPlanType('실적');
    }
    setSelectedDepartment(null);
  }, [location.search, currentUser?.code]);

  useEffect(() => {
    if (selectedDept !== 'by_dept') {
      setSelectedDepartment(null);
    }
  }, [selectedDept]);

  // Persist filters
  useEffect(() => {
    localStorage.setItem('variance_baseYear', baseYear);
    localStorage.setItem('variance_basePlanType', basePlanType);
    localStorage.setItem('variance_targetYear', targetYear);
    localStorage.setItem('variance_targetPlanType', targetPlanType);
    localStorage.setItem('variance_dept', selectedDept);
    localStorage.setItem('variance_accountingType', selectedAccountingType);
    localStorage.setItem('variance_accountClass', selectedAccountClass);
    localStorage.removeItem('variance_accountCategory');
  }, [baseYear, basePlanType, baseMonthMode, baseSelectedMonth, targetYear, targetPlanType, targetMonthMode, targetSelectedMonth, selectedDept, selectedAccountingType, selectedAccountClass]);
  
  // Redesign state variables for Top N filtering, viewing, and collapsible chart
  const [chartTopN, setChartTopN] = useState<number>(20);
  const [chartAccountView, setChartAccountView] = useState<'ALL' | 'MFG' | 'SGA' | 'CLASS'>('ALL');
  const [chartAccountClass, setChartAccountClass] = useState<AccountClass>('전체');
  const [isAccountChartOpen, setIsAccountChartOpen] = useState<boolean>(true);
  const [applyChartFilterToTable, setApplyChartFilterToTable] = useState<boolean>(true);
  const [visibleDetailCount, setVisibleDetailCount] = useState<number>(100);
  const [isFullAccountModalOpen, setIsFullAccountModalOpen] = useState<boolean>(false);

  type DetailSortKey =
    | 'accountClass'
    | 'accountingType'
    | 'accountCode'
    | 'accountName'
    | 'baseAmount'
    | 'targetAmount'
    | 'variance'
    | 'variancePercent'
    | 'status';

  const [detailSort, setDetailSort] = useState<{ key: DetailSortKey; direction: 'asc' | 'desc' } | null>({
    key: 'variance',
    direction: 'desc',
  });

  const [detailFilters, setDetailFilters] = useState({
    accountClass: '',
    accountingType: '',
    accountCode: '',
    accountName: '',
    status: '',
    minVariance: '',
    minAmount: '',
  });

  const [multiPlanFilters, setMultiPlanFilters] = useState({
    accountClass: '',
    accountingType: '',
    accountCode: '',
    accountName: '',
    minAmount: '',
  });

  useEffect(() => {
    if (tab !== 'multi_plan') return;

    if (selectedAccountClass !== '전체' && multiPlanFilters.accountClass) {
      setMultiPlanFilters(prev => ({
        ...prev,
        accountClass: '',
      }));
    }
  }, [tab, selectedAccountClass, multiPlanFilters.accountClass]);

  const QUICK_ACCOUNT_CLASSES: AccountClass[] = [
    '직원급여',
    '임원급여',
    '복리후생비',
    '수선비',
    '여비교통비',
    '업무활동경비',
    '유틸리티비',
    '지급수수료',
    '판매비',
    '기타',
  ];

  function shortenAccountName(name: string, max = 22) {
    if (!name) return '';
    return name.length > max ? `${name.slice(0, max)}…` : name;
  }

  const handleSort = (key: DetailSortKey) => {
    setDetailSort(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
    setVisibleDetailCount(100);
  };

  const renderSortArrow = (key: DetailSortKey) => {
    if (detailSort?.key !== key) return <span className="text-zinc-300 ml-1 font-mono">↕</span>;
    return detailSort.direction === 'asc' ? <span className="text-[#008f83] ml-1 font-mono">▲</span> : <span className="text-[#008f83] ml-1 font-mono">▼</span>;
  };

  const [selectedDepartment, setSelectedDepartment] = useState<{ departmentCode: string, departmentName: string } | null>(null);
  const [includeSalaryRows, setIncludeSalaryRows] = useState(false);
  const [categories, setCategories] = useState<any[]>(INITIAL_CATEGORIES);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportDeptCodes, setSelectedReportDeptCodes] = useState<string[]>([]);
  const [includeAllReportDepts, setIncludeAllReportDepts] = useState(true);
  const [includeSummarySheet, setIncludeSummarySheet] = useState(true);
  const [includeDetailSheets, setIncludeDetailSheets] = useState(true);
  const [includeGroupSheets, setIncludeGroupSheets] = useState(true);

  const baseName = `${baseYear} ${basePlanType} (${getMonthModeLabel(baseMonthMode, baseSelectedMonth)})`;
  const targetName = `${targetYear} ${targetPlanType} (${getMonthModeLabel(targetMonthMode, targetSelectedMonth)})`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
  };

  const toMillions = (val: number) => Math.round(val / 1000000);

  const [deptMasterVersion, setDeptMasterVersion] = useState(0);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CUSTOM_USERS || e.key === 'cleanmetal_dept_master_custom') {
        setDeptMasterVersion(prev => prev + 1);
      }
    };
    const handleCustomChange = () => {
      setDeptMasterVersion(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('custom-users-changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('custom-users-changed', handleCustomChange);
    };
  }, []);

  const allDepts = useMemo(() => {
    return getAllDepartments();
  }, [deptMasterVersion]);

  const getDeptName = () => {
    if (selectedDept === 'all') return '전체부서';
    if (selectedDept === 'viewable') return '조회 가능 부서';
    if (selectedDept === 'by_dept') return '부서별';
    if (selectedDept === 'mfg') return '제조_전체부서';
    if (selectedDept === 'sga') return '판관_전체부서';
    return allDepts.find(d => d.code === selectedDept)?.name || selectedDept;
  };

  const getDownloadFileName = (ext: string) => {
    const baseStr = `${baseYear}_${basePlanType}_${baseMonthMode}_${baseSelectedMonth}`;
    const targetStr = `${targetYear}_${targetPlanType}_${targetMonthMode}_${targetSelectedMonth}`;
    const deptStr = getDeptName();
    return `${baseStr}vs${targetStr}_${deptStr}.${ext}`;
  };

  const getReportAvailableDeptCodes = (): string[] => {
    if (selectedDept === 'by_dept' || selectedDept === 'all' || selectedDept === 'viewable') {
      return viewableDepts.filter(d => d.code !== '99999').map(d => d.code);
    }
    if (selectedDept === 'mfg' || selectedDept === 'sga') {
      return viewableDepts.filter(d => d.code !== '99999').map(d => d.code);
    }
    return [selectedDept];
  };

  const getReportFileName = (ext: string) => {
    const basePeriod = getMonthModeLabel(baseMonthMode, baseSelectedMonth).replace(/\s/g, '');
    const targetPeriod = getMonthModeLabel(targetMonthMode, targetSelectedMonth).replace(/\s/g, '');
    return `부서별_비교분석_${baseYear}_${basePlanType}_${basePeriod}_vs_${targetYear}_${targetPlanType}_${targetPeriod}.${ext}`;
  };

  interface DeptDetailCompareRow {
    deptCode: string;
    deptName: string;
    accountingType: string;
    accountClass: string;
    accountCode: string;
    accountName: string;
    baseAmount: number;
    targetAmount: number;
    variance: number;
    variancePercent: number | null;
    status: VarianceStatus;
    isSalary?: boolean;
  }

  const buildDeptDetailComparisonRows = (deptCode: string): DeptDetailCompareRow[] => {
    const baseRows = buildAtomicCompareRows({
      year: baseYear,
      planType: basePlanType,
      monthMode: baseMonthMode,
      selectedMonth: baseSelectedMonth,
      deptCodes: [deptCode],
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });

    const targetRows = buildAtomicCompareRows({
      year: targetYear,
      planType: targetPlanType,
      monthMode: targetMonthMode,
      selectedMonth: targetSelectedMonth,
      deptCodes: [deptCode],
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });

    const result = buildVarianceComparison({
      baseRows,
      targetRows,
      groupBy: 'account',
      allDepts,
      activeDept: deptCode,
      selectedAccountingType,
      selectedAccountClass,
      basePlanType,
      targetPlanType,
    });

    return result.rows.map(row => ({
      deptCode: deptCode,
      deptName: allDepts.find(d => d.code === deptCode)?.name || deptCode,
      accountingType: row.accountingType,
      accountClass: row.accountClass,
      accountCode: row.accountCode,
      accountName: row.accountName,
      baseAmount: row.baseAmount,
      targetAmount: row.targetAmount,
      variance: row.variance,
      variancePercent: row.variancePercent,
      status: row.status,
      isSalary: row.isSalary,
    }));
  };

  const safeSheetName = (name: string): string => {
    return String(name)
      .replace(/[\\/?*[\]:]/g, '')
      .slice(0, 31);
  };

  const appendSheetSafely = (wb: any, ws: any, name: string, usedSet?: Set<string>) => {
    let cleanName = String(name)
      .replace(/[\\/?*[\]:]/g, '')
      .trim();
    if (!cleanName) cleanName = 'Sheet';
    
    let finalStr = cleanName.substring(0, 31);
    if (usedSet) {
      let counter = 1;
      while (usedSet.has(finalStr)) {
        const suffix = `_${counter}`;
        const allowedBase = 31 - suffix.length;
        finalStr = cleanName.substring(0, allowedBase) + suffix;
        counter++;
      }
      usedSet.add(finalStr);
    }
    XLSX.utils.book_append_sheet(wb, ws, finalStr);
  };

  const getDeptSheetName = (deptCode: string, deptName: string): string => {
    return safeSheetName(`${deptCode}_${deptName}`);
  };

  const getGroupSheetName = (group: DeptGroup): string => {
    const representativeCode = group.deptCodes?.[0] || group.id;
    return safeSheetName(`그룹_${representativeCode}_${group.name}`);
  };

  const EXCEL_HEADER_FILL = 'DAEEF3';

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'D9E2E7' } },
    bottom: { style: 'thin', color: { rgb: 'D9E2E7' } },
    left: { style: 'thin', color: { rgb: 'D9E2E7' } },
    right: { style: 'thin', color: { rgb: 'D9E2E7' } },
  };

  const headerStyle = {
    font: { bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: EXCEL_HEADER_FILL } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const centerStyle = {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const leftStyle = {
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const amountStyle = {
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    numFmt: '#,##0',
    border: thinBorder,
  };

  const percentStyle = {
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    numFmt: '0.00%',
    border: thinBorder,
  };

  const boldCenterStyle = {
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const boldLeftStyle = {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: thinBorder,
  };

  const boldAmountStyle = {
    font: { bold: true },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    numFmt: '#,##0',
    border: thinBorder,
  };

  const boldPercentStyle = {
    font: { bold: true },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    numFmt: '0.00%',
    border: thinBorder,
  };

  const applyWorksheetStyle = (
    ws: any,
    options: {
      amountColumnIndexes?: number[];
      percentColumnIndexes?: number[];
      leftAlignColumnIndexes?: number[];
      headerRowCount?: number;
    } = {}
  ) => {
    const headerRows = options.headerRowCount !== undefined ? options.headerRowCount : 1;
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

    const amountSet = new Set(options.amountColumnIndexes || []);
    const percentSet = new Set(options.percentColumnIndexes || []);
    const leftSet = new Set(options.leftAlignColumnIndexes || []);

    const totalRowIndices = new Set<number>();
    for (let r = headerRows; r <= range.e.r; r += 1) {
      let isTotal = false;
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r: r, c });
        const cell = ws[addr];
        if (cell && cell.v !== undefined && cell.v !== null) {
          const valStr = String(cell.v);
          if (
            valStr.includes('합계') ||
            valStr === '총계' ||
            valStr === '소계' ||
            valStr.toLowerCase().includes('total') ||
            valStr.toLowerCase().includes('subtotal')
          ) {
            isTotal = true;
            break;
          }
        }
      }
      if (isTotal) {
        totalRowIndices.add(r);
      }
    }

    const boldColIndices = new Set<number>();
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      for (let r = 0; r < headerRows; r += 1) {
        const addr = XLSX.utils.encode_cell({ r, c: col });
        const cell = ws[addr];
        if (cell && cell.v !== undefined && cell.v !== null) {
          const valStr = String(cell.v).toLowerCase();
          if (
            valStr.includes('차액') ||
            valStr.includes('증감률') ||
            valStr.includes('variance') ||
            valStr.includes('rate') ||
            valStr.includes('percent')
          ) {
            boldColIndices.add(col);
          }
        }
      }
    }

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const isBoldRow = totalRowIndices.has(row);
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[cellAddress];
        if (!cell) continue;

        if (row < headerRows) {
          cell.s = headerStyle;
          continue;
        }

        const isBoldCol = boldColIndices.has(col);
        const forceBold = isBoldRow || isBoldCol;

        if (amountSet.has(col)) {
          cell.s = forceBold ? boldAmountStyle : amountStyle;
          cell.z = '#,##0';
          continue;
        }

        if (percentSet.has(col)) {
          cell.s = forceBold ? boldPercentStyle : percentStyle;
          cell.z = '0.00%';
          continue;
        }

        if (leftSet.has(col)) {
          cell.s = forceBold ? boldLeftStyle : leftStyle;
          continue;
        }

        cell.s = forceBold ? boldCenterStyle : centerStyle;
      }
    }
  };

  const applyWorksheetView = (ws: any, options: { headerRowCount?: number; freezeColCount?: number } = {}) => {
    if (!ws['!ref']) return;

    ws['!autofilter'] = { ref: ws['!ref'] };

    const ySplit = options.headerRowCount !== undefined ? options.headerRowCount : 1;
    const xSplit = options.freezeColCount !== undefined ? options.freezeColCount : 0;
    const topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: xSplit });

    ws['!freeze'] = {
      xSplit,
      ySplit,
      topLeftCell,
      activePane: xSplit > 0 || ySplit > 0 ? 'bottomRight' : 'bottomLeft',
      state: 'frozen',
    };
  };

  const applyMonthlyColumnGroups = (ws: any, params: {
    targetStartCol: number;
    targetMonthCount: number;
    baseStartCol: number;
    baseMonthCount: number;
  }) => {
    if (!ws['!cols']) ws['!cols'] = [];

    const { targetStartCol, targetMonthCount, baseStartCol, baseMonthCount } = params;

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const maxCol = range.e.c;
    for (let c = 0; c <= maxCol; c++) {
      if (!ws['!cols'][c]) ws['!cols'][c] = { wch: 12 };
    }

    for (let i = 0; i < targetMonthCount; i += 1) {
      const idx = targetStartCol + i;
      ws['!cols'][idx] = {
        ...(ws['!cols'][idx] || {}),
        hidden: true,
        level: 1,
        wch: 13,
      };
    }

    for (let i = 0; i < baseMonthCount; i += 1) {
      const idx = baseStartCol + i;
      ws['!cols'][idx] = {
        ...(ws['!cols'][idx] || {}),
        hidden: true,
        level: 1,
        wch: 13,
      };
    }

    ws['!outline'] = {
      left: false,
      symbols: true,
    };
  };

  const appendSummarySheet = (
    wb: any,
    rows: MonthlyCompareMatrixRow[],
    deptCodes: string[],
    usedSheetNames?: Set<string>
  ) => {
    const summaryByDept = new Map<string, {
      deptCode: string;
      deptName: string;
      baseAmount: number;
      targetAmount: number;
    }>();

    rows.forEach(row => {
      if (!row.deptCode) return;
      const prev = summaryByDept.get(row.deptCode) || {
        deptCode: row.deptCode,
        deptName: row.deptName || '',
        baseAmount: 0,
        targetAmount: 0,
      };

      prev.baseAmount += row.baseTotal;
      prev.targetAmount += row.targetTotal;

      summaryByDept.set(row.deptCode, prev);
    });

    const data: any[] = [
      ['부서코드', '부서명', baseName, targetName, '차액', '증감률(%)', '상태'],
    ];

    const summaryRows = Array.from(summaryByDept.values())
      .sort((a, b) => a.deptCode.localeCompare(b.deptCode));

    summaryRows.forEach(row => {
      const variance = row.targetAmount - row.baseAmount;
      const variancePercent = calcVarianceRate(row.baseAmount, row.targetAmount);

      const status = getVarianceStatus({
        baseAmount: row.baseAmount,
        targetAmount: row.targetAmount,
        basePlanType,
        targetPlanType,
      });

      data.push([
        row.deptCode,
        row.deptName,
        row.baseAmount,
        row.targetAmount,
        variance,
        toExcelPercentValue(variancePercent),
        status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    const firstDataRow = 1; // Header is 1 row, data starts at row index 1 (Excel Row 2)
    const lastDataRow = firstDataRow + summaryRows.length - 1;

    for (let r = firstDataRow; r <= lastDataRow; r += 1) {
      // Index 2 is base, Index 3 is target, Index 4 is variance, Index 5 is variance rate
      setFormulaCell(ws, r, 4, `${cellRef(r, 3)}-${cellRef(r, 2)}`, '#,##0');
      setFormulaCell(ws, r, 5, `IF(${cellRef(r, 2)}=0,"",(${cellRef(r, 3)}-${cellRef(r, 2)})/${cellRef(r, 2)})`, '0.00%');
    }

    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes: [2, 3, 4],
      percentColumnIndexes: [5],
      leftAlignColumnIndexes: [],
    });

    applyWorksheetView(ws);

    appendSheetSafely(wb, ws, '전체', usedSheetNames);
  };

  const appendDeptDetailSheet = (
    wb: any,
    deptCode: string,
    deptName: string,
    rows: MonthlyCompareMatrixRow[],
    exportMonths: number[],
    usedSheetNames?: Set<string>
  ) => {
    const rangeArray = (start: number, count: number) => Array.from({ length: count }, (_, i) => start + i);

    const targetMonthStart = 6;
    const targetMonthCount = exportMonths.length;
    const targetTotalCol = targetMonthStart + targetMonthCount;
    const baseMonthStart = targetTotalCol + 1;
    const baseMonthCount = exportMonths.length;
    const baseTotalCol = baseMonthStart + baseMonthCount;
    const varianceCol = baseTotalCol + 1;
    const varianceRateCol = varianceCol + 1;
    const statusCol = varianceRateCol + 1;

    const targetShortName = `${targetYear} ${targetPlanType}`;
    const baseShortName = `${baseYear} ${basePlanType}`;

    const headerRow1 = [
      '부서코드',
      '부서명',
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(() => `비교대상: ${targetShortName}`),
      `비교대상: ${targetShortName}`,
      ...exportMonths.map(() => `기준: ${baseShortName}`),
      `기준: ${baseShortName}`,
      '비교 결과',
      '비교 결과',
      '비교 결과',
    ];

    const headerRow2 = [
      '부서코드',
      '부서명',
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      '누계 차액',
      '증감률',
      '상태',
    ];

    const data: any[] = [headerRow1, headerRow2];

    rows.forEach(row => {
      data.push([
        row.deptCode,
        row.deptName,
        row.accountClass,
        row.accountingType,
        row.accountCode,
        row.accountName,
        ...row.targetMonthly,
        row.targetTotal,
        ...row.baseMonthly,
        row.baseTotal,
        row.variance,
        toExcelPercentValue(row.varianceRate),
        row.status,
      ]);
    });

    const baseTotalMonthly = Array(exportMonths.length).fill(0);
    const targetTotalMonthly = Array(exportMonths.length).fill(0);

    rows.forEach(row => {
      for (let i = 0; i < exportMonths.length; i++) {
        baseTotalMonthly[i] += row.baseMonthly[i];
        targetTotalMonthly[i] += row.targetMonthly[i];
      }
    });

    const sumBaseTotal = baseTotalMonthly.reduce((a, b) => a + b, 0);
    const sumTargetTotal = targetTotalMonthly.reduce((a, b) => a + b, 0);
    const sumVariance = sumTargetTotal - sumBaseTotal;
    const sumVariancePercent = calcVarianceRate(sumBaseTotal, sumTargetTotal);

    data.push([]);
    data.push([
      '',
      '',
      '',
      '',
      '',
      '부서 합계',
      ...targetTotalMonthly,
      sumTargetTotal,
      ...baseTotalMonthly,
      sumBaseTotal,
      sumVariance,
      toExcelPercentValue(sumVariancePercent),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    const firstDataRow = 2; // Data rows start at index 2 (Excel Row 3)
    const lastDataRow = firstDataRow + rows.length - 1;

    for (let r = firstDataRow; r <= lastDataRow; r += 1) {
      setFormulaCell(ws, r, targetTotalCol, makeSumFormula(r, targetMonthStart, targetTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, baseTotalCol, makeSumFormula(r, baseMonthStart, baseTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, varianceCol, makeVarianceFormula(r, targetTotalCol, baseTotalCol), '#,##0');
      setFormulaCell(ws, r, varianceRateCol, makeVarianceRateFormula(r, targetTotalCol, baseTotalCol), '0.00%');
    }

    // Department total row indices and formulas
    const deptTotalRowIndex = data.length - 1;

    for (let c = targetMonthStart; c <= targetTotalCol - 1; c += 1) {
      setFormulaCell(
        ws,
        deptTotalRowIndex,
        c,
        `SUM(${cellRef(firstDataRow, c)}:${cellRef(lastDataRow, c)})`,
        '#,##0'
      );
    }

    for (let c = baseMonthStart; c <= baseTotalCol - 1; c += 1) {
      setFormulaCell(
        ws,
        deptTotalRowIndex,
        c,
        `SUM(${cellRef(firstDataRow, c)}:${cellRef(lastDataRow, c)})`,
        '#,##0'
      );
    }

    setFormulaCell(ws, deptTotalRowIndex, targetTotalCol, makeSumFormula(deptTotalRowIndex, targetMonthStart, targetTotalCol - 1), '#,##0');
    setFormulaCell(ws, deptTotalRowIndex, baseTotalCol, makeSumFormula(deptTotalRowIndex, baseMonthStart, baseTotalCol - 1), '#,##0');
    setFormulaCell(ws, deptTotalRowIndex, varianceCol, makeVarianceFormula(deptTotalRowIndex, targetTotalCol, baseTotalCol), '#,##0');
    setFormulaCell(ws, deptTotalRowIndex, varianceRateCol, makeVarianceRateFormula(deptTotalRowIndex, targetTotalCol, baseTotalCol), '0.00%');

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },

      { s: { r: 0, c: targetMonthStart }, e: { r: 0, c: targetTotalCol } },
      { s: { r: 0, c: baseMonthStart }, e: { r: 0, c: baseTotalCol } },
      { s: { r: 0, c: varianceCol }, e: { r: 0, c: statusCol } },
    ];

    const amountColumnIndexes = [
      ...rangeArray(targetMonthStart, exportMonths.length),
      targetTotalCol,
      ...rangeArray(baseMonthStart, exportMonths.length),
      baseTotalCol,
      varianceCol,
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes,
      percentColumnIndexes: [varianceRateCol],
      leftAlignColumnIndexes: [5],
      headerRowCount: 2,
    });

    applyMonthlyColumnGroups(ws, {
      targetStartCol: targetMonthStart,
      targetMonthCount: exportMonths.length,
      baseStartCol: baseMonthStart,
      baseMonthCount: exportMonths.length,
    });

    applyWorksheetView(ws, {
      headerRowCount: 2,
      freezeColCount: 6,
    });

    ws['!cols'] = ws['!cols'] || [];
    const maxCol = data[0].length - 1;
    for (let c = 0; c <= maxCol; c++) {
      const existing = ws['!cols'][c] || {};
      if (c === 0) ws['!cols'][c] = { ...existing, wch: 12 };
      else if (c === 1) ws['!cols'][c] = { ...existing, wch: 22 };
      else if (c === 2) ws['!cols'][c] = { ...existing, wch: 16 };
      else if (c === 3) ws['!cols'][c] = { ...existing, wch: 12 };
      else if (c === 4) ws['!cols'][c] = { ...existing, wch: 15 };
      else if (c === 5) ws['!cols'][c] = { ...existing, wch: 30 };
      else ws['!cols'][c] = { ...existing, wch: 13 };
    }

    if (ws['!cols'][targetTotalCol]) ws['!cols'][targetTotalCol] = { ...ws['!cols'][targetTotalCol], wch: 18 };
    if (ws['!cols'][baseTotalCol]) ws['!cols'][baseTotalCol] = { ...ws['!cols'][baseTotalCol], wch: 18 };
    if (ws['!cols'][varianceCol]) ws['!cols'][varianceCol] = { ...ws['!cols'][varianceCol], wch: 18 };
    if (ws['!cols'][varianceRateCol]) ws['!cols'][varianceRateCol] = { ...ws['!cols'][varianceRateCol], wch: 14 };
    if (ws['!cols'][statusCol]) ws['!cols'][statusCol] = { ...ws['!cols'][statusCol], wch: 11 };

    appendSheetSafely(wb, ws, `${deptCode}_${deptName}`, usedSheetNames);
  };

  const aggregateMonthlyGroupRowsByAccount = (
    rows: MonthlyCompareMatrixRow[],
    exportMonths: number[]
  ): MonthlyCompareMatrixRow[] => {
    const map = new Map<string, MonthlyCompareMatrixRow>();

    rows.forEach(row => {
      const key = `${row.accountCode}|${row.accountName}`;
      const prev = map.get(key);

      if (prev) {
        for (let i = 0; i < exportMonths.length; i++) {
          prev.baseMonthly[i] += row.baseMonthly[i];
          prev.targetMonthly[i] += row.targetMonthly[i];
        }
        prev.baseTotal += row.baseTotal;
        prev.targetTotal += row.targetTotal;
        prev.variance = prev.targetTotal - prev.baseTotal;
        prev.varianceRate = calcVarianceRate(prev.baseTotal, prev.targetTotal);
        prev.status = getVarianceStatus({
          baseAmount: prev.baseTotal,
          targetAmount: prev.targetTotal,
          basePlanType,
          targetPlanType,
        });
      } else {
        map.set(key, {
          ...row,
          baseMonthly: [...row.baseMonthly],
          targetMonthly: [...row.targetMonthly]
        });
      }
    });

    return Array.from(map.values())
      .filter(row => row.baseTotal !== 0 || row.targetTotal !== 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  };

  const appendGroupDetailSheet = (
    wb: any,
    group: DeptGroup,
    deptCodes: string[],
    rows: MonthlyCompareMatrixRow[],
    exportMonths: number[],
    usedSheetNames?: Set<string>
  ) => {
    const rangeArray = (start: number, count: number) => Array.from({ length: count }, (_, i) => start + i);

    const targetMonthStart = 6;
    const targetMonthCount = exportMonths.length;
    const targetTotalCol = targetMonthStart + targetMonthCount;
    const baseMonthStart = targetTotalCol + 1;
    const baseMonthCount = exportMonths.length;
    const baseTotalCol = baseMonthStart + baseMonthCount;
    const varianceCol = baseTotalCol + 1;
    const varianceRateCol = varianceCol + 1;
    const statusCol = varianceRateCol + 1;

    const aggregatedRows = aggregateMonthlyGroupRowsByAccount(rows, exportMonths);

    const targetShortName = `${targetYear} ${targetPlanType}`;
    const baseShortName = `${baseYear} ${basePlanType}`;

    const headerRow1 = [
      '그룹명',
      '포함 부서코드',
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(() => `비교대상: ${targetShortName}`),
      `비교대상: ${targetShortName}`,
      ...exportMonths.map(() => `기준: ${baseShortName}`),
      `기준: ${baseShortName}`,
      '비교 결과',
      '비교 결과',
      '비교 결과',
    ];

    const headerRow2 = [
      '그룹명',
      '포함 부서코드',
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      '누계 차액',
      '증감률',
      '상태',
    ];

    const data: any[] = [headerRow1, headerRow2];

    aggregatedRows.forEach(row => {
      data.push([
        group.name,
        deptCodes.join(', '),
        row.accountClass,
        row.accountingType,
        row.accountCode,
        row.accountName,
        ...row.targetMonthly,
        row.targetTotal,
        ...row.baseMonthly,
        row.baseTotal,
        row.variance,
        toExcelPercentValue(row.varianceRate),
        row.status,
      ]);
    });

    const baseTotalMonthly = Array(exportMonths.length).fill(0);
    const targetTotalMonthly = Array(exportMonths.length).fill(0);

    aggregatedRows.forEach(row => {
      for (let i = 0; i < exportMonths.length; i++) {
        baseTotalMonthly[i] += row.baseMonthly[i];
        targetTotalMonthly[i] += row.targetMonthly[i];
      }
    });

    const sumBaseTotal = baseTotalMonthly.reduce((a, b) => a + b, 0);
    const sumTargetTotal = targetTotalMonthly.reduce((a, b) => a + b, 0);
    const sumVariance = sumTargetTotal - sumBaseTotal;
    const sumVariancePercent = calcVarianceRate(sumBaseTotal, sumTargetTotal);

    data.push([]);
    data.push([
      group.name,
      '그룹 합계',
      '',
      '',
      '',
      '',
      ...targetTotalMonthly,
      sumTargetTotal,
      ...baseTotalMonthly,
      sumBaseTotal,
      sumVariance,
      toExcelPercentValue(sumVariancePercent),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    const firstDataRow = 2; // Data rows start at index 2 (Excel Row 3)
    const lastDataRow = firstDataRow + aggregatedRows.length - 1;

    for (let r = firstDataRow; r <= lastDataRow; r += 1) {
      setFormulaCell(ws, r, targetTotalCol, makeSumFormula(r, targetMonthStart, targetTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, baseTotalCol, makeSumFormula(r, baseMonthStart, baseTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, varianceCol, makeVarianceFormula(r, targetTotalCol, baseTotalCol), '#,##0');
      setFormulaCell(ws, r, varianceRateCol, makeVarianceRateFormula(r, targetTotalCol, baseTotalCol), '0.00%');
    }

    // Group total row indices and formulas
    const groupTotalRowIndex = data.length - 1;

    for (let c = targetMonthStart; c <= targetTotalCol - 1; c += 1) {
      setFormulaCell(
        ws,
        groupTotalRowIndex,
        c,
        `SUM(${cellRef(firstDataRow, c)}:${cellRef(lastDataRow, c)})`,
        '#,##0'
      );
    }

    for (let c = baseMonthStart; c <= baseTotalCol - 1; c += 1) {
      setFormulaCell(
        ws,
        groupTotalRowIndex,
        c,
        `SUM(${cellRef(firstDataRow, c)}:${cellRef(lastDataRow, c)})`,
        '#,##0'
      );
    }

    setFormulaCell(ws, groupTotalRowIndex, targetTotalCol, makeSumFormula(groupTotalRowIndex, targetMonthStart, targetTotalCol - 1), '#,##0');
    setFormulaCell(ws, groupTotalRowIndex, baseTotalCol, makeSumFormula(groupTotalRowIndex, baseMonthStart, baseTotalCol - 1), '#,##0');
    setFormulaCell(ws, groupTotalRowIndex, varianceCol, makeVarianceFormula(groupTotalRowIndex, targetTotalCol, baseTotalCol), '#,##0');
    setFormulaCell(ws, groupTotalRowIndex, varianceRateCol, makeVarianceRateFormula(groupTotalRowIndex, targetTotalCol, baseTotalCol), '0.00%');

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },

      { s: { r: 0, c: targetMonthStart }, e: { r: 0, c: targetTotalCol } },
      { s: { r: 0, c: baseMonthStart }, e: { r: 0, c: baseTotalCol } },
      { s: { r: 0, c: varianceCol }, e: { r: 0, c: statusCol } },
    ];

    const amountColumnIndexes = [
      ...rangeArray(targetMonthStart, exportMonths.length),
      targetTotalCol,
      ...rangeArray(baseMonthStart, exportMonths.length),
      baseTotalCol,
      varianceCol,
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes,
      percentColumnIndexes: [varianceRateCol],
      leftAlignColumnIndexes: [5],
      headerRowCount: 2,
    });

    applyMonthlyColumnGroups(ws, {
      targetStartCol: targetMonthStart,
      targetMonthCount: exportMonths.length,
      baseStartCol: baseMonthStart,
      baseMonthCount: exportMonths.length,
    });

    applyWorksheetView(ws, {
      headerRowCount: 2,
      freezeColCount: 6,
    });

    ws['!cols'] = ws['!cols'] || [];
    const maxCol = data[0].length - 1;
    for (let c = 0; c <= maxCol; c++) {
      const existing = ws['!cols'][c] || {};
      if (c === 0) ws['!cols'][c] = { ...existing, wch: 18 };
      else if (c === 1) ws['!cols'][c] = { ...existing, wch: 30 };
      else if (c === 2) ws['!cols'][c] = { ...existing, wch: 16 };
      else if (c === 3) ws['!cols'][c] = { ...existing, wch: 12 };
      else if (c === 4) ws['!cols'][c] = { ...existing, wch: 15 };
      else if (c === 5) ws['!cols'][c] = { ...existing, wch: 30 };
      else ws['!cols'][c] = { ...existing, wch: 13 };
    }

    if (ws['!cols'][targetTotalCol]) ws['!cols'][targetTotalCol] = { ...ws['!cols'][targetTotalCol], wch: 18 };
    if (ws['!cols'][baseTotalCol]) ws['!cols'][baseTotalCol] = { ...ws['!cols'][baseTotalCol], wch: 18 };
    if (ws['!cols'][varianceCol]) ws['!cols'][varianceCol] = { ...ws['!cols'][varianceCol], wch: 18 };
    if (ws['!cols'][varianceRateCol]) ws['!cols'][varianceRateCol] = { ...ws['!cols'][varianceRateCol], wch: 14 };
    if (ws['!cols'][statusCol]) ws['!cols'][statusCol] = { ...ws['!cols'][statusCol], wch: 11 };

    appendSheetSafely(wb, ws, `그룹_${group.deptCodes?.[0] || group.id}_${group.name}`, usedSheetNames);
  };

  const ensureXLSX = async () => {
    if (!XLSX) {
      XLSX = await import('xlsx-js-style');
    }
  };

  const handleDownloadExcelWithDeptDetails = async (deptCodes: string[]) => {
    await ensureXLSX();
    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const baseMatrix = buildMonthlyMatrix({
      year: baseYear,
      planType: basePlanType,
      monthMode: baseMonthMode,
      selectedMonth: baseSelectedMonth,
      deptCodes: deptCodes,
      accountMetaMap,
      hasSalaryAccess,
      includeSalaryRows,
      allDepts,
    });

    const targetMatrix = buildMonthlyMatrix({
      year: targetYear,
      planType: targetPlanType,
      monthMode: targetMonthMode,
      selectedMonth: targetSelectedMonth,
      deptCodes: deptCodes,
      accountMetaMap,
      hasSalaryAccess,
      includeSalaryRows,
      allDepts,
    });

    const exportMonthLimit = Math.max(baseSelectedMonth, targetSelectedMonth);
    const exportMonths = Array.from({ length: exportMonthLimit }, (_, i) => i + 1);

    const deptDetailRows = buildDeptMonthlyCompareRows({
      baseMatrix,
      targetMatrix,
      exportMonths,
      basePlanType,
      targetPlanType,
      deptCodes,
    });

    // 1. 전체 요약 시트
    if (includeSummarySheet) {
      appendSummarySheet(wb, deptDetailRows, deptCodes, usedSheetNames);
    }

    // 2. 선택 부서별 상세 시트
    if (includeDetailSheets) {
      deptCodes.forEach(deptCode => {
        const dept = allDepts.find(d => d.code === deptCode);
        const deptName = dept?.name || deptCode;

        const rows = deptDetailRows.filter(row => row.deptCode === deptCode);

        if (rows.length > 0) {
          appendDeptDetailSheet(wb, deptCode, deptName, rows, exportMonths, usedSheetNames);
        }
      });
    }

    // 3. 부서 그룹 상세 시트
    const isFullDeptDownload =
      includeAllReportDepts ||
      selectedReportDeptCodes.length === getReportAvailableDeptCodes().length;

    if (isFullDeptDownload && includeGroupSheets) {
      const activeGroups = getDeptGroups().filter(group => group.isActive !== false);

      activeGroups.forEach(group => {
        const groupDeptCodes = getDeptCodesByGroup(group.id, true);

        if (groupDeptCodes.length === 0) return;

        const groupRows = deptDetailRows.filter(row => groupDeptCodes.includes(row.deptCode || ''));

        if (groupRows.length > 0) {
          appendGroupDetailSheet(wb, group, groupDeptCodes, groupRows, exportMonths, usedSheetNames);
        }
      });
    }

    wb.Workbook = {
      ...(wb.Workbook || {}),
      CalcPr: {
        fullCalcOnLoad: true,
        forceFullCalc: true,
      },
    };

    XLSX.writeFile(wb, getReportFileName('xlsx'));
  };

  const getExcelColumnLetter = (colIndex: number): string => {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  const handleDownloadMultiPlanExcel = async () => {
    await ensureXLSX();
    const wb = XLSX.utils.book_new();

    // Sheet 1: 요약 Sheet
    const sheet1Headers = [
      '계정구분',
      '계정코드',
      '계정과목',
      '작성부서코드',
      '작성부서',
      '귀속부서코드',
      '귀속부서',
      ...selectedPlanTypes.map(p => p === '증액반영' ? '경영계획(증액반영)' : p),
      `실적(~${actualEndMonth}월)`,
      '증액필요예산'
    ];

    const sheet1Data: any[][] = [sheet1Headers];

    filteredMultiPlanRows.forEach(row => {
      const deptDisp = getMultiPlanDeptDisplay(row, selectedDept, allDepts, effectiveMultiPlanViewMode);
      const rowArr: any[] = [
        row.accountingType,
        row.accountCode,
        row.accountName,
        deptDisp.writerDeptCode || '',
        deptDisp.writerDeptName || '',
        deptDisp.attributedDeptCode || '',
        deptDisp.attributedDeptName || '',
      ];

      selectedPlanTypes.forEach(p => {
        rowArr.push(row.totalByColumnId[`plan_${p}`] || 0);
      });

      rowArr.push(row.totalByColumnId['actual'] || 0);
      rowArr.push(0); // Formula will be set later

      sheet1Data.push(rowArr);
    });

    const emptyRowOffset = sheet1Data.length;
    sheet1Data.push(Array(sheet1Headers.length).fill(''));

    // totals placeholders
    const mfgTotRowArr: (string | number)[] = ['제조 합계', '', '', '', '', '', ''];
    const sgaTotRowArr: (string | number)[] = ['판관 합계', '', '', '', '', '', ''];
    const grandTotRowArr: (string | number)[] = ['총합계', '', '', '', '', '', ''];
    while (mfgTotRowArr.length < sheet1Headers.length) {
      mfgTotRowArr.push(0);
      sgaTotRowArr.push(0);
      grandTotRowArr.push(0);
    }
    sheet1Data.push(mfgTotRowArr);
    sheet1Data.push(sgaTotRowArr);
    sheet1Data.push(grandTotRowArr);

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    const getS1ColIndexFromId = (id: string): number => {
      const normalizedId = id.startsWith('plan_') ? id : `plan_${id}`;
      if (id === 'actual') {
        return 7 + selectedPlanTypes.length;
      }
      const planName = normalizedId.replace('plan_', '');
      const idx = selectedPlanTypes.indexOf(planName as any);
      if (idx !== -1) {
        return 7 + idx;
      }
      return -1;
    };

    const s1BasisColIdx = getS1ColIndexFromId(increaseBasisCol);
    const s1TargetColIdx = getS1ColIndexFromId(increaseTargetCol);
    const s1IncreaseColIdx = 7 + selectedPlanTypes.length + 1;

    // Set Sheet 1 Formulas for each data row
    for (let r = 1; r < emptyRowOffset; r++) {
      if (s1BasisColIdx !== -1 && s1TargetColIdx !== -1) {
        const basisCell = cellRef(r, s1BasisColIdx);
        const targetCell = cellRef(r, s1TargetColIdx);
        setFormulaCell(ws1, r, s1IncreaseColIdx, `${targetCell}-${basisCell}`, '#,##0');
      }
    }

    // Set Sheet 1 Formulas for bottom totals rows
    const mfgRowIdx = emptyRowOffset + 1;
    const sgaRowIdx = emptyRowOffset + 2;
    const grandRowIdx = emptyRowOffset + 3;

    for (let c = 7; c <= 7 + selectedPlanTypes.length; c++) {
      const letter = getExcelColumnLetter(c);
      setFormulaCell(ws1, mfgRowIdx, c, `SUMIF(A2:A${emptyRowOffset},"제조",${letter}2:${letter}${emptyRowOffset})`, '#,##0');
      setFormulaCell(ws1, sgaRowIdx, c, `SUMIF(A2:A${emptyRowOffset},"판관",${letter}2:${letter}${emptyRowOffset})`, '#,##0');
      setFormulaCell(ws1, grandRowIdx, c, `SUM(${letter}2:${letter}${emptyRowOffset})`, '#,##0');
    }

    if (s1BasisColIdx !== -1 && s1TargetColIdx !== -1) {
      setFormulaCell(ws1, mfgRowIdx, s1IncreaseColIdx, `${cellRef(mfgRowIdx, s1TargetColIdx)}-${cellRef(mfgRowIdx, s1BasisColIdx)}`, '#,##0');
      setFormulaCell(ws1, sgaRowIdx, s1IncreaseColIdx, `${cellRef(sgaRowIdx, s1TargetColIdx)}-${cellRef(sgaRowIdx, s1BasisColIdx)}`, '#,##0');
      setFormulaCell(ws1, grandRowIdx, s1IncreaseColIdx, `${cellRef(grandRowIdx, s1TargetColIdx)}-${cellRef(grandRowIdx, s1BasisColIdx)}`, '#,##0');
    }

    const numericCols1 = Array.from(
      { length: selectedPlanTypes.length + 2 },
      (_, i) => 7 + i
    );
    applyWorksheetStyle(ws1, {
      amountColumnIndexes: numericCols1,
      leftAlignColumnIndexes: [1, 2, 4, 6],
      headerRowCount: 1,
    });
    applyWorksheetView(ws1, {
      headerRowCount: 1,
      freezeColCount: 3,
    });

    ws1['!cols'] = [];
    for (let i = 0; i < sheet1Headers.length; i++) {
      if (i === 1) {
        ws1['!cols'][i] = { wch: 18 };
      } else if (i === 2) {
        ws1['!cols'][i] = { wch: 42 };
      } else if (i === 0 || i === 3 || i === 5) {
        ws1['!cols'][i] = { wch: 13 };
      } else if (i === 4 || i === 6) {
        ws1['!cols'][i] = { wch: 22 };
      } else {
        ws1['!cols'][i] = { wch: 16 };
      }
    }
    // D~G hidden default: Set to hidden always
    for (let c = 3; c <= 6; c++) {
      ws1['!cols'][c] = {
        ...(ws1['!cols'][c] || {}),
        hidden: true,
        level: 1,
        wch: c === 3 || c === 5 ? 13 : 22,
      };
    }
    ws1['!outline'] = {
      left: false,
      symbols: true,
    };

    appendSheetSafely(wb, ws1, '요약');

    const blocks: {
      id: string;
      name: string;
      monthStartCol: number;
      monthEndCol: number;
      totalCol: number;
      sumEndMonth: number;
    }[] = [];

    let currentOffset = 7;
    selectedPlanTypes.forEach(p => {
      blocks.push({
        id: `plan_${p}`,
        name: p === '증액반영' ? '경영계획(증액반영)' : p,
        monthStartCol: currentOffset,
        monthEndCol: currentOffset + 11,
        totalCol: currentOffset + 12,
        sumEndMonth: planEndMonth,
      });
      currentOffset += 13;
    });

    blocks.push({
      id: 'actual',
      name: `실적(~${actualEndMonth}월)`,
      monthStartCol: currentOffset,
      monthEndCol: currentOffset + 11,
      totalCol: currentOffset + 12,
      sumEndMonth: actualEndMonth,
    });
    currentOffset += 13;

    const s2IncreaseCol = currentOffset;
    const finalColCount = s2IncreaseCol + 1;

    const sheet2HeaderRow1: string[] = ['계정구분', '계정코드', '계정과목', '작성부서코드', '작성부서', '귀속부서코드', '귀속부서'];
    const sheet2HeaderRow2: string[] = ['계정구분', '계정코드', '계정과목', '작성부서코드', '작성부서', '귀속부서코드', '귀속부서'];

    blocks.forEach(block => {
      for (let m = 1; m <= 12; m++) {
        sheet2HeaderRow1.push(block.name);
        sheet2HeaderRow2.push(`${m}월`);
      }
      sheet2HeaderRow1.push(block.name);
      sheet2HeaderRow2.push('합계');
    });

    sheet2HeaderRow1.push('증액필요예산');
    sheet2HeaderRow2.push('증액필요예산');

    const sheet2Data: any[][] = [sheet2HeaderRow1, sheet2HeaderRow2];

    filteredMultiPlanRows.forEach(row => {
      const deptDisp = getMultiPlanDeptDisplay(row, selectedDept, allDepts, effectiveMultiPlanViewMode);
      const rowArr: any[] = [
        row.accountingType,
        row.accountCode,
        row.accountName,
        deptDisp.writerDeptCode || '',
        deptDisp.writerDeptName || '',
        deptDisp.attributedDeptCode || '',
        deptDisp.attributedDeptName || '',
      ];

      blocks.forEach(block => {
        const colMonthly = row.monthlyByColumnId[block.id] || Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          rowArr.push(colMonthly[m]);
        }
        rowArr.push(0); // SUM formula place
      });

      rowArr.push(0); // required increase formula place
      sheet2Data.push(rowArr);
    });

    const sheet2EmptyOffset = sheet2Data.length;
    sheet2Data.push(Array(finalColCount).fill(''));

    // Add totals rows
    const mfgTotRowArr2: (string | number)[] = ['제조 합계', '', '', '', '', '', ''];
    const sgaTotRowArr2: (string | number)[] = ['판관 합계', '', '', '', '', '', ''];
    const grandTotRowArr2: (string | number)[] = ['총합계', '', '', '', '', '', ''];
    while (mfgTotRowArr2.length < finalColCount) {
      mfgTotRowArr2.push(0);
      sgaTotRowArr2.push(0);
      grandTotRowArr2.push(0);
    }
    sheet2Data.push(mfgTotRowArr2);
    sheet2Data.push(sgaTotRowArr2);
    sheet2Data.push(grandTotRowArr2);

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

    const getS2TotalColIdx = (id: string): number => {
      const normalizedId = id.startsWith('plan_') ? id : `plan_${id}`;
      const found = blocks.find(b => b.id === id || b.id === normalizedId || `plan_${b.id}` === id || `plan_${b.id}` === normalizedId);
      return found ? found.totalCol : -1;
    };
    const s2BasisColIdx = getS2TotalColIdx(increaseBasisCol);
    const s2TargetColIdx = getS2TotalColIdx(increaseTargetCol);

    const sheet2FirstDataRow = 2; // Rows 0 & 1 are headers
    const sheet2LastDataRow = sheet2FirstDataRow + filteredMultiPlanRows.length - 1;

    for (let r = sheet2FirstDataRow; r <= sheet2LastDataRow; r++) {
      // 1. Calculate Block Totals
      blocks.forEach(block => {
        const startCell = cellRef(r, block.monthStartCol);
        const endCell = cellRef(r, block.monthStartCol + block.sumEndMonth - 1);
        setFormulaCell(ws2, r, block.totalCol, `SUM(${startCell}:${endCell})`, '#,##0');
      });

      // 2. Calculate Required Increase
      if (s2BasisColIdx !== -1 && s2TargetColIdx !== -1) {
        setFormulaCell(ws2, r, s2IncreaseCol, `${cellRef(r, s2TargetColIdx)}-${cellRef(r, s2BasisColIdx)}`, '#,##0');
      }
    }

    const s2MfgRow = sheet2EmptyOffset + 1;
    const s2SgaRow = sheet2EmptyOffset + 2;
    const s2GrandRow = sheet2EmptyOffset + 3;

    // Collect all numeric columns to apply sum/sumif
    const numericColsList: number[] = [];
    blocks.forEach(block => {
      for (let c = block.monthStartCol; c <= block.totalCol; c++) {
        numericColsList.push(c);
      }
    });
    numericColsList.push(s2IncreaseCol);

    const sheet2DataLastRowExcel = sheet2FirstDataRow + filteredMultiPlanRows.length; // 1-indexed representation of last data row
    numericColsList.forEach(c => {
      const letter = getExcelColumnLetter(c);
      const rangeStr = `A3:A${sheet2DataLastRowExcel}`;
      const sumRangeStr = `${letter}3:${letter}${sheet2DataLastRowExcel}`;
      
      setFormulaCell(ws2, s2MfgRow, c, `SUMIF(${rangeStr},"제조",${sumRangeStr})`, '#,##0');
      setFormulaCell(ws2, s2SgaRow, c, `SUMIF(${rangeStr},"판관",${sumRangeStr})`, '#,##0');
      setFormulaCell(ws2, s2GrandRow, c, `SUM(${letter}3:${letter}${sheet2DataLastRowExcel})`, '#,##0');
    });

    if (s2BasisColIdx !== -1 && s2TargetColIdx !== -1) {
      setFormulaCell(ws2, s2MfgRow, s2IncreaseCol, `${cellRef(s2MfgRow, s2TargetColIdx)}-${cellRef(s2MfgRow, s2BasisColIdx)}`, '#,##0');
      setFormulaCell(ws2, s2SgaRow, s2IncreaseCol, `${cellRef(s2SgaRow, s2TargetColIdx)}-${cellRef(s2SgaRow, s2BasisColIdx)}`, '#,##0');
      setFormulaCell(ws2, s2GrandRow, s2IncreaseCol, `${cellRef(s2GrandRow, s2TargetColIdx)}-${cellRef(s2GrandRow, s2BasisColIdx)}`, '#,##0');
    }

    // Merge group category headers on Row 1 for Sheet 2
    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // 계정구분
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // 계정코드
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // 계정과목
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // 작성부서코드
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } }, // 작성부서
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } }, // 귀속부서코드
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // 귀속부서
    ];

    blocks.forEach(block => {
      merges.push({ s: { r: 0, c: block.monthStartCol }, e: { r: 0, c: block.totalCol } });
    });

    merges.push({ s: { r: 0, c: s2IncreaseCol }, e: { r: 1, c: s2IncreaseCol } });

    ws2['!merges'] = merges;

    applyWorksheetStyle(ws2, {
      amountColumnIndexes: numericColsList,
      leftAlignColumnIndexes: [1, 2, 4, 6],
      headerRowCount: 2,
    });

    applyWorksheetView(ws2, {
      headerRowCount: 2,
      freezeColCount: 3,
    });

    const hideMonthlyColumns = (wsIdx: any, blks: any[]) => {
      wsIdx['!cols'] = wsIdx['!cols'] || [];

      // Initialize columns width
      for (let i = 0; i < finalColCount; i++) {
        if (i === 1) {
          wsIdx['!cols'][i] = { wch: 18 };
        } else if (i === 2) {
          wsIdx['!cols'][i] = { wch: 42 };
        } else if (i === 0 || i === 3 || i === 5) {
          wsIdx['!cols'][i] = { wch: 13 };
        } else if (i === 4 || i === 6) {
          wsIdx['!cols'][i] = { wch: 22 };
        } else {
          wsIdx['!cols'][i] = { wch: 9 };
        }
      }

      // Hide D~G 작성부서/귀속부서: Set to hidden always
      for (let c = 3; c <= 6; c++) {
        wsIdx['!cols'][c] = {
          ...(wsIdx['!cols'][c] || {}),
          hidden: true,
          level: 1,
          wch: c === 3 || c === 5 ? 13 : 22,
        };
      }

      blks.forEach(block => {
        for (let c = block.monthStartCol; c <= block.monthEndCol; c++) {
          wsIdx['!cols'][c] = {
            ...(wsIdx['!cols'][c] || {}),
            hidden: true,
            level: 1,
            wch: 10,
          };
        }

        wsIdx['!cols'][block.totalCol] = {
          ...(wsIdx['!cols'][block.totalCol] || {}),
          hidden: false,
          level: 0,
          wch: 16,
        };
      });

      wsIdx['!cols'][s2IncreaseCol] = {
        ...(wsIdx['!cols'][s2IncreaseCol] || {}),
        hidden: false,
        level: 0,
        wch: 18,
      };

      wsIdx['!outline'] = {
        left: false,
        symbols: true,
      };
    };

    hideMonthlyColumns(ws2, blocks);

    appendSheetSafely(wb, ws2, '월별상세');

    wb.Workbook = {
      ...(wb.Workbook || {}),
      CalcPr: {
        fullCalcOnLoad: true,
        forceFullCalc: true,
      },
    };

    XLSX.writeFile(wb, `다중계획비교_${baseYear}_계획${planEndMonth}월_실적${actualEndMonth}월.xlsx`);
  };

  const handleDownloadExcel = async () => {
    if (tab === 'multi_plan') {
      await handleDownloadMultiPlanExcel();
      return;
    }
    await ensureXLSX();
    const wb = XLSX.utils.book_new();

    const currentActiveDeptCodes = resolveSelectedDeptCodes({
      selectedDept,
      viewableDepts,
      isAdmin,
      isPlanningTeam,
    });

    const baseMatrix = buildMonthlyMatrix({
      year: baseYear,
      planType: basePlanType,
      monthMode: baseMonthMode,
      selectedMonth: baseSelectedMonth,
      deptCodes: currentActiveDeptCodes,
      accountMetaMap,
      hasSalaryAccess,
      includeSalaryRows,
      allDepts,
    });

    const targetMatrix = buildMonthlyMatrix({
      year: targetYear,
      planType: targetPlanType,
      monthMode: targetMonthMode,
      selectedMonth: targetSelectedMonth,
      deptCodes: currentActiveDeptCodes,
      accountMetaMap,
      hasSalaryAccess,
      includeSalaryRows,
      allDepts,
    });

    const exportMonthLimit = Math.max(baseSelectedMonth, targetSelectedMonth);
    const exportMonths = Array.from({ length: exportMonthLimit }, (_, i) => i + 1);

    const monthlyRows = buildAccountMonthlyCompareRows({
      baseMatrix,
      targetMatrix,
      exportMonths,
      basePlanType,
      targetPlanType,
      activeDept: selectedDept,
      selectedAccountingType,
      selectedAccountClass,
    });

    const targetShortName = `${targetYear} ${targetPlanType}`;
    const baseShortName = `${baseYear} ${basePlanType}`;

    const headerRow1 = [
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(() => `비교대상: ${targetShortName}`),
      `비교대상: ${targetShortName}`,
      ...exportMonths.map(() => `기준: ${baseShortName}`),
      `기준: ${baseShortName}`,
      '비교 결과',
      '비교 결과',
      '비교 결과',
    ];

    const headerRow2 = [
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      ...exportMonths.map(m => `${m}월`),
      '합계',
      '누계 차액',
      '증감률',
      '상태',
    ];

    const excelData: any[] = [headerRow1, headerRow2];

    monthlyRows.forEach(row => {
      excelData.push([
        row.accountClass,
        row.accountingType,
        row.accountCode,
        row.accountName,
        ...row.targetMonthly,
        row.targetTotal,
        ...row.baseMonthly,
        row.baseTotal,
        row.variance,
        toExcelPercentValue(row.varianceRate),
        row.status,
      ]);
    });

    let baseMfgMonthly = Array(exportMonths.length).fill(0);
    let targetMfgMonthly = Array(exportMonths.length).fill(0);
    let baseSgaMonthly = Array(exportMonths.length).fill(0);
    let targetSgaMonthly = Array(exportMonths.length).fill(0);

    monthlyRows.forEach(row => {
      if (row.accountingType === '제조') {
        for (let i = 0; i < exportMonths.length; i++) {
          baseMfgMonthly[i] += row.baseMonthly[i];
          targetMfgMonthly[i] += row.targetMonthly[i];
        }
      } else if (row.accountingType === '판관') {
        for (let i = 0; i < exportMonths.length; i++) {
          baseSgaMonthly[i] += row.baseMonthly[i];
          targetSgaMonthly[i] += row.targetMonthly[i];
        }
      }
    });

    const mfgBaseTotal = baseMfgMonthly.reduce((a, b) => a + b, 0);
    const mfgTargetTotal = targetMfgMonthly.reduce((a, b) => a + b, 0);
    const mfgVariance = mfgTargetTotal - mfgBaseTotal;
    const mfgVarianceRate = calcVarianceRate(mfgBaseTotal, mfgTargetTotal);

    const sgaBaseTotal = baseSgaMonthly.reduce((a, b) => a + b, 0);
    const sgaTargetTotal = targetSgaMonthly.reduce((a, b) => a + b, 0);
    const sgaVariance = sgaTargetTotal - sgaBaseTotal;
    const sgaVarianceRate = calcVarianceRate(sgaBaseTotal, sgaTargetTotal);

    const totalBaseMonthly = baseMfgMonthly.map((b, idx) => b + baseSgaMonthly[idx]);
    const totalTargetMonthly = targetMfgMonthly.map((t, idx) => t + targetSgaMonthly[idx]);
    const grandBaseTotal = totalBaseMonthly.reduce((a, b) => a + b, 0);
    const grandTargetTotal = totalTargetMonthly.reduce((a, b) => a + b, 0);
    const grandVariance = grandTargetTotal - grandBaseTotal;
    const grandVarianceRate = calcVarianceRate(grandBaseTotal, grandTargetTotal);

    const rangeArray = (start: number, count: number) => Array.from({ length: count }, (_, i) => start + i);
    const targetMonthStart = 4;
    const targetMonthCount = exportMonths.length;
    const targetTotalCol = targetMonthStart + targetMonthCount;
    const baseMonthStart = targetTotalCol + 1;
    const baseMonthCount = exportMonths.length;
    const baseTotalCol = baseMonthStart + baseMonthCount;
    const varianceCol = baseTotalCol + 1;
    const varianceRateCol = varianceCol + 1;
    const statusCol = varianceRateCol + 1;

    excelData.push(Array(statusCol + 1).fill(''));

    excelData.push([
      '', '', '', '제조 합계',
      ...targetMfgMonthly,
      mfgTargetTotal,
      ...baseMfgMonthly,
      mfgBaseTotal,
      mfgVariance,
      toExcelPercentValue(mfgVarianceRate),
      '',
    ]);

    excelData.push([
      '', '', '', '판관 합계',
      ...targetSgaMonthly,
      sgaTargetTotal,
      ...baseSgaMonthly,
      sgaBaseTotal,
      sgaVariance,
      toExcelPercentValue(sgaVarianceRate),
      '',
    ]);

    excelData.push([
      '', '', '', '총 합계',
      ...totalTargetMonthly,
      grandTargetTotal,
      ...totalBaseMonthly,
      grandBaseTotal,
      grandVariance,
      toExcelPercentValue(grandVarianceRate),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(excelData);

    const firstDataRow = 2; // Header rows are index 0 & 1, data starts at index 2 (Excel Row 3)
    const lastDataRow = firstDataRow + monthlyRows.length - 1;

    for (let r = firstDataRow; r <= lastDataRow; r += 1) {
      setFormulaCell(ws, r, targetTotalCol, makeSumFormula(r, targetMonthStart, targetTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, baseTotalCol, makeSumFormula(r, baseMonthStart, baseTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, varianceCol, makeVarianceFormula(r, targetTotalCol, baseTotalCol), '#,##0');
      setFormulaCell(ws, r, varianceRateCol, makeVarianceRateFormula(r, targetTotalCol, baseTotalCol), '0.00%');
    }

    const blankRowIndex = firstDataRow + monthlyRows.length;
    const mfgTotalRowIndex = blankRowIndex + 1;
    const sgaTotalRowIndex = blankRowIndex + 2;
    const grandTotalRowIndex = blankRowIndex + 3;

    for (let c = targetMonthStart; c <= targetTotalCol - 1; c += 1) {
      setFormulaCell(ws, mfgTotalRowIndex, c, makeAccountingTypeSumFormula('제조', c, firstDataRow, lastDataRow), '#,##0');
      setFormulaCell(ws, sgaTotalRowIndex, c, makeAccountingTypeSumFormula('판관', c, firstDataRow, lastDataRow), '#,##0');
      setFormulaCell(ws, grandTotalRowIndex, c, `SUM(${cellRef(mfgTotalRowIndex, c)}:${cellRef(sgaTotalRowIndex, c)})`, '#,##0');
    }

    for (let c = baseMonthStart; c <= baseTotalCol - 1; c += 1) {
      setFormulaCell(ws, mfgTotalRowIndex, c, makeAccountingTypeSumFormula('제조', c, firstDataRow, lastDataRow), '#,##0');
      setFormulaCell(ws, sgaTotalRowIndex, c, makeAccountingTypeSumFormula('판관', c, firstDataRow, lastDataRow), '#,##0');
      setFormulaCell(ws, grandTotalRowIndex, c, `SUM(${cellRef(mfgTotalRowIndex, c)}:${cellRef(sgaTotalRowIndex, c)})`, '#,##0');
    }

    [mfgTotalRowIndex, sgaTotalRowIndex, grandTotalRowIndex].forEach(r => {
      setFormulaCell(ws, r, targetTotalCol, makeSumFormula(r, targetMonthStart, targetTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, baseTotalCol, makeSumFormula(r, baseMonthStart, baseTotalCol - 1), '#,##0');
      setFormulaCell(ws, r, varianceCol, makeVarianceFormula(r, targetTotalCol, baseTotalCol), '#,##0');
      setFormulaCell(ws, r, varianceRateCol, makeVarianceRateFormula(r, targetTotalCol, baseTotalCol), '0.00%');
    });

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },

      { s: { r: 0, c: targetMonthStart }, e: { r: 0, c: targetTotalCol } },
      { s: { r: 0, c: baseMonthStart }, e: { r: 0, c: baseTotalCol } },
      { s: { r: 0, c: varianceCol }, e: { r: 0, c: statusCol } },
    ];

    const amountColumnIndexes = [
      ...rangeArray(targetMonthStart, exportMonths.length),
      targetTotalCol,
      ...rangeArray(baseMonthStart, exportMonths.length),
      baseTotalCol,
      varianceCol,
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes,
      percentColumnIndexes: [varianceRateCol],
      leftAlignColumnIndexes: [3],
      headerRowCount: 2,
    });

    applyMonthlyColumnGroups(ws, {
      targetStartCol: targetMonthStart,
      targetMonthCount: exportMonths.length,
      baseStartCol: baseMonthStart,
      baseMonthCount: exportMonths.length,
    });

    applyWorksheetView(ws, {
      headerRowCount: 2,
      freezeColCount: 4,
    });

    ws['!cols'] = ws['!cols'] || [];
    const maxCol = excelData[0].length - 1;
    for (let c = 0; c <= maxCol; c++) {
      const existing = ws['!cols'][c] || {};
      if (c === 0) ws['!cols'][c] = { ...existing, wch: 16 };
      else if (c === 1) ws['!cols'][c] = { ...existing, wch: 12 };
      else if (c === 2) ws['!cols'][c] = { ...existing, wch: 15 };
      else if (c === 3) ws['!cols'][c] = { ...existing, wch: 30 };
      else ws['!cols'][c] = { ...existing, wch: 13 };
    }

    if (ws['!cols'][targetTotalCol]) ws['!cols'][targetTotalCol] = { ...ws['!cols'][targetTotalCol], wch: 18 };
    if (ws['!cols'][baseTotalCol]) ws['!cols'][baseTotalCol] = { ...ws['!cols'][baseTotalCol], wch: 18 };
    if (ws['!cols'][varianceCol]) ws['!cols'][varianceCol] = { ...ws['!cols'][varianceCol], wch: 18 };
    if (ws['!cols'][varianceRateCol]) ws['!cols'][varianceRateCol] = { ...ws['!cols'][varianceRateCol], wch: 14 };
    if (ws['!cols'][statusCol]) ws['!cols'][statusCol] = { ...ws['!cols'][statusCol], wch: 11 };

    appendSheetSafely(wb, ws, '비교분석');

    wb.Workbook = {
      ...(wb.Workbook || {}),
      CalcPr: {
        fullCalcOnLoad: true,
        forceFullCalc: true,
      },
    };

    XLSX.writeFile(wb, getDownloadFileName('xlsx'));
  };

  const handleDownloadPPT = async () => {
    const pptxgen = (await import('pptxgenjs')).default;
    const pres = new pptxgen();
    
    const slide1 = pres.addSlide();
    slide1.addText('예산 비교분석 보고서', { x: 1, y: 2, w: '80%', h: 1, fontSize: 36, bold: true, color: '191f28' });
    slide1.addText(`기준: ${baseName}\n비교: ${targetName}`, { x: 1, y: 3.5, w: '80%', h: 1, fontSize: 18, color: '4e5968' });

    const slide2 = pres.addSlide();
    slide2.addText('요약', { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 24, bold: true, color: '191f28' });
    
    const pptTotalBase = totalBase;
    const pptTotalTarget = totalTarget;
    const pptTotalVariance = totalVariance;

    slide2.addText(`${baseName} 총액: ${formatCurrency(pptTotalBase)}원`, { x: 0.5, y: 1.5, w: '90%', h: 0.5, fontSize: 18 });
    slide2.addText(`${targetName} 총액: ${formatCurrency(pptTotalTarget)}원`, { x: 0.5, y: 2.2, w: '90%', h: 0.5, fontSize: 18 });
    
    const formattedPercent = formatVarianceRate(totalVariancePercent, 1);
    const varianceText = `${pptTotalVariance > 0 ? '+' : ''}${formatCurrency(pptTotalVariance)}원 (${formattedPercent})`;
    slide2.addText(`증감액: ${varianceText}`, { x: 0.5, y: 2.9, w: '90%', h: 0.5, fontSize: 18, bold: true, color: pptTotalVariance > 0 ? 'FF0000' : '0000FF' });

    const slide3 = pres.addSlide();
    slide3.addText('상세 비교 데이터', { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 24, bold: true, color: '191f28' });

    let tableHeaders: any[] = [];
    let tableRows: any[] = [];

    if (selectedDept === 'by_dept') {
      tableHeaders = [
        { text: '부서명', options: { fill: 'f9fafb', bold: true } },
        { text: baseName, options: { fill: 'f9fafb', bold: true } },
        { text: targetName, options: { fill: 'f9fafb', bold: true } },
        { text: '차액', options: { fill: 'f9fafb', bold: true } },
        { text: '증감률(%)', options: { fill: 'f9fafb', bold: true } }
      ];
      tableRows = filteredAndSortedRows.slice(0, 15).map(row => [
        getCompareRowName(row, selectedDept === 'by_dept'),
        formatCurrency(row.baseAmount),
        formatCurrency(row.targetAmount),
        `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
        formatVarianceRate(row.variancePercent, 1)
      ]);
    } else {
      tableHeaders = [
        { text: '계정코드', options: { fill: 'f9fafb', bold: true } },
        { text: '계정명', options: { fill: 'f9fafb', bold: true } },
        { text: baseName, options: { fill: 'f9fafb', bold: true } },
        { text: targetName, options: { fill: 'f9fafb', bold: true } },
        { text: '차액', options: { fill: 'f9fafb', bold: true } },
        { text: '증감률(%)', options: { fill: 'f9fafb', bold: true } }
      ];

      filteredAndSortedRows.forEach(row => {
        tableRows.push([
          row.accountCode || '',
          getCompareRowName(row, selectedDept === 'by_dept'),
          formatCurrency(row.baseAmount),
          formatCurrency(row.targetAmount),
          `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
          formatVarianceRate(row.variancePercent, 1)
        ]);
      });
      
      // Limit to 15 rows for PPT to avoid overflow
      tableRows = tableRows.slice(0, 15);
    }

    if (selectedDept === 'by_dept') {
      slide3.addTable([tableHeaders, ...tableRows], { x: 0.5, y: 1.2, w: 9, colW: [2, 2, 2, 1.5, 1.5], fontSize: 12 });
    } else {
      slide3.addTable([tableHeaders, ...tableRows], { x: 0.5, y: 1.2, w: 9, colW: [1.5, 2, 1.5, 1.5, 1.25, 1.25], fontSize: 11 });
    }

    pres.writeFile({ fileName: getDownloadFileName('pptx') });
  };

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF('landscape');
    
    try {
      const response = await fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/public/static/Pretendard-Regular.ttf');
      const buffer = await response.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      
      doc.addFileToVFS('Pretendard.ttf', base64);
      doc.addFont('Pretendard.ttf', 'Pretendard', 'normal');
      doc.setFont('Pretendard');
    } catch (e) {
      console.error('Failed to load font', e);
    }

    doc.setFontSize(20);
    doc.text('예산 비교분석 보고서', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`기준: ${baseName} / 비교: ${targetName}`, 14, 32);

    const pdfTotalBase = totalBase;
    const pdfTotalTarget = totalTarget;
    const pdfTotalVariance = totalVariance;
    const pdfTotalVariancePercent = totalVariancePercent;

    doc.text(`총액 요약:`, 14, 42);
    doc.text(`- ${baseName} 총액: ${formatCurrency(pdfTotalBase)}원`, 14, 48);
    doc.text(`- ${targetName} 총액: ${formatCurrency(pdfTotalTarget)}원`, 14, 54);
    const varianceText = `${pdfTotalVariance > 0 ? '+' : ''}${formatCurrency(pdfTotalVariance)}원 (${formatVarianceRate(pdfTotalVariancePercent, 1)})`;
    doc.text(`- 증감액: ${varianceText}`, 14, 60);

    let head = [];
    let body = [];

    const pdfRows = filteredAndSortedRows.slice(0, 100);

    if (selectedDept === 'by_dept') {
      head = [['부서명', baseName, targetName, '차액', '증감률(%)']];
      body = pdfRows.map(row => [
        getCompareRowName(row, selectedDept === 'by_dept'),
        formatCurrency(row.baseAmount),
        formatCurrency(row.targetAmount),
        `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
        formatVarianceRate(row.variancePercent, 1)
      ]);
    } else {
      head = [['계정코드', '계정명', baseName, targetName, '차액', '증감률(%)']];
      
      pdfRows.forEach(row => {
        body.push([
          row.accountCode || '',
          getCompareRowName(row, selectedDept === 'by_dept'),
          formatCurrency(row.baseAmount),
          formatCurrency(row.targetAmount),
          `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
          formatVarianceRate(row.variancePercent, 1)
        ]);
      });
    }

    autoTable(doc, {
      startY: 65,
      head: head,
      body: body,
      styles: { font: 'Pretendard', fontStyle: 'normal' },
      headStyles: { fillColor: [249, 250, 251], textColor: [78, 89, 104], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 253, 254] },
    });

    doc.save(getDownloadFileName('pdf'));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.download-menu-container')) {
        setShowDownloadMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedAccounts = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    if (savedAccounts) {
      setCategories(JSON.parse(savedAccounts));
    }
  }, []);

  const toggleCategory = (categoryName: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryName)) {
      newCollapsed.delete(categoryName);
    } else {
      newCollapsed.add(categoryName);
    }
    setCollapsedCategories(newCollapsed);
  };

  const selectedDeptCodes = useMemo(() => {
    return resolveSelectedDeptCodes({
      selectedDept,
      viewableDepts,
      isAdmin,
      isPlanningTeam,
    });
  }, [selectedDept, viewableDepts, isAdmin, isPlanningTeam]);

  const accountMetaMap = useMemo(() => {
    const rawActuals = loadActualRows(baseYear).concat(loadActualRows(targetYear));
    const deptCodesSet = new Set(selectedDeptCodes);
    const actualRows = rawActuals.filter(row => {
      const effDept = getEffectiveDeptCodeForActual(row);
      return deptCodesSet.has(effDept);
    });
    const budgetRowsByDept = new Map<string, any[]>();

    if (basePlanType !== '실적') {
      const baseBudgets = loadBudgetRowsByDept({
        year: baseYear,
        planType: basePlanType,
        deptCodes: selectedDeptCodes,
      });
      baseBudgets.forEach((rows, dCode) => {
        budgetRowsByDept.set(`${baseYear}_${dCode}`, rows);
      });
    }
    if (targetPlanType !== '실적') {
      const targetBudgets = loadBudgetRowsByDept({
        year: targetYear,
        planType: targetPlanType,
        deptCodes: selectedDeptCodes,
      });
      targetBudgets.forEach((rows, dCode) => {
        budgetRowsByDept.set(`${targetYear}_${dCode}`, rows);
      });
    }

    return buildAccountMetaIndex({
      year: baseYear,
      categories,
      actualRows,
      budgetRowsByDept,
    });
  }, [baseYear, targetYear, basePlanType, targetPlanType, categories, selectedDeptCodes]);

  const baseAtomicRows = useMemo(() => {
    return buildAtomicCompareRows({
      year: baseYear,
      planType: basePlanType,
      monthMode: baseMonthMode,
      selectedMonth: baseSelectedMonth,
      deptCodes: selectedDeptCodes,
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });
  }, [baseYear, basePlanType, baseMonthMode, baseSelectedMonth, selectedDeptCodes, accountMetaMap, hasSalaryAccess, includeSalaryRows, allDepts]);

  const targetAtomicRows = useMemo(() => {
    return buildAtomicCompareRows({
      year: targetYear,
      planType: targetPlanType,
      monthMode: targetMonthMode,
      selectedMonth: targetSelectedMonth,
      deptCodes: selectedDeptCodes,
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });
  }, [targetYear, targetPlanType, targetMonthMode, targetSelectedMonth, selectedDeptCodes, accountMetaMap, hasSalaryAccess, includeSalaryRows, allDepts]);

  const varianceResult = useMemo(() => {
    const groupBy = selectedDept === 'by_dept' ? 'dept' : 'account';
    return buildVarianceComparison({
      baseRows: baseAtomicRows,
      targetRows: targetAtomicRows,
      groupBy,
      allDepts,
      activeDept: selectedDept,
      selectedAccountingType,
      selectedAccountClass,
      basePlanType,
      targetPlanType,
    });
  }, [baseAtomicRows, targetAtomicRows, selectedDept, allDepts, selectedAccountingType, selectedAccountClass, basePlanType, targetPlanType]);

  const comparisonRows = useMemo(() => {
    return varianceResult.rows;
  }, [varianceResult]);

  const salaryFilteredComparisonRows = useMemo(() => {
    if (hasSalaryAccess && includeSalaryRows) return comparisonRows;
    return comparisonRows.filter(row => !row.isSalary);
  }, [comparisonRows, hasSalaryAccess, includeSalaryRows]);

  const summaryTotals = useMemo(() => {
    return varianceResult.summary;
  }, [varianceResult]);

  // Keep baseSelectedMonth synchronized in multi-plan
  useEffect(() => {
    if (tab === 'multi_plan') {
      setBaseSelectedMonth(actualEndMonth);
    }
  }, [actualEndMonth, tab]);

  const currentActiveDeptCodes = useMemo(() => {
    return resolveSelectedDeptCodes({
      selectedDept,
      viewableDepts,
      isAdmin,
      isPlanningTeam,
    });
  }, [selectedDept, viewableDepts, isAdmin, isPlanningTeam]);

  const effectiveMultiPlanViewMode = useMemo(() => {
    return selectedDept === 'by_dept' ? 'BY_DEPT' : multiPlanViewMode;
  }, [selectedDept, multiPlanViewMode]);

  // P0-3. VarianceComparison.tsx에서 load scope와 filter scope 분리
  const multiPlanLoadDeptCodes = useMemo(() => {
    return viewableDepts.map(d => d.code);
  }, [viewableDepts]);

  const multiPlanFilterDeptCodes = currentActiveDeptCodes;

  // P0-1. 다중계획 전용 effectiveIncludeSalaryRows 추가 및 직원급여 계정 필터 충돌 방지
  const isSalaryAccountClassSelected = useMemo(() => {
    const SALARY_ACCOUNT_CLASSES = new Set([
      '직원급여',
      '임원급여',
      '급여',
      '상여',
      '임원활동수당',
    ]);
    return SALARY_ACCOUNT_CLASSES.has(selectedAccountClass);
  }, [selectedAccountClass]);

  const effectiveIncludeSalaryRowsForMultiPlan = useMemo(() => {
    return hasSalaryAccess && (
      includeSalaryRows ||
      (tab === 'multi_plan' && isSalaryAccountClassSelected)
    );
  }, [hasSalaryAccess, includeSalaryRows, tab, isSalaryAccountClassSelected]);

  // multi_plan calculations
  const { columns: multiPlanColumns, rows: multiPlanRows } = useMemo(() => {
    if (tab !== 'multi_plan') {
      return { columns: [], rows: [] };
    }
    if (currentActiveDeptCodes.length === 0) {
      return {
        columns: [],
        rows: [],
      };
    }
    return buildMultiPlanComparisonRows({
      year: baseYear,
      selectedPlanTypes,
      planEndMonth,
      actualEndMonth,
      viewMode: effectiveMultiPlanViewMode,
      deptCodes: multiPlanLoadDeptCodes,
      deptFilterCodes: multiPlanFilterDeptCodes,
      accountMetaMap,
      hasSalaryAccess,
      includeSalaryRows: effectiveIncludeSalaryRowsForMultiPlan,
      allDepts,
      increaseBasisCol: increaseBasisCol.startsWith('plan_') ? increaseBasisCol : `plan_${increaseBasisCol}`,
      increaseTargetCol: increaseTargetCol.startsWith('plan_') ? increaseTargetCol : `plan_${increaseTargetCol}`,
      selectedDept,
    });
  }, [
    tab,
    baseYear,
    selectedPlanTypes,
    planEndMonth,
    actualEndMonth,
    selectedDept,
    effectiveMultiPlanViewMode,
    currentActiveDeptCodes,
    multiPlanLoadDeptCodes,
    multiPlanFilterDeptCodes,
    accountMetaMap,
    hasSalaryAccess,
    effectiveIncludeSalaryRowsForMultiPlan,
    allDepts,
    increaseBasisCol,
    increaseTargetCol,
  ]);

  const filteredMultiPlanRows = useMemo(() => {
    let result = [...multiPlanRows];

    // Filter by activeDept / accountingType (Mfg vs SGA / Account type / Account Class)
    if (selectedDept === 'mfg') {
      result = result.filter(r => r.accountingType === '제조');
    } else if (selectedDept === 'sga') {
      result = result.filter(r => r.accountingType === '판관');
    }

    // P0-4: Removed filteredMultiPlanRows post filter for specific departments
    
    if (selectedAccountingType !== '전체') {
      result = result.filter(r => r.accountingType === selectedAccountingType);
    }
    if (selectedAccountClass !== '전체') {
      result = result.filter(r => r.accountClass === selectedAccountClass);
    }

    if (multiPlanFilters.accountCode) {
      const q = multiPlanFilters.accountCode.toLowerCase();
      result = result.filter(r => r.accountCode.toLowerCase().includes(q));
    }
    if (multiPlanFilters.accountName) {
      const q = multiPlanFilters.accountName.toLowerCase();
      result = result.filter(r => r.accountName.toLowerCase().includes(q));
    }
    if (multiPlanFilters.accountClass) {
      result = result.filter(r => r.accountClass?.includes(multiPlanFilters.accountClass));
    }
    if (multiPlanFilters.accountingType) {
      result = result.filter(r => r.accountingType === multiPlanFilters.accountingType);
    }
    if (multiPlanFilters.minAmount) {
      const minVal = Number(multiPlanFilters.minAmount) * 1000000;
      if (!isNaN(minVal)) {
        result = result.filter(r => {
          return Object.values(r.totalByColumnId).some(val => Math.abs(val as number) >= minVal) || Math.abs(r.requiredIncreaseAmount) >= minVal;
        });
      }
    }

    // Sort by largest requiredIncreaseAmount descending
    result.sort((a, b) => Math.abs(b.requiredIncreaseAmount) - Math.abs(a.requiredIncreaseAmount));

    return result;
  }, [multiPlanRows, selectedDept, currentActiveDeptCodes, selectedAccountingType, selectedAccountClass, multiPlanFilters]);

  const pagedMultiPlanRows = useMemo(() => {
    return filteredMultiPlanRows.slice(0, visibleDetailCount);
  }, [filteredMultiPlanRows, visibleDetailCount]);

  // P0-6. 빈 화면 메시지를 “예산 없음” 하나로 뭉개지 말고 원인 분리
  const multiPlanEmptyReason = useMemo(() => {
    if (tab !== 'multi_plan') return '';

    if (!currentUser) {
      return '로그인 정보를 확인하는 중입니다.';
    }

    if (isSalaryAccountClassSelected && !hasSalaryAccess) {
      return '급여성 계정은 조회 권한이 없어 표시되지 않습니다. 권한을 확인하거나 비용성격을 전체로 변경해주세요.';
    }

    if (currentActiveDeptCodes.length === 0) {
      return '조회 가능한 부서가 없습니다. 로그인 또는 부서 권한을 확인해주세요.';
    }

    if (multiPlanRows.length === 0) {
      return '선택한 계획유형과 연도에 해당하는 원천 다중계획 데이터가 없습니다. 업로드 자료와 저장 key를 확인해주세요.';
    }

    if (isSalaryAccountClassSelected && hasSalaryAccess && !effectiveIncludeSalaryRowsForMultiPlan) {
      return '직원급여 등 급여성 계정을 조회하려면 급여성 계정 포함을 켜야 합니다.';
    }

    if (filteredMultiPlanRows.length === 0) {
      return '원천 데이터는 있으나 현재 부서/회계구분/비용성격/검색 필터 조건에 맞는 항목이 없습니다. 필터를 완화해보세요.';
    }

    return '';
  }, [
    tab,
    currentUser,
    isSalaryAccountClassSelected,
    hasSalaryAccess,
    effectiveIncludeSalaryRowsForMultiPlan,
    currentActiveDeptCodes.length,
    multiPlanRows.length,
    filteredMultiPlanRows.length,
  ]);

  // P0-7. debug panel 또는 console 로그를 정확히 추가
  useEffect(() => {
    if (tab === 'multi_plan') {
      if ((import.meta as any).env?.DEV && localStorage.getItem('debug_multi_plan') === 'true') {
        console.log('[multi_plan debug]', {
          selectedDept,
          currentActiveDeptCodes,
          multiPlanLoadDeptCodes,
          multiPlanFilterDeptCodes,
          effectiveMultiPlanViewMode,
          selectedPlanTypes,
          multiPlanRows: multiPlanRows.length,
          filteredMultiPlanRows: filteredMultiPlanRows.length,
          sampleRows: multiPlanRows.slice(0, 5).map(r => ({
            rowKey: r.rowKey,
            accountCode: r.accountCode,
            writerDeptCode: r.writerDeptCode,
            attributedDeptCode: r.attributedDeptCode,
            writerDeptCodes: r.writerDeptCodes,
            attributedDeptCodes: r.attributedDeptCodes,
            totals: r.totalByColumnId,
          })),
        });
      }
    }
  }, [
    tab,
    selectedDept,
    currentActiveDeptCodes,
    multiPlanLoadDeptCodes,
    multiPlanFilterDeptCodes,
    effectiveMultiPlanViewMode,
    selectedPlanTypes,
    multiPlanRows,
    filteredMultiPlanRows,
  ]);

  const multiPlanTotals = useMemo(() => {
    const listToSum = filteredMultiPlanRows;

    const mfgRows = listToSum.filter(r => r.accountingType === '제조');
    const sgaRows = listToSum.filter(r => r.accountingType === '판관');

    const buildTotalRow = (label: string, rows: any[]) => {
      const valuesByColumnId: Record<string, number> = {};
      const monthlyValuesByColumnId: Record<string, number[]> = {};

      multiPlanColumns.forEach(col => {
        valuesByColumnId[col.id] = rows.reduce((sum, r) => sum + (r.totalByColumnId[col.id] || 0), 0);

        const monthlySum = Array(12).fill(0);
        rows.forEach(r => {
          const colMonthly = r.monthlyByColumnId[col.id] || Array(12).fill(0);
          for (let m = 0; m < 12; m++) {
            monthlySum[m] += colMonthly[m];
          }
        });
        monthlyValuesByColumnId[col.id] = monthlySum;
      });

      const basisVal = valuesByColumnId[increaseBasisCol] || 0;
      const targetVal = valuesByColumnId[increaseTargetCol] || 0;
      const requiredIncreaseAmount = targetVal - basisVal;

      return {
        label,
        valuesByColumnId,
        monthlyValuesByColumnId,
        requiredIncreaseAmount,
      };
    };

    return {
      mfg: buildTotalRow('제조 합계', mfgRows),
      sga: buildTotalRow('판관 합계', sgaRows),
      grand: buildTotalRow('총합계', listToSum),
    };
  }, [filteredMultiPlanRows, multiPlanColumns, increaseBasisCol, increaseTargetCol]);

  const chartData = useMemo(() => {
    return salaryFilteredComparisonRows.map(row => ({
      code: row.code,
      name: row.name,
      [baseName]: row.baseAmount,
      [targetName]: row.targetAmount,
      variance: row.variance,
      variancePercent: row.variancePercent,
    })).filter(item => (item[baseName] as number) > 0 || (item[targetName] as number) > 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [salaryFilteredComparisonRows, baseName, targetName]);

  const selectedDeptDetails = useMemo(() => {
    if (selectedDept !== 'by_dept' || !selectedDepartment) return [];

    const detailsResult = buildVarianceComparison({
      baseRows: baseAtomicRows.filter(r => r.deptCode === selectedDepartment.departmentCode),
      targetRows: targetAtomicRows.filter(r => r.deptCode === selectedDepartment.departmentCode),
      groupBy: 'account',
      allDepts,
      activeDept: selectedDepartment.departmentCode,
      selectedAccountingType: '전체',
      selectedAccountClass: '전체',
      basePlanType,
      targetPlanType,
    });

    return detailsResult.rows.map(row => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      budgetAmount: row.baseAmount,
      actualAmount: row.targetAmount,
      varianceAmount: row.variance,
      executionRate: row.baseAmount === 0 ? null : (row.targetAmount / row.baseAmount) * 100,
    }));
  }, [selectedDept, selectedDepartment, baseAtomicRows, targetAtomicRows, allDepts, basePlanType, targetPlanType]);

  const visibleChartData = useMemo(() => {
    let rows = [...salaryFilteredComparisonRows];

    if (selectedDept === 'by_dept') {
      // 부서별 비교 화면은 부서별 Top N 유지
      rows = rows.filter(row => row.baseAmount !== 0 || row.targetAmount !== 0);
    } else {
      if (chartAccountView === 'MFG') {
        rows = rows.filter(row => row.accountingType === '제조');
      }

      if (chartAccountView === 'SGA') {
        rows = rows.filter(row => row.accountingType === '판관');
      }

      if (chartAccountView === 'CLASS' && chartAccountClass !== '전체') {
        rows = rows.filter(row => row.accountClass === chartAccountClass);
      }
    }

    return rows
      .filter(row => row.baseAmount !== 0 || row.targetAmount !== 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, chartTopN)
      .map(row => ({
        code: row.accountCode || row.key,
        name: row.accountName || row.deptName,
        displayName: shortenAccountName(row.accountName || row.deptName),
        [baseName]: row.baseAmount,
        [targetName]: row.targetAmount,
        variance: row.variance,
        variancePercent: row.variancePercent,
        accountClass: row.accountClass,
        accountingType: row.accountingType,
        status: row.status,
      }));
  }, [
    salaryFilteredComparisonRows,
    selectedDept,
    chartAccountView,
    chartAccountClass,
    chartTopN,
    baseName,
    targetName,
  ]);

  const visibleComparisonRows = useMemo(() => {
    if (!applyChartFilterToTable) return salaryFilteredComparisonRows;

    let rows = [...salaryFilteredComparisonRows];

    if (chartAccountView === 'MFG') {
      rows = rows.filter(row => row.accountingType === '제조');
    }

    if (chartAccountView === 'SGA') {
      rows = rows.filter(row => row.accountingType === '판관');
    }

    if (chartAccountView === 'CLASS' && chartAccountClass !== '전체') {
      rows = rows.filter(row => row.accountClass === chartAccountClass);
    }

    return rows;
  }, [salaryFilteredComparisonRows, applyChartFilterToTable, chartAccountView, chartAccountClass]);

  const fullFilteredAccountRows = useMemo(() => {
    let rows = [...salaryFilteredComparisonRows];

    if (chartAccountView === 'MFG') {
      rows = rows.filter(row => row.accountingType === '제조');
    }

    if (chartAccountView === 'SGA') {
      rows = rows.filter(row => row.accountingType === '판관');
    }

    if (chartAccountView === 'CLASS' && chartAccountClass !== '전체') {
      rows = rows.filter(row => row.accountClass === chartAccountClass);
    }

    return rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [salaryFilteredComparisonRows, chartAccountView, chartAccountClass]);

  const filteredAndSortedRows = useMemo(() => {
    let rows = [...visibleComparisonRows];
    const isDeptMode = selectedDept === 'by_dept';

    // 1. Apply table filters (detailFilters)
    if (detailFilters.accountClass) {
      rows = rows.filter(row => row.accountClass.includes(detailFilters.accountClass));
    }
    if (detailFilters.accountingType) {
      rows = rows.filter(row => row.accountingType === detailFilters.accountingType);
    }
    if (detailFilters.accountCode) {
      const codeTerm = detailFilters.accountCode.toLowerCase();
      rows = rows.filter(row =>
        getCompareRowCode(row, isDeptMode).toLowerCase().includes(codeTerm)
      );
    }
    if (detailFilters.accountName) {
      const nameTerm = detailFilters.accountName.toLowerCase();
      rows = rows.filter(row =>
        getCompareRowName(row, isDeptMode).toLowerCase().includes(nameTerm)
      );
    }
    if (detailFilters.status) {
      rows = rows.filter(row => row.status === detailFilters.status);
    }
    if (detailFilters.minVariance) {
      const minVal = Number(detailFilters.minVariance) * 1000000;
      if (!isNaN(minVal)) {
        rows = rows.filter(row => Math.abs(row.variance) >= minVal);
      }
    }
    if (detailFilters.minAmount) {
      const minAmtVal = Number(detailFilters.minAmount) * 1000000;
      if (!isNaN(minAmtVal)) {
        rows = rows.filter(row => Math.abs(row.baseAmount) >= minAmtVal || Math.abs(row.targetAmount) >= minAmtVal);
      }
    }

    // 2. Apply table sorting (detailSort)
    if (detailSort) {
      const { key, direction } = detailSort;
      rows.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (key === 'variance') {
          valA = Math.abs(a.variance);
          valB = Math.abs(b.variance);
        } else if (key === 'variancePercent') {
          valA = a.variancePercent;
          valB = b.variancePercent;
        } else if (key === 'baseAmount') {
          valA = a.baseAmount;
          valB = b.baseAmount;
        } else if (key === 'targetAmount') {
          valA = a.targetAmount;
          valB = b.targetAmount;
        } else if (key === 'accountCode') {
          valA = getCompareRowCode(a, isDeptMode);
          valB = getCompareRowCode(b, isDeptMode);
        } else if (key === 'accountName') {
          valA = getCompareRowName(a, isDeptMode);
          valB = getCompareRowName(b, isDeptMode);
        } else if (key === 'accountClass') {
          valA = a.accountClass;
          valB = b.accountClass;
        } else if (key === 'accountingType') {
          valA = a.accountingType;
          valB = b.accountingType;
        } else if (key === 'status') {
          valA = a.status;
          valB = b.status;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return direction === 'asc' ? numA - numB : numB - numA;
        }
      });
    } else {
      rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    }

    return rows;
  }, [visibleComparisonRows, detailFilters, detailSort, selectedDept]);

  const pagedVisibleComparisonRows = useMemo(() => {
    return filteredAndSortedRows.slice(0, visibleDetailCount);
  }, [filteredAndSortedRows, visibleDetailCount]);

  const totalBase = useMemo(() => {
    return salaryFilteredComparisonRows.reduce((sum, row) => sum + row.baseAmount, 0);
  }, [salaryFilteredComparisonRows]);

  const totalTarget = useMemo(() => {
    return salaryFilteredComparisonRows.reduce((sum, row) => sum + row.targetAmount, 0);
  }, [salaryFilteredComparisonRows]);

  const totalVariance = useMemo(() => {
    return totalTarget - totalBase;
  }, [totalBase, totalTarget]);

  const totalVariancePercent = useMemo(() => {
    return calcVarianceRate(totalBase, totalTarget);
  }, [totalBase, totalTarget]);

  const mfgRate = useMemo(() => {
    return calcVarianceRate(summaryTotals.baseMfg, summaryTotals.targetMfg);
  }, [summaryTotals.baseMfg, summaryTotals.targetMfg]);

  const sgaRate = useMemo(() => {
    return calcVarianceRate(summaryTotals.baseSga, summaryTotals.targetSga);
  }, [summaryTotals.baseSga, summaryTotals.targetSga]);

  const isDeptMode = selectedDept === 'by_dept';

  return (
    <div className="space-y-6">
      {/* Dynamic Header with metadata context */}
      <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-nickel-50 text-nickel-600 px-2 py-0.5 rounded font-bold font-mono">
            {tab === 'default' && '계획 대비 실적'}
            {tab === 'time' && '시점 비교'}
            {tab === 'dept' && '부서별 비교'}
            {tab === 'account' && '계정별 비교'}
            {tab === 'multi_plan' && '다중계획 비교'}
          </span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
          {tab === 'default' && '예산 대비 실적 비교분석'}
          {tab === 'time' && '시점별 예산·실적 비교분석'}
          {tab === 'dept' && '부서별 예산 집행 비교분석'}
          {tab === 'account' && '계정별 예산 집행 비교분석'}
          {tab === 'multi_plan' && '다중계획 집행 비교분석'}
        </h2>
        <p className="text-xs text-[#647067] mt-1">
          {tab === 'default' && '선택한 계획과 실적을 같은 기준으로 비교하여 차액과 증감률을 확인합니다.'}
          {tab === 'time' && '서로 다른 연도·월·계획구분을 기준으로 예산과 실적 변화를 비교합니다.'}
          {tab === 'dept' && '부서별 편성 예산과 집행 실적을 비교하여 집행 차이를 확인합니다.'}
          {tab === 'account' && '계정별 예산과 실적 차이를 확인하고 주요 변동 계정을 점검합니다.'}
          {tab === 'multi_plan' && '경영계획(증액반영), 1차/2차 RP 및 누적 실적 데이터를 계정 기준으로 다각도 비교합니다.'}
        </p>
      </div>

      {fromDashboardTop6 && queryDeptCode && !permissionError && (
        <div className="rounded-xl border border-teal-200 bg-[#f0f9f8] px-4 py-3 text-xs text-[#008f83] flex items-center justify-between">
          <span>
            운영 대시보드 Top 6에서 이동했습니다. 
            <strong className="ml-2 text-zinc-900 bg-white px-2 py-0.5 rounded border border-[#dde5de] font-sans">
              {getDeptName()} ({queryDeptCode}) · {baseYear}년 1월~{baseSelectedMonth}월 경영계획 대비 실적
            </strong>
          </span>
        </div>
      )}

      {permissionError && (
        <div className="rounded-xl border border-rose-250 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{permissionError}</span>
          <button onClick={() => setPermissionError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Elegant Nav Tabs */}
      <div className="flex border-b border-lithium-200 gap-2">
        <button
          onClick={() => navigate('/variance-comparison?tab=default')}
          className={`px-4 py-2.5 font-semibold text-xs transition-all border-b-2 -mb-px rounded-t-lg ${
            tab === 'default'
              ? 'border-nickel-500 text-nickel-600 font-bold bg-nickel-50/50'
              : 'border-transparent text-text-secondary hover:text-eco-black hover:bg-zinc-50'
          }`}
        >
          계획 대비 실적
        </button>
        <button
          onClick={() => navigate('/variance-comparison?tab=time')}
          className={`px-4 py-2.5 font-semibold text-xs transition-all border-b-2 -mb-px rounded-t-lg ${
            tab === 'time'
              ? 'border-nickel-500 text-nickel-600 font-bold bg-nickel-50/50'
              : 'border-transparent text-text-secondary hover:text-eco-black hover:bg-zinc-50'
          }`}
        >
          시점 비교
        </button>
        <button
          onClick={() => navigate('/variance-comparison?tab=dept')}
          className={`px-4 py-2.5 font-semibold text-xs transition-all border-b-2 -mb-px rounded-t-lg ${
            tab === 'dept'
              ? 'border-nickel-500 text-nickel-600 font-bold bg-nickel-50/50'
              : 'border-transparent text-text-secondary hover:text-eco-black hover:bg-zinc-50'
          }`}
        >
          부서별 비교
        </button>
        <button
          onClick={() => navigate('/variance-comparison?tab=account')}
          className={`px-4 py-2.5 font-semibold text-xs transition-all border-b-2 -mb-px rounded-t-lg ${
            tab === 'account'
              ? 'border-nickel-500 text-nickel-600 font-bold bg-nickel-50/50'
              : 'border-transparent text-text-secondary hover:text-eco-black hover:bg-zinc-50'
          }`}
        >
          계정별 비교
        </button>
        <button
          onClick={() => navigate('/variance-comparison?tab=multi_plan')}
          className={`px-4 py-2.5 font-semibold text-xs transition-all border-b-2 -mb-px rounded-t-lg ${
            tab === 'multi_plan'
              ? 'border-nickel-500 text-nickel-600 font-bold bg-nickel-50/50'
              : 'border-transparent text-text-secondary hover:text-eco-black hover:bg-zinc-50'
          }`}
        >
          다중계획 비교
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm flex flex-col gap-4">
        {tab === 'multi_plan' ? (
          <div className="flex flex-col gap-5 w-full">
            {/* Top row: Year & Months & Dynamic Comparer */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pb-4 border-b border-lithium-100">
              {/* Year Select */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text-secondary">조회 연도</span>
                <select 
                  value={baseYear} 
                  onChange={(e) => setBaseYear(e.target.value)}
                  className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium outline-none transition-all w-full cursor-pointer"
                >
                  <option value="2024">2024년</option>
                  <option value="2025">2025년</option>
                  <option value="2026">2026년</option>
                  <option value="2027">2027년</option>
                </select>
              </div>

              {/* Plan Cumulative Month */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text-secondary">계획 누계 월</span>
                <select 
                  value={planEndMonth} 
                  onChange={(e) => setPlanEndMonth(Number(e.target.value))}
                  className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium outline-none transition-all w-full cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>~{m}월 누계</option>
                  ))}
                </select>
              </div>

              {/* Actual Cumulative Month */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text-secondary">실적 누계 월</span>
                <select 
                  value={actualEndMonth} 
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setActualEndMonth(m);
                    setBaseSelectedMonth(m); // Keep base sync for alignment
                  }}
                  className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium outline-none transition-all w-full cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>~{m}월 누계</option>
                  ))}
                </select>
              </div>

              {/* View Mode (All / Dept Only / Writer Only) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text-secondary">조회 단위</span>
                <select 
                  value={multiPlanViewMode} 
                  onChange={(e) => setMultiPlanViewMode(e.target.value as MultiPlanDeptViewMode)}
                  className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium outline-none transition-all w-full cursor-pointer"
                >
                  <option value="ACCOUNT_TOTAL">계정과목별 집계</option>
                  <option value="BY_DEPT">부서별 보기</option>
                </select>
                <span className="text-[10px] text-text-secondary font-medium leading-normal mt-0.5">
                  {multiPlanViewMode === 'ACCOUNT_TOTAL' 
                    ? '계정과목별 집계: 부서 구분 없이 계정별 합산' 
                    : '부서별 보기: 작성부서/귀속부서/계정별 분리'}
                </span>
              </div>
            </div>

            {/* Middle row: Plan Types selection check-boxes */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-secondary">대상 계획 선택 (다중 선택 가능)</span>
              <div className="flex flex-wrap gap-2">
                {(['경영계획', '증액반영', '수정경영계획', '1차 RP', '2차 RP'] as BudgetPlanType[]).map(type => {
                  const isChecked = selectedPlanTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          if (selectedPlanTypes.length > 1) {
                            setSelectedPlanTypes(selectedPlanTypes.filter(p => p !== type));
                          }
                        } else {
                          setSelectedPlanTypes([...selectedPlanTypes, type]);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs flex items-center gap-2 border transition-all cursor-pointer ${
                        isChecked 
                          ? 'bg-[#E6F4F2] border-[#008F83] text-[#006B62] font-semibold'
                          : 'bg-white border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="rounded border-zinc-300 text-[#008F83] focus:ring-[#00a395] pointer-events-none w-3.5 h-3.5"
                      />
                      <span>{type === '증액반영' ? '경영계획(증액반영)' : type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Row: Dynamic Variance Formula configuration */}
            <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-lithium-50">
              <div className="flex flex-wrap items-center gap-2 text-stone-700">
                <span className="text-xs font-bold text-text-secondary">증액필요예산 비교식 설정:</span>
                
                {/* Basis Selection */}
                <select
                  value={increaseBasisCol}
                  onChange={(e) => setIncreaseBasisCol(e.target.value)}
                  className="bg-lithium-100 border-none text-stone-900 text-xs rounded-lg p-1.5 font-medium outline-none cursor-pointer"
                >
                  {selectedPlanTypes.map(p => (
                    <option key={p} value={`plan_${p}`}>{p === '증액반영' ? '경영계획(증액반영)' : p}</option>
                  ))}
                  <option value="actual">실적</option>
                </select>

                <span className="text-xs font-medium text-stone-400">대비</span>

                {/* Target Selection */}
                <select
                  value={increaseTargetCol}
                  onChange={(e) => setIncreaseTargetCol(e.target.value)}
                  className="bg-lithium-100 border-none text-stone-900 text-xs rounded-lg p-1.5 font-medium outline-none cursor-pointer"
                >
                  {selectedPlanTypes.map(p => (
                    <option key={p} value={`plan_${p}`}>{p === '증액반영' ? '경영계획(증액반영)' : p}</option>
                  ))}
                  <option value="actual">실적</option>
                </select>

                <span className="text-xs font-semibold text-nickel-700 bg-nickel-50/70 border border-nickel-100 rounded-lg px-2 py-1 ml-2">
                  (증액필요예산 = 대상 - 기준)
                </span>
              </div>
              
              <div className="text-xs text-nickel-600 bg-nickel-50/70 py-1.5 px-3 rounded-xl border border-nickel-100 flex items-center gap-1.5 ml-auto">
                <span className="w-1.5 h-1.5 bg-nickel-500 rounded-full animate-pulse"></span>
                <span>다중계획 모드: 계획(~{planEndMonth}월 누계) vs 실적(~{actualEndMonth}월 누계)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1 flex gap-2 items-center">
              <span className="text-sm font-bold text-text-secondary w-10">기준</span>
              <select 
                value={baseYear} 
                onChange={(e) => setBaseYear(e.target.value)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="2024">2024년</option>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
                <option value="2027">2027년</option>
              </select>
              <select 
                value={basePlanType} 
                onChange={(e) => setBasePlanType(e.target.value)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="실적">실적</option>
                <option value="경영계획">경영계획</option>
                <option value="증액반영">증액반영</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차 RP">1차 RP</option>
                <option value="2차 RP">2차 RP</option>
              </select>
              <select 
                value={baseMonthMode} 
                onChange={(e) => setBaseMonthMode(e.target.value as MonthMode)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="YTD">누계</option>
                <option value="MONTH">단월</option>
              </select>
              <select 
                value={baseSelectedMonth} 
                onChange={(e) => setBaseSelectedMonth(Number(e.target.value))}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <div className="text-text-tertiary font-black px-2">VS</div>
            <div className="flex-1 flex gap-2 items-center">
              <span className="text-sm font-bold text-text-secondary w-10">비교</span>
              <select 
                value={targetYear} 
                onChange={(e) => setTargetYear(e.target.value)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="2024">2024년</option>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
                <option value="2027">2027년</option>
              </select>
              <select 
                value={targetPlanType} 
                onChange={(e) => setTargetPlanType(e.target.value)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="실적">실적</option>
                <option value="경영계획">경영계획</option>
                <option value="증액반영">증액반영</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차 RP">1차 RP</option>
                <option value="2차 RP">2차 RP</option>
              </select>
              <select 
                value={targetMonthMode} 
                onChange={(e) => setTargetMonthMode(e.target.value as MonthMode)}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                <option value="YTD">누계</option>
                <option value="MONTH">단월</option>
              </select>
              <select 
                value={targetSelectedMonth} 
                onChange={(e) => setTargetSelectedMonth(Number(e.target.value))}
                className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 pt-4 border-t border-lithium-100">
          <div className="flex-1 flex gap-2 items-center">
            <span className="text-sm font-bold text-text-secondary w-10">부서</span>
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none w-48 outline-none transition-all"
            >
              {(currentUser?.code === '99999' || currentUser?.code === '32100') && (
                <>
                  <option value="all">관리부서 (전체)</option>
                  <option value="by_dept">부서별 보기</option>
                  <option value="mfg">제조 - 전체부서</option>
                  <option value="sga">판관 - 전체부서</option>
                </>
              )}
              {viewableDepts.length > 0 && (
                <option value="viewable">조회 가능 부서</option>
              )}
              {/* Active Department Groups */}
              {getDeptGroups().filter(g => g.isActive !== false).map(grp => (
                <option key={grp.id} value={grp.id}>[그룹] {grp.name}</option>
              ))}
              {viewableDepts.filter(d => d.code !== '99999').map(dept => (
                <option key={dept.code} value={dept.code}>{dept.name}</option>
              ))}
            </select>
            
            <span className="text-sm font-bold text-text-secondary w-16 ml-3">회계구분</span>
            <select 
              value={selectedAccountingType} 
              onChange={(e) => setSelectedAccountingType(e.target.value as AccountingType)}
              className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none w-32 outline-none transition-all"
            >
              {ACCOUNTING_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === '전체' ? '전체 계정군' : opt}</option>
              ))}
            </select>
            
            <span className="text-sm font-bold text-text-secondary w-16 ml-3">비용성격</span>
            <select 
              value={selectedAccountClass} 
              onChange={(e) => setSelectedAccountClass(e.target.value as AccountClass)}
              className="bg-lithium-50 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 p-2.5 font-medium appearance-none flex-1 outline-none transition-all"
            >
              <option value="전체">전체 비용성격{!includeSalaryRows ? ' (급여성 계정 제외 중)' : ''}</option>
              {ACCOUNT_CLASS_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="relative download-menu-container">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex items-center gap-2 px-6 py-2.5 bg-lithium-100 text-eco-black rounded-xl font-bold text-sm hover:bg-lithium-200 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              보고서 다운로드
            </button>
            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-lithium-200 overflow-hidden z-20">
                {tab === 'multi_plan' ? (
                  <>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        handleDownloadMultiPlanExcel();
                      }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex flex-col justify-start gap-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="font-bold">다중계획 엑셀 다운로드</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary ml-8 leading-tight">요약 및 월별상세 시트 통합 다운로드</span>
                    </button>
                  </>
                ) : isDeptComparisonMode ? (
                  <>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        const defaultDeptCodes = getReportAvailableDeptCodes();
                        setSelectedReportDeptCodes(defaultDeptCodes);
                        setIncludeAllReportDepts(true);
                        setIncludeSummarySheet(true);
                        setIncludeDetailSheets(true);
                        setIncludeGroupSheets(true);
                        setIsReportModalOpen(true);
                      }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex flex-col justify-start gap-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="font-bold">전체/부서별/그룹 상세 다운로드</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary ml-8 leading-tight">전체 요약, 개별 부서별 상세, 부서 그룹별 상세 시트 통합 다운로드</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        handleDownloadExcel();
                      }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex flex-col justify-start gap-0.5 border-t border-lithium-100 bg-zinc-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                        <span className="text-zinc-700 font-semibold">현재 화면 1시트 다운로드</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary ml-8 leading-tight">현재 테이블 조회 상태 그대로 단일 시트 다운로드</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        handleDownloadExcel();
                      }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex flex-col justify-start gap-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="font-bold">현재 화면 1시트 다운로드</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary ml-8 leading-tight">현재 테이블 조회 상태 그대로 단일 시트 다운로드</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        const defaultDeptCodes = getReportAvailableDeptCodes();
                        setSelectedReportDeptCodes(defaultDeptCodes);
                        setIncludeAllReportDepts(true);
                        setIncludeSummarySheet(true);
                        setIncludeDetailSheets(true);
                        setIncludeGroupSheets(true);
                        setIsReportModalOpen(true);
                      }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex flex-col justify-start gap-0.5 border-t border-lithium-100 bg-zinc-50/50 hover:bg-lithium-50"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                        <span className="text-zinc-700 font-semibold">전체/부서별/그룹 상세 다운로드</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary ml-8 leading-tight">전체 요약, 개별 부서별 상세, 부서 그룹별 상세 시트 통합 다운로드</span>
                    </button>
                  </>
                )}
                {tab !== 'multi_plan' && (
                  <>
                    <button
                      onClick={() => { setShowDownloadMenu(false); handleDownloadPPT(); }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex items-center gap-3 border-t border-lithium-100"
                    >
                      <Presentation className="w-5 h-5 text-cobalt-600 flex-shrink-0" />
                      <span className="font-semibold">PPT 다운로드</span>
                    </button>
                    <button
                      onClick={() => { setShowDownloadMenu(false); handleDownloadPDF(); }}
                      className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex items-center gap-3 border-t border-lithium-100"
                    >
                      <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span className="font-semibold">PDF 다운로드</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab !== 'multi_plan' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-text-secondary">{baseName} 총액</p>
          <p className="text-3xl font-black text-eco-black mt-2 text-right">{formatCurrency(toMillions(totalBase))} <span className="text-sm font-normal text-text-tertiary">백만원</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-sm font-medium text-text-secondary">{targetName} 총액</p>
          <p className="text-3xl font-black text-eco-black mt-2 text-right">{formatCurrency(toMillions(totalTarget))} <span className="text-sm font-normal text-text-tertiary">백만원</span></p>
        </div>
        <div className={`p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md ${totalVariance > 0 ? 'bg-cobalt-50 border-cobalt-100' : totalVariance < 0 ? 'bg-nickel-50 border-nickel-100' : 'bg-lithium-50 border-lithium-200'}`}>
          <p className="text-sm font-medium text-text-secondary">증감액</p>
          <div className="flex items-center justify-between mt-2">
            {totalVariance > 0 ? (
              <TrendingUp className="w-8 h-8 text-cobalt-500 mr-2" />
            ) : totalVariance < 0 ? (
              <TrendingDown className="w-8 h-8 text-nickel-500 mr-2" />
            ) : (
              <Minus className="w-8 h-8 text-text-tertiary mr-2" />
            )}
            <div className="text-right">
              <p className={`text-3xl font-black ${totalVariance > 0 ? 'text-cobalt-700' : totalVariance < 0 ? 'text-nickel-700' : 'text-eco-black'}`}>
                {totalVariance > 0 ? '+' : ''}{formatCurrency(toMillions(totalVariance))} <span className="text-sm font-normal">백만원</span>
              </p>
              <p className={`text-sm font-bold ${totalVariance > 0 ? 'text-cobalt-600' : totalVariance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                {formatVarianceRate(totalVariancePercent, 1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Detail Table */}
      <div className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-lithium-200 bg-lithium-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-eco-black tracking-tight">
              {selectedDept === 'by_dept' ? '부서별 상세 비교 내역' : '계정별 상세 비교 내역'}
            </h3>
            <div className="flex flex-col gap-1 text-[11px] text-zinc-500 font-medium mt-1 font-sans">
              <div>기준: {baseYear}년 {basePlanType} · {getMonthModeLabel(baseMonthMode, baseSelectedMonth)}</div>
              <div>비교: {targetYear}년 {targetPlanType} · {getMonthModeLabel(targetMonthMode, targetSelectedMonth)}</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {hasSalaryAccess ? (
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 cursor-pointer select-none border border-zinc-200 bg-white px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={includeSalaryRows}
                  onChange={(e) => {
                    setIncludeSalaryRows(e.target.checked);
                    setVisibleDetailCount(100);
                  }}
                  className="w-4 h-4 text-[#008f83] focus:ring-[#008f83] border-zinc-300 rounded accent-[#008f83] cursor-pointer"
                />
                <span>급여성 계정 포함</span>
              </label>
            ) : (
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 cursor-not-allowed select-none border border-zinc-150 bg-zinc-50 px-3 py-1.5 rounded-xl opacity-60">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-4 h-4 text-zinc-300 border-zinc-200 rounded cursor-not-allowed"
                />
                <span>급여성 계정 포함</span>
              </label>
            )}
            {selectedDept !== 'by_dept' && (
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 cursor-pointer select-none border border-zinc-200 bg-white px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={applyChartFilterToTable}
                  onChange={(e) => {
                    setApplyChartFilterToTable(e.target.checked);
                    setVisibleDetailCount(100);
                  }}
                  className="w-4 h-4 text-[#008f83] focus:ring-[#008f83] border-zinc-300 rounded accent-[#008f83] cursor-pointer"
                />
                <span>상세표에도 차트 필터 적용</span>
              </label>
            )}
            <span className="text-xs font-bold text-zinc-650 bg-zinc-150 px-2.5 py-1.5 rounded-xl font-sans shrink-0">
              {filteredAndSortedRows.length.toLocaleString()}건
              {applyChartFilterToTable && comparisonRows.length !== filteredAndSortedRows.length && (
                <span className="ml-1 text-zinc-400 font-medium">
                  / 전체 {comparisonRows.length.toLocaleString()}건
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Detail Filter Toolbar */}
        <div className="bg-zinc-50/50 border-b border-zinc-200 px-6 py-3.5 flex flex-wrap gap-3 items-center text-xs">
          {!isDeptMode && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-500">비용성격:</span>
                <select
                  value={detailFilters.accountClass}
                  onChange={(e) => {
                    setDetailFilters(prev => ({ ...prev, accountClass: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer"
                >
                  <option value="">전체</option>
                  {ACCOUNT_CLASS_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-500">회계구분:</span>
                <select
                  value={detailFilters.accountingType}
                  onChange={(e) => {
                    setDetailFilters(prev => ({ ...prev, accountingType: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer"
                >
                  <option value="">전체</option>
                  {ACCOUNTING_TYPE_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-500">{isDeptMode ? '부서코드:' : '계정코드:'}</span>
            <input
              type="text"
              placeholder={isDeptMode ? '부서코드 검색...' : '계정코드 검색...'}
              value={detailFilters.accountCode}
              onChange={(e) => {
                setDetailFilters(prev => ({ ...prev, accountCode: e.target.value }));
                setVisibleDetailCount(100);
              }}
              className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-24 focus:border-[#008f83]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-500">{isDeptMode ? '부서명:' : '계정명:'}</span>
            <input
              type="text"
              placeholder={isDeptMode ? '부서명 검색...' : '계정명 검색...'}
              value={detailFilters.accountName}
              onChange={(e) => {
                setDetailFilters(prev => ({ ...prev, accountName: e.target.value }));
                setVisibleDetailCount(100);
              }}
              className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-28 focus:border-[#008f83]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-500">상태:</span>
            <select
              value={detailFilters.status}
              onChange={(e) => {
                setDetailFilters(prev => ({ ...prev, status: e.target.value }));
                setVisibleDetailCount(100);
              }}
              className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer"
            >
              <option value="">전체</option>
              {['미계획', '미발생', '증가', '감소', '변동없음', '사라짐'].map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-500">최소 차액:</span>
            <input
              type="number"
              placeholder="단위 백만..."
              value={detailFilters.minVariance}
              onChange={(e) => {
                setDetailFilters(prev => ({ ...prev, minVariance: e.target.value }));
                setVisibleDetailCount(100);
              }}
              className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-24 focus:border-[#008f83]"
            />
            <span className="text-zinc-400">백만원 ↑</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-zinc-500">최소 금액:</span>
            <input
              type="number"
              placeholder="단위 백만..."
              value={detailFilters.minAmount}
              onChange={(e) => {
                setDetailFilters(prev => ({ ...prev, minAmount: e.target.value }));
                setVisibleDetailCount(100);
              }}
              className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-24 focus:border-[#008f83]"
            />
            <span className="text-zinc-400">백만원 ↑</span>
          </div>

          {(detailFilters.accountClass || detailFilters.accountingType || detailFilters.accountCode || detailFilters.accountName || detailFilters.status || detailFilters.minVariance || detailFilters.minAmount || (detailSort && detailSort.key !== 'variance')) && (
            <button
              type="button"
              onClick={() => {
                setDetailFilters({
                  accountClass: '',
                  accountingType: '',
                  accountCode: '',
                  accountName: '',
                  status: '',
                  minVariance: '',
                  minAmount: '',
                });
                setDetailSort({ key: 'variance', direction: 'desc' });
                setVisibleDetailCount(100);
              }}
              className="px-2.5 py-1 hover:bg-zinc-200 border border-zinc-300 text-zinc-650 text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-3xs ml-auto"
            >
              초기화 ↺
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-lithium-100/50 border-b border-lithium-200 font-sans">
                {!isDeptMode && (
                  <>
                    <th
                      onClick={() => handleSort('accountClass')}
                      className="px-5 py-3 text-xs font-bold text-text-secondary cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                    >
                      비용 성격 {renderSortArrow('accountClass')}
                    </th>
                    <th
                      onClick={() => handleSort('accountingType')}
                      className="px-5 py-3 text-xs font-bold text-text-secondary cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                    >
                      회계 구분 {renderSortArrow('accountingType')}
                    </th>
                  </>
                )}
                <th
                  onClick={() => handleSort('accountCode')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  {isDeptMode ? '부서코드' : '계정코드'} {renderSortArrow('accountCode')}
                </th>
                <th
                  onClick={() => handleSort('accountName')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  {isDeptMode ? '부서명' : '계정명'} {renderSortArrow('accountName')}
                </th>
                <th
                  onClick={() => handleSort('baseAmount')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary text-right cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  {baseName} {renderSortArrow('baseAmount')}
                </th>
                <th
                  onClick={() => handleSort('targetAmount')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary text-right cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  {targetName} {renderSortArrow('targetAmount')}
                </th>
                <th
                  onClick={() => handleSort('variance')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary text-right cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  차액 {renderSortArrow('variance')}
                </th>
                <th
                  onClick={() => handleSort('variancePercent')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary text-right cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  증감률 {renderSortArrow('variancePercent')}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-5 py-3 text-xs font-bold text-text-secondary text-center cursor-pointer hover:bg-zinc-150 select-none transition-colors"
                >
                  상태 {renderSortArrow('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lithium-100">
              {pagedVisibleComparisonRows.length === 0 ? (
                <tr>
                   <td colSpan={isDeptMode ? 7 : 9} className="px-6 py-12 text-center text-sm text-text-secondary bg-white">
                    선택한 조건에 해당하는 상세 비교 데이터가 없습니다. 상위 필터 조건 또는 아래 텍스트 필터 구성을 확인해 주세요.
                  </td>
                </tr>
              ) : (
                pagedVisibleComparisonRows.map(row => {
                  const isDrilldown = isDeptMode;
                  const isSelected = isDrilldown && selectedDepartment?.departmentCode === row.key;
                  const rowCode = getCompareRowCode(row, isDeptMode);
                  const rowName = getCompareRowName(row, isDeptMode);
                  
                  return (
                    <tr 
                      key={row.key} 
                      onClick={() => {
                        if (isDrilldown) {
                          setSelectedDepartment(prev => 
                            prev?.departmentCode === row.key 
                              ? null 
                              : { departmentCode: row.key, departmentName: rowName }
                          );
                        }
                      }}
                      className={`transition-colors duration-150 group ${
                        isDrilldown ? 'cursor-pointer select-none' : ''
                      } ${
                        isSelected 
                          ? 'bg-cobalt-50/70 text-cobalt-950 font-medium' 
                          : 'hover:bg-lithium-50/80'
                      }`}
                    >
                      {!isDeptMode && (
                        <>
                          <td className="px-5 py-3 text-sm font-bold text-eco-black">{row.accountClass}</td>
                          <td className="px-5 py-3 text-sm text-text-secondary">{row.accountingType}</td>
                        </>
                      )}
                      <td className="px-5 py-3 text-xs font-mono text-text-tertiary">
                        {rowCode}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-eco-black">
                        <div className="flex items-center gap-2">
                          <span>{rowName}</span>
                          {isDrilldown && !isSelected && (
                            <span className="text-[10px] text-cobalt-600 font-bold bg-cobalt-50 border border-cobalt-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                              상세보기
                            </span>
                          )}
                          {isDrilldown && isSelected && (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                              선택됨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-zinc-600">{formatCurrency(toMillions(row.baseAmount))}</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-eco-black font-mono">{formatCurrency(toMillions(row.targetAmount))}</td>
                      <td className={`px-5 py-3 text-sm text-right font-black font-mono ${isSelected ? 'text-cobalt-700' : row.variance > 0 ? 'text-cobalt-600' : row.variance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                        {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                      </td>
                      <td className={`px-5 py-3 text-sm text-right font-black font-mono ${isSelected ? 'text-cobalt-600' : (row.variancePercent !== null && row.variancePercent > 0) ? 'text-cobalt-500' : (row.variancePercent !== null && row.variancePercent < 0) ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                        {formatVarianceRate(row.variancePercent, 1)}
                      </td>
                      <td className="px-5 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-block ${getStatusBadgeStyle(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-lithium-50 border-t-2 border-lithium-200">
              <tr className="border-b border-lithium-100">
                <td colSpan={isDeptMode ? 2 : 4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-eco-black tracking-tight text-right">제조 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-secondary text-right">{formatCurrency(toMillions(summaryTotals.baseMfg))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-eco-black text-right">{formatCurrency(toMillions(summaryTotals.targetMfg))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? 'text-cobalt-600' : summaryTotals.targetMfg - summaryTotals.baseMfg < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetMfg - summaryTotals.baseMfg))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${(mfgRate !== null && mfgRate > 0) ? 'text-cobalt-500' : (mfgRate !== null && mfgRate < 0) ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {formatVarianceRate(mfgRate, 1)}
                </td>
                <td></td>
              </tr>
              <tr className="border-b border-lithium-100">
                <td colSpan={isDeptMode ? 2 : 4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-eco-black tracking-tight text-right">판관 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-secondary text-right">{formatCurrency(toMillions(summaryTotals.baseSga))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-eco-black text-right">{formatCurrency(toMillions(summaryTotals.targetSga))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.targetSga - summaryTotals.baseSga > 0 ? 'text-cobalt-600' : summaryTotals.targetSga - summaryTotals.baseSga < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {summaryTotals.targetSga - summaryTotals.baseSga > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetSga - summaryTotals.baseSga))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${(sgaRate !== null && sgaRate > 0) ? 'text-cobalt-500' : (sgaRate !== null && sgaRate < 0) ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {formatVarianceRate(sgaRate, 1)}
                </td>
                <td></td>
              </tr>
              <tr className="bg-lithium-100">
                <td colSpan={isDeptMode ? 2 : 4} className="px-6 py-5 whitespace-nowrap text-base font-black text-eco-black uppercase tracking-tight text-right">총 합계</td>
                <td className="px-6 py-5 whitespace-nowrap text-base font-bold text-text-secondary text-right">{formatCurrency(toMillions(totalBase))}</td>
                <td className="px-6 py-5 whitespace-nowrap text-base font-black text-eco-black text-right">{formatCurrency(toMillions(totalTarget))}</td>
                <td className={`px-6 py-5 whitespace-nowrap text-base font-black text-right ${totalVariance > 0 ? 'text-cobalt-600' : totalVariance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {totalVariance > 0 ? '+' : ''}{formatCurrency(toMillions(totalVariance))}
                </td>
                <td className={`px-6 py-5 whitespace-nowrap text-base font-black text-right ${(totalVariancePercent !== null && totalVariancePercent > 0) ? 'text-cobalt-500' : (totalVariancePercent !== null && totalVariancePercent < 0) ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {formatVarianceRate(totalVariancePercent, 1)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {visibleDetailCount < filteredAndSortedRows.length && (
          <div className="border-t border-lithium-200">
            <button
              type="button"
              onClick={() => setVisibleDetailCount(prev => prev + 100)}
              className="w-full py-4 text-xs font-bold text-[#008f83] hover:bg-[#008f83]/10 bg-zinc-50 transition-colors cursor-pointer"
            >
              상세 내역 100건 더 보기 ({pagedVisibleComparisonRows.length.toLocaleString()} / {filteredAndSortedRows.length.toLocaleString()}건 표시 중)
            </button>
          </div>
        )}
      </div>

      {/* Department Account Drilldown Table */}
      {selectedDept === 'by_dept' && selectedDepartment && (
        <section className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden mb-10 transition-all duration-300">
          <div className="px-6 py-5 border-b border-lithium-200 bg-lithium-50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-eco-black tracking-tight">
                <span className="text-cobalt-600 font-extrabold">[{selectedDepartment.departmentCode}] {selectedDepartment.departmentName}</span> 계정별 상세내역
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                선택한 부서의 계정과목별 편성 예산과 집행 실적, 차이 및 집행률을 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDepartment(null)}
              className="px-4 py-2 text-xs font-bold text-text-secondary bg-white border border-lithium-200 rounded-xl hover:bg-lithium-50 transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-lithium-100/50 border-b border-lithium-200">
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정코드</th>
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정명</th>
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">예산 (기준)</th>
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">실적 (비교)</th>
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">차액 (실적-예산)</th>
                  <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">집행률 (target/base)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lithium-100">
                {selectedDeptDetails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-secondary">
                      해당 부서의 계정별 상세내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  selectedDeptDetails.map(row => (
                    <tr key={row.accountCode} className="hover:bg-lithium-50/50 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-text-tertiary">{row.accountCode}</td>
                      <td className="px-5 py-3 text-sm font-medium text-eco-black">{row.accountName}</td>
                      <td className="px-5 py-3 text-sm text-right text-text-secondary">{formatCurrency(toMillions(row.budgetAmount))}백만원</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-eco-black">{formatCurrency(toMillions(row.actualAmount))}백만원</td>
                      <td className={`px-5 py-3 text-sm text-right font-black ${row.varianceAmount > 0 ? 'text-cobalt-600' : row.varianceAmount < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                        {row.varianceAmount > 0 ? '+' : ''}{formatCurrency(toMillions(row.varianceAmount))}백만원
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-eco-black">
                        {row.executionRate == null ? "-" : `${row.executionRate.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Chart Segment - Collapsible and Customizable */}
      <div className="w-full min-w-0">
        <div className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden">
          {/* Chart Header */}
          <div className="px-6 py-4.5 border-b border-lithium-200 bg-lithium-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAccountChartOpen(prev => !prev)}
                className="p-1 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer text-zinc-650 flex items-center justify-center"
                title={isAccountChartOpen ? "차트 접기" : "차트 펼치기"}
              >
                {isAccountChartOpen ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              <div>
                <h3 className="text-lg font-bold text-eco-black tracking-tight flex items-center gap-2">
                  <span>{selectedDept === 'by_dept' ? '부서별 예산·실적 비교 차트' : '계정별 주요 변동 비교 차트'}</span>
                  {selectedDept !== 'by_dept' && (
                    <span className="text-[10px] bg-red-50 text-red-600 font-extrabold px-1.5 py-0.5 rounded border border-red-100">
                      Top {chartTopN}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {selectedDept === 'by_dept' 
                    ? '부서별 전체 예산과 실적의 집행 추이를 확인합니다.' 
                    : `변동금액(절대값)이 큰 상위 ${chartTopN}개 계정과목을 기준으로 시각화한 차트입니다.`}
                </p>
              </div>
            </div>

            {/* Controls Row (only for account comparison) */}
            {selectedDept !== 'by_dept' && isAccountChartOpen && (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Filters */}
                <div className="bg-white p-0.5 rounded-xl border border-zinc-200 flex items-center shadow-3xs text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setChartAccountView('ALL');
                      setVisibleDetailCount(100);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${chartAccountView === 'ALL' ? 'bg-[#008f83] text-white font-extrabold shadow-3xs' : 'text-zinc-600 hover:text-eco-black'}`}
                  >
                    전체 계정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChartAccountView('MFG');
                      setVisibleDetailCount(100);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${chartAccountView === 'MFG' ? 'bg-[#008f83] text-white font-extrabold shadow-3xs' : 'text-zinc-600 hover:text-eco-black'}`}
                  >
                    제조비용
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChartAccountView('SGA');
                      setVisibleDetailCount(100);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${chartAccountView === 'SGA' ? 'bg-[#008f83] text-white font-extrabold shadow-3xs' : 'text-zinc-600 hover:text-eco-black'}`}
                  >
                    판관비용
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChartAccountView('CLASS');
                      setVisibleDetailCount(100);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${chartAccountView === 'CLASS' ? 'bg-[#008f83] text-white font-extrabold shadow-3xs' : 'text-zinc-600 hover:text-eco-black'}`}
                  >
                    소분류별
                  </button>
                </div>

                {/* Subclass select when class-view is dynamic */}
                {chartAccountView === 'CLASS' && (
                  <select
                    value={chartAccountClass}
                    onChange={(e) => {
                      setChartAccountClass(e.target.value as AccountClass);
                      setVisibleDetailCount(100);
                    }}
                    className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-xl px-2.5 py-1.5 outline-none font-bold shadow-3xs cursor-pointer"
                  >
                    <option value="전체">전체 소분류</option>
                    {QUICK_ACCOUNT_CLASSES.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                )}

                {/* Top N Limit Selector */}
                <select
                  value={chartTopN}
                  onChange={(e) => {
                    setChartTopN(Number(e.target.value));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-xl px-2.5 py-1.5 outline-none font-bold shadow-3xs cursor-pointer"
                >
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                  <option value={30}>Top 30</option>
                  <option value={50}>Top 50</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsFullAccountModalOpen(true)}
                  className="bg-white border border-zinc-200 text-zinc-650 text-xs rounded-xl px-3 py-1.5 font-bold hover:bg-zinc-50 hover:text-eco-black transition-colors cursor-pointer shadow-3xs shrink-0 flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span>전체 목록</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Category filter tags below chart header */}
          {selectedDept !== 'by_dept' && isAccountChartOpen && chartAccountView === 'CLASS' && (
            <div className="px-6 py-2 bg-zinc-50 border-b border-zinc-150 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-bold text-zinc-400 mr-2">빠른 소분류 전환:</span>
              <button
                type="button"
                onClick={() => {
                  setChartAccountClass('전체');
                  setVisibleDetailCount(100);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${chartAccountClass === '전체' ? 'bg-zinc-800 text-white border-zinc-800 shadow-3xs' : 'bg-white text-zinc-650 border-zinc-200 hover:text-zinc-800 hover:bg-zinc-100'}`}
              >
                전체 소분류
              </button>
              {QUICK_ACCOUNT_CLASSES.map(cls => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    setChartAccountClass(cls);
                    setVisibleDetailCount(100);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${chartAccountClass === cls ? 'bg-[#008f83] text-white border-[#008f83] shadow-3xs' : 'bg-white text-zinc-650 border-zinc-200 hover:text-zinc-800 hover:bg-zinc-100'}`}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}

          {/* Chart Content Area */}
          {isAccountChartOpen && (
            <div className="p-6">
              <div className="w-full min-h-[360px]">
                {visibleChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[320px] text-zinc-400 font-sans gap-3">
                    <TrendingUp className="w-12 h-12 stroke-[1.5] text-zinc-300" />
                    <p className="text-sm font-semibold">선택한 분류 필터 조건에 해당하는 데이터가 없습니다.</p>
                    <p className="text-xs">상단의 세부 소분류 또는 차트 필터를 조정하여 점검해 주세요.</p>
                  </div>
                ) : (
                  <div className="w-full min-w-[320px]" style={{ height: `${Math.max(360, visibleChartData.length * 28 + 60)}px` }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <BarChart
                        data={visibleChartData}
                        layout="vertical"
                        margin={{ top: 12, right: 32, left: 180, bottom: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f2f4f6" />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8b95a1', fontSize: 10, fontFamily: 'monospace' }}
                          tickFormatter={(value) => `${new Intl.NumberFormat('ko-KR').format(Math.round(value / 1000000))}M`}
                        />
                        <YAxis
                          type="category"
                          dataKey="displayName"
                          width={170}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#4e5968', fontSize: 11, fontWeight: 500 }}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                          wrapperStyle={{ pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const fullName = data.name || data.displayName;
                              return (
                                <div className="bg-white p-4 rounded-2xl border border-[#dde5de] shadow-xl text-xs font-sans pointer-events-none">
                                  <p className="font-extrabold text-eco-black mb-2">{fullName} ({data.code || ''})</p>
                                  {payload.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between gap-6 py-0.5">
                                      <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                                        {item.name}:
                                      </span>
                                      <span className="font-bold text-[#444] font-mono">
                                        {formatCurrency(toMillions(Number(item.value)))}백만원 ({formatCurrency(Number(item.value))}원)
                                      </span>
                                    </div>
                                  ))}
                                  {data.variance !== undefined && (
                                    <div className="flex justify-between gap-6 py-0.5 border-t border-zinc-100 mt-2 pt-2">
                                      <span className="text-zinc-500 font-bold">차액:</span>
                                      <span className={`font-mono font-black ${data.variance > 0 ? 'text-cobalt-600' : data.variance < 0 ? 'text-nickel-600' : 'text-zinc-550'}`}>
                                        {data.variance > 0 ? '+' : ''}{formatCurrency(toMillions(data.variance))}백만원 ({formatVarianceRate(data.variancePercent, 1)})
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey={baseName} radius={[0, 4, 4, 0]} maxBarSize={16}>
                          {visibleChartData.map((entry: any, index: number) => {
                            const isSelected = selectedDept === 'by_dept' && selectedDepartment?.departmentCode === entry.code;
                            const hasSelection = selectedDept === 'by_dept' && selectedDepartment !== null;
                            const opacity = hasSelection ? (isSelected ? 1 : 0.35) : 1;
                            const fill = isSelected ? '#cbd5e1' : '#e5e8eb';
                            return (
                              <Cell
                                key={`cell-base-${index}`}
                                fill={fill}
                                opacity={opacity}
                                className="cursor-pointer transition-all duration-250"
                                onClick={() => {
                                  if (selectedDept === 'by_dept') {
                                    setSelectedDepartment(prev => 
                                      prev?.departmentCode === entry.code 
                                        ? null 
                                        : { departmentCode: entry.code, departmentName: entry.name }
                                    );
                                  }
                                }}
                              />
                            );
                          })}
                        </Bar>
                        <Bar dataKey={targetName} radius={[0, 4, 4, 0]} maxBarSize={16}>
                          {visibleChartData.map((entry: any, index: number) => {
                            const isSelected = selectedDept === 'by_dept' && selectedDepartment?.departmentCode === entry.code;
                            const hasSelection = selectedDept === 'by_dept' && selectedDepartment !== null;
                            const opacity = hasSelection ? (isSelected ? 1 : 0.35) : 1;
                            const fill = '#008f83';
                            return (
                              <Cell
                                key={`cell-target-${index}`}
                                fill={fill}
                                opacity={opacity}
                                className="cursor-pointer transition-all duration-250"
                                onClick={() => {
                                  if (selectedDept === 'by_dept') {
                                    setSelectedDepartment(prev => 
                                      prev?.departmentCode === entry.code 
                                        ? null 
                                        : { departmentCode: entry.code, departmentName: entry.name }
                                    );
                                  }
                                }}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Download Settings Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-eco-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-lithium-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-lithium-50 border-b border-lithium-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-eco-black flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                보고서 다운로드 설정
              </h3>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-lithium-200 transition-colors text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-text-secondary">
              {/* Range Selector */}
              <div className="space-y-3">
                <span className="font-bold text-eco-black text-sm block">다운로드 범위</span>
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-lithium-200 rounded-xl hover:bg-lithium-50 transition-colors bg-white">
                  <input
                    type="checkbox"
                    checked={includeAllReportDepts}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeAllReportDepts(checked);
                      if (checked) {
                        setSelectedReportDeptCodes(getReportAvailableDeptCodes());
                        setIncludeGroupSheets(true);
                      } else {
                        setSelectedReportDeptCodes([]);
                        setIncludeGroupSheets(false);
                      }
                    }}
                    className="w-4 h-4 rounded text-cobalt-600 focus:ring-cobalt-500 border-lithium-300"
                  />
                  <div>
                    <span className="font-bold text-eco-black">전체 부서</span>
                    <p className="text-xs text-text-tertiary mt-0.5">조회 가능한 모든 부서의 보고서를 한 번에 다운로드합니다.</p>
                  </div>
                </label>
              </div>

              {/* Department Selecting Checklist */}
              <div className="space-y-3">
                <span className="font-bold text-eco-black text-sm block">부서 선택</span>
                <div className="border border-lithium-200 rounded-xl overflow-hidden bg-lithium-50/50">
                  <div className="px-4 py-2 border-b border-lithium-200 bg-lithium-100/50 text-[11px] font-bold text-text-tertiary tracking-wider uppercase flex justify-between">
                    <span>선택 가능한 부서 목록</span>
                    <span>{getReportAvailableDeptCodes().length}개 중 {selectedReportDeptCodes.length}개 선택됨</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-lithium-100 p-2 space-y-1">
                    {viewableDepts.filter(d => d.code !== '99999').map(dept => {
                      const isChecked = selectedReportDeptCodes.includes(dept.code);
                      return (
                        <label 
                          key={dept.code} 
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? 'bg-cobalt-50/50 text-cobalt-900' : 'hover:bg-lithium-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              let newSelected: string[];
                              if (selectedReportDeptCodes.includes(dept.code)) {
                                newSelected = selectedReportDeptCodes.filter(c => c !== dept.code);
                              } else {
                                newSelected = [...selectedReportDeptCodes, dept.code];
                              }
                              setSelectedReportDeptCodes(newSelected);
                              const allAvailable = getReportAvailableDeptCodes();
                              if (newSelected.length === allAvailable.length) {
                                setIncludeAllReportDepts(true);
                                setIncludeGroupSheets(true);
                              } else {
                                setIncludeAllReportDepts(false);
                                setIncludeGroupSheets(false);
                              }
                            }}
                            className="w-4 h-4 rounded text-cobalt-600 focus:ring-cobalt-500 border-lithium-300"
                          />
                          <div className="font-medium text-xs">
                            <span className="font-mono text-text-tertiary mr-2">[{dept.code}]</span>
                            <span className="text-eco-black text-sm font-semibold">{dept.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inclusions */}
              <div className="space-y-3">
                <span className="font-bold text-eco-black text-sm block">포함 항목</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-start gap-2.5 p-3 border border-lithium-200 rounded-xl hover:bg-lithium-50 cursor-pointer transition-colors bg-white">
                    <input
                      type="checkbox"
                      checked={includeSummarySheet}
                      onChange={(e) => setIncludeSummarySheet(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-cobalt-600 focus:ring-cobalt-500 border-lithium-300"
                    />
                    <div>
                      <span className="font-bold text-eco-black text-xs leading-none">전체 비교 요약</span>
                      <p className="text-[10px] text-text-tertiary mt-0.5 leading-tight">각 부서의 합계 차이를 요약한 시트입니다.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 p-3 border border-lithium-200 rounded-xl hover:bg-lithium-50 cursor-pointer transition-colors bg-white">
                    <input
                      type="checkbox"
                      checked={includeDetailSheets}
                      onChange={(e) => setIncludeDetailSheets(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-cobalt-600 focus:ring-cobalt-500 border-lithium-300"
                    />
                    <div>
                      <span className="font-bold text-eco-black text-xs leading-none">부서별 상세내역</span>
                      <p className="text-[10px] text-text-tertiary mt-0.5 leading-tight">부서별 계정과목 단위 상세 시트입니다.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 p-3 border border-lithium-200 rounded-xl hover:bg-lithium-50 cursor-pointer transition-colors bg-white">
                    <input
                      type="checkbox"
                      checked={includeGroupSheets}
                      onChange={(e) => setIncludeGroupSheets(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-cobalt-600 focus:ring-cobalt-500 border-lithium-300"
                    />
                    <div>
                      <span className="font-bold text-eco-black text-xs leading-none">부서 그룹 상세내역</span>
                      <p className="text-[10px] text-text-tertiary mt-0.5 leading-tight">1공장, 설비관리섹션, 품질기술부 등 코드 기준 그룹별 분석 시트를 포함합니다.</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-4 bg-lithium-50 border-t border-lithium-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-lithium-200 text-sm font-bold text-text-secondary hover:bg-lithium-100 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={
                  (includeDetailSheets && selectedReportDeptCodes.length === 0) ||
                  (!includeSummarySheet && !includeDetailSheets && !includeGroupSheets)
                }
                onClick={() => {
                  if (!includeSummarySheet && !includeDetailSheets && !includeGroupSheets) {
                    alert('적어도 하나의 포함 항목을 선택해야 합니다.');
                    return;
                  }
                  if (includeDetailSheets && selectedReportDeptCodes.length === 0) {
                    alert('다운로드할 부서를 1개 이상 선택해주세요.');
                    return;
                  }
                  setIsReportModalOpen(false);
                  handleDownloadExcelWithDeptDetails(selectedReportDeptCodes);
                }}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all ${
                  (includeDetailSheets && selectedReportDeptCodes.length === 0) ||
                  (!includeSummarySheet && !includeDetailSheets && !includeGroupSheets)
                    ? 'bg-lithium-300 cursor-not-allowed shadow-none'
                    : 'bg-cobalt-600 hover:bg-cobalt-700 active:scale-95'
                }`}
              >
                {includeDetailSheets && selectedReportDeptCodes.length === 0 
                  ? '부서를 선택해 주세요' 
                  : !includeSummarySheet && !includeDetailSheets && !includeGroupSheets
                  ? '포함 항목을 선택해 주세요'
                  : (includeAllReportDepts || selectedReportDeptCodes.length === getReportAvailableDeptCodes().length) && includeGroupSheets
                  ? '전체 부서 + 그룹 다운로드'
                  : (includeAllReportDepts || selectedReportDeptCodes.length === getReportAvailableDeptCodes().length)
                  ? '전체 부서 다운로드'
                  : `선택 부서 ${selectedReportDeptCodes.length}개 다운로드`}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {tab === 'multi_plan' && (
        <div className="space-y-6">
          {/* 1. Summary Cards for Multi-Plan */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {selectedPlanTypes.map(p => (
              <div key={p} className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm hover:shadow-md transition-all">
                <p className="text-sm font-medium text-text-secondary font-sans font-sans">
                  {p === '증액반영' ? '경영계획(증액반영)' : p} 합계
                </p>
                <p className="text-[20px] font-black text-eco-black mt-2 text-right">
                  {formatCurrency(toMillions(multiPlanTotals.grand.valuesByColumnId[`plan_${p}`] || 0))}{' '}
                  <span className="text-xs font-normal text-text-tertiary">백만원</span>
                </p>
              </div>
            ))}
            
            <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm hover:shadow-md transition-all">
              <p className="text-sm font-medium text-text-secondary font-sans">실적(~{actualEndMonth}월) 합계</p>
              <p className="text-[20px] font-black text-eco-black mt-2 text-right font-sans">
                {formatCurrency(toMillions(multiPlanTotals.grand.valuesByColumnId['actual'] || 0))}{' '}
                <span className="text-xs font-normal text-text-tertiary font-sans">백만원</span>
              </p>
            </div>
          </div>

          {/* 2. Main Multi-Plan Comparison Table Container */}
          <div className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-lithium-200 bg-lithium-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-eco-black tracking-tight flex items-center gap-2.5 font-sans">
                  <span>다중 계획 대비 분석표</span>
                  <span className="text-xs bg-zinc-100 text-zinc-650 font-bold px-2 py-0.5 rounded-full border border-zinc-200 font-sans">요약 모드</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1 font-sans">
                  선택한 예산 계획과 실적을 통합 비교합니다. 마이너스(-) 편차는 예산 잔여 또는 감소를 의미합니다. 상단 부서/회계구분/비용성격 조건이 먼저 적용되며, 아래 필터는 표시된 결과 안에서 추가 검색합니다.
                </p>
              </div>

              {/* P0-4. 급여성 계정 조작 및 자동 포함 표시 */}
              <div className="flex flex-wrap items-center gap-3">
                {tab === 'multi_plan' && hasSalaryAccess && isSalaryAccountClassSelected && (
                  <span className="text-xs font-bold text-nickel-700 bg-nickel-50 border border-nickel-100 rounded-lg px-2.5 py-1">
                    급여성 계정 자동 포함
                  </span>
                )}
                
                {tab === 'multi_plan' && hasSalaryAccess && (
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 bg-white border border-lithium-200 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-lithium-50 select-none">
                    <input
                      type="checkbox"
                      checked={includeSalaryRows}
                      onChange={(e) => setIncludeSalaryRows(e.target.checked)}
                      className="w-4 h-4 accent-[#008f83]"
                    />
                    급여성 계정 포함
                  </label>
                )}
              </div>
            </div>

            {/* Dynamic filter bar */}
            <div className="bg-zinc-50/50 border-b border-zinc-200 px-6 py-3.5 flex flex-wrap gap-3 items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-400">추가 비용성격:</span>
                <select
                  value={multiPlanFilters.accountClass}
                  onChange={(e) => {
                    setMultiPlanFilters(prev => ({ ...prev, accountClass: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  disabled={selectedAccountClass !== '전체'}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-450 disabled:cursor-not-allowed"
                >
                  <option value="">{selectedAccountClass !== '전체' ? `상단 필터 적용 중 (${selectedAccountClass})` : '전체 소분류'}</option>
                  {ACCOUNT_CLASS_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-400">회계구분:</span>
                <select
                  value={multiPlanFilters.accountingType}
                  onChange={(e) => {
                    setMultiPlanFilters(prev => ({ ...prev, accountingType: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2 py-1 outline-none font-semibold cursor-pointer"
                >
                  <option value="">전체 (제조/판관)</option>
                  {ACCOUNTING_TYPE_OPTIONS.filter(opt => opt !== '전체').map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-400">계정코드:</span>
                <input
                  type="text"
                  placeholder="계정코드 검색..."
                  value={multiPlanFilters.accountCode}
                  onChange={(e) => {
                    setMultiPlanFilters(prev => ({ ...prev, accountCode: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-28 focus:border-[#008f83]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-400">계정과목명:</span>
                <input
                  type="text"
                  placeholder="계정명 검색..."
                  value={multiPlanFilters.accountName}
                  onChange={(e) => {
                    setMultiPlanFilters(prev => ({ ...prev, accountName: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-36 focus:border-[#008f83]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-400">최소 금액:</span>
                <input
                  type="number"
                  placeholder="단위 백만..."
                  value={multiPlanFilters.minAmount}
                  onChange={(e) => {
                    setMultiPlanFilters(prev => ({ ...prev, minAmount: e.target.value }));
                    setVisibleDetailCount(100);
                  }}
                  className="bg-white border border-zinc-200 text-zinc-700 text-xs rounded-lg px-2.5 py-1 outline-none font-medium w-24 focus:border-[#008f83]"
                />
                <span className="text-zinc-400">백만원 ↑</span>
              </div>

              {(multiPlanFilters.accountClass || multiPlanFilters.accountingType || multiPlanFilters.accountCode || multiPlanFilters.accountName || multiPlanFilters.minAmount) && (
                <button
                  type="button"
                  onClick={() => {
                    setMultiPlanFilters({
                      accountClass: '',
                      accountingType: '',
                      accountCode: '',
                      accountName: '',
                      minAmount: '',
                    });
                    setVisibleDetailCount(100);
                  }}
                  className="text-[#008f83] font-bold hover:underline cursor-pointer flex items-center gap-1 ml-auto"
                >
                  필터 초기화 ↺
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-max">
                <thead>
                  <tr className="bg-lithium-100/50 border-b border-lithium-200">
                    <th className="px-5 py-3 text-xs font-black text-text-secondary">계정구분</th>
                    <th className="px-5 py-3 text-xs font-black text-text-secondary">계정코드</th>
                    <th className="px-5 py-3 text-xs font-black text-text-secondary">계정과목</th>
                    <th className="px-5 py-3 text-xs font-black text-text-secondary">작성부서</th>
                    <th className="px-5 py-3 text-xs font-black text-text-secondary">귀속부서</th>
                    {selectedPlanTypes.map(p => (
                      <th key={p} className="px-5 py-3 text-xs font-black text-text-secondary text-right">
                        {p === '증액반영' ? '경영계획(증액반영)' : p}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-xs font-black text-text-secondary text-right">
                      실적(~{actualEndMonth}월)
                    </th>
                    <th className="px-5 py-3 text-xs font-black text-teal-850 text-right bg-teal-50">
                      증액필요예산
                      <div className="text-[9px] font-medium text-teal-600">
                        {increaseTargetCol === 'actual' ? '실적' : increaseTargetCol.replace('plan_', '')} - {increaseBasisCol === 'actual' ? '실적' : increaseBasisCol.replace('plan_', '')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lithium-100 bg-white">
                  {multiPlanEmptyReason ? (
                    <tr>
                      <td colSpan={5 + selectedPlanTypes.length + 2} className="px-6 py-16 text-center text-sm text-text-secondary bg-white font-semibold whitespace-pre-line leading-relaxed">
                        {multiPlanEmptyReason}
                      </td>
                    </tr>
                  ) : (
                    pagedMultiPlanRows.map((r, rIdx) => {
                      const basisVal = r.totalByColumnId[increaseBasisCol] || 0;
                      const targetVal = r.totalByColumnId[increaseTargetCol] || 0;
                      const diffVal = targetVal - basisVal;
                      const deptDisp = getMultiPlanDeptDisplay(r, selectedDept, allDepts, effectiveMultiPlanViewMode);
                      
                      return (
                        <tr key={r.rowKey || r.accountCode || rIdx} className="hover:bg-lithium-50/40 transition-colors">
                          <td className="px-5 py-3 text-xs font-semibold text-zinc-700 border-r border-lithium-100">{r.accountingType}</td>
                          <td className="px-5 py-3 text-xs font-mono text-text-tertiary border-r border-lithium-100">{r.accountCode}</td>
                          <td className="px-5 py-3 text-xs font-bold text-eco-black border-r border-lithium-150 max-w-xs truncate" title={r.accountName}>
                            {r.accountName}
                          </td>
                          <td className="px-5 py-3 text-xs text-text-secondary border-r border-lithium-100">
                            {deptDisp.writerDeptName || '-'}
                          </td>
                          <td className="px-5 py-3 text-xs text-text-secondary border-r border-lithium-100">
                            {deptDisp.attributedDeptName || '-'}
                          </td>
                          
                          {selectedPlanTypes.map(p => (
                            <td key={p} className="px-5 py-3 text-sm text-right font-mono text-zinc-650 border-r border-lithium-100">
                              {formatCurrency(toMillions(r.totalByColumnId[`plan_${p}`] || 0))}
                            </td>
                          ))}

                          <td className="px-5 py-3 text-sm text-right font-mono text-eco-black font-bold border-r border-lithium-150">
                            {formatCurrency(toMillions(r.totalByColumnId['actual'] || 0))}
                          </td>
                          
                          <td className={`px-5 py-3 text-sm text-right font-black font-mono bg-teal-50/20 ${diffVal > 0 ? 'text-cobalt-600' : diffVal < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                            {diffVal > 0 ? '+' : ''}{formatCurrency(toMillions(diffVal))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                
                {filteredMultiPlanRows.length > 0 && (
                  <tfoot className="border-t-2 border-lithium-300 bg-zinc-50 font-sans">
                    {/* 1. 제조비용 합계 */}
                    <tr className="bg-[#fcfdfd] hover:bg-[#f6f9f9] border-b border-lithium-200 text-[#253f3e] font-semibold">
                      <td colSpan={5} className="px-5 py-3.5 text-xs font-black text-stone-800 text-center border-r border-lithium-150">
                        제조 합계
                      </td>
                      {selectedPlanTypes.map(p => (
                        <td key={p} className="px-5 py-3.5 text-sm text-right font-bold font-mono border-r border-lithium-100">
                          {formatCurrency(toMillions(multiPlanTotals.mfg.valuesByColumnId[`plan_${p}`] || 0))}
                        </td>
                      ))}
                      <td className="px-5 py-3.5 text-sm text-right font-bold font-mono text-eco-black border-r border-lithium-150">
                        {formatCurrency(toMillions(multiPlanTotals.mfg.valuesByColumnId['actual'] || 0))}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-black font-mono bg-teal-50 text-[#154a48]">
                        {multiPlanTotals.mfg.requiredIncreaseAmount > 0 ? '+' : ''}
                        {formatCurrency(toMillions(multiPlanTotals.mfg.requiredIncreaseAmount))}
                      </td>
                    </tr>

                    {/* 2. 판매관리비 합계 */}
                    <tr className="bg-[#fbfcfc] hover:bg-[#f6f9f9] border-b border-lithium-200 text-[#253f3e] font-semibold">
                      <td colSpan={5} className="px-5 py-3.5 text-xs font-black text-stone-800 text-center border-r border-lithium-150">
                        판관 합계
                      </td>
                      {selectedPlanTypes.map(p => (
                        <td key={p} className="px-5 py-3.5 text-sm text-right font-bold font-mono border-r border-lithium-100">
                          {formatCurrency(toMillions(multiPlanTotals.sga.valuesByColumnId[`plan_${p}`] || 0))}
                        </td>
                      ))}
                      <td className="px-5 py-3.5 text-sm text-right font-bold font-mono text-eco-black border-r border-lithium-150">
                        {formatCurrency(toMillions(multiPlanTotals.sga.valuesByColumnId['actual'] || 0))}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-black font-mono bg-teal-50 text-[#154a48]">
                        {multiPlanTotals.sga.requiredIncreaseAmount > 0 ? '+' : ''}
                        {formatCurrency(toMillions(multiPlanTotals.sga.requiredIncreaseAmount))}
                      </td>
                    </tr>

                    {/* 3. 총합계 */}
                    <tr className="bg-teal-50/40 hover:bg-teal-50/60 text-teal-950 font-black">
                      <td colSpan={5} className="px-5 py-4 text-xs font-black text-teal-950 text-center border-r border-lithium-150">
                        총합계
                      </td>
                      {selectedPlanTypes.map(p => (
                        <td key={p} className="px-5 py-4 text-sm text-right font-black font-mono border-r border-lithium-100 text-teal-950">
                          {formatCurrency(toMillions(multiPlanTotals.grand.valuesByColumnId[`plan_${p}`] || 0))}
                        </td>
                      ))}
                      <td className="px-5 py-4 text-sm text-right font-black font-mono text-teal-950 border-r border-lithium-150">
                        {formatCurrency(toMillions(multiPlanTotals.grand.valuesByColumnId['actual'] || 0))}
                      </td>
                      <td className="px-5 py-4 text-base text-right font-black font-mono bg-teal-100 text-teal-950">
                        {multiPlanTotals.grand.requiredIncreaseAmount > 0 ? '+' : ''}
                        {formatCurrency(toMillions(multiPlanTotals.grand.requiredIncreaseAmount))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {visibleDetailCount < filteredMultiPlanRows.length && (
              <div className="border-t border-lithium-200">
                <button
                  type="button"
                  onClick={() => setVisibleDetailCount(prev => prev + 100)}
                  className="w-full py-4 text-xs font-bold text-[#008f83] hover:bg-[#008f83]/10 bg-zinc-50 transition-colors cursor-pointer"
                >
                  상세 내역 100건 더 보기 ({pagedMultiPlanRows.length.toLocaleString()} / {filteredMultiPlanRows.length.toLocaleString()}건 표시 중)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Account Modal Popup */}
      {isFullAccountModalOpen && (
        <FullAccountModal
          isOpen={isFullAccountModalOpen}
          onClose={() => setIsFullAccountModalOpen(false)}
          rows={fullFilteredAccountRows}
          viewType={chartAccountView}
          classType={chartAccountClass}
          baseName={baseName}
          targetName={targetName}
          formatCurrency={formatCurrency}
          toMillions={toMillions}
        />
      )}
    </div>
  );
}

interface FullAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: any[];
  viewType: 'ALL' | 'MFG' | 'SGA' | 'CLASS';
  classType: string;
  baseName: string;
  targetName: string;
  formatCurrency: (value: number) => string;
  toMillions: (value: number) => number;
}

function FullAccountModal({
  isOpen,
  onClose,
  rows,
  viewType,
  classType,
  baseName,
  targetName,
  formatCurrency,
  toMillions,
}: FullAccountModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = React.useMemo(() => {
    let result = [...rows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        row =>
          (row.accountCode && row.accountCode.toLowerCase().includes(q)) ||
          (row.accountName && row.accountName.toLowerCase().includes(q)) ||
          (row.key && row.key.toLowerCase().includes(q))
      );
    }
    return result;
  }, [rows, searchQuery]);

  return (
    <div className="fixed inset-0 bg-eco-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-lithium-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 bg-lithium-50 border-b border-lithium-200 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-eco-black flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#008f83]" />
              <span>전체 계정 대비 분석표</span>
              <span className="text-xs bg-[#008f83]/10 text-[#008f83] px-2 py-0.5 rounded-full font-bold">
                {viewType === 'ALL' ? '전체 계정' : viewType === 'MFG' ? '제조비용' : viewType === 'SGA' ? '판관비용' : `소분류: ${classType}`} ({filteredRows.length}건)
              </span>
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              절대 증감액이 큰 주요 변동 계정과목 순으로 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 px-2 text-xs font-bold text-zinc-500 rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* Search Bar Row */}
        <div className="bg-zinc-50 border-b border-zinc-150 px-6 py-3 flex items-center shrink-0 gap-3">
          <span className="text-xs font-bold text-zinc-500">계정과목 검색:</span>
          <input
            type="text"
            placeholder="계정과목 코드 또는 명칭 입력..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white border border-zinc-200 text-sm rounded-xl px-3 py-1.5 outline-none font-medium text-zinc-800 focus:border-[#008f83] focus:ring-1 focus:ring-[#008f83] transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-zinc-400 hover:text-zinc-650 cursor-pointer font-bold"
            >
              지우기 ↺
            </button>
          )}
        </div>

        {/* Table Body Area */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-zinc-100 z-10 border-b border-lithium-200 shadow-3xs">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">비용 성격</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">회계 구분</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정코드</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정명</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">{baseName}</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">{targetName}</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">차액</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">증감률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-text-secondary font-sans">
                    검색어 "{searchQuery}"에 일치하는 계정과목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  return (
                    <tr key={row.key} className="hover:bg-zinc-50/75 transition-colors">
                      <td className="px-5 py-3 text-xs font-bold text-zinc-700">{row.accountClass}</td>
                      <td className="px-5 py-3 text-xs text-text-secondary">{row.accountingType}</td>
                      <td className="px-5 py-3 text-xs font-mono text-text-tertiary">{row.accountCode || row.key}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-eco-black">{row.accountName}</td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-zinc-650">{formatCurrency(toMillions(row.baseAmount))}</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-eco-black font-mono">{formatCurrency(toMillions(row.targetAmount))}</td>
                      <td className={`px-5 py-3 text-sm text-right font-black font-mono ${row.variance > 0 ? 'text-cobalt-600' : row.variance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                        {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                      </td>
                      <td className={`px-5 py-3 text-sm text-right font-black font-mono ${(row.variancePercent !== null && row.variancePercent > 0) ? 'text-cobalt-500' : (row.variancePercent !== null && row.variancePercent < 0) ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                        {formatVarianceRate(row.variancePercent, 1)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-650 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
