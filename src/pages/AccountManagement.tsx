import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Search, 
  Trash2, 
  Plus, 
  Edit3, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Database,
  Briefcase
} from 'lucide-react';
import { INVESTMENT_ACCOUNTS } from '../lib/accountMaster';

interface AccountCodeItem {
  code: string;
  name: string;
  categoryName: string;
  budgetType: 'GENERAL' | 'INVESTMENT';
  managementCategory: '제조' | '판관' | '안전' | '환경' | '연구' | '투자';
  description?: string;
}

export default function AccountManagement() {
  const [accounts, setAccounts] = useState<AccountCodeItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // New account form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AccountCodeItem>({
    code: '',
    name: '',
    categoryName: '판관비 - 업무활동',
    budgetType: 'GENERAL',
    managementCategory: '판관',
    description: ''
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Initial Load
  useEffect(() => {
    const raw = localStorage.getItem('hycm_accounts_master');
    if (raw) {
      try {
        setAccounts(JSON.parse(raw));
      } catch (e) {
        setAccounts(getDefaultAccounts());
      }
    } else {
      const def = getDefaultAccounts();
      setAccounts(def);
      localStorage.setItem('hycm_accounts_master', JSON.stringify(def));
    }
  }, []);

  const getDefaultAccounts = (): AccountCodeItem[] => {
    const arr: AccountCodeItem[] = [];
    
    // Add General accounts
    const generals: AccountCodeItem[] = [
      { code: 'A51100', name: '업무추진비', categoryName: '판관비 - 임원회의', budgetType: 'GENERAL', managementCategory: '판관', description: '임원 판판공경비 집행' },
      { code: 'A51200', name: '업무활동비', categoryName: '판관비 - 본사운영', budgetType: 'GENERAL', managementCategory: '판관', description: '부서 업무 수행 지원 경비' },
      { code: 'A51300', name: '여비교통비', categoryName: '판관비 - 철도항공', budgetType: 'GENERAL', managementCategory: '판관', description: '출장 실비를 위한 전도 전주 소모' },
      { code: 'A51400', name: '소모품비', categoryName: '판관비 - 복사용지', budgetType: 'GENERAL', managementCategory: '판관', description: '문구 수급비 및 소모성 성질' },
      { code: 'A61100', name: '공구기구비', categoryName: '제조비 - 부서운영', budgetType: 'GENERAL', managementCategory: '제조', description: '제조 1,2공장 생산 보조 소스' },
      { code: 'A61200', name: '외주가공비', categoryName: '제조비 - 부품임가공', budgetType: 'GENERAL', managementCategory: '제조', description: '외부 제작 협력사 임가공 집결 고정비' },
      { code: 'A61500', name: '기타복리후생비', categoryName: '제조비 - 식대복지', budgetType: 'GENERAL', managementCategory: '제조', description: '현장 급식 복리 후생비 지원금' },
      { code: 'A71000', name: '안전보건설비', categoryName: '투자비 - 안전보강', budgetType: 'GENERAL', managementCategory: '안전', description: '의무 소방법 등 안전 관련 지출' },
      { code: 'A81000', name: '온실가스설비', categoryName: '투자비 - 환경보전', budgetType: 'GENERAL', managementCategory: '환경', description: '탄소 배출 점감용 전도 소모성 자금' }
    ];

    // Combine with Investment accounts
    const investmentItems: AccountCodeItem[] = INVESTMENT_ACCOUNTS.map(i => ({
      code: i.code,
      name: i.name,
      categoryName: i.categoryName,
      budgetType: 'INVESTMENT',
      managementCategory: '투자',
      description: '품의 승인을 득하는 장기 자산 취득 고정 자산비'
    }));

    return [...generals, ...investmentItems];
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('error', '계정 코드와 명칭을 정확히 채워주세요.');
      return;
    }

    let newList = [...accounts];
    if (isEditing) {
      newList = newList.map(a => a.code === formData.code ? formData : a);
      showToast('success', `계정 [${formData.code}] 정보가 정상 갱신되었습니다.`);
    } else {
      // Check duplicate
      const duplicate = accounts.some(a => a.code === formData.code);
      if (duplicate) {
        showToast('error', '이미 존재하는 계정 코드입니다.');
        return;
      }
      newList.push(formData);
      showToast('success', `신규 [${formData.code}] 계정이 시스템 마스터에 등록되었습니다.`);
    }

    setAccounts(newList);
    localStorage.setItem('hycm_accounts_master', JSON.stringify(newList));
    setIsModalOpen(false);
  };

  const handleDeleteAccount = (code: string) => {
    if (window.confirm(`계정 코드 [${code}]를 정말 마스터에서 제거하시겠습니까? 기존 예산 대조의 무예산 집행으로 변동될 수 있습니다.`)) {
      const newList = accounts.filter(a => a.code !== code);
      setAccounts(newList);
      localStorage.setItem('hycm_accounts_master', JSON.stringify(newList));
      showToast('success', '계정 코드가 안전하게 영구 제거되었습니다.');
    }
  };

  const handleOpenEdit = (item: AccountCodeItem) => {
    setFormData(item);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      categoryName: '판관비 - 업무활동',
      budgetType: 'GENERAL',
      managementCategory: '판관',
      description: ''
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const filtered = accounts.filter(item => {
    if (filterCategory !== 'all' && item.managementCategory !== filterCategory) return false;
    
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        item.code.toLowerCase().includes(t) ||
        item.name.toLowerCase().includes(t) ||
        (item.description && item.description.toLowerCase().includes(t))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-40 p-4 rounded-xl shadow-lg border text-xs font-bold font-sans flex items-center gap-2 animate-bounce ${
          notification.type === 'success' ? 'bg-[#f0f9f8] text-[#008f83] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#f0f9f8] text-[#008f83] border border-teal-150 px-2.5 py-0.5 rounded font-bold font-mono">ERP Account Master</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            계정 코드 마스터 표준 관리실
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            전사 실적 대조 및 예산 수립에 공칭 사용되는 투자 예산과 판관, 제조 경비용 대분류 계정 코드 및 소속 가치를 중앙 일괄 수정합니다.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          신규 계정코드 추가
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 bg-teal-50 text-[#008f83] rounded-xl"><Database className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] text-zinc-400 block font-bold">총 마스터 계정수</span>
            <span className="text-lg font-bold text-[#111111] font-mono block">{accounts.length}개</span>
          </div>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 bg-zinc-50 text-zinc-500 rounded-xl"><Briefcase className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] text-zinc-400 block font-bold">일반 경비성 계정</span>
            <span className="text-lg font-bold text-[#111111] font-mono block">{accounts.filter(a => a.budgetType === 'GENERAL').length}개</span>
          </div>
        </div>
        <div className="bg-white border border-[#dde5de] p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><FolderPlus className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] text-zinc-400 block font-bold">투자 자산성 계정</span>
            <span className="text-lg font-bold text-amber-600 font-mono block">{accounts.filter(a => a.budgetType === 'INVESTMENT').length}개</span>
          </div>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 bg-teal-100/50 text-[#008f83] rounded-xl"><CheckCircle className="w-5 h-5" /></div>
          <div>
            <span className="text-[10px] text-[#008f83] block font-bold">동기화 규격 검출율</span>
            <span className="text-lg font-bold text-[#008f83] font-mono block">100.0%</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#dde5de] flex flex-col sm:flex-row gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-60"
        >
          <option value="all">전체 비즈니스 분류 [All]</option>
          <option value="판관">판관 (판정 및 관리경비)</option>
          <option value="제조">제조 (공장 생산경비)</option>
          <option value="투자">투자 (고정자료 취득자원)</option>
          <option value="안전">안전 (안전보건 전담)</option>
          <option value="환경">환경 (탄소저감 규제준수)</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-sans"
            placeholder="계정 코드 숫자, 계정 명칭, 또는 비고 한글 명세 검색..."
          />
        </div>
      </div>

      {/* Accounts List Grid Table */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">계정코드</th>
              <th className="px-5 py-3">계정명칭</th>
              <th className="px-5 py-3">세부 분류 카테고리</th>
              <th className="px-5 py-3 text-center">예산 구질</th>
              <th className="px-5 py-3 text-center">통제 분류</th>
              <th className="px-5 py-3">계정 정의 및 적요 사유</th>
              <th className="px-5 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-400 font-medium font-sans animate-fade">
                  매칭 검색되는 예산 계정 품목이 마스터 테이블에 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.code} className="hover:bg-[#f7f9f7]/55">
                  <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-teal-700">
                    {item.code}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-[#111111]">
                    {item.name}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-zinc-500">
                    {item.categoryName}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      item.budgetType === 'INVESTMENT' ? 'bg-amber-50 text-amber-700 border border-[#fbd6b4]' : 'bg-emerald-50 text-[#008f83]'
                    }`}>
                      {item.budgetType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-center text-zinc-700 font-bold">
                    {item.managementCategory}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 max-w-sm font-sans truncate" title={item.description}>
                    {item.description || '-'}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 px-1.5 bg-white text-zinc-500 hover:text-teal-600 border border-[#dde5de] rounded hover:border-teal-500 cursor-pointer"
                      title="계정 편집"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(item.code)}
                      className="p-1 px-1.5 bg-white text-rose-500 hover:text-rose-700 border border-[#dde5de] rounded hover:border-rose-400 cursor-pointer"
                      title="계정 영구 제거"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Account Code Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[#dde5de] animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#111111] border-b border-[#eef2ec] pb-3 mb-4 font-sans">
              {isEditing ? '기존 계정 마스터 큐 편집' : '신규 계정코드 고유 제안 등록'}
            </h3>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#647067] font-bold mb-1">계정코드 <span className="text-zinc-400 font-normal">(수정 불가)</span></label>
                <input
                  type="text"
                  value={formData.code}
                  disabled={isEditing}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
                  placeholder="예: A51900"
                />
              </div>

              <div>
                <label className="block text-[#647067] font-bold mb-1">품목 계정명칭</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none"
                  placeholder="예: 특수포장부재료비"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#647067] font-bold mb-1">예산 구질 성질</label>
                  <select
                    value={formData.budgetType}
                    onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#dde5de] rounded-xl"
                  >
                    <option value="GENERAL">GENERAL (경비용)</option>
                    <option value="INVESTMENT">INVESTMENT (투자용)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#647067] font-bold mb-1">통제 대분류군</label>
                  <select
                    value={formData.managementCategory}
                    onChange={(e) => setFormData({ ...formData, managementCategory: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#dde5de] rounded-xl"
                  >
                    <option value="판관">판관경비</option>
                    <option value="제조">제조가공</option>
                    <option value="안전">안전보건</option>
                    <option value="환경">기후환경</option>
                    <option value="투자">자산투자</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#647067] font-bold mb-1">세목 카테고리 명칭</label>
                <input
                  type="text"
                  value={formData.categoryName}
                  onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl placeholder-zinc-300"
                  placeholder="예: 제조비 - 특수부속"
                />
              </div>

              <div>
                <label className="block text-[#647067] font-bold mb-1 font-sans">상세 용도 명세 요약(비고)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl placeholder-zinc-350"
                  placeholder="감람석 쇄도 억제 및 제조 공임 자금 전도 용도 기술"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#eef2ec] pt-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#f7f9f7] text-[#4e5968] font-semibold border border-[#dde5de] rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-[#008f83] text-white font-semibold rounded-xl hover:bg-[#007369] cursor-pointer"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
