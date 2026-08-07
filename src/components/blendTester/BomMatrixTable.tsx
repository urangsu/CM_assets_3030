import React, { useState } from 'react';
import { BomItem, DEFAULT_BOM_ITEMS } from '../../lib/operation/blendStorage';
import { parseBomMatrixPasteText } from '../../lib/operation/bomMatrixParser';
import { ComputedBomItemResult } from '../../lib/operation/blendEngine';
import { Clipboard, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface BomMatrixTableProps {
  items: BomItem[];
  computedItems?: ComputedBomItemResult[];
  onItemsChange: (items: BomItem[]) => void;
  totalProductionTon: number;
}

export const BomMatrixTable: React.FC<BomMatrixTableProps> = ({
  items,
  computedItems,
  onItemsChange,
  totalProductionTon
}) => {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showMinorMetals, setShowMinorMetals] = useState(false); // Collapsible Mn/Cu

  const displayItems = computedItems || items.map(i => ({
    id: i.id,
    category: i.category,
    itemName: i.itemName || i.name,
    unit: i.unit,
    coefficients: i.coefficients || {},
    unitPrice: i.unitPrice,
    usageQty: i.usageQty || 0,
    costAmount: i.costAmount || 0,
    unitPerTonProduct: i.unitPerTonProduct || 0,
    variableCostPerTon: i.variableCostPerTon || 0
  }));

  const handleResetToStandard = () => {
    if (confirm('BOM 설정을 표준 템플릿으로 초기화하시겠습니까? (현재 변경사항은 초기화됩니다)')) {
      onItemsChange(DEFAULT_BOM_ITEMS);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    const parsed = parseBomMatrixPasteText(pasteText);
    if (parsed.items.length > 0) {
      const convertedItems: BomItem[] = parsed.items.map(m => ({
        id: m.id,
        category: m.category,
        name: m.itemName,
        itemName: m.itemName,
        unit: m.unit,
        coefficients: m.coefficients,
        unitPrice: m.unitPrice,
        usageMode: 'AUTO'
      }));
      onItemsChange(convertedItems);
    }
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleAddItem = () => {
    const newItem: BomItem = {
      id: 'bom_m_' + Date.now().toString(36),
      category: '부재료',
      name: '새 BOM 품목',
      itemName: '새 BOM 품목',
      unit: 'kg',
      coefficients: {},
      unitPrice: 0,
      usageMode: 'AUTO'
    };
    onItemsChange([...items, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    onItemsChange(items.filter(i => i.id !== id));
  };

  const handleItemFieldChange = (id: string, field: string, val: any) => {
    const updated = items.map(i => {
      if (i.id !== id) return i;
      if (field.startsWith('coeff.')) {
        const metalKey = field.split('.')[1] as 'NI' | 'CO' | 'LC' | 'MN' | 'CU';
        const coeffs = { ...(i.coefficients || {}) };
        if (val === '' || val === undefined || isNaN(Number(val))) {
          delete coeffs[metalKey];
        } else {
          coeffs[metalKey] = Number(val);
        }
        return { ...i, coefficients: coeffs };
      }
      return { ...i, [field]: val };
    });
    onItemsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">
            제품별 BOM 원단위 Matrix ({items.length}개 항목)
          </span>
          <button
            type="button"
            onClick={() => setShowMinorMetals(!showMinorMetals)}
            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold flex items-center gap-1"
          >
            {showMinorMetals ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{showMinorMetals ? '마이너 금속 접기 (Mn, Cu)' : '마이너 금속 펼치기 (Mn, Cu)'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToStandard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 text-xs font-semibold rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            표준 BOM 템플릿 복원
          </button>
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium rounded transition-colors"
          >
            <Clipboard className="w-3.5 h-3.5" />
            Excel Matrix 붙여넣기
          </button>
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            행 추가
          </button>
        </div>
      </div>

      {/* Single Unified Matrix Table */}
      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-xs">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
            <tr>
              <th className="p-2 w-20">구분</th>
              <th className="p-2 min-w-[140px]">부원료명</th>
              <th className="p-2 text-center w-14">니켈</th>
              <th className="p-2 text-center w-14">코발트</th>
              <th className="p-2 text-center w-14">탄산리튬</th>
              {showMinorMetals && <th className="p-2 text-center w-14">망간</th>}
              {showMinorMetals && <th className="p-2 text-center w-14">구리</th>}
              <th className="p-2 text-center w-12">단위</th>
              <th className="p-2 text-center w-20">계산모드</th>
              <th className="p-2 text-right w-24">사용량</th>
              <th className="p-2 text-right w-24">단가(원)</th>
              <th className="p-2 text-right w-28">재료비(원)</th>
              <th className="p-2 text-right w-20">원단위</th>
              <th className="p-2 text-right w-24">톤당변동비</th>
              <th className="p-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={showMinorMetals ? 15 : 13} className="p-8 text-center text-slate-400">
                  BOM 데이터가 없습니다. 상단 'Excel Matrix 붙여넣기' 또는 '행 추가'를 이용하세요.
                </td>
              </tr>
            ) : (
              displayItems.map((item, idx) => {
                const sourceItem = items.find(i => i.id === item.id) || (item as any);
                const coeffs = sourceItem.coefficients || item.coefficients || {};
                const isManual = sourceItem.usageMode === 'MANUAL';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 font-medium text-slate-800">
                      <select
                        value={sourceItem.category}
                        onChange={e => handleItemFieldChange(item.id, 'category', e.target.value)}
                        className="p-1 border border-slate-200 rounded text-xs"
                      >
                        <option value="원재료">원재료</option>
                        <option value="부재료">부재료</option>
                        <option value="조업재료">조업재료</option>
                        <option value="유틸리티">유틸리티</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={sourceItem.itemName || sourceItem.name || ''}
                        onChange={e => {
                          handleItemFieldChange(item.id, 'itemName', e.target.value);
                          handleItemFieldChange(item.id, 'name', e.target.value);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-xs font-medium text-slate-900"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        value={coeffs.NI ?? ''}
                        placeholder="-"
                        onChange={e => handleItemFieldChange(item.id, 'coeff.NI', e.target.value)}
                        className="w-12 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                        step="0.001"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        value={coeffs.CO ?? ''}
                        placeholder="-"
                        onChange={e => handleItemFieldChange(item.id, 'coeff.CO', e.target.value)}
                        className="w-12 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                        step="0.001"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        value={coeffs.LC ?? ''}
                        placeholder="-"
                        onChange={e => handleItemFieldChange(item.id, 'coeff.LC', e.target.value)}
                        className="w-12 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                        step="0.001"
                      />
                    </td>
                    {showMinorMetals && (
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={coeffs.MN ?? ''}
                          placeholder="-"
                          onChange={e => handleItemFieldChange(item.id, 'coeff.MN', e.target.value)}
                          className="w-12 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                          step="0.001"
                        />
                      </td>
                    )}
                    {showMinorMetals && (
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={coeffs.CU ?? ''}
                          placeholder="-"
                          onChange={e => handleItemFieldChange(item.id, 'coeff.CU', e.target.value)}
                          className="w-12 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                          step="0.001"
                        />
                      </td>
                    )}
                    <td className="p-2 text-center">
                      <input
                        type="text"
                        value={sourceItem.unit || 'kg'}
                        onChange={e => handleItemFieldChange(item.id, 'unit', e.target.value)}
                        className="w-12 p-1 text-center border border-slate-200 rounded text-xs font-mono"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <select
                        value={sourceItem.usageMode || 'AUTO'}
                        onChange={e => handleItemFieldChange(item.id, 'usageMode', e.target.value)}
                        className={`p-1 border rounded text-[11px] font-bold ${
                          isManual ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="AUTO">AUTO</option>
                        <option value="MANUAL">수동</option>
                      </select>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {isManual ? (
                        <input
                          type="number"
                          value={sourceItem.manualUsageQty ?? 0}
                          onChange={e => handleItemFieldChange(item.id, 'manualUsageQty', Number(e.target.value))}
                          className="w-20 p-1 text-right border border-purple-300 bg-purple-50/50 rounded font-mono text-xs text-purple-900 font-bold"
                        />
                      ) : (
                        <span className="text-slate-800 font-semibold">{Math.round(item.usageQty || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono">
                      <input
                        type="number"
                        value={sourceItem.unitPrice || 0}
                        onChange={e => handleItemFieldChange(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-20 p-1 text-right border border-slate-200 rounded font-mono text-xs"
                      />
                    </td>
                    <td className="p-2 text-right font-mono font-medium text-slate-900">
                      {Math.round(item.costAmount || 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-600">
                      {(item.unitPerTonProduct || 0).toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-800">
                      {Math.round(item.variableCostPerTon || 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Excel Matrix 복사 붙여넣기</h3>
            <p className="text-xs text-slate-600">
              Excel의 BOM 매트릭스 범위(구분, 부원료, 니켈, 코발트, 탄산리튬, 망간, 구리, 단위, 단가)를 복사하여 아래에 붙여넣으세요.
            </p>
            <textarea
              rows={8}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`구분\t부원료\t니켈\t코발트\t탄산리튬\t망간\t구리\t단위\t단가\n부재료\t황산\t2.33\t2.33\t1.56\t-\t-\tkg\t180`}
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium rounded-lg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium rounded-lg"
              >
                파싱 및 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
