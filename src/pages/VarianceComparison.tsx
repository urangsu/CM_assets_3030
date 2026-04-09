import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus as MinusIcon, Plus, Minus, Download, FileSpreadsheet, Presentation, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { INITIAL_CATEGORIES } from './AccountSelection';

export default function VarianceComparison() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const getUserInitDept = () => {
    const savedUserStr = localStorage.getItem('current_user');
    if (savedUserStr) {
      const user = JSON.parse(savedUserStr);
      if (user.code === '99999' || user.code === '32100') return 'all';
      const viewable = getViewableDepts(user.code);
      return viewable.length > 0 ? viewable[0].code : user.code; // 자신의 첫 번째 소속 부서 기본값
    }
    return 'all';
  };

  const [baseYear, setBaseYear] = useState(() => localStorage.getItem('variance_baseYear') || '2026');
  const [basePlanType, setBasePlanType] = useState(() => localStorage.getItem('variance_basePlanType') || '경영계획');
  const [baseMonth, setBaseMonth] = useState(() => localStorage.getItem('variance_baseMonth') || 'all');
  
  const [targetYear, setTargetYear] = useState(() => localStorage.getItem('variance_targetYear') || '2026');
  const [targetPlanType, setTargetPlanType] = useState(() => localStorage.getItem('variance_targetPlanType') || '실적');
  const [targetMonth, setTargetMonth] = useState(() => localStorage.getItem('variance_targetMonth') || 'all');
  
  const [selectedDept, setSelectedDept] = useState(() => localStorage.getItem('variance_dept') || getUserInitDept());
  const [selectedAccountCategory, setSelectedAccountCategory] = useState(() => localStorage.getItem('variance_accountCategory') || 'all');

  // Persist filters
  useEffect(() => {
    localStorage.setItem('variance_baseYear', baseYear);
    localStorage.setItem('variance_basePlanType', basePlanType);
    localStorage.setItem('variance_baseMonth', baseMonth);
    localStorage.setItem('variance_targetYear', targetYear);
    localStorage.setItem('variance_targetPlanType', targetPlanType);
    localStorage.setItem('variance_targetMonth', targetMonth);
    localStorage.setItem('variance_dept', selectedDept);
    localStorage.setItem('variance_accountCategory', selectedAccountCategory);
  }, [baseYear, basePlanType, baseMonth, targetYear, targetPlanType, targetMonth, selectedDept, selectedAccountCategory]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(INITIAL_CATEGORIES);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [summaryTotals, setSummaryTotals] = useState({
    baseMfg: 0,
    baseSga: 0,
    targetMfg: 0,
    targetSga: 0
  });

  const baseName = `${baseYear} ${basePlanType} ${baseMonth === 'all' ? '(전체)' : baseMonth.includes('Q') ? `(${baseMonth})` : `(${baseMonth}월)`}`;
  const targetName = `${targetYear} ${targetPlanType} ${targetMonth === 'all' ? '(전체)' : targetMonth.includes('Q') ? `(${targetMonth})` : `(${targetMonth}월)`}`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
  };

  const toMillions = (val: number) => Math.round(val / 1000000);

  const allDepts = getAllDepartments();
  const viewableDepts = currentUser ? getViewableDepts(currentUser.code) : [];

  const getDeptName = () => {
    if (selectedDept === 'all') return '전체부서';
    if (selectedDept === 'viewable') return '조회 가능 부서';
    if (selectedDept === 'by_dept') return '부서별';
    if (selectedDept === 'mfg') return '제조_전체부서';
    if (selectedDept === 'sga') return '판관_전체부서';
    return allDepts.find(d => d.code === selectedDept)?.name || selectedDept;
  };

  const formatPeriodForFilename = (period: string) => {
    if (period === 'all') return '전체';
    if (period.includes('Q')) return period;
    return `${period}월`;
  };

  const getDownloadFileName = (ext: string) => {
    const baseStr = `${baseYear}_${basePlanType}_${formatPeriodForFilename(baseMonth)}`;
    const targetStr = `${targetYear}_${targetPlanType}_${formatPeriodForFilename(targetMonth)}`;
    const deptStr = getDeptName();
    return `${baseStr}vs${targetStr}_${deptStr}.${ext}`;
  };

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const excelData: any[] = [];
    
    if (selectedDept === 'by_dept') {
      excelData.push([
        '부서명',
        baseName,
        targetName,
        '차액',
        '증감률(%)'
      ]);
      chartData.forEach(row => {
        excelData.push([
          row.name,
          row[baseName],
          row[targetName],
          row.variance,
          typeof row.variancePercent === 'number' ? row.variancePercent.toFixed(2) + '%' : row.variancePercent
        ]);
      });
    } else {
      excelData.push([
        '계정코드',
        '계정명',
        baseName,
        targetName,
        '차액',
        '증감률(%)'
      ]);

      const accountsMap = new Map();
      categories.forEach(cat => {
        cat.accounts.forEach((acc: any) => {
          accountsMap.set(acc.code, cat.name);
        });
      });

      const groupedData = new Map<string, any[]>();
      const categoryTotals = new Map<string, any>();

      chartData.forEach(row => {
        const catName = accountsMap.get(row.code) || '기타';
        if (!groupedData.has(catName)) {
          groupedData.set(catName, []);
          categoryTotals.set(catName, {
            name: catName,
            [baseName]: 0,
            [targetName]: 0,
            variance: 0,
          });
        }
        groupedData.get(catName)!.push(row);
        
        const totals = categoryTotals.get(catName)!;
        totals[baseName] += row[baseName];
        totals[targetName] += row[targetName];
        totals.variance += row.variance;
      });

      categoryTotals.forEach(totals => {
        totals.variancePercent = totals[baseName] === 0 ? 0 : (totals.variance / totals[baseName]) * 100;
      });

      Array.from(groupedData.entries()).forEach(([catName, rows]) => {
        const totals = categoryTotals.get(catName)!;
        excelData.push([
          '',
          `[${catName} 합계]`,
          totals[baseName],
          totals[targetName],
          totals.variance,
          typeof totals.variancePercent === 'number' ? totals.variancePercent.toFixed(2) + '%' : totals.variancePercent
        ]);
        rows.forEach(row => {
          excelData.push([
            row.code,
            `  ${row.name}`,
            row[baseName],
            row[targetName],
            row.variance,
            typeof row.variancePercent === 'number' ? row.variancePercent.toFixed(2) + '%' : row.variancePercent
          ]);
        });
      });
    }

    // Requirement 1: Add summary totals (Mfg, SGA, Total) to the end of Excel
    const mfgVar = summaryTotals.targetMfg - summaryTotals.baseMfg;
    const mfgVarPct = summaryTotals.baseMfg === 0 ? 0 : (mfgVar / summaryTotals.baseMfg) * 100;
    
    const sgaVar = summaryTotals.targetSga - summaryTotals.baseSga;
    const sgaVarPct = summaryTotals.baseSga === 0 ? 0 : (sgaVar / summaryTotals.baseSga) * 100;
    
    const totalVar = totalTarget - totalBase;
    const totalVarPct = totalBase === 0 ? 0 : (totalVar / totalBase) * 100;

    excelData.push([]); // Empty row for spacing
    
    if (selectedDept === 'by_dept') {
      excelData.push(['제조 합계', summaryTotals.baseMfg, summaryTotals.targetMfg, mfgVar, mfgVarPct.toFixed(2) + '%']);
      excelData.push(['판관 합계', summaryTotals.baseSga, summaryTotals.targetSga, sgaVar, sgaVarPct.toFixed(2) + '%']);
      excelData.push(['총 합계', totalBase, totalTarget, totalVar, totalVarPct.toFixed(2) + '%']);
    } else {
      excelData.push(['', '제조 합계', summaryTotals.baseMfg, summaryTotals.targetMfg, mfgVar, mfgVarPct.toFixed(2) + '%']);
      excelData.push(['', '판관 합계', summaryTotals.baseSga, summaryTotals.targetSga, sgaVar, sgaVarPct.toFixed(2) + '%']);
      excelData.push(['', '총 합계', totalBase, totalTarget, totalVar, totalVarPct.toFixed(2) + '%']);
    }

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Apply number formatting with comma
    Object.keys(ws).forEach(key => {
      if (key[0] === '!') return;
      if (ws[key].t === 'n') {
        ws[key].z = '#,##0';
      }
    });
    
    if (selectedDept === 'by_dept') {
      ws['!cols'] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 }
      ];
    } else {
      ws['!cols'] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 }
      ];
    }

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
    
    const totalBase = chartData.reduce((sum, item) => sum + item[baseName], 0);
    const totalTarget = chartData.reduce((sum, item) => sum + item[targetName], 0);
    const totalVariance = totalTarget - totalBase;
    const totalVariancePercent = totalBase === 0 ? 0 : (totalVariance / totalBase) * 100;

    slide2.addText(`${baseName} 총액: ${formatCurrency(totalBase)}원`, { x: 0.5, y: 1.5, w: '90%', h: 0.5, fontSize: 18 });
    slide2.addText(`${targetName} 총액: ${formatCurrency(totalTarget)}원`, { x: 0.5, y: 2.2, w: '90%', h: 0.5, fontSize: 18 });
    
    const varianceText = `${totalVariance > 0 ? '+' : ''}${formatCurrency(totalVariance)}원 (${totalVariance > 0 ? '+' : ''}${totalVariancePercent.toFixed(1)}%)`;
    slide2.addText(`증감액: ${varianceText}`, { x: 0.5, y: 2.9, w: '90%', h: 0.5, fontSize: 18, bold: true, color: totalVariance > 0 ? 'FF0000' : '0000FF' });

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

      const accountsMap = new Map();
      categories.forEach(cat => {
        cat.accounts.forEach((acc: any) => {
          accountsMap.set(acc.code, cat.name);
        });
      });

      const groupedData = new Map<string, any[]>();
      const categoryTotals = new Map<string, any>();

      chartData.forEach(row => {
        const catName = accountsMap.get(row.code) || '기타';
        if (!groupedData.has(catName)) {
          groupedData.set(catName, []);
          categoryTotals.set(catName, {
            name: catName,
            [baseName]: 0,
            [targetName]: 0,
            variance: 0,
          });
        }
        groupedData.get(catName)!.push(row);
        
        const totals = categoryTotals.get(catName)!;
        totals[baseName] += row[baseName];
        totals[targetName] += row[targetName];
        totals.variance += row.variance;
      });

      categoryTotals.forEach(totals => {
        totals.variancePercent = totals[baseName] === 0 ? 0 : (totals.variance / totals[baseName]) * 100;
      });

      Array.from(groupedData.entries()).forEach(([catName, rows]) => {
        const totals = categoryTotals.get(catName)!;
        tableRows.push([
          '',
          `[${totals.name}]`,
          formatCurrency(totals[baseName]),
          formatCurrency(totals[targetName]),
          `${totals.variance > 0 ? '+' : ''}${formatCurrency(totals.variance)}`,
          `${totals.variancePercent > 0 ? '+' : ''}${totals.variancePercent.toFixed(1)}%`
        ]);
        rows.forEach(row => {
          tableRows.push([
            row.code,
            `  ${row.name}`,
            formatCurrency(row[baseName]),
            formatCurrency(row[targetName]),
            `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
            `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
          ]);
        });
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

    const totalBase = chartData.reduce((sum, item) => sum + item[baseName], 0);
    const totalTarget = chartData.reduce((sum, item) => sum + item[targetName], 0);
    const totalVariance = totalTarget - totalBase;
    const totalVariancePercent = totalBase === 0 ? 0 : (totalVariance / totalBase) * 100;

    doc.text(`총액 요약:`, 14, 42);
    doc.text(`- ${baseName} 총액: ${formatCurrency(totalBase)}원`, 14, 48);
    doc.text(`- ${targetName} 총액: ${formatCurrency(totalTarget)}원`, 14, 54);
    const varianceText = `${totalVariance > 0 ? '+' : ''}${formatCurrency(totalVariance)}원 (${totalVariance > 0 ? '+' : ''}${totalVariancePercent.toFixed(1)}%)`;
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
      
      const accountsMap = new Map();
      categories.forEach(cat => {
        cat.accounts.forEach((acc: any) => {
          accountsMap.set(acc.code, cat.name);
        });
      });

      const groupedData = new Map<string, any[]>();
      const categoryTotals = new Map<string, any>();

      chartData.forEach(row => {
        const catName = accountsMap.get(row.code) || '기타';
        if (!groupedData.has(catName)) {
          groupedData.set(catName, []);
          categoryTotals.set(catName, {
            name: catName,
            [baseName]: 0,
            [targetName]: 0,
            variance: 0,
          });
        }
        groupedData.get(catName)!.push(row);
        
        const totals = categoryTotals.get(catName)!;
        totals[baseName] += row[baseName];
        totals[targetName] += row[targetName];
        totals.variance += row.variance;
      });

      categoryTotals.forEach(totals => {
        totals.variancePercent = totals[baseName] === 0 ? 0 : (totals.variance / totals[baseName]) * 100;
      });

      Array.from(groupedData.entries()).forEach(([catName, rows]) => {
        const totals = categoryTotals.get(catName)!;
        body.push([
          '',
          `[${totals.name} 합계]`,
          formatCurrency(totals[baseName]),
          formatCurrency(totals[targetName]),
          `${totals.variance > 0 ? '+' : ''}${formatCurrency(totals.variance)}`,
          `${totals.variancePercent > 0 ? '+' : ''}${totals.variancePercent.toFixed(1)}%`
        ]);
        rows.forEach(row => {
          body.push([
            row.code,
            `  ${row.name}`,
            formatCurrency(row[baseName]),
            formatCurrency(row[targetName]),
            `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`,
            `${row.variancePercent > 0 ? '+' : ''}${row.variancePercent.toFixed(1)}%`
          ]);
        });
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
    const getAggregatedData = (year: string, planType: string, period: string) => {
      const aggregated = new Map<string, { name: string, total: number }>();
      let mfgTotal = 0;
      let sgaTotal = 0;

      const viewableDeptCodes = new Set(viewableDepts.map(d => d.code));

      const accountCategoryMap = new Map<string, string>();
      const accountToCategoryNameMap = new Map<string, string>();
      categories.forEach(cat => {
        const type = cat.name.startsWith('제조') ? '제조' : cat.name.startsWith('판관') ? '판관' : '기타';
        cat.accounts.forEach((acc: any) => {
          accountCategoryMap.set(acc.code, type);
          accountToCategoryNameMap.set(acc.code, cat.name);
        });
      });

      const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      const userSetting = currentUser ? settings[currentUser.code] : null;
      const hasSalaryAccess = (currentUser?.code === '99999' || currentUser?.code === '32100') || (userSetting?.hasSalaryAccess ?? false);
      
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
            const key = `${STORAGE_KEYS.BUDGET_DATA}_${d.code}_${year}_실적`;
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
            let itemMonth = -1;
            const periodStr = String(item.period || '').trim();
            const matchMonth = periodStr.match(/(\d{1,2})월?$/) || periodStr.match(/[-./](\d{1,2})$/);
            if (matchMonth) {
              itemMonth = parseInt(matchMonth[1], 10);
            } else if (!isNaN(parseInt(periodStr, 10))) {
              itemMonth = parseInt(periodStr, 10);
            }

            if (itemMonth === -1) return;

            let match = false;
            if (period === 'all') match = true;
            else if (period === '1Q') match = itemMonth >= 1 && itemMonth <= 3;
            else if (period === '2Q') match = itemMonth >= 4 && itemMonth <= 6;
            else if (period === '3Q') match = itemMonth >= 7 && itemMonth <= 9;
            else if (period === '4Q') match = itemMonth >= 10 && itemMonth <= 12;
            else match = itemMonth === parseInt(period, 10);

            if (match) {
              const catName = accountToCategoryNameMap.get(item.accountCode);
              
              // Salary access check
              if (!hasSalaryAccess) {
                if (catName && SALARY_CATEGORIES.includes(catName)) return;
                if (salaryAccountCodes.has(item.accountCode)) return;
              }

              if (selectedAccountCategory !== 'all') {
                if (catName !== selectedAccountCategory) return;
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
                  accountName: item.accountName, 
                  amount 
                });
              }
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
          const savedDataStr = localStorage.getItem(`${STORAGE_KEYS.BUDGET_DATA}_${dept.code}_${year}_${planType}`);
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

              if (selectedAccountCategory !== 'all') {
                if (catName !== selectedAccountCategory) return;
              }

              let amount = 0;
              if (period === 'all') amount = row.values.reduce((sum: number, val: number) => sum + val, 0);
              else if (period === '1Q') amount = row.values.slice(0, 3).reduce((sum: number, val: number) => sum + val, 0);
              else if (period === '2Q') amount = row.values.slice(3, 6).reduce((sum: number, val: number) => sum + val, 0);
              else if (period === '3Q') amount = row.values.slice(6, 9).reduce((sum: number, val: number) => sum + val, 0);
              else if (period === '4Q') amount = row.values.slice(9, 12).reduce((sum: number, val: number) => sum + val, 0);
              else amount = row.values[parseInt(period, 10) - 1] || 0;

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
                  accountName: row.name, 
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

    const baseData = getAggregatedData(baseYear, basePlanType, baseMonth);
    const targetData = getAggregatedData(targetYear, targetPlanType, targetMonth);

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
    } else {
      setChartData(newChartData);
    }

  }, [baseYear, basePlanType, baseMonth, targetYear, targetPlanType, targetMonth, baseName, targetName, selectedDept, selectedAccountCategory, currentUser]);

  const totalBase = chartData.reduce((sum, item) => sum + item[baseName], 0);
  const totalTarget = chartData.reduce((sum, item) => sum + item[targetName], 0);
  const totalVariance = totalTarget - totalBase;
  const totalVariancePercent = totalBase === 0 ? 0 : (totalVariance / totalBase) * 100;

  const PERIOD_OPTIONS = [
    { value: 'all', label: '전체 (누적)' },
    { value: '1Q', label: '1Q (1~3월)' },
    { value: '2Q', label: '2Q (4~6월)' },
    { value: '3Q', label: '3Q (7~9월)' },
    { value: '4Q', label: '4Q (10~12월)' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` }))
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-[#e5e8eb] shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex gap-2 items-center">
            <span className="text-sm font-bold text-[#4e5968] w-10">기준</span>
            <select 
              value={baseYear} 
              onChange={(e) => setBaseYear(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              <option value="2024">2024년</option>
              <option value="2025">2025년</option>
              <option value="2026">2026년</option>
              <option value="2027">2027년</option>
            </select>
            <select 
              value={basePlanType} 
              onChange={(e) => setBasePlanType(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              <option value="실적">실적</option>
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
            <select 
              value={baseMonth} 
              onChange={(e) => setBaseMonth(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="text-[#8b95a1] font-bold">VS</div>
          <div className="flex-1 flex gap-2 items-center">
            <span className="text-sm font-bold text-[#4e5968] w-10">비교</span>
            <select 
              value={targetYear} 
              onChange={(e) => setTargetYear(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              <option value="2024">2024년</option>
              <option value="2025">2025년</option>
              <option value="2026">2026년</option>
              <option value="2027">2027년</option>
            </select>
            <select 
              value={targetPlanType} 
              onChange={(e) => setTargetPlanType(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              <option value="실적">실적</option>
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
            <select 
              value={targetMonth} 
              onChange={(e) => setTargetMonth(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-4 border-t border-[#e5e8eb]">
          <div className="flex-1 flex gap-2 items-center">
            <span className="text-sm font-bold text-[#4e5968] w-10">부서</span>
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none w-40"
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
            
            <span className="text-sm font-bold text-[#4e5968] w-10 ml-4">계정</span>
            <select 
              value={selectedAccountCategory} 
              onChange={(e) => setSelectedAccountCategory(e.target.value)}
              className="bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2 font-medium appearance-none flex-1"
            >
              <option value="all">전체 계정</option>
              {INITIAL_CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="relative download-menu-container">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-[#f2f4f6] text-[#4e5968] rounded-xl font-bold text-sm hover:bg-[#e5e8eb] transition-colors"
            >
              <Download className="w-4 h-4" />
              다운로드
            </button>
            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-[#e5e8eb] overflow-hidden z-10">
                <button
                  onClick={() => { setShowDownloadMenu(false); handleDownloadExcel(); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-[#191f28] hover:bg-[#f2f4f6] transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Excel 다운로드
                </button>
                <button
                  onClick={() => { setShowDownloadMenu(false); handleDownloadPPT(); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-[#191f28] hover:bg-[#f2f4f6] transition-colors flex items-center gap-2 border-t border-[#e5e8eb]"
                >
                  <Presentation className="w-4 h-4 text-orange-500" />
                  PPT 다운로드
                </button>
                <button
                  onClick={() => { setShowDownloadMenu(false); handleDownloadPDF(); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-[#191f28] hover:bg-[#f2f4f6] transition-colors flex items-center gap-2 border-t border-[#e5e8eb]"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  PDF 다운로드
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm">
          <p className="text-sm font-medium text-[#4e5968]">{baseName} 총액</p>
          <p className="text-3xl font-bold text-[#191f28] mt-2 text-right">{formatCurrency(toMillions(totalBase))} 백만원</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm">
          <p className="text-sm font-medium text-[#4e5968]">{targetName} 총액</p>
          <p className="text-3xl font-bold text-[#191f28] mt-2 text-right">{formatCurrency(toMillions(totalTarget))} 백만원</p>
        </div>
        <div className={`p-6 rounded-2xl border shadow-sm ${totalVariance > 0 ? 'bg-red-50 border-red-100' : totalVariance < 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-sm font-medium text-[#4e5968]">증감액</p>
          <div className="flex items-center justify-between mt-2">
            {totalVariance > 0 ? (
              <TrendingUp className="w-8 h-8 text-red-500 mr-2" />
            ) : totalVariance < 0 ? (
              <TrendingDown className="w-8 h-8 text-blue-500 mr-2" />
            ) : (
              <Minus className="w-8 h-8 text-gray-500 mr-2" />
            )}
            <div className="text-right">
              <p className={`text-3xl font-bold ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-blue-600' : 'text-gray-700'}`}>
                {totalVariance > 0 ? '+' : ''}{formatCurrency(toMillions(totalVariance))} 백만원
              </p>
              <p className={`text-sm font-bold ${totalVariance > 0 ? 'text-red-500' : totalVariance < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                {totalVariance > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm">
        <h3 className="text-lg font-bold text-[#191f28] mb-6">계정별 예산 비교</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e8eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4e5968', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b95a1', fontSize: 12 }} tickFormatter={(value) => `${new Intl.NumberFormat('ko-KR').format(Math.round(value / 1000000))}백만`} />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                formatter={(value: number) => [`${formatCurrency(value)}원`, '']}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey={baseName} fill="#d1d6db" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey={targetName} fill="var(--brand-500)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-[#e5e8eb] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e5e8eb] bg-[#f9fafb] flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#191f28]">상세 비교 데이터</h3>
          {selectedDept !== 'by_dept' && (
            <div className="flex gap-2">
              <button
                onClick={() => setCollapsedCategories(new Set())}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-[#e5e8eb] text-[#4e5968] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                전체 펼치기
              </button>
              <button
                onClick={() => setCollapsedCategories(new Set(categories.map(c => c.name).concat(['기타'])))}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-[#e5e8eb] text-[#4e5968] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                전체 접기
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-[#e5e8eb]">
                {selectedDept !== 'by_dept' && (
                  <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider w-[10%]">계정코드</th>
                )}
                <th className={`px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider ${selectedDept !== 'by_dept' ? 'w-[20%]' : ''}`}>
                  {selectedDept === 'by_dept' ? '부서명' : '계정명'}
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider text-right">{baseName} (백만원)</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider text-right">{targetName} (백만원)</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider text-right">차액 (백만원)</th>
                <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider text-right">증감률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {(() => {
                if (selectedDept === 'by_dept') {
                  return chartData.map((row, idx) => (
                    <tr key={`${row.code}_${idx}`} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#191f28]">{row.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#4e5968] text-right">{formatCurrency(toMillions(row[baseName]))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#191f28] text-right">{formatCurrency(toMillions(row[targetName]))}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${row.variance > 0 ? 'text-red-600' : row.variance < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                        {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${row.variancePercent > 0 ? 'text-red-500' : row.variancePercent < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                        {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                      </td>
                    </tr>
                  ));
                } else {
                  // Group by category
                  const accountsMap = new Map();
                  categories.forEach(cat => {
                    cat.accounts.forEach((acc: any) => {
                      accountsMap.set(acc.code, cat.name);
                    });
                  });

                  const groupedData = new Map<string, any[]>();
                  const categoryTotals = new Map<string, any>();

                  chartData.forEach(row => {
                    const catName = accountsMap.get(row.code) || '기타';
                    if (!groupedData.has(catName)) {
                      groupedData.set(catName, []);
                      categoryTotals.set(catName, {
                        name: catName,
                        [baseName]: 0,
                        [targetName]: 0,
                        variance: 0,
                      });
                    }
                    groupedData.get(catName)!.push(row);
                    
                    const totals = categoryTotals.get(catName)!;
                    totals[baseName] += row[baseName];
                    totals[targetName] += row[targetName];
                    totals.variance += row.variance;
                  });

                  // Calculate variancePercent for totals
                  categoryTotals.forEach(totals => {
                    totals.variancePercent = totals[baseName] === 0 ? 0 : (totals.variance / totals[baseName]) * 100;
                  });

                  return Array.from(groupedData.entries()).map(([catName, rows]) => {
                    const totals = categoryTotals.get(catName)!;
                    const isCollapsed = collapsedCategories.has(catName);

                    return (
                      <React.Fragment key={catName}>
                        <tr className="bg-[#f2f4f6] border-b border-[#e5e8eb] cursor-pointer hover:bg-[#e5e8eb] transition-colors" onClick={() => toggleCategory(catName)}>
                          <td colSpan={2} className="px-6 py-3 whitespace-nowrap text-sm font-bold text-[#191f28]">
                            <div className="flex items-center">
                              {isCollapsed ? <Plus className="w-4 h-4 mr-2 text-[#8b95a1]" /> : <Minus className="w-4 h-4 mr-2 text-[#8b95a1]" />}
                              {catName}
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-[#4e5968] text-right">{formatCurrency(toMillions(totals[baseName]))}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-[#191f28] text-right">{formatCurrency(toMillions(totals[targetName]))}</td>
                          <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-right ${totals.variance > 0 ? 'text-red-600' : totals.variance < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                            {totals.variance > 0 ? '+' : ''}{formatCurrency(toMillions(totals.variance))}
                          </td>
                          <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-right ${totals.variancePercent > 0 ? 'text-red-500' : totals.variancePercent < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                            {totals.variancePercent > 0 ? '+' : ''}{totals.variancePercent.toFixed(1)}%
                          </td>
                        </tr>
                        {!isCollapsed && rows.map((row, idx) => (
                          <tr key={`${row.code}_${catName}_${idx}`} className="hover:bg-[#f9fafb] transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-[#8b95a1]">{row.code}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-[#4e5968]">{row.name}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-[#4e5968] text-right">{formatCurrency(toMillions(row[baseName]))}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-[#191f28] text-right">{formatCurrency(toMillions(row[targetName]))}</td>
                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-right ${row.variance > 0 ? 'text-red-600' : row.variance < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                              {row.variance > 0 ? '+' : ''}{formatCurrency(toMillions(row.variance))}
                            </td>
                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-right ${row.variancePercent > 0 ? 'text-red-500' : row.variancePercent < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                              {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  });
                }
              })()}
            </tbody>
            <tfoot className="bg-[#f9fafb] border-t-2 border-[#d1d6db]">
              <tr className="border-b border-[#e5e8eb]">
                <td colSpan={selectedDept === 'by_dept' ? 1 : 2} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#191f28]">제조 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#4e5968] text-right">{formatCurrency(toMillions(summaryTotals.baseMfg))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#191f28] text-right">{formatCurrency(toMillions(summaryTotals.targetMfg))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? 'text-red-600' : summaryTotals.targetMfg - summaryTotals.baseMfg < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  {summaryTotals.targetMfg - summaryTotals.baseMfg > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetMfg - summaryTotals.baseMfg))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${summaryTotals.baseMfg === 0 ? 'text-gray-400' : (summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg > 0 ? 'text-red-500' : (summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                  {summaryTotals.baseMfg === 0 ? '0.0%' : `${(summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg > 0 ? '+' : ''}${(((summaryTotals.targetMfg - summaryTotals.baseMfg) / summaryTotals.baseMfg) * 100).toFixed(1)}%`}
                </td>
              </tr>
              <tr className="border-b border-[#e5e8eb]">
                <td colSpan={selectedDept === 'by_dept' ? 1 : 2} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#191f28]">판관 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#4e5968] text-right">{formatCurrency(toMillions(summaryTotals.baseSga))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#191f28] text-right">{formatCurrency(toMillions(summaryTotals.targetSga))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${summaryTotals.targetSga - summaryTotals.baseSga > 0 ? 'text-red-600' : summaryTotals.targetSga - summaryTotals.baseSga < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  {summaryTotals.targetSga - summaryTotals.baseSga > 0 ? '+' : ''}{formatCurrency(toMillions(summaryTotals.targetSga - summaryTotals.baseSga))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${summaryTotals.baseSga === 0 ? 'text-gray-400' : (summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga > 0 ? 'text-red-500' : (summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                  {summaryTotals.baseSga === 0 ? '0.0%' : `${(summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga > 0 ? '+' : ''}${(((summaryTotals.targetSga - summaryTotals.baseSga) / summaryTotals.baseSga) * 100).toFixed(1)}%`}
                </td>
              </tr>
              <tr className="bg-[#f2f4f6]">
                <td colSpan={selectedDept === 'by_dept' ? 1 : 2} className="px-6 py-4 whitespace-nowrap text-base font-bold text-[#191f28]">총 합계</td>
                <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-[#4e5968] text-right">{formatCurrency(toMillions(totalBase))}</td>
                <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-[#191f28] text-right">{formatCurrency(toMillions(totalTarget))}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-base font-bold text-right ${totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  {totalVariance > 0 ? '+' : ''}{formatCurrency(toMillions(totalVariance))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-base font-bold text-right ${totalVariancePercent > 0 ? 'text-red-500' : totalVariancePercent < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                  {totalVariancePercent > 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
