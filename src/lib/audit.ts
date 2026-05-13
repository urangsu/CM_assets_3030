// Audit logger for local-first system
export interface AuditEvent {
  id: string;
  timestamp: string;
  userCode: string;
  action: string;
  details: any;
}

const AUDIT_LOG_KEY = 'cleanmetal_audit_log';

export const logAuditEvent = (userCode: string, action: string, details: any = {}) => {
  try {
    const existingStr = localStorage.getItem(AUDIT_LOG_KEY);
    const existing: AuditEvent[] = existingStr ? JSON.parse(existingStr) : [];
    
    existing.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      userCode,
      action,
      details
    });

    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
};

export const getAuditLogs = (): AuditEvent[] => {
  try {
    const existingStr = localStorage.getItem(AUDIT_LOG_KEY);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch {
    return [];
  }
};
