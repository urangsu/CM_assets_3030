import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Save, Send, Trash2, Plus, Building2, FileDown, Divide, Copy } from 'lucide-react';
import { DEPARTMENTS, STORAGE_KEYS, getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, isBudgetLocked } from '../lib/storageKeys';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppTable, AppTableHeader, AppTableRow, AppTableHead, AppTableBody, AppTableCell } from '../components/ui/AppTable';
import { AppModal } from '../components/ui/AppModal';
import { AppButton } from '../components/ui/AppButton';

const DEPT_ORDER = [
  '32100', '32200', '21001', '21100', '21110', '21002', 
  '50200', '50201', '50210', '50220', '50240', '50250', '50600', '50420', '50410'
];

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
    <div className="relative flex items-center justify-center w-full h-full px-1">
      <span className="truncate">{title}</span>
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-500 z-20"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default function BusinessActivityBudget() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate(); // Need to import useNavigate

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

  const [year, setYear] = useState('2026');
  const [planType, setPlanType] = useState('경영계획');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [expenses, setExpenses] = useState({
    회의비: 50000,
    간담회비: 20000,
    부서별그룹활동지원비: 10000
  });
  const [headcounts, setHeadcounts] = useState<Record<string, { category: '제조' | '판관', data: number[] }>>({});
  const [previewApplyConfig, setPreviewApplyConfig] = useState<{isOpen: boolean, summary: any} | null>(null);
  const [deptModal, setDeptModal] = useState(false);
  const [selectedDeptsToAdd, setSelectedDeptsToAdd] = useState<string[]>([]);
  const [deptNameWidth, setDeptNameWidth] = useState(200);

  const [importModal, setImportModal] = useState({ 
    isOpen: false, 
    sourceYear: '2026',
    sourcePlanType: '경영계획'
  });
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const handleExcelDownload = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 Data
    const sheet1Data = [['업무활동경비_인원']];
    sheet1Data.push(['연도', '계획구분', '구분', '부서코드', '부서명', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연평균', '합계']);
    
    Object.keys(headcounts).sort((a,b) => a.localeCompare(b)).forEach(deptCode => {
      const dept = allDepts.find(d => d.code === deptCode);
      const data = headcounts[deptCode].data;
      const sum = data.reduce((a, b) => a + b, 0);
      sheet1Data.push([
        year, planType, headcounts[deptCode].category, deptCode, dept?.name || '',
        ...data, sum / 12, sum
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, '업무활동경비_인원');

    // Sheet 2 Data
    const sheet2Data = [['업무활동경비_산출금액']];
    sheet2Data.push(['연도', '계획구분', '부서코드', '부서명', '계정과목코드', '계정과목', '산출기준', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연간금액']);

    Object.keys(headcounts).sort((a,b) => a.localeCompare(b)).forEach(deptCode => {
      const dept = allDepts.find(d => d.code === deptCode);
      const data = headcounts[deptCode].data;
      const category = headcounts[deptCode].category;

      const accountMappings = {
        '회의비': category === '제조' ? 'A60624102' : 'B52224102',
        '간담회비': category === '제조' ? 'A60601123' : 'B52201123',
        '부서별그룹활동지원비': category === '제조' ? 'A60601155' : 'B52201155',
      };

      Object.entries(accountMappings).forEach(([expenseName, accountCode]) => {
        const expenseAmount = expenses[expenseName as keyof typeof expenses];
        const budgetValues = data.map(h => h * expenseAmount);
        const total = budgetValues.reduce((a, b) => a + b, 0);
        
        let accountName = '';
        INITIAL_CATEGORIES.forEach(cat => {
            const acc = cat.accounts.find(a => a.code === accountCode);
            if (acc) accountName = acc.name;
        });

        sheet2Data.push([
            year, planType, deptCode, dept?.name || '', accountCode, accountName, `인원수 * ${expenseAmount.toLocaleString()}`,
            ...budgetValues, total
        ]);
      });
    });

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, '업무활동경비_산출금액');

    XLSX.writeFile(wb, `업무활동경비_${year}_${planType}.xlsx`);
  };

  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void}>({
    isOpen: false, title: '', message: '', type: 'alert'
  });

  const showAlert = (message: string) => {
    setModalConfig({ isOpen: true, title: '알림', message, type: 'alert' });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title: '확인', message, type: 'confirm', onConfirm });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const allDepts = getAllDepartments();
  const viewableDepts = currentUser ? getViewableDepts(currentUser.code) : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    const filteredDeptsCount = Object.keys(headcounts).filter(deptCode => {
      if (categoryFilter === '전체') return true;
      return headcounts[deptCode].category === categoryFilter;
    }).length;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = Math.min(filteredDeptsCount - 1, rowIndex + 1);
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
        nextCol = Math.min(11, colIndex + 1);
      } else return;
    } else {
      return;
    }

    const nextCellId = `cell-${nextRow}-${nextCol}`;
    const nextCell = document.getElementById(nextCellId);
    if (nextCell) {
      (nextCell as HTMLInputElement).focus();
    }
  };

  const normalizeHeadcounts = (raw: any): Record<string, { category: '제조' | '판관'; data: number[] }> => {
    const result: Record<string, { category: '제조' | '판관'; data: number[] }> = {};
    if (!raw || typeof raw !== 'object') return result;

    Object.entries(raw).forEach(([deptCode, value]: [string, any]) => {
      if (Array.isArray(value)) {
        result[deptCode] = {
          category: '판관',
          data: value.slice(0, 12).map(v => Number(v) || 0).concat(Array(Math.max(0, 12 - value.length)).fill(0)),
        };
        return;
      }

      if (value && Array.isArray(value.data)) {
        result[deptCode] = {
          category: value.category === '제조' ? '제조' : '판관',
          data: value.data.slice(0, 12).map((v: any) => Number(v) || 0).concat(Array(Math.max(0, 12 - value.data.length)).fill(0)),
        };
      }
    });

    return result;
  };

  const handleImportData = () => {
    const sourceKey = `budget_headcounts_${importModal.sourceYear}_${importModal.sourcePlanType}`;
    const savedData = localStorage.getItem(sourceKey);
    
    if (!savedData) {
      showAlert('가져올 데이터가 없습니다. 먼저 기준 연도/계획구분 데이터를 저장해 주세요.');
      return;
    }

    const parsed = JSON.parse(savedData);
    setHeadcounts(normalizeHeadcounts(parsed));
    setImportModal({ ...importModal, isOpen: false });
    showAlert(`${importModal.sourceYear}년 ${importModal.sourcePlanType} 데이터를 가져왔습니다.`);
  };

  const addDept = () => {
    // 부서 추가 로직
    showAlert('부서 추가 기능');
  };

  const [deptSearch, setDeptSearch] = useState('');
  const filteredViewableDepts = viewableDepts.filter(d => 
    !headcounts[d.code] && (d.name.includes(deptSearch) || d.code.includes(deptSearch))
  );

  const deleteSelectedDepts = () => {
    if (selectedDepts.length === 0) {
      showAlert('삭제할 부서를 선택해주세요.');
      return;
    }
    showConfirm(`${selectedDepts.length}개의 부서를 삭제하시겠습니까?`, () => {
      const newHeadcounts = { ...headcounts };
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];

      selectedDepts.forEach(deptCode => {
        delete newHeadcounts[deptCode];
        
        // Immediately remove from budget data - PROTECTING MANUAL ROWS
        const storageKey = getBudgetDataKey(deptCode, year, planType);
        const existingDataStr = localStorage.getItem(storageKey);
        if (existingDataStr) {
          let budgetData: any[] = JSON.parse(existingDataStr);
          const originalLength = budgetData.length;
          // Only remove AUTO type rows
          budgetData = budgetData.filter(row => !(targetAccountCodes.includes(row.code) && row.sourceType === 'BUSINESS_ACTIVITY_AUTO'));
          if (budgetData.length !== originalLength) {
            BudgetRepository.saveRows(deptCode, year, planType, budgetData);
          }
        }
      });
      
      setHeadcounts(newHeadcounts);
      setSelectedDepts([]);
    });
  };

  const distributeJanuaryToAll = () => {
    const newHeadcounts = { ...headcounts };
    Object.keys(newHeadcounts).forEach(deptCode => {
      const janValue = (newHeadcounts[deptCode] && newHeadcounts[deptCode].data) ? newHeadcounts[deptCode].data[0] || 0 : 0;
      newHeadcounts[deptCode] = { category: newHeadcounts[deptCode].category, data: Array(12).fill(janValue) };
    });
    setHeadcounts(newHeadcounts);
    showAlert('1월 인원이 모든 월에 동일하게 적용되었습니다.');
  };

  useEffect(() => {
    const savedHeadcounts = localStorage.getItem(`budget_headcounts_${year}_${planType}`);
    // Fallback to old budget_headcounts for migration
    const legacyHeadcounts = localStorage.getItem('budget_headcounts');
    const dataToLoad = savedHeadcounts || legacyHeadcounts;
    if (dataToLoad) {
      setHeadcounts(normalizeHeadcounts(JSON.parse(dataToLoad)));
    } else {
      setHeadcounts({});
    }
  }, [year, planType]);

  const save = () => {
    localStorage.setItem(`budget_headcounts_${year}_${planType}`, JSON.stringify(headcounts));
    showAlert('저장되었습니다.');
  };

  const applyToBudget = () => {
    // Check if any dept is locked
    const lockedDepts = Object.keys(headcounts).filter(deptCode => isBudgetLocked(deptCode, year, planType));
    if (lockedDepts.length > 0) {
      showAlert(`제출 및 승인된 예산은 수정할 수 없습니다 (예: ${allDepts.find(d => d.code === lockedDepts[0])?.name}).`);
      return;
    }

    const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
    
    let stats = {
      deptCount: Object.keys(headcounts).length,
      accountCount: targetAccountCodes.length,
      updatedAutoRows: 0,
      preservedManualRows: 0,
      totalAmount: 0
    };

    allDepts.forEach(dept => {
      const storageKey = getBudgetDataKey(dept.code, year, planType);
      const existingDataStr = localStorage.getItem(storageKey);
      if (existingDataStr) {
        let budgetData: any[] = JSON.parse(existingDataStr);
        budgetData.forEach(row => {
          if (targetAccountCodes.includes(row.code)) {
            if (row.sourceType === 'BUSINESS_ACTIVITY_AUTO') {
              stats.updatedAutoRows += 1;
            } else {
              stats.preservedManualRows += 1;
            }
          }
        });
      }
    });

    Object.keys(headcounts).forEach(deptCode => {
      const deptHeadcounts = headcounts[deptCode];
      const category = deptHeadcounts.category;
      const accountMappings = {
        '회의비': category === '제조' ? 'A60624102' : 'B52224102',
        '간담회비': category === '제조' ? 'A60601123' : 'B52201123',
        '부서별그룹활동지원비': category === '제조' ? 'A60601155' : 'B52201155',
      };
      Object.entries(accountMappings).forEach(([expenseName, accountCode]) => {
        const expenseAmount = expenses[expenseName as keyof typeof expenses];
        const budgetValues = deptHeadcounts.data.map(h => h * expenseAmount);
        stats.totalAmount += budgetValues.reduce((a, b) => a + b, 0);
      });
    });

    setPreviewApplyConfig({
      isOpen: true,
      summary: stats
    });
  };

  const confirmApplyToBudget = () => {
    const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
    
    // 1. First, remove AUTO accounts from ALL departments
    allDepts.forEach(dept => {
      const storageKey = getBudgetDataKey(dept.code, year, planType);
      const existingDataStr = localStorage.getItem(storageKey);
      if (existingDataStr) {
        let budgetData: any[] = JSON.parse(existingDataStr);
        const originalLength = budgetData.length;
        budgetData = budgetData.filter(row => !(targetAccountCodes.includes(row.code) && row.sourceType === 'BUSINESS_ACTIVITY_AUTO'));
        if (budgetData.length !== originalLength) {
          BudgetRepository.saveRows(dept.code, year, planType, budgetData);
        }
      }
    });

    Object.keys(headcounts).forEach(deptCode => {
      const deptHeadcounts = headcounts[deptCode];
      const category = deptHeadcounts.category; // '제조' | '판관'
      const storageKey = getBudgetDataKey(deptCode, year, planType);
      const existingDataStr = localStorage.getItem(storageKey);
      let budgetData: any[] = existingDataStr ? JSON.parse(existingDataStr) : [];

      const accountMappings = {
        '회의비': category === '제조' ? 'A60624102' : 'B52224102',
        '간담회비': category === '제조' ? 'A60601123' : 'B52201123',
        '부서별그룹활동지원비': category === '제조' ? 'A60601155' : 'B52201155',
      };

      Object.entries(accountMappings).forEach(([expenseName, accountCode]) => {
        const expenseAmount = expenses[expenseName as keyof typeof expenses];
        const budgetValues = deptHeadcounts.data.map(h => h * expenseAmount);

        // Check if there's a manual row
        const manualRowFound = budgetData.some(row => row.code === accountCode && row.sourceType !== 'BUSINESS_ACTIVITY_AUTO');
        
        if (!manualRowFound && budgetValues.some(v => v > 0)) {
          // Find account name
          let accountName = '';
          INITIAL_CATEGORIES.forEach(cat => {
            const acc = cat.accounts.find(a => a.code === accountCode);
            if (acc) accountName = acc.name;
          });

          budgetData.push({
            id: `acc_${accountCode}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            code: accountCode,
            name: accountName,
            detail: '업무활동경비 자동반영',
            calculation: '인원수 * 단가',
            values: budgetValues,
            attributedDeptCode: deptCode,
            sourceType: 'BUSINESS_ACTIVITY_AUTO',
            sourceFormulaId: `BUSINESS_ACTIVITY_${year}_${planType}`
          });
        }
      });

      BudgetRepository.saveRows(deptCode, year, planType, budgetData);
    });
    setPreviewApplyConfig(null);
    showAlert('예산작성에 반영되었습니다.');
  };

  const reset = () => {
    showConfirm('정말 초기화하시겠습니까?', () => {
      setHeadcounts({});
      localStorage.removeItem(`budget_headcounts_${year}_${planType}`);
      
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
      allDepts.forEach(dept => {
        const storageKey = getBudgetDataKey(dept.code, year, planType);
        const existingDataStr = localStorage.getItem(storageKey);
        if (existingDataStr) {
          let budgetData: any[] = JSON.parse(existingDataStr);
          const originalLength = budgetData.length;
          // Protect manual rows
          budgetData = budgetData.filter(row => !(targetAccountCodes.includes(row.code) && row.sourceType === 'BUSINESS_ACTIVITY_AUTO'));
          if (budgetData.length !== originalLength) {
            BudgetRepository.saveRows(dept.code, year, planType, budgetData);
          }
        }
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#191f28]">업무활동경비</h2>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 p-0.5 bg-[#f2f4f6] rounded-2xl">
            <button onClick={() => setImportModal({...importModal, isOpen: true})} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><FileDown className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 데이터 가져오기</button>
            <button onClick={distributeJanuaryToAll} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Divide className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 인원 전체 적용</button>
            <button onClick={() => setDeptModal(true)} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Plus className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 부서 추가</button>
            <button onClick={deleteSelectedDepts} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-500" /> 부서 삭제</button>
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-[#f2f4f6] rounded-2xl">
            <button onClick={save} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Save className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 임시저장</button>
            <button onClick={applyToBudget} className="flex items-center justify-center w-[120px] py-1.5 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-all shadow-sm"><Send className="w-3.5 h-3.5 mr-1.5" /> 반영하기</button>
            <button onClick={reset} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-500" /> 초기화</button>
            <button onClick={handleExcelDownload} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Download className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 엑셀 다운로드</button>
          </div>
        </div>
      </div>

      {importModal.isOpen && (
        <AppModal
          isOpen={importModal.isOpen}
          title="데이터 가져오기"
          onClose={() => setImportModal({...importModal, isOpen: false})}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setImportModal({...importModal, isOpen: false})}>
                취소
              </AppButton>
              <AppButton onClick={handleImportData}>
                가져오기
              </AppButton>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#4e5968] mb-1">연도</label>
              <select 
                value={importModal.sourceYear} 
                onChange={(e) => setImportModal({...importModal, sourceYear: e.target.value})} 
                className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="2026">2026년</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#4e5968] mb-1">계획구분</label>
              <select 
                value={importModal.sourcePlanType} 
                onChange={(e) => setImportModal({...importModal, sourcePlanType: e.target.value})} 
                className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="경영계획">경영계획</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차RP">1차RP</option>
                <option value="2차RP">2차RP</option>
              </select>
            </div>
          </div>
        </AppModal>
      )}

      {deptModal && (
        <AppModal
          isOpen={deptModal}
          title="부서 추가"
          description={`선택 가능 부서: ${filteredViewableDepts.length}개`}
          onClose={() => { setSelectedDeptsToAdd([]); setDeptModal(false); }}
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-text-muted">
                선택 {selectedDeptsToAdd.length}개
              </div>
              <div className="flex gap-2">
                <AppButton variant="secondary" onClick={() => { setSelectedDeptsToAdd([]); setDeptModal(false); }}>
                  취소
                </AppButton>
                <AppButton
                  disabled={selectedDeptsToAdd.length === 0}
                  onClick={() => {
                    const newHeadcounts = {...headcounts};
                    selectedDeptsToAdd.forEach(deptCode => {
                      newHeadcounts[deptCode] = { category: '판관', data: Array(12).fill(0) };
                    });
                    setHeadcounts(newHeadcounts);
                    setSelectedDeptsToAdd([]);
                    setDeptModal(false);
                  }}
                >
                  추가
                </AppButton>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <input 
              type="text"
              placeholder="부서명 또는 코드 검색"
              value={deptSearch}
              onChange={(e) => setDeptSearch(e.target.value)}
              className="w-full p-2 border rounded-xl text-sm"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedDeptsToAdd(filteredViewableDepts.map(d => d.code))}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >전체 선택</button>
              <button 
                onClick={() => setSelectedDeptsToAdd([])}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >전체 해제</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredViewableDepts.map(dept => (
                <label key={dept.code} className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={selectedDeptsToAdd.includes(dept.code)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeptsToAdd([...selectedDeptsToAdd, dept.code]);
                      else setSelectedDeptsToAdd(selectedDeptsToAdd.filter(c => c !== dept.code));
                    }}
                    className="mr-2"
                  />
                  {dept.name} ({dept.code})
                </label>
              ))}
            </div>
          </div>
        </AppModal>
      )}

      <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm">
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block text-sm font-bold mb-1">연도</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-2 border rounded-xl">
              <option value="2026">2026년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">계획구분</label>
            <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full p-2 border rounded-xl">
              <option value="경영계획">경영계획</option>
              <option value="수정경영계획">수정경영계획</option>
              <option value="1차RP">1차RP</option>
              <option value="2차RP">2차RP</option>
              {/* Removed 실적 */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">구분 필터</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full p-2 border rounded-xl">
              <option value="전체">전체</option>
              <option value="제조">제조</option>
              <option value="판관">판관</option>
            </select>
          </div>
          {Object.entries(expenses).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-bold mb-1">{key}</label>
              <input 
                type="text" 
                value={value.toLocaleString()}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(Number(rawValue))) {
                    setExpenses({...expenses, [key]: Number(rawValue)})
                  }
                }}
                className="w-full p-2 border rounded-xl text-right"
              />
            </div>
          ))}
        </div>

        <h3 className="text-lg font-bold mb-4">업무활동경비 반영 인원</h3>
        <div className="overflow-x-auto">
          <AppTable className="text-xs">
            <AppTableHeader>
              <tr>
                <AppTableHead className="w-8 sticky left-0 z-20">선택</AppTableHead>
                <AppTableHead className="w-20 sticky left-8 z-20">구분</AppTableHead>
                <AppTableHead className="w-24 sticky left-[112px] z-20">부서코드</AppTableHead>
                <AppTableHead className="p-0 sticky left-[208px] z-20 bg-lithium-50" style={{ width: deptNameWidth, minWidth: deptNameWidth }}>
                  <ResizableHeader title="부서명" width={deptNameWidth} minWidth={100} onResize={setDeptNameWidth} />
                </AppTableHead>
                {Array.from({length: 12}).map((_, i) => <AppTableHead key={i} className="text-center w-[72px] min-w-[72px]">{i+1}월</AppTableHead>)}
                <AppTableHead className="text-right w-28 min-w-[112px] sticky right-0 z-20 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] bg-lithium-50">합계</AppTableHead>
              </tr>
            </AppTableHeader>
            <AppTableBody className="divide-y divide-lithium-100">
              {Object.keys(headcounts).filter(deptCode => {
                if (categoryFilter === '전체') return true;
                return headcounts[deptCode].category === categoryFilter;
              }).sort((a, b) => a.localeCompare(b)).map((deptCode, rowIndex) => {
                const dept = allDepts.find(d => d.code === deptCode);
                const sum = headcounts[deptCode]?.data.reduce((a, b) => a + b, 0) || 0;
                const isSelected = selectedDepts.includes(deptCode);
                
                return (
                  <AppTableRow key={deptCode} className={isSelected ? 'bg-lithium-50' : 'hover:bg-lithium-50/50'}>
                    <AppTableCell className="text-center sticky left-0 z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDepts([...selectedDepts, deptCode]);
                          else setSelectedDepts(selectedDepts.filter(d => d !== deptCode));
                        }}
                      />
                    </AppTableCell>
                    <AppTableCell className="p-1 sticky left-8 z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">
                      <select 
                        value={headcounts[deptCode]?.category || '판관'}
                        onChange={(e) => {
                          const newHeadcounts = {...headcounts};
                          newHeadcounts[deptCode].category = e.target.value as '제조' | '판관';
                          setHeadcounts(newHeadcounts);
                        }}
                        className="w-full p-1 border border-lithium-200 rounded text-xs bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="제조">제조</option>
                        <option value="판관">판관</option>
                      </select>
                    </AppTableCell>
                    <AppTableCell className="text-lithium-600 font-mono sticky left-[112px] z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">{deptCode}</AppTableCell>
                    <AppTableCell className="font-medium sticky left-[208px] z-10 bg-inherit shadow-[1px_0_0_#F0F1F3] truncate" style={{ maxWidth: deptNameWidth, minWidth: deptNameWidth }}>{dept?.name || '알 수 없음'}</AppTableCell>
                    {Array.from({length: 12}).map((_, i) => {
                      const val = headcounts[deptCode]?.data[i] || 0;
                      return (
                        <AppTableCell key={i} className="p-0 border-r border-lithium-100 last:border-r-0">
                          <input 
                            id={`cell-${rowIndex}-${i}`}
                            type="text"
                            value={val === 0 ? '' : val.toLocaleString()}
                            placeholder="0"
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, i)}
                            onChange={(e) => {
                              let valStr = e.target.value.replace(/,/g, '');
                              const numVal = parseInt(valStr || '0', 10);
                              if (isNaN(numVal) || numVal < 0) return;
                              const newHeadcounts = {...headcounts};
                              newHeadcounts[deptCode].data[i] = numVal;
                              setHeadcounts(newHeadcounts);
                            }}
                            className={`w-full h-10 px-2 text-right tabular-nums text-xs bg-transparent hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 ${val === 0 ? 'text-lithium-400' : 'text-eco-black font-medium'}`}
                          />
                        </AppTableCell>
                      );
                    })}
                    <AppTableCell className={`text-right font-bold tabular-nums sticky right-0 z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] ${sum > 0 ? 'text-brand-600 bg-brand-50/50' : 'text-lithium-400 bg-lithium-50/50'}`}>
                      {sum.toLocaleString()}
                    </AppTableCell>
                  </AppTableRow>
                );
              })}
            </AppTableBody>
          </AppTable>
        </div>
      </div>

      {previewApplyConfig?.isOpen && (
        <AppModal
          isOpen={previewApplyConfig.isOpen}
          title="업무활동경비 예산 반영"
          onClose={() => setPreviewApplyConfig(null)}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setPreviewApplyConfig(null)}>
                취소
              </AppButton>
              <AppButton onClick={confirmApplyToBudget}>
                반영
              </AppButton>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#191f28]">업무활동경비 자동산출 예산을 반영하시겠습니까?</p>
            <p className="text-xs text-[#8b95a1]">수기 입력된 동일 계정 row는 삭제지 않 고 보존됩니다.</p>
            <div className="p-4 bg-zinc-50 rounded-xl space-y-2 text-xs text-[#4e5968]">
              <div className="flex justify-between"><span>반영 대상 부서 수:</span> <span className="font-semibold text-zinc-900">{previewApplyConfig.summary.deptCount}개</span></div>
              <div className="flex justify-between"><span>반영 계정 수:</span> <span className="font-semibold text-zinc-900">{previewApplyConfig.summary.accountCount}개</span></div>
              <div className="flex justify-between"><span>생성/갱신될 자동산출 row 수:</span> <span className="font-semibold text-zinc-900">{previewApplyConfig.summary.updatedAutoRows}개</span></div>
              <div className="flex justify-between"><span>보존되는 수기 row 수:</span> <span className="font-semibold text-zinc-900">{previewApplyConfig.summary.preservedManualRows}개</span></div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 mt-2">
                <span className="font-medium text-brand-600">총 반영 금액:</span> <span className="font-bold text-brand-600 text-sm">{previewApplyConfig.summary.totalAmount.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </AppModal>
      )}

      {/* Modal */}
      <AppModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            {modalConfig.type === 'confirm' && (
              <AppButton variant="secondary" onClick={closeModal}>취소</AppButton>
            )}
            <AppButton onClick={() => {
                closeModal();
                if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                    modalConfig.onConfirm();
                }
            }}>
              확인
            </AppButton>
          </div>
        }
      >
        <p className="text-[#4e5968] text-sm leading-relaxed">{modalConfig.message}</p>
      </AppModal>

      {/* 5. Flow Assist Bridge Panel */}
      <div className="bg-[#fcfdfe] p-6 rounded-2xl border border-teal-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
            비즈니스 중요 플로우 연속성 가이드
          </h4>
          <p className="text-xs text-[#647067] mt-1">
            인원 투입에 근거한 활동경비 산출 및 예산 반영이 완결되었습니까? 다음 권장 흐름은 편성된 예산의 한도 규정을 대조하고 모니터링하는 <strong className="text-teal-700">예산 한도 점검(오버런)</strong> 단계입니다.
          </p>
        </div>
        <button
          onClick={() => navigate('/overrun-check')}
          className="px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
        >
          예산 한도 점검(오버런) 단계로 이동 →
        </button>
      </div>
    </div>
  );
}
