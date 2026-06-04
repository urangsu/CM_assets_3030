import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, Minus, Download, FileSpreadsheet, Presentation, FileText, X, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, readBudgetData } from '../lib/storageKeys';
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
import { buildAtomicCompareRows, buildVarianceComparison, resolveSelectedDeptCodes, AtomicCompareRow as EngineAtomicCompareRow, getVarianceStatus, VarianceStatus } from '../lib/varianceEngine';
import { calcVarianceRate, formatVarianceRate, toExcelPercentValue } from '../lib/varianceMath';

let cachedPretendardBase64: string | null = null;
let XLSX: any = null;

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
    } else if (tab === 'default') {
      const initDept = getUserInitDept();
      setSelectedDept(initDept);
      setBasePlanType('경영계획');
      setTargetPlanType('실적');
    }
    setSelectedDepartment(null);
  }, [location.search, currentUser]);

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

  const allDepts = useMemo(() => getAllDepartments(), []);

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

  const buildDeptDetailComparisonRows = (deptCodes: string[]): DeptDetailCompareRow[] => {
    const baseRows = buildAtomicCompareRows({
      year: baseYear,
      planType: basePlanType,
      monthMode: baseMonthMode,
      selectedMonth: baseSelectedMonth,
      deptCodes,
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });

    const targetRows = buildAtomicCompareRows({
      year: targetYear,
      planType: targetPlanType,
      monthMode: targetMonthMode,
      selectedMonth: targetSelectedMonth,
      deptCodes,
      accountMetaMap,
      hasSalaryAccess: hasSalaryAccess && includeSalaryRows,
      allDepts,
    });

    const result = buildVarianceComparison({
      baseRows,
      targetRows,
      groupBy: 'account',
      allDepts,
      activeDept: deptCodes.length === 1 ? deptCodes[0] : 'group',
      selectedAccountingType,
      selectedAccountClass,
      basePlanType,
      targetPlanType,
    });

    return result.rows.map(row => ({
      deptCode: deptCodes.length === 1 ? deptCodes[0] : '',
      deptName: deptCodes.length === 1
        ? allDepts.find(d => d.code === deptCodes[0])?.name || deptCodes[0]
        : '',
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
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: thinBorder,
  };

  const percentStyle = {
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '0.00%',
    border: thinBorder,
  };

  const applyWorksheetStyle = (
    ws: any,
    options: {
      amountColumnIndexes?: number[];
      percentColumnIndexes?: number[];
      leftAlignColumnIndexes?: number[];
    } = {}
  ) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

    const amountSet = new Set(options.amountColumnIndexes || []);
    const percentSet = new Set(options.percentColumnIndexes || []);
    const leftSet = new Set(options.leftAlignColumnIndexes || []);

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[cellAddress];
        if (!cell) continue;

        if (row === 0) {
          cell.s = headerStyle;
          continue;
        }

        if (amountSet.has(col)) {
          cell.s = amountStyle;
          cell.z = '#,##0';
          continue;
        }

        if (percentSet.has(col)) {
          cell.s = percentStyle;
          cell.z = '0.00%';
          continue;
        }

        if (leftSet.has(col)) {
          cell.s = leftStyle;
          continue;
        }

        cell.s = centerStyle;
      }
    }
  };

  const applyWorksheetView = (ws: any) => {
    if (!ws['!ref']) return;

    ws['!autofilter'] = { ref: ws['!ref'] };

    ws['!freeze'] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    };
  };

  const appendSummarySheet = (
    wb: any,
    rows: DeptDetailCompareRow[],
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
      const prev = summaryByDept.get(row.deptCode) || {
        deptCode: row.deptCode,
        deptName: row.deptName,
        baseAmount: 0,
        targetAmount: 0,
      };

      prev.baseAmount += row.baseAmount;
      prev.targetAmount += row.targetAmount;

      summaryByDept.set(row.deptCode, prev);
    });

    const data: any[] = [
      ['부서코드', '부서명', baseName, targetName, '차액', '증감률(%)', '상태'],
    ];

    Array.from(summaryByDept.values())
      .sort((a, b) => a.deptCode.localeCompare(b.deptCode))
      .forEach(row => {
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
    rows: DeptDetailCompareRow[],
    usedSheetNames?: Set<string>
  ) => {
    const data: any[] = [
      [
        '부서코드',
        '부서명',
        '비용 성격',
        '회계 구분',
        '계정코드',
        '계정명',
        baseName,
        targetName,
        '차액',
        '증감률(%)',
        '상태',
      ],
    ];

    rows.forEach(row => {
      data.push([
        row.deptCode,
        row.deptName,
        row.accountClass,
        row.accountingType,
        row.accountCode,
        row.accountName,
        row.baseAmount,
        row.targetAmount,
        row.variance,
        toExcelPercentValue(row.variancePercent),
        row.status,
      ]);
    });

    const totalBase = rows.reduce((sum, row) => sum + row.baseAmount, 0);
    const totalTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);
    const totalVariance = totalTarget - totalBase;
    const totalVariancePercent = calcVarianceRate(totalBase, totalTarget);

    data.push([]);
    data.push([
      '',
      '',
      '',
      '',
      '',
      '부서 합계',
      totalBase,
      totalTarget,
      totalVariance,
      toExcelPercentValue(totalVariancePercent),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 15 },
      { wch: 34 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes: [6, 7, 8],
      percentColumnIndexes: [9],
      leftAlignColumnIndexes: [5],
    });

    applyWorksheetView(ws);

    appendSheetSafely(wb, ws, `${deptCode}_${deptName}`, usedSheetNames);
  };

  function applySalaryVisibilityFilter<T extends { isSalary?: boolean }>(rows: T[]): T[] {
    if (hasSalaryAccess && includeSalaryRows) return rows;
    return rows.filter(row => !row.isSalary);
  }

  function aggregateGroupRowsByAccount(rows: DeptDetailCompareRow[]): DeptDetailCompareRow[] {
    const map = new Map<string, DeptDetailCompareRow>();

    rows.forEach(row => {
      const key = `${row.accountCode}|${row.accountName}`;
      const prev = map.get(key);

      if (prev) {
        prev.baseAmount += row.baseAmount;
        prev.targetAmount += row.targetAmount;
        prev.variance = prev.targetAmount - prev.baseAmount;
        prev.variancePercent = calcVarianceRate(prev.baseAmount, prev.targetAmount);
        prev.status = getVarianceStatus({
          baseAmount: prev.baseAmount,
          targetAmount: prev.targetAmount,
          basePlanType,
          targetPlanType,
        });
      } else {
        map.set(key, { ...row });
      }
    });

    return Array.from(map.values())
      .filter(row => row.baseAmount !== 0 || row.targetAmount !== 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }

  const appendGroupDetailSheet = (
    wb: any,
    group: DeptGroup,
    deptCodes: string[],
    rows: DeptDetailCompareRow[],
    usedSheetNames?: Set<string>
  ) => {
    const aggregatedRows = aggregateGroupRowsByAccount(rows);

    const data: any[] = [
      [
        '그룹명',
        '포함 부서코드',
        '비용 성격',
        '회계 구분',
        '계정코드',
        '계정명',
        baseName,
        targetName,
        '차액',
        '증감률(%)',
        '상태',
      ],
    ];

    aggregatedRows.forEach(row => {
      data.push([
        group.name,
        deptCodes.join(', '),
        row.accountClass,
        row.accountingType,
        row.accountCode,
        row.accountName,
        row.baseAmount,
        row.targetAmount,
        row.variance,
        toExcelPercentValue(row.variancePercent),
        row.status,
      ]);
    });

    const totalBase = aggregatedRows.reduce((sum, row) => sum + row.baseAmount, 0);
    const totalTarget = aggregatedRows.reduce((sum, row) => sum + row.targetAmount, 0);
    const totalVariance = totalTarget - totalBase;
    const totalVariancePercent = calcVarianceRate(totalBase, totalTarget);

    data.push([]);
    data.push([
      group.name,
      deptCodes.join(', '),
      '',
      '',
      '',
      '그룹 합계',
      totalBase,
      totalTarget,
      totalVariance,
      toExcelPercentValue(totalVariancePercent),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 36 },
      { wch: 16 },
      { wch: 12 },
      { wch: 15 },
      { wch: 34 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
    ];

    applyWorksheetStyle(ws, {
      amountColumnIndexes: [6, 7, 8],
      percentColumnIndexes: [9],
      leftAlignColumnIndexes: [0, 1, 5],
    });

    applyWorksheetView(ws);
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

    const deptDetailRowsRaw = buildDeptDetailComparisonRows(deptCodes);
    const deptDetailRows = applySalaryVisibilityFilter(deptDetailRowsRaw);

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
          appendDeptDetailSheet(wb, deptCode, deptName, rows, usedSheetNames);
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

        const groupRowsRaw = buildDeptDetailComparisonRows(groupDeptCodes);
        const groupRows = applySalaryVisibilityFilter(groupRowsRaw);

        if (groupRows.length > 0) {
          appendGroupDetailSheet(wb, group, groupDeptCodes, groupRows, usedSheetNames);
        }
      });
    }

    XLSX.writeFile(wb, getReportFileName('xlsx'));
  };

  const handleDownloadExcel = async () => {
    await ensureXLSX();
    const wb = XLSX.utils.book_new();

    const excelData: any[] = [];

    excelData.push([
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      baseName,
      targetName,
      '차액',
      '증감률(%)',
      '상태'
    ]);

    salaryFilteredComparisonRows.forEach(row => {
      excelData.push([
        row.accountClass,
        row.accountingType,
        row.accountCode || '',
        row.accountName,
        row.baseAmount,
        row.targetAmount,
        row.variance,
        toExcelPercentValue(row.variancePercent),
        row.status
      ]);
    });

    let excelBaseMfg = 0;
    let excelTargetMfg = 0;
    let excelBaseSga = 0;
    let excelTargetSga = 0;

    salaryFilteredComparisonRows.forEach(row => {
      if (row.accountingType === '제조') {
        excelBaseMfg += row.baseAmount;
        excelTargetMfg += row.targetAmount;
      } else if (row.accountingType === '판관') {
        excelBaseSga += row.baseAmount;
        excelTargetSga += row.targetAmount;
      }
    });

    const mfgVar = excelTargetMfg - excelBaseMfg;
    const mfgVarRate = calcVarianceRate(excelBaseMfg, excelTargetMfg);

    const sgaVar = excelTargetSga - excelBaseSga;
    const sgaVarRate = calcVarianceRate(excelBaseSga, excelTargetSga);

    const excelTotalBase = excelBaseMfg + excelBaseSga;
    const excelTotalTarget = excelTargetMfg + excelTargetSga;
    const totalVar = excelTotalTarget - excelTotalBase;
    const totalVarRate = calcVarianceRate(excelTotalBase, excelTotalTarget);

    excelData.push([]); // Empty row for spacing
    excelData.push(['', '', '', '제조 합계', excelBaseMfg, excelTargetMfg, mfgVar, toExcelPercentValue(mfgVarRate), '']);
    excelData.push(['', '', '', '판관 합계', excelBaseSga, excelTargetSga, sgaVar, toExcelPercentValue(sgaVarRate), '']);
    excelData.push(['', '', '', '총 합계', excelTotalBase, excelTotalTarget, totalVar, toExcelPercentValue(totalVarRate), '']);

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    applyWorksheetStyle(ws, {
      amountColumnIndexes: [4, 5, 6],
      percentColumnIndexes: [7],
      leftAlignColumnIndexes: [3],
    });
    
    ws['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 10 }
    ];

    applyWorksheetView(ws);

    appendSheetSafely(wb, ws, '비교분석');
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
      tableRows = chartData.slice(0, 15).map(row => [
        row.name,
        formatCurrency(row[baseName]),
        formatCurrency(row[targetName]),
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

      salaryFilteredComparisonRows.forEach(row => {
        tableRows.push([
          row.accountCode || '',
          row.accountName,
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

    if (selectedDept === 'by_dept') {
      head = [['부서명', baseName, targetName, '차액', '증감률(%)']];
      body = chartData.map(row => [
        row.name,
        formatCurrency(row[baseName]),
        formatCurrency(row[targetName]),
        `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
        formatVarianceRate(row.variancePercent, 1)
      ]);
    } else {
      head = [['계정코드', '계정명', baseName, targetName, '차액', '증감률(%)']];
      
      salaryFilteredComparisonRows.forEach(row => {
        body.push([
          row.accountCode || '',
          row.accountName,
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

  const accountMetaMap = useMemo(() => {
    const actualRows = loadActualRows(baseYear).concat(loadActualRows(targetYear));
    const budgetRowsByDept = new Map<string, any[]>();
    const deptCodes = allDepts.map(d => d.code);

    if (basePlanType !== '실적') {
      const baseBudgets = loadBudgetRowsByDept({ year: baseYear, planType: basePlanType, deptCodes });
      baseBudgets.forEach((rows, dCode) => {
        budgetRowsByDept.set(`${baseYear}_${dCode}`, rows);
      });
    }
    if (targetPlanType !== '실적') {
      const targetBudgets = loadBudgetRowsByDept({ year: targetYear, planType: targetPlanType, deptCodes });
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
  }, [baseYear, targetYear, basePlanType, targetPlanType, categories, allDepts]);

  const selectedDeptCodes = useMemo(() => {
    return resolveSelectedDeptCodes({
      selectedDept,
      viewableDepts,
      isAdmin,
      isPlanningTeam,
    });
  }, [selectedDept, viewableDepts, isAdmin, isPlanningTeam]);

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
          </span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
          {tab === 'default' && '예산 대비 실적 비교분석'}
          {tab === 'time' && '시점별 예산·실적 비교분석'}
          {tab === 'dept' && '부서별 예산 집행 비교분석'}
          {tab === 'account' && '계정별 예산 집행 비교분석'}
        </h2>
        <p className="text-xs text-[#647067] mt-1">
          {tab === 'default' && '선택한 계획과 실적을 같은 기준으로 비교하여 차액과 증감률을 확인합니다.'}
          {tab === 'time' && '서로 다른 연도·월·계획구분을 기준으로 예산과 실적 변화를 비교합니다.'}
          {tab === 'dept' && '부서별 편성 예산과 집행 실적을 비교하여 집행 차이를 확인합니다.'}
          {tab === 'account' && '계정별 예산과 실적 차이를 확인하고 주요 변동 계정을 점검합니다.'}
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
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl border border-lithium-200 shadow-sm flex flex-col gap-4">
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
              <option value="전체">전체 비용성격</option>
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
                {isDeptComparisonMode ? (
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
              </div>
            )}
          </div>
        </div>
      </div>

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
