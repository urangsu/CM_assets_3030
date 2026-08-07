import { BlendScenario, BlendMaterialLine, MetalAssumption, BomItem } from './blendStorage';

export interface MetalResult {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  metalName: string;
  avgPct: number;
  inputMetalTon: number;
  recoveryRatePct: number;
  expectedProductTon: number;
  marketPriceUsd: number;
  premiumMode: 'RATE' | 'UNIT_AMOUNT';
  premiumRatePct: number;
  premiumUnitAmountUsd: number;
  totalPremiumEffectUsd: number;
  appliedPriceUsd: number;
  appliedPriceKrw: number;
  revenueUsd: number;
  revenueKrw: number;
  targetMinPct?: number;
  targetMaxPct?: number;
  passStatus: 'PASS' | 'FAIL' | 'WARN' | 'NONE';
}

export interface BlendCalculationResult {
  totalInputTon: number;
  groupInputTons: {
    BP: number;
    BM: number;
    WET: number;
    LCO: number;
    MN: number;
    기타: number;
  };
  
  // Weighted Average Compositions (%)
  avgNiPct: number;
  avgCoPct: number;
  avgLcPct: number;
  avgMnPct: number;
  avgCuPct: number;
  
  avgAlPct: number;
  avgFePct: number;
  avgFPct: number;
  avgPPct: number;
  avgMgPct: number;
  avgCaPct: number;
  avgKPct: number;
  avgPbPct: number;
  avgDcPct: number;
  avgMoisturePct: number;
  
  nclPct: number;
  nclPassStatus: 'PASS' | 'FAIL';
  
  metalResults: MetalResult[];
  
  // Production Volume
  totalProductionTon: number; // Sum of recovered metal products
  
  // Economics (KRW & USD)
  totalRawMaterialCostKrw: number;
  rawMaterialCostPerTonProduct: number;
  
  totalBomCostKrw: number;
  bomCostPerTonProduct: number;
  
  totalRevenueKrw: number;
  totalRevenueUsd: number;
  revenuePerTonProduct: number;
  
  totalManufacturingCostKrw: number;
  manufacturingCostPerTonProduct: number;
  
  expectedMarginKrw: number;
  expectedMarginUsd: number;
  marginPerTonProduct: number;
  marginRatioPct: number;
}

export function calculateBlendResult(scenario: BlendScenario): BlendCalculationResult {
  const selectedLines = scenario.rawMaterialLines.filter(l => l.selected && l.quantityTon > 0);
  const totalInputTon = selectedLines.reduce((sum, l) => sum + l.quantityTon, 0);

  // Group quantities
  const groupInputTons = {
    BP: 0,
    BM: 0,
    WET: 0,
    LCO: 0,
    MN: 0,
    기타: 0
  };

  selectedLines.forEach(l => {
    const grp = l.materialGroup || '기타';
    groupInputTons[grp] = (groupInputTons[grp] || 0) + l.quantityTon;
  });

  // Calculate Weighted Averages for compositions
  const calcAvgPct = (getField: (l: BlendMaterialLine) => number | undefined): number => {
    if (totalInputTon === 0) return 0;
    const weightedSum = selectedLines.reduce((sum, l) => {
      const val = getField(l) || 0;
      return sum + l.quantityTon * val;
    }, 0);
    return weightedSum / totalInputTon;
  };

  const avgNiPct = calcAvgPct(l => l.niPct);
  const avgCoPct = calcAvgPct(l => l.coPct);
  const avgLcPct = calcAvgPct(l => l.lcPct);
  const avgMnPct = calcAvgPct(l => l.mnPct);
  const avgCuPct = calcAvgPct(l => l.cuPct);

  const avgAlPct = calcAvgPct(l => l.alPct);
  const avgFePct = calcAvgPct(l => l.fePct);
  const avgFPct = calcAvgPct(l => l.fPct);
  const avgPPct = calcAvgPct(l => l.pPct);
  const avgMgPct = calcAvgPct(l => l.mgPct);
  const avgCaPct = calcAvgPct(l => l.caPct);
  const avgKPct = calcAvgPct(l => l.kPct);
  const avgPbPct = calcAvgPct(l => l.pbPct);
  const avgDcPct = calcAvgPct(l => l.dcPct);
  const avgMoisturePct = calcAvgPct(l => l.moisturePct);

  const nclPct = avgNiPct + avgCoPct + avgLcPct;
  const nclPassStatus: 'PASS' | 'FAIL' = nclPct >= (scenario.nclTargetPct || 35.0) ? 'PASS' : 'FAIL';

  // Calculate Raw Material Costs
  let totalRawMaterialCostKrw = 0;
  selectedLines.forEach(l => {
    const unitPriceMillionKrw = l.priceType === 'CUSTOM' ? (l.customUnitPrice ?? l.ledgerUnitPrice) : l.ledgerUnitPrice;
    const unitPriceKrw = unitPriceMillionKrw * 1_000_000;
    totalRawMaterialCostKrw += l.quantityTon * unitPriceKrw;
  });

  // Calculate Metal Results & Expected Production Volume
  const metalMap: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', number> = {
    NI: avgNiPct,
    CO: avgCoPct,
    LC: avgLcPct,
    MN: avgMnPct,
    CU: avgCuPct
  };

  let totalProductionTon = 0;
  const metalResults: MetalResult[] = [];

  const metalAssumptions = scenario.metalAssumptions || [];

  metalAssumptions.forEach(ass => {
    const avgPct = metalMap[ass.metal] || 0;
    const inputMetalTon = totalInputTon * (avgPct / 100);
    const recoveryRatePct = ass.recoveryRatePct || 95.0;
    const expectedProductTon = inputMetalTon * (recoveryRatePct / 100);

    totalProductionTon += expectedProductTon;

    const marketPriceUsd = ass.marketPrice || 0;
    let premiumRatePct = ass.premiumRatePct || 0;
    let premiumUnitAmountUsd = ass.premiumUnitAmount || 0;

    if (ass.premiumMode === 'RATE') {
      premiumUnitAmountUsd = marketPriceUsd * (premiumRatePct / 100);
    } else {
      premiumRatePct = marketPriceUsd > 0 ? (premiumUnitAmountUsd / marketPriceUsd) * 100 : 0;
    }

    const appliedPriceUsd = marketPriceUsd + premiumUnitAmountUsd;
    const totalPremiumEffectUsd = premiumUnitAmountUsd * expectedProductTon;
    const appliedPriceKrw = appliedPriceUsd * (scenario.exchangeRate || 1350);

    const revenueUsd = expectedProductTon * appliedPriceUsd;
    const revenueKrw = revenueUsd * (scenario.exchangeRate || 1350);

    // Pass Status
    let passStatus: 'PASS' | 'FAIL' | 'WARN' | 'NONE' = 'NONE';
    if (ass.targetMinPct !== undefined || ass.targetMaxPct !== undefined) {
      const min = ass.targetMinPct ?? 0;
      const max = ass.targetMaxPct ?? 100;
      if (avgPct >= min && avgPct <= max) {
        passStatus = 'PASS';
      } else if (Math.abs(avgPct - min) <= 0.5 || Math.abs(avgPct - max) <= 0.5) {
        passStatus = 'WARN';
      } else {
        passStatus = 'FAIL';
      }
    }

    metalResults.push({
      metal: ass.metal,
      metalName: ass.metalName,
      avgPct,
      inputMetalTon,
      recoveryRatePct,
      expectedProductTon,
      marketPriceUsd,
      premiumMode: ass.premiumMode,
      premiumRatePct,
      premiumUnitAmountUsd,
      totalPremiumEffectUsd,
      appliedPriceUsd,
      appliedPriceKrw,
      revenueUsd,
      revenueKrw,
      targetMinPct: ass.targetMinPct,
      targetMaxPct: ass.targetMaxPct,
      passStatus
    });
  });

  // Calculate BOM Costs
  const bomItems = scenario.bomSnapshot?.items || [];
  let totalBomCostKrw = 0;

  bomItems.forEach(item => {
    const itemCost = item.usageQty * item.unitPrice;
    totalBomCostKrw += itemCost;
  });

  const rawMaterialCostPerTonProduct = totalProductionTon > 0 ? totalRawMaterialCostKrw / totalProductionTon : 0;
  const bomCostPerTonProduct = totalProductionTon > 0 ? totalBomCostKrw / totalProductionTon : 0;

  const totalRevenueKrw = metalResults.reduce((sum, r) => sum + r.revenueKrw, 0);
  const totalRevenueUsd = scenario.exchangeRate > 0 ? totalRevenueKrw / scenario.exchangeRate : 0;
  const revenuePerTonProduct = totalProductionTon > 0 ? totalRevenueKrw / totalProductionTon : 0;

  const totalManufacturingCostKrw = totalRawMaterialCostKrw + totalBomCostKrw;
  const manufacturingCostPerTonProduct = totalProductionTon > 0 ? totalManufacturingCostKrw / totalProductionTon : 0;

  const expectedMarginKrw = totalRevenueKrw - totalManufacturingCostKrw;
  const expectedMarginUsd = scenario.exchangeRate > 0 ? expectedMarginKrw / scenario.exchangeRate : 0;
  const marginPerTonProduct = totalProductionTon > 0 ? expectedMarginKrw / totalProductionTon : 0;
  const marginRatioPct = totalRevenueKrw > 0 ? (expectedMarginKrw / totalRevenueKrw) * 100 : 0;

  return {
    totalInputTon,
    groupInputTons,
    avgNiPct,
    avgCoPct,
    avgLcPct,
    avgMnPct,
    avgCuPct,
    avgAlPct,
    avgFePct,
    avgFPct,
    avgPPct,
    avgMgPct,
    avgCaPct,
    avgKPct,
    avgPbPct,
    avgDcPct,
    avgMoisturePct,
    nclPct,
    nclPassStatus,
    metalResults,
    totalProductionTon,
    totalRawMaterialCostKrw,
    rawMaterialCostPerTonProduct,
    totalBomCostKrw,
    bomCostPerTonProduct,
    totalRevenueKrw,
    totalRevenueUsd,
    revenuePerTonProduct,
    totalManufacturingCostKrw,
    manufacturingCostPerTonProduct,
    expectedMarginKrw,
    expectedMarginUsd,
    marginPerTonProduct,
    marginRatioPct
  };
}

export interface BomParseResult {
  validCount: number;
  warningCount: number;
  items: BomItem[];
  warnings: string[];
}

export function parseBomPasteText(rawText: string): BomParseResult {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const items: BomItem[] = [];
  const warnings: string[] = [];

  let validCount = 0;
  let warningCount = 0;

  lines.forEach((line, index) => {
    // Skip header lines
    const lower = line.toLowerCase();
    if (lower.includes('구분') && (lower.includes('부원료') || lower.includes('품목') || lower.includes('단가'))) {
      return;
    }

    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < 2) return;

    let category: '원재료' | '부재료' | '조업재료' | '유틸리티' = '부재료';
    const catStr = cols[0];
    if (catStr.includes('원재료')) category = '원재료';
    else if (catStr.includes('조업')) category = '조업재료';
    else if (catStr.includes('유틸리티')) category = '유틸리티';
    else category = '부재료';

    const name = cols[1] || `BOM 품목 ${index + 1}`;
    const unit = cols[2] || 'kg';

    const usageQtyNum = Number(String(cols[3] || '0').replace(/,/g, ''));
    const unitPriceNum = Number(String(cols[4] || '0').replace(/,/g, ''));

    if (isNaN(usageQtyNum) || isNaN(unitPriceNum)) {
      warningCount++;
      warnings.push(`행 ${index + 1} (${name}): 숫자 형식 오류`);
    } else {
      validCount++;
    }

    const usageQty = isNaN(usageQtyNum) ? 0 : usageQtyNum;
    const unitPrice = isNaN(unitPriceNum) ? 0 : unitPriceNum;
    const costAmount = usageQty * unitPrice;

    items.push({
      id: 'bom_p_' + Math.random().toString(36).substring(2, 8),
      category,
      name,
      unit,
      usageQty,
      unitPrice,
      costAmount,
      unitPerTonProduct: 0,
      variableCostPerTon: costAmount
    });
  });

  return {
    validCount,
    warningCount,
    items,
    warnings
  };
}
