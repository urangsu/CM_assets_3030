import React from 'react';
import { BlendScenario, BlendMaterialLine } from '../../lib/operation/blendStorage';
import { BlendCalculationResult } from '../../lib/operation/blendEngine';
import { OperationStorage } from '../../lib/operation/operationStorage';
import { RawMaterialAssayStorage } from '../../lib/operation/rawMaterialAssayStorage';
import { toTon, toMillionKrwPerTon, formatTonDisplay } from '../../lib/operation/blendUnitConversion';
import { MaterialGroupAccordion } from './MaterialGroupAccordion';
import { CompositionSummary } from './CompositionSummary';
import { RefreshCw, Plus, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
  onChangeScenario: (updated: BlendScenario) => void;
}

export const BlendMaterialSheet: React.FC<Props> = ({ scenario, calculation, onChangeScenario }) => {
  // Sync / Load lines from Raw Material Ledger + Assay
  const handleLoadFromLedger = () => {
    const records = OperationStorage.getRawMaterialRecords(scenario.year);
    const monthRecords = records.filter(r => Number(r.month) === Number(scenario.month));

    if (monthRecords.length === 0) {
      alert(`${scenario.year}년 ${scenario.month}월 원자재 수불부 데이터가 없습니다. 먼저 원자재 수불부를 등록하세요.`);
      return;
    }

    const newLines: BlendMaterialLine[] = monthRecords.map((r, idx) => {
      const issuePrice = toMillionKrwPerTon(r.processIssueUnitPrice || 0);
      const endingPrice = toMillionKrwPerTon(r.endingUnitPrice || 0);
      const purchasePrice = toMillionKrwPerTon(r.purchaseUnitPrice || 0);

      let priceKg = r.processIssueUnitPrice || r.purchaseUnitPrice || r.endingUnitPrice || 0;
      let qtyKg = r.processIssueQty || 0;

      if (scenario.priceBasis === 'ENDING') {
        priceKg = r.endingUnitPrice || priceKg;
        qtyKg = r.endingQty || qtyKg;
      } else if (scenario.priceBasis === 'PURCHASE') {
        priceKg = r.purchaseUnitPrice || priceKg;
        qtyKg = r.purchaseQty || qtyKg;
      }

      const quantityTon = toTon(qtyKg);
      const ledgerUnitPrice = toMillionKrwPerTon(priceKg);
      const realName = r.rawItemName || r.amountRowLabel || r.rawItemCode;

      // Fetch Assay Data
      const assay = RawMaterialAssayStorage.getAssay(scenario.year, Number(scenario.month), r.rawItemCode);

      return {
        id: `m_ledger_${r.id}_${idx}`,
        selected: true,
        rawItemCode: r.rawItemCode,
        rawItemName: realName,
        materialGroup: (r.materialGroup as any) || '기타',
        ledgerUnitPrice,
        ledgerPriceMonth: Number(r.month),
        ledgerPrices: {
          issue: issuePrice,
          ending: endingPrice,
          purchase: purchasePrice
        },
        priceType: 'ISSUE',
        quantityTon,
        niPct: assay?.majorMetals.niPct,
        coPct: assay?.majorMetals.coPct,
        lcPct: assay?.majorMetals.lcPct,
        mnPct: assay?.majorMetals.mnPct,
        cuPct: assay?.majorMetals.cuPct,
        alPct: assay?.impurities.alPct,
        fePct: assay?.impurities.fePct,
        fPct: assay?.impurities.fPct,
        pPct: assay?.impurities.pPct,
        mgPct: assay?.impurities.mgPct,
        caPct: assay?.impurities.caPct,
        kPct: assay?.impurities.kPct,
        pbPct: assay?.impurities.pbPct,
        dcPct: assay?.impurities.dcPct,
        moisturePct: assay?.impurities.moisturePct,
        hasAssay: !!assay && (assay.majorMetals.niPct !== undefined || assay.majorMetals.coPct !== undefined),
        assayUpdatedAt: assay?.updatedAt
      };
    });

    onChangeScenario({
      ...scenario,
      ledgerSource: {
        year: scenario.year,
        month: Number(scenario.month),
        loadedAt: new Date().toISOString()
      },
      rawMaterialLines: newLines,
      isDirty: true
    });
  };

  const handleUpdateLine = (id: string, updates: Partial<BlendMaterialLine>) => {
    const updatedLines = (scenario.rawMaterialLines || []).map(l => {
      if (l.id === id) {
        return { ...l, ...updates };
      }
      return l;
    });
    onChangeScenario({
      ...scenario,
      rawMaterialLines: updatedLines,
      isDirty: true
    });
  };

  const handleSelectAllGroup = (groupName: string, selected: boolean) => {
    const updatedLines = (scenario.rawMaterialLines || []).map(l => {
      if ((l.materialGroup || '기타') === groupName) {
        return { ...l, selected };
      }
      return l;
    });
    onChangeScenario({
      ...scenario,
      rawMaterialLines: updatedLines,
      isDirty: true
    });
  };

  const handleAddCustomLine = () => {
    const newLine: BlendMaterialLine = {
      id: 'm_custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      selected: true,
      rawItemCode: 'CUSTOM-ITEM',
      rawItemName: '신규 투입 원료',
      materialGroup: 'BM',
      ledgerUnitPrice: 8.0,
      priceType: 'CUSTOM',
      customUnitPrice: 8.0,
      quantityTon: 10,
      niPct: undefined,
      coPct: undefined,
      lcPct: undefined,
      mnPct: undefined,
      cuPct: undefined
    };
    onChangeScenario({
      ...scenario,
      rawMaterialLines: [...(scenario.rawMaterialLines || []), newLine],
      isDirty: true
    });
  };

  const hasUnenteredCompositions = (scenario.rawMaterialLines || []).some(
    l => l.selected && l.quantityTon > 0 && (l.niPct === undefined || l.coPct === undefined || l.lcPct === undefined)
  );

  const isStaleSourceMonth = scenario.ledgerSource && Number(scenario.ledgerSource.month) !== Number(scenario.month);

  return (
    <div className="space-y-6">
      {/* Stale Source Month Warning Banner */}
      {isStaleSourceMonth && (
        <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>⚠ 수불부 출처 불일치:</strong> 현재 시나리오 원료는 <strong>{scenario.ledgerSource?.month}월</strong> 수불부 기준입니다. (적용년월: {scenario.month}월)
            </span>
          </div>
          <button
            type="button"
            onClick={handleLoadFromLedger}
            className="px-3 py-1 bg-amber-600 text-white font-bold rounded hover:bg-amber-700 transition"
          >
            {scenario.month}월 수불부로 갱신
          </button>
        </div>
      )}

      {/* Missing Composition Warning Banner */}
      {hasUnenteredCompositions && (
        <div className="bg-rose-50 border border-rose-300 p-3 rounded-lg flex items-center gap-2 text-rose-900 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>⚠ 성분이 입력되지 않은 원료가 선택되어 있습니다. 원자재 수불 현황 화면에서 성분을 등록한 뒤 갱신하십시오.</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900">원료 배합 설정</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {scenario.year}년 {scenario.month}월 원자재 수불부 연동 데이터
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadFromLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            원자재 수불부 연동
          </button>
          <button
            type="button"
            onClick={handleAddCustomLine}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            원료 직접 추가
          </button>
        </div>
      </div>

      {/* Accordion Group Table */}
      <MaterialGroupAccordion
        lines={scenario.rawMaterialLines || []}
        onLineChange={handleUpdateLine}
        onSelectAllGroup={handleSelectAllGroup}
      />

      {/* Composition Evaluation Range Bars */}
      <CompositionSummary
        avgNiPct={calculation.avgNiPct}
        avgCoPct={calculation.avgCoPct}
        avgLcPct={calculation.avgLcPct}
        avgMnPct={calculation.avgMnPct}
        avgCuPct={calculation.avgCuPct}
        hasUnenteredCompositions={hasUnenteredCompositions}
      />

      {/* Overall Summary KPI Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-emerald-50/60 rounded-lg border border-emerald-100 text-sm">
        <div>
          <span className="text-xs text-slate-500 block">총 원료 투입량</span>
          <span className="text-lg font-bold text-emerald-900">{formatTonDisplay(calculation.totalInputTon)}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">성능가동률 (NCL / 346t)</span>
          <span className="text-lg font-bold text-slate-800">{calculation.capacityUtilizationPct.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">NCL 합산 품위</span>
          <span className="text-lg font-bold text-slate-800">{calculation.nclPct.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">평균 수분</span>
          <span className="text-lg font-bold text-slate-800">{calculation.avgMoisturePct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
