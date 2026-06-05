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
  Check,
  Zap,
  Lock,
  Eye,
  Settings
} from 'lucide-react';
import { DEPARTMENTS, getAllDepartments } from '../constants';
import { 
  getDeptGroups, 
  saveDeptGroups, 
  getDeptNameByCode, 
  DeptGroup 
} from '../lib/departmentGroups';

// Department Item interface (parentClass and groupIds are completely removed)
interface DepartmentItem {
  code: string;
  name: string;
  managerName: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Reusable inline dialogs for alert & confirm
interface ConfirmModalState {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  isAlert?: boolean;
  onConfirm: () => void;
}

export default function DepartmentManagement() {
  const [currentTab, setCurrentTab] = useState<'master' | 'groups'>('master');
  const [showAdvancedAdmin, setShowAdvancedAdmin] = useState(false);

  // 1. Department Master States
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Bulk action states for department master
  const [selectedDeptCodes, setSelectedDeptCodes] = useState<string[]>([]);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState('');

  // Form Data for Department Model (groupIds completely removed)
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    managerName: string;
    userId: string;
    password?: string;
    role: string;
    isActive: boolean;
  }>({
    code: '',
    name: '',
    managerName: '',
    userId: '',
    password: '',
    role: '부서담당자',
    isActive: true,
  });

  // 2. Department Group States
  const [groups, setGroups] = useState<DeptGroup[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupEditing, setIsGroupEditing] = useState(false);
  const [groupSearchCodeWord, setGroupSearchCodeWord] = useState('');
  const [deleteGroupState, setDeleteGroupState] = useState<{
    isOpen: boolean;
    groupId: string;
    groupName: string;
    hasChildren: boolean;
    deleteChildren: boolean;
  } | null>(null);

  const [groupFormData, setGroupFormData] = useState<{
    id: string;
    name: string;
    parentId: string; // 'none' or active group id
    description: string;
    deptCodes: string[];
    isActive: boolean;
  }>({
    id: '',
    name: '',
    parentId: 'none',
    description: '',
    deptCodes: [],
    isActive: true
  });

  // Clean Toast states
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reusable Alert/Confirm Dialogue State
  const [confirmState, setConfirmState] = useState<ConfirmModalState>({
    open: false,
    title: '',
    description: '',
    confirmText: '확인',
    isAlert: false,
    onConfirm: () => {},
  });

  // Initialize Data & Perform Migration
  useEffect(() => {
    // 1. Load Custom Departments
    const rawCustom = localStorage.getItem('cleanmetal_dept_master_custom');
    let loadedDepts: DepartmentItem[] = [];
    if (rawCustom) {
      try {
        const parsed = JSON.parse(rawCustom);
        loadedDepts = parsed.map((item: any) => migrateDepartmentItem(item));
        setDepts(loadedDepts);
        // Save cleaned item state
        localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(loadedDepts));
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

    // 2. Load custom groups
    setGroups(getDeptGroups());
  }, []);

  // Past Data Migration Utility
  const migrateDepartmentItem = (item: any): DepartmentItem => {
    // Fallbacks for renaming 'manager' -> 'managerName'
    const managerName = item.managerName || item.manager || '부서 실무장';
    const isActive = item.isActive !== false;

    return {
      code: item.code,
      name: item.name,
      managerName: managerName,
      role: item.role || '부서담당자',
      isActive: isActive,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  };

  const getDefaultDepts = (): DepartmentItem[] => {
    return DEPARTMENTS.map(d => {
      return {
        code: d.code,
        name: d.name,
        managerName: d.manager || '대표 서명수',
        role: d.role || '부서담당자',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };

  // Reusable modal prompt helpers
  const showConfirm = (title: string, description: string, onConfirm: () => void, confirmText = '확인') => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmText,
      isAlert: false,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, open: false }));
      }
    });
  };

  const showAlert = (title: string, description: string) => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmText: '확인',
      isAlert: true,
      onConfirm: () => {
        setConfirmState(prev => ({ ...prev, open: false }));
      }
    });
  };

  // ----------------------------------------------------
  // Tab 1: Department Master Handlers
  // ----------------------------------------------------
  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('error', '부서코드와 부서명을 입력해주세요.');
      return;
    }

    // Custom user accounts loading
    const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];

    // Duplicate IDs check
    if (!isEditing) {
      const duplicateCode = depts.some(d => d.code === formData.code);
      if (duplicateCode) {
        showToast('error', '이미 등록된 시스템 부서코드입니다.');
        return;
      }
      const duplicateUser = customUsers.some((u: any) => u.code === formData.userId);
      if (duplicateUser) {
        showToast('error', '이미 동일한 사용자 ID가 있습니다.');
        return;
      }
    }

    let newList = [...depts];
    const deptToSave: DepartmentItem = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      managerName: formData.managerName.trim() || '담당자',
      role: formData.role || '부서담당자',
      isActive: formData.isActive,
      createdAt: isEditing ? (depts.find(d => d.code === formData.code)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isEditing) {
      newList = newList.map(d => d.code === formData.code ? deptToSave : d);
      showToast('success', `부서 [${formData.code}] 마스터 정보가 수정되었습니다.`);
    } else {
      newList.push(deptToSave);
      showToast('success', `신규 [${formData.code}] 부서가 부서 마스터 목록에 추가되었습니다.`);
    }

    setDepts(newList);
    localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(newList));
    window.dispatchEvent(new Event('department-master-changed'));
    
    // Sync custom user Account
    let updatedUsers = [...customUsers];
    if (isEditing) {
      const idx = updatedUsers.findIndex((u: any) => u.departmentCode === formData.code);
      if (idx !== -1) {
        const oldUserId = updatedUsers[idx].code;
        const newUserId = formData.userId.trim() || formData.code.trim();
        updatedUsers[idx] = {
          ...updatedUsers[idx],
          code: newUserId,
          name: formData.managerName.trim(),
          department: formData.name.trim(),
          role: formData.role || '부서담당자',
          isActive: formData.isActive
        };
        if (formData.password) {
          updatedUsers[idx].password = formData.password.trim();
        }

        // If user ID changed, migrate settings
        if (oldUserId !== newUserId) {
          const settingsKey = 'cleanmetal_user_settings';
          const savedSettings = localStorage.getItem(settingsKey);
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings[oldUserId]) {
              settings[newUserId] = { ...settings[oldUserId], id: newUserId };
              delete settings[oldUserId];
              localStorage.setItem(settingsKey, JSON.stringify(settings));
            }
          }
        }
      } else {
        updatedUsers.push({
          code: formData.userId.trim() || formData.code.trim(),
          password: formData.password ? formData.password.trim() : `${formData.code}!`,
          name: formData.managerName.trim() || formData.name.trim(),
          departmentCode: formData.code.trim(),
          department: formData.name.trim(),
          role: formData.role || '부서담당자',
          isActive: formData.isActive,
          mustChangePassword: true,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      updatedUsers.push({
        code: formData.userId.trim() || formData.code.trim(),
        password: formData.password ? formData.password.trim() : `${formData.code}!`,
        name: formData.managerName.trim() || formData.name.trim(),
        departmentCode: formData.code.trim(),
        department: formData.name.trim(),
        role: formData.role || '부서담당자',
        isActive: formData.isActive,
        mustChangePassword: true,
        createdAt: new Date().toISOString()
      });
    }
    localStorage.setItem('cleanmetal_custom_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('custom-users-changed'));

    // Dynamic credentials settings injection for immediate login compatibility
    const settingsKey = 'cleanmetal_user_settings';
    const savedSettings = localStorage.getItem(settingsKey);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    const loginId = formData.userId.trim() || formData.code.trim();
    settings[loginId] = {
      ...(settings[loginId] || {}),
      id: loginId,
      password: formData.password ? formData.password.trim() : (settings[loginId]?.password || `${formData.code}!`),
      name: formData.managerName.trim() || formData.name.trim(),
      role: formData.role || '부서담당자',
      isActive: formData.isActive,
      mustChangePassword: true,
      viewableDepts: [formData.code.trim()]
    };
    
    // Clean up old code-based setting if different
    if (loginId !== formData.code.trim() && settings[formData.code.trim()]) {
      delete settings[formData.code.trim()];
    }

    localStorage.setItem(settingsKey, JSON.stringify(settings));

    setIsModalOpen(false);
  };

  const handleToggleDeptActive = (code: string, currentActive: boolean) => {
    if (code === '99999' || code === '32100') {
      showToast('error', '시스템 부서 관리자 및 기획재무그룹은 지정 변경이 불가능합니다.');
      return;
    }

    const actionText = currentActive ? '비활성화' : '복원';
    showConfirm(
      `부서 ${actionText}`,
      `부서 [${code}]를 정말 ${actionText}하시겠습니까?`,
      () => {
        const newList = depts.map(d =>
          d.code === code
            ? { ...d, isActive: !currentActive, updatedAt: new Date().toISOString() }
            : d
        );
        setDepts(newList);
        localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(newList));
        window.dispatchEvent(new Event('department-master-changed'));
        
        // Sync user Status
        const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
        if (savedCustomUsers) {
          const customUsers = JSON.parse(savedCustomUsers);
          const updatedUsers = customUsers.map((u: any) => 
            u.departmentCode === code ? { ...u, isActive: !currentActive } : u
          );
          localStorage.setItem('cleanmetal_custom_users', JSON.stringify(updatedUsers));
        }
        window.dispatchEvent(new Event('custom-users-changed'));

        const savedSettings = localStorage.getItem('cleanmetal_user_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
          const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];
          const associatedUser = customUsers.find((u: any) => u.departmentCode === code);
          const loginId = associatedUser ? associatedUser.code : code;

          if (settings[loginId]) {
            settings[loginId].isActive = !currentActive;
          }
          if (settings[code] && settings[code] !== settings[loginId]) {
            settings[code].isActive = !currentActive;
          }
          localStorage.setItem('cleanmetal_user_settings', JSON.stringify(settings));
        }

        showToast('success', `부서 [${code}]가 성공적으로 ${actionText} 되었습니다.`);
      },
      actionText
    );
  };

  // Admin Physical Delete
  const handlePhysicalDeleteDept = (code: string) => {
    if (code === '99999' || code === '32100') {
      showToast('error', '기본 관리부서는 물리 삭제할 수 없습니다.');
      return;
    }

    showConfirm(
      '부서 영구 제거',
      `부서코드 [${code}]를 정말 영구적으로 삭제하시겠습니까? 관련 데이터 열람이 제한되거나 예산 장애가 일어날 수 있습니다.`,
      () => {
        // Sync user Status
        const newList = depts.filter(d => d.code !== code);
        setDepts(newList);
        localStorage.setItem('cleanmetal_dept_master_custom', JSON.stringify(newList));
        window.dispatchEvent(new Event('department-master-changed'));
        
        // Remove associated user from custom users too
        const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
        if (savedCustomUsers) {
          const customUsers = JSON.parse(savedCustomUsers);
          const filteredUsers = customUsers.filter((u: any) => u.departmentCode !== code);
          localStorage.setItem('cleanmetal_custom_users', JSON.stringify(filteredUsers));
        }
        window.dispatchEvent(new Event('custom-users-changed'));

        showToast('success', '부서 원장이 삭제되었습니다.');
      },
      '영구 삭제'
    );
  };

  const handleOpenEdit = (item: DepartmentItem) => {
    // Lookup associated login ID/password from settings if exists
    const savedSettings = localStorage.getItem('cleanmetal_user_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    const savedCustomUsers = localStorage.getItem('cleanmetal_custom_users');
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];
    const associatedUser = customUsers.find((u: any) => u.departmentCode === item.code);
    const loginId = associatedUser ? associatedUser.code : item.code;

    const userSetting = settings[loginId] || settings[item.code] || {};

    setFormData({
      code: item.code,
      name: item.name,
      managerName: item.managerName,
      userId: userSetting.id || item.code,
      password: '', // Hidden or changeable
      role: item.role,
      isActive: item.isActive
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      managerName: '',
      userId: '',
      password: '',
      role: '부서담당자',
      isActive: true,
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  // Watch for Code modification to auto fill ID & password
  const handleCodeChange = (newCode: string) => {
    setFormData(prev => {
      const sanitized = newCode.replace(/[^0-9]/g, '');
      const defaultId = sanitized;
      const defaultPw = sanitized ? `${sanitized}!` : '';
      return {
        ...prev,
        code: sanitized,
        userId: prev.userId === prev.code || prev.userId === '' ? defaultId : prev.userId,
        password: prev.password === `${prev.code}!` || prev.password === '' ? defaultPw : prev.password
      };
    });
  };

  const filteredDepts = depts.filter(item => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      // Search by code, name, managerName, or contained group names (derived from groups list)
      const inGroups = groups
        .filter(g => g.deptCodes?.includes(item.code))
        .some(grp => grp.name.toLowerCase().includes(t));

      return (
        item.code.toLowerCase().includes(t) ||
        item.name.toLowerCase().includes(t) ||
        item.managerName.toLowerCase().includes(t) ||
        item.role.toLowerCase().includes(t) ||
        inGroups
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
      deptCodes: [],
      isActive: true
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
      deptCodes: [...(group.deptCodes || [])],
      isActive: group.isActive !== false
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
      isActive: groupFormData.isActive,
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

  const handleToggleGroupActive = (id: string, currentActive: boolean) => {
    showConfirm(
      `그룹 ${currentActive ? '비활성화' : '복원'}`,
      `그룹 [${id}]을(를) 정말 ${currentActive ? '비활성화' : '복원'} 처리 하시겠습니까?`,
      () => {
        const newList = groups.map(g => g.id === id ? { ...g, isActive: !currentActive, updatedAt: new Date().toISOString() } : g);
        setGroups(newList);
        saveDeptGroups(newList);
        showToast('success', `그룹 [${id}]이(가) ${currentActive ? '비활성화' : '복원'} 되었습니다.`);
      },
      currentActive ? '비활성화' : '복원'
    );
  };

  const handleOpenGroupDelete = (id: string, name: string) => {
    const hasChildren = groups.some(g => g.parentId === id);
    setDeleteGroupState({
      isOpen: true,
      groupId: id,
      groupName: name,
      hasChildren,
      deleteChildren: false
    });
  };

  const handleExecuteGroupDelete = () => {
    if (!deleteGroupState) return;
    const { groupId, groupName, hasChildren, deleteChildren } = deleteGroupState;

    let nextGroups = [...groups];
    if (hasChildren && deleteChildren) {
      // Recursive delete: find all child groups and delete them
      const idsToDelete = new Set<string>();
      const collect = (id: string) => {
        idsToDelete.add(id);
        groups
          .filter(g => g.parentId === id)
          .forEach(child => collect(child.id));
      };
      collect(groupId);
      nextGroups = groups.filter(g => !idsToDelete.has(g.id));
    } else {
      // Only delete this group, set parentId of direct child groups to null
      nextGroups = groups
        .filter(g => g.id !== groupId)
        .map(g => g.parentId === groupId ? { ...g, parentId: null, updatedAt: new Date().toISOString() } : g);
    }

    setGroups(nextGroups);
    saveDeptGroups(nextGroups);

    // Clean up cached selections if pointing to the deleted group
    localStorage.removeItem("hycm_dashboard_selected_group");
    localStorage.removeItem("variance_selected_group");
    localStorage.removeItem("budget_status_selected_group");

    const savedVarianceDept = localStorage.getItem('variance_dept');
    if (savedVarianceDept === groupId) {
      localStorage.setItem('variance_dept', 'all');
    }

    setDeleteGroupState(null);
    showToast('success', `부서 그룹 [${groupName}]이(가) 삭제 완료되었습니다.`);
  };

  const handlePhysicalDeleteGroup = (id: string, name: string) => {
    handleOpenGroupDelete(id, name);
  };

  const handleBulkAssignDepts = () => {
    if (!bulkTargetGroupId || selectedDeptCodes.length === 0) return;
    
    const targetGroup = groups.find(g => g.id === bulkTargetGroupId);
    if (!targetGroup) return;

    if (targetGroup.isActive === false) {
      showToast('error', '비활성화된 부서 그룹에는 일괄 할당할 수 없습니다.');
      return;
    }

    const updatedGroups = groups.map(g => {
      if (g.id === bulkTargetGroupId) {
        const combined = Array.from(new Set([...(g.deptCodes || []), ...selectedDeptCodes]));
        return {
          ...g,
          deptCodes: combined,
          updatedAt: new Date().toISOString()
        };
      }
      return g;
    });

    setGroups(updatedGroups);
    saveDeptGroups(updatedGroups);
    
    setSelectedDeptCodes([]);
    setBulkTargetGroupId('');
    
    showToast('success', `${selectedDeptCodes.length}개 부서가 [${targetGroup.name}] 그룹에 일괄 지정되었습니다.`);
  };

  const handleToggleDeptInGroup = (code: string) => {
    setGroupFormData(prev => {
      const isExist = prev.deptCodes.includes(code);
      const newCodes = isExist 
        ? prev.deptCodes.filter(c => c !== code) 
        : [...prev.deptCodes, code];
      return { ...prev, deptCodes: newCodes };
    });
  };

  const handleAddAllFilteredDeptCodes = (filteredCodes: string[]) => {
    setGroupFormData(prev => {
      const union = new Set([...prev.deptCodes, ...filteredCodes]);
      return { ...prev, deptCodes: Array.from(union) };
    });
  };

  const filteredGroups = groups.filter(g => {
    if (groupSearchTerm) {
      const t = groupSearchTerm.toLowerCase();
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

  const parentGroupOptions = useMemo(() => {
    return groups.filter(g => !isGroupEditing || g.id !== groupFormData.id);
  }, [groups, isGroupEditing, groupFormData.id]);

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
      {/* Dynamic inline Toast alerts */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-bounce ${
          notification.type === 'success' ? 'bg-[#f0f9f8] text-[#008f83] border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> : <AlertCircle className="w-4.5 h-4.5" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-[#008f83] border border-teal-150 px-2.5 py-0.5 rounded font-bold font-mono">Organization Registry</span>
            <button 
              onClick={() => setShowAdvancedAdmin(!showAdvancedAdmin)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                showAdvancedAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200'
              }`}
            >
              <Settings className="w-3 h-3" />
              <span>{showAdvancedAdmin ? '고급 관리 모드 On' : '고급 관리 모드 Off'}</span>
            </button>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5">
            부서 코드 및 그룹 관리
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            부서 코드, 부서명, 담당자 계정과 부서 그룹을 관리합니다. 부서 그룹은 예산현황·비교분석·실적 귀속부서 관리에서 여러 부서를 함께 조회하기 위한 코드 기준 묶음입니다.
          </p>
        </div>

        <div className="flex gap-2">
          {currentTab === 'master' ? (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#008f83] hover:bg-[#007369] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              신규 부서 등록
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
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-[#008f83] rounded-2xl"><Users className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">전체 부서 수</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">
                  {depts.filter(d => d.isActive).length}개 활성 / 전체 {depts.length}개
                </span>
              </div>
            </div>
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-zinc-50 text-zinc-500 rounded-2xl"><Database className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">생산 부서</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">
                  {depts.filter(d => d.code.startsWith('50') && d.isActive).length}개 활성 조직
                </span>
              </div>
            </div>
            <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-100 text-[#008f83] rounded-2xl"><Shield className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-[#008f83] block pb-1">계정 연동 상태</span>
                <span className="text-xl font-bold text-[#008f83] font-mono block">정상</span>
              </div>
            </div>
          </div>

          {/* Quick Find Toolbar / Bulk Operation section */}
          <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs space-y-3">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400"
                placeholder="관련 부서코드 번호, 부서 단위명, 담당자명 또는 소속 그룹명으로 즉시 검색합니다..."
              />
            </div>

            {selectedDeptCodes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[#f0f9f8] rounded-xl border border-teal-150 animate-fadeIn">
                <div className="flex items-center gap-1.5 matches-checkbox">
                  <Check className="w-4 h-4 text-[#008f83]" />
                  <span className="text-xs font-bold text-zinc-700">
                    선택된 부서: <strong className="text-[#008f83]">{selectedDeptCodes.length}개</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={bulkTargetGroupId}
                    onChange={(e) => setBulkTargetGroupId(e.target.value)}
                    className="bg-white border border-[#dde5de] text-zinc-700 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-teal-500 outline-none flex-1 sm:flex-initial"
                  >
                    <option value="">지정할 부서 그룹 선택...</option>
                    {groups.filter(g => g.isActive !== false).map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssignDepts}
                    disabled={!bulkTargetGroupId}
                    className="px-3.5 py-1.5 bg-[#008f83] hover:bg-[#007369] disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    일괄 지정 적용
                  </button>
                  <button
                    onClick={() => setSelectedDeptCodes([])}
                    className="px-2.5 py-1.5 hover:bg-zinc-100 text-zinc-500 rounded-lg text-xs font-bold cursor-pointer border border-zinc-200 bg-white"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Grid Table */}
          <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
            <table className="min-w-full divide-y divide-[#eef2ec] text-left">
              <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider select-none">
                <tr>
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredDepts.length > 0 && selectedDeptCodes.length === filteredDepts.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeptCodes(filteredDepts.map(d => d.code));
                        } else {
                          setSelectedDeptCodes([]);
                        }
                      }}
                      className="rounded border-zinc-300 text-[#008f83] focus:ring-teal-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3">부서 코드</th>
                  <th className="px-5 py-3">부서명</th>
                  <th className="px-5 py-3">부서 그룹</th>
                  <th className="px-5 py-3 font-medium">담당자명</th>
                  <th className="px-5 py-3">권한 역할</th>
                  <th className="px-5 py-3 text-center">상태</th>
                  <th className="px-5 py-3 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
                {filteredDepts.map(item => {
                  const associatedGroups = groups.filter(g => g.deptCodes?.includes(item.code) && g.isActive !== false);

                  return (
                    <tr key={item.code} className={`hover:bg-[#f7f9f7]/55 transition ${!item.isActive ? 'opacity-55 bg-zinc-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedDeptCodes.includes(item.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeptCodes(prev => [...prev, item.code]);
                            } else {
                              setSelectedDeptCodes(prev => prev.filter(c => c !== item.code));
                            }
                          }}
                          className="rounded border-zinc-300 text-[#008f83] focus:ring-teal-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#008f83]">{item.code}</td>
                      <td className="px-5 py-3.5 font-semibold text-[#111111]">
                        {item.name}
                        {!item.isActive && (
                          <span className="ml-1.5 inline-block px-1 bg-red-100 text-red-800 text-[9px] font-bold rounded">비활성</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {associatedGroups.length > 0 ? (
                            associatedGroups.map(grp => (
                              <span 
                                key={grp.id} 
                                className="inline-flex items-center text-[10px] font-bold bg-teal-50 text-[#008f83] px-1.5 py-0.5 rounded border border-teal-100"
                                title={showAdvancedAdmin ? grp.id : undefined}
                              >
                                {grp.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-350 italic text-[11px]">- (그룹 없음)</span>
                          )}
                          <button
                            onClick={() => setCurrentTab('groups')}
                            className="text-[10.5px] text-[#008f83] hover:text-[#007369] ml-1 select-none font-bold cursor-pointer transition-colors"
                          >
                            [변경/관리]
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-800 font-medium">{item.managerName}</td>
                      <td className="px-5 py-3.5">
                        <span className="bg-zinc-100 text-zinc-650 px-2 py-0.5 rounded font-bold text-[10px]">{item.role}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-1.5 py-0.5 text-[9.5px] font-bold rounded-sm ${
                          item.isActive ? 'bg-emerald-50 text-[#008f83] border border-teal-150' : 'bg-zinc-100 text-zinc-400'
                        }`}>
                          {item.isActive ? '정상' : '비활성'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 px-1.5 bg-white text-zinc-500 hover:text-teal-600 border border-[#dde5de] rounded hover:border-teal-500 cursor-pointer"
                            title="수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleToggleDeptActive(item.code, item.isActive)}
                            className={`p-1 px-2.5 border rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                              item.isActive 
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                                : 'bg-[#f0f9f8] border-teal-200 text-[#008f83] hover:bg-teal-50'
                            }`}
                          >
                            {item.isActive ? '비활성화' : '복원'}
                          </button>

                          {showAdvancedAdmin && (
                            <button
                              onClick={() => handlePhysicalDeleteDept(item.code)}
                              className="p-1 text-rose-500 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 rounded cursor-pointer"
                              title="영구 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDepts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-400 bg-zinc-50/50">
                      <AlertCircle className="w-7 h-7 mx-auto text-zinc-300 mb-1" />
                      검색 조건과 부합하는 활성 부서 마스터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Group Tab Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-[#008f83] rounded-2xl"><FolderTree className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">전체 그룹 수</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">
                  {groups.filter(g => g.isActive !== false).length}개 활성 / {groups.length}개
                </span>
              </div>
            </div>
            <div className="bg-white border border-[#dde5de] p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-zinc-50 text-zinc-500 rounded-2xl"><Users className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-zinc-400 block pb-1">포함 부서 수</span>
                <span className="text-xl font-bold text-zinc-900 font-mono block">
                  {groups.reduce((acc, curr) => acc + (curr.deptCodes?.length || 0), 0)}개 부서 연동
                </span>
              </div>
            </div>
            <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-teal-100 text-[#008f83] rounded-2xl"><Shield className="w-6 h-6" /></div>
              <div>
                <span className="text-xs text-[#008f83] block pb-1">코드 기준 그룹</span>
                <span className="text-xl font-bold text-[#008f83] font-mono block">코드 기준</span>
              </div>
            </div>
          </div>

          {/* Group Search Search */}
          <div className="bg-white p-4.5 rounded-2xl border border-[#dde5de] shadow-xs flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="w-full text-xs p-2.5 pl-10 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none placeholder-zinc-400"
                placeholder="부서 그룹 고유 ID, 그룹 명칭, 연계된 개별 부서코드번호 또는 원 장명으로 검색..."
              />
            </div>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGroups.map(grp => {
              const parent = groups.find(g => g.id === grp.parentId);
              const isActive = grp.isActive !== false;
              const subGroupsList = groups.filter(g => g.parentId === grp.id);

              return (
                <div key={grp.id} className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden flex flex-col hover:border-[#008f83]/50 hover:shadow-sm transition-all">
                  <div className="p-5 flex-1 space-y-3.5 bg-white">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        {showAdvancedAdmin && (
                          <span className="text-[10px] font-mono font-bold bg-[#f0f9f8] text-[#008f83] px-2 py-0.5 rounded border border-teal-100 uppercase block mb-1">
                            ID: {grp.id}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-zinc-900 mt-1">
                          {grp.name}
                          {!isActive && showAdvancedAdmin && (
                            <span className="ml-1.5 inline-block px-1 bg-red-100 text-red-800 text-[9px] font-bold rounded">비활성</span>
                          )}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenGroupEdit(grp)}
                          className="px-2.5 py-1.5 text-xs text-zinc-700 hover:text-teal-600 border border-zinc-200 hover:border-teal-400 bg-white hover:bg-[#f7f9f7] rounded-lg cursor-pointer flex items-center gap-1 font-semibold transition-all"
                          title="수정"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
                          수정
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenGroupDelete(grp.id, grp.name)}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 bg-white hover:bg-rose-650 rounded-lg cursor-pointer flex items-center gap-1 font-semibold transition-all shadow-3xs"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>

                        {showAdvancedAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleGroupActive(grp.id, isActive)}
                            className={`px-2 py-1.5 border text-[10px] font-bold rounded-md cursor-pointer ${
                              isActive 
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                : 'bg-teal-50 border-teal-200 text-[#008f83] hover:bg-teal-100'
                            }`}
                          >
                            {isActive ? '비활성' : '복원'}
                          </button>
                        )}
                      </div>
                    </div>

                    {grp.description && (
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                        {grp.description}
                      </p>
                    )}

                    {parent && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-650 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                        <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[11px] font-semibold text-zinc-550">상위 그룹:</span>
                        <span className="text-[11px] font-bold text-zinc-800">{parent.name}</span>
                        {showAdvancedAdmin && <span className="text-[10px] font-mono text-zinc-400">({parent.id})</span>}
                      </div>
                    )}

                    {subGroupsList.length > 0 && (
                      <div className="flex flex-col gap-1 text-xs text-zinc-650 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60 mt-2">
                        <div className="flex items-center gap-1 text-emerald-800 font-semibold text-[11px]">
                          <FolderTree className="w-3.5 h-3.5 text-emerald-500" />
                          <span>하위 그룹 ({subGroupsList.length}):</span>
                        </div>
                        <span className="text-[11px] font-medium text-zinc-700">
                          {subGroupsList.map(g => g.name).join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        <span>포함 부서 ({grp.deptCodes?.length || 0})</span>
                        <span className="font-mono">코드 기준</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-zinc-50/75 rounded-xl border border-zinc-100">
                        {grp.deptCodes && grp.deptCodes.length > 0 ? (
                          grp.deptCodes.map(code => {
                            const dName = getDeptNameByCode(code);
                            return (
                              <div 
                                key={code} 
                                className="flex items-center gap-1 bg-white border border-zinc-200 text-[11.5px] px-1.5 py-0.5 rounded shadow-3xs"
                              >
                                <span className="font-mono font-bold text-[#008f83] text-[10.5px]">{code}</span>
                                <span className="text-zinc-350">|</span>
                                <span className="text-zinc-700 font-medium">{dName}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-[10.5px] text-zinc-400 font-medium italic p-1">그룹에 연계된 지엽 부서코드가 존재하지 않습니다.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 text-[10.5px] text-zinc-400 flex justify-between items-center font-mono select-none">
                    <span>최종 업데이트</span>
                    <span>{new Date(grp.updatedAt || new Date()).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="col-span-full py-16 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-semibold">검색 필터에 부합하는 활성 부서 그룹을 발견하지 못했습니다.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dept Code Create/Edit Modal (Tab 1) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-zinc-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-150 pb-3 mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#008f83]" />
              {isEditing ? '부서 정보 수정 및 변경' : '신규 부서 등록'}
            </h3>

            <form onSubmit={handleSaveDept} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">부서코드 <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled={isEditing}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-full p-2.5 border border-zinc-250 rounded-lg focus:border-teal-500 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400 font-mono font-bold"
                    placeholder="예: 50260 (숫자만)"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 font-bold mb-1">부서명 <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 border border-zinc-250 font-bold text-zinc-900 rounded-lg focus:border-[#008f83] focus:outline-none focus:ring-1 focus:ring-[#008f83]"
                    placeholder="예: 환경안전팀"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">담당자명 <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full p-2.5 border border-zinc-250 rounded-lg focus:border-[#008f83] focus:outline-none"
                    placeholder="담당자 이름 입력"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 font-bold mb-1">권한 역할 <span className="text-rose-600 font-bold">*</span></label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2.5 border border-zinc-250 rounded-lg focus:border-[#008f83] focus:outline-none"
                    placeholder="예: 부서담당자, 부서장"
                    required
                  />
                </div>
              </div>

              {/* Security & Access Credentials section */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-3">
                <span className="text-[10px] bg-[#008f83]/10 text-[#008f83] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                  <Lock className="w-3 h-3" />
                  로그인 인증용 사용자 ID 정보 연동 설정
                </span>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-zinc-500 font-bold mb-1 text-[10px]">로그인용 사용자 ID</label>
                    <input
                      type="text"
                      value={formData.userId}
                      disabled={isEditing}
                      onChange={(e) => setFormData({ ...formData, userId: e.target.value.trim() })}
                      className="w-full p-2 bg-white border border-zinc-200 rounded text-[11px] focus:border-[#008f83] disabled:text-zinc-400 font-mono"
                      placeholder="기본값: 부서코드 자동 연동"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-500 font-bold mb-1 text-[10px]">
                      {isEditing ? '초기 비밀번호 재설정 (입력 시 변경)' : '초기 비밀번호 설정 *'}
                    </label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2 bg-white border border-zinc-200 rounded text-[11px] focus:border-[#008f83] font-mono"
                      placeholder={isEditing ? '미변경시 공란 유지' : '기본값: 부서코드!'}
                      required={!isEditing}
                    />
                  </div>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-normal">
                  ※ 신규 부서 등록 후 완료 시 관련 사용자를 로그인 전용 정보 장치에 즉시 자동 매핑하여 부서별 전용 권한과 보안 등급을 자동 부여합니다.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-150 pt-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#008f83] text-white font-semibold rounded-lg hover:bg-[#007369] cursor-pointer transition-colors"
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
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6 border border-zinc-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-150 pb-3 mb-4 flex items-center gap-1.5">
              <FolderTree className="w-4.5 h-4.5 text-[#008f83]" />
              {isGroupEditing ? '부서 그룹 수동 세부 사양 수정' : '신규 부서 그룹 정의'}
            </h3>

            <form onSubmit={handleSaveGroup} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
              
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-600 font-bold mb-1">
                    그룹 고유 ID <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupFormData.id}
                    disabled={isGroupEditing}
                    onChange={(e) => setGroupFormData({ ...groupFormData, id: e.target.value })}
                    className="w-full p-2.5 border border-zinc-250 rounded-lg focus:border-teal-500 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400 font-mono font-bold uppercase"
                    placeholder="예: PLANT_1 또는 QC_SECTION"
                    required
                  />
                  {!isGroupEditing && (
                    <p className="text-[10px] text-zinc-400 mt-1">※ 영어 대문자, 숫자, 언더바(_), 하이픈(-)만 허용</p>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-600 font-bold mb-1">
                    그룹명 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    className="w-full p-2.5 border border-zinc-250 font-bold rounded-lg focus:outline-none focus:border-[#008f83]"
                    placeholder="예: 기계파트, 공장운영그룹"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 font-bold mb-1">상위 소속 그룹</label>
                  <select
                    value={groupFormData.parentId}
                    onChange={(e) => setGroupFormData({ ...groupFormData, parentId: e.target.value })}
                    className="w-full p-2.5 bg-white border border-zinc-250 rounded-lg focus:outline-none focus:border-[#008f83]"
                  >
                    <option value="none">없음 (최상위 분류 그룹)</option>
                    {parentGroupOptions.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-600 font-bold mb-1">그룹 용도 요약 설명</label>
                  <textarea
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    rows={3}
                    className="w-full p-2.5 border border-zinc-250 rounded-lg focus:outline-none focus:border-[#008f83]"
                    placeholder="부서 그룹 분석 목적 혹은 소속 정의 요약 정보 기록..."
                  />
                </div>
              </div>

              {/* Right Column: Interactive selector */}
              <div className="flex flex-col border border-zinc-200 rounded-xl bg-zinc-50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-700 text-xs">포함 부서 선택</span>
                  <span className="text-[10px] bg-teal-100 text-[#008f83] px-2 py-0.5 rounded font-mono font-bold">
                    {groupFormData.deptCodes.length}개 부서 등록됨
                  </span>
                </div>

                <p className="text-[10.5px] text-zinc-500 leading-normal">
                  그룹에 속하게 할 부서 코드를 체크하여 바인딩하세요. 데이터베이스에는 명칭이 아닌 <strong>코드 기준</strong>으로 견고히 귀속됩니다.
                </p>

                {/* Local search list */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={groupSearchCodeWord}
                    onChange={(e) => setGroupSearchCodeWord(e.target.value)}
                    className="w-full text-[11px] p-1.5 pl-8.5 border border-zinc-250 rounded-lg bg-white focus:outline-none"
                    placeholder="부서코드 번호 혹은 이름 검색..."
                  />
                </div>

                {/* Sub scrolling list */}
                <div className="flex-1 overflow-y-auto max-h-48 border border-zinc-200 rounded-lg bg-white p-2 space-y-1">
                  {searchableDeptsInGroupModal.map(d => {
                    const isChecked = groupFormData.deptCodes.includes(d.code);
                    return (
                      <label 
                        key={d.code} 
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                          isChecked ? 'bg-teal-50 border-l-2 border-[#008f83]' : 'hover:bg-zinc-50'
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
                          <span className="text-zinc-650 font-medium truncate max-w-[150px]">{d.name}</span>
                        </div>
                      </label>
                    );
                  })}

                  {searchableDeptsInGroupModal.length === 0 && (
                    <div className="text-center py-6 text-zinc-400 italic">검색어와 부합하는 부서 마스터가 없습니다.</div>
                  )}
                </div>

                {groupSearchCodeWord && searchableDeptsInGroupModal.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAddAllFilteredDeptCodes(searchableDeptsInGroupModal.map(d => d.code))}
                    className="w-full text-[10px] font-bold text-center py-1 bg-zinc-200 rounded text-zinc-700 hover:bg-zinc-350 cursor-pointer"
                  >
                    검색된 {searchableDeptsInGroupModal.length}개 부서 일괄 포함 지정
                  </button>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="col-span-1 md:col-span-2 flex justify-end gap-2 border-t border-zinc-150 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-lg cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#008f83] text-white font-semibold rounded-lg hover:bg-[#007369] cursor-pointer"
                >
                  그룹 사양 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Confirm/Alert Modal Dialogue */}
      {confirmState.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setConfirmState(prev => ({ ...prev, open: false }))} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 border border-zinc-200 animate-in zoom-in-95 duration-100 font-sans">
            <h3 className="text-sm font-bold text-zinc-900 mb-2">{confirmState.title}</h3>
            <p className="text-xs text-zinc-650 leading-relaxed mb-4 whitespace-pre-wrap">{confirmState.description}</p>
            <div className="flex justify-end gap-1.5 pt-3 border-t border-zinc-150">
              {!confirmState.isAlert && (
                <button
                  type="button"
                  onClick={() => setConfirmState(prev => ({ ...prev, open: false }))}
                  className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  취소
                </button>
              )}
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className="px-4 py-1.5 bg-[#008f83] text-white text-xs font-bold rounded-lg hover:bg-[#007369] cursor-pointer transition-colors"
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Group Deletion Dialog with Sub-level handling option */}
      {deleteGroupState?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setDeleteGroupState(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-zinc-200 animate-in zoom-in-95 duration-100 font-sans flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">부서 그룹 삭제</h3>
              <p className="mt-1.5 text-xs text-zinc-500 leading-normal">
                선택하신 부서 그룹 <strong>[{deleteGroupState.groupName}]</strong>을(를) 영구히 삭제하시겠습니까?
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed font-semibold">
              ⓘ 부서 그룹은 조회 조인용 묶음 데이터입니다. 그룹이 삭제되더라도 개별 부서 마스터 정보와 기존 편성 예산 및 실제 집행 실적 데이터는 <strong>절대 삭제되지 않고 안전하게 보존</strong>됩니다.
            </div>

            {deleteGroupState.hasChildren && (
              <div className="border border-zinc-200 bg-zinc-50 rounded-xl p-4.5 space-y-3.5">
                <span className="text-[11px] font-bold text-zinc-700 block">
                  ⚠️ 이 그룹은 현재 하위 그룹을 하위에 가지고 있습니다. 처리 방안을 선택하세요:
                </span>
                
                <div className="space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                    <input
                      type="radio"
                      name="child_handling"
                      checked={!deleteGroupState.deleteChildren}
                      onChange={() => setDeleteGroupState(prev => prev ? { ...prev, deleteChildren: false } : null)}
                      className="mt-0.5 accent-[#008f83]"
                    />
                    <div>
                      <span className="font-bold text-zinc-800 block">이 그룹만 삭제 (권장 / 안전)</span>
                      <span className="text-[10.5px] text-zinc-500 block">하위 그룹들은 삭제하지 않고 상위 그룹 지정을 없음으로 변경하여 독립시킵니다.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                    <input
                      type="radio"
                      name="child_handling"
                      checked={deleteGroupState.deleteChildren}
                      onChange={() => setDeleteGroupState(prev => prev ? { ...prev, deleteChildren: true } : null)}
                      className="mt-0.5 accent-[#008f83]"
                    />
                    <div>
                      <span className="font-bold text-rose-700 block">하위 그룹을 포함하여 일괄 일체 삭제</span>
                      <span className="text-[10.5px] text-rose-500/85 block">이 그룹에 귀속된 하위 그룹 및 하위 계층들 전체를 연동하여 한꺼번에 일괄 영구 삭제합니다.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-1.5 pt-3 border-t border-zinc-150">
              <button
                type="button"
                onClick={() => setDeleteGroupState(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExecuteGroupDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                삭제 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
