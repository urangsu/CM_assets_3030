import React from 'react';
import { CompositionEvaluation } from '../../lib/operation/blendPolicy';

interface CompositionRangeRowProps {
  evaluation: CompositionEvaluation;
}

export const CompositionRangeRow: React.FC<CompositionRangeRowProps> = ({ evaluation }) => {
  const { name, currentPct, minPct, maxPct, status, statusText } = evaluation;

  // Calculate percentage positions for visual bar (map range [min - 3, max + 3] to [0%, 100%])
  const padding = 3;
  const rangeMin = Math.max(0, minPct - padding);
  const rangeMax = maxPct + padding;
  const totalRange = rangeMax - rangeMin;

  const minPos = Math.max(0, Math.min(100, ((minPct - rangeMin) / totalRange) * 100));
  const maxPos = Math.max(0, Math.min(100, ((maxPct - rangeMin) / totalRange) * 100));
  const currentPos = Math.max(0, Math.min(100, ((currentPct - rangeMin) / totalRange) * 100));

  const statusColor = status === 'OPTIMAL' ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium';
  const dotColor = status === 'OPTIMAL' ? 'bg-emerald-600 border-white' : 'bg-red-600 border-white';

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <div className="w-8 font-semibold text-slate-700">{name}</div>
      <div className="w-12 text-right text-xs text-slate-500">{minPct.toFixed(1)}</div>
      
      {/* Horizontal Track Bar */}
      <div className="relative flex-1 h-3 bg-slate-200 rounded-full overflow-hidden my-auto">
        {/* Target Range Band */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-100/80 border-x border-emerald-400/50"
          style={{ left: `${minPos}%`, width: `${Math.max(2, maxPos - minPos)}%` }}
        />
        {/* Current Marker Dot */}
        {currentPct > 0 && (
          <div
            className={`absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full border-2 shadow-sm transition-all ${dotColor}`}
            style={{ left: `${currentPos}%` }}
            title={`현재: ${currentPct.toFixed(1)}%`}
          />
        )}
      </div>

      <div className="w-12 text-left text-xs text-slate-500">{maxPct.toFixed(1)}</div>
      <div className="w-16 text-right font-mono font-medium text-slate-800">{currentPct > 0 ? `${currentPct.toFixed(1)}%` : '-'}</div>
      <div className={`w-24 text-right text-xs ${statusColor}`}>{currentPct > 0 ? statusText : '미입력'}</div>
    </div>
  );
};
