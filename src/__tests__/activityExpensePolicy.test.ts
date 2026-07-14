import { describe, it, expect } from 'vitest';
import { DEFAULT_ACTIVITY_EXPENSES, calculateExpense, ACTIVITY_EXPENSE_COGNITIVE_LABELS } from '../lib/activityExpensePolicy';

describe('Activity Expense Policy Tests', () => {
  it('should have standardized unit costs', () => {
    expect(DEFAULT_ACTIVITY_EXPENSES.회의비).toBe(20000);
    expect(DEFAULT_ACTIVITY_EXPENSES.간담회비).toBe(50000);
    expect(DEFAULT_ACTIVITY_EXPENSES.부서별그룹활동지원비).toBe(10000);
  });

  it('should have updated cognitive labels matching the unit costs', () => {
    expect(ACTIVITY_EXPENSE_COGNITIVE_LABELS.회의비).toContain('2만원');
    expect(ACTIVITY_EXPENSE_COGNITIVE_LABELS.간담회비).toContain('5만원');
    expect(ACTIVITY_EXPENSE_COGNITIVE_LABELS.부서별그룹활동지원비).toContain('1만원');
  });

  it('should calculate expenses accurately by multiplying headcount and unit price', () => {
    expect(calculateExpense(10, DEFAULT_ACTIVITY_EXPENSES.회의비)).toBe(200000);
    expect(calculateExpense(5, DEFAULT_ACTIVITY_EXPENSES.간담회비)).toBe(250000);
    expect(calculateExpense(8, DEFAULT_ACTIVITY_EXPENSES.부서별그룹활동지원비)).toBe(80000);
    expect(calculateExpense(0, DEFAULT_ACTIVITY_EXPENSES.회의비)).toBe(0);
  });
});
