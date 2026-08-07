import { describe, expect, it } from 'vitest';
import {
  normalizeSelectedActualMonths,
  parseUploadRecords,
  parseWideMonthlyRows,
  parseFlatRows
} from '../lib/actualUploadParser';

describe('Actual Import Month Selection & Validation', () => {
  describe('normalizeSelectedActualMonths', () => {
    it('deduplicates, filters valid month range (1-12), and sorts ascending', () => {
      const input = [5, 2, 5, 12, 1, 0, 13, -1, 3];
      const result = normalizeSelectedActualMonths(input);
      expect(result).toEqual([1, 2, 3, 5, 12]);
    });

    it('returns all 12 months when undefined is passed', () => {
      const result = normalizeSelectedActualMonths(undefined);
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('returns empty array when empty array is passed', () => {
      const result = normalizeSelectedActualMonths([]);
      expect(result).toEqual([]);
    });
  });

  describe('Wide Monthly Upload Filtering', () => {
    const headers = ['귀속부서코드', '계정과목코드', '계정과목명', '1월', '2월', '3월'];
    const records = [
      {
        귀속부서코드: '1001',
        계정과목코드: '5001',
        계정과목명: '복리후생비',
        '1월': 1000,
        '2월': 2000,
        '3월': 3000
      }
    ];

    it('generates rows for all months when selectedActualMonths includes 1, 2, 3', () => {
      const res = parseWideMonthlyRows({
        records,
        year: '2026',
        existingCount: 0,
        uploadKind: 'monthlyActual',
        selectedActualMonths: [1, 2, 3]
      });

      expect(res.generatedRowCount).toBe(3);
      expect(res.actualRows.map(r => r.periodMonth)).toEqual([1, 2, 3]);
    });

    it('filters and generates rows ONLY for specified selectedActualMonths (e.g. 2월 only)', () => {
      const res = parseWideMonthlyRows({
        records,
        year: '2026',
        existingCount: 0,
        uploadKind: 'monthlyActual',
        selectedActualMonths: [2]
      });

      expect(res.generatedRowCount).toBe(1);
      expect(res.actualRows[0].periodMonth).toBe(2);
      expect(res.actualRows[0].period).toBe('2월');
      expect(res.actualRows[0].completed).toBe(2000);
    });
  });

  describe('Flat Upload Filtering & Unparseable Period Warning', () => {
    it('filters flat rows based on selectedActualMonths', () => {
      const records = [
        { 기간: '1월', 계정코드: '5001', 부서코드: '1001', 실적: 100 },
        { 기간: '2월', 계정코드: '5001', 부서코드: '1001', 실적: 200 },
        { 기간: '3월', 계정코드: '5001', 부서코드: '1001', 실적: 300 }
      ];

      const res = parseFlatRows({
        records,
        year: '2026',
        existingCount: 0,
        uploadKind: 'monthlyActual',
        selectedActualMonths: [2]
      });

      expect(res.generatedRowCount).toBe(1);
      expect(res.actualRows[0].periodMonth).toBe(2);
      expect(res.actualRows[0].completed).toBe(200);
    });

    it('adds warning for unparseable period value when selectedActualMonths is set', () => {
      const records = [
        { 기간: '미지정월', 계정코드: '5001', 부서코드: '1001', 실적: 100 },
        { 기간: '2월', 계정코드: '5001', 부서코드: '1001', 실적: 200 }
      ];

      const res = parseFlatRows({
        records,
        year: '2026',
        existingCount: 0,
        uploadKind: 'monthlyActual',
        selectedActualMonths: [2]
      });

      expect(res.warningRows.length).toBeGreaterThan(0);
      const periodWarning = res.warningRows.find(w => w.field === 'period');
      expect(periodWarning).toBeDefined();
      expect(periodWarning?.message).toContain('월을 판별할 수 없어 가져오기에서 제외했습니다');
      expect(res.generatedRowCount).toBe(1);
      expect(res.actualRows[0].periodMonth).toBe(2);
    });
  });

  describe('Empty Selection Edge Case', () => {
    it('returns error when selectedActualMonths is empty for actual upload in parseUploadRecords', () => {
      const headers = ['귀속부서코드', '계정과목코드', '1월', '2월'];
      const records = [{ 귀속부서코드: '1001', 계정과목코드: '5001', '1월': 100 }];

      const res = parseUploadRecords({
        headers,
        records,
        year: '2026',
        existingCount: 0,
        planType: '실적',
        uploadKind: 'monthlyActual',
        selectedActualMonths: []
      });

      expect(res.generatedRowCount).toBe(0);
      expect(res.errorRows).toHaveLength(1);
      expect(res.errorRows[0].message).toContain('가져올 실적 월을 한 개 이상 선택해주세요.');
    });
  });

  describe('Plan/Budget Upload Preservation', () => {
    it('ignores selectedActualMonths filtering for budget plan uploads', () => {
      const headers = ['귀속부서코드', '계정과목코드', '1월', '2월', '3월'];
      const records = [{ 귀속부서코드: '1001', 계정과목코드: '5001', '1월': 100, '2월': 200, '3월': 300 }];

      const res = parseUploadRecords({
        headers,
        records,
        year: '2026',
        existingCount: 0,
        planType: '경영계획',
        selectedActualMonths: [1]
      });

      // Budget uploads generate monthly wide rows as actualRows or budgetRows without month filtering
      expect(res.generatedRowCount).toBe(3);
    });
  });
});
