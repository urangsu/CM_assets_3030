import { describe, it, expect } from 'vitest';
import { 
  normalizePlanType, 
  normalizePlanTypeForWrite, 
  inspectLegacyPlanType 
} from '../lib/planTypes';

describe('Plan Types Validation and Normalization Tests', () => {
  it('should normalize valid plan types and their aliases correctly', () => {
    expect(normalizePlanType('경영계획')).toBe('경영계획');
    expect(normalizePlanType('1차 RP')).toBe('1차 RP');
    expect(normalizePlanType('1차RP')).toBe('1차 RP');
    expect(normalizePlanType('2차 RP')).toBe('2차 RP');
    expect(normalizePlanType('2차RP')).toBe('2차 RP');
    expect(normalizePlanType('수정경영계획')).toBe('수정경영계획');
  });

  it('should return null for unsupported/invalid plan types', () => {
    expect(normalizePlanType('3차 RP')).toBeNull();
    expect(normalizePlanType('RP3')).toBeNull();
    expect(normalizePlanType('추정실적')).toBeNull();
    expect(normalizePlanType('알수없는유형')).toBeNull();
  });

  it('normalizePlanTypeForWrite should throw error for invalid types and return valid types', () => {
    // Should pass for valid type
    expect(normalizePlanTypeForWrite('경영계획')).toBe('경영계획');
    expect(normalizePlanTypeForWrite('2차RP')).toBe('2차 RP');

    // Should throw explicit error for invalid type
    expect(() => normalizePlanTypeForWrite('3차 RP')).toThrowError('지원하지 않는 계획유형(원본값: 3차 RP)입니다. 저장이 차단되었습니다.');
    expect(() => normalizePlanTypeForWrite('추정실적')).toThrowError('지원하지 않는 계획유형(원본값: 추정실적)입니다. 저장이 차단되었습니다.');
  });

  it('inspectLegacyPlanType should elegantly return diagnostics without throwing', () => {
    const validInspect = inspectLegacyPlanType('1차RP');
    expect(validInspect.isSupported).toBe(true);
    expect(validInspect.normalized).toBe('1차 RP');
    expect(validInspect.originalPlanType).toBe('1차RP');

    const invalidInspect = inspectLegacyPlanType('추정실적');
    expect(invalidInspect.isSupported).toBe(false);
    expect(invalidInspect.normalized).toBeNull();
    expect(invalidInspect.originalPlanType).toBe('추정실적');
    expect(invalidInspect.status).toBe('unsupported-plan-type');
  });
});
