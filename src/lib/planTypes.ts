export type PlanType =
  | '실적'
  | '경영계획'
  | '증액반영'
  | '수정경영계획'
  | '1차 RP'
  | '2차 RP';

export type BudgetPlanType =
  | '경영계획'
  | '증액반영'
  | '수정경영계획'
  | '1차 RP'
  | '2차 RP';

export const PLAN_TYPE_OPTIONS: PlanType[] = [
  '실적',
  '경영계획',
  '증액반영',
  '수정경영계획',
  '1차 RP',
  '2차 RP',
];

export const BUDGET_PLAN_TYPE_OPTIONS: BudgetPlanType[] = [
  '경영계획',
  '증액반영',
  '수정경영계획',
  '1차 RP',
  '2차 RP',
];

export function normalizePlanType(value: unknown): PlanType {
  const raw = String(value ?? '').trim();

  const map: Record<string, PlanType> = {
    실적: '실적',
    actual: '실적',
    Actual: '실적',

    경영계획: '경영계획',
    계획: '경영계획',
    businessplan: '경영계획',
    BusinessPlan: '경영계획',

    증액반영: '증액반영',
    예산증액반영: '증액반영',
    증액계획: '증액반영',
    adjustedplan: '증액반영',
    AdjustedPlan: '증액반영',
    budgetincrease: '증액반영',
    BudgetIncrease: '증액반영',

    수정경영계획: '수정경영계획',
    수정계획: '수정경영계획',
    수수계획: '수정경영계획',
    수주계획: '수정경영계획',

    '1차 RP': '1차 RP',
    '1차RP': '1차 RP',
    RP1: '1차 RP',
    'RP 1': '1차 RP',

    '2차 RP': '2차 RP',
    '2차RP': '2차 RP',
    RP2: '2차 RP',
    'RP 2': '2차 RP',
  };

  return map[raw] || '경영계획';
}

export function isValidPlanType(value: unknown): value is PlanType {
  return PLAN_TYPE_OPTIONS.includes(value as PlanType);
}

export function getPlanTypeAliases(planType: string): string[] {
  const normalized = normalizePlanType(planType);

  if (normalized === '수정경영계획') {
    return ['수정경영계획', '수정계획', '수수계획', '수주계획'];
  }

  if (normalized === '1차 RP') {
    return ['1차 RP', '1차RP', 'RP1', 'RP 1'];
  }

  if (normalized === '2차 RP') {
    return ['2차 RP', '2차RP', 'RP2', 'RP 2'];
  }

  if (normalized === '증액반영') {
    return ['증액반영', '예산증액반영', '증액계획', 'AdjustedPlan', 'budgetincrease'];
  }

  return [normalized];
}
