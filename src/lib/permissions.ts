import { DEPARTMENTS, getViewableDepts, STORAGE_KEYS } from '../constants';

export const canViewDepartment = (user: any, deptCode: string) => {
  if (!user || (!user.code && !user.id)) return false;
  const userCode = user.code || user.id;
  if (userCode === '99999' || user.deptCode === '32100') return true;
  
  const depts = getViewableDepts(userCode);
  return depts.some(d => d.code === deptCode);
};

export const canViewSalaryAccounts = (user: any) => {
  if (!user || (!user.code && !user.id)) return false;
  const userCode = user.code || user.id;
  if (userCode === '99999') return true;
  
  const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
  const settings = savedSettings ? JSON.parse(savedSettings) : {};
  const userSetting = settings[userCode];
  
  return !!(userSetting && userSetting.hasSalaryAccess);
};

export const getViewableDeptCodes = (user: any) => {
  if (!user || (!user.code && !user.id)) return [];
  const userCode = user.code || user.id;
  return getViewableDepts(userCode).map(d => d.code);
};
