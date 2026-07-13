export interface ActivityExpenses {
  회의비: number;
  간담회비: number;
  부서별그룹활동지원비: number;
}

export const DEFAULT_ACTIVITY_EXPENSES: ActivityExpenses = {
  회의비: 50000, // Discussion: 50,000원
  간담회비: 20000, // Meeting: 20,000원
  부서별그룹활동지원비: 10000 // Group: 10,000원
};

export const ACTIVITY_EXPENSE_COGNITIVE_LABELS = {
  회의비: 'Discussion (회의비 - 5만원)',
  간담회비: 'Meeting (간담회비 - 2만원)',
  부서별그룹활동지원비: 'Group (그룹활동지원비 - 1만원)'
};

/**
 * Calculates the total monthly expense for a given headcount and unit price.
 */
export function calculateExpense(headcount: number, unitPrice: number): number {
  return headcount * unitPrice;
}
