import { describe, it, expect } from 'vitest';
import { BlendStorage, BlendScenario } from '../lib/operation/blendStorage';
import { calculateBlendResult, parseBomPasteText } from '../lib/operation/blendEngine';

describe('Blend Calculation Engine Tests', () => {
  it('should calculate weighted averages for compositions correctly', () => {
    const scenarios = BlendStorage.createDefaultScenarios();
    const scenario1 = scenarios[0];

    const result = calculateBlendResult(scenario1);

    expect(result.totalInputTon).toBe(320); // 80 + 100 + 90 + 50
    expect(result.avgNiPct).toBeGreaterThan(0);
    expect(result.avgCoPct).toBeGreaterThan(0);
    expect(result.totalProductionTon).toBeGreaterThan(0);
    expect(result.totalRevenueKrw).toBeGreaterThan(0);
    expect(result.totalManufacturingCostKrw).toBeGreaterThan(0);
  });

  it('should calculate premium signed rate and unit effect correctly', () => {
    const scenarios = BlendStorage.createDefaultScenarios();
    const s = scenarios[0];

    // Nickel has market price 15800, rate -2.5%
    const res = calculateBlendResult(s);
    const niRes = res.metalResults.find(m => m.metal === 'NI');

    expect(niRes).toBeDefined();
    if (niRes) {
      expect(niRes.premiumUnitAmountUsd).toBeCloseTo(-395, 0); // 15800 * -0.025 = -395
      expect(niRes.appliedPriceUsd).toBeCloseTo(15405, 0); // 15800 - 395
    }
  });

  it('should clone scenario deep copy without mutating source scenario', () => {
    const scenarios = BlendStorage.createDefaultScenarios();
    const s1 = scenarios[0];

    const cloned = BlendStorage.cloneScenario(s1, 'Scenario 2');
    cloned.rawMaterialLines[0].quantityTon = 999;

    expect(s1.rawMaterialLines[0].quantityTon).not.toBe(999);
  });

  it('should parse TSV pasted BOM text with valid/warning counts', () => {
    const pastedText = `구분\t부원료명\t단위\t사용량\t단가
부재료\t황산\tkg\t35,000\t180
부재료\t가성소다\tkg\t18,000\t210`;

    const parsed = parseBomPasteText(pastedText);
    expect(parsed.validCount).toBe(2);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].name).toBe('황산');
    expect(parsed.items[0].usageQty).toBe(35000);
  });
});
