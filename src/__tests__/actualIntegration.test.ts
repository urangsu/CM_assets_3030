import { describe, it, expect } from 'vitest';
import { getActualRowIdentity, getActualSourceIdentity, generateContentFingerprint } from '../lib/actualIdentity';
import { normalizeActualRows } from '../repositories/BudgetRepository';

describe('Actual Integration & Identity Tests', () => {

  // 1. File A 2 rows vs File B 2 rows (separate preservation)
  it('should preserve separate rows from File A and File B when they have different content/fingerprints', () => {
    // File A contains 2 rows
    const fileARows = [
      ['A100', '32100', '100000', 'Remarks A1'],
      ['A200', '32100', '200000', 'Remarks A2']
    ];
    const fpA = generateContentFingerprint(fileARows);

    // File B contains 2 rows (same account/dept structure but different content/remarks)
    const fileBRows = [
      ['A100', '32100', '150000', 'Remarks B1'],
      ['A200', '32100', '250000', 'Remarks B2']
    ];
    const fpB = generateContentFingerprint(fileBRows);

    expect(fpA).not.toBe(fpB);

    const row1 = {
      usageCode: '32100',
      accountCode: 'A100',
      amount: 100000,
      year: '2026',
      period: '1월',
      sourceSheetName: 'Sheet1',
      sourceRowNumber: 2,
      sourceFileFingerprint: fpA
    };

    const row2 = {
      usageCode: '32100',
      accountCode: 'A100',
      amount: 150000,
      year: '2026',
      period: '1월',
      sourceSheetName: 'Sheet1',
      sourceRowNumber: 2,
      sourceFileFingerprint: fpB
    };

    const id1 = getActualSourceIdentity(row1);
    const id2 = getActualSourceIdentity(row2);

    expect(id1).not.toBe(id2);

    const combined = [row1, row2];
    const normalized = normalizeActualRows(combined);
    expect(normalized.length).toBe(2);
  });

  // 2. Duplicate file upload (no row count increase)
  it('should result in no row count increase when uploading the exact same file content again', () => {
    const fileRows = [
      ['A100', '32100', '100000'],
      ['A200', '32100', '200000']
    ];
    const fp = generateContentFingerprint(fileRows);

    const row1 = {
      usageCode: '32100',
      accountCode: 'A100',
      amount: 100000,
      year: '2026',
      period: '1월',
      sourceSheetName: 'Sheet1',
      sourceRowNumber: 2,
      sourceFileFingerprint: fp
    };

    const row2 = {
      usageCode: '32100',
      accountCode: 'A200',
      amount: 200000,
      year: '2026',
      period: '1월',
      sourceSheetName: 'Sheet1',
      sourceRowNumber: 3,
      sourceFileFingerprint: fp
    };

    // Re-uploaded rows (same fingerprint, same sheet, same row number)
    const reUploadedRow1 = { ...row1 };
    const reUploadedRow2 = { ...row2 };

    const combined = [row1, row2, reUploadedRow1, reUploadedRow2];
    const normalized = normalizeActualRows(combined);

    expect(normalized.length).toBe(2);
  });

  // 3. Different vouchers in same month/dept/account (preserved)
  it('should preserve separate rows with different voucher numbers in the same month/dept/account', () => {
    const row1 = {
      usageCode: '32100',
      accountCode: 'A100',
      amount: 100000,
      year: '2026',
      period: '1월',
      documentNo: 'VOUCHER-001',
      documentLineNo: '1'
    };

    const row2 = {
      usageCode: '32100',
      accountCode: 'A100',
      amount: 200000,
      year: '2026',
      period: '1월',
      documentNo: 'VOUCHER-002',
      documentLineNo: '1'
    };

    const id1 = getActualSourceIdentity(row1);
    const id2 = getActualSourceIdentity(row2);

    expect(id1).not.toBe(id2);

    const normalized = normalizeActualRows([row1, row2]);
    expect(normalized.length).toBe(2);
  });

  // 4. Voucher number priority over generated ID
  it('should prioritize voucher numbers and never collapse different vouchers even with identical structural codes', () => {
    const row = {
      sourceRowId: 'src_generated_1234',
      usageCode: '32100',
      accountCode: 'A100',
      amount: 50000,
      year: '2026',
      period: '1월',
      documentNo: 'VOUCHER-REAL-777',
      documentLineNo: '1'
    };

    const id = getActualSourceIdentity(row);
    // Since sourceRowId is a generated placeholder (starts with 'src_'), voucher takes priority:
    expect(id).toBe('voucher:VOUCHER-REAL-777:1');

    // If sourceRowId is not present, voucher is prioritized over fallback
    const rowNoSrcId = { ...row, sourceRowId: undefined };
    const idNoSrcId = getActualSourceIdentity(rowNoSrcId);
    expect(idNoSrcId).toBe('voucher:VOUCHER-REAL-777:1');
  });

  // 5. Legacy identity preservation
  it('should preserve legacy rows correctly and keep their legacy identity format when normalized', () => {
    // Legacy rows do not have fingerprints or voucher numbers, but might have existing sourceRowId
    const legacyRow = {
      sourceRowId: 'legacy_v1_row_99',
      usageCode: '32100',
      accountCode: 'A100',
      amount: 70000,
      year: '2026',
      period: '1월'
    };

    const id = getActualSourceIdentity(legacyRow);
    expect(id).toBe('source:legacy_v1_row_99');

    const normalized = normalizeActualRows([legacyRow]);
    expect(normalized[0].sourceRowId).toBe('legacy_v1_row_99');
  });

  // 6. normalizeActualRows sum consistency
  it('should maintain sum consistency of amount/completed after running normalizeActualRows', () => {
    const rows = [
      {
        usageCode: '32100',
        accountCode: 'A100',
        completed: 1000,
        amount: 0,
        year: '2026',
        period: '1월',
        documentNo: 'V_1'
      },
      {
        usageCode: '32100',
        accountCode: 'A200',
        completed: 2500,
        amount: 0,
        year: '2026',
        period: '1월',
        documentNo: 'V_2'
      },
      // Duplicate of V_1
      {
        usageCode: '32100',
        accountCode: 'A100',
        completed: 1000,
        amount: 0,
        year: '2026',
        period: '1월',
        documentNo: 'V_1'
      }
    ];

    const originalSum = rows.reduce((sum, r) => sum + r.completed, 0); // 4500
    const normalized = normalizeActualRows(rows);

    const normalizedSum = normalized.reduce((sum, r) => sum + (r.completed || 0), 0); // Should be 3500 (V_1 duplicate removed)
    expect(normalized.length).toBe(2);
    expect(normalizedSum).toBe(3500);
  });

  // 7. PlanActualUpload merge result verification
  it('should successfully simulate merge of existing rows with newly uploaded rows', () => {
    const existing = [
      {
        usageCode: '32100',
        accountCode: 'A100',
        completed: 1500,
        year: '2026',
        period: '1월',
        documentNo: 'V_OLD'
      }
    ];

    const newlyUploaded = [
      // Exact duplicate of existing
      {
        usageCode: '32100',
        accountCode: 'A100',
        completed: 1500,
        year: '2026',
        period: '1월',
        documentNo: 'V_OLD'
      },
      // New row
      {
        usageCode: '32100',
        accountCode: 'A200',
        completed: 8000,
        year: '2026',
        period: '1월',
        documentNo: 'V_NEW'
      }
    ];

    const mergedAll = [...existing, ...newlyUploaded];
    const deduplicated = normalizeActualRows(mergedAll);

    expect(deduplicated.length).toBe(2);
    const hasA100 = deduplicated.some(r => r.accountCode === 'A100' && r.completed === 1500);
    const hasA200 = deduplicated.some(r => r.accountCode === 'A200' && r.completed === 8000);
    expect(hasA100).toBe(true);
    expect(hasA200).toBe(true);
  });
});
