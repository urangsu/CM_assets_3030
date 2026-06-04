import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  ActualData, 
  UploadParseResult,
  parseUploadRecords, 
  normalizeHeader,
  findHeaderRowIndex,
  parsePastedText,
  detectUploadType,
  isProbablyHeaderlessMonthlyRow,
  buildHeaderlessMonthlyHeaders
} from '../lib/actualUploadParser';
import { AppModal } from '../components/ui/AppModal';
import { AppButton } from '../components/ui/AppButton';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X, 
  AlertCircle, 
  Calendar, 
  Search, 
  Edit3, 
  Upload, 
  Trash2, 
  Save, 
  Clipboard 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS, getAllDepartments, getViewableDepts, SALARY_CATEGORIES } from '../constants';
import { getBudgetDataKey, getActualDataKey, isBudgetLocked } from '../lib/storageKeys';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { parsePeriodMonth } from '../lib/budgetAggregation';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { inferManagementCategoryByAccountCode } from '../lib/accountMaster';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';

// Sort logic
type SortDirection = 'asc' | 'desc';
type SortKey = 'no' | keyof ActualData;

// Sortable Resizable Header Component
const SortableResizableHeader = ({
  title,
  width,
  minWidth,
  sortKey,
  sortConfig,
  onSort,
  onResize,
  align = 'left',
}: {
  title: string;
  width: number;
  minWidth: number;
  sortKey: SortKey;
  sortConfig: { key: SortKey; direction: SortDirection } | null;
  onSort: (key: SortKey) => void;
  onResize: (newWidth: number) => void;
  align?: 'left' | 'center' | 'right';
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const active = sortConfig?.key === sortKey;
  const direction = active ? sortConfig.direction : null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={[
        'relative flex items-center w-full h-full px-2 py-2 select-none group focus:outline-none focus-visible:bg-zinc-100',
        align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'justify-start text-left',
      ].join(' ')}
      title={`${title} 정렬`}
    >
      <span className="truncate">{title}</span>

      <span className={`ml-1 text-[10px] ${active ? 'text-brand-600' : 'text-lithium-400 opacity-0 group-hover:opacity-100'}`}>
        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>

      <span
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-brand-500 z-30"
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </button>
  );
};

function getUploadRowKey(row: ActualData, target: string): string {
  return [
    row.year,
    target,
    row.usageCode,
    row.accountCode,
    row.period
  ].join('|');
}

function countDuplicates(
  existingRows: ActualData[],
  incomingRows: ActualData[],
  target: string
): number {
  const existingKeys = new Set(existingRows.map(row => getUploadRowKey(row, target)));
  return incomingRows.filter(row => existingKeys.has(getUploadRowKey(row, target))).length;
}

function mergeUploadRows(
  existingRows: ActualData[],
  incomingRows: ActualData[],
  target: string,
  policy: 'overwrite' | 'skip'
) {
  const map = new Map<string, ActualData>();
  existingRows.forEach(row => {
    map.set(getUploadRowKey(row, target), row);
  });

  let duplicateCount = 0;
  let insertedCount = 0;
  let overwrittenCount = 0;
  let skippedCount = 0;

  incomingRows.forEach(row => {
    const key = getUploadRowKey(row, target);
    const exists = map.has(key);

    if (exists) {
      duplicateCount += 1;

      if (policy === 'overwrite') {
        const previous = map.get(key)!;
        map.set(key, { ...previous, ...row, id: previous.id });
        overwrittenCount += 1;
      } else {
        skippedCount += 1;
      }
    } else {
      map.set(key, row);
      insertedCount += 1;
    }
  });

  return {
    rows: Array.from(map.values()),
    duplicateCount,
    insertedCount,
    overwrittenCount,
    skippedCount
  };
}

function dedupeRowsByKey(rows: ActualData[], target: string): ActualData[] {
  const map = new Map<string, ActualData>();

  rows.forEach(row => {
    const key = getUploadRowKey(row, target);
    map.set(key, row);
  });

  return Array.from(map.values());
}

function reindexRows(rows: ActualData[]): ActualData[] {
  return rows.map((row, index) => ({
    ...row,
    id: index + 1
  }));
}

const numericFields: Array<keyof ActualData> = [
  'amount',
  'additional',
  'transferred',
  'carriedOver',
  'planned',
  'completed',
  'balance',
];

function parseSortableMonth(period: unknown): number {
  const text = String(period ?? '').trim();

  const match = text.match(/(\d{1,2})월?/);
  if (match) return Number(match[1]);

  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;

  return 999;
}

function getSortValue(row: ActualData, key: SortKey): string | number {
  if (key === 'no') return row.id;

  if (key === 'period') {
    return parseSortableMonth(row.period);
  }

  if (numericFields.includes(key as keyof ActualData)) {
    return Number(row[key as keyof ActualData]) || 0;
  }

  return String(row[key as keyof ActualData] ?? '').trim();
}

function parseBatchAmount(value: string): number {
  const raw = String(value ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/₩/g, '')
    .replace(/원/g, '')
    .replace(/\s/g, '');

  if (raw === '' || raw === '-') return 0;

  if (/^\(.+\)$/.test(raw)) {
    const inner = raw.slice(1, -1);
    const n = Number(inner);
    return Number.isFinite(n) ? -n : 0;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function PlanActualUpload() {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [viewPlanType, setViewPlanType] = useState('실적');
  
  type UploadKind = "monthlyActual" | "managementPlan" | "";
  const [uploadKind, setUploadKind] = useState<UploadKind>("");
  const [uploadTarget, setUploadTarget] = useState<'' | '실적' | '경영계획' | '수정경영계획' | '1차 RP' | '2차 RP'>('');
  const [pasteText, setPasteText] = useState('');
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [headerlessStartMonth, setHeaderlessStartMonth] = useState(1);
  const [successBanner, setSuccessBanner] = useState<{isOpen: boolean, isFinal: boolean, message: string, target?: string, generatedRows?: number, location?: string} | null>(null);
  const [lockedDeptsOnUpload, setLockedDeptsOnUpload] = useState<{deptCode: string, deptName: string, status: string}[]>([]);
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
  
  const [duplicatePolicy, setDuplicatePolicy] = useState<'overwrite' | 'skip'>('overwrite');
  const [duplicateUploadCount, setDuplicateUploadCount] = useState(0);

  const [alertModal, setAlertModal] = useState<{isOpen: boolean, message: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [validationResult, setValidationResult] = useState<UploadParseResult | null>(null);

  // Requirement 2: Multi-select state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Sort state
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };
  
  // Requirement 3: Batch edit state
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [batchEditFields, setBatchEditFields] = useState({
    year: { checked: false, value: '' },
    period: { checked: false, value: '' },
    accountCode: { checked: false, value: '' },
    accountName: { checked: false, value: '' },
    usageCode: { checked: false, value: '' },
    usageDept: { checked: false, value: '' },
    amount: { checked: false, value: '' },
    additional: { checked: false, value: '' },
    transferred: { checked: false, value: '' },
    carriedOver: { checked: false, value: '' },
    planned: { checked: false, value: '' },
    completed: { checked: false, value: '' },
    balance: { checked: false, value: '' },
    remarks: { checked: false, value: '' },
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
    if (viewPlanType === '실적') {
      const savedData = localStorage.getItem(getActualDataKey(year));
      if (savedData) {
        let actualData: ActualData[] = JSON.parse(savedData);
        // ... (keep actualData mapping)
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
        const key = getBudgetDataKey(dept.code, year, viewPlanType);
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
                controlType: 'D.부서',
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
  }, [year, viewPlanType, currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadTarget || !uploadKind) {
      setAlertModal({ isOpen: true, message: '업로드 대상을 먼저 선택해주세요. 실적 또는 경영계획 등을 선택해야 저장 위치가 결정됩니다.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // requirement: API payload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadKind", uploadKind);
    formData.append("year", year);
    formData.append("companyCode", "1000"); // mockup

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!data.success) {
        setAlertModal({ isOpen: true, message: data.error || '업로드 중 오류가 발생했습니다.' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      // Continue with local preview rendering to keep UI exactly the same
      if (data.rows && data.rows.length > 0) {
        processImportedData(data.rows);
      }
    } catch (err) {
      console.error("API error, falling back to local fallback", err);
      // Fallback for purely client environment testing
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
        
        processImportedData(jsonData);
      };
      reader.readAsBinaryString(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteArea = () => {
    if (!uploadTarget) {
      setAlertModal({ isOpen: true, message: '업로드 대상을 먼저 선택해주세요. 실적인지 경영계획 등인지 선택해야 저장 위치가 결정됩니다.' });
      return;
    }
    if (!pasteText.trim()) return;
    
    const rows = parsePastedText(pasteText);
    processImportedData(rows);
    setPasteText(''); // Clear after processing
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!uploadTarget) return; // Silent ignore for global paste if no target
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;
    
    const rows = parsePastedText(pasteData);
    processImportedData(rows);
  };

  const processImportedData = (rows: any[][]) => {
    const compactRows = rows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));

    let finalHeaders: any[] = [];
    let finalBodyRows: any[][] = [];

    if (!firstRowIsHeader && compactRows[0] && isProbablyHeaderlessMonthlyRow(compactRows[0])) {
      finalHeaders = buildHeaderlessMonthlyHeaders(compactRows[0], headerlessStartMonth);
      finalBodyRows = compactRows;
    } else {
      const headerIndex = findHeaderRowIndex(compactRows);

      if (headerIndex >= 0) {
        finalHeaders = compactRows[headerIndex];
        finalBodyRows = compactRows.slice(headerIndex + 1);
      } else if (compactRows[0] && isProbablyHeaderlessMonthlyRow(compactRows[0])) {
        finalHeaders = buildHeaderlessMonthlyHeaders(compactRows[0], headerlessStartMonth);
        finalBodyRows = compactRows;
      } else {
        setAlertModal({
          isOpen: true,
          message:
            `알 수 없는 업로드 형식입니다.\n\n` +
            `감지된 첫 행:\n${(compactRows[0] || []).join(', ')}\n\n` +
            `지원 형식 예시:\n` +
            `귀속부서코드 | 계정과목코드 | 계정과목 | 1월 | ... | 12월\n\n` +
            `헤더 없이 붙여넣는 경우 [첫 행을 헤더로 사용] 체크를 해제하고 다시 시도하세요.`
        });
        return;
      }
    }
    
    const records = finalBodyRows.map(row => {
        const record: Record<string, unknown> = {};
        finalHeaders.forEach((h, i) => record[normalizeHeader(h)] = row[i]);
        return record;
    });

    const result = parseUploadRecords({
        headers: finalHeaders.map(String),
        records,
        year,
        existingCount: data.length,
        currentUser,
        viewableDeptCodes,
        planType: uploadTarget,
        uploadKind: uploadKind
    });

    // Check locks ONLY for affected departments
    if (uploadTarget !== '실적') {
      const locked = [];
      const affectedCodes = Array.from(new Set(result.actualRows.map(r => r.usageCode).filter(Boolean)));
      for (const code of affectedCodes) {
        if (isBudgetLocked(code, year, uploadTarget)) {
          const dept = getAllDepartments().find(d => d.code === code);
          locked.push({ deptCode: code, deptName: dept?.name || code, status: '잠금/확정' });
        }
      }
      setLockedDeptsOnUpload(locked);
    } else {
      setLockedDeptsOnUpload([]);
    }

    if (result.format === 'UNKNOWN') {
        const rawHeaders = finalHeaders.map(String).join(', ');
        setAlertModal({ 
          isOpen: true, 
          message: `알 수 없는 업로드 형식입니다.\n\n감지된 헤더:\n${rawHeaders}\n\n지원 형식 예시:\n귀속부서코드 | 계정과목코드 | 계정과목 | 1월 | ... | 12월\n\n헤더 없이 붙여넣는 경우 [첫 행을 헤더로 사용] 체크를 해제하고 다시 시도하세요.` 
        });
        return;
    }

    setDuplicateUploadCount(countDuplicates(data, result.actualRows, uploadTarget));
    setValidationResult(result);
  };

  const confirmImport = () => {
    if (validationResult) {
       const mergeResult = mergeUploadRows(
         data,
         validationResult.actualRows,
         uploadTarget,
         duplicatePolicy
       );

       setData(reindexRows(mergeResult.rows));
       
       setSuccessBanner({
         isOpen: true,
         isFinal: false,
         message: `${mergeResult.insertedCount}건 신규, ${mergeResult.overwrittenCount}건 덮어쓰기, ${mergeResult.skippedCount}건 건너뜀 처리되었습니다. 최종 저장하려면 [저장하기]를 누르세요.`,
         target: uploadTarget,
         generatedRows: validationResult.actualRows.length
       });
       setValidationResult(null);
    }
  };

  const handleSave = () => {
    if (!uploadTarget) {
      setAlertModal({ isOpen: true, message: '업로드 대상을 선택하고 데이터를 임시 반영한 뒤 저장해주세요.' });
      return;
    }

    if (uploadTarget === '실적') {
      const dedupedData = dedupeRowsByKey(data, uploadTarget);
      localStorage.setItem(getActualDataKey(year), JSON.stringify(dedupedData));
      clearDataLoaderCache();
      setData(dedupedData);
      
      const affectedCodes = new Set(dedupedData.map(r => r.usageCode).filter(Boolean));
      setSuccessBanner({
         isOpen: true,
         isFinal: true,
         message: `실적 데이터가 저장되었습니다.\n저장 위치: 실적DB ${year}\n대상 부서: ${affectedCodes.size}개`,
         location: `실적DB ${year}`
      });
    } else {
      const groupedByDept = new Map<string, ActualData[]>();
      const rowsToSave = dedupeRowsByKey(data, uploadTarget);
      
      rowsToSave.forEach(item => {
        if (!groupedByDept.has(item.usageCode)) {
          groupedByDept.set(item.usageCode, []);
        }
        groupedByDept.get(item.usageCode)!.push(item);
      });

      const deptsToUpdate = currentUser?.code === '99999' ? getAllDepartments() : viewableDepts;

      const lockedDepts = deptsToUpdate.filter(dept => isBudgetLocked(dept.code, year, uploadTarget) && groupedByDept.has(dept.code));
      if (lockedDepts.length > 0) {
        setAlertModal({ 
          isOpen: true, 
          message: `일부 부서가 예산 잠금 상태입니다.\n잠금 부서는 저장에서 제외됩니다.\n상세 목록을 확인하거나 관리자 권한으로 잠금을 해제해주세요.\n\n[제외된 잠금 부서]\n${lockedDepts.map(d => `- ${d.code} ${d.name}`).join('\n')}` 
        });
      }

      let savedDeptNames = [];

      deptsToUpdate.forEach(dept => {
        if (isBudgetLocked(dept.code, year, uploadTarget)) return;

        const deptCode = dept.code;
        const key = getBudgetDataKey(deptCode, year, uploadTarget);
        const deptData = groupedByDept.get(deptCode) || [];
        
        if (deptData.length === 0) return;

        savedDeptNames.push(dept.name);

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
        BudgetRepository.saveRows(deptCode, year, uploadTarget, budgetRows);
      });
      
      if (lockedDepts.length > 0) {
        setSuccessBanner({
           isOpen: true,
           isFinal: true,
           message: `일부 부서는 잠금 상태라 제외되었습니다.\n저장 완료: ${savedDeptNames.length}개 부서\n제외: ${lockedDepts.length}개 부서`,
           location: `예산DB ${year} (${uploadTarget})`
        });
      } else {
        setSuccessBanner({
           isOpen: true,
           isFinal: true,
           message: `경영계획 예산DB에 저장되었습니다.\n대상 부서: ${savedDeptNames.length}개`,
           location: `예산DB ${year} (${uploadTarget})`
        });
      }
    }
  };

  const handleClear = () => {
    setConfirmModal({
      isOpen: true,
      message: currentUser?.code === '99999' ? `모든 ${viewPlanType} 데이터를 삭제하시겠습니까?` : `조회 가능한 부서의 ${viewPlanType} 데이터를 모두 삭제하시겠습니까?`,
      onConfirm: () => {
        if (viewPlanType === '실적') {
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
            BudgetRepository.deleteRows(dept.code, year, viewPlanType);
          });
          setData([]);
        }
        clearDataLoaderCache();
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
      item.usageCode.includes(searchTerm) ||
      item.usageDept.includes(searchTerm) ||
      item.controlType.includes(searchTerm);

    let deptMatch = true;
    if (selectedDeptFilter === 'viewable') {
      deptMatch = viewableDeptCodes.includes(item.usageCode);
    } else if (selectedDeptFilter !== 'all') {
      deptMatch = item.usageCode === selectedDeptFilter;
    }

    return monthMatch && searchMatch && deptMatch;
  }) : [];

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      let result = 0;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue), 'ko-KR', {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredData, sortConfig]);

  const visibleData = sortedData.slice(0, visibleCount);

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
      nextRow = Math.min(visibleData.length - 1, rowIndex + 1);
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

  const MONEY_FIELDS: Array<keyof ActualData> = [
    'amount',
    'additional',
    'transferred',
    'carriedOver',
    'planned',
    'completed',
    'balance',
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
        if (batchEditFields.remarks.checked) newRow.remarks = batchEditFields.remarks.value;

        const moneyChanged =
          batchEditFields.amount.checked ||
          batchEditFields.additional.checked ||
          batchEditFields.transferred.checked ||
          batchEditFields.carriedOver.checked ||
          batchEditFields.planned.checked ||
          batchEditFields.completed.checked;

        MONEY_FIELDS.forEach(field => {
          if ((batchEditFields as any)[field]?.checked) {
            (newRow as any)[field] = parseBatchAmount((batchEditFields as any)[field].value);
          }
        });

        if (moneyChanged && !batchEditFields.balance.checked) {
          newRow.balance =
            (Number(newRow.amount) || 0) +
            (Number(newRow.additional) || 0) +
            (Number(newRow.transferred) || 0) +
            (Number(newRow.carriedOver) || 0) -
            (Number(newRow.planned) || 0) -
            (Number(newRow.completed) || 0);
        }

        return newRow;
      }
      return row;
    });
    setData(updatedData);

    setIsBatchEditModalOpen(false);
    setAlertModal({ isOpen: true, message: '선택한 데이터가 일괄 수정되었습니다. 최종 저장을 눌러야 실제 데이터에 반영됩니다.' });
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Batch Edit Modal */}
      {isBatchEditModalOpen && (
        <AppModal
          isOpen={isBatchEditModalOpen}
          title={`데이터 일괄 수정 (${selectedRows.size}건)`}
          onClose={() => setIsBatchEditModalOpen(false)}
          footer={
            <div className="flex justify-end gap-3">
              <AppButton variant="secondary" onClick={() => setIsBatchEditModalOpen(false)}>
                기존 데이터 보존
              </AppButton>
              <AppButton onClick={handleBatchUpdate}>
                변경
              </AppButton>
            </div>
          }
        >
            <div className="p-2 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-600 mb-4">
                수정할 항목을 체크하고 값을 입력하세요. 체크하지 않은 항목은 기존 값이 유지됩니다. 금액 항목은 선택한 모든 행에 같은 값으로 일괄 적용됩니다.
              </div>

              {viewPlanType === '실적' && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-xs text-teal-700">
                  실적 데이터는 보통 `집행완료` 금액을 수정합니다. 예산잔액은 자동 재계산됩니다.
                </div>
              )}

              {viewPlanType !== '실적' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  계획 데이터는 보통 `예산금액`을 수정합니다. 최종 저장 시 부서별 예산DB에 반영됩니다.
                </div>
              )}
              
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

              <div className="border-t border-[#e5e8eb] pt-4 mt-4">
                <h4 className="text-sm font-bold text-[#191f28] mb-3">금액 항목</h4>

                {[
                  { id: 'amount', label: '예산금액', placeholder: '0' },
                  { id: 'additional', label: '추가예산', placeholder: '0' },
                  { id: 'transferred', label: '전용예산', placeholder: '0' },
                  { id: 'carriedOver', label: '이월예산', placeholder: '0' },
                  { id: 'planned', label: '집행예정', placeholder: '0' },
                  { id: 'completed', label: '집행완료', placeholder: '0' },
                  { id: 'balance', label: '예산잔액', placeholder: '자동 계산 또는 직접 입력' },
                ].map((field) => (
                  <div key={field.id} className="flex items-center gap-4 mb-2">
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
                      inputMode="numeric"
                      placeholder={field.placeholder}
                      value={(batchEditFields as any)[field.id].value}
                      onChange={(e) => setBatchEditFields(prev => ({
                        ...prev,
                        [field.id]: { ...(prev as any)[field.id], value: e.target.value }
                      }))}
                      disabled={!(batchEditFields as any)[field.id].checked}
                      className="flex-1 px-4 py-2 border border-[#d1d6db] rounded-xl text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-[#f9fafb] disabled:text-[#8b95a1]"
                    />
                  </div>
                ))}

                <p className="text-xs text-[#8b95a1] mt-2">
                  예산잔액을 직접 체크하지 않으면 금액 구성요소 변경 후 자동 재계산됩니다.<br/>
                  (예산잔액 = 예산금액 + 추가예산 + 전용예산 + 이월예산 - 집행예정 - 집행완료)
                </p>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 w-32">
                  <input
                    type="checkbox"
                    id="check-remarks"
                    checked={batchEditFields.remarks.checked}
                    onChange={(e) => setBatchEditFields(prev => ({
                      ...prev,
                      remarks: { ...prev.remarks, checked: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-[#d1d6db] text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="check-remarks" className="text-sm font-medium text-[#4e5968] cursor-pointer">
                    비고
                  </label>
                </div>

                <input
                  type="text"
                  placeholder="비고 입력"
                  value={batchEditFields.remarks.value}
                  onChange={(e) => setBatchEditFields(prev => ({
                    ...prev,
                    remarks: { ...prev.remarks, value: e.target.value }
                  }))}
                  disabled={!batchEditFields.remarks.checked}
                  className="flex-1 px-4 py-2 border border-[#d1d6db] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-[#f9fafb] disabled:text-[#8b95a1]"
                />
              </div>
            </div>
        </AppModal>
      )}
      {/* Validation Result Modal */}
      {validationResult && (
        <AppModal
          isOpen={!!validationResult}
          title="데이터 검증 결과"
          onClose={() => setValidationResult(null)}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setValidationResult(null)}>
                취소
              </AppButton>
              <AppButton 
                onClick={confirmImport}
                disabled={validationResult.actualRows.length === 0}
              >
                임시 반영
              </AppButton>
            </div>
          }
        >
            <div className="space-y-4 text-sm">
              <div className="bg-[#fcfdfe] p-4 rounded-xl border border-[#e5e8eb]">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-xs text-[#8b95a1] mb-1 font-semibold">감지된 포맷</p>
                     <p className="text-sm font-bold text-gray-900">{validationResult.format}</p>
                   </div>
                   <div>
                     <p className="text-xs text-[#8b95a1] mb-1 font-semibold">업로드 대상</p>
                     <p className="text-sm font-bold text-brand-600">{uploadTarget}</p>
                   </div>
                   <div>
                     <p className="text-xs text-[#8b95a1] mb-1 font-semibold">생성 예정 행 수</p>
                     <p className="text-sm font-bold text-gray-900">{validationResult.actualRows.length}건</p>
                   </div>
                   <div>
                     <p className="text-xs text-[#8b95a1] mb-1 font-semibold">저장 예정 위치</p>
                     <p className="text-sm font-bold text-gray-900">{uploadTarget === '실적' ? `실적DB ${year}` : `예산DB ${year} (${uploadTarget})`}</p>
                   </div>
                 </div>
              </div>

              {duplicateUploadCount > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="font-bold text-blue-900 mb-2">기존 데이터와 중복: <span className="text-red-500">{duplicateUploadCount}건</span></p>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-blue-800 font-semibold mb-1">중복 처리 방식:</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duplicatePolicy" 
                        value="overwrite" 
                        checked={duplicatePolicy === 'overwrite'}
                        onChange={() => setDuplicatePolicy('overwrite')}
                        className="w-4 h-4 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm font-medium text-gray-700">기존 값 덮어쓰기 (권장)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duplicatePolicy" 
                        value="skip"
                        checked={duplicatePolicy === 'skip'}
                        onChange={() => setDuplicatePolicy('skip')}
                        className="w-4 h-4 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm font-medium text-gray-700">신규 월만 추가 (기존 월 무시)</span>
                    </label>
                  </div>
                </div>
              )}

              {lockedDeptsOnUpload.length > 0 && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-orange-800 flex items-center"><AlertTriangle className="w-4 h-4 mr-1" />잠금 부서 경고 (저장 제외됨)</h4>
                    {(currentUser?.code === '99999' || currentUser?.code === '32100') && (
                      <button 
                        onClick={() => {
                          setValidationResult(null); // 모달 닫기
                          setTimeout(() => window.location.href = '/budget-lock-management', 100);
                        }}
                        className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold hover:bg-orange-200 transition-colors"
                      >
                         잠금 관리 열기
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-orange-700 mb-2">총 {lockedDeptsOnUpload.length}개 부서의 데이터가 잠금 상태이므로 덮어쓰기에서 제외됩니다.</p>
                  <ul className="list-disc pl-5 text-orange-700 space-y-1 text-xs max-h-24 overflow-y-auto">
                    {lockedDeptsOnUpload.map((d, i) => (
                      <li key={i}>{d.deptCode} {d.deptName}: {d.status}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.errorRows.length > 0 && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 max-h-40 overflow-y-auto">
                  <h4 className="font-bold text-red-700 mb-2 flex items-center"><X className="w-4 h-4 mr-1" />오류 내용 (저장 제외됨)</h4>
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
            </div>
        </AppModal>
      )}

      {/* Modals */}
      {alertModal && (
        <AppModal
          isOpen={alertModal.isOpen}
          title="알림"
          onClose={() => setAlertModal(null)}
          footer={
            <div className="flex justify-end">
              <AppButton onClick={() => setAlertModal(null)}>확인</AppButton>
            </div>
          }
        >
          <p className="text-[#4e5968] whitespace-pre-wrap">{alertModal.message}</p>
        </AppModal>
      )}

      {confirmModal && (
        <AppModal
          isOpen={confirmModal.isOpen}
          title="확인"
          onClose={() => setConfirmModal(null)}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setConfirmModal(null)}>취소</AppButton>
              <AppButton onClick={confirmModal.onConfirm}>삭제</AppButton>
            </div>
          }
        >
          <p className="text-[#4e5968]">{confirmModal.message}</p>
        </AppModal>
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
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1">조회 구분(View)</label>
            <select 
              value={viewPlanType}
              onChange={(e) => { setViewPlanType(e.target.value); setIsSearched(false); }}
              className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none"
            >
              <option value="실적">실적</option>
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차 RP">1차 RP</option>
              <option value="2차 RP">2차 RP</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#8b95a1] uppercase mb-1" title="조회 권한이 있는 부서만 표시됩니다.">부서</label>
            <select 
              value={selectedDeptFilter}
              onChange={(e) => { setSelectedDeptFilter(e.target.value); setIsSearched(false); }}
              className="px-4 py-2 h-[42px] bg-[#f2f4f6] border-none rounded-xl text-sm font-medium text-[#191f28] focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none w-48"
            >
              <option value="all">전체 부서</option>
              <option value="viewable">조회 가능 부서</option>
              {viewableDepts.map(dept => (
                <option key={dept.code} value={dept.code}>
                  {dept.code} {dept.name}
                </option>
              ))}
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

        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-brand-600 uppercase">저장 위치:</label>
            <select 
              value={uploadTarget}
              onChange={(e) => setUploadTarget(e.target.value as any)}
              className="px-4 py-2 h-[42px] bg-brand-50 border border-brand-200 rounded-xl text-sm font-bold text-brand-700 focus:ring-2 focus:ring-brand-500 transition-all outline-none appearance-none"
            >
              <option value="">▼ 선택해주세요</option>
              <option value="실적">실적DB</option>
              <option value="경영계획">경영계획 예산DB</option>
              <option value="수정경영계획">수정경영계획 예산DB</option>
              <option value="1차 RP">1차 RP 예산DB</option>
              <option value="2차 RP">2차 RP 예산DB</option>
            </select>
          </div>
          {uploadTarget && (
            <div className="flex flex-col gap-1 text-[11px] text-[#8b95a1] max-w-[280px] text-right">
              {uploadTarget === '실적' 
                ? <p>현재 선택: 월 실적<br/>이 파일은 실적 데이터로 업로드됩니다.</p>
                : <p>현재 선택: 경영계획<br/>이 파일은 예산 데이터로 업로드됩니다.</p>}
              <p className="opacity-80">
                {uploadTarget === '실적' 
                  ? '실적DB 저장은 예산 잠금 상태와 무관하게 저장됩니다.' 
                  : '제출/승인/잠금 상태의 부서는 덮어쓸 수 없습니다.'}
              </p>
            </div>
          )}
          <div className="flex gap-2 mt-1">
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
              최종 저장
            </button>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner?.isOpen && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${successBanner.isFinal ? 'bg-teal-50 border-teal-200' : 'bg-blue-50 border-blue-200'}`}>
          <CheckCircle className={`w-5 h-5 mt-0.5 ${successBanner.isFinal ? 'text-teal-500' : 'text-blue-500'}`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${successBanner.isFinal ? 'text-teal-900' : 'text-blue-900'}`}>{successBanner.message}</p>
            {!successBanner.isFinal && (
              <div className="text-xs text-blue-700 mt-2 flex flex-col gap-1">
                <span>• 업로드 대상: <strong className="font-semibold">{successBanner.target}</strong></span>
                <span>• 생성 행 수: <strong className="font-semibold">{successBanner.generatedRows}</strong>건</span>
                <span className="inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> [최종 저장] 버튼을 눌러야 실제 시스템에 반영됩니다.</span>
              </div>
            )}
            {successBanner.isFinal && successBanner.location && (
               <div className="text-xs text-teal-700 mt-2 flex flex-col gap-1">
                 <span>• 저장 위치: <strong className="font-semibold">{successBanner.location}</strong></span>
               </div>
            )}
          </div>
          <button onClick={() => setSuccessBanner(null)} className="p-1 hover:bg-black/5 rounded">
            <X className={`w-4 h-4 ${successBanner.isFinal ? 'text-teal-500' : 'text-blue-500'}`} />
          </button>
        </div>
      )}

      {/* Upload Paste Area */}
      <div className="bg-white p-4 rounded-xl border border-[#e5e8eb] flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-brand-500" />
            <span className="mb-[2px]">엑셀 붙여넣기 영역</span>
          </label>
          <div className="flex items-center gap-4 border border-[#e5e8eb] p-1.5 px-3 rounded-lg bg-gray-50">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={firstRowIsHeader}
                onChange={(e) => setFirstRowIsHeader(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              첫 행을 헤더로 사용
            </label>
            {!firstRowIsHeader && (
              <div className="flex items-center gap-2 border-l pl-4 border-gray-300">
                <span className="text-xs font-semibold text-gray-600">헤더 없음 시작월:</span>
                <select 
                  value={headerlessStartMonth}
                  onChange={(e) => setHeaderlessStartMonth(Number(e.target.value))}
                  className="px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-brand-500"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{i+1}월</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-[#647067] flex flex-col gap-1">
          <p>엑셀에서 범위 복사 후 아래 입력칸에 붙여넣으세요.</p>
          <p>• <strong>헤더가 있는 경우:</strong> 귀속부서코드 | 계정과목코드 | 계정과목 | 1월 | 2월 | ...</p>
          <p>• <strong>헤더가 없는 경우:</strong> 20000 | A60300701 | 제조비용_임원급여_급여 | 9,833,333 | ... (시작월 설정 필요)</p>
        </div>
        <div className="flex gap-2 items-start">
          <textarea
             value={pasteText}
             onChange={(e) => setPasteText(e.target.value)}
             placeholder="여기를 클릭한 후 Ctrl+V 로 붙여넣으세요..."
             className="flex-1 min-h-[42px] h-[42px] max-h-[200px] border border-[#d1d6db] rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-y"
          />
          <button 
             onClick={handlePasteArea}
             className="px-4 h-[42px] bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl font-bold text-sm shrink-0 transition-colors"
          >
            붙여넣은 데이터 검증
          </button>
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
                <th style={{ width: colWidths.checkbox }} className="px-2 py-3 text-center" title="현재 조회 결과 전체 선택">
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
                <th style={{ width: colWidths.no }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-center">
                  <SortableResizableHeader title="No." width={colWidths.no} minWidth={50} sortKey="no" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('no', w)} align="center" />
                </th>
                <th style={{ width: colWidths.year }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산년도" width={colWidths.year} minWidth={60} sortKey="year" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('year', w)} />
                </th>
                <th style={{ width: colWidths.period }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="기간" width={colWidths.period} minWidth={60} sortKey="period" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('period', w)} />
                </th>
                <th style={{ width: colWidths.accountCode }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산계정코드" width={colWidths.accountCode} minWidth={80} sortKey="accountCode" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('accountCode', w)} />
                </th>
                <th style={{ width: colWidths.accountName }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산계정" width={colWidths.accountName} minWidth={80} sortKey="accountName" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('accountName', w)} />
                </th>
                <th style={{ width: colWidths.controlType }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산통제구분" width={colWidths.controlType} minWidth={80} sortKey="controlType" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('controlType', w)} />
                </th>
                <th style={{ width: colWidths.usageCode }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산사용처코드" width={colWidths.usageCode} minWidth={80} sortKey="usageCode" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('usageCode', w)} />
                </th>
                <th style={{ width: colWidths.usageDept }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="예산사용처" width={colWidths.usageDept} minWidth={80} sortKey="usageDept" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('usageDept', w)} />
                </th>
                <th style={{ width: colWidths.amount }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="예산금액" width={colWidths.amount} minWidth={80} sortKey="amount" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('amount', w)} align="right" />
                </th>
                <th style={{ width: colWidths.additional }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="추가예산" width={colWidths.additional} minWidth={80} sortKey="additional" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('additional', w)} align="right" />
                </th>
                <th style={{ width: colWidths.transferred }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="전용예산" width={colWidths.transferred} minWidth={80} sortKey="transferred" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('transferred', w)} align="right" />
                </th>
                <th style={{ width: colWidths.carriedOver }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="이월예산" width={colWidths.carriedOver} minWidth={80} sortKey="carriedOver" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('carriedOver', w)} align="right" />
                </th>
                <th style={{ width: colWidths.planned }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="집행예정" width={colWidths.planned} minWidth={80} sortKey="planned" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('planned', w)} align="right" />
                </th>
                <th style={{ width: colWidths.completed }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="집행완료" width={colWidths.completed} minWidth={80} sortKey="completed" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('completed', w)} align="right" />
                </th>
                <th style={{ width: colWidths.balance }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-right">
                  <SortableResizableHeader title="예산잔액" width={colWidths.balance} minWidth={80} sortKey="balance" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('balance', w)} align="right" />
                </th>
                <th style={{ width: colWidths.remarks }} className="px-0 py-0 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider">
                  <SortableResizableHeader title="비고" width={colWidths.remarks} minWidth={100} sortKey="remarks" sortConfig={sortConfig} onSort={handleSort} onResize={(w) => handleResize('remarks', w)} />
                </th>
                <th style={{ width: colWidths.delete }} className="px-2 py-3 text-[11px] font-bold text-[#8b95a1] uppercase tracking-wider text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e8eb]">
              {!isSearched ? (
                <tr>
                  <td colSpan={18} className="px-4 py-12 text-center text-[#8b95a1] text-sm">
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
                  <td colSpan={18} className="px-4 py-12 text-center text-[#8b95a1] text-sm">
                    데이터가 없습니다. 엑셀 업로드 또는 붙여넣기를 통해 데이터를 추가해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Flow Assist Bridge Panel */}
      <div className="bg-[#fcfdfe] p-6 rounded-2xl border border-teal-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
            비즈니스 중요 플로우 연속성 가이드
          </h4>
          <p className="text-xs text-[#647067] mt-1">
            실적 및 계획 업로드가 완료되었습니다. 다음 단계는 예산 편성에 사용할 계정과목을 매핑하고 활성화하는 <strong className="text-teal-700">계정 선택 관리</strong> 단계입니다.
          </p>
        </div>
        <button
          onClick={() => navigate('/account-selection')}
          className="px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
        >
          계정 선택 단계로 이동 →
        </button>
      </div>
    </div>
  );
}
