import { describe, expect, it } from 'vitest';
import {
  ALL_ACTUAL_IMPORT_MONTHS,
  filterRowsBySelectedMonths,
  formatSelectedMonths,
  normalizeSelectedMonths,
  readSelectedActualImportMonths,
  resolveRowMonth,
  writeSelectedActualImportMonths,
} from '../lib/actualImportMonthSelection';

describe('실적 업로드 월 선택', () => {
  it('선택 월을 중복 없이 1~12 범위로 정렬한다', () => {
    expect(normalizeSelectedMonths([12, 3, 3, 0, 13, 1])).toEqual([1, 3, 12]);
  });

  it('wide/flat 형식의 월을 안정적으로 판별한다', () => {
    expect(resolveRowMonth({ periodMonth: 5 })).toBe(5);
    expect(resolveRowMonth({ period: '2026-06' })).toBe(6);
    expect(resolveRowMonth({ period: '07월' })).toBe(7);
    expect(resolveRowMonth({ period: '8' })).toBe(8);
  });

  it('선택한 월의 행만 남긴다', () => {
    const rows = [
      { id: 1, period: '1월' },
      { id: 2, period: '2월' },
      { id: 3, period: '2026-03' },
      { id: 4, periodMonth: 4 },
    ];

    expect(filterRowsBySelectedMonths(rows, [2, 4]).map(row => row.id)).toEqual([2, 4]);
  });

  it('선택 월이 없으면 실적 행을 생성하지 않는다', () => {
    expect(filterRowsBySelectedMonths([{ period: '1월' }], [])).toEqual([]);
  });

  it('저장값이 없거나 손상되면 12개월 전체를 기본값으로 사용한다', () => {
    const emptyStorage = { getItem: () => null };
    const brokenStorage = { getItem: () => '{broken' };

    expect(readSelectedActualImportMonths(emptyStorage)).toEqual(ALL_ACTUAL_IMPORT_MONTHS);
    expect(readSelectedActualImportMonths(brokenStorage)).toEqual(ALL_ACTUAL_IMPORT_MONTHS);
  });

  it('선택 월을 저장하고 읽을 수 있다', () => {
    let value: string | null = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, nextValue: string) => { value = nextValue; },
    };

    expect(writeSelectedActualImportMonths([6, 1, 6], storage)).toEqual([1, 6]);
    expect(readSelectedActualImportMonths(storage)).toEqual([1, 6]);
    expect(formatSelectedMonths([1, 6])).toBe('1월, 6월');
  });
});
