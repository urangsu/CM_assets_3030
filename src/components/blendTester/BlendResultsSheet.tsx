import React from 'react';
import { BlendScenario } from '../../lib/operation/blendStorage';
import { BlendCalculationResult } from '../../lib/operation/blendEngine';
import { TrendingUp, DollarSign, Package, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
}

export const BlendResultsSheet: React.FC<Props> = ({ scenario, calculation }) => {
  return (
    <div className="space-y-6 text-sans text-xs">
      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Production Volume */}
        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex justify-between items-center text-zinc-500 font-medium">
            <span>총 예상 회수생산량</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-zinc-900 font-mono">
            {calculation.totalProductionTon.toFixed(2)} <span className="text-sm font-sans font-bold text-zinc-600">t</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            원료 투입량: {calculation.totalInputTon.toFixed(1)} t
          </div>
        </div>

        {/* Expected Revenue */}
        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex justify-between items-center text-zinc-500 font-medium">
            <span>예상 총 매출액</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono">
            {Math.round(calculation.totalRevenueKrw / 1_000_000).toLocaleString()} <span className="text-sm font-sans font-bold text-blue-700">백만원</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">
            ${Math.round(calculation.totalRevenueUsd).toLocaleString()} USD (환율 {scenario.exchangeRate}원)
          </div>
        </div>

        {/* Total Manufacturing Variable Cost */}
        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex justify-between items-center text-zinc-500 font-medium">
            <span>총 제조변동비 (원자재+BOM)</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 font-mono">
            {Math.round(calculation.totalManufacturingCostKrw / 1_000_000).toLocaleString()} <span className="text-sm font-sans font-bold text-amber-800">백만원</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">
            원자재 {Math.round(calculation.totalRawMaterialCostKrw / 1_000_000).toLocaleString()}M + BOM {Math.round(calculation.totalBomCostKrw / 1_000_000).toLocaleString()}M
          </div>
        </div>

        {/* Expected Operating Margin & Margin per Ton */}
        <div className={`p-4 rounded-xl shadow-xs border space-y-1 ${
          calculation.expectedMarginKrw >= 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
        }`}>
          <div className="flex justify-between items-center font-medium">
            <span className={calculation.expectedMarginKrw >= 0 ? 'text-emerald-900' : 'text-rose-900'}>
              예상 영업이익 (마진율 {calculation.marginRatioPct.toFixed(1)}%)
            </span>
            <ArrowUpRight className={`w-4 h-4 ${calculation.expectedMarginKrw >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} />
          </div>
          <div className={`text-2xl font-black font-mono ${calculation.expectedMarginKrw >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
            {Math.round(calculation.expectedMarginKrw / 1_000_000).toLocaleString()} <span className="text-sm font-sans font-bold">백만원</span>
          </div>
          <div className={`text-[11px] font-mono font-bold ${calculation.expectedMarginKrw >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            톤당 마진: {Math.round(calculation.marginPerTonProduct).toLocaleString()} 원/t
          </div>
        </div>
      </div>

      {/* Tables Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metal Yield & Revenue Breakdown */}
        <div className="border border-zinc-250 rounded-xl bg-white p-4 space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-zinc-900 flex items-center justify-between">
            <span>금속별 회수량 및 매출액 내역</span>
            <span className="text-xs text-zinc-500">환율 {scenario.exchangeRate}원 기준</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-100 text-zinc-700 font-bold border-b text-[11px]">
                <tr>
                  <th className="p-2">금속구분</th>
                  <th className="p-2 text-right">배합비율 (%)</th>
                  <th className="p-2 text-right">회수 생산량 (t)</th>
                  <th className="p-2 text-right">적용단가 ($/t)</th>
                  <th className="p-2 text-right">매출액 (백만원)</th>
                  <th className="p-2 text-center">비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[11px] font-mono">
                {calculation.metalResults.map(m => {
                  const sharePct = calculation.totalRevenueKrw > 0 ? (m.revenueKrw / calculation.totalRevenueKrw) * 100 : 0;

                  return (
                    <tr key={m.metal} className="hover:bg-zinc-50">
                      <td className="p-2 font-sans font-bold text-zinc-900">{m.metalName}</td>
                      <td className="p-2 text-right">{m.avgPct.toFixed(1)}%</td>
                      <td className="p-2 text-right font-bold">{m.expectedProductTon.toFixed(2)} t</td>
                      <td className="p-2 text-right">${Math.round(m.appliedPriceUsd).toLocaleString()}</td>
                      <td className="p-2 text-right font-bold text-blue-900">
                        {Math.round(m.revenueKrw / 1_000_000).toLocaleString()} M원
                      </td>
                      <td className="p-2 text-center font-sans font-medium text-zinc-600">
                        {sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-zinc-900 text-white font-bold text-[11px]">
                <tr>
                  <td className="p-2">합계</td>
                  <td className="p-2 text-right">{calculation.nclPct.toFixed(1)}% (NCL)</td>
                  <td className="p-2 text-right font-mono text-teal-300">{calculation.totalProductionTon.toFixed(2)} t</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2 text-right font-mono text-emerald-300">
                    {Math.round(calculation.totalRevenueKrw / 1_000_000).toLocaleString()} M원
                  </td>
                  <td className="p-2 text-center">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Cost & Operating Profit Structure */}
        <div className="border border-zinc-250 rounded-xl bg-white p-4 space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-zinc-900">손익 및 변동비 구조 요약</h3>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-zinc-200">
              <span className="font-sans font-bold text-zinc-800">1. 총 매출액</span>
              <span className="font-black text-blue-900 text-sm">
                {Math.round(calculation.totalRevenueKrw).toLocaleString()} 원
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-zinc-200">
              <span className="font-sans font-bold text-zinc-800">2. 원자재 비용 (투입원료)</span>
              <span className="font-bold text-amber-900">
                {Math.round(calculation.totalRawMaterialCostKrw).toLocaleString()} 원
                <span className="text-[10px] text-zinc-500 font-sans ml-2">({Math.round(calculation.rawMaterialCostPerTonProduct).toLocaleString()} 원/t)</span>
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-zinc-200">
              <span className="font-sans font-bold text-zinc-800">3. BOM 부부재료·유틸리티 변동비</span>
              <span className="font-bold text-teal-900">
                {Math.round(calculation.totalBomCostKrw).toLocaleString()} 원
                <span className="text-[10px] text-zinc-500 font-sans ml-2">({Math.round(calculation.bomCostPerTonProduct).toLocaleString()} 원/t)</span>
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-amber-50/80 rounded border border-amber-200">
              <span className="font-sans font-bold text-amber-950">4. 총 제조변동비 합계 (2 + 3)</span>
              <span className="font-black text-amber-950 text-sm">
                {Math.round(calculation.totalManufacturingCostKrw).toLocaleString()} 원
              </span>
            </div>

            <div className={`flex justify-between items-center p-3 rounded-lg border-2 ${
              calculation.expectedMarginKrw >= 0 ? 'bg-emerald-100/70 border-emerald-400' : 'bg-rose-100/70 border-rose-400'
            }`}>
              <span className="font-sans font-black text-sm text-zinc-950">5. 예상 영업이익 (마진)</span>
              <span className={`font-black text-base ${calculation.expectedMarginKrw >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
                {Math.round(calculation.expectedMarginKrw).toLocaleString()} 원
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
