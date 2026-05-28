import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, Minus, Download, FileSpreadsheet, Presentation, FileText, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import pptxgen from 'pptxgenjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, readBudgetData } from '../lib/storageKeys';
import { normalizePlanType } from '../lib/planTypes';
import { usePermission } from '../lib/permissions';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { resolveAccountByCode } from '../lib/accountResolver';
import { classifyAccount, ACCOUNT_CLASS_OPTIONS, ACCOUNTING_TYPE_OPTIONS, AccountClass, AccountingType, getAccountingType } from '../lib/accountClassification';
import { isInvestmentAccount } from '../lib/accountMaster';
import { ChartCard } from '../components/charts/ChartCard';
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { MonthMode, parseMonthIndex, shouldIncludeMonth, getMonthModeLabel } from '../lib/monthFilter';

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

  useEffect(() => {
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
  }, [tab, currentUser]);

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
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [comparisonRows, setComparisonRows] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<{ departmentCode: string, departmentName: string } | null>(null);
  const [selectedDeptDetails, setSelectedDeptDetails] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(INITIAL_CATEGORIES);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportDeptCodes, setSelectedReportDeptCodes] = useState<string[]>([]);
  const [includeAllReportDepts, setIncludeAllReportDepts] = useState(true);
  const [includeSummarySheet, setIncludeSummarySheet] = useState(true);
  const [includeDetailSheets, setIncludeDetailSheets] = useState(true);
  const [summaryTotals, setSummaryTotals] = useState({
    baseMfg: 0,
    baseSga: 0,
    targetMfg: 0,
    targetSga: 0
  });

  const baseName = `${baseYear} ${basePlanType} (${getMonthModeLabel(baseMonthMode, baseSelectedMonth)})`;
  const targetName = `${targetYear} ${targetPlanType} (${getMonthModeLabel(targetMonthMode, targetSelectedMonth)})`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
  };

  const toMillions = (val: number) => Math.round(val / 1000000);

  const allDepts = getAllDepartments();

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

  interface AtomicCompareRow {
    deptCode: string;
    deptName: string;
    accountCode: string;
    accountName: string;
    accountingType: string;
    accountClass: string;
    amount: number;
  }

  const getAtomicCompareRows = (
    year: string,
    planType: string,
    periodMode: MonthMode,
    periodSelectedMonth: number,
    deptCodes: string[]
  ): AtomicCompareRow[] => {
    const rows: AtomicCompareRow[] = [];

    const accountCategoryMap = new Map<string, string>();
    const accountToCategoryNameMap = new Map<string, string>();
    const accountCodeToNameMap = new Map<string, string>();
    categories.forEach(cat => {
      const type = cat.name.startsWith('제조') ? '제조' : cat.name.startsWith('판관') ? '판관' : '기타';
      cat.accounts.forEach((acc: any) => {
        accountCategoryMap.set(acc.code, type);
        accountToCategoryNameMap.set(acc.code, cat.name);
        accountCodeToNameMap.set(acc.code, acc.name);
      });
    });

    const salaryAccountCodes = new Set<string>();
    INITIAL_CATEGORIES.forEach(cat => {
      if (SALARY_CATEGORIES.includes(cat.name)) {
        cat.accounts.forEach((acc: any) => salaryAccountCodes.add(acc.code));
      }
    });

    if (planType === '실적') {
      const actualDataStr = localStorage.getItem(`${STORAGE_KEYS.ACTUAL_DATA}_${year}`);
      const actualData = actualDataStr ? JSON.parse(actualDataStr) : [];

      const savedActualsMap = new Map<string, string>();
      allDepts.forEach(d => {
        const key = getBudgetDataKey(d.code, year, '실적');
        try {
          const saved = JSON.parse(localStorage.getItem(key) || '[]');
          saved.forEach((row: any) => {
            savedActualsMap.set(`${d.code}_${row.code}`, row.attributedDeptCode);
          });
        } catch (e) {}
      });

      actualData.forEach((item: any) => {
        const overriddenDeptCode = savedActualsMap.get(`${item.usageCode}_${item.accountCode}`);
        const effectiveDeptCode = overriddenDeptCode || item.usageCode;
        
        if (!deptCodes.includes(effectiveDeptCode)) return;

        const periodStr = String(item.period || '');
        const monthIndex = parseMonthIndex(periodStr);
        if (!shouldIncludeMonth(monthIndex, periodMode, periodSelectedMonth)) return;

        const catName = accountToCategoryNameMap.get(item.accountCode);
        if (!hasSalaryAccess) {
          if (catName && SALARY_CATEGORIES.includes(catName)) return;
          if (salaryAccountCodes.has(item.accountCode)) return;
        }

        const resolvedAccount = resolveAccountByCode({
          accountCode: item.accountCode,
          uploadedName: item.accountName,
          year,
        });

        const accountName = resolvedAccount.name;

        if (selectedAccountingType !== '전체') {
          if (getAccountingType(item.accountCode, accountName) !== selectedAccountingType) return;
        }
        if (selectedAccountClass !== '전체') {
          if (classifyAccount(item.accountCode, accountName) !== selectedAccountClass) return;
        }

        const amount = Number(item.completed || 0);

        if (amount === 0) return;

        rows.push({
          deptCode: effectiveDeptCode,
          deptName: allDepts.find(d => d.code === effectiveDeptCode)?.name || effectiveDeptCode,
          accountCode: item.accountCode,
          accountName,
          accountingType: getAccountingType(item.accountCode, accountName),
          accountClass: classifyAccount(item.accountCode, accountName),
          amount,
        });
      });

      return rows;
    }

    deptCodes.forEach(deptCode => {
      const savedDataStr = readBudgetData(deptCode, year, planType);
      const oldKey = `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}`;
      const dataStr = savedDataStr || (
        year === '2026' && planType === '경영계획'
          ? localStorage.getItem(oldKey)
          : null
      );

      if (!dataStr) return;

      let budgetRows: any[] = [];
      try {
        budgetRows = JSON.parse(dataStr);
      } catch (e) {
        return;
      }

      budgetRows.forEach((row: any) => {
        const attributedDeptCode = row.attributedDeptCode || deptCode;
        if (!deptCodes.includes(attributedDeptCode)) return;

        const catName = accountToCategoryNameMap.get(row.code);
        if (!hasSalaryAccess) {
          if (catName && SALARY_CATEGORIES.includes(catName)) return;
          if (salaryAccountCodes.has(row.code)) return;
        }

        const resolvedAccount = resolveAccountByCode({
          accountCode: row.code,
          uploadedName: row.name,
          year,
        });

        const accountName = resolvedAccount.name;

        if (selectedAccountingType !== '전체') {
          if (getAccountingType(row.code, accountName) !== selectedAccountingType) return;
        }
        if (selectedAccountClass !== '전체') {
          if (classifyAccount(row.code, accountName) !== selectedAccountClass) return;
        }

        let amount = 0;
        if (periodMode === 'MONTH') {
          amount = Number(row.values?.[periodSelectedMonth - 1] || 0);
        } else {
          amount = (row.values || [])
            .slice(0, periodSelectedMonth)
            .reduce((sum: number, v: any) => sum + Number(v || 0), 0);
        }

        if (amount === 0) return;

        rows.push({
          deptCode: attributedDeptCode,
          deptName: allDepts.find(d => d.code === attributedDeptCode)?.name || attributedDeptCode,
          accountCode: row.code,
          accountName,
          accountingType: getAccountingType(row.code, accountName),
          accountClass: classifyAccount(row.code, accountName),
          amount,
        });
      });
    });

    return rows;
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
    variancePercent: number;
    status: '증가' | '감소' | '동일' | '신규' | '사라짐';
  }

  const buildDeptDetailComparisonRows = (deptCodes: string[]): DeptDetailCompareRow[] => {
    const baseRows = getAtomicCompareRows(
      baseYear,
      basePlanType,
      baseMonthMode,
      baseSelectedMonth,
      deptCodes
    );

    const targetRows = getAtomicCompareRows(
      targetYear,
      targetPlanType,
      targetMonthMode,
      targetSelectedMonth,
      deptCodes
    );

    const baseMap = new Map<string, AtomicCompareRow>();
    const targetMap = new Map<string, AtomicCompareRow>();

    baseRows.forEach(row => {
      const key = `${row.deptCode}|${row.accountCode}`;
      const prev = baseMap.get(key);
      if (prev) {
        prev.amount += row.amount;
      } else {
        baseMap.set(key, { ...row });
      }
    });

    targetRows.forEach(row => {
      const key = `${row.deptCode}|${row.accountCode}`;
      const prev = targetMap.get(key);
      if (prev) {
        prev.amount += row.amount;
      } else {
        targetMap.set(key, { ...row });
      }
    });

    const allKeys = new Set([...baseMap.keys(), ...targetMap.keys()]);

    return Array.from(allKeys).map(key => {
      const base = baseMap.get(key);
      const target = targetMap.get(key);
      const src = base || target!;

      const baseAmount = base?.amount || 0;
      const targetAmount = target?.amount || 0;
      const variance = targetAmount - baseAmount;
      const variancePercent = baseAmount === 0 ? 0 : (variance / baseAmount) * 100;

      const status: '신규' | '사라짐' | '증가' | '감소' | '동일' =
        baseAmount === 0 && targetAmount > 0 ? '신규' :
        baseAmount > 0 && targetAmount === 0 ? '사라짐' :
        variance > 0 ? '증가' :
        variance < 0 ? '감소' :
        '동일';

      return {
        deptCode: src.deptCode,
        deptName: src.deptName,
        accountingType: src.accountingType,
        accountClass: src.accountClass,
        accountCode: src.accountCode,
        accountName: src.accountName,
        baseAmount,
        targetAmount,
        variance,
        variancePercent,
        status,
      };
    })
    .filter(row => row.baseAmount !== 0 || row.targetAmount !== 0)
    .sort((a, b) => {
      if (a.deptCode !== b.deptCode) return a.deptCode.localeCompare(b.deptCode);
      return Math.abs(b.variance) - Math.abs(a.variance);
    });
  };

  const safeSheetName = (name: string): string => {
    return String(name)
      .replace(/[\\/?*[\]:]/g, '')
      .slice(0, 31);
  };

  const getDeptSheetName = (deptCode: string, deptName: string): string => {
    return safeSheetName(`${deptCode}_${deptName}`);
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
    ws: XLSX.WorkSheet,
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

  const applyWorksheetView = (ws: XLSX.WorkSheet) => {
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
    wb: XLSX.WorkBook,
    rows: DeptDetailCompareRow[],
    deptCodes: string[]
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
      ['부서코드', '부서명', '기준 금액', '비교 금액', '차액', '증감률(%)', '상태'],
    ];

    Array.from(summaryByDept.values())
      .sort((a, b) => a.deptCode.localeCompare(b.deptCode))
      .forEach(row => {
        const variance = row.targetAmount - row.baseAmount;
        const variancePercent = row.baseAmount === 0 ? 0 : variance / row.baseAmount;

        const status =
          row.baseAmount === 0 && row.targetAmount > 0 ? '신규' :
          row.baseAmount > 0 && row.targetAmount === 0 ? '사라짐' :
          variance > 0 ? '증가' :
          variance < 0 ? '감소' :
          '동일';

        data.push([
          row.deptCode,
          row.deptName,
          row.baseAmount,
          row.targetAmount,
          variance,
          variancePercent,
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

    XLSX.utils.book_append_sheet(wb, ws, '전체');
  };

  const appendDeptDetailSheet = (
    wb: XLSX.WorkBook,
    deptCode: string,
    deptName: string,
    rows: DeptDetailCompareRow[]
  ) => {
    const data: any[] = [
      [
        '부서코드',
        '부서명',
        '비용 성격',
        '회계 구분',
        '계정코드',
        '계정명',
        '기준 금액',
        '비교 금액',
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
        row.variancePercent / 100,
        row.status,
      ]);
    });

    const totalBase = rows.reduce((sum, row) => sum + row.baseAmount, 0);
    const totalTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);
    const totalVariance = totalTarget - totalBase;
    const totalVariancePercent = totalBase === 0 ? 0 : totalVariance / totalBase;

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
      totalVariancePercent,
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

    XLSX.utils.book_append_sheet(wb, ws, getDeptSheetName(deptCode, deptName));
  };

  const handleDownloadExcelWithDeptDetails = (deptCodes: string[]) => {
    const wb = XLSX.utils.book_new();

    const deptDetailRows = buildDeptDetailComparisonRows(deptCodes);

    // 1. 전체 요약 시트
    if (includeSummarySheet) {
      appendSummarySheet(wb, deptDetailRows, deptCodes);
    }

    // 2. 선택 부서별 상세 시트
    if (includeDetailSheets) {
      deptCodes.forEach(deptCode => {
        const dept = allDepts.find(d => d.code === deptCode);
        const deptName = dept?.name || deptCode;

        const rows = deptDetailRows.filter(row => row.deptCode === deptCode);

        if (rows.length > 0) {
          appendDeptDetailSheet(wb, deptCode, deptName, rows);
        }
      });
    }

    XLSX.writeFile(wb, getReportFileName('xlsx'));
  };

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const excelData: any[] = [];
    
    excelData.push([
      '비용 성격',
      '회계 구분',
      '계정코드',
      '계정명',
      '기준 금액',
      '비교 금액',
      '차액',
      '증감률(%)',
      '상태'
    ]);
    
    comparisonRows.forEach(row => {
      excelData.push([
        row.accountClass,
        row.accountingType,
        row.accountCode || '',
        row.accountName,
        row.baseAmount,
        row.targetAmount,
        row.variance,
        typeof row.variancePercent === 'number' ? row.variancePercent.toFixed(2) + '%' : row.variancePercent,
        row.status
      ]);
    });

    // Requirement 1: Add summary totals (Mfg, SGA, Total) to the end of Excel
    const mfgVar = summaryTotals.targetMfg - summaryTotals.baseMfg;
    const mfgVarPct = summaryTotals.baseMfg === 0 ? 0 : (mfgVar / summaryTotals.baseMfg) * 100;
    
    const sgaVar = summaryTotals.targetSga - summaryTotals.baseSga;
    const sgaVarPct = summaryTotals.baseSga === 0 ? 0 : (sgaVar / summaryTotals.baseSga) * 100;
    
    // Compute directly inside function to avoid stale closures
    const excelTotalBase = chartData.reduce((sum, item) => sum + (item[baseName] || 0), 0);
    const excelTotalTarget = chartData.reduce((sum, item) => sum + (item[targetName] || 0), 0);
    const totalVar = excelTotalTarget - excelTotalBase;
    const totalVarPct = excelTotalBase === 0 ? 0 : (totalVar / excelTotalBase) * 100;

    excelData.push([]); // Empty row for spacing
    excelData.push(['', '', '', '제조 합계', summaryTotals.baseMfg, summaryTotals.targetMfg, mfgVar, mfgVarPct.toFixed(2) + '%', '']);
    excelData.push(['', '', '', '판관 합계', summaryTotals.baseSga, summaryTotals.targetSga, sgaVar, sgaVarPct.toFixed(2) + '%', '']);
    excelData.push(['', '', '', '총 합계', excelTotalBase, excelTotalTarget, totalVar, totalVarPct.toFixed(2) + '%', '']);

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Apply number formatting with comma
    Object.keys(ws).forEach(key => {
      if (key[0] === '!') return;
      if (ws[key].t === 'n') {
        ws[key].z = '#,##0';
      }
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

    XLSX.utils.book_append_sheet(wb, ws, '비교분석');
    XLSX.writeFile(wb, getDownloadFileName('xlsx'));
  };

  const handleDownloadPPT = () => {
    const pres = new pptxgen();
    
    const slide1 = pres.addSlide();
    slide1.addText('예산 비교분석 보고서', { x: 1, y: 2, w: '80%', h: 1, fontSize: 36, bold: true, color: '191f28' });
    slide1.addText(`기준: ${baseName}\n비교: ${targetName}`, { x: 1, y: 3.5, w: '80%', h: 1, fontSize: 18, color: '4e5968' });

    const slide2 = pres.addSlide();
    slide2.addText('요약', { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 24, bold: true, color: '191f28' });
    
    const pptTotalBase = chartData.reduce((sum, item) => sum + (item[baseName] || 0), 0);
    const pptTotalTarget = chartData.reduce((sum, item) => sum + (item[targetName] || 0), 0);
    const pptTotalVariance = pptTotalTarget - pptTotalBase;
    const pptTotalVariancePercent = pptTotalBase === 0 ? 0 : (pptTotalVariance / pptTotalBase) * 100;

    slide2.addText(`${baseName} 총액: ${formatCurrency(pptTotalBase)}원`, { x: 0.5, y: 1.5, w: '90%', h: 0.5, fontSize: 18 });
    slide2.addText(`${targetName} 총액: ${formatCurrency(pptTotalTarget)}원`, { x: 0.5, y: 2.2, w: '90%', h: 0.5, fontSize: 18 });
    
    const varianceText = `${pptTotalVariance > 0 ? '+' : ''}${formatCurrency(pptTotalVariance)}원 (${pptTotalVariance > 0 ? '+' : ''}${pptTotalVariancePercent.toFixed(1)}%)`;
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
        `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
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

      comparisonRows.forEach(row => {
        tableRows.push([
          row.accountCode || '',
          row.accountName,
          formatCurrency(row.baseAmount),
          formatCurrency(row.targetAmount),
          `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
          `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
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

    const pdfTotalBase = chartData.reduce((sum, item) => sum + (item[baseName] || 0), 0);
    const pdfTotalTarget = chartData.reduce((sum, item) => sum + (item[targetName] || 0), 0);
    const pdfTotalVariance = pdfTotalTarget - pdfTotalBase;
    const pdfTotalVariancePercent = pdfTotalBase === 0 ? 0 : (pdfTotalVariance / pdfTotalBase) * 100;

    doc.text(`총액 요약:`, 14, 42);
    doc.text(`- ${baseName} 총액: ${formatCurrency(pdfTotalBase)}원`, 14, 48);
    doc.text(`- ${targetName} 총액: ${formatCurrency(pdfTotalTarget)}원`, 14, 54);
    const varianceText = `${pdfTotalVariance > 0 ? '+' : ''}${formatCurrency(pdfTotalVariance)}원 (${pdfTotalVariance > 0 ? '+' : ''}${pdfTotalVariancePercent.toFixed(1)}%)`;
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
        `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
      ]);
    } else {
      head = [['계정코드', '계정명', baseName, targetName, '차액', '증감률(%)']];
      
      comparisonRows.forEach(row => {
        body.push([
          row.accountCode || '',
          row.accountName,
          formatCurrency(row.baseAmount),
          formatCurrency(row.targetAmount),
          `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
          `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
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

  useEffect(() => {
    // Helper function to get aggregated data for a specific year and plan type
    const getAggregatedData = (year: string, planType: string, periodMode: MonthMode, periodSelectedMonth: number, deptOverride?: string) => {
      const aggregated = new Map<string, { name: string, total: number }>();
      let mfgTotal = 0;
      let sgaTotal = 0;

      const viewableDeptCodes = new Set(viewableDepts.map(d => d.code));

      const accountCategoryMap = new Map<string, string>();
      const accountToCategoryNameMap = new Map<string, string>();
      const accountCodeToNameMap = new Map<string, string>();
      categories.forEach(cat => {
        const type = cat.name.startsWith('제조') ? '제조' : cat.name.startsWith('판관') ? '판관' : '기타';
        cat.accounts.forEach((acc: any) => {
          accountCategoryMap.set(acc.code, type);
          accountToCategoryNameMap.set(acc.code, cat.name);
          accountCodeToNameMap.set(acc.code, acc.name);
        });
      });

      const salaryAccountCodes = new Set<string>();
      INITIAL_CATEGORIES.forEach(cat => {
        if (SALARY_CATEGORIES.includes(cat.name)) {
          cat.accounts.forEach((acc: any) => salaryAccountCodes.add(acc.code));
        }
      });

      const activeDept = deptOverride || selectedDept;

      if (planType === '실적') {
        const actualDataStr = localStorage.getItem(`${STORAGE_KEYS.ACTUAL_DATA}_${year}`);
        if (actualDataStr) {
          const actualData: any[] = JSON.parse(actualDataStr);
          
          // Load saved actuals to get the overridden attributedDeptCode
          const savedActualsMap = new Map<string, string>();
          allDepts.forEach(d => {
            const key = getBudgetDataKey(d.code, year, '실적');
            try {
              const saved = JSON.parse(localStorage.getItem(key) || '[]');
              saved.forEach((row: any) => {
                savedActualsMap.set(`${d.code}_${row.code}`, row.attributedDeptCode);
              });
            } catch (e) {}
          });

          // Use a composite key [DeptCode_AccountCode] for internal aggregation to ensure precision
          const internalAggregated = new Map<string, { deptCode: string, accountCode: string, accountName: string, amount: number }>();

          actualData.forEach(item => {
            const accType = accountCategoryMap.get(item.accountCode) || '기타';
            const overriddenDeptCode = savedActualsMap.get(`${item.usageCode}_${item.accountCode}`);
            const effectiveDeptCode = overriddenDeptCode || item.usageCode;

            // Department filter
            if (activeDept === 'mfg' && accType !== '제조') return;
            if (activeDept === 'sga' && accType !== '판관') return;
            if (activeDept === 'viewable') {
              if (!viewableDeptCodes.has(effectiveDeptCode)) return;
            } else if (activeDept !== 'all' && activeDept !== 'by_dept' && activeDept !== 'mfg' && activeDept !== 'sga' && effectiveDeptCode !== activeDept) {
              return;
            }

            // Period filter
            const periodStr = String(item.period || '');
            const monthIndex = parseMonthIndex(periodStr);
            if (!shouldIncludeMonth(monthIndex, periodMode, periodSelectedMonth)) return;

            const catName = accountToCategoryNameMap.get(item.accountCode);
            const resolvedAccount = resolveAccountByCode({ accountCode: item.accountCode, uploadedName: item.accountName, year });
            const resolvedAccountName = resolvedAccount.name;
              
              // Salary access check
              if (!hasSalaryAccess) {
                if (catName && SALARY_CATEGORIES.includes(catName)) return;
                if (salaryAccountCodes.has(item.accountCode)) return;
              }

              if (selectedAccountingType !== '전체') {
                if (getAccountingType(item.accountCode, resolvedAccountName) !== selectedAccountingType) return;
              }
              if (selectedAccountClass !== '전체') {
                if (classifyAccount(item.accountCode, resolvedAccountName) !== selectedAccountClass) return;
              }

              const amount = item.completed || 0;
              if (accType === '제조') mfgTotal += amount;
              if (accType === '판관') sgaTotal += amount;

              // Unique key: [DeptCode_AccountCode]
              const compositeKey = `${effectiveDeptCode}_${item.accountCode}`;
              if (internalAggregated.has(compositeKey)) {
                internalAggregated.get(compositeKey)!.amount += amount;
              } else {
                internalAggregated.set(compositeKey, { 
                  deptCode: effectiveDeptCode, 
                  accountCode: item.accountCode, 
                  accountName: resolvedAccountName, 
                  amount 
                });
              }
          });

          // Final aggregation based on selected view
          internalAggregated.forEach(item => {
            const code = activeDept === 'by_dept' ? item.deptCode : item.accountCode;
            const name = activeDept === 'by_dept' ? (allDepts.find(d => d.code === item.deptCode)?.name || item.deptCode) : item.accountName;
            
            if (aggregated.has(code)) {
              aggregated.get(code)!.total += item.amount;
            } else {
              aggregated.set(code, { name, total: item.amount });
            }
          });
        }
      } else {
        // Budget aggregation with unique key logic
        const internalAggregated = new Map<string, { deptCode: string, accountCode: string, accountName: string, amount: number }>();

        allDepts.forEach(dept => {
          const savedDataStr = readBudgetData(dept.code, year, planType);
          // Keep oldKey as fallback for migration support
          const oldKey = `${STORAGE_KEYS.BUDGET_DATA}_${dept.code}`;
          const dataStr = savedDataStr || (year === '2026' && planType === '경영계획' ? localStorage.getItem(oldKey) : null);

          if (dataStr) {
            const deptData = JSON.parse(dataStr);
            deptData.forEach((row: any) => {
              const rowDeptCode = row.attributedDeptCode || dept.code;
              const accType = accountCategoryMap.get(row.code) || '기타';

              if (activeDept === 'mfg' && accType !== '제조') return;
              if (activeDept === 'sga' && accType !== '판관') return;
              if (activeDept === 'viewable') {
                if (!viewableDeptCodes.has(rowDeptCode)) return;
              } else if (activeDept !== 'all' && activeDept !== 'by_dept' && activeDept !== 'mfg' && activeDept !== 'sga' && rowDeptCode !== activeDept) {
                return;
              }

              const catName = accountToCategoryNameMap.get(row.code);
              if (!hasSalaryAccess) {
                if (catName && SALARY_CATEGORIES.includes(catName)) return;
                if (salaryAccountCodes.has(row.code)) return;
              }

              const resolvedAccount = resolveAccountByCode({ accountCode: row.code, uploadedName: row.name, year });
              const resolvedAccountName = resolvedAccount.name;

              if (selectedAccountingType !== '전체') {
                if (getAccountingType(row.code, resolvedAccountName) !== selectedAccountingType) return;
              }
              if (selectedAccountClass !== '전체') {
                if (classifyAccount(row.code, resolvedAccountName) !== selectedAccountClass) return;
              }

              let amount = 0;
              if (periodMode === 'MONTH') {
                amount = row.values[periodSelectedMonth - 1] || 0;
              } else {
                amount = row.values.slice(0, periodSelectedMonth).reduce((sum: number, val: number) => sum + val, 0);
              }

              if (accType === '제조') mfgTotal += amount;
              if (accType === '판관') sgaTotal += amount;

              // Unique key: [SourceDeptCode_AccountCode] to ensure each row in storage is counted exactly once
              const compositeKey = `${dept.code}_${row.code}`;
              if (internalAggregated.has(compositeKey)) {
                internalAggregated.get(compositeKey)!.amount += amount;
              } else {
                internalAggregated.set(compositeKey, { 
                  deptCode: rowDeptCode, 
                  accountCode: row.code, 
                  accountName: resolvedAccountName, 
                  amount 
                });
              }
            });
          }
        });

        // Final aggregation based on selected view
        internalAggregated.forEach(item => {
          const code = activeDept === 'by_dept' ? item.deptCode : item.accountCode;
          const name = activeDept === 'by_dept' ? (allDepts.find(d => d.code === item.deptCode)?.name || item.deptCode) : item.accountName;
          
          if (aggregated.has(code)) {
            aggregated.get(code)!.total += item.amount;
          } else {
            aggregated.set(code, { name, total: item.amount });
          }
        });
      }
      return { aggregated, mfgTotal, sgaTotal };
    };

    const baseData = getAggregatedData(baseYear, basePlanType, baseMonthMode, baseSelectedMonth);
    const targetData = getAggregatedData(targetYear, targetPlanType, targetMonthMode, targetSelectedMonth);

    const baseDataMap = baseData.aggregated;
    const targetDataMap = targetData.aggregated;

    setSummaryTotals({
      baseMfg: baseData.mfgTotal,
      baseSga: baseData.sgaTotal,
      targetMfg: targetData.mfgTotal,
      targetSga: targetData.sgaTotal
    });

    // Combine data for the chart
    const allCodes = new Set([...baseDataMap.keys(), ...targetDataMap.keys()]);
    const newChartData = Array.from(allCodes).map(code => {
      const baseItem = baseDataMap.get(code);
      const targetItem = targetDataMap.get(code);
      const name = baseItem?.name || targetItem?.name || 'Unknown';
      
      let baseVal = baseItem?.total || 0;
      let targetVal = targetItem?.total || 0;

      const variance = targetVal - baseVal;
      const variancePercent = baseVal === 0 ? 0 : (variance / baseVal) * 100;

      return {
        code,
        name,
        [baseName]: baseVal,
        [targetName]: targetVal,
        variance,
        variancePercent
      };
    }).filter(item => (item[baseName] as number) > 0 || (item[targetName] as number) > 0)
      .sort((a, b) => a.code.localeCompare(b.code)); // Sort by code to ensure Manufacturing comes before SG&A and items are ordered correctly

    const newComparisonRows = Array.from(allCodes).map(code => {
      const baseItem = baseDataMap.get(code);
      const targetItem = targetDataMap.get(code);
      const name = baseItem?.name || targetItem?.name || 'Unknown';

      const baseAmount = baseItem?.total || 0;
      const targetAmount = targetItem?.total || 0;
      const variance = targetAmount - baseAmount;
      const variancePercent = baseAmount === 0 ? 0 : (variance / baseAmount) * 100;

      const accountingType = selectedDept === 'by_dept'
        ? '전체'
        : getAccountingType(code, name);

      const accountClass = selectedDept === 'by_dept'
        ? '부서'
        : classifyAccount(code, name);

      const status =
        baseAmount === 0 && targetAmount > 0 ? '신규' :
        baseAmount > 0 && targetAmount === 0 ? '사라짐' :
        variance > 0 ? '증가' :
        variance < 0 ? '감소' :
        '동일';

      return {
        key: code,
        accountingType,
        accountClass,
        accountCode: selectedDept === 'by_dept' ? '' : code,
        accountName: name,
        deptName: selectedDept === 'by_dept' ? name : '',
        baseAmount,
        targetAmount,
        variance,
        variancePercent,
        status,
      };
    })
    .filter(row => row.baseAmount !== 0 || row.targetAmount !== 0)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    setComparisonRows(newComparisonRows);

    // If no data is found in localStorage, fallback to some mock data for demonstration
    if (newChartData.length === 0) {
      const MOCK_DATA = [
        { code: 'A1', name: '복리후생비', actual2025: 12000000, plan2026: 15000000 },
        { code: 'A2', name: '여비교통비', actual2025: 8500000, plan2026: 8000000 },
        { code: 'A3', name: '소모품비', actual2025: 4200000, plan2026: 4200000 },
        { code: 'A4', name: '통신비', actual2025: 3500000, plan2026: 3800000 },
        { code: 'A5', name: '교육훈련비', actual2025: 5000000, plan2026: 7500000 },
      ];
      const fallbackData = MOCK_DATA.map(item => {
        const baseVal = item.actual2025;
        const targetVal = item.plan2026;
        return {
          code: item.code,
          name: item.name,
          [baseName]: baseVal,
          [targetName]: targetVal,
          variance: targetVal - baseVal,
          variancePercent: ((targetVal - baseVal) / baseVal) * 100
        };
      });
      setChartData(fallbackData);

      const fallbackComparison = MOCK_DATA.map(item => {
        const baseAmount = item.actual2025;
        const targetAmount = item.plan2026;
        const variance = targetAmount - baseAmount;
        const variancePercent = baseAmount === 0 ? 0 : (variance / baseAmount) * 100;
        return {
          key: item.code,
          accountingType: '판관',
          accountClass: item.name,
          accountCode: item.code,
          accountName: item.name,
          deptName: '',
          baseAmount,
          targetAmount,
          variance,
          variancePercent,
          status: variance > 0 ? '증가' : variance < 0 ? '감소' : '동일'
        };
      });
      setComparisonRows(fallbackComparison);
    } else {
      setChartData(newChartData);
    }

    // Calculate details for clicked department drilldown
    let deptDetails: any[] = [];
    if (selectedDept === 'by_dept' && selectedDepartment) {
      const deptBase = getAggregatedData(baseYear, basePlanType, baseMonthMode, baseSelectedMonth, selectedDepartment.departmentCode);
      const deptTarget = getAggregatedData(targetYear, targetPlanType, targetMonthMode, targetSelectedMonth, selectedDepartment.departmentCode);
      
      const deptBaseMap = deptBase.aggregated;
      const deptTargetMap = deptTarget.aggregated;
      
      const deptAllCodes = new Set([...deptBaseMap.keys(), ...deptTargetMap.keys()]);
      deptDetails = Array.from(deptAllCodes).map(code => {
        const baseItem = deptBaseMap.get(code);
        const targetItem = deptTargetMap.get(code);
        const name = baseItem?.name || targetItem?.name || 'Unknown';
        
        const baseAmount = baseItem?.total || 0;
        const targetAmount = targetItem?.total || 0;
        const variance = targetAmount - baseAmount;
        const variancePercent = baseAmount === 0 ? 0 : (variance / baseAmount) * 100;
        
        return {
          accountCode: code,
          accountName: name,
          budgetAmount: baseAmount,
          actualAmount: targetAmount,
          varianceAmount: variance,
          executionRate: baseAmount === 0 ? null : (targetAmount / baseAmount) * 100
        };
      }).filter(row => row.budgetAmount !== 0 || row.actualAmount !== 0)
        .sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount));

      if (deptDetails.length === 0) {
        const FAKE_ACCOUNTS = [
          { code: '5110100', name: '선급비용', b: 50000000, a: 45000000 },
          { code: '5110200', name: '정보기술비용', b: 0, a: 12500000 },
          { code: '5110300', name: '지급임차료', b: 120000000, a: 120000000 },
          { code: '5110400', name: '복리후생비_기타', b: 15000000, a: 18500000 },
          { code: '5110500', name: '교육훈련비', b: 20000000, a: 11000000 },
          { code: '5110600', name: '도서인쇄비', b: 3000000, a: 2100000 },
        ];
        deptDetails = FAKE_ACCOUNTS.map(item => {
          const varAmt = item.a - item.b;
          return {
            accountCode: item.code,
            accountName: item.name,
            budgetAmount: item.b,
            actualAmount: item.a,
            varianceAmount: varAmt,
            executionRate: item.b === 0 ? null : (item.a / item.b) * 100
          };
        });
      }
    }
    setSelectedDeptDetails(deptDetails);

  }, [baseYear, basePlanType, baseMonthMode, baseSelectedMonth, targetYear, targetPlanType, targetMonthMode, targetSelectedMonth, baseName, targetName, selectedDept, selectedAccountingType, selectedAccountClass, currentUser, selectedDepartment]);

  const totalBase = chartData.reduce((sum, item) => sum + item[baseName], 0);
  const totalTarget = chartData.reduce((sum, item) => sum + item[targetName], 0);
  const totalVariance = totalTarget - totalBase;
  const totalVariancePercent = totalBase === 0 ? 0 : (totalVariance / totalBase) * 100;

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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-lithium-200 overflow-hidden z-20">
                <button
                  onClick={() => {
                    setShowDownloadMenu(false);
                    if (selectedDept === 'by_dept') {
                      const defaultDeptCodes = getReportAvailableDeptCodes();
                      setSelectedReportDeptCodes(defaultDeptCodes);
                      setIncludeAllReportDepts(true);
                      setIsReportModalOpen(true);
                    } else {
                      handleDownloadExcel();
                    }
                  }}
                  className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex items-center gap-3"
                >
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  Excel 다운로드
                </button>
                <button
                  onClick={() => { setShowDownloadMenu(false); handleDownloadPPT(); }}
                  className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex items-center gap-3 border-t border-lithium-100"
                >
                  <Presentation className="w-5 h-5 text-cobalt-600" />
                  PPT 다운로드
                </button>
                <button
                  onClick={() => { setShowDownloadMenu(false); handleDownloadPDF(); }}
                  className="w-full text-left px-5 py-4 text-sm font-medium text-eco-black hover:bg-lithium-50 transition-colors flex items-center gap-3 border-t border-lithium-100"
                >
                  <FileText className="w-5 h-5 text-red-500" />
                  PDF 다운로드
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
                {totalVariance > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Detail Table */}
      <div className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-lithium-200 bg-lithium-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-eco-black tracking-tight">
              {selectedDept === 'by_dept' ? '부서별 상세 비교 내역' : '계정별 상세 비교 내역'}
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              기준금액과 비교금액의 차이를 계정(부서) 단위로 확인합니다. 단위: 백만원
            </p>
          </div>
          <span className="text-xs font-bold text-text-secondary">
            {comparisonRows.length.toLocaleString()}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-lithium-100/50 border-b border-lithium-200">
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">비용 성격</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">회계 구분</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">{selectedDept === 'by_dept' ? '부서코드' : '계정코드'}</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">{selectedDept === 'by_dept' ? '부서명' : '계정명'}</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">기준 금액</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">비교 금액</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">차액</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-right">증감률</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lithium-100">
              {comparisonRows.length === 0 ? (
                <tr>
                   <td colSpan={9} className="px-6 py-12 text-center text-sm text-text-secondary">
                    선택한 조건에 해당하는 상세 비교 데이터가 없습니다. 기준/비교 조건, 부서, 회계 구분, 비용 성격 필터를 확인해주세요.
                  </td>
                </tr>
              ) : (
                comparisonRows.map(row => {
                  const isDrilldown = selectedDept === 'by_dept';
                  const isSelected = isDrilldown && selectedDepartment?.departmentCode === row.key;
                  
                  return (
                    <tr 
                      key={row.key} 
                      onClick={() => {
                        if (isDrilldown) {
                          setSelectedDepartment(prev => 
                            prev?.departmentCode === row.key 
                              ? null 
                              : { departmentCode: row.key, departmentName: row.accountName }
                          );
                        }
                      }}
                      className={`transition-colors duration-150 ${
                        isDrilldown ? 'cursor-pointer select-none' : ''
                      } ${
                        isSelected 
                          ? 'bg-cobalt-50/70 text-cobalt-950 font-medium' 
                          : 'hover:bg-lithium-50/80'
                      }`}
                    >
                      <td className="px-5 py-3 text-sm font-bold text-eco-black">{row.accountClass}</td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{row.accountingType}</td>
                      <td className="px-5 py-3 text-xs font-mono text-text-tertiary">
                        {isDrilldown ? row.key : (row.accountCode || '-')}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-eco-black">
                        <div className="flex items-center gap-2">
                          <span>{row.accountName}</span>
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
                      <td className="px-5 py-3 text-sm text-right">{formatCurrency(toMillions(row.baseAmount))}</td>
                      <td className="px-5 py-3 text-sm text-right font-bold text-eco-black">{formatCurrency(toMillions(row.targetAmount))}</td>
                      <td className={`px-5 py-3 text-sm text-right font-black ${isSelected ? 'text-cobalt-700' : row.variance > 0 ? 'text-cobalt-600' : row.variance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                        {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                      </td>
                      <td className={`px-5 py-3 text-sm text-right font-black ${isSelected ? 'text-cobalt-600' : row.variancePercent > 0 ? 'text-cobalt-500' : row.variancePercent < 0 ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                        {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="px-2 py-1 rounded-lg bg-lithium-100 text-text-secondary text-xs font-bold inline-block">
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
                <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-eco-black tracking-tight text-right">제조 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-secondary text-right">{formatCurrency(toMillions(summaryTotals.baseMfg))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-eco-black text-right">{formatCurrency(toMillions(summaryTotals.targetMfg))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? 'text-cobalt-600' : summaryTotals.targetMfg - summaryTotals.baseMfg < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetMfg - summaryTotals.baseMfg))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.baseMfg === 0 ? 'text-text-tertiary' : (summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg > 0 ? 'text-cobalt-500' : (summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg < 0 ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {summaryTotals.baseMfg === 0 ? '0.0%' : `${(summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg > 0 ? '+' : ''}${(((summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg) * 100).toFixed(1)}%`}
                </td>
                <td></td>
              </tr>
              <tr className="border-b border-lithium-100">
                <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-eco-black tracking-tight text-right">판관 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-secondary text-right">{formatCurrency(toMillions(summaryTotals.baseSga))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-eco-black text-right">{formatCurrency(toMillions(summaryTotals.targetSga))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.targetSga - summaryTotals.baseSga > 0 ? 'text-cobalt-600' : summaryTotals.targetSga - summaryTotals.baseSga < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {summaryTotals.targetSga - summaryTotals.baseSga > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetSga - summaryTotals.baseSga))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-black text-right ${summaryTotals.baseSga === 0 ? 'text-text-tertiary' : (summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga > 0 ? 'text-cobalt-500' : (summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga < 0 ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {summaryTotals.baseSga === 0 ? '0.0%' : `${(summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga > 0 ? '+' : ''}${(((summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga) * 100).toFixed(1)}%`}
                </td>
                <td></td>
              </tr>
              <tr className="bg-lithium-100">
                <td colSpan={4} className="px-6 py-5 whitespace-nowrap text-base font-black text-eco-black uppercase tracking-tight text-right">총 합계</td>
                <td className="px-6 py-5 whitespace-nowrap text-base font-bold text-text-secondary text-right">{formatCurrency(toMillions(totalBase))}</td>
                <td className="px-6 py-5 whitespace-nowrap text-base font-black text-eco-black text-right">{formatCurrency(toMillions(totalTarget))}</td>
                <td className={`px-6 py-5 whitespace-nowrap text-base font-black text-right ${totalVariance > 0 ? 'text-cobalt-600' : totalVariance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                  {totalVariance > 0 ? '+' : ''}{formatCurrency(toMillions(totalVariance))}
                </td>
                <td className={`px-6 py-5 whitespace-nowrap text-base font-black text-right ${totalVariancePercent > 0 ? 'text-cobalt-500' : totalVariancePercent < 0 ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                  {totalVariancePercent > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
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

      {/* Chart */}
      <div className="w-full min-w-0">
        <ChartCard
          title={selectedDept === 'by_dept' ? '부서별 예산·실적 비교' : '계정별 예산·실적 비교'}
          isEmpty={chartData.length === 0}
          contentClassName="min-h-[360px] w-full min-w-0 block"
        >
          <div className="w-full min-w-[320px] h-[320px]">
            <ResponsiveContainer width="100%" height={320} debounce={50}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8b95a1', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b95a1', fontSize: 11 }} tickFormatter={(value) => `${new Intl.NumberFormat('ko-KR').format(Math.round(value / 1000000))}`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #dde5de', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${new Intl.NumberFormat('ko-KR').format(Math.round(value / 1000000))}백만원 (${formatCurrency(value)}원)`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey={baseName} fill="#e5e8eb" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey={targetName} fill="var(--nickel-500)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
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
                      } else {
                        setSelectedReportDeptCodes([]);
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
                              } else {
                                setIncludeAllReportDepts(false);
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
                <div className="grid grid-cols-2 gap-4">
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
                disabled={includeDetailSheets && selectedReportDeptCodes.length === 0}
                onClick={() => {
                  if (!includeSummarySheet && !includeDetailSheets) {
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
                  includeDetailSheets && selectedReportDeptCodes.length === 0
                    ? 'bg-lithium-300 cursor-not-allowed shadow-none'
                    : 'bg-cobalt-600 hover:bg-cobalt-700 active:scale-95'
                }`}
              >
                {includeDetailSheets && selectedReportDeptCodes.length === 0 
                  ? '부서를 선택해 주세요' 
                  : !includeSummarySheet && !includeDetailSheets
                  ? '포함 항목을 선택해 주세요'
                  : includeAllReportDepts || selectedReportDeptCodes.length === getReportAvailableDeptCodes().length
                  ? '전체 부서 다운로드'
                  : `선택 부서 ${selectedReportDeptCodes.length}개 다운로드`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
