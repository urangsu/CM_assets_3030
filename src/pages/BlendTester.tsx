import React, { useState, useEffect } from 'react';
import { BlendStorage, BlendScenario } from '../lib/operation/blendStorage';
import { calculateBlendResult } from '../lib/operation/blendEngine';
import { BlendMaterialSheet } from '../components/blendTester/BlendMaterialSheet';
import { MetalAssumptionsSheet } from '../components/blendTester/MetalAssumptionsSheet';
import { BomSheet } from '../components/blendTester/BomSheet';
import { BlendResultsSheet } from '../components/blendTester/BlendResultsSheet';
import { ScenarioComparisonTab } from '../components/blendTester/ScenarioComparisonTab';
import {
  Layers,
  FlaskConical,
  DollarSign,
  FileSpreadsheet,
  PieChart,
  Copy,
  Plus,
  Trash2,
  Save,
  ArrowLeftRight,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const BlendTester: React.FC = () => {
  const [scenarios, setScenarios] = useState<BlendScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('sc_1');
  const [activeSheetTab, setActiveSheetTab] = useState<'material' | 'metal' | 'bom' | 'results' | 'compare'>('material');

  // Load scenarios on mount
  useEffect(() => {
    const loaded = BlendStorage.getScenarios();
    setScenarios(loaded);
    if (loaded.length > 0 && !loaded.some(s => s.id === activeScenarioId)) {
      setActiveScenarioId(loaded[0].id);
    }
  }, []);

  const handleUpdateScenario = (updatedScenario: BlendScenario) => {
    const newScenarios = scenarios.map(s => (s.id === updatedScenario.id ? updatedScenario : s));
    setScenarios(newScenarios);
    BlendStorage.saveScenarios(newScenarios);
  };

  const handleSaveAll = () => {
    BlendStorage.saveScenarios(scenarios.map(s => ({ ...s, isDirty: false })));
    setScenarios(scenarios.map(s => ({ ...s, isDirty: false })));
    alert('모든 배합 시나리오 설정이 저장되었습니다.');
  };

  // Clone Scenario 1 into active scenario or add new
  const handleCopyFromScenario1 = () => {
    const s1 = scenarios.find(s => s.id === 'sc_1') || scenarios[0];
    if (!s1) return;

    const activeScenario = scenarios.find(s => s.id === activeScenarioId);
    if (!activeScenario) return;

    if (activeScenario.id === s1.id) {
      alert('시나리오 1 자기를 복사할 수 없습니다. 시나리오 2 등의 다른 시나리오 탭에서 실행하세요.');
      return;
    }

    if (!confirm(`Scenario 1의 원료배합, 금속시세, BOM 설정을 [${activeScenario.name}]로 복사하시겠습니까? (기존 설정은 덮어씌워집니다)`)) {
      return;
    }

    const cloned = BlendStorage.cloneScenario(s1, activeScenario.name);
    cloned.id = activeScenario.id; // Keep current scenario id

    handleUpdateScenario(cloned);
  };

  const handleAddNewScenario = () => {
    const baseScenario = scenarios[0] || BlendStorage.createDefaultScenarios()[0];
    const newScenario = BlendStorage.cloneScenario(baseScenario, `Scenario ${scenarios.length + 1}`);
    const updated = [...scenarios, newScenario];
    setScenarios(updated);
    BlendStorage.saveScenarios(updated);
    setActiveScenarioId(newScenario.id);
  };

  const handleDeleteScenario = (idToDelete: string) => {
    if (scenarios.length <= 1) {
      alert('최소 1개의 시나리오는 유지되어야 합니다.');
      return;
    }
    if (!confirm('이 배합 시나리오를 삭제하시겠습니까?')) return;

    const updated = scenarios.filter(s => s.id !== idToDelete);
    setScenarios(updated);
    BlendStorage.saveScenarios(updated);
    if (activeScenarioId === idToDelete) {
      setActiveScenarioId(updated[0].id);
    }
  };

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const activeCalculation = activeScenario ? calculateBlendResult(activeScenario) : null;

  return (
    <div className="space-y-4 p-4 md:p-6 bg-[#f8fafc] min-h-screen font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-250 rounded-xl p-4 md:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-[#00786F]" />
              <span>배합테스터 (Blend Tester)</span>
              <span className="text-xs bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                통합 시뮬레이션
              </span>
            </h1>
            <p className="text-xs text-zinc-600">
              원자재 수불부 단가 연계 → 원료배합 시뮬레이션 → 금속가격·프리미엄 가정 → BOM 변동비 반영 → 예상 수익성 종합분석
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Year/Month Context Selector */}
            {activeScenario && (
              <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-lg text-xs font-bold text-zinc-800">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span>적용년월:</span>
                <select
                  value={activeScenario.year}
                  onChange={(e) => handleUpdateScenario({ ...activeScenario, year: e.target.value, isDirty: true })}
                  className="bg-white px-2 py-1 rounded border border-zinc-300 font-mono"
                >
                  {['2025', '2026', '2027'].map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select
                  value={activeScenario.month}
                  onChange={(e) => handleUpdateScenario({ ...activeScenario, month: Number(e.target.value), isDirty: true })}
                  className="bg-white px-2 py-1 rounded border border-zinc-300 font-mono"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
              </div>
            )}

            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00786F] hover:bg-[#005f58] text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>전체 설정 저장</span>
            </button>
          </div>
        </div>

        {/* Top Scenario Tabs Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {scenarios.map((s, idx) => {
              const isActive = activeSheetTab !== 'compare' && s.id === activeScenarioId;
              return (
                <div key={s.id} className="relative group flex items-center">
                  <button
                    onClick={() => {
                      setActiveScenarioId(s.id);
                      if (activeSheetTab === 'compare') setActiveSheetTab('material');
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg text-xs font-bold border transition-all ${
                      isActive
                        ? 'bg-[#00786F] text-white border-[#00786F] shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{s.name}</span>
                    {s.isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="수정사항 있음" />}
                  </button>
                  {scenarios.length > 1 && (
                    <button
                      onClick={() => handleDeleteScenario(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 transition-opacity ml-0.5"
                      title="시나리오 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleAddNewScenario}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-dashed border-zinc-300 hover:border-zinc-500 text-zinc-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 시나리오</span>
            </button>
          </div>

          {/* Comparison Tab Button & Clone Action */}
          <div className="flex items-center gap-2">
            {activeSheetTab !== 'compare' && activeScenario && activeScenario.id !== 'sc_1' && (
              <button
                onClick={handleCopyFromScenario1}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                title="Scenario 1의 원료배합/금속/BOM 설정을 그대로 가져옵니다"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Scenario 1 불러오기 (복사)</span>
              </button>
            )}

            <button
              onClick={() => setActiveSheetTab('compare')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                activeSheetTab === 'compare'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                  : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
              <span>시나리오 비교 [Compare]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Content Area */}
      {activeSheetTab === 'compare' ? (
        <ScenarioComparisonTab scenarios={scenarios} />
      ) : (
        <div className="bg-white border border-zinc-250 rounded-xl p-4 md:p-5 shadow-xs space-y-4">
          {/* Sub-tabs Workbook Bar */}
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 text-xs">
            {[
              { id: 'material', label: '① 원료배합 (Input)', icon: FlaskConical },
              { id: 'metal', label: '② 금속가격·프리미엄 (Prices)', icon: DollarSign },
              { id: 'bom', label: '③ BOM 및 변동비 (BOM)', icon: FileSpreadsheet },
              { id: 'results', label: '④ 시뮬레이션 결과 (Results)', icon: PieChart }
            ].map(tab => {
              const Icon = tab.icon;
              const isSubActive = activeSheetTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSheetTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
                    isSubActive
                      ? 'bg-teal-50 text-[#00786F] border border-teal-200 shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Render Active Sheet */}
          {activeScenario && activeCalculation && (
            <>
              {activeSheetTab === 'material' && (
                <BlendMaterialSheet
                  scenario={activeScenario}
                  calculation={activeCalculation}
                  onChangeScenario={handleUpdateScenario}
                />
              )}

              {activeSheetTab === 'metal' && (
                <MetalAssumptionsSheet
                  scenario={activeScenario}
                  calculation={activeCalculation}
                  onChangeScenario={handleUpdateScenario}
                />
              )}

              {activeSheetTab === 'bom' && (
                <BomSheet
                  scenario={activeScenario}
                  calculation={activeCalculation}
                  onChangeScenario={handleUpdateScenario}
                />
              )}

              {activeSheetTab === 'results' && (
                <BlendResultsSheet
                  scenario={activeScenario}
                  calculation={activeCalculation}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
