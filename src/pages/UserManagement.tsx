import { useState, useEffect, useRef } from 'react';
import { Users, Upload, FileUp, Plus, MoreVertical, X, Calendar, FileText, CheckCircle2, Clock, ArrowUp, ArrowDown, Bell, Trash2 } from 'lucide-react';
import { DEPARTMENTS, STORAGE_KEYS, getAllDepartments, getViewableDepts } from '../constants';
import { getSubmissionStatusKey } from '../lib/storageKeys';
import { hashPassword } from '../lib/auth';
import { motion, AnimatePresence } from 'motion/react';

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
    const status = submissionStatuses[getSubmissionStatusKey(dept.code, submissionYear, submissionPlanType)];
    return status && status.submitted;
  });

  const submissionCount = submittedDepts.length;
  const totalDepts = targetDepts.length;
  const submissionRate = totalDepts > 0 ? (submissionCount / totalDepts) * 100 : 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

  const sendEmailNotification = async (deptName: string, action: string, time: string) => {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'su@poscohycm.com',
          subject: `[예산 ${action} 알림] ${deptName}의 경영계획 ${action}이 완료되었습니다.`,
          text: `부서: ${deptName}\n동작: ${action}\n시간: ${time}\n\n시스템에서 상세 내용을 확인하세요.`
        })
      });
    } catch (error) {
      console.error('Email send failed:', error);
    }
  };

  const handleToggleSubmission = (dept: any) => {
    const key = getSubmissionStatusKey(dept.code, submissionYear, submissionPlanType);
    const currentStatus = submissionStatuses[key] || { submitted: false };
    const newSubmitted = !currentStatus.submitted;
    const now = new Date().toLocaleString();

    const newStatuses = {
      ...submissionStatuses,
      [key]: {
        submitted: newSubmitted,
        time: newSubmitted ? now : currentStatus.time,
        user: currentUser?.name || '관리자'
      }
    };

    setSubmissionStatuses(newStatuses);
    localStorage.setItem(STORAGE_KEYS.SUBMISSION_STATUS, JSON.stringify(newStatuses));

    const action = newSubmitted ? '제출' : '해제';
    addNotification(dept.name, action, now);
    
    if (newSubmitted) {
      sendEmailNotification(dept.name, '제출', now);
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
          <div className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#4e5968]">총 등록 사용자</p>
                <div className="flex items-end gap-3 mt-2">
                  <p className="text-3xl font-bold text-[#191f28]">{users.length}<span className="text-lg font-normal text-[#8b95a1] ml-1">명</span></p>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
        )}
        
        <div 
          className={`bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm transition-all ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select 
                value={submissionYear}
                onChange={(e) => setSubmissionYear(e.target.value)}
                className="text-xs bg-[#f2f4f6] border-none rounded-lg py-1 px-2 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="2024">2024년</option>
                <option value="2025">2025년</option>
                <option value="2026">2026년</option>
              </select>
              <select 
                value={submissionPlanType}
                onChange={(e) => setSubmissionPlanType(e.target.value)}
                className="text-xs bg-[#f2f4f6] border-none rounded-lg py-1 px-2 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="경영계획">경영계획</option>
                <option value="수정경영계획">수정경영계획</option>
                <option value="1차RP">1차RP</option>
                <option value="2차RP">2차RP</option>
                <option value="추정실적">추정실적</option>
              </select>
            </div>
            <button 
              onClick={() => setIsSubmissionModalOpen(true)}
              className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center hover:bg-brand-600 transition-colors group shadow-lg shadow-brand-200"
              title="상세 현황 확인"
            >
              <FileUp className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#4e5968]">예산 제출 완료 부서</p>
              <p className="text-3xl font-bold text-[#191f28] mt-2">{submissionCount}<span className="text-lg font-normal text-[#8b95a1] ml-1">/ {totalDepts}</span></p>
            </div>
          </div>
          <div className="mt-4 w-full bg-[#f2f4f6] rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${submissionRate}%` }}></div>
          </div>
          <p className="text-[10px] text-[#8b95a1] mt-2 text-right">아이콘 버튼을 클릭하여 상세 현황 확인</p>
        </div>

        <div 
          onClick={handleOpenProfile}
          className="bg-white p-6 rounded-2xl border border-[#e5e8eb] shadow-sm flex flex-col justify-center items-center cursor-pointer hover:bg-[#f9fafb] transition-colors md:col-span-1"
        >
          <Users className="w-8 h-8 text-brand-500 mb-2" />
          <p className="text-sm font-medium text-[#191f28]">내 정보 관리</p>
          <p className="text-xs text-[#8b95a1] mt-1">아이디 및 비밀번호 변경</p>
        </div>
      </div>

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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === '시스템 관리자' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === '활성' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.status}
                        </span>
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
                  const status = submissionStatuses[getSubmissionStatusKey(dept.code, submissionYear, submissionPlanType)];
                  const isSubmitted = status && status.submitted;
                  
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isSubmitted ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {isSubmitted ? '제출 완료' : '미제출'}
                          </span>
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
    </div>
  );
}
