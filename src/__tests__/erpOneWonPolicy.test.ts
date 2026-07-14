import { describe, it, expect } from 'vitest';
import { applyErpOneWonPolicy } from '../lib/erpOneWonPolicy';

describe('ERP 1-Won Policy Tests', () => {
  it('should inject 1 won to all 12 months if all months are 0', () => {
    const allZeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = applyErpOneWonPolicy(allZeros);

    // Sum should be 12 (1 won each month)
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBe(12);
    
    // Each element must be exactly 1
    expect(result).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

    // Source array must not be mutated
    expect(allZeros).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('should NOT alter any month if there is at least one non-zero value', () => {
    // Single non-zero value
    const someValues = [0, 0, 150000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = applyErpOneWonPolicy(someValues);

    expect(result).toEqual(someValues);
    expect(result[2]).toBe(150000);
    expect(result[0]).toBe(0);
    expect(result[11]).toBe(0);

    // Negative value is also non-zero
    const negativeValue = [0, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const resultNegative = applyErpOneWonPolicy(negativeValue);
    expect(resultNegative).toEqual(negativeValue);
  });
});
