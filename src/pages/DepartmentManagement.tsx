import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  Sliders,
  Database
} from 'lucide-react';
import { DEPARTMENTS, getAllDepartments } from '../constants';

interface DepartmentItem {
  code: string;
  name: string;
  manager: string;
  role: string;
  parentClass?: string;
}

export default function DepartmentManagement() {
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<DepartmentItem>({
    code: '',
    name: '',
    manager: '부서장',
    role: '부서장',
    parentClass: '공장 생산부문'
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const rawCustom = localStorage.getItem('cleanmetal_dept_master_custom');
    if (rawCustom) {
      try {
        setDepts(JSON.parse(rawCustom));
      } catch (e) {
        setDepts(getDefaultDepts());
      }
    } else {
      const def = getDefaultDepts();
      setDepts(def);
      localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(def));
    }
  }, []);

  const getDefaultDepts = (): DepartmentItem[] => {
    return DEPARTMENTS.map(d => ({
      code: d.code,
      name: d.name,
      manager: d.manager || '대표 서명수',
      role: d.role || '부서 실무장',
      parentClass: d.code === '32100' || d.code === '32000' || d.code === '32200' ? '본사 기획재무' : d.code.startsWith('50') ? '공장 기술부문' : '기타 본청 지원부문'
    }));
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('error', '부서코드와 부서명을 기록해주세요.');
      return;
    }

    let newList = [...depts];
    if (isEditing) {
      newList = newList.map(d => d.code === formData.code ? formData : d);
      showToast('success', `부서 [${formData.code}] 마스터 명세가 수정되었습니다.`);
    } else {
      const duplicate = depts.some(d => d.code === formData.code);
      if (duplicate) {
        showToast('error', '이미 등록된 시스템 부서코드입니다.');
        return;
      }
      newList.push(formData);
      showToast('success', `신규 [${formData.code}] 부서가 마스터 테이블에 등록되었습니다.`);
    }

    setDepts(newList);
    localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(newList));
    
    // Sync to custom users structure if necessary
    const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];
    const exists = customUsers.some((u: any) => u.code === formData.code);
    if (!exists) {
      customUsers.push({
        code: formData.code,
        name: formData.manager,
        department: formData.name,
        role: formData.role
      });
      localStorage.setItem('cleanmetal_custom_users', JSON.stringify(customUsers));
    }

    setIsModalOpen(false);
  };

  const handleDeleteDept = (code: string) => {
    if (code === '99999' || code === '32100') {
      showToast('error', '시스템 기본운영 부서 및 기획재무는 마스터에서 삭제가 불가합니다.');
      return;
    }

    if (window.confirm(`부서코드 [${code}]를 삭제하시겠습니까? 해당 부서에 할당된 예산 정보판을 조회할 수 없게 될 수 있습니다.`)) {
      const newList = depts.filter(d => d.code !== code);
      setDepts(newList);
      localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(newList));
      showToast('success', '부서 마스터에서 제거 성공하였습니다.');
    }
  };

  const handleOpenEdit = (item: DepartmentItem) => {
    setFormData(item);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      manager: '대표 대리인',
      role: '부서담당자',
      parentClass: '공장 생산부문'
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const filtered = depts.filter(item => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        item.code.toLowerCase().includes(t) ||
        item.name.toLowerCase().includes(t) ||
        item.manager.toLowerCase().includes(t) ||
        (item.parentClass && item.parentClass.toLowerCase().includes(t))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-40 p-4 rounded-xl shadow-lg border text-xs font-bold font-sans flex items-center gap-2 animate-bounce ${
          notification.type === 'success' ? 'bg-[#f0f9f8] text-[#008f83] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-[#008f83] border border-teal-150 px-2.5 py-0.5 rounded font-bold font-mono">CC Cost Center Master</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            부서 / 코스트센터 (Cost Center) 마스터 관리실
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            소형 파트사 및 대형 공장, 본사 지원 조직의 고유 가치 코드와 가람 대리 실무장명을 원격 제어하여 시스템 접근 조회 한계를 배치합니다.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          신규 부서코드 등록
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-[#008f83] rounded-2xl"><Users className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-zinc-400 block font-sans">총 코스트 센터 부서수</span>
            <span className="text-xl font-bold text-zinc-900 font-mono block mt-1">{depts.length}개 조직</span>
          </div>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-zinc-50 text-zinc-500 rounded-2xl"><Database className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-zinc-400 block font-sans">현업 생산 현장 파트</span>
            <span className="text-xl font-bold text-zinc-900 font-mono block mt-1">{depts.filter(d => d.code.startsWith('50')).length}개 센터</span>
          </div>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-100 text-[#008f83] rounded-2xl"><Shield className="w-6 h-6" /></div>
          <div>
            <span className="text-xs text-[#008f83] block font-sans">보안 검증 통제력</span>
            <span className="text-xl font-bold text-[#008f83] font-mono block mt-1">Active</span>
          </div>
        </div>
      </div>

      {/* Advanced search toolbar */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400 font-sans"
            placeholder="부서 코드 번호, 부서 단위명, 소속 서명인, 또는 대분류 부문을 입력하여 필터합니다."
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">부서 코드</th>
              <th className="px-5 py-3">부서명칭</th>
              <th className="px-5 py-3">소속 상위 클래스 부문</th>
              <th className="px-5 py-3">책임 실무장명</th>
              <th className="px-5 py-3">시스템 수급 역할</th>
              <th className="px-5 py-3 text-center">액션 조치</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {filtered.map(item => (
              <tr key={item.code} className="hover:bg-[#f7f9f7]/55">
                <td className="px-5 py-3.5 font-mono font-bold text-[#008f83]">{item.code}</td>
                <td className="px-5 py-3.5 font-semibold text-[#111111]">{item.name}</td>
                <td className="px-5 py-3.5 text-zinc-500">{item.parentClass || '기본 본사지원부서'}</td>
                <td className="px-5 py-3.5 text-zinc-800 font-sans font-medium">{item.manager}</td>
                <td className="px-5 py-3.5"><span className="bg-zinc-100 text-zinc-650 px-2 py-0.5 rounded font-bold text-[10px]">{item.role}</span></td>
                <td className="px-5 py-3.5 text-center space-x-1 whitespace-nowrap">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 px-1.5 bg-white text-zinc-500 hover:text-teal-600 border border-[#dde5de] rounded hover:border-teal-500 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteDept(item.code)}
                    className="p-1 px-1.5 bg-white text-rose-500 hover:text-rose-700 border border-[#dde5de] rounded hover:border-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dept Code Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[#dde5de] animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#111111] border-b border-[#eef2ec] pb-3 mb-4">
              {isEditing ? '부서 정보 수정 편집' : '신규 코스트센터 정보 제안 등록'}
            </h3>

            <form onSubmit={handleSaveDept} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#647067] font-bold mb-1">부서코드 <span className="text-zinc-400 font-normal">(수정 불가)</span></label>
                <input
                  type="text"
                  value={formData.code}
                  disabled={isEditing}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
                  placeholder="예: 50260"
                />
              </div>

              <div>
                <label className="block text-[#647067] font-bold mb-1">코스트센터 부서명칭</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500"
                  placeholder="예: 공장 기획팀"
                />
              </div>

              <div>
                <label className="block text-[#647067] font-bold mb-1">상위 소속 클래스 부문 분류</label>
                <select
                  value={formData.parentClass}
                  onChange={(e) => setFormData({ ...formData, parentClass: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#dde5de] rounded-xl"
                >
                  <option value="본사 기획재무">본사 기획재무 부문</option>
                  <option value="공장 생산부문">공장 생산 제조부분</option>
                  <option value="공장 기술지원">공장 기술 지원본부</option>
                  <option value="본청 자금운영">본청 자금 및 소싱운영</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#647067] font-bold mb-1">책임 실무장명</label>
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    className="w-full p-2.5 border border-[#dde5de] rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[#647067] font-bold mb-1">시스템 권한 역할</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2.5 border border-[#dde5de] rounded-xl"
                  />
                </div>
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
