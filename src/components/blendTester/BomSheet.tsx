import React, { useState } from 'react';
import { BlendScenario, BomItem, BlendStorage, BomSnapshot } from '../../lib/operation/blendStorage';
import { BlendCalculationResult, parseBomPasteText, BomParseResult } from '../../lib/operation/blendEngine';
import { FileSpreadsheet, Download, Upload, Clipboard, Plus, Trash2, Save, FolderOpen, Check, AlertTriangle } from 'lucide-react';

interface Props {
  scenario: BlendScenario;
  calculation: BlendCalculationResult;
  onChangeScenario: (updated: BlendScenario) => void;
}

export const BomSheet: React.FC<Props> = ({ scenario, calculation, onChangeScenario }) => {
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [showMasterModal, setShowMasterModal] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [parseResult, setParseResult] = useState<BomParseResult | null>(null);

  const [bomMasterNameInput, setBomMasterNameInput] = useState<string>('');

  const bomItems = scenario.bomSnapshot?.items || [];

  const handleUpdateItem = (id: string, updates: Partial<BomItem>) => {
    const updatedItems = bomItems.map(item => {
      if (item.id === id) {
        const newItem = { ...item, ...updates };
        newItem.costAmount = newItem.usageQty * newItem.unitPrice;
        return newItem;
      }
      return item;
    });

    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        ...scenario.bomSnapshot,
        items: updatedItems,
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });
  };

  const handleAddItem = (category: '원재료' | '부재료' | '조업재료' | '유틸리티') => {
    const newItem: BomItem = {
      id: 'bom_manual_' + Math.random().toString(36).substring(2, 8),
      category,
      name: `${category} 신규항목`,
      unit: 'kg',
      usageQty: 100,
      unitPrice: 1000,
      costAmount: 100000,
      unitPerTonProduct: 0,
      variableCostPerTon: 100000
    };

    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        ...scenario.bomSnapshot,
        items: [...bomItems, newItem],
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });
  };

  const handleDeleteItem = (id: string) => {
    const updatedItems = bomItems.filter(item => item.id !== id);
    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        ...scenario.bomSnapshot,
        items: updatedItems,
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });
  };

  const handleTextChange = (text: string) => {
    setPasteText(text);
    if (text.trim().length > 0) {
      setParseResult(parseBomPasteText(text));
    } else {
      setParseResult(null);
    }
  };

  const handleApplyPaste = (mode: 'replace' | 'merge') => {
    if (!parseResult || parseResult.items.length === 0) return;

    let newItems: BomItem[] = [];
    if (mode === 'replace') {
      newItems = parseResult.items;
    } else {
      newItems = [...bomItems, ...parseResult.items];
    }

    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        ...scenario.bomSnapshot,
        items: newItems,
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });

    setShowPasteModal(false);
    setPasteText('');
    setParseResult(null);
  };

  const handleSaveAsMaster = () => {
    if (!bomMasterNameInput.trim()) return;
    const masters = BlendStorage.getBomMasters();
    const newMaster: BomSnapshot = {
      id: 'bom_master_' + Date.now(),
      name: bomMasterNameInput.trim(),
      items: bomItems,
      updatedAt: new Date().toISOString()
    };
    BlendStorage.saveBomMasters([...masters, newMaster]);
    setBomMasterNameInput('');
    alert(`BOM 마스터 [${newMaster.name}] 저장이 완료되었습니다.`);
  };

  const handleLoadMaster = (master: BomSnapshot) => {
    onChangeScenario({
      ...scenario,
      bomSnapshot: {
        id: master.id,
        name: master.name,
        items: JSON.parse(JSON.stringify(master.items)),
        updatedAt: new Date().toISOString()
      },
      isDirty: true
    });
    setShowMasterModal(false);
  };

  const categories: Array<'원재료' | '부재료' | '조업재료' | '유틸리티'> = ['원재료', '부재료', '조업재료', '유틸리티'];

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-xs">
        <div className="flex items-center gap-2 font-bold text-zinc-800">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>BOM 및 변동비 마스터 ({bomItems.length}개 항목)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition-colors"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Excel / TSV 클립보드 붙여넣기</span>
          </button>

          <button
            onClick={() => setShowMasterModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-100 rounded font-semibold transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>BOM 마스터 불러오기 / 저장</span>
          </button>
        </div>
      </div>

      {/* Grouped Tables */}
      <div className="space-y-4">
        {categories.map(cat => {
          const groupItems = bomItems.filter(i => i.category === cat);
          const groupTotalCost = groupItems.reduce((sum, i) => sum + (i.usageQty * i.unitPrice), 0);

          return (
            <div key={cat} className="border border-zinc-250 rounded-lg bg-white overflow-hidden shadow-xs">
              <div className="bg-zinc-100 px-3 py-2 border-b border-zinc-250 flex justify-between items-center">
                <span className="font-bold text-xs text-zinc-900 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    cat === '원재료' ? 'bg-purple-600' :
                    cat === '부재료' ? 'bg-blue-600' :
                    cat === '조업재료' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`} />
                  {cat} ({groupItems.length}건)
                </span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-zinc-600">소계: <strong className="text-zinc-900">{groupTotalCost.toLocaleString()} 원</strong></span>
                  <button
                    onClick={() => handleAddItem(cat)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white border border-zinc-300 hover:bg-zinc-50 rounded text-[10px] font-bold text-zinc-700"
                  >
                    <Plus className="w-3 h-3" />
                    <span>추가</span>
                  </button>
                </div>
              </div>

              {groupItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse font-sans">
                    <thead className="bg-zinc-50 text-zinc-600 font-semibold border-b border-zinc-200">
                      <tr>
                        <th className="p-2 w-48 border-r border-zinc-200">부원료 / 항목명</th>
                        <th className="p-2 w-16 text-center border-r border-zinc-200">단위</th>
                        <th className="p-2 w-28 text-right border-r border-zinc-200 bg-amber-50/30 text-amber-900">사용량</th>
                        <th className="p-2 w-28 text-right border-r border-zinc-200">단가 (원)</th>
                        <th className="p-2 w-32 text-right border-r border-zinc-200 bg-teal-50/30 font-bold text-teal-950">재료비 (원)</th>
                        <th className="p-2 w-28 text-right border-r border-zinc-200">톤당 원단위</th>
                        <th className="p-2 w-32 text-right border-r border-zinc-200 font-bold text-zinc-800">톤당 변동비 (원/t)</th>
                        <th className="p-2 w-12 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {groupItems.map(item => {
                        const cost = item.usageQty * item.unitPrice;
                        const unitPerTon = calculation.totalProductionTon > 0 ? item.usageQty / calculation.totalProductionTon : 0;
                        const varCostPerTon = calculation.totalProductionTon > 0 ? cost / calculation.totalProductionTon : 0;

                        return (
                          <tr key={item.id} className="hover:bg-zinc-50/80">
                            <td className="p-1.5 font-medium border-r border-zinc-200">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                                className="w-full bg-transparent px-1 py-0.5 border border-transparent focus:border-zinc-300 rounded"
                              />
                            </td>
                            <td className="p-1 text-center border-r border-zinc-200">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                                className="w-12 text-center bg-transparent px-1 py-0.5 border border-transparent focus:border-zinc-300 rounded font-mono text-[10px]"
                              />
                            </td>
                            <td className="p-1 text-right border-r border-zinc-200 bg-amber-50/10 font-mono">
                              <input
                                type="number"
                                step="any"
                                value={item.usageQty}
                                onChange={(e) => handleUpdateItem(item.id, { usageQty: parseFloat(e.target.value) || 0 })}
                                className="w-full text-right font-mono font-bold text-amber-950 bg-white px-1.5 py-0.5 border border-amber-200 rounded"
                              />
                            </td>
                            <td className="p-1 text-right border-r border-zinc-200 font-mono">
                              <input
                                type="number"
                                step="any"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full text-right font-mono px-1.5 py-0.5 border border-zinc-200 rounded"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-teal-900 bg-teal-50/20 border-r border-zinc-200">
                              {Math.round(cost).toLocaleString()} 원
                            </td>
                            <td className="p-2 text-right font-mono text-zinc-600 border-r border-zinc-200">
                              {unitPerTon.toFixed(2)} {item.unit}/t
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-zinc-800 border-r border-zinc-200">
                              {Math.round(varCostPerTon).toLocaleString()} 원/t
                            </td>
                            <td className="p-1 text-center">
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-zinc-400 text-xs font-sans">
                  등록된 {cat} 항목이 없습니다. 항목을 추가하거나 클립보드로 붙여넣으세요.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-5 space-y-4 text-xs font-sans">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-emerald-600" />
                <span>Excel / TSV 데이터 붙여넣기</span>
              </h3>
              <button onClick={() => setShowPasteModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <p className="text-zinc-600">
              엑셀 표에서 <strong>[구분, 부원료명, 단위, 사용량, 단가]</strong> 컬럼을 복사(Ctrl+C)하여 아래에 붙여넣으세요(Ctrl+V).
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="엑셀에서 복사한 텍스트를 여기에 붙여넣으세요..."
              className="w-full p-2.5 font-mono text-xs border border-zinc-300 rounded focus:outline-emerald-500"
            />

            {parseResult && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded space-y-2">
                <div className="flex gap-4 font-bold text-xs">
                  <span className="text-emerald-700">✓ 유효 항목: {parseResult.validCount}건</span>
                  {parseResult.warningCount > 0 && (
                    <span className="text-amber-600">! 주의 항목: {parseResult.warningCount}건</span>
                  )}
                </div>
                {parseResult.warnings.length > 0 && (
                  <ul className="text-[11px] text-amber-700 list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded hover:bg-zinc-100 font-semibold"
              >
                취소
              </button>
              <div className="flex items-center gap-2">
                <button
                  disabled={!parseResult || parseResult.items.length === 0}
                  onClick={() => handleApplyPaste('merge')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded font-bold disabled:opacity-40"
                >
                  기존 BOM에 병합
                </button>
                <button
                  disabled={!parseResult || parseResult.items.length === 0}
                  onClick={() => handleApplyPaste('replace')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold disabled:opacity-40"
                >
                  BOM 전체 교체
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Save / Load Modal */}
      {showMasterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs font-sans">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-teal-600" />
                <span>BOM 마스터 저장 및 불러오기</span>
              </h3>
              <button onClick={() => setShowMasterModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            {/* Save current */}
            <div className="p-3 bg-teal-50 border border-teal-200 rounded space-y-2">
              <h4 className="font-bold text-teal-900 text-xs">현재 BOM을 마스터로 저장</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bomMasterNameInput}
                  onChange={(e) => setBomMasterNameInput(e.target.value)}
                  placeholder="예: 2026년 8월 신규공정 BOM"
                  className="flex-1 p-1.5 border border-teal-300 rounded text-xs bg-white"
                />
                <button
                  onClick={handleSaveAsMaster}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded"
                >
                  저장
                </button>
              </div>
            </div>

            {/* Load existing */}
            <div className="space-y-2">
              <h4 className="font-bold text-zinc-800 text-xs">저장된 BOM 마스터 목록</h4>
              <div className="max-h-48 overflow-y-auto divide-y divide-zinc-200 border border-zinc-200 rounded">
                {BlendStorage.getBomMasters().map(m => (
                  <div key={m.id} className="p-2.5 flex justify-between items-center hover:bg-zinc-50">
                    <div>
                      <div className="font-bold text-zinc-900">{m.name}</div>
                      <div className="text-[10px] text-zinc-500">항목수: {m.items.length}개 · {new Date(m.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={() => handleLoadMaster(m)}
                      className="px-3 py-1 bg-zinc-800 hover:bg-zinc-900 text-white rounded font-bold text-[11px]"
                    >
                      불러오기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
