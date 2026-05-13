import { STORAGE_KEYS } from '../constants';

export function getBudgetDataKey(deptCode: string, year: string, planType: string) {
  return `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${planType}`;
}

export function getActualDataKey(year: string) {
  return `${STORAGE_KEYS.ACTUAL_DATA}_${year}`;
}

export function getSubmissionStatusKey(deptCode: string, year: string, planType: string) {
  return `${STORAGE_KEYS.SUBMISSION_STATUS}_${deptCode}_${year}_${planType}`;
}
