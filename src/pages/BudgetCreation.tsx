import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Copy, RefreshCw, ClipboardPaste, Send, Building2, Save, Divide, FileDown, CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown, Filter, Trash2, LayoutGrid, Check, X, ArrowRightLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DEPARTMENTS, STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, getSubmissionStatusMapKey, SubmissionStatus, BudgetStatus, isBudgetLocked, getSubmissionStatus } from '../lib/storageKeys';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { inferBudgetTypeByAccountCode, inferManagementCategoryByAccountCode } from '../lib/accountMaster';

import { usePermission } from '../lib/permissions';

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
    <div className="relative flex items-center justify-center w-full h-full px-2 py-3 text-xs font-semibold text-lithium-600">
      <span className="truncate">{title}</span>
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-nickel-500 z-30"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default function BudgetCreation() {
  const navigate = useNavigate();
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // 전사 계정 맵 생성 (필터링 및 데이터 로드 시 사용)
  const allAccountsMap = React.useMemo(() => {
    const savedAccountsStr = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    let globalAccounts = INITIAL_CATEGORIES;
    if (savedAccountsStr) {
      try {
        globalAccounts = JSON.parse(savedAccountsStr);
      } catch (e) {
        console.error('Failed to parse global accounts', e);
      }
    }
    const map = new Map();
    globalAccounts.forEach((cat: any) => {
      cat.accounts.forEach((acc: any) => {
        map.set(acc.id, acc);
      });
    });
    return map;
  }, [reloadTrigger]);

  const [year, setYear] = useState(() => localStorage.getItem('budget_creation_year') || '2026');
  const [planType, setPlanType] = useState(() => localStorage.getItem('budget_creation_planType') || '경영계획');
  const [selectedDeptCode, setSelectedDeptCode] = useState(() => {
    const savedDept = localStorage.getItem('budget_creation_dept');
    if (savedDept) return savedDept;
    
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      const viewable = getViewableDepts(user.code);
      return viewable.length > 0 ? viewable[0].code : DEPARTMENTS[1].code;
    }
    return DEPARTMENTS[1].code;
  });

  // Persist filters
  useEffect(() => {
    localStorage.setItem('budget_creation_year', year);
    localStorage.setItem('budget_creation_planType', planType);
    localStorage.setItem('budget_creation_dept', selectedDeptCode);
  }, [year, planType, selectedDeptCode]);
  const [data, setData] = useState<any[]>([]);
  const { currentUser, isAdmin, hasSalaryAccess, viewableDepts, viewableDeptCodes } = usePermission();
  const allDepts = getAllDepartments();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number, colIndex?: number, field?: string } | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [actualsMap, setActualsMap] = useState<Map<string, number[]>>(new Map());
  const [importModal, setImportModal] = useState({ 
    isOpen: false, 
    sourceYear: '2025',
    sourceType: 'actual' as 'actual' | 'budget',
    sourcePlanType: '경영계획',
    selectedMonths: Array(12).fill(true) 
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
    key: '',
    direction: null
  });
  const [viewFilters, setViewFilters] = useState({
    hideEmptyRows: false,
    showOnlyWithAmount: false,
    showOnlyNeedsInput: false
  });
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [colWidths, setColWidths] = useState({
    name: 128,
    detail: 192, // w-48
    calculation: 192, // w-48
    months: Array(12).fill(112) // w-28
  });

  const handleMonthColResize = (index: number, width: number) => {
    const newMonths = [...colWidths.months];
    newMonths[index] = width;
    setColWidths({ ...colWidths, months: newMonths });
  };
  
  const handleNameColResize = (width: number) => {
    setColWidths({ ...colWidths, name: width });
  };
  const gridRef = useRef<HTMLDivElement>(null);

  const [copyModal, setCopyModal] = useState({ isOpen: false, count: 1 });
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', message: '' });

  // Handle Enter key for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (modalConfig.isOpen) {
          if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
            modalConfig.onConfirm();
          }
          closeModal();
        } else if (copyModal.isOpen) {
          confirmCopy();
        } else if (importModal.isOpen) {
          handleImportData();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig, copyModal, importModal]);

  const showAlert = (message: string) => {
    setModalConfig({ isOpen: true, type: 'alert', message });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, type: 'confirm', message, onConfirm });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const currentDept = allDepts.find(d => d.code === selectedDeptCode) || allDepts[1];

  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({ status: 'DRAFT' });
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isLocked = isBudgetLocked(selectedDeptCode, year, planType);

  useEffect(() => {
    setSubmissionStatus(getSubmissionStatus(selectedDeptCode, year, planType));
  }, [selectedDeptCode, year, planType]);

  // Load data from localStorage when department changes
  useEffect(() => {
    setSelectedRows(new Set());
    const savedAccountsStr = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
    const savedSelectionsStr = localStorage.getItem(STORAGE_KEYS.DEPT_SELECTIONS);
    
    let globalAccounts = INITIAL_CATEGORIES;
    if (savedAccountsStr) {
      try {
        globalAccounts = JSON.parse(savedAccountsStr);
      } catch (e) {
        console.error('Failed to parse global accounts', e);
      }
    }

    // Load saved actuals to get the overridden attributedDeptCode
    const savedActualsMap = new Map<string, string>();
    allDepts.forEach(d => {
      const key = getBudgetDataKey(d.code, year, '실적');
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '[]');
        saved.forEach((row: any) => {
          if (row.attributedDeptCode) {
            savedActualsMap.set(`${d.code}_${row.code}`, row.attributedDeptCode);
          }
        });
      } catch (e) {}
    });

    const loadData = () => {
      // Filtering logic updated: Load data based on selectedDeptCode and permissions
      const viewableDeptCodes = new Set(viewableDepts.map(d => d.code));

      // 1. Load Actuals
      const actualDataStr = localStorage.getItem(`${STORAGE_KEYS.ACTUAL_DATA}_${year}`);
      const actualData: any[] = actualDataStr ? JSON.parse(actualDataStr) : [];
      
      const tempActualsMap = new Map<string, number[]>();
      actualData.forEach((actual: any) => {
        const sourceDeptCode = actual.usageCode;
        const accountCode = actual.accountCode;
        const attributedDeptCode = savedActualsMap.get(`${sourceDeptCode}_${accountCode}`) || sourceDeptCode;

        // Filtering logic: only relevant data for the selected department or viewable departments
        if (selectedDeptCode === 'viewable') {
          if (!viewableDeptCodes.has(attributedDeptCode)) return;
        } else if (selectedDeptCode !== 'all' && attributedDeptCode !== selectedDeptCode && sourceDeptCode !== selectedDeptCode) {
          return;
        }

        const monthIndex = parsePeriodMonth(String(actual.period)) ?? -1;

        if (monthIndex >= 0 && monthIndex < 12) {
          const key = `${attributedDeptCode}_${sourceDeptCode}_${accountCode}`;
          if (!tempActualsMap.has(key)) {
            tempActualsMap.set(key, Array(12).fill(0));
          }
          tempActualsMap.get(key)![monthIndex] += actual.completed;
        }
      });
      setActualsMap(tempActualsMap);

      // 1. Prepare Actuals Map (already exists)
      
      // 2. Load Budget Data (ALWAYS load)
      let budgetRows: any[] = [];
      const deptsToLoad = (selectedDeptCode === 'all' || selectedDeptCode === 'viewable') 
        ? viewableDepts 
        : [allDepts.find(d => d.code === selectedDeptCode)].filter(Boolean) as any[];

      deptsToLoad.forEach(dept => {
        const key = getBudgetDataKey(dept.code, year, planType === '실적' ? '경영계획' : planType);
        const savedData = localStorage.getItem(key);
        if (savedData) {
          budgetRows = [...budgetRows, ...JSON.parse(savedData)];
        }
      });

      // 3. Merging logic if 실적
      if (planType === '실적') {
        const actualRows: any[] = [];
        
        tempActualsMap.forEach((values, key) => {
          const parts = key.split('_');
          const attributedDeptCode = parts[0];
          const sourceDeptCode = parts[1];
          const accountCode = parts[2];

          // Try to find matching budget row
          const matchingBudgetRow = budgetRows.find(row => 
            row.code === accountCode && 
            row.attributedDeptCode === attributedDeptCode
          );

          const acc = Array.from(allAccountsMap.values()).find((a: any) => a.code === accountCode) as any;
          if (acc) {
            actualRows.push({
              ...matchingBudgetRow, // Keep budget info if exists
              id: `${attributedDeptCode}_${sourceDeptCode}_${acc.id}`,
              code: acc.code,
              name: acc.name,
              values: [...values], // This is now 'actuals'
              budgetValues: matchingBudgetRow ? [...matchingBudgetRow.values] : Array(12).fill(0), // Budget
              isReadOnly: true
            });
          }
        });
        setData(actualRows);
        return;
      }
      
      // If NOT 실적, use budgetRows as the base
      let mergedData = [...budgetRows];
      
      // 3. Load Selections & Merge
      const allSelections = savedSelectionsStr ? JSON.parse(savedSelectionsStr) : {};
      const deptCodesForSelections = (selectedDeptCode === 'all' || selectedDeptCode === 'viewable')
        ? viewableDepts.map(d => d.code)
        : [selectedDeptCode];
      
      deptCodesForSelections.forEach(dCode => {
        const selectedIds = allSelections[dCode] || [];
        selectedIds.forEach((id: string) => {
          const account = Array.from(allAccountsMap.values()).find((a: any) => a.id === id || a.code === id) as any;
          if (account) {
            const exists = mergedData.some(row => (row.code === account.code) && row.attributedDeptCode === dCode);
            if (!exists) {
              mergedData.push({
                id: `${dCode}_${account.code}`,
                code: account.code,
                name: account.name,
                values: Array(12).fill(0),
                attributedDeptCode: dCode,
                sourceDeptCode: dCode,
                detail: '',
                calculation: '',
                remark: ''
              });
            }
          }
        });
      });

      // Final filtering and salary access check
      let finalData = mergedData.filter(row => {
        if (selectedDeptCode === 'viewable') {
          return viewableDeptCodes.has(row.attributedDeptCode);
        }
        if (selectedDeptCode !== 'all' && row.attributedDeptCode !== selectedDeptCode && row.sourceDeptCode !== selectedDeptCode) {
          return false;
        }
        
        if (!hasSalaryAccess) {
          const isSalary = SALARY_CATEGORIES.some(cat => {
            const category = INITIAL_CATEGORIES.find(c => c.name === cat);
            return category?.accounts.some((acc: any) => acc.code === row.code);
          });
          if (isSalary) return false;
        }
        return true;
      });

      if (selectedDeptCode === 'all') {
        // No longer convert 0s to 1s. We preserve the original values.
        finalData = finalData.map(row => ({
          ...row
        }));
      }

      setData(finalData);
    };

    loadData();
  }, [selectedDeptCode, year, planType, currentUser, reloadTrigger]);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isLocked) return;
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;

    const rows = clipboardData.replace(/\r?\n$/, '').split(/\r?\n/).map(row => row.split('\t'));
    
    const newData = [...data];
    
    if (focusedCell) {
      const startRow = focusedCell.rowIndex;
      
      rows.forEach((row, rIdx) => {
        const targetRow = startRow + rIdx;
        if (targetRow < newData.length) {
          if (focusedCell.colIndex !== undefined) {
            // Pasting into month columns
            const startCol = focusedCell.colIndex;
            row.forEach((cell, cIdx) => {
              const targetCol = startCol + cIdx;
              if (targetCol < 12) {
                const val = parseFloat(cell.replace(/,/g, ''));
                if (!isNaN(val)) {
                  newData[targetRow].values[targetCol] = val;
                }
              }
            });
          } else if (focusedCell.field === 'detail') {
            newData[targetRow].detail = (row && row[0]) ? row[0] : '';
            if (row && row[1] !== undefined) newData[targetRow].calculation = row[1];
            for (let i = 0; i < 12; i++) {
              if (row && row[2 + i] !== undefined) {
                const val = parseFloat(row[2 + i].replace(/,/g, ''));
                if (!isNaN(val)) newData[targetRow].values[i] = val;
              }
            }
          } else if (focusedCell.field === 'calculation') {
            newData[targetRow].calculation = (row && row[0]) ? row[0] : '';
            for (let i = 0; i < 12; i++) {
              if (row && row[1 + i] !== undefined) {
                const val = parseFloat(row[1 + i].replace(/,/g, ''));
                if (!isNaN(val)) newData[targetRow].values[i] = val;
              }
            }
          }
        }
      });
    } else {
      rows.forEach((row, rowIndex) => {
        if (rowIndex < newData.length && row.length > 0) {
          // 24컬럼: 선택, 연도, 계획구분, 투자여부, 일반구분, 작성부서, 귀속부서, 계정과목코드, 계정과목, 내역, 산출기준, 금액, 1월~12월
          if (row.length >= 24) {
            const budgetTypeStr = row[3];
            const mgmtCategoryStr = row[4];
            
            newData[rowIndex].detail = row[9] || newData[rowIndex].detail || '';
            newData[rowIndex].calculation = row[10] || newData[rowIndex].calculation || '';
            
            const amountTotal = parseFloat((row[11] || '0').replace(/,/g, '')) || 0;
            
            let monthSum = 0;
            for (let i = 0; i < 12; i++) {
              if (row[12 + i] !== undefined) {
                const val = parseFloat(row[12 + i].replace(/,/g, ''));
                if (!isNaN(val)) {
                  newData[rowIndex].values[i] = val;
                  monthSum += val;
                }
              }
            }
            if (monthSum === 0 && amountTotal > 0) {
              // 1월~12월 값이 모두 비어있고 금액만 있으면 배분 필요 상태
            }
          } 
          // 12개월 데이터만 복사한 경우
          else if (row.length === 12) {
            row.forEach((cell, colIndex) => {
              const val = parseFloat(cell.replace(/,/g, ''));
              if (!isNaN(val)) {
                newData[rowIndex].values[colIndex] = val;
              }
            });
          } 
          // 그 외의 경우 (숫자 데이터 위주로 처리)
          else {
            row.forEach((cell, colIndex) => {
              const val = parseFloat(cell.replace(/,/g, ''));
              if (!isNaN(val) && colIndex < 12) {
                newData[rowIndex].values[colIndex] = val;
              }
            });
          }
        }
      });
    }
    setData(newData);
  };

  const handleCellChange = (id: string, colIndex: number, value: string) => {
    if (isLocked) return;
    setData(prevData => prevData.map(row => {
      if (row.id === id) {
        const newValues = [...row.values];
        const numVal = parseFloat(value.replace(/,/g, ''));
        newValues[colIndex] = isNaN(numVal) ? 0 : numVal;
        return { ...row, values: newValues };
      }
      return row;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex?: number, field?: 'detail' | 'calculation' | 'remark') => {
    let nextRow = rowIndex;
    let nextCol = colIndex;
    let nextField = field;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = Math.min(sortedData.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowLeft' && colIndex !== undefined) {
      const target = e.target as HTMLInputElement;
      if (target.selectionStart === 0) {
        e.preventDefault();
        nextCol = Math.max(0, colIndex - 1);
      } else return;
    } else if (e.key === 'ArrowRight' && colIndex !== undefined) {
      const target = e.target as HTMLInputElement;
      if (target.selectionStart === target.value.length) {
        e.preventDefault();
        nextCol = Math.min(11, colIndex + 1);
      } else return;
    } else {
      return;
    }
    
    // Focus the next element
    const id = nextField ? `cell-${nextRow}-${nextField}` : `cell-${nextRow}-${nextCol}`;
    const element = document.getElementById(id);
    if (element) {
      element.focus();
      setFocusedCell({ rowIndex: nextRow, colIndex: nextCol, field: nextField });
    }
  };

  const handleTextChange = (id: string, field: 'detail' | 'calculation' | 'remark', value: string) => {
    if (isLocked) return;
    setData(prevData => prevData.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleAttributedDeptChange = (id: string, value: string) => {
    if (isLocked) return;
    setData(prevData => prevData.map(row => {
      if (row.id === id) {
        return { ...row, attributedDeptCode: value };
      }
      return row;
    }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(sortedData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string, index: number, e: React.MouseEvent | React.ChangeEvent) => {
    const newSelected = new Set(selectedRows);
    
    // @ts-ignore
    const isShiftKey = e.shiftKey || (e.nativeEvent && e.nativeEvent.shiftKey);
    
    if (isShiftKey && lastSelectedRowIndex !== null) {
      const start = Math.min(lastSelectedRowIndex, index);
      const end = Math.max(lastSelectedRowIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(sortedData[i].id);
      }
    } else {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setLastSelectedRowIndex(index);
    }
    setSelectedRows(newSelected);
  };

  const handleDistributeBudget = () => {
    if (selectedRows.size === 0) {
      showAlert('분산할 예산을 선택해주세요.');
      return;
    }

    showConfirm('선택한 예산의 총액을 12개월로 균등 분산하시겠습니까?', () => {
      const newData = data.map(row => {
        if (selectedRows.has(row.id)) {
          const total = row.values.reduce((sum: number, val: number) => sum + val, 0);
          const baseValue = Math.floor(total / 12);
          const remainder = total % 12;
          
          const newValues = Array(12).fill(baseValue);
          newValues[11] += remainder;
          
          return { ...row, values: newValues };
        }
        return row;
      });
      setData(newData);
    });
  };

  const handleCopyAccount = () => {
    if (selectedRows.size === 0) {
      showAlert('복사할 계정을 선택해주세요.');
      return;
    }
    setCopyModal({ isOpen: true, count: 1 });
  };

  const confirmCopy = () => {
    const newData: any[] = [];
    data.forEach(row => {
      newData.push(row);
      if (selectedRows.has(row.id)) {
        for (let i = 0; i < copyModal.count; i++) {
          newData.push({
            ...row,
            id: `acc_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            values: [...row.values],
          });
        }
      }
    });
    
    setData(newData);
    setCopyModal({ ...copyModal, isOpen: false });
    showAlert(`${selectedRows.size}개의 계정이 각각 ${copyModal.count}개씩 복사되었습니다.`);
  };

  const handleDeleteAccount = () => {
    if (selectedRows.size === 0) {
      showAlert('삭제할 계정을 선택해주세요.');
      return;
    }

    if (selectedDeptCode === 'all') {
      showAlert('전체 보기 모드에서는 삭제가 불가능합니다.');
      return;
    }

    // Check if any selected row has actuals for the current year
    const selectedRowsData = data.filter(row => selectedRows.has(row.id));
    const rowsWithActuals = selectedRowsData.filter(row => {
      // The actualsMap key depends on whether we are in 'all' mode or specific dept mode
      // But handleDeleteAccount is only for specific dept mode (checked above)
      const actuals = actualsMap.get(row.code);
      if (!actuals) return false;
      return actuals.some(val => val !== 0);
    });

    if (rowsWithActuals.length > 0) {
      const names = Array.from(new Set(rowsWithActuals.map(r => r.name))).join(', ');
      showAlert(`실적 데이터가 있는 계정은 삭제할 수 없습니다: ${names}`);
      return;
    }

    showConfirm(`선택한 ${selectedRows.size}개의 계정을 삭제하시겠습니까?`, () => {
      const newData = data.filter(row => !selectedRows.has(row.id));
      setData(newData);
      
      const remainingCodes = new Set(newData.map(row => row.code));
      
      const savedSelectionsStr = localStorage.getItem(STORAGE_KEYS.DEPT_SELECTIONS);
      if (savedSelectionsStr) {
        const allSelections = JSON.parse(savedSelectionsStr);
        const deptSelections = allSelections[selectedDeptCode] || [];
        
        const savedAccountsStr = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
        let globalAccounts = INITIAL_CATEGORIES;
        if (savedAccountsStr) {
          globalAccounts = JSON.parse(savedAccountsStr);
        }
        const allAccountsMap = new Map();
        globalAccounts.forEach((cat: any) => {
          cat.accounts.forEach((acc: any) => {
            allAccountsMap.set(acc.id, acc);
          });
        });

        const updatedDeptSelections = deptSelections.filter((id: string) => {
          const account = allAccountsMap.get(id);
          if (account && !remainingCodes.has(account.code)) {
            return false;
          }
          return true;
        });

        allSelections[selectedDeptCode] = updatedDeptSelections;
        localStorage.setItem(STORAGE_KEYS.DEPT_SELECTIONS, JSON.stringify(allSelections));
      }

      const key = `${STORAGE_KEYS.BUDGET_DATA}_${selectedDeptCode}_${year}_${planType}`;
      localStorage.setItem(key, JSON.stringify(newData));

      setSelectedRows(new Set());
      showAlert('선택한 계정이 삭제되었습니다.');
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key: direction ? key : '', direction });
  };

  const getSortedAndFilteredData = () => {
    let filtered = [...data];
    
    // Apply department filter
    if (deptFilter !== 'all') {
      filtered = filtered.filter(row => row.attributedDeptCode === deptFilter);
    }

    // If 'viewable' or 'all' is selected, we force sort by department code first to allow grouping
    if (selectedDeptCode === 'viewable' || selectedDeptCode === 'all') {
      filtered.sort((a, b) => {
        const deptA = a.attributedDeptCode || '';
        const deptB = b.attributedDeptCode || '';
        if (deptA !== deptB) return deptA.localeCompare(deptB);
        return a.code.localeCompare(b.code);
      });
      return filtered;
    }

    if (!sortConfig.key || !sortConfig.direction) {
      return filtered.sort((a, b) => a.code.localeCompare(b.code));
    }

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'dept_code':
          const deptA = a.attributedDeptCode || '';
          const deptB = b.attributedDeptCode || '';
          if (deptA !== deptB) {
            return sortConfig.direction === 'asc' ? deptA.localeCompare(deptB) : deptB.localeCompare(deptA);
          }
          return a.code.localeCompare(b.code);
        case 'code':
          aValue = a.code;
          bValue = b.code;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'total':
          aValue = a.values.reduce((sum: number, val: number) => sum + val, 0);
          bValue = b.values.reduce((sum: number, val: number) => sum + val, 0);
          break;
        case 'dept':
          aValue = allDepts.find(d => d.code === a.attributedDeptCode)?.name || '';
          bValue = allDepts.find(d => d.code === b.attributedDeptCode)?.name || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedData = getSortedAndFilteredData();

  // Filter rows: show only if it has actuals, plan values, or is explicitly selected
  const getFilteredData = (rows: any[]) => {
    const savedSelectionsStr = localStorage.getItem(STORAGE_KEYS.DEPT_SELECTIONS);
    const allSelections = savedSelectionsStr ? JSON.parse(savedSelectionsStr) : {};
    const deptSelectedIds = new Set(allSelections[selectedDeptCode] || []);
    
    // 선택된 계정들의 '코드' 셋 생성 (ID 매칭 실패 시 코드 매칭 시도)
    const deptSelectedCodes = new Set();
    deptSelectedIds.forEach(id => {
      const acc = allAccountsMap.get(id);
      if (acc) deptSelectedCodes.add(acc.code);
    });

    return rows.filter(row => {
      // 1. Has actuals
      const actuals = actualsMap.get(`${row.attributedDeptCode}_${row.sourceDeptCode}_${row.code}`) || 
                     actualsMap.get(`${row.attributedDeptCode}_${row.sourceDeptCode}_${row.id}`) ||
                     actualsMap.get(row.code);
      const hasActuals = actuals && actuals.some(v => v !== 0);

      // 2. Has plan values
      const hasPlan = row.values && row.values.some((v: number) => v !== 0);

      // 3. Is selected in budget accounts
      const isSelected = deptSelectedIds.has(row.id) || deptSelectedIds.has(row.code) || deptSelectedCodes.has(row.code);

      // 관리부서(전체) 필터링 시 0만 있는 계정은 UI에서 숨김 (다운로드 시에는 data에 포함되어 있으므로 다운로드됨)
      if (selectedDeptCode === 'all') {
        const isOnlyZeros = row.values && row.values.every((v: number) => v === 0);
        if (isOnlyZeros && !hasActuals) {
          return false;
        }
      }

      // 상태 필터 적용
      if (viewFilters.hideEmptyRows && !hasPlan && !hasActuals) {
        return false;
      }
      if (viewFilters.showOnlyWithAmount && !hasPlan) {
        return false;
      }
      if (viewFilters.showOnlyNeedsInput && hasPlan) {
        return false; // 이미 금액이 있으면 입력 필요 아님
      }

      return hasActuals || hasPlan || isSelected;
    });
  };

  const filteredAndSortedData = getFilteredData(sortedData);

  const handleImportData = () => {
    const { sourceYear, sourceType, sourcePlanType, selectedMonths } = importModal;
    
    if (sourceType === 'actual') {
      const actualDataStr = localStorage.getItem(`${STORAGE_KEYS.ACTUAL_DATA}_${sourceYear}`);
      const actualData = actualDataStr ? JSON.parse(actualDataStr) : [];
      
      // Filter actual data for this department and aggregate by account
      const deptActuals = actualData.filter((item: any) => item.usageCode === selectedDeptCode);
      const tempActualsMap = new Map<string, number[]>();
      
      deptActuals.forEach((actual: any) => {
        const monthIndex = parsePeriodMonth(String(actual.period)) ?? -1;

        if (monthIndex >= 0 && monthIndex < 12) {
          if (!tempActualsMap.has(actual.accountCode)) {
            tempActualsMap.set(actual.accountCode, Array(12).fill(0));
          }
          tempActualsMap.get(actual.accountCode)![monthIndex] += actual.completed;
        }
      });

      const newData = data.map(row => {
        const actuals = tempActualsMap.get(row.code);
        if (!actuals) return row;

        const newValues = [...row.values];
        selectedMonths.forEach((selected, idx) => {
          if (selected && actuals[idx] !== undefined) {
            newValues[idx] = actuals[idx];
          }
        });

        return { 
          ...row, 
          values: newValues,
          // Preserve existing details and calculation if they are already written
          detail: row.detail || '',
          calculation: row.calculation || '',
          remark: row.remark || ''
        };
      });

      setData(newData);
      showAlert(`${sourceYear}년 실적 데이터를 성공적으로 가져왔습니다.`);
    } else {
      // Real budget import
      const sourceKey = `${STORAGE_KEYS.BUDGET_DATA}_${selectedDeptCode}_${sourceYear}_${sourcePlanType}`;
      const sourceDataStr = localStorage.getItem(sourceKey);
      const sourceData = sourceDataStr ? JSON.parse(sourceDataStr) : [];

      if (sourceData.length === 0) {
        showAlert(`${sourceYear}년 ${sourcePlanType} 데이터를 찾을 수 없습니다.`);
        return;
      }

      const newData = data.map(row => {
        // Find matching row in sourceData (by code and detail if possible)
        let match = sourceData.find((s: any) => s.code === row.code && s.detail === row.detail);
        if (!match) {
          match = sourceData.find((s: any) => s.code === row.code);
        }

        if (!match) return row;

        const newValues = [...row.values];
        selectedMonths.forEach((selected, idx) => {
          if (selected && match.values[idx] !== undefined) {
            newValues[idx] = match.values[idx];
          }
        });

        return { 
          ...row, 
          values: newValues,
          // Preserve existing details, otherwise take from source
          detail: row.detail || match.detail || '',
          calculation: row.calculation || match.calculation || '',
          remark: row.remark || match.remark || ''
        };
      });

      setData(newData);
      showAlert(`${sourceYear}년 ${sourcePlanType} 데이터를 성공적으로 가져왔습니다.`);
    }
    
    setImportModal({ ...importModal, isOpen: false });
  };

  const toggleImportMonth = (index: number) => {
    const newMonths = [...importModal.selectedMonths];
    newMonths[index] = !newMonths[index];
    setImportModal({ ...importModal, selectedMonths: newMonths });
  };

  const toggleAllImportMonths = () => {
    const allSelected = importModal.selectedMonths.every(m => m);
    setImportModal({ ...importModal, selectedMonths: Array(12).fill(!allSelected) });
  };

  const handleExportExcel = () => {
    if (data.length === 0) {
      showAlert('다운로드할 데이터가 없습니다.');
      return;
    }

    const wb = XLSX.utils.book_new();

    if (selectedDeptCode === 'all' || selectedDeptCode === 'viewable') {
      const deptGroups = new Map<string, any[]>();
      data.forEach(row => {
        const deptCode = row.attributedDeptCode;
        if (!deptGroups.has(deptCode)) {
          deptGroups.set(deptCode, []);
        }
        deptGroups.get(deptCode)!.push(row);
      });

      if (selectedDeptCode === 'all') {
        const validDepts = allDepts.filter(d => d.code !== '99999');
        validDepts.forEach(dept => {
          if (!deptGroups.has(dept.code)) {
            deptGroups.set(dept.code, []);
          }
          const rows = deptGroups.get(dept.code)!;
          
          const savedAccountsStr = localStorage.getItem(STORAGE_KEYS.GLOBAL_ACCOUNTS);
          let globalAccounts = INITIAL_CATEGORIES;
          if (savedAccountsStr) {
            globalAccounts = JSON.parse(savedAccountsStr);
          }
          const allAccountsMap = new Map();
          globalAccounts.forEach((cat: any) => {
            cat.accounts.forEach((acc: any) => {
              allAccountsMap.set(acc.id, acc);
            });
          });

          Array.from(allAccountsMap.values()).forEach((acc: any) => {
            const exists = rows.some(r => r.code === acc.code);
            if (!exists) {
              if (!hasSalaryAccess) {
                const isSalary = SALARY_CATEGORIES.some(cat => {
                  const category = INITIAL_CATEGORIES.find(c => c.name === cat);
                  return category?.accounts.some((a: any) => a.code === acc.code);
                });
                if (isSalary) return;
              }

              rows.push({
                id: `dummy_${dept.code}_${acc.code}`,
                code: acc.code,
                name: acc.name,
                values: Array(12).fill(1),
                attributedDeptCode: dept.code,
                sourceDeptCode: dept.code,
                detail: '',
                calculation: '',
                remark: ''
              });
            }
          });
        });
      }

      deptGroups.forEach((rows, deptCode) => {
        const deptName = allDepts.find(d => d.code === deptCode)?.name || deptCode;
        
        let wsData;
        if (selectedDeptCode === 'all') {
          wsData = [
            ['연도', '계획구분', '예산유형', '관리구분', '작성부서', '귀속부서', '계정코드', '계정명', '연간금액', ...Array.from({length: 12}, (_, i) => `${i + 1}월`)],
            ...rows.map(row => [
              year,
              planType,
              (row.budgetType || inferBudgetTypeByAccountCode(row.code)) === 'GENERAL' ? '일반' : '투자',
              row.managementCategory || inferManagementCategoryByAccountCode(row.code),
              allDepts.find((d: any) => d.code === (row.sourceDeptCode || row.attributedDeptCode))?.name || '',
              deptName,
              row.code,
              row.name,
              row.values.reduce((a: number, b: number) => a + b, 0),
              ...row.values
            ])
          ];
        } else {
          wsData = [
            ['연도', '계획구분', '예산유형', '관리구분', '작성부서', '귀속부서', '계정코드', '계정명', '연간금액', ...Array.from({length: 12}, (_, i) => `${i + 1}월`)],
            ...rows.map(row => [
              year,
              planType,
              (row.budgetType || inferBudgetTypeByAccountCode(row.code)) === 'GENERAL' ? '일반' : '투자',
              row.managementCategory || inferManagementCategoryByAccountCode(row.code),
              allDepts.find((d: any) => d.code === (row.sourceDeptCode || row.attributedDeptCode))?.name || '',
              deptName,
              row.code,
              row.name,
              row.values.reduce((a: number, b: number) => a + b, 0),
              ...row.values
            ])
          ];
        }
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        Object.keys(ws).forEach(key => {
          if (key[0] === '!') return;
          if (ws[key].t === 'n') {
            ws[key].z = '#,##0';
          }
        });

        const safeSheetName = deptName.replace(/[\\/?*[\]]/g, '').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });
    } else {
      const wsData = [
        ['연도', '계획구분', '예산유형', '관리구분', '작성부서', '귀속부서', '계정코드', '계정명', '연간금액', ...Array.from({length: 12}, (_, i) => `${i + 1}월`)],
        ...data.map(row => [
          year,
          planType,
          (row.budgetType || inferBudgetTypeByAccountCode(row.code)) === 'GENERAL' ? '일반' : '투자',
          row.managementCategory || inferManagementCategoryByAccountCode(row.code),
          allDepts.find((d: any) => d.code === (row.sourceDeptCode || row.attributedDeptCode))?.name || '',
          allDepts.find((d: any) => d.code === row.attributedDeptCode)?.name || '',
          row.code,
          row.name,
          row.values.reduce((a: number, b: number) => a + b, 0),
          ...row.values
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      Object.keys(ws).forEach(key => {
        if (key[0] === '!') return;
        if (ws[key].t === 'n') {
          ws[key].z = '#,##0';
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, '예산데이터');
    }

    XLSX.writeFile(wb, `예산데이터_${year}_${planType}_${currentDept.name}.xlsx`);
  };

  const handleSave = () => {
    if (selectedDeptCode === 'all') {
      showAlert('전체 보기 모드에서는 저장이 불가능합니다. 개별 부서를 선택해주세요.');
      return;
    }
    if (isBudgetLocked(selectedDeptCode, year, planType)) {
      showAlert('이미 상신 및 승인된 예산은 수정할 수 없습니다.');
      return;
    }
    const key = getBudgetDataKey(selectedDeptCode, year, planType);
    localStorage.setItem(key, JSON.stringify(data));
    showAlert('예산 데이터가 임시 저장되었습니다.');
  };

  const handleReset = () => {
    if (selectedDeptCode === 'all') {
      showAlert('전체 보기 모드에서는 초기화가 불가능합니다.');
      return;
    }
    if (isBudgetLocked(selectedDeptCode, year, planType)) {
      showAlert('이미 상신 및 승인된 예산은 수정할 수 없습니다.');
      return;
    }
    showConfirm('정말 초기화하시겠습니까?', () => {
      const key = getBudgetDataKey(selectedDeptCode, year, planType);
      localStorage.removeItem(key);
      setReloadTrigger(prev => prev + 1);
      showAlert('초기화되었습니다.');
    });
  };

  const handleSubmit = () => {
    if (selectedDeptCode === 'all') {
      showAlert('전체 보기 모드에서는 상신이 불가능합니다.');
      return;
    }
    showConfirm('작성한 예산을 상신하시겠습니까? 상신 후에는 수정이 제한될 수 있습니다.', async () => {
      const key = getBudgetDataKey(selectedDeptCode, year, planType);
      localStorage.setItem(key, JSON.stringify(data));
      
      // Save submission status
      const statusKey = STORAGE_KEYS.SUBMISSION_STATUS;
      const statuses = JSON.parse(localStorage.getItem(statusKey) || '{}');
      const now = new Date().toLocaleString();
      
      const newStatus: SubmissionStatus = {
        status: 'SUBMITTED',
        time: now,
        deptName: currentDept.name
      };
      
      statuses[getSubmissionStatusMapKey(selectedDeptCode, year, planType)] = newStatus;
      localStorage.setItem(statusKey, JSON.stringify(statuses));
      setSubmissionStatus(newStatus);

      // Add notification
      const notificationKey = 'budget_notifications';
      const notifications = JSON.parse(localStorage.getItem(notificationKey) || '[]');
      const newNotif = {
        id: Date.now().toString(),
        type: 'submission',
        deptCode: selectedDeptCode,
        deptName: currentDept.name,
        action: '상신',
        time: now,
        isRead: false
      };
      localStorage.setItem(notificationKey, JSON.stringify([newNotif, ...notifications]));

      // Send email
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'su@poscohycm.com',
            subject: `[예산상신] ${currentDept.name} - ${year}년 ${planType}`,
            text: `${currentDept.name} 부서에서 ${year}년 ${planType}을 상신하였습니다.\n상신 시간: ${now}`
          })
        });
      } catch (e) {
        console.error('Email send failed:', e);
      }

      // Update data to be read-only
      setData(prev => prev.map(row => ({ ...row, isReadOnly: true })));

      showAlert('예산이 성공적으로 상신되었습니다.');
    });
  };

  const handleCancelSubmission = () => {
    showConfirm('상신을 취소하시겠습니까? 취소 후에는 다시 수정할 수 있습니다.', async () => {
      const statusKey = STORAGE_KEYS.SUBMISSION_STATUS;
      const statuses = JSON.parse(localStorage.getItem(statusKey) || '{}');
      const now = new Date().toLocaleString();
      
      const newStatus: SubmissionStatus = {
        status: 'DRAFT',
        time: now,
        deptName: currentDept.name
      };
      
      statuses[getSubmissionStatusMapKey(selectedDeptCode, year, planType)] = newStatus;
      localStorage.setItem(statusKey, JSON.stringify(statuses));
      setSubmissionStatus(newStatus);

      // Add notification
      const notificationKey = 'budget_notifications';
      const notifications = JSON.parse(localStorage.getItem(notificationKey) || '[]');
      const newNotif = {
        id: Date.now().toString(),
        type: 'cancellation',
        deptCode: selectedDeptCode,
        deptName: currentDept.name,
        action: '상신 취소',
        time: now,
        isRead: false
      };
      localStorage.setItem(notificationKey, JSON.stringify([newNotif, ...notifications]));

      // Send email
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'su@poscohycm.com',
            subject: `[상신취소] ${currentDept.name} - ${year}년 ${planType}`,
            text: `${currentDept.name} 부서에서 ${year}년 ${planType} 상신을 취소하였습니다.\n취소 시간: ${now}`
          })
        });
      } catch (e) {
        console.error('Email send failed:', e);
      }

      // Update data to be editable (except those that were already read-only)
      setReloadTrigger(prev => prev + 1);

      showAlert('상신이 취소되었습니다. 이제 수정이 가능합니다.');
    });
  };

  const handleApproveReject = (newStatusType: 'APPROVED' | 'REJECTED') => {
    const actionName = newStatusType === 'APPROVED' ? '승인' : '반려';
    
    const proceed = async () => {
      const statusKey = STORAGE_KEYS.SUBMISSION_STATUS;
      const statuses = JSON.parse(localStorage.getItem(statusKey) || '{}');
      const now = new Date().toLocaleString();
      
      const newStatus: SubmissionStatus = {
        status: newStatusType,
        time: now,
        deptName: currentDept.name,
        reason: newStatusType === 'REJECTED' ? rejectReason : undefined
      };
      
      statuses[getSubmissionStatusMapKey(selectedDeptCode, year, planType)] = newStatus;
      localStorage.setItem(statusKey, JSON.stringify(statuses));
      setSubmissionStatus(newStatus);

      // Add notification
      const notificationKey = 'budget_notifications';
      const notifications = JSON.parse(localStorage.getItem(notificationKey) || '[]');
      const newNotif = {
        id: Date.now().toString(),
        type: newStatusType.toLowerCase(),
        deptCode: selectedDeptCode,
        deptName: currentDept.name,
        action: actionName,
        time: now,
        isRead: false
      };
      localStorage.setItem(notificationKey, JSON.stringify([newNotif, ...notifications]));

      // If rejected, make data editable again
      if (newStatusType === 'REJECTED') {
        setReloadTrigger(prev => prev + 1);
        setRejectModalOpen(false);
        setRejectReason('');
      }

      showAlert(`예산이 ${actionName}되었습니다.`);
    };

    if (newStatusType === 'APPROVED') {
      showConfirm('해당 부서의 예산을 승인하시겠습니까? 승인 후에는 수정이 불가능합니다.', proceed);
    } else {
      proceed();
    }
  };

  const formatNumber = (num: number) => {
    return num === 0 ? '' : num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* 2026 Navigation Flow Assist Card */}
      <div className="bg-[#fcfaf2] border border-[#f5ead2] p-4.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 shadow-xs">
        <div>
          <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded font-bold font-mono">FLOW CONSOLE</span>
          <h4 className="text-sm font-bold text-zinc-900 mt-1.5">📂 예산 작성 업무 흐름 제어판</h4>
          <p className="text-xs text-zinc-500 mt-0.5">예산 작성 전, 계정 체크 상태 및 실적 부서 귀속 설정을 먼저 완료하여 유기적으로 배포하십시오.</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => navigate('/account-selection')}
            className="flex-1 sm:flex-none px-4 py-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 bg-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
          >
            &larr; 계정 선택 (전 단계)
          </button>
          <button
            onClick={() => navigate('/department-assignment')}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#008f83] hover:bg-[#00746b] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
          >
            실적 부서 귀속 설정 &rarr;
          </button>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-lithium-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-bold text-lithium-500 uppercase mb-1">작성 부서</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-4 w-4 text-lithium-500" />
              </div>
              <select 
                value={selectedDeptCode} 
                onChange={(e) => setSelectedDeptCode(e.target.value)}
                className="bg-lithium-100 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 block w-40 pl-9 p-2.5 font-bold appearance-none"
              >
                <option value="viewable">조회 가능 부서</option>
                {(currentUser?.code === '99999' || currentUser?.code === '32100') ? (
                  <>
                    <option value="all">관리부서 (전체)</option>
                    <option value="by_dept">부서별 보기</option>
                    <option value="mfg">제조 - 전체부서</option>
                    <option value="sga">판관 - 전체부서</option>
                    {viewableDepts.map(dept => (
                      <option key={dept.code} value={dept.code}>{dept.name}</option>
                    ))}
                  </>
                ) : (
                  <optgroup label="관리부서">
                    {viewableDepts.map(dept => (
                      <option key={dept.code} value={dept.code}>{dept.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-lithium-500 uppercase mb-1">연도</label>
            <select 
              value={year} 
              onChange={(e) => setYear(e.target.value)}
              className="bg-lithium-100 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 block w-32 p-2.5 font-medium appearance-none"
            >
              <option value="2025">2025년</option>
              <option value="2026">2026년</option>
              <option value="2027">2027년</option>
              <option value="2028">2028년</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-lithium-500 uppercase mb-1">계획 구분</label>
            <div className="flex items-center gap-2">
              <select 
                value={planType} 
                onChange={(e) => setPlanType(e.target.value)}
                className="bg-lithium-100 border-none text-eco-black text-sm rounded-xl focus:ring-2 focus:ring-nickel-500 block w-40 p-2.5 font-medium appearance-none"
              >
                <option value="경영계획">경영계획</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차 RP">1차 RP</option>
                <option value="2차 RP">2차 RP</option>
                <option value="실적">실적</option>
              </select>
              {selectedDeptCode === 'all' && (
                <button
                  onClick={() => handleSort('dept_code')}
                  className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    sortConfig.key === 'dept_code' 
                      ? 'bg-nickel-600 text-white shadow-md' 
                      : 'bg-lithium-100 text-lithium-600 hover:bg-lithium-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                  부서별 보기
                  {sortConfig.key === 'dept_code' && (
                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Data Import Group */}
          <div className="flex items-center gap-1.5 p-1 bg-lithium-100 rounded-2xl">
            <button 
              onClick={() => setImportModal({ ...importModal, isOpen: true })} 
              disabled={planType === '실적' || isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5 text-nickel-600" />
              데이터 가져오기
            </button>
            <button 
              onClick={handleDistributeBudget} 
              disabled={planType === '실적' || isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Divide className="w-3.5 h-3.5 mr-1.5 text-nickel-600" />
              입력예산분산
            </button>
            <button 
              onClick={handleCopyAccount} 
              disabled={planType === '실적' || isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5 text-nickel-600" />
              계정복사
            </button>
            <button 
              onClick={handleDeleteAccount} 
              disabled={planType === '실적' || isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-500" />
              계정삭제
            </button>
          </div>

          {/* Action Group */}
          <div className="flex items-center gap-1.5 p-1 bg-lithium-100 rounded-2xl">
            <button 
              onClick={handleSave} 
              disabled={isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5 mr-1.5 text-nickel-600" />
              임시저장
            </button>
            
            {submissionStatus.status === 'SUBMITTED' && isAdmin ? (
              <>
                <button 
                  onClick={() => handleApproveReject('APPROVED')}
                  className="flex items-center justify-center w-[120px] py-1.5 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  승인
                </button>
                <button 
                  onClick={() => setRejectModalOpen(true)}
                  className="flex items-center justify-center w-[120px] py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all shadow-sm"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  반려
                </button>
              </>
            ) : submissionStatus.status === 'SUBMITTED' ? (
              <button 
                onClick={handleCancelSubmission}
                className="flex items-center justify-center w-[120px] py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                상신 취소
              </button>
            ) : submissionStatus.status === 'APPROVED' ? (
              <div className="flex items-center justify-center w-[120px] py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-xl text-xs font-bold shadow-sm">
                <Check className="w-3.5 h-3.5 mr-1.5" />
                승인 완료
              </div>
            ) : submissionStatus.status === 'REJECTED' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold shadow-sm" title={submissionStatus.reason}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  반려됨
                </div>
                <button 
                  onClick={handleSubmit} 
                  disabled={planType === '실적'}
                  className="flex items-center justify-center w-[120px] py-1.5 bg-nickel-600 text-white rounded-xl text-xs font-bold hover:bg-nickel-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  재상신하기
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSubmit} 
                disabled={planType === '실적'}
                className="flex items-center justify-center w-[120px] py-1.5 bg-nickel-600 text-white rounded-xl text-xs font-bold hover:bg-nickel-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                상신하기
              </button>
            )}

            <button 
              onClick={handleReset} 
              disabled={isLocked}
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-500" />
              초기화
            </button>
            <button 
              onClick={handleExportExcel} 
              className="flex items-center justify-center w-[120px] py-1.5 bg-white text-lithium-600 border border-lithium-200 rounded-xl text-xs font-bold hover:bg-lithium-50 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-nickel-600" />
              엑셀 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div className="bg-white rounded-2xl border border-lithium-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-lithium-200 flex flex-wrap justify-between items-center bg-lithium-50 gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-bold text-eco-black">{currentDept.name} 예산 입력 그리드</h2>
            
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-lithium-200">
              <label className="flex items-center gap-1.5 text-xs font-bold text-lithium-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-lithium-300 text-brand-600 focus:ring-brand-500"
                  checked={viewFilters.hideEmptyRows}
                  onChange={(e) => setViewFilters(prev => ({...prev, hideEmptyRows: e.target.checked}))}
                />
                빈 row 숨기기
              </label>
              <div className="w-px h-4 bg-lithium-200 mx-1"></div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-lithium-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-lithium-300 text-brand-600 focus:ring-brand-500"
                  checked={viewFilters.showOnlyWithAmount}
                  onChange={(e) => setViewFilters(prev => ({...prev, showOnlyWithAmount: e.target.checked}))}
                />
                금액 있는 계정만
              </label>
              <div className="w-px h-4 bg-lithium-200 mx-1"></div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-lithium-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-lithium-300 text-brand-600 focus:ring-brand-500"
                  checked={viewFilters.showOnlyNeedsInput}
                  onChange={(e) => setViewFilters(prev => ({...prev, showOnlyNeedsInput: e.target.checked}))}
                />
                입력 필요 계정만
              </label>
            </div>
            
            <button 
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className={`flex items-center justify-center px-3 py-1.5 rounded text-xs font-bold border transition-colors ${isDetailsExpanded ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-lithium-300 text-lithium-600 hover:bg-lithium-100'}`}
            >
              {isDetailsExpanded ? "상세 패널 숨기기" : "상세 패널 펼치기"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center text-xs text-lithium-500">
              <ClipboardPaste className="w-4 h-4 mr-1" />
              엑셀에서 복사(Ctrl+C) 후 그리드에 붙여넣기(Ctrl+V) 가능
            </div>
          </div>
        </div>
        
        {data.length === 0 ? (
          <div className="p-12 text-center text-lithium-500">
            <p className="text-lg font-bold text-eco-black mb-2">선택된 예산 계정이 없습니다.</p>
            <p>'예산 계정 선택' 메뉴에서 {currentDept.name}이 사용할 계정을 먼저 선택하고 저장해주세요.</p>
          </div>
        ) : (
          <div className="flex flex-row overflow-hidden flex-1 group">
          <div 
            className="overflow-x-auto p-4 flex-1"
            ref={gridRef}
            onPaste={handlePaste}
          >
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', width: 'max-content' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-lithium-50 p-0 border border-lithium-200 w-12">
                    <div className="flex items-center justify-center px-4 py-3 w-full">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-nickel-600 rounded border-gray-300 focus:ring-nickel-500 cursor-pointer"
                        checked={sortedData.length > 0 && selectedRows.size === sortedData.length}
                        onChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-16">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      연도
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-20">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      계획구분
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-20">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      예산유형
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-24">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      관리구분
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-28">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      작성부서
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-28">
                    <div className="flex flex-col w-full">
                      <button 
                        onClick={() => handleSort('dept')}
                        className="flex items-center justify-center gap-1.5 px-4 pt-2 pb-1 text-xs font-semibold text-lithium-600 w-full hover:bg-lithium-100 transition-colors group border-b border-lithium-200"
                      >
                        귀속부서
                        {sortConfig.key === 'dept' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-nickel-500" /> : <ArrowDown className="w-3 h-3 text-nickel-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-lithium-300 opacity-0 group-hover:opacity-100" />
                        )}
                      </button>
                      {selectedDeptCode !== 'all' && (
                        <div className="px-2 py-1 bg-white">
                          <select 
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="w-full text-[10px] bg-lithium-50 border-none rounded p-1 focus:ring-1 focus:ring-nickel-500 outline-none font-medium"
                          >
                            <option value="all">전체 부서</option>
                            {allDepts.filter((d: any) => d.code !== '99999').map((dept: any) => (
                              <option key={dept.code} value={dept.code}>{dept.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="sticky left-12 z-10 bg-lithium-50 p-0 border border-lithium-200 w-24">
                    <button 
                      onClick={() => handleSort('code')}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-lithium-600 w-full hover:bg-lithium-100 transition-colors group"
                    >
                      계정코드
                      {sortConfig.key === 'code' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-nickel-500" /> : <ArrowDown className="w-3 h-3 text-nickel-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-lithium-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="sticky left-36 z-10 bg-lithium-50 p-0 border border-lithium-200" style={{ width: colWidths.name, minWidth: colWidths.name }}>
                    <ResizableHeader 
                      title="계정명" 
                      width={colWidths.name} 
                      minWidth={80} 
                      onResize={handleNameColResize} 
                    />
                  </th>
                  <th className="bg-brand-50 p-0 border border-[#e5e8eb] w-32">
                    <button 
                      onClick={() => handleSort('total')}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-brand-700 w-full hover:bg-brand-100 transition-colors group"
                    >
                      연간금액
                      {sortConfig.key === 'total' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-brand-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <th key={i} className="bg-[#f9fafb] p-0 border border-[#e5e8eb]" style={{ width: colWidths.months[i], minWidth: colWidths.months[i] }}>
                      <ResizableHeader 
                        title={`${i + 1}월`} 
                        width={colWidths.months[i]} 
                        minWidth={60} 
                        onResize={(w: number) => handleMonthColResize(i, w)} 
                      />
                    </th>
                  ))}
</tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((row, rowIndex) => {
                  const rowTotal = row.values.reduce((sum: number, val: number) => sum + val, 0);
                  
                  // Grouping logic for 'viewable'
                  const isIntegratedView = selectedDeptCode === 'viewable';
                  const showDeptHeader = isIntegratedView && 
                    (rowIndex === 0 || filteredAndSortedData[rowIndex - 1].attributedDeptCode !== row.attributedDeptCode);
                  
                  const deptName = row.attributedDeptCode === 'all' ? '전체' : (allDepts.find(d => d.code === row.attributedDeptCode)?.name || '기획재무그룹');
                  const isReceived = row.sourceDeptCode && row.sourceDeptCode !== row.attributedDeptCode && row.attributedDeptCode === selectedDeptCode;
                  const isHandedOver = row.isHandedOver || (row.sourceDeptCode && row.sourceDeptCode !== row.attributedDeptCode && row.sourceDeptCode === selectedDeptCode && row.attributedDeptCode !== selectedDeptCode);

                  return (
                    <React.Fragment key={`${row.code}_${row.attributedDeptCode}_${rowIndex}`}>
                      {showDeptHeader && (
                        <tr className="bg-[#f2f4f6] border-y border-[#e5e8eb]">
                          <td colSpan={100} className="px-4 py-3 text-sm font-bold text-[#191f28] text-left">
                            {deptName}
                          </td>
                        </tr>
                      )}
                      <tr 
                        className={`hover:bg-[#f9fafb] transition-colors ${selectedRows.has(row.id) ? 'bg-brand-50' : (isHandedOver ? 'bg-red-50' : (isReceived ? 'bg-[#FFFFCC]' : ''))}`}
                        onClick={(e) => handleSelectRow(row.id, rowIndex, e as any)}
                      >
                      <td className={`sticky left-0 z-10 ${selectedRows.has(row.id) ? 'bg-brand-50' : (isHandedOver ? 'bg-red-50' : (isReceived ? 'bg-[#FFFFCC]' : 'bg-white'))} px-4 py-2 border border-[#e5e8eb] text-center align-top`}>
                        <div className="flex items-center justify-center h-full min-h-[44px]">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                            checked={selectedRows.has(row.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectRow(row.id, rowIndex, e as any);
                            }}
                          />
                        </div>
                      </td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">{year}</td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">{planType}</td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        {row.budgetType ? (row.budgetType === 'GENERAL' ? '일반' : '투자') : (inferBudgetTypeByAccountCode(row.code) === 'GENERAL' ? '일반' : '투자')}
                      </td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        {row.managementCategory || inferManagementCategoryByAccountCode(row.code)}
                      </td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        {allDepts.find((d: any) => d.code === (row.sourceDeptCode || row.attributedDeptCode))?.name || '부서오류'}
                      </td>
                      <td className="bg-white p-0 border border-[#e5e8eb] text-center align-top">
                        <div className="relative group/dept min-h-[44px] flex items-center justify-center">
                          {selectedDeptCode !== 'all' ? (
                            <select
                              value={row.attributedDeptCode}
                              onChange={(e) => handleAttributedDeptChange(row.id, e.target.value)}
                              disabled={(row.isReadOnly && planType !== '실적') || isLocked}
                              className={`w-full h-full min-h-[44px] pl-3 pr-8 py-2 text-sm text-[#191f28] bg-transparent outline-none focus:ring-2 focus:ring-brand-500 appearance-none font-medium text-center ${((row.isReadOnly && planType !== '실적') || isLocked) ? 'bg-[#f9fafb] cursor-not-allowed' : ''}`}
                            >
                              {allDepts.filter((d: any) => d.code !== '99999').map((dept: any) => (
                                <option key={dept.code} value={dept.code}>{dept.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="px-4 py-2 whitespace-nowrap">{deptName}</div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/department-assignment');
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/dept:opacity-100 p-0.5 text-[#008f83] hover:bg-[#008f83]/10 rounded bg-white border border-zinc-200 transition-opacity z-10 shadow-sm cursor-pointer"
                            title="부서 귀속 변경 포털 화면으로 즉시 이동"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className={`sticky left-12 z-10 ${selectedRows.has(row.id) ? 'bg-brand-50' : (isHandedOver ? 'bg-red-50 text-red-700 font-bold' : (isReceived ? 'bg-[#FFFFCC] text-amber-700 font-bold' : 'bg-white text-[#4e5968]'))} px-4 py-2 text-sm border border-[#e5e8eb] text-center font-mono align-top`}>{row.code}</td>
                      <td className={`sticky left-36 z-10 ${selectedRows.has(row.id) ? 'bg-brand-50' : (isHandedOver ? 'bg-red-50' : (isReceived ? 'bg-[#FFFFCC]' : 'bg-white'))} px-4 py-2 text-sm font-bold text-[#191f28] border border-[#e5e8eb] text-center align-top`}>
                        <div className="line-clamp-2 w-full text-left" title={row.name}>{row.name}</div>
                      </td>
                      <td className="px-4 py-2 text-sm font-bold text-brand-700 border border-[#e5e8eb] text-right bg-brand-50/30 align-top">
                        {rowTotal.toLocaleString()}
                      </td>
                      {row.values.map((val: number, colIndex: number) => {
                        const actualKey = `${row.attributedDeptCode}_${row.sourceDeptCode || row.attributedDeptCode}_${row.code}`;
                        const actualVal = actualsMap.get(actualKey)?.[colIndex];
                        return (
                          <td key={colIndex} className="p-0 border border-[#e5e8eb] align-top">
                            <div className="relative group h-full">
                              <input
                                id={`cell-${rowIndex}-${colIndex}`}
                                type="text"
                                value={formatNumber(val)}
                                onChange={(e) => {
                                  let valStr = e.target.value.replace(/,/g, '');
                                  if (valStr === '' || valStr === '-') valStr = '0';
                                  const num = Number(valStr);
                                  if (num < 0) return;
                                  handleCellChange(row.id, colIndex, e.target.value);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                onFocus={() => setFocusedCell({ rowIndex, colIndex })}
                                readOnly={row.isReadOnly || isLocked}
                                className={`w-full h-full min-h-[44px] px-4 py-3 text-right text-sm outline-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:z-20 relative bg-transparent text-[#191f28] tabular-nums ${val === 0 ? 'text-opacity-30' : 'font-bold'} ${(row.isReadOnly || isLocked) ? 'bg-[#f9fafb] cursor-not-allowed' : ''} ${val !== 0 && !row.isReadOnly && !isLocked ? 'bg-blue-50/10' : ''}`}
                                placeholder="0"
                              />
                              {planType === '실적' && row.budgetValues && row.budgetValues[colIndex] !== 0 && (
                                <div className="absolute bottom-0.5 left-1 pointer-events-none">
                                  <span className="text-[9px] text-gray-400 font-medium bg-gray-50 px-1 rounded leading-none">
                                    계획: {formatNumber(row.budgetValues[colIndex])}
                                  </span>
                                </div>
                              )}
                              {actualVal !== undefined && actualVal !== 0 && planType !== '실적' && (
                                <div className="absolute bottom-0.5 right-1 pointer-events-none">
                                  <span className="text-[9px] text-brand-500 font-bold bg-brand-50 px-1 rounded leading-none">
                                    실적: {actualVal.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} className="sticky left-0 z-10 bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-[#191f28] border border-[#e5e8eb] text-center">
                    합계
                  </td>
                  <td className="bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-brand-700 border border-[#e5e8eb] text-right">
                    {filteredAndSortedData.filter(r => !r.isHandedOver).reduce((sum, row) => sum + row.values.reduce((a: number, b: number) => a + b, 0), 0).toLocaleString()}
                  </td>
                  {Array.from({ length: 12 }).map((_, colIndex) => {
                    const colTotal = filteredAndSortedData.filter(r => !r.isHandedOver).reduce((sum, row) => sum + row.values[colIndex], 0);
                    return (
                      <td key={colIndex} className="bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-[#191f28] border border-[#e5e8eb] text-right">
                        {colTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Detail Panel */}
          {isDetailsExpanded && (
            <div className="w-[300px] flex-shrink-0 border-l border-lithium-200 bg-lithium-50 flex flex-col h-full overflow-y-auto">
              <div className="p-4 border-b border-lithium-200 sticky top-0 bg-lithium-50 z-10 flex justify-between items-center">
                <h3 className="font-bold text-eco-black text-sm">상세 내역</h3>
                <button onClick={() => setIsDetailsExpanded(false)} className="text-lithium-500 hover:text-lithium-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex-1 space-y-4">
                {selectedRows.size === 1 ? (
                  data.filter(r => selectedRows.has(r.id)).map(selectedRow => {
                    return (
                      <div key={selectedRow.id} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">계정과목</label>
                          <div className="text-sm font-medium text-eco-black overflow-hidden text-ellipsis whitespace-nowrap" title={selectedRow.name}>
                            [{selectedRow.code}] {selectedRow.name}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">내역</label>
                          <textarea
                            value={selectedRow.detail || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'detail', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[80px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="상세 내역 입력..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">산출기준</label>
                          <textarea
                            value={selectedRow.calculation || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'calculation', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[80px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="산출기준 입력..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">비고 (메모)</label>
                          <textarea
                            value={selectedRow.remark || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'remark', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[60px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="메모 입력..."
                          />
                        </div>
                      </div>
                    );
                  })
                ) : selectedRows.size > 1 ? (
                  <div className="text-sm text-lithium-500 text-center py-10">
                    단일 행을 선택하면 상세 내역을 편집할 수 있습니다.
                  </div>
                ) : (
                  <div className="text-sm text-lithium-500 text-center py-10">
                    그리드에서 행을 선택해주세요.
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Copy Quantity Modal */}
      {copyModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-brand-500" />
                </div>
                <h3 className="text-xl font-bold text-[#191f28]">계정 복사</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-[#4e5968]">복사할 개수</label>
                    <span className="text-brand-600 font-bold text-lg">{copyModal.count}개</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={copyModal.count}
                    onChange={(e) => setCopyModal({ ...copyModal, count: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#f2f4f6] rounded-lg appearance-none cursor-pointer accent-brand-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-[#8b95a1] font-medium">
                    <span>1개</span>
                    <span>5개</span>
                    <span>10개</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setCopyModal({ ...copyModal, isOpen: false })}
                    className="flex-1 py-4 bg-[#f2f4f6] text-[#4e5968] rounded-2xl font-bold hover:bg-[#e5e8eb] transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    onClick={confirmCopy}
                    className="flex-1 py-4 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
                  >
                    복사하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Data Modal */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[#191f28]">데이터 가져오기</h3>
                <button 
                  onClick={() => setImportModal({ ...importModal, isOpen: false })}
                  className="text-[#8b95a1] hover:text-[#4e5968]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1.5">가져올 연도</label>
                  <select 
                    value={importModal.sourceYear}
                    onChange={(e) => setImportModal({ ...importModal, sourceYear: e.target.value })}
                    className="w-full bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2.5 font-medium appearance-none"
                  >
                    <option value="2024">2024년</option>
                    <option value="2025">2025년</option>
                    <option value="2026">2026년</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1.5">데이터 구분</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setImportModal({ ...importModal, sourceType: 'actual' })}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        importModal.sourceType === 'actual' 
                          ? 'bg-brand-500 text-white shadow-sm' 
                          : 'bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]'
                      }`}
                    >
                      실적 데이터
                    </button>
                    <button
                      onClick={() => setImportModal({ ...importModal, sourceType: 'budget' })}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        importModal.sourceType === 'budget' 
                          ? 'bg-brand-500 text-white shadow-sm' 
                          : 'bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]'
                      }`}
                    >
                      예산 데이터
                    </button>
                  </div>
                </div>

                {importModal.sourceType === 'budget' && (
                  <div>
                    <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1.5">가져올 계획 구분</label>
                    <select 
                      value={importModal.sourcePlanType}
                      onChange={(e) => setImportModal({ ...importModal, sourcePlanType: e.target.value })}
                      className="w-full bg-[#f2f4f6] border-none text-[#191f28] text-sm rounded-xl focus:ring-2 focus:ring-brand-500 p-2.5 font-medium appearance-none"
                    >
                      <option value="경영계획">경영계획</option>
                      <option value="수정경영계획">수정경영계획</option>
                      <option value="1차RP">1차RP</option>
                      <option value="2차RP">2차RP</option>
                    </select>
                  </div>
                )}

                {importModal.sourceType === 'actual' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-[#8b95a1] uppercase">가져올 월 선택</label>
                      <button 
                        onClick={toggleAllImportMonths}
                        className="text-[10px] font-bold text-brand-500 hover:underline"
                      >
                        {importModal.selectedMonths.every(m => m) ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {importModal.selectedMonths.map((selected, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleImportMonth(idx)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all ${
                            selected 
                              ? 'bg-brand-50 text-brand-600 border border-brand-200' 
                              : 'bg-white text-[#8b95a1] border border-[#e5e8eb] hover:bg-[#f9fafb]'
                          }`}
                        >
                          {idx + 1}월
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setImportModal({ ...importModal, isOpen: false })}
                  className="flex-1 py-3 bg-[#f2f4f6] text-[#4e5968] rounded-xl text-sm font-bold hover:bg-[#e5e8eb] transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={handleImportData}
                  className="flex-1 py-3 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-md"
                >
                  가져오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#191f28] mb-4">
                반려 사유 입력
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 상세히 적어주세요."
                className="w-full h-32 p-3 border border-[#e5e8eb] rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
              />
            </div>
            <div className="bg-[#f9fafb] px-6 py-4 flex justify-end gap-2 border-t border-[#e5e8eb]">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-[#4e5968] bg-white border border-[#d1d6db] rounded-xl hover:bg-[#f2f4f6] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleApproveReject('REJECTED')}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                반려 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flow Assist Bridge Panel */}
      <div className="bg-[#fcfdfe] p-6 rounded-2xl border border-teal-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-6">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
            비즈니스 중요 플로우 연속성 가이드
          </h4>
          <p className="text-xs text-[#647067] mt-1">
            부서 지정 경비 편성이 완료되었습니까? 다음 권장 흐름은 실적 세목의 부서 귀속을 변경하는 <strong className="text-teal-700">부서 귀속 변경</strong> 단계나 인원별 활동경비를 자동 산정하는 <strong className="text-teal-700">업무활동경비 산출</strong> 단계입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => navigate('/department-assignment')}
            className="px-4 py-2 bg-white hover:bg-zinc-50 text-gray-700 border border-[#d1d6db] rounded-xl font-bold text-xs transition-all flex items-center gap-1"
          >
            부서 귀속 변경 ↩
          </button>
          <button
            onClick={() => navigate('/business-activity-budget')}
            className="px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
          >
            업무활동경비 산출 단계로 이동 →
          </button>
        </div>
      </div>

      {/* Custom Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#191f28] mb-2">
                {modalConfig.type === 'confirm' ? '확인' : '알림'}
              </h3>
              <p className="text-[#4e5968] text-sm leading-relaxed">
                {modalConfig.message}
              </p>
            </div>
            <div className="bg-[#f9fafb] px-6 py-4 flex justify-end gap-2 border-t border-[#e5e8eb]">
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-[#4e5968] bg-white border border-[#d1d6db] rounded-xl hover:bg-[#f2f4f6] transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={() => {
                  closeModal();
                  if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                    modalConfig.onConfirm();
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
