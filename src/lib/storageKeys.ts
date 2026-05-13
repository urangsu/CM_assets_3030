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

export function getSubmissionStatus(deptCode: string, year: string, planType: string): SubmissionStatus {
  try {
    const rawData = localStorage.getItem(STORAGE_KEYS.SUBMISSION_STATUS);
    if (rawData) {
      const allStatuses = JSON.parse(rawData);
      const key = getSubmissionStatusMapKey(deptCode, year, planType);
      const statusData = allStatuses[key];
      if (statusData) {
        return statusData as SubmissionStatus;
      }
    }
  } catch (e) {
    console.error("Failed to parse SUBMISSION_STATUS", e);
  }
  return { status: 'DRAFT' };
}

export function isBudgetLocked(deptCode: string, year: string, planType: string): boolean {
  const status = getSubmissionStatus(deptCode, year, planType).status;
  return status === 'SUBMITTED' || status === 'REVIEWING' || status === 'APPROVED' || status === 'LOCKED';
}
