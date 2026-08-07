export const PERFORMANCE_CAPACITY_TON = 346;

export interface TargetCompositionRange {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  name: string;
  minPct: number;
  maxPct: number;
}

export const DEFAULT_COMPOSITION_TARGETS: Record<'NI' | 'CO' | 'LC' | 'MN' | 'CU', TargetCompositionRange> = {
  NI: { metal: 'NI', name: 'Ni', minPct: 23.0, maxPct: 26.0 },
  CO: { metal: 'CO', name: 'Co', minPct: 7.0, maxPct: 8.0 },
  LC: { metal: 'LC', name: 'LC', minPct: 4.6, maxPct: 5.2 },
  MN: { metal: 'MN', name: 'Mn', minPct: 8.0, maxPct: 9.2 },
  CU: { metal: 'CU', name: 'Cu', minPct: 0.9, maxPct: 1.1 }
};

export type CompositionStatusType = 'OPTIMAL' | 'UNDER' | 'OVER';

export interface CompositionEvaluation {
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
  name: string;
  currentPct: number;
  minPct: number;
  maxPct: number;
  status: CompositionStatusType;
  diffPct: number;
  statusText: string;
}

export function evaluateComposition(
  metal: 'NI' | 'CO' | 'LC' | 'MN' | 'CU',
  currentPct: number,
  targetRange: TargetCompositionRange = DEFAULT_COMPOSITION_TARGETS[metal]
): CompositionEvaluation {
  const { minPct, maxPct, name } = targetRange;
  
  if (currentPct < minPct) {
    const diff = minPct - currentPct;
    return {
      metal,
      name,
      currentPct,
      minPct,
      maxPct,
      status: 'UNDER',
      diffPct: Number(diff.toFixed(1)),
      statusText: `${diff.toFixed(1)}% 미달`
    };
  }
  
  if (currentPct > maxPct) {
    const diff = currentPct - maxPct;
    return {
      metal,
      name,
      currentPct,
      minPct,
      maxPct,
      status: 'OVER',
      diffPct: Number(diff.toFixed(1)),
      statusText: `${diff.toFixed(1)}% 초과`
    };
  }
  
  return {
    metal,
    name,
    currentPct,
    minPct,
    maxPct,
    status: 'OPTIMAL',
    diffPct: 0,
    statusText: '적정'
  };
}
