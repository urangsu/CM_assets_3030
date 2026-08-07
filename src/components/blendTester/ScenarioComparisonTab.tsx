import React from 'react';
import { BlendScenario } from '../../lib/operation/blendStorage';
import { calculateBlendResult, BlendCalculationResult } from '../../lib/operation/blendEngine';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  scenarios: BlendScenario[];
}

export const ScenarioComparisonTab: React.FC<Props> = ({ scenarios }) => {
  const s1 = scenarios[0] || null;
  const s2 = scenarios[1] || null;

  if (!s1 || !s2) {
    return (
      <div className="p-8 text-center text-zinc-500 font-sans text-xs">
        비교할 시나리오가 2개 이상 필요합니다.
      </div>
    );
  }

  const c1 = calculateBlendResult(s1);
  const c2 = calculateBlendResult(s2);

  const formatDiff = (v1: number, v2: number, unit: string = '', decimals: number = 1, isPrice: boolean = false) => {
    const diff = v2 - v1;
    if (Math.abs(diff) < 0.0001) {
      return <span className="text-zinc-400 font-mono">-</span>;
    }
    const isPositiveGood = !isPrice; // usually higher revenue/margin is good, higher cost is bad
    const isGood = diff > 0 ? isPositiveGood : !isPositiveGood;

    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] ${
        diff > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(decimals)} {unit}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-sans text-xs">
      <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200 p-3 rounded-lg">
        <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-teal-600" />
          <span>시나리오 1 vs 시나리오 2 주요 항목 비교</span>
        </h3>
        <span className="text-zinc-500 text-[11px]">
          차이 = Scenario 2 값 - Scenario 1 값
        </span>
      </div>

      <div className="overflow-x-auto border border-zinc-250 rounded-xl shadow-xs bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-100 text-zinc-700 font-bold border-b text-[11px]">
            <tr>
              <th className="p-3 w-56 border-r border-zinc-200">비교 항목</th>
              <th className="p-3 text-right border-r border-zinc-200 bg-teal-50/50 text-teal-950 font-black">
                {s1.name} (기준)
              </th>
              <th className="p-3 text-right border-r border-zinc-200 bg-indigo-50/50 text-indigo-950 font-black">
                {s2.name} (비교)
              </th>
              <th className="p-3 text-center bg-zinc-50">차이 (Diff)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 text-xs font-sans">
            {/* 1. Raw Material Input Quantities */}
            <tr className="bg-zinc-50/80 font-bold text-zinc-900">
              <td colSpan={4} className="p-2 text-teal-900 border-b">1. 원료 투입량 (t)</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200">총 원료 투입량</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c1.totalInputTon.toFixed(1)} t</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c2.totalInputTon.toFixed(1)} t</td>
              <td className="p-2.5 text-center">{formatDiff(c1.totalInputTon, c2.totalInputTon, 't')}</td>
            </tr>
            <tr>
              <td className="p-2 pl-6 border-r border-zinc-200 text-zinc-600">└ LCO 슬러지</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c1.groupInputTons.LCO.toFixed(1)} t</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c2.groupInputTons.LCO.toFixed(1)} t</td>
              <td className="p-2 text-center">{formatDiff(c1.groupInputTons.LCO, c2.groupInputTons.LCO, 't')}</td>
            </tr>
            <tr>
              <td className="p-2 pl-6 border-r border-zinc-200 text-zinc-600">└ BP (811)</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c1.groupInputTons.BP.toFixed(1)} t</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c2.groupInputTons.BP.toFixed(1)} t</td>
              <td className="p-2 text-center">{formatDiff(c1.groupInputTons.BP, c2.groupInputTons.BP, 't')}</td>
            </tr>
            <tr>
              <td className="p-2 pl-6 border-r border-zinc-200 text-zinc-600">└ WET 케이크</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c1.groupInputTons.WET.toFixed(1)} t</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c2.groupInputTons.WET.toFixed(1)} t</td>
              <td className="p-2 text-center">{formatDiff(c1.groupInputTons.WET, c2.groupInputTons.WET, 't')}</td>
            </tr>
            <tr>
              <td className="p-2 pl-6 border-r border-zinc-200 text-zinc-600">└ BM 표준품</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c1.groupInputTons.BM.toFixed(1)} t</td>
              <td className="p-2 text-right font-mono border-r border-zinc-200">{c2.groupInputTons.BM.toFixed(1)} t</td>
              <td className="p-2 text-center">{formatDiff(c1.groupInputTons.BM, c2.groupInputTons.BM, 't')}</td>
            </tr>

            {/* 2. Weighted Average Metal Compositions */}
            <tr className="bg-zinc-50/80 font-bold text-zinc-900">
              <td colSpan={4} className="p-2 text-teal-900 border-b">2. 원료 가중평균 금속 품위 (%)</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold text-blue-900">Ni (%)</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c1.avgNiPct.toFixed(1)} %</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c2.avgNiPct.toFixed(1)} %</td>
              <td className="p-2.5 text-center">{formatDiff(c1.avgNiPct, c2.avgNiPct, '%')}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold text-indigo-900">Co (%)</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c1.avgCoPct.toFixed(1)} %</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c2.avgCoPct.toFixed(1)} %</td>
              <td className="p-2.5 text-center">{formatDiff(c1.avgCoPct, c2.avgCoPct, '%')}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold text-emerald-900">LC (%)</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c1.avgLcPct.toFixed(1)} %</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c2.avgLcPct.toFixed(1)} %</td>
              <td className="p-2.5 text-center">{formatDiff(c1.avgLcPct, c2.avgLcPct, '%')}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold text-purple-900">NCL 합계 (%)</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c1.nclPct.toFixed(1)} %</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">{c2.nclPct.toFixed(1)} %</td>
              <td className="p-2.5 text-center">{formatDiff(c1.nclPct, c2.nclPct, '%')}</td>
            </tr>

            {/* 3. Economics & Profitability */}
            <tr className="bg-zinc-50/80 font-bold text-zinc-900">
              <td colSpan={4} className="p-2 text-teal-900 border-b">3. 예상 매출, 제조변동비 및 영업이익 (백만원)</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold">총 예상 매출액</td>
              <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-zinc-200">
                {Math.round(c1.totalRevenueKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-zinc-200">
                {Math.round(c2.totalRevenueKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-center">{formatDiff(c1.totalRevenueKrw / 1_000_000, c2.totalRevenueKrw / 1_000_000, 'M원')}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200">원자재 비용</td>
              <td className="p-2.5 text-right font-mono border-r border-zinc-200">
                {Math.round(c1.totalRawMaterialCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-right font-mono border-r border-zinc-200">
                {Math.round(c2.totalRawMaterialCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-center">{formatDiff(c1.totalRawMaterialCostKrw / 1_000_000, c2.totalRawMaterialCostKrw / 1_000_000, 'M원', 1, true)}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200">BOM 부재료 및 유틸리티 변동비</td>
              <td className="p-2.5 text-right font-mono border-r border-zinc-200">
                {Math.round(c1.totalBomCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-right font-mono border-r border-zinc-200">
                {Math.round(c2.totalBomCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-center">{formatDiff(c1.totalBomCostKrw / 1_000_000, c2.totalBomCostKrw / 1_000_000, 'M원', 1, true)}</td>
            </tr>
            <tr className="bg-amber-50/40 font-bold">
              <td className="p-2.5 pl-5 border-r border-zinc-200 text-amber-950">총 제조변동비</td>
              <td className="p-2.5 text-right font-mono text-amber-950 border-r border-zinc-200">
                {Math.round(c1.totalManufacturingCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-right font-mono text-amber-950 border-r border-zinc-200">
                {Math.round(c2.totalManufacturingCostKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-2.5 text-center">{formatDiff(c1.totalManufacturingCostKrw / 1_000_000, c2.totalManufacturingCostKrw / 1_000_000, 'M원', 1, true)}</td>
            </tr>
            <tr className="bg-emerald-50/60 font-black text-sm">
              <td className="p-3 pl-5 border-r border-zinc-200 text-emerald-950">예상 영업이익 (마진)</td>
              <td className="p-3 text-right font-mono text-emerald-950 border-r border-zinc-200">
                {Math.round(c1.expectedMarginKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-3 text-right font-mono text-emerald-950 border-r border-zinc-200">
                {Math.round(c2.expectedMarginKrw / 1_000_000).toLocaleString()} M원
              </td>
              <td className="p-3 text-center">{formatDiff(c1.expectedMarginKrw / 1_000_000, c2.expectedMarginKrw / 1_000_000, 'M원', 1)}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-5 border-r border-zinc-200 font-bold">톤당 영업이익 (원/t)</td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">
                {Math.round(c1.marginPerTonProduct).toLocaleString()} 원/t
              </td>
              <td className="p-2.5 text-right font-mono font-bold border-r border-zinc-200">
                {Math.round(c2.marginPerTonProduct).toLocaleString()} 원/t
              </td>
              <td className="p-2.5 text-center">{formatDiff(c1.marginPerTonProduct, c2.marginPerTonProduct, '원/t', 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
