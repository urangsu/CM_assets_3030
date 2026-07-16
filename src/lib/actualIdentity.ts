import { ActualData } from './actualUploadParser';

/**
 * Generates a stable fingerprint for uploaded/pasted tabular data.
 */
export function generateContentFingerprint(rows: any[][]): string {
  if (!rows || rows.length === 0) return 'fp_empty';
  const str = JSON.stringify(rows);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

/**
 * Generates a deterministic identity (unique key) for a given actual/plan row to prevent duplication.
 * Priorities:
 * 1. Voucher-based identity (if documentNo exists, prioritized over generated/legacy IDs)
 * 2. Real sourceRowId (if it's not a generated or placeholder ID)
 * 3. Legacy sourceRowId (if exists, kept for backward compatibility)
 * 4. Fallback fingerprint format: FILE|fingerprint|sheet|row|month
 * 5. Last fallback: uploadBatchId or core attributes
 */
export function getActualRowIdentity(row: Partial<ActualData> | any, target?: string): string {
  if (!row) return '';

  const sourceRowId = String(row.sourceRowId || '').trim();
  const isGeneratedRowId = sourceRowId.startsWith('src_flat_') || 
                           sourceRowId.startsWith('src_wide_') || 
                           sourceRowId.startsWith('src_adjustment_') || 
                           sourceRowId.startsWith('src_');
  const hasRealSourceRowId = sourceRowId !== '' && !isGeneratedRowId;

  const documentNo = String(row.documentNo || row.voucherNo || row.slipNo || row.transNo || '').trim();
  const documentLineNo = String(row.documentLineNo || row.lineNo || row.slipLineNo || row.transLineNo || '').trim();

  // 1. 전표번호 정보가 존재하면 최우선 생성 (generated row ID보다 우선)
  if (documentNo !== '') {
    const line = documentLineNo || '1';
    return `voucher:${documentNo}:${line}`;
  }

  // 2. 전표번호가 없는데 원천 고유 식별자(real sourceRowId)가 있으면 사용
  if (hasRealSourceRowId) {
    return `source:${sourceRowId}`;
  }

  // 3. generated/legacy sourceRowId가 있는 경우 (fallback)
  if (sourceRowId !== '') {
    return `source:${sourceRowId}`;
  }

  // 4. Fallback: FILE|fingerprint|sheet|row|month
  const fingerprint = String(row.sourceFileFingerprint || row.fingerprint || '').trim();
  const sheet = String(row.sourceSheetName || row.sheet || 'Sheet1').trim();
  const rowNum = row.sourceRowNumber !== undefined && row.sourceRowNumber !== null ? String(row.sourceRowNumber) : '';
  
  const month = (() => {
    if (row.periodMonth !== undefined && row.periodMonth !== null && row.periodMonth !== '') {
      return String(row.periodMonth);
    }
    if (row.month !== undefined && row.month !== null && row.month !== '') {
      return String(row.month);
    }
    const period = String(row.period || '').trim();
    const match = period.match(/^0?(\d+)월/);
    if (match) return match[1];
    return period;
  })();

  if (fingerprint) {
    return `FILE|${fingerprint}|${sheet}|${rowNum}|${month}`;
  }

  // 5. Extreme fallback for existing legacy items without fingerprint: uploadBatchId or attributes
  const uploadBatchId = String(row.uploadBatchId || '').trim();
  if (uploadBatchId && rowNum) {
    return `upload:${uploadBatchId}:${sheet}:${rowNum}`;
  }

  const dept = String(row.usageCode || row.attributedDeptCode || '').trim();
  const acc = String(row.accountCode || '').trim();
  const yr = String(row.year || '').trim();
  return `fallback_${yr}_${String(target || '').trim()}_${dept}_${acc}_${month}`;
}

export function getActualSourceIdentity(row: any): string | null {
  const identity = getActualRowIdentity(row);
  return identity || null;
}
