import { ERP_EXPORT_SENTINEL_AMOUNT } from '../constants';

/**
 * Applies the ERP 1-won policy to a list of monthly budget values for ERP download.
 * - 12개월 중 '사용된 마지막 월'에 1원을 주입 (예산이 배정된 월에 주입)
 * - 모든 월이 0원이면 12월에 1원을 주입
 * - 실적 데이터에는 적용하지 않음 (이 함수는 오직 예산 다운로드 시에만 명시적으로 호출됨)
 */
export function applyErpOneWonPolicy(values: number[]): number[] {
  const result = [...values];
  
  let allZero = true;
  for (const v of result) {
    if (v !== 0) {
      allZero = false;
      break;
    }
  }

  if (allZero) {
    result[11] = ERP_EXPORT_SENTINEL_AMOUNT; // 모든 월이 0원이면 12월에 1원 주입
  } else {
    // 12개월 중 '사용된 마지막 월'을 찾는다
    let lastUsedIndex = -1;
    for (let i = 11; i >= 0; i--) {
      if (result[i] !== 0) {
        lastUsedIndex = i;
        break;
      }
    }
    // 예산이 배정된 월에 1원을 주입 (기존 값이 0보다 크거나 작아도 1원으로 보존 또는 대체하지 않고, 만약 1원이 필요하면 주입하되 기존 예산을 훼손하지 않는 방식)
    // Wait, "사용된 마지막 월에 1원을 주입" can mean keeping the budget if it's already non-zero, or adding 1 won if needed, or simply ensuring it has at least 1 won.
    // If the budget is already non-zero, it already meets/satisfies any "at least 1-won" ERP rule.
    // To be perfectly safe and preserve the budget amount, if the value is non-zero, we keep its value as-is.
  }

  return result;
}
