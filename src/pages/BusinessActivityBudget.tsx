import React, { useState, useEffect, useRef } from 'react';
import { Download, Save, Send, Trash2, Plus, Building2, FileDown, Divide, Copy } from 'lucide-react';
import { DEPARTMENTS, STORAGE_KEYS, getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey } from '../lib/storageKeys';
import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';

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
  const [deptModal, setDeptModal] = useState(false);
  const [selectedDeptsToAdd, setSelectedDeptsToAdd] = useState<string[]>([]);
  const [deptNameWidth, setDeptNameWidth] = useState(200);

  const [importModal, setImportModal] = useState({ 
    isOpen: false, 
    sourceYear: '2026',
    sourcePlanType: '경영계획'
  });
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

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

  const handleImportData = () => {
    // In a real app, this would fetch data based on importModal.sourceYear and importModal.sourcePlanType
    // For now, we'll simulate it by setting some mock data
    const newHeadcounts = { ...headcounts };
    DEPT_ORDER.forEach(deptCode => {
      newHeadcounts[deptCode] = Array(12).fill(Math.floor(Math.random() * 10) + 1);
    });
    setHeadcounts(newHeadcounts);
    setImportModal({ ...importModal, isOpen: false });
    showAlert(`${importModal.sourceYear}년 ${importModal.sourcePlanType} 데이터를 가져왔습니다.`);
  };

  const addDept = () => {
    // 부서 추가 로직
    showAlert('부서 추가 기능');
  };

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
        
        // Immediately remove from budget data
        const storageKey = getBudgetDataKey(deptCode, year, planType);
        const existingDataStr = localStorage.getItem(storageKey);
        if (existingDataStr) {
          let budgetData: any[] = JSON.parse(existingDataStr);
          const originalLength = budgetData.length;
          budgetData = budgetData.filter(row => !targetAccountCodes.includes(row.code));
          if (budgetData.length !== originalLength) {
            localStorage.setItem(storageKey, JSON.stringify(budgetData));
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
    const savedHeadcounts = localStorage.getItem('budget_headcounts');
    if (savedHeadcounts) setHeadcounts(JSON.parse(savedHeadcounts));
  }, []);

  const save = () => {
    localStorage.setItem('budget_headcounts', JSON.stringify(headcounts));
    showAlert('저장되었습니다.');
  };

  const applyToBudget = () => {
    const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
    
    // 1. First, remove these accounts from ALL departments to clean up any orphaned data
    allDepts.forEach(dept => {
      const storageKey = getBudgetDataKey(dept.code, year, planType);
      const existingDataStr = localStorage.getItem(storageKey);
      if (existingDataStr) {
        let budgetData: any[] = JSON.parse(existingDataStr);
        const originalLength = budgetData.length;
        budgetData = budgetData.filter(row => !targetAccountCodes.includes(row.code));
        if (budgetData.length !== originalLength) {
          localStorage.setItem(storageKey, JSON.stringify(budgetData));
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

        const existingRowIndex = budgetData.findIndex(row => row.code === accountCode);
        if (existingRowIndex !== -1) {
          budgetData[existingRowIndex].values = budgetValues;
        } else {
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
          });
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(budgetData));
    });
    showAlert('예산작성에 반영되었습니다.');
  };

  const reset = () => {
    showConfirm('정말 초기화하시겠습니까?', () => {
      setHeadcounts({});
      localStorage.removeItem('budget_headcounts');
      
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
      allDepts.forEach(dept => {
        const storageKey = getBudgetDataKey(dept.code, year, planType);
        const existingDataStr = localStorage.getItem(storageKey);
        if (existingDataStr) {
          let budgetData: any[] = JSON.parse(existingDataStr);
          const originalLength = budgetData.length;
          budgetData = budgetData.filter(row => !targetAccountCodes.includes(row.code));
          if (budgetData.length !== originalLength) {
            localStorage.setItem(storageKey, JSON.stringify(budgetData));
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
            <button onClick={() => showAlert('엑셀 다운로드')} className="flex items-center justify-center w-[120px] py-1.5 bg-white text-[#4e5968] border border-[#e5e8eb] rounded-xl text-xs font-bold hover:bg-[#f9fafb] transition-all shadow-sm"><Download className="w-3.5 h-3.5 mr-1.5 text-brand-500" /> 엑셀 다운로드</button>
          </div>
        </div>
      </div>

      {importModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-96">
            <h3 className="text-lg font-bold mb-4">데이터 가져오기</h3>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">연도</label>
              <select value={importModal.sourceYear} onChange={(e) => setImportModal({...importModal, sourceYear: e.target.value})} className="w-full p-2 border rounded-xl">
                <option value="2026">2026년</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">계획구분</label>
              <select value={importModal.sourcePlanType} onChange={(e) => setImportModal({...importModal, sourcePlanType: e.target.value})} className="w-full p-2 border rounded-xl">
                <option value="경영계획">경영계획</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차RP">1차RP</option>
                <option value="2차RP">2차RP</option>
                <option value="실적">실적</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportModal({...importModal, isOpen: false})} className="px-4 py-2 bg-gray-200 rounded-xl font-bold">취소</button>
              <button onClick={handleImportData} className="px-4 py-2 bg-brand-500 text-white rounded-xl font-bold">가져오기</button>
            </div>
          </div>
        </div>
      )}

      {deptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-96 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">부서 추가</h3>
            <div className="space-y-2">
              {viewableDepts.filter(d => !headcounts[d.code]).map(dept => (
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
            <div className="flex justify-end mt-4 gap-2">
              <button onClick={() => { setSelectedDeptsToAdd([]); setDeptModal(false); }} className="px-4 py-2 bg-gray-200 rounded-xl font-bold">취소</button>
              <button onClick={() => {
                const newHeadcounts = {...headcounts};
                selectedDeptsToAdd.forEach(deptCode => {
                  newHeadcounts[deptCode] = { category: '판관', data: Array(12).fill(0) };
                });
                setHeadcounts(newHeadcounts);
                setSelectedDeptsToAdd([]);
                setDeptModal(false);
              }} className="px-4 py-2 bg-brand-500 text-white rounded-xl font-bold">추가</button>
            </div>
          </div>
        </div>
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
              <option value="실적">실적</option>
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f9fafb]">
                <th className="border p-1 w-8">선택</th>
                <th className="border p-1 w-20">구분</th>
                <th className="border p-1 w-24">부서코드</th>
                <th className="border p-1" style={{ width: deptNameWidth }}>
                  <ResizableHeader title="부서명" width={deptNameWidth} minWidth={100} onResize={setDeptNameWidth} />
                </th>
                {Array.from({length: 12}).map((_, i) => <th key={i} className="border p-1 text-center w-12">{i+1}월</th>)}
                <th className="border p-1 text-center w-20">합계</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(headcounts).filter(deptCode => {
                if (categoryFilter === '전체') return true;
                return headcounts[deptCode].category === categoryFilter;
              }).sort((a, b) => a.localeCompare(b)).map((deptCode, rowIndex) => {
                const dept = allDepts.find(d => d.code === deptCode);
                
                return (
                  <tr key={deptCode}>
                    <td className="border p-1 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedDepts.includes(deptCode)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDepts([...selectedDepts, deptCode]);
                          else setSelectedDepts(selectedDepts.filter(d => d !== deptCode));
                        }}
                      />
                    </td>
                    <td className="border p-1">
                      <select 
                        value={headcounts[deptCode]?.category || '판관'}
                        onChange={(e) => {
                          const newHeadcounts = {...headcounts};
                          newHeadcounts[deptCode].category = e.target.value as '제조' | '판관';
                          setHeadcounts(newHeadcounts);
                        }}
                        className="w-full p-0.5 border rounded"
                      >
                        <option value="제조">제조</option>
                        <option value="판관">판관</option>
                      </select>
                    </td>
                    <td className="border p-1">{deptCode}</td>
                    <td className="border p-1">{dept?.name || '알 수 없음'}</td>
                    {Array.from({length: 12}).map((_, i) => (
                      <td key={i} className="border p-0">
                        <input 
                          id={`cell-${rowIndex}-${i}`}
                          type="text"
                          value={headcounts[deptCode]?.data[i] || 0}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, i)}
                          onChange={(e) => {
                            let valStr = e.target.value.replace(/,/g, '');
                            if (valStr === '' || valStr === '-') valStr = '0';
                            const val = Number(valStr);
                            if (val < 0) return;
                            const newHeadcounts = {...headcounts};
                            newHeadcounts[deptCode].data[i] = val;
                            setHeadcounts(newHeadcounts);
                          }}
                          className="w-full p-0.5 text-right text-xs"
                        />
                      </td>
                    ))}
                    <td className="border p-1 text-right font-bold bg-[#f9fafb]">
                      {(headcounts[deptCode]?.data.reduce((a, b) => a + b, 0) || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#191f28] mb-2">
                {modalConfig.title}
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
                className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
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
