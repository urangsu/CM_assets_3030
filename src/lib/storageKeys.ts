import { STORAGE_KEYS } from '../constants';

export function getBudgetDataKey(deptCode: string, year: string, planType: string) {
  return `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${planType}`;
}

export function getActualDataKey(year: string) {
  return `${STORAGE_KEYS.ACTUAL_DATA}_${year}`;
}

export type BudgetStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'LOCKED';

export interface SubmissionStatus {
  status: BudgetStatus;
  time?: string;
  user?: string;
  deptName?: string;
  reason?: string;
  submitted?: boolean; // legacy
}

export function getSubmissionStatusMapKey(deptCode: string, year: string, planType: string) {
  return `${deptCode}_${year}_${planType}`;
}
