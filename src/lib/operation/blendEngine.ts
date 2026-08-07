import { BlendScenario, BlendMaterialLine, MetalAssumption, BomItem } from './blendStorage';
import { PERFORMANCE_CAPACITY_TON } from './blendPolicy';
import { convertMetalToProductTon } from './productConversionPolicy';
import { parseBomMatrixPasteText, BomMatrixParseResult } from './bomMatrixParser';

export interface MetalResult {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  metalName: string;
  avgPct: number;
  inputMetalTon: number;
  recoveryRatePct: number;
  recoveredMetalTon: number;
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
}

export interface ComputedBomItemResult {
  id: string;
  category: '원재료' | '부재료' | '조업재료' | '유틸리티';
  itemName: string;
  unit: string;
  coefficients: {
    NI?: number;
    CO?: number;
    LC?: number;
    MN?: number;
    CU?: number;
  };
  unitPrice: number;
  usageQty: number;
  costAmount: number;
  unitPerTonProduct: number;
  variableCostPerTon: number;
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
  
  nclPct: number; // Sum of Ni% + Co% + LC%
  nclMetalTon: number; // Sum of Ni + Co + Li metal input in tons
  performanceCapacityTon: number; // Default 346 tons
  capacityUtilizationPct: number; // (nclMetalTon / 346) * 100
  
  metalResults: MetalResult[];
  
  // Finished Product Production Volume (e.g. Carbonate Lithium, Sulphates)
  totalProductionTon: number;
  productionByMetal: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', number>;
  
  // Computed BOM details
  computedBomItems: ComputedBomItemResult[];
  
  // Economics (KRW & USD)
  totalRawMaterialCostKrw: number;
  rawMaterialCostPerTonProduct: number;
  
  totalBomCostKrw: number;
  bomCostPerTonProduct: number;
  
  totalVariableCostKrw: number; // Raw Material + BOM Variable Cost
  variableCostPerTonProduct: number;
  
  totalRevenueKrw: number;
  totalRevenueUsd: number;
  revenuePerTonProduct: number;
  
  // Legacy alias for compatibility
  totalManufacturingCostKrw: number;
  manufacturingCostPerTonProduct: number;
  
  // Contribution Margin / Mill Margin
  expectedContributionMarginKrw: number;
  expectedContributionMarginUsd: number;
  millMarginPerTonProduct: number;
  contributionMarginRatioPct: number;
  
  // Legacy aliases
  expectedMarginKrw: number;
  expectedMarginUsd: number;
  marginPerTonProduct: number;
  marginRatioPct: number;
}

export function calculateBlendResult(scenario: BlendScenario): BlendCalculationResult {
  const selectedLines = (scenario.rawMaterialLines || []).filter(l => l.selected && l.quantityTon > 0);
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

  // NCL grade sum and Capacity Utilization
  const nclPct = avgNiPct + avgCoPct + avgLcPct;
  const nclMetalTon = totalInputTon * (nclPct / 100);
  const performanceCapacityTon = PERFORMANCE_CAPACITY_TON;
  const capacityUtilizationPct = performanceCapacityTon > 0 ? (nclMetalTon / performanceCapacityTon) * 100 : 0;

  // Calculate Raw Material Costs
  let totalRawMaterialCostKrw = 0;
  selectedLines.forEach(l => {
    const unitPriceMillionKrw = l.priceType === 'CUSTOM' ? (l.customUnitPrice ?? l.ledgerUnitPrice) : l.ledgerUnitPrice;
    const unitPriceKrw = (unitPriceMillionKrw || 0) * 1_000_000;
    totalRawMaterialCostKrw += l.quantityTon * unitPriceKrw;
  });

  // Calculate Metal Results & Finished Product Production
  const metalMap: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', number> = {
    NI: avgNiPct,
    CO: avgCoPct,
    LC: avgLcPct,
    MN: avgMnPct,
    CU: avgCuPct
  };

  const productionByMetal: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', number> = {
    NI: 0,
    CO: 0,
    LC: 0,
    MN: 0,
    CU: 0
  };

  let totalProductionTon = 0;
  const metalResults: MetalResult[] = [];
  const metalAssumptions = scenario.metalAssumptions || [];

  metalAssumptions.forEach(ass => {
    const avgPct = metalMap[ass.metal] || 0;
    const inputMetalTon = totalInputTon * (avgPct / 100);
    const recoveryRatePct = ass.recoveryRatePct ?? 95.0;
    const recoveredMetalTon = inputMetalTon * (recoveryRatePct / 100);

    // Finished product conversion (e.g. Li metal / 18.75% = Carbonate Lithium ton)
    const expectedProductTon = convertMetalToProductTon(ass.metal, recoveredMetalTon);
    productionByMetal[ass.metal] = expectedProductTon;
    totalProductionTon += expectedProductTon;

    const marketPriceUsd = ass.marketPrice ?? 0;
    let premiumRatePct = ass.premiumRatePct ?? 0;
    let premiumUnitAmountUsd = ass.premiumUnitAmount ?? 0;

    if (ass.premiumMode === 'RATE') {
      premiumUnitAmountUsd = marketPriceUsd * (premiumRatePct / 100);
    } else {
      premiumRatePct = marketPriceUsd > 0 ? (premiumUnitAmountUsd / marketPriceUsd) * 100 : 0;
    }

    const appliedPriceUsd = marketPriceUsd + premiumUnitAmountUsd;
    const totalPremiumEffectUsd = premiumUnitAmountUsd * expectedProductTon;
    const exchangeRate = scenario.exchangeRate ?? 1350;
    const appliedPriceKrw = appliedPriceUsd * exchangeRate;

    const revenueUsd = expectedProductTon * appliedPriceUsd;
    const revenueKrw = revenueUsd * exchangeRate;

    metalResults.push({
      metal: ass.metal,
      metalName: ass.metalName,
      avgPct,
      inputMetalTon,
      recoveryRatePct,
      recoveredMetalTon,
      expectedProductTon,
      marketPriceUsd,
      premiumMode: ass.premiumMode,
      premiumRatePct,
      premiumUnitAmountUsd,
      totalPremiumEffectUsd,
      appliedPriceUsd,
      appliedPriceKrw,
      revenueUsd,
      revenueKrw
    });
  });

  // Calculate BOM Costs from BOM Matrix coefficients & Finished Product Production
  const bomItems = scenario.bomSnapshot?.items || [];
  let totalBomCostKrw = 0;
  const computedBomItems: ComputedBomItemResult[] = [];

  bomItems.forEach(item => {
    const itemName = item.itemName || item.name || 'BOM 품목';
    const coeffs = item.coefficients || {
      NI: (item as any).niTonPerTon,
      CO: (item as any).coTonPerTon,
      LC: (item as any).lcTonPerTon,
      MN: (item as any).mnTonPerTon,
      CU: (item as any).cuTonPerTon
    };

    let computedUsage = 0;
    if (item.usageMode === 'MANUAL' && item.manualUsageQty !== undefined) {
      computedUsage = item.manualUsageQty;
    } else {
      const hasMatrixCoeffs = coeffs.NI != null || coeffs.CO != null || coeffs.LC != null || coeffs.MN != null || coeffs.CU != null;
      if (hasMatrixCoeffs) {
        computedUsage += (productionByMetal.NI * (coeffs.NI ?? 0));
        computedUsage += (productionByMetal.CO * (coeffs.CO ?? 0));
        computedUsage += (productionByMetal.LC * (coeffs.LC ?? 0));
        computedUsage += (productionByMetal.MN * (coeffs.MN ?? 0));
        computedUsage += (productionByMetal.CU * (coeffs.CU ?? 0));
      } else {
        computedUsage = item.usageQty ?? 0;
      }
    }

    const unitPrice = item.unitPrice || 0;
    const costAmount = computedUsage * unitPrice;
    totalBomCostKrw += costAmount;

    const unitPerTonProduct = totalProductionTon > 0 ? computedUsage / totalProductionTon : 0;
    const variableCostPerTon = totalProductionTon > 0 ? costAmount / totalProductionTon : 0;

    computedBomItems.push({
      id: item.id,
      category: item.category,
      itemName,
      unit: item.unit || 'kg',
      coefficients: {
        NI: coeffs.NI,
        CO: coeffs.CO,
        LC: coeffs.LC,
        MN: coeffs.MN,
        CU: coeffs.CU
      },
      unitPrice,
      usageQty: computedUsage,
      costAmount,
      unitPerTonProduct,
      variableCostPerTon
    });
  });

  const rawMaterialCostPerTonProduct = totalProductionTon > 0 ? totalRawMaterialCostKrw / totalProductionTon : 0;
  const bomCostPerTonProduct = totalProductionTon > 0 ? totalBomCostKrw / totalProductionTon : 0;

  const totalRevenueKrw = metalResults.reduce((sum, r) => sum + r.revenueKrw, 0);
  const totalRevenueUsd = (scenario.exchangeRate || 1350) > 0 ? totalRevenueKrw / (scenario.exchangeRate || 1350) : 0;
  const revenuePerTonProduct = totalProductionTon > 0 ? totalRevenueKrw / totalProductionTon : 0;

  const totalVariableCostKrw = totalRawMaterialCostKrw + totalBomCostKrw;
  const variableCostPerTonProduct = totalProductionTon > 0 ? totalVariableCostKrw / totalProductionTon : 0;

  const expectedContributionMarginKrw = totalRevenueKrw - totalVariableCostKrw;
  const expectedContributionMarginUsd = (scenario.exchangeRate || 1350) > 0 ? expectedContributionMarginKrw / (scenario.exchangeRate || 1350) : 0;
  const millMarginPerTonProduct = totalProductionTon > 0 ? expectedContributionMarginKrw / totalProductionTon : 0;
  const contributionMarginRatioPct = totalRevenueKrw > 0 ? (expectedContributionMarginKrw / totalRevenueKrw) * 100 : 0;

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
    nclMetalTon,
    performanceCapacityTon,
    capacityUtilizationPct,
    metalResults,
    totalProductionTon,
    productionByMetal,
    computedBomItems,
    totalRawMaterialCostKrw,
    rawMaterialCostPerTonProduct,
    totalBomCostKrw,
    bomCostPerTonProduct,
    totalVariableCostKrw,
    variableCostPerTonProduct,
    totalRevenueKrw,
    totalRevenueUsd,
    revenuePerTonProduct,
    totalManufacturingCostKrw: totalVariableCostKrw,
    manufacturingCostPerTonProduct: variableCostPerTonProduct,
    expectedContributionMarginKrw,
    expectedContributionMarginUsd,
    millMarginPerTonProduct,
    contributionMarginRatioPct,
    // Legacy aliases
    expectedMarginKrw: expectedContributionMarginKrw,
    expectedMarginUsd: expectedContributionMarginUsd,
    marginPerTonProduct: millMarginPerTonProduct,
    marginRatioPct: contributionMarginRatioPct
  };
}

export function parseBomPasteText(rawText: string): { validCount: number; warningCount: number; items: BomItem[]; warnings: string[] } {
  const parsed = parseBomMatrixPasteText(rawText);
  const items: BomItem[] = parsed.items.map(m => ({
    id: m.id,
    category: m.category,
    name: m.itemName,
    itemName: m.itemName,
    unit: m.unit,
    coefficients: m.coefficients,
    unitPrice: m.unitPrice
  }));

  return {
    validCount: parsed.validCount,
    warningCount: parsed.warningCount,
    items,
    warnings: parsed.warnings
  };
}

