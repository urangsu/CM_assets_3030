import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, Minus, Download, FileSpreadsheet, Presentation, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  }, [tab, currentUser]);

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
  const [categories, setCategories] = useState<any[]>(INITIAL_CATEGORIES);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
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
    const getAggregatedData = (year: string, planType: string, periodMode: MonthMode, periodSelectedMonth: number) => {
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
            if (selectedDept === 'mfg' && accType !== '제조') return;
            if (selectedDept === 'sga' && accType !== '판관') return;
            if (selectedDept === 'viewable') {
              if (!viewableDeptCodes.has(effectiveDeptCode)) return;
            } else if (selectedDept !== 'all' && selectedDept !== 'by_dept' && selectedDept !== 'mfg' && selectedDept !== 'sga' && effectiveDeptCode !== selectedDept) {
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
            const code = selectedDept === 'by_dept' ? item.deptCode : item.accountCode;
            const name = selectedDept === 'by_dept' ? (allDepts.find(d => d.code === item.deptCode)?.name || item.deptCode) : item.accountName;
            
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

              if (selectedDept === 'mfg' && accType !== '제조') return;
              if (selectedDept === 'sga' && accType !== '판관') return;
              if (selectedDept === 'viewable') {
                if (!viewableDeptCodes.has(rowDeptCode)) return;
              } else if (selectedDept !== 'all' && selectedDept !== 'by_dept' && selectedDept !== 'mfg' && selectedDept !== 'sga' && rowDeptCode !== selectedDept) {
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
          const code = selectedDept === 'by_dept' ? item.deptCode : item.accountCode;
          const name = selectedDept === 'by_dept' ? (allDepts.find(d => d.code === item.deptCode)?.name || item.deptCode) : item.accountName;
          
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

  }, [baseYear, basePlanType, baseMonthMode, baseSelectedMonth, targetYear, targetPlanType, targetMonthMode, targetSelectedMonth, baseName, targetName, selectedDept, selectedAccountingType, selectedAccountClass, currentUser]);

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
                  onClick={() => { setShowDownloadMenu(false); handleDownloadExcel(); }}
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
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정코드</th>
                <th className="px-5 py-3 text-xs font-bold text-text-secondary">계정명</th>
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
                comparisonRows.map(row => (
                  <tr key={row.key} className="hover:bg-lithium-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-bold text-eco-black">{row.accountClass}</td>
                    <td className="px-5 py-3 text-sm text-text-secondary">{row.accountingType}</td>
                    <td className="px-5 py-3 text-xs font-mono text-text-tertiary">{row.accountCode || '-'}</td>
                    <td className="px-5 py-3 text-sm font-medium text-eco-black">{row.accountName}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(toMillions(row.baseAmount))}</td>
                    <td className="px-5 py-3 text-sm text-right font-bold text-eco-black">{formatCurrency(toMillions(row.targetAmount))}</td>
                    <td className={`px-5 py-3 text-sm text-right font-black ${row.variance > 0 ? 'text-cobalt-600' : row.variance < 0 ? 'text-nickel-600' : 'text-text-tertiary'}`}>
                      {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                    </td>
                    <td className={`px-5 py-3 text-sm text-right font-black ${row.variancePercent > 0 ? 'text-cobalt-500' : row.variancePercent < 0 ? 'text-nickel-500' : 'text-text-tertiary'}`}>
                      {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-sm text-center">
                      <span className="px-2 py-1 rounded-lg bg-lithium-100 text-text-secondary text-xs font-bold inline-block">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
