import { ActualData } from './actualUploadParser';

/**
 * Generates a deterministic identity (unique key) for a given actual/plan row to prevent duplication.
 * Priorities:
 * 1. Source Row ID (sourceRowId)
 * 2. Combined attributes (usageCode, accountCode, documentNo, documentLineNo, period)
 * 3. Fallback: usageCode, accountCode, year, period, sourceSheetName, sourceRowNumber (row index)
 */
export function getActualRowIdentity(row: Partial<ActualData> | any, target?: string): string {
  const targetStr = String(target || '').trim();

  // 1. 최우선: 원천 데이터 고유 식별자 (sourceRowId)
  if (row.sourceRowId && String(row.sourceRowId).trim() !== '') {
    return `source_${String(row.sourceRowId).trim()}`;
  }

  // 2. 부재 시: 부서코드, 계정코드, 전표번호, 전표행번호, 일자 등 고유 속성 조합
  const dept = String(row.usageCode || row.attributedDeptCode || '').trim();
  const acc = String(row.accountCode || '').trim();
  const yr = String(row.year || '').trim();
  const prd = String(row.period || '').trim();
  
  const docNo = String(row.documentNo || row.slipNo || row.transNo || '').trim();
  const docLineNo = String(row.documentLineNo || row.slipLineNo || row.transLineNo || '').trim();

  // 전표번호 정보가 존재하면 속성 조합 identity 생성
  if (docNo !== '') {
    return `attr_${yr}_${targetStr}_${dept}_${acc}_${docNo}_${docLineNo}_${prd}`;
  }

  // 3. 최하위 Fallback: 부서, 계정, 일자 정보 + 파일/시트 명 + 행번호
  const sheet = String(row.sourceSheetName || '').trim();
  const rowNum = row.sourceRowNumber !== undefined ? String(row.sourceRowNumber) : '';

  return `fallback_${yr}_${targetStr}_${dept}_${acc}_${prd}_${sheet}_${rowNum}`;
}
