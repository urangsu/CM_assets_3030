import { describe, it, expect } from 'vitest';
import { getActualRowIdentity } from '../lib/actualIdentity';

describe('Actual Identity Tests', () => {
  it('should prioritize voucher-based identity if documentNo exists', () => {
    const row = {
      sourceRowId: 'row_98765',
      usageCode: '32100',
      accountCode: 'A100',
      documentNo: 'DOC12345',
      documentLineNo: '1',
      period: '2026-05',
      sourceSheetName: 'SheetA',
      sourceRowNumber: 15
    };

    const identity = getActualRowIdentity(row, '실적');
    expect(identity).toBe('voucher:DOC12345:1');
  });

  it('should use real sourceRowId if documentNo is missing but sourceRowId is present', () => {
    const row = {
      sourceRowId: 'row_98765',
      usageCode: '32100',
      accountCode: 'A100',
      period: '2026-05',
      year: '2026',
      sourceSheetName: 'SheetA',
      sourceRowNumber: 15
    };

    const identity = getActualRowIdentity(row, '실적');
    expect(identity).toBe('source:row_98765');
  });

  it('should fall back to sheet name and row index if both sourceRowId and documentNo are missing and no fingerprint', () => {
    const row = {
      usageCode: '32100',
      accountCode: 'A100',
      period: '2026-05',
      year: '2026',
      sourceSheetName: 'SheetA',
      sourceRowNumber: 15
    };

    const identity = getActualRowIdentity(row, '실적');
    expect(identity).toBe('fallback_2026_실적_32100_A100_2026-05');
  });

  it('should fall back to fingerprint format FILE|fingerprint|sheet|row|month if fingerprint is present', () => {
    const row = {
      usageCode: '32100',
      accountCode: 'A100',
      period: '2026-05',
      year: '2026',
      sourceSheetName: 'SheetA',
      sourceRowNumber: 15,
      sourceFileFingerprint: 'fp_abc123'
    };

    const identity = getActualRowIdentity(row, '실적');
    expect(identity).toBe('FILE|fp_abc123|SheetA|15|2026-05');
  });

  it('should produce identical keys for identical properties (deterministic check)', () => {
    const row1 = {
      usageCode: '32100',
      accountCode: 'A100',
      documentNo: 'DOC12345',
      documentLineNo: '1',
      period: '2026-05',
      year: '2026'
    };

    const row2 = {
      usageCode: ' 32100 ', // with whitespace to test trim
      accountCode: 'A100',
      documentNo: 'DOC12345',
      documentLineNo: '1',
      period: '2026-05',
      year: '2026'
    };

    expect(getActualRowIdentity(row1, '실적')).toBe(getActualRowIdentity(row2, '실적'));
  });
});
