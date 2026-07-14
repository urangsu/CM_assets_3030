export const DEFAULT_ACTIVITY_EXPENSES = {
  회의비: 20_000,
  간담회비: 50_000,
  부서별그룹활동지원비: 10_000,
} as const;

export type ActivityExpenses = typeof DEFAULT_ACTIVITY_EXPENSES;

export const ACTIVITY_EXPENSE_COGNITIVE_LABELS = {
  회의비: 'Discussion (회의비 - 2만원)',
  간담회비: 'Meeting (간담회비 - 5만원)',
  부서별그룹활동지원비: 'Group (그룹활동지원비 - 1만원)'
};

/**
 * Calculates the total monthly expense for a given headcount and unit price.
 */
export function calculateExpense(headcount: number, unitPrice: number): number {
  return headcount * unitPrice;
}
