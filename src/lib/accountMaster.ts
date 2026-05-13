export type BudgetType = 'GENERAL' | 'INVESTMENT';

export type ManagementCategory =
  | '제조'
  | '판관'
  | '안전'
  | '환경'
  | '연구'
  | '투자';

export interface AccountMaster {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  budgetType: BudgetType;
  managementCategory: ManagementCategory;
}

export const INVESTMENT_ACCOUNTS = [
  { id: 'acc_12310000', code: '12310000', name: '토지' },
  { id: 'acc_12320000', code: '12320000', name: '건물' },
  { id: 'acc_12330000', code: '12330000', name: '구축물' },
  { id: 'acc_12340000', code: '12340000', name: '기계장치' },
  { id: 'acc_12360000', code: '12360000', name: '공구와기구' },
  { id: 'acc_12370000', code: '12370000', name: '비품' },
  { id: 'acc_12390000', code: '12390000', name: '건설중인자산' },
  { id: 'acc_12480000', code: '12480000', name: '기타무형자산' },
  { id: 'acc_12480200', code: '12480200', name: '소프트웨어' },
  { id: 'acc_12107401', code: '12107401', name: '임차보증금' },
].map(acc => ({
  ...acc,
  categoryName: '투자 - 투자',
  budgetType: 'INVESTMENT' as BudgetType,
  managementCategory: '투자' as ManagementCategory,
}));

export function isInvestmentAccount(accountCode: string): boolean {
  return INVESTMENT_ACCOUNTS.some(acc => acc.code === accountCode);
}

export function inferBudgetTypeByAccountCode(accountCode: string): BudgetType {
  return isInvestmentAccount(accountCode) ? 'INVESTMENT' : 'GENERAL';
}

export function inferManagementCategoryByAccountCode(accountCode: string): ManagementCategory {
  if (isInvestmentAccount(accountCode)) return '투자';
  if (accountCode.startsWith('A')) return '제조';
  if (accountCode.startsWith('B')) return '판관';
  return '제조'; // fallback
}
