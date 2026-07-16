import { useState, useEffect, useRef } from 'react';
import { Users, Upload, FileUp, Plus, MoreVertical, X, Calendar, FileText, CheckCircle2, Clock, ArrowUp, ArrowDown, Bell, Trash2 } from 'lucide-react';
import { DEPARTMENTS, STORAGE_KEYS, getAllDepartments, getViewableDepts } from '../constants';
import { getSubmissionStatusMapKey, getBudgetDataKey, getActualDataKey } from '../lib/storageKeys';
import { normalizeBudgetRows, normalizeActualRows } from '../repositories/BudgetRepository';
import { getActualSourceIdentity } from '../lib/actualIdentity';
import { clearDataLoaderCache } from '../lib/varianceDataLoader';
import { hashPassword } from '../lib/auth';
import { motion, AnimatePresence } from 'motion/react';

// Components
import { PageHeader } from '../components/ui/PageHeader';
import { MetricCard } from '../components/budget/MetricCard';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { AppBadge } from '../components/ui/AppBadge';
import { BudgetStatusBadge } from '../components/budget/BudgetStatusBadge';
import { AppSelect } from '../components/ui/AppSelect';

export default function UserManagement() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [submissionYear, setSubmissionYear] = useState('2026');
  const [submissionPlanType, setSubmissionPlanType] = useState('경영계획');
  const [submissionStatuses, setSubmissionStatuses] = useState<any>({});
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [isUserListExpanded, setIsUserListExpanded] = useState(true);
  
  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    const allDepts = getAllDepartments();
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};

    const baseUsers = allDepts.map((dept, index) => {
      const userSetting = settings[dept.code] || {};
      return {
        id: index + 1,
        name: userSetting.name || dept.manager,
        department: dept.name,
        code: dept.code,
        role: dept.role,
        status: userSetting.status || '활성',
        deactivatedYear: userSetting.deactivatedYear || null
      };
    });

    setUsers(baseUsers);

    const savedStatuses = localStorage.getItem(STORAGE_KEYS.SUBMISSION_STATUS);
    if (savedStatuses) {
      setSubmissionStatuses(JSON.parse(savedStatuses));
    }

    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }

    // Click outside listener for notifications
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = currentUser?.code === '99999';
  const allDepts = getAllDepartments();
  const currentUserViewableDepts = currentUser ? getViewableDepts(currentUser.code) : [];
  
  const targetDepts = (isAdmin ? allDepts : currentUserViewableDepts).filter(d => d.code !== '99999').filter(dept => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const userSetting = settings[dept.code] || {};
    
    // 만약 상태가 비활성이고, 현재 조회 연도가 비활성화 시작 연도보다 크거나 같으면 제외
    if (userSetting.status === '비활성' && userSetting.deactivatedYear) {
      return parseInt(submissionYear) < parseInt(userSetting.deactivatedYear);
    }
    return true;
  });

  const submittedDepts = targetDepts.filter(dept => {
    try {
      const key = getSubmissionStatusMapKey(dept.code, submissionYear, submissionPlanType);
      const status = submissionStatuses[key];
      return status && (status.submitted === true || status.status === 'SUBMITTED' || status.status === 'APPROVED');
    } catch (e) {
      return false;
    }
  });

  const submissionCount = submittedDepts.length;
  const totalDepts = targetDepts.length;
  const submissionRate = totalDepts > 0 ? (submissionCount / totalDepts) * 100 : 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [duplicateActualModal, setDuplicateActualModal] = useState<{
    isOpen: boolean;
    yearsData: {
      year: string;
      beforeCount: number;
      afterCount: number;
      beforeSum: number;
      afterSum: number;
      rowsScheduledForDeletion: { identity: string; usageCode: string; accountCode: string; period: string; amount: number; completed: number }[];
    }[];
    totalBeforeCount: number;
    totalAfterCount: number;
    totalBeforeSum: number;
    totalAfterSum: number;
    canApply: boolean;
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userId, setUserId] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [viewableDepts, setViewableDepts] = useState<string[]>([]);
  const [hasSalaryAccess, setHasSalaryAccess] = useState(false);
  const [isProtected, setIsProtected] = useState(false);

  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDeptCode, setNewUserDeptCode] = useState('');
  const [newUserDeptName, setNewUserDeptName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newHasSalaryAccess, setNewHasSalaryAccess] = useState(false);
  const [newIsProtected, setNewIsProtected] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  const [isManageStatusModalOpen, setIsManageStatusModalOpen] = useState(false);
  const [manageUsers, setManageUsers] = useState<any[]>([]);

  const addNotification = (deptName: string, action: '제출' | '취소' | '해제', time: string) => {
    const newNotif = {
      id: Date.now(),
      deptName,
      action,
      time,
      isRead: false
    };
    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    localStorage.setItem('notifications', JSON.stringify(updatedNotifs));
  };

  const handleMigrateDuplicates = () => {
    try {
      const depts = getAllDepartments().map(d => d.code);
      const planTypes = ['경영계획', '수정경영계획', '1차RP', '2차RP', '추정실적'];
      const years = ['2024', '2025', '2026', '2027', '2028'];

      let beforeRowsTotal = 0;
      let afterRowsTotal = 0;
      let migrationExecutedCount = 0;

      depts.forEach(deptCode => {
        years.forEach(yr => {
          planTypes.forEach(pType => {
            try {
              const key = getBudgetDataKey(deptCode, yr, pType);
              const raw = localStorage.getItem(key);
              if (!raw) return;

              const rows = JSON.parse(raw);
              if (!Array.isArray(rows)) return;

              beforeRowsTotal += rows.length;

              const normalizedRows = normalizeBudgetRows(rows, deptCode);
              afterRowsTotal += normalizedRows.length;

              if (normalizedRows.length !== rows.length) {
                localStorage.setItem(key, JSON.stringify(normalizedRows));
                migrationExecutedCount++;
              }
            } catch (err) {
              console.warn(`Failed to migrate key for planType ${pType}:`, err);
            }
          });
        });
      });

      clearDataLoaderCache();

      const diff = beforeRowsTotal - afterRowsTotal;
      alert(`[정리 결과]\n정리 전: ${beforeRowsTotal}행\n정리 후: ${afterRowsTotal}행\n중복 제거: ${diff}행\n실행 적용된 세트수: ${migrationExecutedCount}개`);
    } catch (e) {
      console.error(e);
      alert('중복 정리 중 오류가 발생했습니다.');
    }
  };

  const handleMigrateActualDuplicates = () => {
    try {
      const years = ['2024', '2025', '2026', '2027', '2028'];
      const yearsData: any[] = [];

      let totalBeforeCount = 0;
      let totalAfterCount = 0;
      let totalBeforeSum = 0;
      let totalAfterSum = 0;

      years.forEach(yr => {
        const key = getActualDataKey(yr);
        const raw = localStorage.getItem(key);
        if (!raw) return;

        try {
          const rows = JSON.parse(raw);
          if (!Array.isArray(rows)) return;

          const beforeCount = rows.length;
          const beforeSum = rows.reduce((sum, r) => sum + (Number(r.amount) || 0) + (Number(r.completed) || 0), 0);

          const normalizedRows = normalizeActualRows(rows);
          const afterCount = normalizedRows.length;
          const afterSum = normalizedRows.reduce((sum, r) => sum + (Number(r.amount) || 0) + (Number(r.completed) || 0), 0);

          // Discarded are rows that have a valid identity but are NOT the exact object kept in normalizedRows.
          // For each identity, we kept only the last row. Any other row with that identity is discarded.
          const identityLastIndex = new Map<string, number>();
          rows.forEach((r, idx) => {
            const identity = getActualSourceIdentity(r);
            if (identity) {
              identityLastIndex.set(identity, idx);
            }
          });

          const rowsScheduledForDeletion: any[] = [];
          rows.forEach((r, idx) => {
            const identity = getActualSourceIdentity(r);
            if (identity) {
              const lastIdx = identityLastIndex.get(identity);
              if (lastIdx !== undefined && lastIdx !== idx) {
                rowsScheduledForDeletion.push({
                  identity,
                  usageCode: r.usageCode || r.attributedDeptCode || '',
                  accountCode: r.accountCode || '',
                  period: r.period || '',
                  amount: Number(r.amount) || 0,
                  completed: Number(r.completed) || 0,
                });
              }
            }
          });

          yearsData.push({
            year: yr,
            beforeCount,
            afterCount,
            beforeSum,
            afterSum,
            rowsScheduledForDeletion,
          });

          totalBeforeCount += beforeCount;
          totalAfterCount += afterCount;
          totalBeforeSum += beforeSum;
          totalAfterSum += afterSum;
        } catch (err) {
          console.error(`Failed to generate duplicate preview for key: ${key}`, err);
        }
      });

      const diffSum = Math.abs(totalBeforeSum - totalAfterSum);
      // Allow apply if we actually find duplicates and sum matches exactly
      const canApply = diffSum < 0.01 && (totalBeforeCount > totalAfterCount);

      setDuplicateActualModal({
        isOpen: true,
        yearsData,
        totalBeforeCount,
        totalAfterCount,
        totalBeforeSum,
        totalAfterSum,
        canApply,
      });

    } catch (e) {
      console.error(e);
      alert('실적 중복 데이터 분석 중 오류가 발생했습니다.');
    }
  };

  const applyActualDuplicatesCleanup = () => {
    if (!duplicateActualModal || !duplicateActualModal.canApply) return;

    try {
      const timestamp = Date.now();
      const years = ['2024', '2025', '2026', '2027', '2028'];
      let migrationExecutedCount = 0;

      years.forEach(yr => {
        const key = getActualDataKey(yr);
        const raw = localStorage.getItem(key);
        if (!raw) return;

        try {
          const rows = JSON.parse(raw);
          if (!Array.isArray(rows)) return;

          // 1. 자동 백업 (Auto Backup)
          const backupKey = `actual_data_${yr}_backup_${timestamp}`;
          localStorage.setItem(backupKey, raw);

          const normalizedRows = normalizeActualRows(rows);
          if (normalizedRows.length !== rows.length) {
            localStorage.setItem(key, JSON.stringify(normalizedRows));
            migrationExecutedCount++;
          }
        } catch (err) {
          console.error(`Failed to save backup/clean actual key: ${key}`, err);
        }
      });

      clearDataLoaderCache();
      alert(`최종 확인이 완료되어 실적 정리가 성공적으로 수행되었습니다.\n이전 데이터는 자동 백업되었습니다.`);
      setDuplicateActualModal(null);
    } catch (err) {
      console.error(err);
      alert('정리 저장 중 오류가 발생했습니다.');
    }
  };

  const handleToggleSubmission = (dept: any) => {
    try {
      const key = getSubmissionStatusMapKey(dept.code, submissionYear, submissionPlanType);
      const currentStatus = submissionStatuses[key] || { status: 'DRAFT' };
      const isCurrentlySubmitted = currentStatus.submitted === true || currentStatus.status === 'SUBMITTED' || currentStatus.status === 'APPROVED';
      const newSubmitted = !isCurrentlySubmitted;
      const now = new Date().toLocaleString();

      const newStatuses = {
        ...submissionStatuses,
        [key]: {
          status: newSubmitted ? 'SUBMITTED' : 'DRAFT',
          time: newSubmitted ? now : currentStatus.time,
          user: currentUser?.name || '관리자',
          deptName: dept.name
        }
      };

      setSubmissionStatuses(newStatuses);
      localStorage.setItem(STORAGE_KEYS.SUBMISSION_STATUS, JSON.stringify(newStatuses));

      const action = newSubmitted ? '제출' : '해제';
      addNotification(dept.name, action, now);
    } catch (e: any) {
      alert(e.message || '지원하지 않는 계획유형입니다.');
    }
  };

  const handleOpenProfile = () => {
    if (!currentUser) return;
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const userSetting = settings[currentUser.code] || {};
    
    setProfileId(userSetting.id || currentUser.code);
    setProfilePassword(userSetting.password || currentUser.code);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const userSetting = settings[currentUser.code] || {};
    
    // 비밀번호가 변경되었는지 확인 (해시된 비밀번호와 비교는 복잡하므로, 입력된 값이 해시가 아니면 변경된 것으로 간주)
    let finalPassword = profilePassword;
    const isHashed = profilePassword.length === 64 && /^[0-9a-f]+$/.test(profilePassword);
    
    if (!isHashed) {
      finalPassword = await hashPassword(profilePassword);
    }
    
    settings[currentUser.code] = {
      ...userSetting,
      id: profileId,
      password: finalPassword
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    setIsProfileModalOpen(false);
    alert('내 정보가 성공적으로 수정되었습니다. 다음 로그인 시 새 정보로 로그인해주세요.');
  };

  const handleOpenManageStatus = (e: any) => {
    e.stopPropagation();
    setManageUsers([...users]);
    setIsManageStatusModalOpen(true);
  };

  const toggleManageUserStatus = (userId: number) => {
    setManageUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { ...u, status: u.status === '활성' ? '비활성' : '활성' };
      }
      return u;
    }));
  };

  const handleManageUserYear = (userId: number, year: string) => {
    setManageUsers(prev => prev.map(u => u.id === userId ? { ...u, deactivatedYear: year } : u));
  };

  const handleSaveAllStatuses = () => {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};

    manageUsers.forEach(u => {
      if (!settings[u.code]) settings[u.code] = {};
      settings[u.code].status = u.status;
      settings[u.code].deactivatedYear = u.status === '비활성' ? (u.deactivatedYear || '2026') : null;
    });

    const currentCodes = manageUsers.map(u => u.code);
    Object.keys(settings).forEach(code => {
      if (!currentCodes.includes(code) && code !== '99999') {
        delete settings[code];
      }
    });

    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    setUsers(manageUsers);
    setIsManageStatusModalOpen(false);
    alert('계정 활성화 상태 및 삭제 내역이 일괄 적용되었습니다.');
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    const userSetting = settings[user.code] || {};
    
    setUserId(userSetting.id || user.code);
    setUserPassword(userSetting.password || user.code);
    setUserName(userSetting.name || user.name);
    setViewableDepts(userSetting.viewableDepts || [user.code]);
    setHasSalaryAccess(userSetting.hasSalaryAccess || false);
    setIsProtected(userSetting.isProtected || false);
    
    setIsModalOpen(true);
  };

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<number | null>(null);

  const handleDeleteUser = (userId: number) => {
    setUserToDeleteId(userId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDeleteId === null) return;
    const userToDelete = users.find(u => u.id === userToDeleteId);
    if (!userToDelete) return;

    // Remove from CUSTOM_USERS
    const savedCustomUsers = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
    if (savedCustomUsers) {
      const customUsers = JSON.parse(savedCustomUsers);
      const updatedCustomUsers = customUsers.filter((u: any) => u.code !== userToDelete.code);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify(updatedCustomUsers));
      window.dispatchEvent(new Event('custom-users-changed'));
    }

    // Remove from USER_SETTINGS
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      delete settings[userToDelete.code];
      localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    }

    const updatedUsers = users.filter(u => u.id !== userToDeleteId);
    setUsers(updatedUsers);
    setIsDeleteConfirmOpen(false);
    setUserToDeleteId(null);
    setIsModalOpen(false);
    alert('계정이 삭제되었습니다.');
  };

  const handleSaveSettings = async () => {
    if (!selectedUser) return;
    
    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    let finalPassword = userPassword;
    const isHashed = userPassword.length === 64 && /^[0-9a-f]+$/.test(userPassword);
    
    if (!isHashed) {
      finalPassword = await hashPassword(userPassword);
    }
    
    settings[selectedUser.code] = {
      id: userId,
      password: finalPassword,
      name: userName,
      viewableDepts: viewableDepts,
      hasSalaryAccess: hasSalaryAccess,
      isProtected: isProtected
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));

    const savedCustomUsers = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
    if (savedCustomUsers) {
      const customUsers = JSON.parse(savedCustomUsers);
      const userIndex = customUsers.findIndex((u: any) => u.code === selectedUser.code);
      if (userIndex !== -1) {
        customUsers[userIndex].name = userName;
        localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify(customUsers));
        window.dispatchEvent(new Event('custom-users-changed'));
      }
    }

    const allDepts = getAllDepartments();
    const updatedUsers = allDepts.map((dept, index) => {
      const userSetting = settings[dept.code] || {};
      return {
        id: index + 1,
        name: userSetting.name || dept.manager,
        department: dept.name,
        code: dept.code,
        role: dept.role,
        status: userSetting.status || '활성',
        deactivatedYear: userSetting.deactivatedYear || null
      };
    });
    setUsers(updatedUsers);

    setIsModalOpen(false);
    alert('사용자 설정이 저장되었습니다.');
  };

  const toggleDept = (deptCode: string) => {
    if (deptCode === 'all') {
      if (viewableDepts.includes('all')) {
        setViewableDepts([]);
      } else {
        setViewableDepts(['all', ...DEPARTMENTS.map(d => d.code)]);
      }
      return;
    }

    let newDepts;
    if (viewableDepts.includes(deptCode)) {
      newDepts = viewableDepts.filter(c => c !== deptCode && c !== 'all');
    } else {
      newDepts = [...viewableDepts, deptCode];
      if (newDepts.length === DEPARTMENTS.length) {
        newDepts = ['all', ...newDepts];
      }
    }
    setViewableDepts(newDepts);
  };

  const handleAddUser = async () => {
    if (!newUserId || !newUserPassword || !newUserDeptCode || !newUserDeptName || !newUserName) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const hashedPasswordValue = await hashPassword(newUserPassword);

    const newUser = {
      id: Date.now(),
      name: newUserName,
      department: newUserDeptName,
      code: newUserDeptCode,
      role: '부서장',
      status: '활성'
    };

    const savedCustomUsers = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
    const customUsers = savedCustomUsers ? JSON.parse(savedCustomUsers) : [];
    
    const updatedCustomUsers = [...customUsers, newUser];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify(updatedCustomUsers));
    window.dispatchEvent(new Event('custom-users-changed'));

    const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    settings[newUserDeptCode] = {
      id: newUserId,
      password: hashedPasswordValue,
      viewableDepts: [newUserDeptCode],
      hasSalaryAccess: newHasSalaryAccess,
      isProtected: newIsProtected
    };
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));

    setUsers(prev => [...prev, newUser]);
    setIsAddModalOpen(false);
    
    setNewUserId('');
    setNewUserPassword('');
    setNewUserDeptCode('');
    setNewUserDeptName('');
    setNewUserName('');
    setNewHasSalaryAccess(false);
    setNewIsProtected(false);
    
    alert('사용자가 추가되었습니다.');
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('notifications');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-8 relative">
      {/* Header with Notification Bell */}
      <div className="flex justify-end items-center mb-4">
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen);
              if (!isNotificationOpen) {
                const updated = notifications.map(n => ({ ...n, isRead: true }));
                setNotifications(updated);
                localStorage.setItem('notifications', JSON.stringify(updated));
              }
            }}
            className="p-2 rounded-xl bg-white border border-[#e5e8eb] shadow-sm hover:bg-[#f2f4f6] transition-colors relative"
          >
            <Bell className="w-6 h-6 text-[#4e5968]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#e5e8eb] z-[60] overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#e5e8eb] flex justify-between items-center bg-[#f9fafb]">
                  <h3 className="text-sm font-bold text-[#191f28]">알림 기록</h3>
                  <button 
                    onClick={clearNotifications}
                    className="text-[10px] text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 전체 삭제
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-[#e5e8eb]">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#8b95a1]">
                      알림 내역이 없습니다.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className="px-4 py-3 hover:bg-[#f9fafb] transition-colors">
                        <p className="text-sm text-[#191f28]">
                          <span className="font-bold">{notif.deptName}</span> 부서가 예산을 <span className={`font-bold ${notif.action === '제출' ? 'text-blue-600' : 'text-red-600'}`}>{notif.action}</span>했습니다.
                        </p>
                        <p className="text-[10px] text-[#8b95a1] mt-1">{notif.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {isAdmin && (
          <MetricCard
            title="총 등록 사용자"
            value={<>{users.length}<span className="text-lg font-normal text-lithium-500 ml-1">명</span></>}
            icon={Users}
            className="md:col-span-1"
          />
        )}
        
        <AppCard className={`p-6 transition-all ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <AppSelect 
                value={submissionYear}
                onChange={(e) => setSubmissionYear(e.target.value)}
                className="h-8 py-1 rounded-lg text-xs"
              >
                <option value="2024">2024년</option>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
              </AppSelect>
              <AppSelect 
                value={submissionPlanType}
                onChange={(e) => setSubmissionPlanType(e.target.value)}
                className="h-8 py-1 rounded-lg text-xs"
              >
                <option value="경영계획">경영계획</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차RP">1차RP</option>
                <option value="2차RP">2차RP</option>
                <option value="추정실적">추정실적</option>
              </AppSelect>
            </div>
            <AppButton 
              size="icon"
              onClick={() => setIsSubmissionModalOpen(true)}
              title="상세 현황 확인"
            >
              <FileUp className="w-5 h-5" />
            </AppButton>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-lithium-600">예산 제출 완료 부서</p>
              <p className="text-3xl font-black text-eco-black tabular-nums mt-2">{submissionCount}<span className="text-lg font-normal text-lithium-500 ml-1">/ {totalDepts}</span></p>
            </div>
          </div>
          <div className="mt-4 w-full bg-lithium-100 rounded-full h-2">
            <div className="bg-nickel-600 h-2 rounded-full transition-all duration-500" style={{ width: `${submissionRate}%` }}></div>
          </div>
          <p className="text-[10px] text-lithium-500 mt-2 text-right">아이콘 버튼을 클릭하여 상세 현황 확인</p>
        </AppCard>

        <AppCard 
          variant="interactive"
          onClick={handleOpenProfile}
          className="p-6 flex flex-col justify-center items-center md:col-span-1"
        >
          <Users className="w-8 h-8 text-nickel-600 mb-2" />
          <p className="text-sm font-bold text-eco-black">내 정보 관리</p>
          <p className="text-xs text-lithium-500 mt-1">아이디 및 비밀번호 변경</p>
        </AppCard>
      </div>

      {/* Admin Maintenance Tools */}
      {isAdmin && (
        <AppCard className="p-6 mb-6">
          <h2 className="text-lg font-bold text-[#191f28] mb-2">시스템 진단 및 유지보수</h2>
          <p className="text-sm text-[#4e5968] mb-4">
            데이터 무결성을 확인하고 중복 저장된 과거 데이터(예: 1~4월 중복 합산 예산 등)를 병합/정리하는 기능입니다.
          </p>
          <div className="flex flex-wrap gap-4">
            <AppButton
              variant="default"
              className="flex items-center gap-2 bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb] border border-[#d1d6db]"
              onClick={handleMigrateDuplicates}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              예산 중복 row 정리
            </AppButton>
            <AppButton
              variant="default"
              className="flex items-center gap-2 bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb] border border-[#d1d6db]"
              onClick={handleMigrateActualDuplicates}
            >
              <Trash2 className="w-4 h-4 text-orange-500" />
              실적 중복 row 정리
            </AppButton>
          </div>
        </AppCard>
      )}

      {/* User Management */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-[#e5e8eb] shadow-sm overflow-hidden">
          <div 
            className="px-6 py-5 border-b border-[#e5e8eb] flex justify-between items-center bg-white cursor-pointer hover:bg-[#f9fafb] transition-colors"
            onClick={() => setIsUserListExpanded(!isUserListExpanded)}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#191f28]">사용자 및 부서 관리</h2>
              {isUserListExpanded ? (
                <ArrowUp className="w-5 h-5 text-[#8b95a1]" />
              ) : (
                <ArrowDown className="w-5 h-5 text-[#8b95a1]" />
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleOpenManageStatus}
                className="flex items-center px-4 py-2 bg-white border border-[#d1d6db] text-[#4e5968] rounded-xl text-sm font-medium hover:bg-[#f2f4f6] transition-colors"
              >
                <Users className="w-4 h-4 mr-1" />
                활성/비활성화 관리
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddModalOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                부서/사용자 추가
              </button>
            </div>
          </div>
          {isUserListExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#e5e8eb]">
                    <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider">이름</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider">부서 (코드)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider">권한</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider">상태</th>
                    <th className="px-6 py-4 text-xs font-semibold text-[#4e5968] uppercase tracking-wider text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e8eb]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#4e5968] font-bold mr-3">
                            {user.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-[#191f28]">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#4e5968]">{user.department} <span className="text-[#8b95a1]">({user.code})</span></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <AppBadge variant={user.role === '시스템 관리자' ? 'primary' : 'default'}>
                          {user.role}
                        </AppBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <AppBadge variant={user.status === '활성' ? 'primary' : 'locked'}>
                          {user.status}
                        </AppBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="text-[#8b95a1] hover:text-[#191f28] transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Settings Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">사용자 삭제 확인</h3>
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="text-[#8b95a1] hover:text-[#191f28] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-[#4e5968] mb-4">정말 삭제하시겠습니까?</p>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#f2f4f6] rounded-xl transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={confirmDeleteUser}
                  className="px-4 py-2 bg-red-500 text-white font-medium hover:bg-red-600 rounded-xl transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">
                {selectedUser.department} ({selectedUser.name}) 설정
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-[#8b95a1] hover:text-[#191f28] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">사용자 이름</label>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">아이디</label>
                  <input 
                    type="text" 
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">비밀번호</label>
                  <input 
                    type="password" 
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#4e5968]">급여 조회 권한</label>
                  <input 
                    type="checkbox" 
                    checked={hasSalaryAccess}
                    onChange={() => setHasSalaryAccess(!hasSalaryAccess)}
                    className="w-4 h-4 text-brand-500 rounded border-[#d1d6db] focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#4e5968]">보호조치 (로그인 차단)</label>
                  <input 
                    type="checkbox" 
                    checked={isProtected}
                    onChange={() => setIsProtected(!isProtected)}
                    className="w-4 h-4 text-red-500 rounded border-[#d1d6db] focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4e5968] mb-3">조회 가능 부서</label>
                <div className="bg-[#f9fafb] border border-[#e5e8eb] rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                    <input 
                      type="checkbox" 
                      checked={viewableDepts.includes('all')}
                      onChange={() => toggleDept('all')}
                      className="w-4 h-4 text-brand-500 rounded border-[#d1d6db] focus:ring-brand-500"
                    />
                    <span className="text-sm text-[#191f28] font-bold">전체 <span className="text-[#8b95a1] font-normal">(all)</span></span>
                  </label>
                  {DEPARTMENTS.map(dept => (
                    <label key={dept.code} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        checked={viewableDepts.includes(dept.code)}
                        onChange={() => toggleDept(dept.code)}
                        className="w-4 h-4 text-brand-500 rounded border-[#d1d6db] focus:ring-brand-500"
                      />
                      <span className="text-sm text-[#191f28] font-medium">{dept.name} <span className="text-[#8b95a1] font-normal">({dept.code})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-between items-center">
              <button 
                onClick={() => handleDeleteUser(selectedUser.id)}
                className="px-4 py-2 text-[#f04452] font-medium hover:bg-red-50 rounded-xl transition-colors"
              >
                계정 삭제
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#e5e8eb] rounded-xl transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors"
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">
                부서 사용자 추가
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#8b95a1] hover:text-[#191f28] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">사용자 이름</label>
                  <input 
                    type="text" 
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="예: 홍길동"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">부서명</label>
                  <input 
                    type="text" 
                    value={newUserDeptName}
                    onChange={(e) => setNewUserDeptName(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="예: 신규사업부"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">부서 코드</label>
                  <input 
                    type="text" 
                    value={newUserDeptCode}
                    onChange={(e) => setNewUserDeptCode(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="예: 60000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">아이디</label>
                  <input 
                    type="text" 
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="로그인 아이디"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">비밀번호</label>
                  <input 
                    type="password" 
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="로그인 비밀번호"
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-[#4e5968]">급여 조회 권한</label>
                    <input 
                      type="checkbox" 
                      checked={newHasSalaryAccess}
                      onChange={() => setNewHasSalaryAccess(!newHasSalaryAccess)}
                      className="w-4 h-4 text-brand-500 rounded border-[#d1d6db] focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-[#4e5968]">보호조치 (로그인 차단)</label>
                    <input 
                      type="checkbox" 
                      checked={newIsProtected}
                      onChange={() => setNewIsProtected(!newIsProtected)}
                      className="w-4 h-4 text-red-500 rounded border-[#d1d6db] focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#e5e8eb] rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleAddUser}
                className="px-4 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Status Modal */}
      {isSubmissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center bg-brand-500 text-white">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                <h3 className="text-lg font-bold">
                  {submissionYear}년 {submissionPlanType} 제출 현황
                </h3>
              </div>
              <button 
                onClick={() => setIsSubmissionModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 gap-4">
                {targetDepts.map(dept => {
                  let status = null;
                  try {
                    const key = getSubmissionStatusMapKey(dept.code, submissionYear, submissionPlanType);
                    status = submissionStatuses[key];
                  } catch (e) {
                    // ignore
                  }
                  const isSubmitted = status && (status.submitted === true || status.status === 'SUBMITTED' || status.status === 'APPROVED');
                  
                  return (
                    <div key={dept.code} className={`flex items-center justify-between p-4 rounded-xl border ${
                      isSubmitted ? 'bg-brand-50 border-brand-100' : 'bg-white border-[#e5e8eb]'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isSubmitted ? 'bg-brand-100 text-brand-600' : 'bg-[#f2f4f6] text-[#8b95a1]'
                        }`}>
                          {isSubmitted ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#191f28]">{dept.name}</p>
                          <p className="text-xs text-[#8b95a1]">부서코드: {dept.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                          <BudgetStatusBadge status={isSubmitted ? 'SUBMITTED' : 'DRAFT'} />
                          {isSubmitted && (
                            <p className="text-[10px] text-[#8b95a1] mt-1">
                              {status.time}
                            </p>
                          )}
                        </div>
                        <input 
                          type="checkbox"
                          checked={isSubmitted || false}
                          onChange={() => handleToggleSubmission(dept)}
                          className="w-5 h-5 text-brand-500 rounded border-[#d1d6db] focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-between items-center">
              <p className="text-sm text-[#4e5968]">
                전체 {totalDepts}개 부서 중 <span className="font-bold text-brand-500">{submissionCount}</span>개 부서 제출 완료
              </p>
              <button 
                onClick={() => setIsSubmissionModalOpen(false)}
                className="px-6 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[320px] max-w-[320px] mx-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">
                내 정보 관리
              </h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">아이디</label>
                  <input 
                    type="text" 
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4e5968] mb-1">비밀번호</label>
                  <input 
                    type="password" 
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    className="w-full px-4 py-2 border border-[#d1d6db] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end gap-3">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#e5e8eb] rounded-xl transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Status Modal */}
      {isManageStatusModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[800px] max-w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#191f28]">활성/비활성화 및 계정 관리</h3>
              <button onClick={() => setIsManageStatusModalOpen(false)} className="text-[#8b95a1] hover:text-[#191f28]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {manageUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-[#f9fafb] border border-[#e5e8eb] rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#191f28]">{u.name} <span className="text-[#8b95a1] font-normal">({u.department})</span></p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* 아이폰 스타일 토글 스위치 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#8b95a1]">{u.status}</span>
                      <button
                        onClick={() => toggleManageUserStatus(u.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${u.status === '활성' ? 'bg-brand-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.status === '활성' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {/* 비활성화 시 연도 선택 */}
                    {u.status === '비활성' && (
                      <select 
                        value={u.deactivatedYear || '2026'}
                        onChange={(e) => handleManageUserYear(u.id, e.target.value)}
                        className="text-xs border border-[#d1d6db] rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="2024">2024년</option>
                        <option value="2025">2025년</option>
                        <option value="2026">2026년</option>
                        <option value="2027">2027년</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end gap-3">
              <button onClick={() => setIsManageStatusModalOpen(false)} className="px-4 py-2 text-[#4e5968] font-medium hover:bg-[#e5e8eb] rounded-xl transition-colors">
                취소
              </button>
              <button onClick={handleSaveAllStatuses} className="px-4 py-2 bg-brand-500 text-white font-medium hover:bg-brand-600 rounded-xl transition-colors">
                적용 및 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Actual Cleanup Preview Modal */}
      {duplicateActualModal && duplicateActualModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center bg-[#f9fafb]">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-[#191f28]">실적 중복 row 정리 미리보기</h3>
              </div>
              <button 
                onClick={() => setDuplicateActualModal(null)}
                className="text-[#8b95a1] hover:text-[#191f28] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f9fafb] p-4 rounded-xl border border-[#e5e8eb] space-y-2">
                  <h4 className="text-xs font-semibold text-[#8b95a1] uppercase tracking-wider">전체 행 수 비교</h4>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[#4e5968]">정리 전 전체 행:</span>
                    <span className="text-lg font-bold text-[#191f28]">{duplicateActualModal.totalBeforeCount} 행</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[#4e5968]">정리 후 전체 행:</span>
                    <span className="text-lg font-bold text-brand-600">{duplicateActualModal.totalAfterCount} 행</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-[#e5e8eb]">
                    <span className="text-sm font-semibold text-[#4e5968]">삭제 예정 행 수:</span>
                    <span className="text-lg font-bold text-red-500">-{duplicateActualModal.totalBeforeCount - duplicateActualModal.totalAfterCount} 행</span>
                  </div>
                </div>

                <div className="bg-[#f9fafb] p-4 rounded-xl border border-[#e5e8eb] space-y-2">
                  <h4 className="text-xs font-semibold text-[#8b95a1] uppercase tracking-wider">전체 금액 합계 비교</h4>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[#4e5968]">정리 전 금액합계:</span>
                    <span className="text-lg font-bold text-[#191f28]">{duplicateActualModal.totalBeforeSum.toLocaleString()} 원</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[#4e5968]">정리 후 금액합계:</span>
                    <span className="text-lg font-bold text-brand-600">{duplicateActualModal.totalAfterSum.toLocaleString()} 원</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-[#e5e8eb]">
                    <span className="text-sm font-semibold text-[#4e5968]">합계 차이 (오차):</span>
                    <span className={`text-lg font-bold ${Math.abs(duplicateActualModal.totalBeforeSum - duplicateActualModal.totalAfterSum) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                      {(duplicateActualModal.totalBeforeSum - duplicateActualModal.totalAfterSum).toLocaleString()} 원
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Alert and Backup Notice */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                duplicateActualModal.canApply ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold">
                    {duplicateActualModal.canApply 
                      ? '검증 성공: 정리 시 원천 데이터가 훼손되지 않으며 합계가 일치합니다.' 
                      : '정리 대상 중복 행이 존재하지 않거나 정리 전/후 합계 금액 차이가 존재하여 자동 저장할 수 없습니다.'}
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    * 정리 실행 시, 만약을 대비해 기존 원본 데이터가 타임스탬프와 함께 로컬 스토리지(`actual_data_YYYY_backup_TIMESTAMP`)에 자동 백업됩니다.
                  </p>
                </div>
              </div>

              {/* Scheduled for Deletion List */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-[#191f28]">삭제 예정 상세 행 목록 (Identity 및 내용)</h4>
                <div className="border border-[#e5e8eb] rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f2f4f6] text-[#4e5968] font-bold border-b border-[#e5e8eb]">
                        <th className="p-3">연도/월</th>
                        <th className="p-3">부서코드</th>
                        <th className="p-3">계정코드</th>
                        <th className="p-3">금액 (계획/실적)</th>
                        <th className="p-3">중복 Identity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e8eb]">
                      {duplicateActualModal.yearsData.flatMap(yd => 
                        yd.rowsScheduledForDeletion.map((r, i) => (
                          <tr key={`${yd.year}-${i}`} className="hover:bg-red-50 text-red-600 transition-colors">
                            <td className="p-3">{yd.year} / {r.period}</td>
                            <td className="p-3 font-mono">{r.usageCode}</td>
                            <td className="p-3 font-mono">{r.accountCode}</td>
                            <td className="p-3 font-bold">{(r.amount + r.completed).toLocaleString()}원</td>
                            <td className="p-3 font-mono text-[10px] break-all">{r.identity}</td>
                          </tr>
                        ))
                      )}
                      {duplicateActualModal.yearsData.every(yd => yd.rowsScheduledForDeletion.length === 0) && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#8b95a1] bg-white">
                            삭제 및 정리할 중복 행이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end gap-3">
              <button 
                onClick={() => setDuplicateActualModal(null)}
                className="px-5 py-2.5 bg-white border border-[#d1d6db] text-[#4e5968] font-medium hover:bg-[#f2f4f6] rounded-xl transition-colors"
              >
                닫기
              </button>
              <button 
                onClick={applyActualDuplicatesCleanup}
                disabled={!duplicateActualModal.canApply}
                className={`px-5 py-2.5 text-white font-medium rounded-xl transition-colors ${
                  duplicateActualModal.canApply 
                    ? 'bg-orange-500 hover:bg-orange-600 shadow-sm' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                최종 확인 및 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
