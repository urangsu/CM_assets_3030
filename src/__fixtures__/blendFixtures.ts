import { BlendMaterialLine, MetalAssumption, BlendScenario } from '../lib/operation/blendStorage';
import { BomMatrixRow } from '../lib/operation/bomMatrixParser';

export const FIXTURE_RAW_MATERIAL_LINES: BlendMaterialLine[] = [
  {
    id: 'f_m1',
    selected: true,
    rawItemCode: 'BLCOWE-USA-RWD',
    rawItemName: 'BLCOWE-USA-RWD (LCO 슬러지)',
    materialGroup: 'LCO',
    ledgerUnitPrice: 14.5,
    priceType: 'ISSUE',
    quantityTon: 80,
    niPct: 18.5,
    coPct: 22.0,
    lcPct: 6.2,
    mnPct: 1.2,
    cuPct: 0.3
  },
  {
    id: 'f_m2',
    selected: true,
    rawItemCode: 'B811-WET',
    rawItemName: 'B811-WET (811 WET 분말)',
    materialGroup: 'BP',
    ledgerUnitPrice: 12.2,
    priceType: 'ISSUE',
    quantityTon: 100,
    niPct: 32.5,
    coPct: 4.1,
    lcPct: 4.8,
    mnPct: 4.0,
    cuPct: 0.5
  },
  {
    id: 'f_m3',
    selected: true,
    rawItemCode: 'B622WE-USA-ABT',
    rawItemName: 'B622WE-USA-ABT (622 WET 케이크)',
    materialGroup: 'WET',
    ledgerUnitPrice: 8.8,
    priceType: 'ISSUE',
    quantityTon: 90,
    niPct: 22.1,
    coPct: 7.2,
    lcPct: 3.9,
    mnPct: 7.5,
    cuPct: 1.1
  },
  {
    id: 'f_m4',
    selected: true,
    rawItemCode: '622',
    rawItemName: '622 BM 표준품',
    materialGroup: 'BM',
    ledgerUnitPrice: 7.5,
    priceType: 'ISSUE',
    quantityTon: 50,
    niPct: 21.0,
    coPct: 7.0,
    lcPct: 3.8,
    mnPct: 7.0,
    cuPct: 0.8
  }
];

export const FIXTURE_METAL_ASSUMPTIONS: MetalAssumption[] = [
  {
    metal: 'NI',
    metalName: '니켈 (Ni)',
    marketPrice: 15800,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: -2.5,
    premiumUnitAmount: -395,
    recoveryRatePct: 98.5
  },
  {
    metal: 'CO',
    metalName: '코발트 (Co)',
    marketPrice: 31000,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 3.0,
    premiumUnitAmount: 930,
    recoveryRatePct: 97.5
  },
  {
    metal: 'LC',
    metalName: '리튬 (LC)',
    marketPrice: 12500,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: -1.0,
    premiumUnitAmount: -125,
    recoveryRatePct: 95.0
  },
  {
    metal: 'MN',
    metalName: '망간 (Mn)',
    marketPrice: 2300,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0.0,
    premiumUnitAmount: 0,
    recoveryRatePct: 96.0
  },
  {
    metal: 'CU',
    metalName: '구리 (Cu)',
    marketPrice: 9600,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 1.5,
    premiumUnitAmount: 144,
    recoveryRatePct: 95.0
  }
];

export const FIXTURE_BOM_ROWS: BomMatrixRow[] = [
  {
    id: 'f_b1',
    category: '원재료',
    itemName: '망간분말',
    unit: 'kg',
    coefficients: { MN: 0.0387 },
    unitPrice: 2300
  },
  {
    id: 'f_b2',
    category: '부재료',
    itemName: '황산',
    unit: 'kg',
    coefficients: { NI: 2.33, CO: 2.33, LC: 1.56 },
    unitPrice: 180
  },
  {
    id: 'f_b3',
    category: '부재료',
    itemName: '희황산',
    unit: 'kg',
    coefficients: { NI: 5.13, CO: 5.20, LC: 2.74, MN: 1.6662, CU: 1.08 },
    unitPrice: 120
  }
];

export function createFixtureScenario(): BlendScenario {
  const now = new Date().toISOString();
  return {
    id: 'fixture_sc_1',
    name: 'Fixture Scenario',
    year: '2026',
    month: 5,
    priceBasis: 'ISSUE',
    exchangeRate: 1350,
    rawMaterialLines: FIXTURE_RAW_MATERIAL_LINES,
    metalAssumptions: FIXTURE_METAL_ASSUMPTIONS,
    bomSnapshot: {
      id: 'fixture_bom_snap',
      name: 'Fixture BOM',
      items: FIXTURE_BOM_ROWS as any,
      updatedAt: now
    },
    nclTargetPct: 35.0,
    createdAt: now,
    updatedAt: now
  };
}
