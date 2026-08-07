import React from 'react';
import { BlendScenario, BomItem } from '../../lib/operation/blendStorage';
import { BlendCalculationResult } from '../../lib/operation/blendEngine';
import { BomMatrixTable } from './BomMatrixTable';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
  onChangeScenario: (updated: BlendScenario) => void;
}

export const BomSheet: React.FC<Props> = ({ scenario, calculation, onChangeScenario }) => {
  const bomItems = scenario.bomSnapshot?.items || [];

  const handleItemsChange = (newItems: BomItem[]) => {
    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        ...scenario.bomSnapshot,
        items: newItems,
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">BOM 원단위 매트릭스 설정</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          완제품(탄산리튬, 황산니켈 등) 생산량 대비 부원료/유틸리티 투입 원단위를 설정합니다.
        </p>
      </div>

      <BomMatrixTable
        items={bomItems}
        computedItems={calculation.computedBomItems}
        onItemsChange={handleItemsChange}
        totalProductionTon={calculation.totalProductionTon}
      />
    </div>
  );
};
