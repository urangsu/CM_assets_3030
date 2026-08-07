import { describe, it, expect } from 'vitest';
import { resolveRawMaterialGroup, isRawItemCode } from '../lib/operation/rawMaterialLedgerParser';

describe('Raw Material Classification & Parsing Logic', () => {
  it('should strictly prioritize LCO over everything else', () => {
    // BLCOWE-USA-RWD must be LCO despite WE/WET signal
    expect(resolveRawMaterialGroup('BLCOWE-USA-RWD')).toBe('LCO');
    expect(resolveRawMaterialGroup('BLCO-WET-001')).toBe('LCO');
    expect(resolveRawMaterialGroup('B811-LCO')).toBe('LCO');
    expect(resolveRawMaterialGroup('LCO-USA')).toBe('LCO');
    expect(resolveRawMaterialGroup('LCO')).toBe('LCO');
  });

  it('should prioritize BP over WET and BM when code contains 811', () => {
    expect(resolveRawMaterialGroup('811')).toBe('BP');
    expect(resolveRawMaterialGroup('B811-USA')).toBe('BP');
    expect(resolveRawMaterialGroup('B811-WET')).toBe('BP');
    expect(resolveRawMaterialGroup('811WE-ABC')).toBe('BP');
  });

  it('should classify WET when WET/WE/WT signals exist without LCO and without 811', () => {
    expect(resolveRawMaterialGroup('B622WET-USA')).toBe('WET');
    expect(resolveRawMaterialGroup('B622WE-USA-ABT')).toBe('WET');
    expect(resolveRawMaterialGroup('B622WT-USA')).toBe('WET');
    expect(resolveRawMaterialGroup('WET-BM')).toBe('WET');
  });

  it('should classify BM when containing 622, 523, or 111 without LCO/BP/WET', () => {
    expect(resolveRawMaterialGroup('622')).toBe('BM');
    expect(resolveRawMaterialGroup('B622-USA')).toBe('BM');
    expect(resolveRawMaterialGroup('523')).toBe('BM');
    expect(resolveRawMaterialGroup('B523-ABC')).toBe('BM');
    expect(resolveRawMaterialGroup('111')).toBe('BM');
    expect(resolveRawMaterialGroup('B111-ABC')).toBe('BM');
  });

  it('should classify MN and fallback to 기타', () => {
    expect(resolveRawMaterialGroup('MN-001')).toBe('MN');
    expect(resolveRawMaterialGroup('망간분말')).toBe('MN');
    expect(resolveRawMaterialGroup('UNKNOWN-CODE')).toBe('기타');
  });

  it('should parse numeric codes like 811, 622, 523, 111 properly', () => {
    expect(isRawItemCode('811')).toBe(true);
    expect(isRawItemCode('622')).toBe(true);
    expect(isRawItemCode('523')).toBe(true);
    expect(isRawItemCode('111')).toBe(true);
    expect(isRawItemCode('BLCOWE-USA-RWD')).toBe(true);

    // Should filter standard numbers
    expect(isRawItemCode('2026')).toBe(false);
    expect(isRawItemCode('1')).toBe(false);
    expect(isRawItemCode('12')).toBe(false);
    expect(isRawItemCode('100')).toBe(false);
    expect(isRawItemCode('합계')).toBe(false);
  });
});
