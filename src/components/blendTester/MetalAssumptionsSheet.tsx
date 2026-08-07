import React from 'react';
import { BlendScenario, MetalAssumption } from '../../lib/operation/blendStorage';
import { BlendCalculationResult } from '../../lib/operation/blendEngine';
import { DollarSign, TrendingUp, Percent, ArrowUpDown } from 'lucide-react';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
  onChangeScenario: (updated: BlendScenario) => void;
}

export const MetalAssumptionsSheet: React.FC<Props> = ({ scenario, calculation, onChangeScenario }) => {
  const handleUpdateAssumption = (metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU', updates: Partial<MetalAssumption>) => {
    const updatedAssumptions = scenario.metalAssumptions.map(a => {
      if (a.metal === metal) {
        return { ...a, ...updates };
      }
      return a;
    });

    onChangeScenario({
      ...scenario,
      metalAssumptions: updatedAssumptions,
      isDirty: true
    });
  };

  const handleExchangeRateChange = (val: number) => {
    onChangeScenario({
      ...scenario,
      exchangeRate: val,
      isDirty: true
    });
  };

  return (
    <div className="space-y-4">
      {/* Exchange Rate & Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50/80 border border-teal-200 p-3 rounded-lg text-xs">
        <div className="flex items-center gap-3">
          <DollarSign className="w-4 h-4 text-teal-700" />
          <span className="font-bold text-teal-950">시나리오 환율 설정:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.5"
              value={scenario.exchangeRate}
              onChange={(e) => handleExchangeRateChange(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 bg-white border border-teal-300 rounded text-right font-mono font-bold text-teal-900 text-sm focus:outline-teal-500"
            />
            <span className="font-medium text-teal-800">원 / USD</span>
          </div>
        </div>

        <div className="text-zinc-600 text-[11px]">
          ※ 시장가격(LME/Spot)에 프리미엄/디스카운트를 반영하여 최종 매각단가 및 예상 매출액을 산출합니다.
        </div>
      </div>

      {/* Main Table: Compact Style */}
      <div className="overflow-x-auto border border-zinc-250 rounded-lg shadow-xs bg-white">
        <table className="w-full text-[11px] text-left border-collapse font-sans min-w-[1000px]">
          <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300">
            <tr>
              <th className="p-2.5 w-28 border-r border-zinc-200">금속구분</th>
              <th className="p-2.5 w-28 text-right border-r border-zinc-200 bg-blue-50/40 text-blue-900">
                시세 (USD/t)
              </th>
              <th className="p-2.5 w-24 text-center border-r border-zinc-200">프리미엄 방식</th>
              <th className="p-2.5 w-28 text-right border-r border-zinc-200 bg-amber-50/40 text-amber-900">
                프리미엄 요율 (%)
              </th>
              <th className="p-2.5 w-28 text-right border-r border-zinc-200 text-zinc-800">
                프리미엄 단가 ($/t)
              </th>
              <th className="p-2.5 w-28 text-right border-r border-zinc-200 bg-teal-50/40 text-teal-950 font-black">
                적용단가 (USD/t)
              </th>
              <th className="p-2.5 w-32 text-right border-r border-zinc-200 bg-teal-50/40 text-teal-950 font-black">
                적용단가 (원/t)
              </th>
              <th className="p-2.5 w-24 text-right border-r border-zinc-200 bg-purple-50/40 text-purple-900">
                공정회수율 (%)
              </th>
              <th className="p-2.5 w-32 text-center border-r border-zinc-200">
                목표배합 범위 (% min ~ max)
              </th>
              <th className="p-2.5 w-36 text-right font-black text-teal-900 bg-teal-100/50">
                예상 매출액 (원)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {scenario.metalAssumptions.map((ass) => {
              const res = calculation.metalResults.find(m => m.metal === ass.metal);

              return (
                <tr key={ass.metal} className="hover:bg-zinc-50/80">
                  <td className="p-2.5 font-bold border-r border-zinc-200 flex items-center justify-between">
                    <span>{ass.metalName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({ass.metal})</span>
                  </td>

                  {/* Market Price USD */}
                  <td className="p-1.5 text-right border-r border-zinc-200 bg-blue-50/10">
                    <input
                      type="number"
                      step="50"
                      value={ass.marketPrice}
                      onChange={(e) => handleUpdateAssumption(ass.metal, { marketPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono font-bold text-blue-900 px-1.5 py-1 border border-blue-200 rounded focus:outline-blue-500"
                    />
                  </td>

                  {/* Premium Mode Switcher */}
                  <td className="p-1.5 text-center border-r border-zinc-200">
                    <select
                      value={ass.premiumMode}
                      onChange={(e) => handleUpdateAssumption(ass.metal, { premiumMode: e.target.value as any })}
                      className="text-[10px] font-bold px-1.5 py-1 border border-zinc-300 rounded bg-white text-zinc-800"
                    >
                      <option value="RATE">요율 (%)</option>
                      <option value="UNIT_AMOUNT">단가 ($/t)</option>
                    </select>
                  </td>

                  {/* Premium Rate % */}
                  <td className="p-1.5 text-right border-r border-zinc-200 bg-amber-50/10">
                    <input
                      type="number"
                      step="0.1"
                      value={ass.premiumRatePct}
                      onChange={(e) => handleUpdateAssumption(ass.metal, {
                        premiumRatePct: parseFloat(e.target.value) || 0,
                        premiumMode: 'RATE'
                      })}
                      disabled={ass.premiumMode !== 'RATE'}
                      className={`w-full text-right font-mono font-bold px-1.5 py-1 border rounded ${
                        ass.premiumMode === 'RATE'
                          ? ass.premiumRatePct < 0 ? 'text-rose-700 border-rose-200 bg-rose-50/30' : 'text-emerald-700 border-emerald-200 bg-emerald-50/30'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    />
                  </td>

                  {/* Premium Unit Amount USD */}
                  <td className="p-1.5 text-right border-r border-zinc-200">
                    <input
                      type="number"
                      step="10"
                      value={res ? Math.round(res.premiumUnitAmountUsd) : ass.premiumUnitAmount}
                      onChange={(e) => handleUpdateAssumption(ass.metal, {
                        premiumUnitAmount: parseFloat(e.target.value) || 0,
                        premiumMode: 'UNIT_AMOUNT'
                      })}
                      disabled={ass.premiumMode !== 'UNIT_AMOUNT'}
                      className={`w-full text-right font-mono px-1.5 py-1 border rounded ${
                        ass.premiumMode === 'UNIT_AMOUNT' ? 'border-amber-300 bg-amber-50/30 font-bold' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      }`}
                    />
                  </td>

                  {/* Applied Price USD */}
                  <td className="p-2.5 text-right font-mono font-bold text-teal-900 bg-teal-50/20 border-r border-zinc-200">
                    ${res ? Math.round(res.appliedPriceUsd).toLocaleString() : '0'} /t
                  </td>

                  {/* Applied Price KRW */}
                  <td className="p-2.5 text-right font-mono font-bold text-teal-950 bg-teal-50/20 border-r border-zinc-200">
                    {res ? Math.round(res.appliedPriceKrw).toLocaleString() : '0'} 원/t
                  </td>

                  {/* Recovery Rate % */}
                  <td className="p-1.5 text-right border-r border-zinc-200 bg-purple-50/10">
                    <input
                      type="number"
                      step="0.1"
                      value={ass.recoveryRatePct}
                      onChange={(e) => handleUpdateAssumption(ass.metal, { recoveryRatePct: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono font-bold text-purple-900 px-1.5 py-1 border border-purple-200 rounded"
                    />
                  </td>

                  {/* Target Range */}
                  <td className="p-1.5 text-center border-r border-zinc-200">
                    <div className="flex items-center justify-center gap-1 font-mono">
                      <input
                        type="number" step="0.1" value={ass.targetMinPct ?? 0}
                        onChange={(e) => handleUpdateAssumption(ass.metal, { targetMinPct: parseFloat(e.target.value) || 0 })}
                        className="w-12 text-center px-1 py-0.5 border border-zinc-300 rounded text-[10px]"
                      />
                      <span className="text-zinc-400">~</span>
                      <input
                        type="number" step="0.1" value={ass.targetMaxPct ?? 100}
                        onChange={(e) => handleUpdateAssumption(ass.metal, { targetMaxPct: parseFloat(e.target.value) || 100 })}
                        className="w-12 text-center px-1 py-0.5 border border-zinc-300 rounded text-[10px]"
                      />
                      <span className="text-zinc-500 text-[10px]">%</span>
                    </div>
                  </td>

                  {/* Expected Revenue KRW */}
                  <td className="p-2.5 text-right font-mono font-black text-teal-950 bg-teal-100/30">
                    {res ? Math.round(res.revenueKrw).toLocaleString() : '0'} 원
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Table Summary Footer */}
          <tfoot className="bg-zinc-900 text-white font-bold text-[11px]">
            <tr>
              <td colSpan={5} className="p-2.5 text-center border-r border-zinc-700">
                합계 및 예상 회수금속 생산량
              </td>
              <td colSpan={2} className="p-2.5 text-right font-mono text-teal-300 border-r border-zinc-700">
                회수 생산량: <strong>{calculation.totalProductionTon.toFixed(2)} t</strong>
              </td>
              <td colSpan={2} className="p-2.5 text-center text-zinc-300 border-r border-zinc-700">
                총 예상 매출액 (합계)
              </td>
              <td className="p-2.5 text-right font-mono text-emerald-300 text-xs font-black">
                {Math.round(calculation.totalRevenueKrw).toLocaleString()} 원
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
