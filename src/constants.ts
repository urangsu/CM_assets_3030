import { safeLocalStorageGet } from './lib/safeStorage';

export const DEPARTMENTS = [
  { code: '99999', name: '운영자', manager: '운영자(본인)', role: '시스템 관리자' },
  { code: '32100', name: '기획재무그룹', manager: '부서장', role: '부서장' },
  { code: '20000', name: '임원실', manager: '부서장', role: '부서장' },
  { code: '21001', name: '정도경영그룹', manager: '부서장', role: '부서장' },
  { code: '21002', name: '안전환경센터', manager: '부서장', role: '부서장' },
  { code: '21100', name: '전략소싱그룹', manager: '부서장', role: '부서장' },
  { code: '21110', name: '마케팅섹션', manager: '부서장', role: '부서장' },
  { code: '32000', name: '경영기획실', manager: '부서장', role: '부서장' },
  { code: '32200', name: '인사행정그룹', manager: '부서장', role: '부서장' },
  { code: '50000', name: '생산기술실', manager: '부서장', role: '부서장' },
  { code: '50200', name: '1공장', manager: '부서장', role: '부서장' },
  { code: '50201', name: '물류반', manager: '부서장', role: '부서장' },
  { code: '50210', name: '침출파트', manager: '부서장', role: '부서장' },
  { code: '50220', name: '추출파트', manager: '부서장', role: '부서장' },
  { code: '50240', name: '결정화파트', manager: '부서장', role: '부서장' },
  { code: '50250', name: '리튬파트', manager: '부서장', role: '부서장' },
  { code: '50400', name: '품질기술부', manager: '부서장', role: '부서장' },
  { code: '50410', name: '품질분석섹션', manager: '부서장', role: '부서장' },
  { code: '50411', name: '분석파트', manager: '부서장', role: '부서장' },
  { code: '50420', name: '품질기술섹션', manager: '부서장', role: '부서장' },
  { code: '50600', name: '설비관리섹션', manager: '부서장', role: '부서장' },
  { code: '50610', name: '기계파트', manager: '부서장', role: '부서장' },
  { code: '50620', name: '전기파트', manager: '부서장', role: '부서장' },
  { code: '98000', name: '고문', manager: '부서장', role: '부서장' },
  { code: '99901', name: '휴직', manager: '부서장', role: '부서장' },
  { code: '99902', name: '국내파견', manager: '부서장', role: '부서장' },
  { code: '99903', name: '국외파견', manager: '부서장', role: '부서장' },
];

// 로컬 스토리지 키
export const STORAGE_KEYS = {
  GLOBAL_ACCOUNTS: 'cleanmetal_global_accounts',
  DEPT_SELECTIONS: 'cleanmetal_dept_selections',
  BUDGET_DATA: 'cleanmetal_budget_data',
  ACTUAL_DATA: 'cleanmetal_actual_data',
  USER_SETTINGS: 'cleanmetal_user_settings',
  CUSTOM_USERS: 'cleanmetal_custom_users',
  SUBMISSION_STATUS: 'cleanmetal_submission_status',
};

export const SALARY_CATEGORIES = [
  '제조 - 직원급여',
  '제조 - 퇴직급여충당부채전입액',
  '제조 - 임원급여',
  '판관 - 임원급여',
  '판관 - 직원급여',
  '판관 - 퇴직급여충당부채전입액'
];

export const getAllDepartments = () => {
  const customUsers = safeLocalStorageGet<any[]>(STORAGE_KEYS.CUSTOM_USERS, []);
  const safeCustomUsers = Array.isArray(customUsers) ? customUsers : [];

  const customDepts = safeCustomUsers
    .map((u: any) => ({
      code: u.departmentCode,
      name: u.department,
      manager: u.name,
      role: u.role,
    }))
    .filter((d: any) => d.code);

  const allDepts = [...DEPARTMENTS, ...customDepts];
  const uniqueDepts = Array.from(new Map(allDepts.map(item => [item.code, item])).values());
  
  return uniqueDepts;
};

export const getViewableDepts = (userCode: string) => {
  const allDepts = getAllDepartments();
  
  if (userCode === '99999' || userCode === '32100') {
    return allDepts.filter(d => d.code !== '99999');
  }
  
  const settings = safeLocalStorageGet<Record<string, any>>(STORAGE_KEYS.USER_SETTINGS, {});
  const userSetting = settings[userCode];
  
  if (userSetting && Array.isArray(userSetting.viewableDepts)) {
    return allDepts.filter(d => userSetting.viewableDepts.includes(d.code));
  }
  
  return allDepts.filter(d => d.code === userCode);
};
