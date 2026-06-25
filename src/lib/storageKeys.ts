import { STORAGE_KEYS } from '../constants';
import { normalizePlanType, getPlanTypeAliases } from './planTypes';

export function getBudgetDataKey(deptCode: string, year: string, planType: string) {
  const safePlanType = normalizePlanType(planType);
  return `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${safePlanType}`;
}

export function readBudgetData(deptCode: string, year: string, planType: string): string | null {
  for (const candidate of getPlanTypeAliases(planType)) {
    const key = `${STORAGE_KEYS.BUDGET_DATA}_${deptCode}_${year}_${candidate}`;
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
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
  const safePlanType = normalizePlanType(planType);
  return `${deptCode}_${year}_${safePlanType}`;
}

export function normalizeSubmissionStatus(raw: any): SubmissionStatus {
  if (!raw) return { status: 'DRAFT' };
  if (raw.status) return raw as SubmissionStatus;
  if (raw.submitted === true) return { ...raw, status: 'SUBMITTED' };
  if (raw.submitted === false) return { ...raw, status: 'DRAFT' };
  return { status: 'DRAFT' };
}

export function getSubmissionStatus(deptCode: string, year: string, planType: string): SubmissionStatus {
  try {
    const rawData = localStorage.getItem(STORAGE_KEYS.SUBMISSION_STATUS);
    if (rawData) {
      const allStatuses = JSON.parse(rawData);

      for (const candidate of getPlanTypeAliases(planType)) {
        const key = `${deptCode}_${year}_${candidate}`;
        const statusData = allStatuses[key];
        if (statusData) return normalizeSubmissionStatus(statusData);
      }

      const normalizedKey = getSubmissionStatusMapKey(deptCode, year, planType);
      const statusData = allStatuses[normalizedKey];
      if (statusData) {
        return normalizeSubmissionStatus(statusData);
      }
    }
  } catch (e) {
    console.error("Failed to parse SUBMISSION_STATUS", e);
  }
  return { status: 'DRAFT' };
}

export function isSubmittedLike(status: any): boolean {
  if (!status) return false;
  if (status.submitted === true) return true;
  return ['SUBMITTED', 'REVIEWING', 'APPROVED', 'LOCKED'].includes(status.status);
}

export function isBudgetLocked(deptCode: string, year: string, planType: string): boolean {
  const normalized = getSubmissionStatus(deptCode, year, planType);
  return isSubmittedLike(normalized);
}

export function setSubmissionStatus(
  deptCode: string,
  year: string,
  planType: string,
  status: SubmissionStatus
) {
  const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSION_STATUS);
  const statuses = raw ? JSON.parse(raw) : {};
  const key = getSubmissionStatusMapKey(deptCode, year, planType);

  statuses[key] = {
    ...status,
    status: status.status,
  };
  localStorage.setItem(STORAGE_KEYS.SUBMISSION_STATUS, JSON.stringify(statuses));
}

export function unlockBudget(
  deptCode: string,
  year: string,
  planType: string,
  user?: string,
  reason?: string
) {
  setSubmissionStatus(deptCode, year, planType, {
    status: 'DRAFT',
    time: new Date().toLocaleString(),
    user,
    reason: reason || '관리자 잠금 해제',
  });
}

export interface BudgetLockAuditLog {
  id: string;
  action: 'UNLOCK' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'CANCEL_SUBMIT';
  deptCode: string;
  deptName: string;
  year: string;
  planType: string;
  beforeStatus: string;
  afterStatus: string;
  userCode?: string;
  userName?: string;
  reason?: string;
  time: string;
}

export function appendBudgetLockAuditLog(log: Omit<BudgetLockAuditLog, 'id' | 'time'>) {
  const key = 'hycm_budget_lock_audit_log';
  const rows = JSON.parse(localStorage.getItem(key) || '[]');

  rows.unshift({
    ...log,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    time: new Date().toLocaleString(),
  });

  localStorage.setItem(key, JSON.stringify(rows));
}

export function getEffectiveDeptCodeForActual(
  row: any,
  attributionIndex?: Map<string, string> | Record<string, string>,
  fallbackYear?: string
): string {
  const itemId = row.id || row.sourceRowId || row.rowNo || row._rowIndex || 'no-id';
  const itemSignature = `${row.period}_${row.usageCode}_${row.accountCode}_${itemId}`;

  if (attributionIndex) {
    if (attributionIndex instanceof Map) {
      const val = attributionIndex.get(itemSignature) || attributionIndex.get(String(itemId));
      if (val) return val;
    } else {
      const val = attributionIndex[itemSignature] || attributionIndex[String(itemId)];
      if (val) return val;
    }
  }

  if (row.attributedDeptCode) {
    return row.attributedDeptCode;
  }

  // Fallback to cached lookup
  const year = row.year || fallbackYear;
  if (!year) {
    return row.attributedDeptCode || row.usageCode || '';
  }

  if (!actualsMapsByYear.has(year)) {
    const map = new Map<string, string>();
    try {
      const key = getActualDataKey(year);
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item.attributedDeptCode) {
            const currentId = item.id || item.sourceRowId || item.rowNo || item._rowIndex || 'no-id';
            const signature = `${item.period}_${item.usageCode}_${item.accountCode}_${currentId}`;
            map.set(signature, item.attributedDeptCode);
          }
        });
      }
    } catch (e) {
      console.error('Failed to load effective dept map', e);
    }
    actualsMapsByYear.set(year, map);
  }

  const override = actualsMapsByYear.get(year)?.get(itemSignature);
  return override || row.usageCode || '';
}

const actualsMapsByYear = new Map<string, Map<string, string>>();

export function clearEffectiveDeptCache() {
  actualsMapsByYear.clear();
}

