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
  niTonPerTon?: number;
  coTonPerTon?: number;
  lcTonPerTon?: number;
  mnTonPerTon?: number;
  cuTonPerTon?: number;
  unit: string; // kg, L, Nm3, kWh, t
  usageQty: number; // 사용량
  unitPrice: number; // 단가 (원)
  costAmount: number; // 재료비 (원)
  unitPerTonProduct: number; // 톤당 원단위
  variableCostPerTon: number; // 톤당 변동비 (원/t)
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
    marketPrice: 15800,
    currency: 'USD',
    quoteUnit: 'TON',
    premiumMode: 'RATE',
    premiumRatePct: -2.5,
    premiumUnitAmount: -395,
    recoveryRatePct: 98.5,
    targetMinPct: 24.0,
    targetMaxPct: 26.0,
    referenceDate: '2026-08-01',
    note: 'LME 3월물'
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
    recoveryRatePct: 97.5,
    targetMinPct: 7.0,
    targetMaxPct: 8.0,
    referenceDate: '2026-08-01',
    note: 'Fastmarkets Spot'
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
    recoveryRatePct: 95.0,
    targetMinPct: 4.0,
    targetMaxPct: 5.0,
    referenceDate: '2026-08-01',
    note: '탄산리튬 중국'
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
    recoveryRatePct: 96.0,
    targetMinPct: 8.0,
    targetMaxPct: 10.0,
    referenceDate: '2026-08-01',
    note: '고순도 망간'
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
    recoveryRatePct: 95.0,
    targetMinPct: 0.5,
    targetMaxPct: 1.5,
    referenceDate: '2026-08-01',
    note: 'LME Spot'
  }
];

export const DEFAULT_BOM_ITEMS: BomItem[] = [
  // 원재료
  { id: 'b1', category: '원재료', name: '망간분말', unit: 'kg', usageQty: 1200, unitPrice: 2300, costAmount: 2760000, unitPerTonProduct: 1.2, variableCostPerTon: 2760000 },
  
  // 부재료
  { id: 'b2', category: '부재료', name: '황산', unit: 'kg', usageQty: 35000, unitPrice: 180, costAmount: 6300000, unitPerTonProduct: 35.0, variableCostPerTon: 6300000 },
  { id: 'b3', category: '부재료', name: '희황산', unit: 'kg', usageQty: 12000, unitPrice: 120, costAmount: 1440000, unitPerTonProduct: 12.0, variableCostPerTon: 1440000 },
  { id: 'b4', category: '부재료', name: '액화CO2', unit: 'kg', usageQty: 5000, unitPrice: 250, costAmount: 1250000, unitPerTonProduct: 5.0, variableCostPerTon: 1250000 },
  { id: 'b5', category: '부재료', name: '가성소다(20%)', unit: 'kg', usageQty: 18000, unitPrice: 210, costAmount: 3780000, unitPerTonProduct: 18.0, variableCostPerTon: 3780000 },
  { id: 'b6', category: '부재료', name: '가성소다(25%)', unit: 'kg', usageQty: 14000, unitPrice: 260, costAmount: 3640000, unitPerTonProduct: 14.0, variableCostPerTon: 3640000 },
  { id: 'b7', category: '부재료', name: '염산(35%)', unit: 'kg', usageQty: 8000, unitPrice: 190, costAmount: 1520000, unitPerTonProduct: 8.0, variableCostPerTon: 1520000 },
  { id: 'b8', category: '부재료', name: '탄산나트륨(95%)', unit: 'kg', usageQty: 6000, unitPrice: 420, costAmount: 2520000, unitPerTonProduct: 6.0, variableCostPerTon: 2520000 },
  { id: 'b9', category: '부재료', name: 'P507', unit: 'L', usageQty: 400, unitPrice: 12500, costAmount: 5000000, unitPerTonProduct: 0.4, variableCostPerTon: 5000000 },
  { id: 'b10', category: '부재료', name: 'P204', unit: 'L', usageQty: 300, unitPrice: 11000, costAmount: 3300000, unitPerTonProduct: 0.3, variableCostPerTon: 3300000 },
  { id: 'b11', category: '부재료', name: 'C272', unit: 'L', usageQty: 250, unitPrice: 14500, costAmount: 3625000, unitPerTonProduct: 0.25, variableCostPerTon: 3625000 },
  { id: 'b12', category: '부재료', name: 'LIX973', unit: 'L', usageQty: 150, unitPrice: 22000, costAmount: 3300000, unitPerTonProduct: 0.15, variableCostPerTon: 3300000 },
  { id: 'b13', category: '부재료', name: '희석제(D80)', unit: 'L', usageQty: 1200, unitPrice: 2100, costAmount: 2520000, unitPerTonProduct: 1.2, variableCostPerTon: 2520000 },
  { id: 'b14', category: '부재료', name: '인제거제', unit: 'kg', usageQty: 500, unitPrice: 3800, costAmount: 1900000, unitPerTonProduct: 0.5, variableCostPerTon: 1900000 },
  { id: 'b15', category: '부재료', name: '불소제거제', unit: 'kg', usageQty: 450, unitPrice: 4200, costAmount: 1890000, unitPerTonProduct: 0.45, variableCostPerTon: 1890000 },
  { id: 'b16', category: '부재료', name: '활성탄', unit: 'kg', usageQty: 800, unitPrice: 3100, costAmount: 2480000, unitPerTonProduct: 0.8, variableCostPerTon: 2480000 },
  { id: 'b17', category: '부재료', name: '액화산소', unit: 'kg', usageQty: 15000, unitPrice: 150, costAmount: 2250000, unitPerTonProduct: 15.0, variableCostPerTon: 2250000 },
  { id: 'b18', category: '부재료', name: '아교', unit: 'kg', usageQty: 100, unitPrice: 8500, costAmount: 850000, unitPerTonProduct: 0.1, variableCostPerTon: 850000 },
  
  // 조업재료
  { id: 'b19', category: '조업재료', name: '티오황산나트륨', unit: 'kg', usageQty: 2500, unitPrice: 880, costAmount: 2200000, unitPerTonProduct: 2.5, variableCostPerTon: 2200000 },
  
  // 유틸리티
  { id: 'b20', category: '유틸리티', name: 'LNG', unit: 'Nm3', usageQty: 15000, unitPrice: 1100, costAmount: 16500000, unitPerTonProduct: 15.0, variableCostPerTon: 16500000 },
  { id: 'b21', category: '유틸리티', name: '전기', unit: 'kWh', usageQty: 120000, unitPrice: 140, costAmount: 16800000, unitPerTonProduct: 120.0, variableCostPerTon: 16800000 },
  { id: 'b22', category: '유틸리티', name: '용수', unit: 't', usageQty: 4000, unitPrice: 950, costAmount: 3800000, unitPerTonProduct: 4.0, variableCostPerTon: 3800000 }
];

export const DEFAULT_RAW_MATERIAL_LINES: BlendMaterialLine[] = [
  {
    id: 'm1',
    selected: true,
    rawItemCode: 'BLCOWE-USA-RWD',
    rawItemName: 'BLCOWE-USA-RWD (LCO 슬러지)',
    materialGroup: 'LCO',
    ledgerUnitPrice: 14.5, // 14.5 million KRW / ton
    priceType: 'ISSUE',
    quantityTon: 80,
    niPct: 18.5,
    coPct: 22.0,
    lcPct: 6.2,
    mnPct: 1.2,
    cuPct: 0.3,
    alPct: 0.8,
    fePct: 0.5,
    moisturePct: 8.5
  },
  {
    id: 'm2',
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
    cuPct: 0.5,
    alPct: 0.3,
    fePct: 0.2,
    moisturePct: 12.0
  },
  {
    id: 'm3',
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
    cuPct: 1.1,
    alPct: 0.6,
    fePct: 0.4,
    moisturePct: 15.5
  },
  {
    id: 'm4',
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
    cuPct: 0.8,
    alPct: 0.5,
    fePct: 0.3,
    moisturePct: 5.0
  }
];

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
    const currentMonth = 7;

    const s1: BlendScenario = {
      id: 'sc_1',
      name: 'Scenario 1',
      year: currentYear,
      month: currentMonth,
      priceBasis: 'ISSUE',
      exchangeRate: 1350,
      rawMaterialLines: DEFAULT_RAW_MATERIAL_LINES,
      metalAssumptions: DEFAULT_METAL_ASSUMPTIONS,
      bomSnapshot: {
        id: 'bom_snap_s1',
        name: 'Scenario 1 BOM',
        items: DEFAULT_BOM_ITEMS,
        updatedAt: now
      },
      nclTargetPct: 35.0,
      createdAt: now,
      updatedAt: now
    };

    const s2: BlendScenario = JSON.parse(JSON.stringify(s1));
    s2.id = 'sc_2';
    s2.name = 'Scenario 2';

    return [s1, s2];
  },

  getBomMasters(): BomSnapshot[] {
    const raw = localStorage.getItem(BOM_MASTERS_KEY);
    if (!raw) {
      const defaultMaster: BomSnapshot = {
        id: 'bom_master_default',
        name: '2026년 7월 표준 BOM',
        items: DEFAULT_BOM_ITEMS,
        updatedAt: new Date().toISOString()
      };
      this.saveBomMasters([defaultMaster]);
      return [defaultMaster];
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
    cloned.id = 'sc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    cloned.name = newName || `${sourceScenario.name} (복사본)`;
    cloned.createdAt = now;
    cloned.updatedAt = now;
    cloned.isDirty = false;
    return cloned;
  }
};
