export interface BlendMaterialLine {
  id: string;
  selected: boolean;
  rawItemCode: string;
  rawItemName: string;
  materialGroup: 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타';
  
  // Ledger unit price reference (Million KRW / ton)
  ledgerUnitPrice: number;
  ledgerPriceMonth?: number;
  priceType: 'ISSUE' | 'ENDING' | 'PURCHASE' | 'CUSTOM';
  customUnitPrice?: number; // Override unit price in million KRW / ton
  
  quantityTon: number; // Raw material input quantity (tons)
  
  // Major metal compositions (% weight)
  niPct: number;
  coPct: number;
  lcPct: number;
  mnPct: number;
  cuPct: number;
  
  // Minor metal compositions (% weight) - expandable
  alPct?: number;
  fePct?: number;
  fPct?: number;
  pPct?: number;
  mgPct?: number;
  caPct?: number;
  kPct?: number;
  pbPct?: number;
  dcPct?: number;
  moisturePct?: number; // 수분 %
}

export interface MetalAssumption {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  metalName: string;
  marketPrice: number; // e.g. 15800
  currency: 'USD' | 'KRW';
  quoteUnit: 'TON' | 'KG' | 'LB';
  
  premiumMode: 'RATE' | 'UNIT_AMOUNT';
  premiumRatePct: number; // e.g. -2.5 (%)
  premiumUnitAmount: number; // e.g. -350 ($/t)
  
  recoveryRatePct: number; // e.g. 98.5 (%) 회수율
  
  targetMinPct?: number; // Target component min range %
  targetMaxPct?: number; // Target component max range %
  
  referenceDate?: string;
  note?: string;
}

export interface BomItem {
  id: string;
  category: '원재료' | '부재료' | '조업재료' | '유틸리티';
  name: string;
  itemName?: string;
  coefficients?: {
    NI?: number;
    CO?: number;
    LC?: number;
    MN?: number;
    CU?: number;
  };
  unit: string; // kg, L, Nm3, kWh, t
  usageQty?: number; // 사용량
  unitPrice: number; // 단가 (원)
  costAmount?: number; // 재료비 (원)
  unitPerTonProduct?: number; // 톤당 원단위
  variableCostPerTon?: number; // 톤당 변동비 (원/t)
}

export interface BomSnapshot {
  id: string;
  name: string; // e.g. 2026년 7월 BOM
  items: BomItem[];
  updatedAt: string;
}

export interface BlendScenario {
  id: string;
  name: string; // e.g. Scenario 1, Scenario 2
  year: string;
  month: number;
  priceBasis: 'ISSUE' | 'ENDING' | 'PURCHASE'; // 공정불출단가 (default), 기말재고단가, 구매단가
  exchangeRate: number; // e.g. 1350 KRW/USD
  
  rawMaterialLines: BlendMaterialLine[];
  metalAssumptions: MetalAssumption[];
  bomSnapshot: BomSnapshot;
  
  nclTargetPct: number; // NCL target percentage (e.g. 35.0%)
  isDirty?: boolean;
  createdAt: string;
  updatedAt: string;
}

const SCENARIOS_KEY = 'hycm_blend_scenarios';
const BOM_MASTERS_KEY = 'hycm_bom_masters';

export const DEFAULT_METAL_ASSUMPTIONS: MetalAssumption[] = [
  {
    metal: 'NI',
    metalName: '니켈 (Ni)',
    marketPrice: 0,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0,
    premiumUnitAmount: 0,
    recoveryRatePct: 98.5
  },
  {
    metal: 'CO',
    metalName: '코발트 (Co)',
    marketPrice: 0,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0,
    premiumUnitAmount: 0,
    recoveryRatePct: 97.5
  },
  {
    metal: 'LC',
    metalName: '리튬 (LC)',
    marketPrice: 0,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0,
    premiumUnitAmount: 0,
    recoveryRatePct: 95.0
  },
  {
    metal: 'MN',
    metalName: '망간 (Mn)',
    marketPrice: 0,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0,
    premiumUnitAmount: 0,
    recoveryRatePct: 96.0
  },
  {
    metal: 'CU',
    metalName: '구리 (Cu)',
    marketPrice: 0,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: 0,
    premiumUnitAmount: 0,
    recoveryRatePct: 95.0
  }
];

export const DEFAULT_BOM_ITEMS: BomItem[] = [];

export const DEFAULT_RAW_MATERIAL_LINES: BlendMaterialLine[] = [];

function generateUUID(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

export const BlendStorage = {
  getScenarios(): BlendScenario[] {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) {
      const defaults = this.createDefaultScenarios();
      this.saveScenarios(defaults);
      return defaults;
    }
    try {
      return JSON.parse(raw);
    } catch {
      const defaults = this.createDefaultScenarios();
      this.saveScenarios(defaults);
      return defaults;
    }
  },

  saveScenarios(scenarios: BlendScenario[]): void {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
    window.dispatchEvent(new Event('hycm-blend-scenarios-changed'));
  },

  createDefaultScenarios(): BlendScenario[] {
    const now = new Date().toISOString();
    const currentYear = '2026';
    const currentMonth = 5;

    const s1: BlendScenario = {
      id: generateUUID('sc'),
      name: 'Scenario 1',
      year: currentYear,
      month: currentMonth,
      priceBasis: 'ISSUE',
      exchangeRate: 1350,
      rawMaterialLines: DEFAULT_RAW_MATERIAL_LINES,
      metalAssumptions: DEFAULT_METAL_ASSUMPTIONS,
      bomSnapshot: {
        id: generateUUID('bom_snap'),
        name: 'Scenario 1 BOM',
        items: DEFAULT_BOM_ITEMS,
        updatedAt: now
      },
      nclTargetPct: 35.0,
      createdAt: now,
      updatedAt: now
    };

    const s2: BlendScenario = JSON.parse(JSON.stringify(s1));
    s2.id = generateUUID('sc');
    s2.name = 'Scenario 2';

    return [s1, s2];
  },

  getBomMasters(): BomSnapshot[] {
    const raw = localStorage.getItem(BOM_MASTERS_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveBomMasters(masters: BomSnapshot[]): void {
    localStorage.setItem(BOM_MASTERS_KEY, JSON.stringify(masters));
  },

  cloneScenario(sourceScenario: BlendScenario, newName?: string): BlendScenario {
    const cloned: BlendScenario = JSON.parse(JSON.stringify(sourceScenario));
    const now = new Date().toISOString();
    cloned.id = generateUUID('sc');
    cloned.name = newName || `${sourceScenario.name} (복사본)`;
    cloned.createdAt = now;
    cloned.updatedAt = now;
    cloned.isDirty = false;
    return cloned;
  }
};
