import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  Database,
  FolderTree,
  FolderPlus,
  ArrowRight
} from 'lucide-react';
import { DEPARTMENTS, getAllDepartments } from '../constants';
import { 
  getDeptGroups, 
  saveDeptGroups, 
  getDeptNameByCode, 
  DeptGroup 
} from '../lib/departmentGroups';

// Department Item in Master
interface DepartmentItem {
  code: string;
  name: string;
  manager: string;
  role: string;
  parentClass?: string;
}

export default function DepartmentManagement() {
  const [currentTab, setCurrentTab] = useState<'master' | 'groups'>('master');
  
  // ----------------------------------------------------
  // Tab 1: Department Master States
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // Tab 2: Department Group States
  // ----------------------------------------------------
  const [groups, setGroups] = useState<DeptGroup[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupEditing, setIsGroupEditing] = useState(false);
  const [groupSearchCodeWord, setGroupSearchCodeWord] = useState(''); // for filtering department selection list
  
  const [groupFormData, setGroupFormData] = useState<{
    id: string;
    name: string;
    parentId: string; // 'none' or active group id
    description: string;
    deptCodes: string[];
  }>({
    id: '',
    name: '',
    parentId: '',
    description: '',
    deptCodes: []
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Initialize Data
  useEffect(() => {
    // Load custom depts
    const rawCustom = localStorage.getItem('cleanmetal_dept_master_custom');
    let loadedDepts: DepartmentItem[] = [];
    if (rawCustom) {
      try {
        loadedDepts = JSON.parse(rawCustom);
        setDepts(loadedDepts);
      } catch (e) {
        loadedDepts = getDefaultDepts();
        setDepts(loadedDepts);
      }
    } else {
      const def = getDefaultDepts();
      loadedDepts = def;
      setDepts(def);
      localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(def));
    }

    // Load custom groups
    setGroups(getDeptGroups());
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

  // ----------------------------------------------------
  // Tab 1: Department Master Handlers
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // Tab 2: Department Group Handlers
  // ----------------------------------------------------
  const handleOpenGroupCreate = () => {
    setGroupFormData({
      id: '',
      name: '',
      parentId: 'none',
      description: '',
      deptCodes: []
    });
    setGroupSearchCodeWord('');
    setIsGroupEditing(false);
    setIsGroupModalOpen(true);
  };

  const handleOpenGroupEdit = (group: DeptGroup) => {
    setGroupFormData({
      id: group.id,
      name: group.name,
      parentId: group.parentId || 'none',
      description: group.description || '',
      deptCodes: [...(group.deptCodes || [])]
    });
    setGroupSearchCodeWord('');
    setIsGroupEditing(true);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormData.id || !groupFormData.name) {
      showToast('error', '그룹 ID와 그룹명을 입력해주세요.');
      return;
    }

    // ID validation for English keys
    const idPattern = /^[A-Z0-9_-]+$/i;
    if (!idPattern.test(groupFormData.id)) {
      showToast('error', '그룹 ID는 영문 대분자, 숫자, 언더바(_), 하이픈(-)만 가능합니다.');
      return;
    }

    let newList = [...groups];
    const groupToSave: DeptGroup = {
      id: groupFormData.id.trim(),
      name: groupFormData.name.trim(),
      parentId: groupFormData.parentId === 'none' ? null : groupFormData.parentId,
      description: groupFormData.description.trim(),
      deptCodes: groupFormData.deptCodes,
      isActive: true,
      createdAt: isGroupEditing ? (groups.find(g => g.id === groupFormData.id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isGroupEditing) {
      newList = newList.map(g => g.id === groupFormData.id ? groupToSave : g);
      showToast('success', `부서 그룹 [${groupFormData.name}] 정보가 업데이트 되었습니다.`);
    } else {
      const duplicate = groups.some(g => g.id.toLowerCase() === groupFormData.id.toLowerCase());
      if (duplicate) {
        showToast('error', '이미 존재하는 그룹 고유 ID입니다.');
        return;
      }
      newList.push(groupToSave);
      showToast('success', `신규 부서 그룹 [${groupFormData.name}]이 등록되었습니다.`);
    }

    setGroups(newList);
    saveDeptGroups(newList);
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = (id: string, name: string) => {
    if (window.confirm(`선택한 부서 그룹 [${name}] (${id})을(를) 삭제하시겠습니까?`)) {
      // check child groups first, they will be detached (parentId becomes null)
      let newList = groups.filter(g => g.id !== id);
      newList = newList.map(g => g.parentId === id ? { ...g, parentId: null, updatedAt: new Date().toISOString() } : g);

      setGroups(newList);
      saveDeptGroups(newList);
      showToast('success', '그룹이 안전하게 삭제되었습니다.');
    }
  };

  // Toggle department code checkbox in the select view of group modal
  const handleToggleDeptInGroup = (code: string) => {
    setGroupFormData(prev => {
      const isExist = prev.deptCodes.includes(code);
      const newCodes = isExist 
        ? prev.deptCodes.filter(c => c !== code) 
        : [...prev.deptCodes, code];
      return { ...prev, deptCodes: newCodes };
    });
  };

  // Fill all filtered deptCodes to existing group selection
  const handleAddAllFilteredDeptCodes = (filteredCodes: string[]) => {
    setGroupFormData(prev => {
      const union = new Set([...prev.deptCodes, ...filteredCodes]);
      return { ...prev, deptCodes: Array.from(union) };
    });
  };

  // Filter groups search
  const filteredGroups = groups.filter(g => {
    if (groupSearchTerm) {
      const t = groupSearchTerm.toLowerCase();
      // ID, name, description, or individual dept codes and their resolved names
      const matchBasic = (
        g.id.toLowerCase().includes(t) ||
        g.name.toLowerCase().includes(t) ||
        (g.description && g.description.toLowerCase().includes(t))
      );
      if (matchBasic) return true;

      const hasMatchCode = g.deptCodes.some(code => {
        const dName = getDeptNameByCode(code).toLowerCase();
        return code.includes(t) || dName.includes(t);
      });
      return hasMatchCode;
    }
    return true;
  });

  // Options for parent groups (prevent selecting self)
  const parentGroupOptions = useMemo(() => {
    return groups.filter(g => !isGroupEditing || g.id !== groupFormData.id);
  }, [groups, isGroupEditing, groupFormData.id]);

  // List of all master departments that can be checked inside the group modal
  const searchableDeptsInGroupModal = useMemo(() => {
    return depts.filter(d => {
      if (groupSearchCodeWord) {
        const term = groupSearchCodeWord.toLowerCase();
        return d.code.includes(term) || d.name.toLowerCase().includes(term);
      }
      return true;
    });
  }, [depts, groupSearchCodeWord]);

  return (
    <div className="space-y-6 font-sans">
      {/* Notifications */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-bounce ${
          notification.type === 'success' ? 'bg-[#f0f9f8] text-[#008f83] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-[#008f83] border border-teal-150 px-2.5 py-0.5 rounded font-bold font-mono">Organization Registry</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5">
            조직 구조 및 마스터 / 부서 그룹 통합 제어부
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            신규 부서 마스터 원장을 제원하고, 코드 기반의 논리 부서 그룹(1공장, 설비관리섹션 등)을 계층 구조화하여 다차원 분석 기반을 마련합니다.
          </p>
        </div>

        <div className="flex gap-2">
          {currentTab === 'master' ? (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              신규 부서코드 등록
            </button>
          ) : (
            <button
              onClick={handleOpenGroupCreate}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
            >
              <FolderPlus className="w-4 h-4" />
              신규 부서 그룹 추가
            </button>
          )}
        </div>
      </div>

      {/* Elegant Tab Picker */}
      <div className="flex border-b border-zinc-200 gap-1 bg-zinc-100/50 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => setCurrentTab('master')}
          className={`flex-1 text-center py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            currentTab === 'master' 
              ? 'bg-white text-[#008f83] shadow-xs border border-zinc-200/60' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/55'
          }`}
        >
          부서 마스터 ({depts.length})
        </button>
        <button
          onClick={() => setCurrentTab('groups')}
          className={`flex-1 text-center py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            currentTab === 'groups' 
              ? 'bg-white text-[#008f83] shadow-xs border border-zinc-200/60' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/55'
          }`}
        >
          부서 그룹 관리 ({groups.length})
        </button>
      </div>

      {currentTab === 'master' ? (
        <>
          {/* Stats row for Master */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-[#008f83] rounded-2xl"><Users className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">총 코스트 센터 부서수</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">{depts.length}개 조직</span>
              </div>
            </div>
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-zinc-50 text-zinc-500 rounded-2xl"><Database className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">현업 생산 현장 파트</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">{depts.filter(d => d.code.startsWith('50')).length}개 센터</span>
              </div>
            </div>
            <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-100 text-[#008f83] rounded-2xl"><Shield className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-[#008f83] block pb-1">보안 검증 통제력</span>
                <span className="text-xl font-bold text-[#008f83] font-mono block">Active</span>
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
                className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400"
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
                  <th className="px-5 py-3 font-medium">책임 실무장명</th>
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
                    <td className="px-5 py-3.5 text-zinc-800 font-medium">{item.manager}</td>
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
        </>
      ) : (
        <>
          {/* Stats row for Groups */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-[#008f83] rounded-2xl"><FolderTree className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">총 생성된 부서 그룹수</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">{groups.length}개 그룹</span>
              </div>
            </div>
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-zinc-50 text-zinc-500 rounded-2xl"><Users className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">그룹 귀속 누적 부서 연계</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">
                  {groups.reduce((acc, curr) => acc + (curr.deptCodes?.length || 0), 0)}건 소속
                </span>
              </div>
            </div>
            <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-100 text-[#008f83] rounded-2xl"><Shield className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-[#008f83] block pb-1">코드 바인딩 정밀성</span>
                <span className="text-xl font-bold text-[#008f83] font-mono block">코딩 매칭 100%</span>
              </div>
            </div>
          </div>

          {/* Group search bar */}
          <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400"
                placeholder="그룹 ID, 그룹명, 설명, 또는 그룹에 포함된 부서코드/명으로 검색합니다."
              />
            </div>
          </div>

          {/* Group Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGroups.map(grp => {
              const parent = groups.find(g => g.id === grp.parentId);
              return (
                <div key={grp.id} className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden flex flex-col hover:border-teal-500/70 hover:shadow-sm transition-all">
                  <div className="p-5 flex-1 space-y-3.5 bg-white">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-[#f0f9f8] text-[#008f83] px-2 py-0.5 rounded border border-teal-100 uppercase">
                          ID: {grp.id}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-900 mt-1">{grp.name}</h4>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenGroupEdit(grp)}
                          className="p-1.5 text-zinc-500 hover:text-teal-600 border border-zinc-200 hover:border-teal-400 rounded-lg cursor-pointer bg-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(grp.id, grp.name)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 border border-zinc-200 hover:border-rose-450 rounded-lg cursor-pointer bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {grp.description && (
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed h-8">
                        {grp.description}
                      </p>
                    )}

                    {parent && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-650 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                        <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[11px] font-semibold text-zinc-550">상위 그룹:</span>
                        <span className="text-[11px] font-bold text-zinc-800">{parent.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">({parent.id})</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        <span>소속 부서원 세부목록 ({grp.deptCodes?.length || 0})</span>
                        <span className="font-mono">Codes Only</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-zinc-50/75 rounded-xl border border-zinc-100">
                        {grp.deptCodes && grp.deptCodes.length > 0 ? (
                          grp.deptCodes.map(code => {
                            const dName = getDeptNameByCode(code);
                            return (
                              <div 
                                key={code} 
                                className="flex items-center gap-1 bg-white border border-zinc-250/70 text-[11px] px-2 py-0.5 rounded-md font-medium text-zinc-700 shadow-3xs"
                              >
                                <span className="font-mono font-bold text-[#008f83]">{code}</span>
                                <span className="text-zinc-400">|</span>
                                <span>{dName}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-[10.5px] text-zinc-400 font-medium italic p-1">그룹에 귀속된 부서가 없습니다.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-zinc-55 border-t border-zinc-100 text-[11px] text-zinc-400 flex justify-between items-center font-mono">
                    <span>최종 수정</span>
                    <span>{new Date(grp.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="col-span-full py-16 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-semibold">검색 조건에 맞는 부서 그룹이 없습니다.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dept Code Modal (Tab 1) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[#dde5de] animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-[#111111] border-b border-[#eef2ec] pb-3 mb-4">
              {isEditing ? '부서 정보 수정 편집' : '신규 코스트센터 정보 제안 등록'}
            </h3>

            <form onSubmit={handleSaveDept} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#647067] font-bold mb-1">부서코드 <span className="text-zinc-400 font-normal">(수정 불가)</span></label>
                <input
                  type="text"
                  value={formData.code}
                  disabled={isEditing}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400 font-mono"
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

      {/* Group Info Modal (Tab 2) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs" onClick={() => setIsGroupModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 border border-[#dde5de] animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-zinc-900 border-b border-[#eef2ec] pb-3 mb-4 flex items-center gap-1.5">
              <FolderTree className="w-5 h-5 text-[#008f83]" />
              {isGroupEditing ? '부서 그룹 세부 속성 및 연계 편집' : '신규 구조적 부서 그룹 정의'}
            </h3>

            <form onSubmit={handleSaveGroup} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              
              {/* Left Column: Properties */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[#647067] font-bold mb-1">
                    그룹 ID <span className="text-rose-500 font-bold">*</span> <span className="text-zinc-400 font-normal">(고정 키값)</span>
                  </label>
                  <input
                    type="text"
                    value={groupFormData.id}
                    disabled={isGroupEditing}
                    onChange={(e) => setGroupFormData({ ...groupFormData, id: e.target.value })}
                    className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400 font-mono uppercase"
                    placeholder="예: PLANT_1 또는 MFG_SUPPORT"
                    required
                  />
                  {!isGroupEditing && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">※ 영문 대문자, 숫자, _ 만 사용 가능</p>
                  )}
                </div>

                <div>
                  <label className="block text-[#647067] font-bold mb-1">
                    그룹명 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none font-semibold"
                    placeholder="예: 1공장, 설비관리섹션"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#647067] font-bold mb-1">상위 그룹</label>
                  <select
                    value={groupFormData.parentId}
                    onChange={(e) => setGroupFormData({ ...groupFormData, parentId: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500"
                  >
                    <option value="none">없음 (최상위 그룹)</option>
                    {parentGroupOptions.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#647067] font-bold mb-1">그룹 설명</label>
                  <textarea
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    rows={3}
                    className="w-full p-2.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none leading-relaxed"
                    placeholder="해당 그룹의 취지와 속성, 부석 대상 목적을 기록합니다."
                  />
                </div>
              </div>

              {/* Right Column: Code Binding Selector */}
              <div className="flex flex-col border border-zinc-150 rounded-xl bg-zinc-50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-700">부서코드 연계 바인딩</span>
                  <span className="text-[10px] bg-teal-100 text-[#008f83] px-1.5 py-0.5 rounded font-mono font-bold">
                    {groupFormData.deptCodes.length}개 선택됨
                  </span>
                </div>
                
                <p className="text-[10.5px] text-zinc-500 leading-normal">
                  그룹에 귀속시킬 부서를 검색하여 지정하세요. 화면에는 명칭이 검색되지만, 데이터베이스 상에는 <strong>부서코드 배열</strong>로만 고유 귀속 저장됩니다.
                </p>

                {/* Search In Selector */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={groupSearchCodeWord}
                    onChange={(e) => setGroupSearchCodeWord(e.target.value)}
                    className="w-full text-[11px] p-2 pl-8.5 border border-zinc-250 rounded-lg bg-white focus:outline-none"
                    placeholder="부서코드 번호 또는 부서명 검색..."
                  />
                </div>

                {/* Sub Department Picker list */}
                <div className="flex-1 overflow-y-auto max-h-52 border border-zinc-200 rounded-lg bg-white p-2 space-y-1">
                  {searchableDeptsInGroupModal.map(d => {
                    const isChecked = groupFormData.deptCodes.includes(d.code);
                    return (
                      <label 
                        key={d.code} 
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                          isChecked ? 'bg-teal-50/70 border-l-2 border-[#008f83]' : 'hover:bg-zinc-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDeptInGroup(d.code)}
                          className="w-3.5 h-3.5 accent-[#008f83] cursor-pointer"
                        />
                        <div className="flex justify-between items-center w-full select-none text-[11px]">
                          <span className="font-mono font-bold text-[#008f83]">{d.code}</span>
                          <span className="text-zinc-700 font-medium truncate max-w-[130px]">{d.name}</span>
                        </div>
                      </label>
                    );
                  })}

                  {searchableDeptsInGroupModal.length === 0 && (
                    <div className="text-center py-6 text-zinc-450 italic">해당하는 마스터 부서가 없습니다.</div>
                  )}
                </div>

                {/* Fill dynamic helpers inside modal */}
                {groupSearchCodeWord && searchableDeptsInGroupModal.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAddAllFilteredDeptCodes(searchableDeptsInGroupModal.map(d => d.code))}
                    className="w-full font-bold text-center py-1 bg-zinc-200 rounded text-zinc-650 hover:bg-zinc-350 transition-colors cursor-pointer text-[10px]"
                  >
                    검색 결과 {searchableDeptsInGroupModal.length}개 항목 일괄 체크 추가
                  </button>
                )}
              </div>

              {/* Bottom Actions for both columns */}
              <div className="col-span-1 md:col-span-2 flex justify-end gap-2 border-t border-[#eef2ec] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-[#f7f9f7] text-[#4e5968] font-semibold border border-[#dde5de] rounded-xl cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-[#008f83] text-white font-semibold rounded-xl hover:bg-[#007369] cursor-pointer"
                >
                  그룹 사양 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
