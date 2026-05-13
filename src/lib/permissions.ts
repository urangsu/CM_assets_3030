import { DEPARTMENTS } from '../constants';

export const canViewDepartment = (user: any, deptCode: string) => {
  if (user?.code === '99999') return true;
  if (user?.deptCode === '32100') return true;
  return user?.viewableDepts?.includes(deptCode);
};

export const canViewSalaryAccounts = (user: any) => {
  if (user?.code === '99999') return true;
  return !!user?.hasSalaryAccess;
};

export const getViewableDeptCodes = (user: any) => {
  if (user?.code === '99999' || user?.deptCode === '32100') {
    return DEPARTMENTS.map(d => d.code);
  }
  return user?.viewableDepts || [];
};
