import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalizePlanType } from '../lib/planTypes';
import { normalizeBudgetRows } from '../repositories/BudgetRepository';
import { applyErpOneWonPolicy } from '../lib/erpOneWonPolicy';

describe('Regression Tests', () => {

  // 1. /api/send-email 및 nodemailer 제거 검증
  it('should not contain nodemailer in package.json and not contain /api/send-email in code files', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkgContent = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);

    // Verify nodemailer is removed
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps.nodemailer).toBeUndefined();

    // Verify /api/send-email is not used in the key files
    const srcDir = path.resolve(__dirname, '../');
    const searchFilesForString = (dir: string, targetStr: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          if (file !== 'node_modules' && file !== 'dist' && file !== '__tests__') {
            results = results.concat(searchFilesForString(filePath, targetStr));
          }
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes(targetStr)) {
            results.push(filePath);
          }
        }
      });
      return results;
    };

    const foundSendEmail = searchFilesForString(srcDir, '/api/send-email');
    expect(foundSendEmail.length).toBe(0);
  });

  // 2. 계획유형 '3차 RP', 'RP3' 등 예외 처리 및 '경영계획' 자동 매핑 방지 검증
  it('should handle invalid plan types properly and not fallback to 경영계획', () => {
    // Known valid plan types should normalize correctly
    expect(normalizePlanType('1차 RP')).toBe('1차 RP');
    expect(normalizePlanType('2차 RP')).toBe('2차 RP');
    expect(normalizePlanType('경영계획')).toBe('경영계획');

    // Unknown or typos should return null
    expect(normalizePlanType('3차 RP')).toBeNull();
    expect(normalizePlanType('RP3')).toBeNull();
    expect(normalizePlanType('경영계확')).toBeNull();
    expect(normalizePlanType('unknown')).toBeNull();
  });

  // 3. 예산 수치 0 저장 시 유지(덮어쓰기) 및 빈 셀 무시 검증
  it('should preserve explicit 0 on overwrite and ignore/preserve on empty values', () => {
    const existingRow = {
      code: 'A100',
      name: 'test acc',
      values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      attributedDeptCode: '32100'
    };

    const incomingRow = {
      code: 'A100',
      name: 'test acc',
      values: [0, null, undefined, '', ' ', null, null, null, null, null, null, null],
      attributedDeptCode: '32100'
    };

    const result = normalizeBudgetRows([existingRow, incomingRow], '32100');
    expect(result.length).toBe(1);

    // Explicit 0 should overwrite 100 in month 1 (index 0)
    expect(result[0].values[0]).toBe(0);
    // Null / empty values should fall back to preserve the existing value (100)
    expect(result[0].values[1]).toBe(100);
    expect(result[0].values[2]).toBe(100);
    expect(result[0].values[3]).toBe(100);
  });

  // 4. ERP 1원 수치 처리 검증
  it('should apply ERP 1-won policy correctly on export without mutating source values', () => {
    // Case 1: All months are zero budget
    const allZeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const zerosResult = applyErpOneWonPolicy(allZeros);
    // 12th month (December, index 11) should have 1 won
    expect(zerosResult[11]).toBe(1);
    // Other months should remain 0
    expect(zerosResult[0]).toBe(0);
    // Source should not be mutated
    expect(allZeros[11]).toBe(0);

    // Case 2: Some months have non-zero budget
    const someBudget = [1000, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const budgetResult = applyErpOneWonPolicy(someBudget);
    // No months should have 1 won unless it's a dummy row or explicitly set to 1.
    // The existing values (1000 at index 0, 500 at index 2) are preserved.
    expect(budgetResult[0]).toBe(1000);
    expect(budgetResult[2]).toBe(500);
    expect(budgetResult[11]).toBe(0); // 12th month remains 0 because budget has non-zero values
  });
});
