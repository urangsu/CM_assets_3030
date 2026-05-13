import { DEPARTMENTS, getViewableDepts, STORAGE_KEYS } from '../constants';
import { isSalaryAccountCode } from './budgetAggregation';

export interface PermissionContext {
  userCode: string | null;
  isAdmin: boolean;
  isPlanningTeam: boolean;
  hasSalaryAccess: boolean;
  viewableDeptCodes: string[];
}

export function getUserCode(user: any): string | null {
  return user?.code || user?.id || null;
}

export function getPermissionContext(user: any): PermissionContext {
  const userCode = getUserCode(user);
  const isAdmin = userCode === '99999';
  const isPlanningTeam = userCode === '32100';
  const hasSalaryAccess = canViewSalaryAccounts(user);
  const viewableDeptCodes = getViewableDeptCodes(user);

  return {
    userCode,
    isAdmin,
    isPlanningTeam,
    hasSalaryAccess,
    viewableDeptCodes
  };
}

export const canViewDepartment = (user: any, deptCode: string): boolean => {
  const userCode = getUserCode(user);
  if (!userCode) return false;
  if (userCode === '99999' || userCode === '32100') return true;
  
  const depts = getViewableDepts(userCode);
  return depts.some(d => d.code === deptCode);
};

export const canViewSalaryAccounts = (user: any): boolean => {
  const userCode = getUserCode(user);
  if (!userCode) return false;
  if (userCode === '99999' || userCode === '32100') return true;
  
  const savedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
  const settings = savedSettings ? JSON.parse(savedSettings) : {};
  const userSetting = settings[userCode];
  
  return !!(userSetting && userSetting.hasSalaryAccess);
};

export const getViewableDeptCodes = (user: any): string[] => {
  const userCode = getUserCode(user);
  if (!userCode) return [];
  return getViewableDepts(userCode).map(d => d.code);
};

export const canViewAccount = (user: any, accountCode: string): boolean => {
  const hasSalaryAccess = canViewSalaryAccounts(user);
  if (!hasSalaryAccess && isSalaryAccountCode(accountCode)) {
    return false;
  }
  return true;
};
