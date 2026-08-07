import React from 'react';
import { DEFAULT_COMPOSITION_TARGETS, evaluateComposition } from '../../lib/operation/blendPolicy';
import { CompositionRangeRow } from './CompositionRangeRow';

interface CompositionSummaryProps {
  avgNiPct: number;
  avgCoPct: number;
  avgLcPct: number;
  avgMnPct: number;
  avgCuPct: number;
  hasUnenteredCompositions?: boolean;
}

export const CompositionSummary: React.FC<CompositionSummaryProps> = ({
  avgNiPct,
  avgCoPct,
  avgLcPct,
  avgMnPct,
  avgCuPct,
  hasUnenteredCompositions
}) => {
  const niEval = evaluateComposition('NI', avgNiPct);
  const coEval = evaluateComposition('CO', avgCoPct);
  const lcEval = evaluateComposition('LC', avgLcPct);
  const mnEval = evaluateComposition('MN', avgMnPct);
  const cuEval = evaluateComposition('CU', avgCuPct);

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-800">배합 조성 결과</h4>
          {hasUnenteredCompositions && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
              성분 미입력 포함
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">목표 range 대비 실측/가중평균</span>
      </div>

      <div className="space-y-1 divide-y divide-slate-100">
        <CompositionRangeRow evaluation={niEval} />
        <CompositionRangeRow evaluation={coEval} />
        <CompositionRangeRow evaluation={lcEval} />
        <CompositionRangeRow evaluation={mnEval} />
        <CompositionRangeRow evaluation={cuEval} />
      </div>
    </div>
  );
};
