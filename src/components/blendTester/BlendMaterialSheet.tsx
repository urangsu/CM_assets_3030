import React, { useState } from 'react';
import { BlendScenario, BlendMaterialLine } from '../../lib/operation/blendStorage';
import { BlendCalculationResult } from '../../lib/operation/blendEngine';
import { OperationStorage } from '../../lib/operation/operationStorage';
import { ChevronDown, ChevronRight, RefreshCw, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
  onChangeScenario: (updated: BlendScenario) => void;
}

export const BlendMaterialSheet: React.FC<Props> = ({ scenario, calculation, onChangeScenario }) => {
  const [showMinorMetals, setShowMinorMetals] = useState<boolean>(false);

  // Sync / Load lines from Raw Material Ledger
  const handleLoadFromLedger = () => {
    const records = OperationStorage.getRawMaterialRecords(scenario.year);
    const monthRecords = records.filter(r => Number(r.month) === Number(scenario.month));

    if (monthRecords.length === 0) {
      alert(`${scenario.year}년 ${scenario.month}월 원자재 수불부 데이터가 없습니다. 먼저 수불부를 등록하세요.`);
      return;
    }

    const newLines: BlendMaterialLine[] = monthRecords.map((r, idx) => {
      // Find matching unit price based on price basis
      let price = r.processIssueUnitPrice || r.purchaseUnitPrice || r.endingUnitPrice || 0;
      if (scenario.priceBasis === 'ENDING') price = r.endingUnitPrice || price;
      if (scenario.priceBasis === 'PURCHASE') price = r.purchaseUnitPrice || price;

      // Price in million KRW / ton
      const priceMillion = price > 1000 ? price / 1_000_000 : price;

      return {
        id: `m_ledger_${r.id}_${idx}`,
        selected: true,
        rawItemCode: r.rawItemCode,
        rawItemName: `${r.rawItemCode} (${r.materialGroup || '원료'})`,
        materialGroup: r.materialGroup || '기타',
        ledgerUnitPrice: priceMillion,
        ledgerPriceMonth: Number(r.month),
        priceType: 'ISSUE',
        quantityTon: r.processIssueQty > 0 ? r.processIssueQty : 50,
        niPct: r.materialGroup === 'BP' ? 32.0 : r.materialGroup === 'LCO' ? 18.0 : 21.0,
        coPct: r.materialGroup === 'LCO' ? 22.0 : r.materialGroup === 'BP' ? 4.0 : 7.0,
        lcPct: r.materialGroup === 'LCO' ? 6.0 : 4.0,
        mnPct: r.materialGroup === 'MN' ? 40.0 : 7.0,
        cuPct: 0.8,
        alPct: 0.5,
        fePct: 0.3,
        moisturePct: r.materialGroup === 'WET' ? 15.0 : 8.0
      };
    });

    onChangeScenario({
      ...scenario,
      rawMaterialLines: newLines,
      isDirty: true
    });
  };

  const handleUpdateLine = (id: string, updates: Partial<BlendMaterialLine>) => {
    const updatedLines = scenario.rawMaterialLines.map(l => {
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

  const handleToggleSelectAll = (checked: boolean) => {
    const updatedLines = scenario.rawMaterialLines.map(l => ({ ...l, selected: checked }));
    onChangeScenario({
      ...scenario,
      rawMaterialLines: updatedLines,
      isDirty: true
    });
  };

  const handleAddCustomLine = () => {
    const newLine: BlendMaterialLine = {
      id: 'm_custom_' + Math.random().toString(36).substring(2, 8),
      selected: true,
      rawItemCode: 'NEW-MATERIAL',
      rawItemName: '신규 임시 원료',
      materialGroup: 'BM',
      ledgerUnitPrice: 8.0,
      priceType: 'CUSTOM',
      customUnitPrice: 8.0,
      quantityTon: 10,
      niPct: 20.0,
      coPct: 5.0,
      lcPct: 4.0,
      mnPct: 5.0,
      cuPct: 0.5
    };
    onChangeScenario({
      ...scenario,
      rawMaterialLines: [...scenario.rawMaterialLines, newLine],
      isDirty: true
    });
  };

  const handleDeleteLine = (id: string) => {
    const updatedLines = scenario.rawMaterialLines.filter(l => l.id !== id);
    onChangeScenario({
      ...scenario,
      rawMaterialLines: updatedLines,
      isDirty: true
    });
  };

  const allSelected = scenario.rawMaterialLines.length > 0 && scenario.rawMaterialLines.every(l => l.selected);

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold text-zinc-700">단가 적용 기준:</span>
          <div className="flex items-center gap-3">
            {[
              { id: 'ISSUE', label: '공정불출단가 (추천)' },
              { id: 'ENDING', label: '기말재고단가' },
              { id: 'PURCHASE', label: '구매단가' }
            ].map(b => (
              <label key={b.id} className="flex items-center gap-1.5 cursor-pointer font-medium text-zinc-800">
                <input
                  type="radio"
                  name="priceBasis"
                  checked={scenario.priceBasis === b.id}
                  onChange={() => onChangeScenario({ ...scenario, priceBasis: b.id as any, isDirty: true })}
                  className="accent-teal-600"
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadFromLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 rounded font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>원자재 수불부 연동 ({scenario.year}년 {scenario.month}월)</span>
          </button>

          <button
            onClick={() => setShowMinorMetals(!showMinorMetals)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded font-medium transition-colors"
          >
            {showMinorMetals ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{showMinorMetals ? '기타금속 접기' : '기타금속 펼치기 (Al,Fe,F,P...)'}</span>
          </button>

          <button
            onClick={handleAddCustomLine}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#00786F] hover:bg-[#005f58] text-white rounded font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>원료 행 추가</span>
          </button>
        </div>
      </div>

      {/* Main Table: Compact Table with Sticky Columns */}
      <div className="relative overflow-x-auto border border-zinc-250 rounded-lg shadow-xs bg-white max-h-[520px]">
        <table className="w-full text-[11px] text-left border-collapse font-sans min-w-[1200px]">
          <thead className="sticky top-0 z-20 bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300">
            <tr>
              <th className="p-2 w-10 text-center sticky left-0 z-30 bg-zinc-100 border-r border-zinc-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="rounded accent-teal-600"
                />
              </th>
              <th className="p-2 w-28 sticky left-10 z-30 bg-zinc-100 border-r border-zinc-200">원료코드</th>
              <th className="p-2 w-44 sticky left-38 z-30 bg-zinc-100 border-r border-zinc-200 shadow-sm">원료명</th>
              <th className="p-2 w-16 text-center border-r border-zinc-200">분류</th>
              <th className="p-2 w-24 text-right border-r border-zinc-200 bg-teal-50/70 text-teal-900">
                투입량 (t)
              </th>
              <th className="p-2 w-28 text-right border-r border-zinc-200">
                적용단가 (백만원/t)
              </th>
              <th className="p-2 w-20 text-center border-r border-zinc-200">단가출처</th>
              
              {/* Metal % Header */}
              <th className="p-2 w-16 text-right border-r border-zinc-200 text-blue-900 bg-blue-50/50">Ni (%)</th>
              <th className="p-2 w-16 text-right border-r border-zinc-200 text-indigo-900 bg-indigo-50/50">Co (%)</th>
              <th className="p-2 w-16 text-right border-r border-zinc-200 text-emerald-900 bg-emerald-50/50">LC (%)</th>
              <th className="p-2 w-16 text-right border-r border-zinc-200 text-amber-900 bg-amber-50/50">Mn (%)</th>
              <th className="p-2 w-16 text-right border-r border-zinc-200 text-orange-900 bg-orange-50/50">Cu (%)</th>

              {showMinorMetals && (
                <>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">Al (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">Fe (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">F (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">P (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">Mg (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">Ca (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">K (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">Pb (%)</th>
                  <th className="p-2 w-14 text-right border-r border-zinc-200 text-zinc-600">DC (%)</th>
                  <th className="p-2 w-16 text-right border-r border-zinc-200 text-purple-900 bg-purple-50/50">수분 (%)</th>
                </>
              )}

              <th className="p-2 w-12 text-center">삭제</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {scenario.rawMaterialLines.map((line) => {
              const effectivePrice = line.priceType === 'CUSTOM' ? (line.customUnitPrice ?? line.ledgerUnitPrice) : line.ledgerUnitPrice;

              return (
                <tr key={line.id} className={`hover:bg-zinc-50/80 ${!line.selected ? 'opacity-40 bg-zinc-50' : ''}`}>
                  <td className="p-2 text-center sticky left-0 z-10 bg-white border-r border-zinc-200">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={(e) => handleUpdateLine(line.id, { selected: e.target.checked })}
                      className="rounded accent-teal-600"
                    />
                  </td>
                  <td className="p-1.5 font-mono font-medium sticky left-10 z-10 bg-white border-r border-zinc-200">
                    <input
                      type="text"
                      value={line.rawItemCode}
                      onChange={(e) => handleUpdateLine(line.id, { rawItemCode: e.target.value })}
                      className="w-full bg-transparent px-1 py-0.5 border border-transparent focus:border-zinc-300 rounded font-mono"
                    />
                  </td>
                  <td className="p-1.5 font-medium sticky left-38 z-10 bg-white border-r border-zinc-200 shadow-sm">
                    <input
                      type="text"
                      value={line.rawItemName}
                      onChange={(e) => handleUpdateLine(line.id, { rawItemName: e.target.value })}
                      className="w-full bg-transparent px-1 py-0.5 border border-transparent focus:border-zinc-300 rounded"
                    />
                  </td>
                  <td className="p-1.5 text-center border-r border-zinc-200">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      line.materialGroup === 'LCO' ? 'bg-purple-100 text-purple-800' :
                      line.materialGroup === 'BP' ? 'bg-blue-100 text-blue-800' :
                      line.materialGroup === 'WET' ? 'bg-teal-100 text-teal-800' :
                      line.materialGroup === 'BM' ? 'bg-amber-100 text-amber-800' :
                      line.materialGroup === 'MN' ? 'bg-indigo-100 text-indigo-800' : 'bg-zinc-100 text-zinc-700'
                    }`}>
                      {line.materialGroup}
                    </span>
                  </td>

                  {/* Quantity Ton Input */}
                  <td className="p-1 text-right border-r border-zinc-200 bg-teal-50/30">
                    <input
                      type="number"
                      step="0.1"
                      value={line.quantityTon}
                      onChange={(e) => handleUpdateLine(line.id, { quantityTon: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono font-bold text-teal-900 bg-white px-1.5 py-0.5 border border-teal-200 rounded focus:outline-teal-500"
                    />
                  </td>

                  {/* Unit Price */}
                  <td className="p-1 text-right border-r border-zinc-200 font-mono">
                    <input
                      type="number"
                      step="0.1"
                      value={effectivePrice}
                      onChange={(e) => handleUpdateLine(line.id, {
                        customUnitPrice: parseFloat(e.target.value) || 0,
                        priceType: 'CUSTOM'
                      })}
                      className={`w-full text-right font-mono px-1.5 py-0.5 border rounded ${
                        line.priceType === 'CUSTOM' ? 'border-amber-300 bg-amber-50/50 font-bold' : 'border-zinc-200 bg-white'
                      }`}
                    />
                  </td>

                  {/* Price Source Badge */}
                  <td className="p-1.5 text-center border-r border-zinc-200 text-[10px]">
                    {line.priceType === 'CUSTOM' ? (
                      <span className="text-amber-700 font-semibold bg-amber-100 px-1 py-0.5 rounded">수동입력</span>
                    ) : (
                      <span className="text-teal-700 font-medium bg-teal-50 px-1 py-0.5 rounded border border-teal-200">
                        수불부
                      </span>
                    )}
                  </td>

                  {/* Major Metal % Inputs */}
                  <td className="p-1 text-right border-r border-zinc-200 bg-blue-50/20">
                    <input
                      type="number"
                      step="0.1"
                      value={line.niPct}
                      onChange={(e) => handleUpdateLine(line.id, { niPct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded"
                    />
                  </td>
                  <td className="p-1 text-right border-r border-zinc-200 bg-indigo-50/20">
                    <input
                      type="number"
                      step="0.1"
                      value={line.coPct}
                      onChange={(e) => handleUpdateLine(line.id, { coPct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded"
                    />
                  </td>
                  <td className="p-1 text-right border-r border-zinc-200 bg-emerald-50/20">
                    <input
                      type="number"
                      step="0.1"
                      value={line.lcPct}
                      onChange={(e) => handleUpdateLine(line.id, { lcPct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded"
                    />
                  </td>
                  <td className="p-1 text-right border-r border-zinc-200 bg-amber-50/20">
                    <input
                      type="number"
                      step="0.1"
                      value={line.mnPct}
                      onChange={(e) => handleUpdateLine(line.id, { mnPct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded"
                    />
                  </td>
                  <td className="p-1 text-right border-r border-zinc-200 bg-orange-50/20">
                    <input
                      type="number"
                      step="0.1"
                      value={line.cuPct}
                      onChange={(e) => handleUpdateLine(line.id, { cuPct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded"
                    />
                  </td>

                  {/* Minor Metals */}
                  {showMinorMetals && (
                    <>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.alPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { alPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.fePct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { fePct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.fPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { fPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.pPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { pPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.mgPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { mgPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.caPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { caPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.kPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { kPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.pbPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { pbPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200">
                        <input
                          type="number" step="0.1" value={line.dcPct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { dcPct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-zinc-700"
                        />
                      </td>
                      <td className="p-1 text-right border-r border-zinc-200 bg-purple-50/20">
                        <input
                          type="number" step="0.1" value={line.moisturePct || 0}
                          onChange={(e) => handleUpdateLine(line.id, { moisturePct: parseFloat(e.target.value) || 0 })}
                          className="w-full text-right font-mono px-1 py-0.5 bg-white border border-zinc-200 rounded text-purple-900"
                        />
                      </td>
                    </>
                  )}

                  <td className="p-1 text-center">
                    <button
                      onClick={() => handleDeleteLine(line.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                      title="원료 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Sticky Summary Bottom Row */}
          <tfoot className="sticky bottom-0 z-20 bg-zinc-900 text-white font-bold border-t-2 border-zinc-700 text-[11px]">
            <tr>
              <td colSpan={3} className="p-2.5 text-center sticky left-0 z-30 bg-zinc-900 border-r border-zinc-700">
                선택 원료 가중평균 합계
              </td>
              <td className="p-2.5 text-center border-r border-zinc-700 text-zinc-300">
                -
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-teal-300 text-xs">
                {calculation.totalInputTon.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-200">
                {calculation.totalInputTon > 0 ? (calculation.totalRawMaterialCostKrw / calculation.totalInputTon / 1_000_000).toFixed(2) : '0.00'} M원/t
              </td>
              <td className="p-2.5 text-center border-r border-zinc-700 text-zinc-400">
                가중평균
              </td>

              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-blue-300">
                {calculation.avgNiPct.toFixed(1)}%
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-indigo-300">
                {calculation.avgCoPct.toFixed(1)}%
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-emerald-300">
                {calculation.avgLcPct.toFixed(1)}%
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-amber-300">
                {calculation.avgMnPct.toFixed(1)}%
              </td>
              <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-orange-300">
                {calculation.avgCuPct.toFixed(1)}%
              </td>

              {showMinorMetals && (
                <>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgAlPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgFePct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgFPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgPPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgMgPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgCaPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgKPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgPbPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-zinc-400">{calculation.avgDcPct.toFixed(1)}%</td>
                  <td className="p-2.5 text-right border-r border-zinc-700 font-mono text-purple-300">{calculation.avgMoisturePct.toFixed(1)}%</td>
                </>
              )}

              <td className="p-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pass/Fail Target Summary Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-1.5">
            <span>원료 분류별 투입 비중</span>
            <span className="font-mono text-teal-700">{calculation.totalInputTon.toFixed(1)} t</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            <div className="bg-purple-50 p-1.5 rounded border border-purple-100">
              <span className="text-purple-700 font-sans font-semibold">LCO:</span>{' '}
              <strong>{calculation.groupInputTons.LCO.toFixed(1)}t</strong>
            </div>
            <div className="bg-blue-50 p-1.5 rounded border border-blue-100">
              <span className="text-blue-700 font-sans font-semibold">BP:</span>{' '}
              <strong>{calculation.groupInputTons.BP.toFixed(1)}t</strong>
            </div>
            <div className="bg-teal-50 p-1.5 rounded border border-teal-100">
              <span className="text-teal-700 font-sans font-semibold">WET:</span>{' '}
              <strong>{calculation.groupInputTons.WET.toFixed(1)}t</strong>
            </div>
            <div className="bg-amber-50 p-1.5 rounded border border-amber-100">
              <span className="text-amber-700 font-sans font-semibold">BM:</span>{' '}
              <strong>{calculation.groupInputTons.BM.toFixed(1)}t</strong>
            </div>
            <div className="bg-indigo-50 p-1.5 rounded border border-indigo-100">
              <span className="text-indigo-700 font-sans font-semibold">MN:</span>{' '}
              <strong>{calculation.groupInputTons.MN.toFixed(1)}t</strong>
            </div>
            <div className="bg-zinc-100 p-1.5 rounded border border-zinc-200">
              <span className="text-zinc-700 font-sans font-semibold">기타:</span>{' '}
              <strong>{calculation.groupInputTons.기타.toFixed(1)}t</strong>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-1.5">
            <span>NCL 품위 성적</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
              calculation.nclPassStatus === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {calculation.nclPassStatus === 'PASS' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {calculation.nclPassStatus === 'PASS' ? '합격' : '목표 미달'}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-600">NCL 합계 (Ni+Co+LC):</span>
              <strong className="font-mono text-base text-zinc-900">{calculation.nclPct.toFixed(1)} %</strong>
            </div>
            <div className="flex justify-between items-center text-[11px] text-zinc-500">
              <span>목표 기준:</span>
              <span className="font-mono">≥ {scenario.nclTargetPct || 35.0} %</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-zinc-800 border-b border-zinc-100 pb-1.5">
            <span>주요 금속 목표범위 도달 현황</span>
            <span className="text-[10px] text-zinc-500">지정 범위 내 합격 판정</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
            {calculation.metalResults.map(m => (
              <div key={m.metal} className={`px-2 py-1 rounded border flex items-center gap-1 ${
                m.passStatus === 'PASS' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                m.passStatus === 'WARN' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                m.passStatus === 'FAIL' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
              }`}>
                <span>{m.metal}:</span>
                <strong className="font-mono">{m.avgPct.toFixed(1)}%</strong>
                {m.passStatus === 'PASS' && <span className="font-bold text-emerald-600">✓</span>}
                {m.passStatus === 'WARN' && <span className="font-bold text-amber-600">!</span>}
                {m.passStatus === 'FAIL' && <span className="font-bold text-rose-600">×</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
