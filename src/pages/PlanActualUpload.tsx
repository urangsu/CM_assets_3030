import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Clipboard, Trash2, Save, Calendar, Search, X, Edit3, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, getActualDataKey, isBudgetLocked } from '../lib/storageKeys';
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { inferManagementCategoryByAccountCode } from '../lib/accountMaster';

interface ActualData {
  id: number;
  year: string;
  period: string;
  accountCode: string;
  accountName: string;
  controlType: string;
  usageCode: string;
  usageDept: string;
  amount: number;
  additional: number;
  transferred: number;
  carriedOver: number;
  planned: number;
  completed: number;
  balance: number;
  remarks: string;
}

interface ValidationIssue {
  rowNum: number;
  message: string;
}

interface ActualUploadValidationResult {
  validRows: ActualData[];
  warningRows: ValidationIssue[];
  errorRows: ValidationIssue[];
}

// Resizable Header Component
const ResizableHeader = ({ title, width, minWidth, onResize }: { title: string, width: number, minWidth: number, onResize: (newWidth: number) => void }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diff);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, onResize]);

  return (
    <div className="relative flex items-center justify-center w-full h-full px-2 py-2">
      <span className="truncate">{title}</span>
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-brand-500 z-30"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default function PlanActualUpload() {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('all');
  const [planType, setPlanType] = useState('실적');
  const [isSearched, setIsSearched] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [data, setData] = useState<ActualData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user.code !== '99999' && user.code !== '32100') {
        navigate('/dashboard');
      } else {
        setCurrentUser(user);
      }
    } else {
      navigate('/');
    }
  }, [navigate]);

  const viewableDepts = currentUser ? getViewableDepts(currentUser.code) : [];
  const viewableDeptCodes = viewableDepts.map(d => d.code);
  
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [validationResult, setValidationResult] = useState<ActualUploadValidationResult | null>(null);

  // Requirement 2: Multi-select state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  
  // Requirement 3: Batch edit state
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [batchEditFields, setBatchEditFields] = useState({
    year: { checked: false, value: '' },
    period: { checked: false, value: '' },
    accountCode: { checked: false, value: '' },
    accountName: { checked: false, value: '' },
    usageCode: { checked: false, value: '' },
    usageDept: { checked: false, value: '' }
  });

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    checkbox: 40,
    no: 50,
    year: 54,
    period: 54,
    accountCode: 120,
    accountName: 150,
    controlType: 80,
    usageCode: 80,
    usageDept: 100,
    amount: 120,
    additional: 120,
    transferred: 120,
    carriedOver: 120,
    planned: 120,
    completed: 120,
    balance: 120,
    remarks: 200,
    delete: 50
  });

  const handleResize = (key: string, width: number) => {
    setColWidths(prev => ({ ...prev, [key]: width }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      setVisibleCount(prev => prev + 100);
    }
  };

  useEffect(() => {
    if (planType === '실적') {
      const savedData = localStorage.getItem(getActualDataKey(year));
      if (savedData) {
        let actualData: ActualData[] = JSON.parse(savedData);
        
        // Filter salary accounts if no permission
        const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        const userSetting = currentUser ? settings[currentUser.code] : null;
        const hasSalaryAccess = userSetting ? userSetting.hasSalaryAccess : (currentUser?.code === '99999');

        if (!hasSalaryAccess) {
          const salaryAccountCodes = new Set<string>();
          INITIAL_CATEGORIES.forEach((cat: any) => {
            if (SALARY_CATEGORIES.includes(cat.name)) {
              cat.accounts.forEach((acc: any) => salaryAccountCodes.add(acc.code));
            }
          });
          actualData = actualData.filter(item => !salaryAccountCodes.has(item.accountCode));
        }
        
        setData(actualData);
      } else {
        setData([]);
      }
    } else {
      // Load budget data and flatten it
      const allDepts = getAllDepartments();
      const flattenedData: ActualData[] = [];
      let idCounter = 1;

      allDepts.forEach(dept => {
        const key = getBudgetDataKey(dept.code, year, planType);
        const budgetRows = JSON.parse(localStorage.getItem(key) || '[]');
        
        budgetRows.forEach((row: any) => {
          row.values.forEach((val: number, idx: number) => {
            if (val !== 0) {
              flattenedData.push({
                id: idCounter++,
                year: year,
                period: `${idx + 1}월`,
                accountCode: row.code,
                accountName: row.name,
                controlType: '',
                usageCode: dept.code,
                usageDept: dept.name,
                amount: val,
                additional: 0,
                transferred: 0,
                carriedOver: 0,
                planned: 0,
                completed: 0,
                balance: val,
                remarks: row.detail || ''
              });
            }
          });
        });
      });

      // Filter salary accounts if no permission
      const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      const userSetting = currentUser ? settings[currentUser.code] : null;
      const hasSalaryAccess = userSetting ? userSetting.hasSalaryAccess : (currentUser?.code === '99999');

      if (!hasSalaryAccess) {
        const salaryAccountCodes = new Set<string>();
        INITIAL_CATEGORIES.forEach((cat: any) => {
          if (SALARY_CATEGORIES.includes(cat.name)) {
            cat.accounts.forEach((acc: any) => salaryAccountCodes.add(acc.code));
          }
        });
        setData(flattenedData.filter(item => !salaryAccountCodes.has(item.accountCode)));
      } else {
        setData(flattenedData);
      }
    }
    setIsSearched(false);
    setVisibleCount(100);
  }, [year, planType, currentUser]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setAlertModal({ isOpen: true, message: '엑셀 파일에서 시트를 찾을 수 없습니다.' });
        return;
      }
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      processImportedData(jsonData.slice(1)); // Skip header
    };
    reader.readAsBinaryString(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Only process paste if we are not focused on an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;
    
    // Split by lines and then by tabs (Excel format)
    const rows = pasteData.split(/\r?\n/).filter(row => row.trim() !== '').map(row => row.split('\t'));
    processImportedData(rows);
  };

  const processImportedData = (rows: any[][]) => {
    const validRows: ActualData[] = [];
    const warningRows: ValidationIssue[] = [];
    const errorRows: ValidationIssue[] = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return Number(String(val).replace(/[^0-9.-]/g, '')) || 0;
      };

      if (planType !== '실적' && row.length >= 24) {
        // 계획 업로드: 선택, 연도, 계약구분, 투자여부, 일반구분, 작성부서, 귀속부서, 계정코드, 계정명, 내역, 산출기준, 금액, 1월~12월
        const yearVal = String(row[1] || year);
        const isInvestStr = String(row[3] || '');
        const mgmtCatStr = String(row[4] || '');
        const usageCodeVal = String(row[6] || '');
        const accountCode = String(row[7] || '');
        const accountName = String(row[8] || '');
        const remarks = String(row[9] || '');

        let hasError = false;
        
        if (isNaN(Number(yearVal)) || isNaN(Number(usageCodeVal))) {
          errorRows.push({ rowNum, message: '예산년도 또는 귀속부서(사용처) 코드가 숫자가 아닙니다.' });
          hasError = true;
        }

        // 투자여부 / 일반구분 조합 검증
        if (isInvestStr.includes('투자') && mgmtCatStr !== '투자') {
          warningRows.push({ rowNum, message: '투자예산은 일반구분이 "투자"로 설정되어야 합니다.' });
          // Note: In real logic we would correct it or force error, here we issue warning
        }

        if (!accountCode) {
          errorRows.push({ rowNum, message: '계정코드가 비어 있습니다.' });
          hasError = true;
        }

        if (currentUser?.code !== '99999' && !viewableDeptCodes.includes(usageCodeVal)) {
          errorRows.push({ rowNum, message: '조회 권한이 없는 부서의 데이터입니다.' });
          hasError = true;
        }

        if (!hasError) {
          for (let i = 0; i < 12; i++) {
            const amount = parseNum(row[12 + i]);
            if (amount !== 0) {
              validRows.push({
                id: data.length + validRows.length + 1,
                year: yearVal,
                period: `${i + 1}월`,
                accountCode,
                accountName,
                controlType: '',
                usageCode: usageCodeVal,
                usageDept: String(row[5] || ''),
                amount,
                additional: 0,
                transferred: 0,
                carriedOver: 0,
                planned: 0,
                completed: 0,
                balance: amount,
                remarks
              });
            }
          }
        }
      } else {
        // 실적 업로드 (기존 로직)
        const yearVal = String(row[1] || year);
        const usageCodeVal = String(row[6] || '');
        const periodStr = String(row[2] || '');
        const accountCode = String(row[3] || '');
        const autoControl = inferManagementCategoryByAccountCode(accountCode);
        const controlType = String(row[5] || '');
        const finalControlType = autoControl === '투자' ? '투자' : controlType;

        let hasError = false;

        // 1. Year/Dept code validation
        if (isNaN(Number(yearVal)) || isNaN(Number(usageCodeVal))) {
          errorRows.push({ rowNum, message: '예산년도 또는 사용처코드가 숫자가 아닙니다.' });
          hasError = true;
        }
        if (yearVal.length !== 4) {
          warningRows.push({ rowNum, message: '예산년도가 4자리가 아닙니다.' });
        }

        // 2. Period validation
        const monthIndex = parsePeriodMonth(periodStr);
        if (monthIndex === null) {
          errorRows.push({ rowNum, message: `기간 형식이 잘못되었습니다 ('${periodStr}').` });
          hasError = true;
        }

        // 3. Account code
        if (!accountCode) {
          errorRows.push({ rowNum, message: '계정코드가 비어 있습니다.' });
          hasError = true;
        }

        // 4. Permissions
        if (currentUser?.code !== '99999' && !viewableDeptCodes.includes(usageCodeVal)) {
          errorRows.push({ rowNum, message: '조회 권한이 없는 부서의 데이터입니다.' });
          hasError = true;
        }

        const amount = parseNum(row[8]);
        const additional = parseNum(row[9]);
        const transferred = parseNum(row[10]);
        const carriedOver = parseNum(row[11]);
        const planned = parseNum(row[12]);
        const completed = parseNum(row[13]);
        
        const calculatedBalance = (amount + additional + transferred + carriedOver) - (planned + completed);
        const rowBalanceStr = row[14] !== undefined ? String(row[14]) : '';
        const balance = rowBalanceStr !== '' ? parseNum(rowBalanceStr) : calculatedBalance;

        // 5. Balance check
        if (rowBalanceStr !== '' && balance !== calculatedBalance) {
          warningRows.push({ rowNum, message: '잔액 계산값이 수식과 불일치합니다.' });
        }

        if (!hasError) {
          const item: ActualData = {
            id: data.length + validRows.length + 1,
            year: yearVal,
            period: periodStr,
            accountCode,
            accountName: String(row[4] || ''),
            controlType: typeof finalControlType !== 'undefined' ? finalControlType : String(row[5] || ''),
            usageCode: usageCodeVal,
            usageDept: String(row[7] || ''),
            amount,
            additional,
            transferred,
            carriedOver,
            planned,
            completed,
            balance,
            remarks: String(row[15] || ''),
          };
          validRows.push(item);
        }
      }
    });

    if (validRows.length === 0 && errorRows.length === 0 && warningRows.length === 0) {
      setAlertModal({ isOpen: true, message: '유효한 데이터를 찾을 수 없습니다. 형식을 확인해 주세요.' });
      return;
    }

    setValidationResult({ validRows, warningRows, errorRows });
  };

  const confirmImport = () => {
    if (validationResult) {
       const updatedData = [...data, ...validationResult.validRows];
       setData(updatedData);
       setAlertModal({ isOpen: true, message: `${validationResult.validRows.length}개의 데이터가 추가되었습니다. 저장하기를 눌러 반영해 주세요.` });
       setValidationResult(null);
    }
  };

  const handleSave = () => {
    if (planType === '실적') {
      localStorage.setItem(getActualDataKey(year), JSON.stringify(data));
      setAlertModal({ isOpen: true, message: '실적 데이터가 저장되었습니다.' });
    } else {
      // Group data by usageCode
      const groupedByDept = new Map<string, ActualData[]>();
      data.forEach(item => {
        if (!groupedByDept.has(item.usageCode)) {
          groupedByDept.set(item.usageCode, []);
        }
        groupedByDept.get(item.usageCode)!.push(item);
      });

      const deptsToUpdate = currentUser?.code === '99999' ? getAllDepartments() : viewableDepts;

      const lockedDepts = deptsToUpdate.filter(dept => isBudgetLocked(dept.code, year, planType) && groupedByDept.has(dept.code));
      if (lockedDepts.length > 0) {
        setAlertModal({ isOpen: true, message: `제출 또는 승인 완료된 예산은 수정할 수 없습니다 (예: ${lockedDepts[0].name}).` });
        return;
      }

      deptsToUpdate.forEach(dept => {
        const deptCode = dept.code;
        const key = getBudgetDataKey(deptCode, year, planType);
        const deptData = groupedByDept.get(deptCode) || [];
        
        if (deptData.length === 0) return;

        const existingData = localStorage.getItem(key);
        const budgetRows: any[] = existingData ? JSON.parse(existingData) : [];
        
        deptData.forEach(uploadRow => {
          const monthIndex = parsePeriodMonth(uploadRow.period);
          if (monthIndex !== null) {
            let budgetRow = budgetRows.find((r: any) => r.code === uploadRow.accountCode);
            if (budgetRow) {
              budgetRow.values[monthIndex] = uploadRow.amount;
              if (uploadRow.remarks) budgetRow.detail = uploadRow.remarks;
            } else {
              budgetRows.push({
                id: `acc_${Date.now()}_${uploadRow.accountCode}_${Math.random().toString(36).substr(2, 5)}`,
                code: uploadRow.accountCode,
                name: uploadRow.accountName,
                detail: uploadRow.remarks || '',
                calculation: '일괄 업로드',
                sourceType: 'MANUAL',
                values: Array(12).fill(0).map((v, i) => i === monthIndex ? uploadRow.amount : 0),
                attributedDeptCode: deptCode
              });
            }
          }
        });
        
        localStorage.setItem(key, JSON.stringify(budgetRows));
      });
      setAlertModal({ isOpen: true, message: `${planType} 데이터가 저장되었습니다.` });
    }
  };

  const handleClear = () => {
    setConfirmModal({
      isOpen: true,
      message: currentUser?.code === '99999' ? `모든 ${planType} 데이터를 삭제하시겠습니까?` : `조회 가능한 부서의 ${planType} 데이터를 모두 삭제하시겠습니까?`,
      onConfirm: () => {
        if (planType === '실적') {
          if (currentUser?.code === '99999') {
            setData([]);
            localStorage.removeItem(getActualDataKey(year));
          } else {
            const remainingData = data.filter(item => !viewableDeptCodes.includes(item.usageCode));
            setData(remainingData);
            localStorage.setItem(getActualDataKey(year), JSON.stringify(remainingData));
          }
        } else {
          // Clear budget data for relevant depts
          const deptsToClear = currentUser?.code === '99999' ? getAllDepartments() : viewableDepts;
          deptsToClear.forEach(dept => {
            localStorage.removeItem(getBudgetDataKey(dept.code, year, planType));
          });
          setData([]);
        }
        setConfirmModal(null);
      }
    });
  };

  const filteredData = isSearched ? data.filter(item => {
    // Filter by viewable departments
    if (currentUser && currentUser.code !== '99999' && !viewableDeptCodes.includes(item.usageCode)) {
      return false;
    }

    let monthMatch = true;
    if (month !== 'all') {
      const periodStr = String(item.period || '').trim();
      let itemMonth = -1;
      const matchMonth = periodStr.match(/(\d{1,2})월?$/) || periodStr.match(/[-./](\d{1,2})$/);
      if (matchMonth) {
        itemMonth = parseInt(matchMonth[1], 10);
      } else if (!isNaN(parseInt(periodStr, 10))) {
        itemMonth = parseInt(periodStr, 10);
      }
      if (itemMonth !== parseInt(month, 10)) {
        monthMatch = false;
      }
    }

    const searchMatch = item.accountCode.includes(searchTerm) || 
      item.accountName.includes(searchTerm) ||
      item.usageDept.includes(searchTerm) ||
      item.controlType.includes(searchTerm);

    return monthMatch && searchMatch;
  }) : [];

  const visibleData = filteredData.slice(0, visibleCount);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const handleCellChange = (id: number, field: keyof ActualData, value: string) => {
    // Validation for year and usageCode
    if ((field === 'year' || field === 'usageCode') && value !== '') {
      if (isNaN(Number(value))) {
        setAlertModal({ isOpen: true, message: `${field === 'year' ? '예산년도' : '예산사용처코드'}는 숫자만 입력 가능합니다. 다시 입력해 주세요.` });
        return;
      }
    }

    setData(prevData => prevData.map(item => {
      if (item.id === id) {
        const newItem = { ...item };
        
        if (['amount', 'additional', 'transferred', 'carriedOver', 'planned', 'completed', 'balance'].includes(field)) {
          let valStr = value.replace(/,/g, '');
          if (valStr === '' || valStr === '-') valStr = '0';
          const numVal = Number(valStr);
          (newItem as any)[field] = isNaN(numVal) ? 0 : numVal;
          
          // Recalculate balance if any of the components change
          if (field !== 'balance') {
            newItem.balance = (newItem.amount + newItem.additional + newItem.transferred + newItem.carriedOver) - (newItem.planned + newItem.completed);
          }
        } else {
          (newItem as any)[field] = value;
        }
        
        return newItem;
      }
      return item;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = Math.min(filteredData.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      if (target.selectionStart === 0) {
        e.preventDefault();
        nextCol = Math.max(0, colIndex - 1);
      } else return;
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (target.selectionStart === target.value.length) {
        e.preventDefault();
        nextCol = Math.min(editableColumns.length - 1, colIndex + 1);
      } else return;
    } else {
      return;
    }

    const nextCellId = `actual-cell-${nextRow}-${nextCol}`;
    const nextCell = document.getElementById(nextCellId);
    if (nextCell) {
      (nextCell as HTMLInputElement).focus();
    }
  };

  const editableColumns: { key: keyof ActualData, type: 'text' | 'number', widthKey: string }[] = [
    { key: 'year', type: 'text', widthKey: 'year' },
    { key: 'period', type: 'text', widthKey: 'period' },
    { key: 'accountCode', type: 'text', widthKey: 'accountCode' },
    { key: 'accountName', type: 'text', widthKey: 'accountName' },
    { key: 'controlType', type: 'text', widthKey: 'controlType' },
    { key: 'usageCode', type: 'text', widthKey: 'usageCode' },
    { key: 'usageDept', type: 'text', widthKey: 'usageDept' },
    { key: 'amount', type: 'number', widthKey: 'amount' },
    { key: 'additional', type: 'number', widthKey: 'additional' },
    { key: 'transferred', type: 'number', widthKey: 'transferred' },
    { key: 'carriedOver', type: 'number', widthKey: 'carriedOver' },
    { key: 'planned', type: 'number', widthKey: 'planned' },
    { key: 'completed', type: 'number', widthKey: 'completed' },
    { key: 'balance', type: 'number', widthKey: 'balance' },
    { key: 'remarks', type: 'text', widthKey: 'remarks' },
  ];

  const handleBatchUpdate = () => {
    const updatedData = data.map(row => {
      if (selectedRows.has(row.id)) {
        const newRow = { ...row };
        if (batchEditFields.year.checked) newRow.year = batchEditFields.year.value;
        if (batchEditFields.period.checked) newRow.period = batchEditFields.period.value;
        if (batchEditFields.accountCode.checked) newRow.accountCode = batchEditFields.accountCode.value;
        if (batchEditFields.accountName.checked) newRow.accountName = batchEditFields.accountName.value;
        if (batchEditFields.usageCode.checked) newRow.usageCode = batchEditFields.usageCode.value;
        if (batchEditFields.usageDept.checked) newRow.usageDept = batchEditFields.usageDept.value;
        return newRow;
      }
      return row;
    });
    setData(updatedData);

    // [수정 4 반영] 실적 데이터를 이관하면서 '계획(Budget)' 데이터도 강제 이관 동기화
    const allDepts = getAllDepartments();
    updatedData.forEach(updatedItem => {
      const originalItem = data.find(d => d.id === updatedItem.id);
      
      // 부서(usageCode)가 변경된 경우에만 실행
      if (originalItem && originalItem.usageCode !== updatedItem.usageCode) {
        const oldKey = `${STORAGE_KEYS.BUDGET_DATA}_${originalItem.usageCode}_${updatedItem.year}_경영계획`;
        const newKey = `${STORAGE_KEYS.BUDGET_DATA}_${updatedItem.usageCode}_${updatedItem.year}_경영계획`;

        let oldBudgetRows = JSON.parse(localStorage.getItem(oldKey) || '[]');
        let newBudgetRows = JSON.parse(localStorage.getItem(newKey) || '[]');

        // 구 부서에서 해당 계정 데이터 찾아서 빼내기
        const budgetRowToMoveIndex = oldBudgetRows.findIndex((r: any) => r.code === updatedItem.accountCode);
        
        if (budgetRowToMoveIndex > -1) {
          const [rowToMove] = oldBudgetRows.splice(budgetRowToMoveIndex, 1);
          rowToMove.attributedDeptCode = updatedItem.usageCode; // 귀속 부서 꼬리표 변경
          
          // 새 부서에 밀어넣기
          const existingInNew = newBudgetRows.findIndex((r: any) => r.code === updatedItem.accountCode);
          if (existingInNew > -1) {
            newBudgetRows[existingInNew] = rowToMove; // 덮어쓰기
          } else {
            newBudgetRows.push(rowToMove); // 새로 추가
          }

          // 양쪽 localStorage 모두 업데이트 (동기화 완료)
          localStorage.setItem(oldKey, JSON.stringify(oldBudgetRows));
          localStorage.setItem(newKey, JSON.stringify(newBudgetRows));
        }
      }
    });

    setIsBatchEditModalOpen(false);
    setAlertModal({ isOpen: true, message: '선택한 데이터가 일괄 수정되었으며, 관련 계획 데이터도 동기화되었습니다.' });
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Batch Edit Modal */}
      {isBatchEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">데이터 일괄 수정 ({selectedRows.size}건)</h3>
              <button onClick={() => setIsBatchEditModalOpen(false)} className="text-[#8b95a1] hover:text-[#4e5968]">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-600 mb-4">
                수정할 항목을 체크하고 값을 입력해주세요. 체크되지 않은 항목은 기존 데이터가 유지됩니다.
              </div>
              
              {[
                { id: 'year', label: '예산년도', placeholder: '2026' },
                { id: 'period', label: '기간', placeholder: '01' },
                { id: 'accountCode', label: '예산계정코드', placeholder: '계정코드 입력' },
                { id: 'accountName', label: '예산계정', placeholder: '계정명 입력' }
              ].map((field) => (
                <div key={field.id} className="flex items-center gap-4 relative">
                  <div className="flex items-center gap-2 w-32">
                    <input 
                      type="checkbox"
                      id={`check-${field.id}`}
                      checked={(batchEditFields as any)[field.id].checked}
                      onChange={(e) => setBatchEditFields(prev => ({
                        ...prev,
                        [field.id]: { ...(prev as any)[field.id], checked: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500"
                    />
                    <label htmlFor={`check-${field.id}`} className="text-sm font-medium text-[#4e5968] cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                  <input 
                    type="text"
                    placeholder={field.placeholder}
                    value={(batchEditFields as any)[field.id].value}
                    onChange={(e) => {
                      setBatchEditFields(prev => ({
                        ...prev,
                        [field.id]: { ...(prev as any)[field.id], value: e.target.value }
                      }));
                      if (field.id === 'accountName') {
                        setShowAccountDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      if (field.id === 'accountName') setShowAccountDropdown(true);
                    }}
                    onBlur={() => {
                      if (field.id === 'accountName') {
                        setTimeout(() => setShowAccountDropdown(false), 200);
                      }
                    }}
                    disabled={!(batchEditFields as any)[field.id].checked || field.id === 'accountCode'}
                    className="flex-1 px-4 py-2 border border-[#d1d6db] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-[#f9fafb] disabled:text-[#8b95a1]"
                  />
                  {field.id === 'accountName' && showAccountDropdown && batchEditFields.accountName.checked && (
                    <div className="absolute top-full left-[144px] right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#d1d6db] rounded-xl shadow-lg z-50">
                      {INITIAL_CATEGORIES.flatMap(cat => cat.accounts)
                        .filter(acc => acc.name.includes(batchEditFields.accountName.value))
                        .map(acc => (
                          <div
                            key={acc.code}
                            className="px-4 py-2 hover:bg-[#f2f4f6] cursor-pointer text-sm"
                            onClick={() => {
                              setBatchEditFields(prev => ({
                                ...prev,
                                accountName: { ...prev.accountName, value: acc.name },
                                accountCode: { ...prev.accountCode, value: acc.code, checked: true }
                              }));
                              setShowAccountDropdown(false);
                            }}
                          >
                            <span className="font-medium text-[#191f28]">{acc.name}</span>
                            <span className="ml-2 text-xs text-[#8b95a1]">{acc.code}</span>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Special handling for Usage Dept and Code */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <input 
                    type="checkbox"
                    id="check-usageDept"
                    checked={batchEditFields.usageDept.checked}
                    onChange={(e) => setBatchEditFields(prev => ({
                      ...prev,
                      usageDept: { ...prev.usageDept, checked: e.target.checked },
                      usageCode: { ...prev.usageCode, checked: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="check-usageDept" className="text-sm font-medium text-[#4e5968] cursor-pointer">
                    예산사용처
                  </label>
                </div>
                <select 
                  value={batchEditFields.usageDept.value}
                  onChange={(e) => {
                    const deptName = e.target.value;
                    const dept = getAllDepartments().find(d => d.name === deptName);
                    setBatchEditFields(prev => ({
                      ...prev,
                      usageDept: { ...prev.usageDept, value: deptName },
                      usageCode: { ...prev.usageCode, value: dept ? dept.code : '' }
                    }));
                  }}
                  disabled={!batchEditFields.usageDept.checked}
                  className="flex-1 px-4 py-2 border border-[#d1d6db] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-[#f9fafb] disabled:text-[#8b95a1]"
                >
                  <option value="">부서 선택</option>
                  {getAllDepartments().map(dept => (
                    <option key={dept.code} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <input 
                    type="checkbox"
                    id="check-usageCode"
                    checked={batchEditFields.usageCode.checked}
                    disabled // Linked to usageDept
                    className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500 opacity-50"
                  />
                  <label className="text-sm font-medium text-[#4e5968] opacity-50">
                    예산사용처코드
                  </label>
                </div>
                <input 
                  type="text"
                  placeholder="자동 입력됨"
                  value={batchEditFields.usageCode.value}
                  disabled
                  className="flex-1 px-4 py-2 border border-[#d1d6db] rounded-xl text-sm bg-[#f9fafb] text-[#8b95a1]"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end gap-3">
              <button 
                onClick={() => setIsBatchEditModalOpen(false)}
                className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#e5e8eb] rounded-xl transition-colors"
              >
                기존 데이터 보존
              </button>
              <button 
                onClick={handleBatchUpdate}
                className="px-4 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Validation Result Modal */}
      {validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-[#191f28] mb-4">데이터 유효성 검사 결과</h3>
            <div className="space-y-4 mb-6 text-sm flex-1 overflow-y-auto pr-2">
              <p className="text-[#4e5968]">총 {validationResult.validRows.length + validationResult.warningRows.length + validationResult.errorRows.length}건 중 
              정상 <span className="font-bold text-green-600 px-1">{validationResult.validRows.length}</span>건, 
              경고 <span className="font-bold text-yellow-600 px-1">{validationResult.warningRows.length}</span>건, 
              오류 <span className="font-bold text-red-600 px-1">{validationResult.errorRows.length}</span>건</p>
              
              {validationResult.errorRows.length > 0 && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-h-40 overflow-y-auto">
                  <h4 className="font-bold text-red-700 mb-2 flex items-center"><X className="w-4 h-4 mr-1" />오류 내용 (저장 제외)</h4>
                  <ul className="list-disc pl-5 text-red-600 space-y-1 text-xs">
                    {validationResult.errorRows.map((e, i) => (
                      <li key={i}>{e.rowNum}행: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.warningRows.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 max-h-40 overflow-y-auto">
                  <h4 className="font-bold text-yellow-700 mb-2 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />경고 내용</h4>
                  <ul className="list-disc pl-5 text-yellow-600 space-y-1 text-xs">
                    {validationResult.warningRows.map((w, i) => (
                      <li key={i}>{w.rowNum}행: {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-[#4e5968] font-medium pt-2 border-t border-[#f2f4f6]">
                오류가 있는 행은 저장 대상에서 제외됩니다.<br/>계속하시겠습니까?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                className="px-5 py-2.5 bg-[#f2f4f6] text-[#4e5968] rounded-xl text-sm font-semibold hover:bg-[#e5e8eb] transition-colors"
                onClick={() => setValidationResult(null)}
              >
                취소
              </button>
              <button
                className="px-5 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 transition-colors shadow-m disabled:opacity-50"
                onClick={confirmImport}
                disabled={validationResult.validRows.length === 0}
              >
                저장 후 계속
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-[#191f28] mb-4">알림</h3>
            <p className="text-[#4e5968] mb-6">{alertModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setAlertModal(null)}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-[#191f28] mb-4">확인</h3>
            <p className="text-[#4e5968] mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-[#f2f4f6] text-[#4e5968] rounded-xl text-sm font-semibold hover:bg-[#e5e8eb]"
              >
                취소
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-[#f04452] text-white rounded-xl text-sm font-semibold hover:bg-[#d93d4a]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm flex flex-col xl:flex-row justify-between items-end gap-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">조회 연도</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-[#8b95a1]" />
              </div>
              <select 
                value={year}
                onChange={(e) => { setYear(e.target.value); setIsSearched(false); }}
                className="pl-10 pr-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none"
              >
                <option value="2024">2024년</option>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">조회 월</label>
            <select 
              value={month}
              onChange={(e) => { setMonth(e.target.value); setIsSearched(false); }}
              className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none"
            >
              <option value="all">전체</option>
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={String(i+1)}>{i+1}월</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">계획 구분</label>
            <select 
              value={planType}
              onChange={(e) => { setPlanType(e.target.value); setIsSearched(false); }}
              className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none"
            >
              <option value="실적">실적</option>
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
          </div>

          <button
            onClick={() => { setIsSearched(true); setVisibleCount(100); }}
            className="px-4 py-2 h-[42px] bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 transition-all whitespace-nowrap"
          >
            조회
          </button>

          <div className="w-56">
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">검색</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-[#8b95a1]" />
                </div>
                <input
                  type="text"
                  placeholder="계정코드, 부서 등 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-[42px] pl-10 pr-4 bg-[#f2f4f6] border-none rounded-xl text-sm outline-none"
                />
              </div>
              <button 
                onClick={() => {
                  if (selectedRows.size === 0) {
                    setAlertModal({ isOpen: true, message: '수정할 데이터를 선택해주세요.' });
                    return;
                  }
                  setIsBatchEditModalOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-white border border-[#e5e8eb] text-[#4e5968] rounded-xl text-sm font-semibold hover:bg-[#f2f4f6] transition-colors gap-2 h-[42px] whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                수정
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 h-[42px] bg-white border border-[#e5e8eb] text-[#4e5968] rounded-xl text-sm font-semibold hover:bg-[#f2f4f6] transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 mr-2" />
            엑셀 업로드
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".xlsx, .xls"
          />
          <button 
            onClick={handleClear}
            className="flex items-center px-4 py-2 h-[42px] bg-white border border-[#e5e8eb] text-[#f04452] rounded-xl text-sm font-semibold hover:bg-[#fff0f0] transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            초기화
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center px-4 py-2 h-[42px] bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all whitespace-nowrap"
          >
            <Save className="w-4 h-4 mr-2" />
            저장하기
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 flex items-start gap-3">
        <Clipboard className="w-5 h-5 text-brand-500 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-brand-900">데이터 붙여넣기 지원</p>
          <p className="text-xs text-brand-700 mt-1">
            엑셀에서 데이터를 복사(Ctrl+C)한 후 이 페이지 어디서든 붙여넣기(Ctrl+V) 하시면 자동으로 데이터가 추가됩니다.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-[#e5e8eb] shadow-sm overflow-hidden">
        <div 
          className="overflow-x-auto overflow-y-auto max-h-[600px]"
          onScroll={handleScroll}
        >
          <table className="w-full text-left border-collapse table-fixed" style={{ width: (Object.values(colWidths) as number[]).reduce((a, b) => a + b, 0) }}>
            <thead className="sticky top-0 z-10 bg-[#f9fafb] shadow-sm">
              <tr className="border-bottom border-[#e5e8eb]">
                <th style={{ width: colWidths.checkbox }} className="px-2 py-3 text-center">
                  <input 
                    type="checkbox"
                    checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(filteredData.map(r => r.id)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500"
                  />
                </th>
                <th style={{ width: colWidths.no }} className="px-2 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-center">No.</th>
                <th style={{ width: colWidths.year }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산년도" width={colWidths.year} minWidth={60} onResize={(w) => handleResize('year', w)} />
                </th>
                <th style={{ width: colWidths.period }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="기간" width={colWidths.period} minWidth={60} onResize={(w) => handleResize('period', w)} />
                </th>
                <th style={{ width: colWidths.accountCode }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산계정코드" width={colWidths.accountCode} minWidth={80} onResize={(w) => handleResize('accountCode', w)} />
                </th>
                <th style={{ width: colWidths.accountName }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산계정" width={colWidths.accountName} minWidth={80} onResize={(w) => handleResize('accountName', w)} />
                </th>
                <th style={{ width: colWidths.controlType }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산통제구분" width={colWidths.controlType} minWidth={80} onResize={(w) => handleResize('controlType', w)} />
                </th>
                <th style={{ width: colWidths.usageCode }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산사용처코드" width={colWidths.usageCode} minWidth={80} onResize={(w) => handleResize('usageCode', w)} />
                </th>
                <th style={{ width: colWidths.usageDept }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="예산사용처" width={colWidths.usageDept} minWidth={80} onResize={(w) => handleResize('usageDept', w)} />
                </th>
                <th style={{ width: colWidths.amount }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="예산금액" width={colWidths.amount} minWidth={80} onResize={(w) => handleResize('amount', w)} />
                </th>
                <th style={{ width: colWidths.additional }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="추가예산" width={colWidths.additional} minWidth={80} onResize={(w) => handleResize('additional', w)} />
                </th>
                <th style={{ width: colWidths.transferred }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="전용예산" width={colWidths.transferred} minWidth={80} onResize={(w) => handleResize('transferred', w)} />
                </th>
                <th style={{ width: colWidths.carriedOver }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="이월예산" width={colWidths.carriedOver} minWidth={80} onResize={(w) => handleResize('carriedOver', w)} />
                </th>
                <th style={{ width: colWidths.planned }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="집행예정" width={colWidths.planned} minWidth={80} onResize={(w) => handleResize('planned', w)} />
                </th>
                <th style={{ width: colWidths.completed }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="집행완료" width={colWidths.completed} minWidth={80} onResize={(w) => handleResize('completed', w)} />
                </th>
                <th style={{ width: colWidths.balance }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <ResizableHeader title="예산잔액" width={colWidths.balance} minWidth={80} onResize={(w) => handleResize('balance', w)} />
                </th>
                <th style={{ width: colWidths.remarks }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <ResizableHeader title="비고" width={colWidths.remarks} minWidth={100} onResize={(w) => handleResize('remarks', w)} />
                </th>
                <th style={{ width: colWidths.delete }} className="px-2 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {!isSearched ? (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-[#8b95a1] text-sm">
                    조회 버튼을 클릭하여 데이터를 확인해 주세요.
                  </td>
                </tr>
              ) : visibleData.length > 0 ? (
                visibleData.map((row, rowIndex) => (
                  <tr key={row.id} className="hover:bg-[#f9fafb] transition-colors group">
                    <td className="px-2 py-1 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={() => {
                          const newSelected = new Set(selectedRows);
                          if (newSelected.has(row.id)) {
                            newSelected.delete(row.id);
                          } else {
                            newSelected.add(row.id);
                          }
                          setSelectedRows(newSelected);
                        }}
                        className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-2 py-1 text-xs text-[#4e5968] text-center">{rowIndex + 1}</td>
                    
                    {editableColumns.map((col, colIndex) => (
                      <td key={col.key} className="px-1 py-1">
                        <input
                          id={`actual-cell-${rowIndex}-${colIndex}`}
                          type="text"
                          value={col.type === 'number' ? formatNumber(row[col.key] as number) : row[col.key]}
                          onChange={(e) => handleCellChange(row.id, col.key, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          className={`w-full p-1 text-xs bg-transparent border border-transparent hover:border-[#e5e8eb] focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 rounded outline-none transition-all ${col.type === 'number' ? 'text-right' : 'text-left'} ${col.key === 'accountCode' ? 'font-mono text-brand-600' : ''} ${col.key === 'completed' ? 'font-semibold text-brand-600' : ''} ${col.key === 'balance' ? 'font-bold' : ''}`}
                        />
                      </td>
                    ))}
                    
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => {
                          setData(prev => prev.filter(item => item.id !== row.id));
                        }}
                        className="p-1 text-[#8b95a1] hover:text-[#f04452] hover:bg-[#fff0f0] rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="행 삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-[#8b95a1] text-sm">
                    데이터가 없습니다. 엑셀 업로드 또는 붙여넣기를 통해 데이터를 추가해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
