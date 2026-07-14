import { ERP_EXPORT_SENTINEL_AMOUNT } from '../constants';

/**
 * Applies the ERP 1-won policy to a list of monthly budget values for ERP download.
 * - 한 예산행의 1월~12월 값이 모두 0일 때 -> ERP 다운로드용 사본의 1월~12월에 각각 1원 적용 (연간합계 12원)
 * - 일부 월에 실제 금액이 하나라도 존재하면 해당 행 전체를 변경하지 않고 원본 유지
 * - 원본 배열을 mutate하지 않음
 */
export function applyErpOneWonPolicy(monthlyValues: readonly number[]): number[] {
  const normalized = Array.from({ length: 12 }, (_, index) =>
    Number(monthlyValues[index] ?? 0),
  );

  const isAllZero = normalized.every(value => value === 0);

  if (!isAllZero) {
    return [...normalized];
  }

  return Array(12).fill(ERP_EXPORT_SENTINEL_AMOUNT);
}
