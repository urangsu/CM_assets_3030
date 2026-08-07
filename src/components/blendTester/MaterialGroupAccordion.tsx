import React, { useState } from 'react';
import { BlendMaterialLine } from '../../lib/operation/blendStorage';
import { formatTonDisplay, formatPriceDisplay } from '../../lib/operation/blendUnitConversion';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface MaterialGroupAccordionProps {
  lines: BlendMaterialLine[];
  onLineChange: (id: string, updates: Partial<BlendMaterialLine>) => void;
  onSelectAllGroup?: (groupName: string, selected: boolean) => void;
}

const FIXED_GROUPS: Array<'BP' | 'BM' | 'LCO' | 'WET' | '기타'> = ['BP', 'BM', 'LCO', 'WET', '기타'];

export const MaterialGroupAccordion: React.FC<MaterialGroupAccordionProps> = ({
  lines,
  onLineChange,
  onSelectAllGroup
}) => {
  // Accordion state: by default collapsed (or BP open if requested)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    BP: false,
    BM: false,
    LCO: false,
    WET: false,
    기타: false
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Group lines by material group
  const groupedLines: Record<string, BlendMaterialLine[]> = {
    BP: [],
    BM: [],
    LCO: [],
    WET: [],
    기타: []
  };

  lines.forEach(line => {
    const grp = line.materialGroup || '기타';
    if (groupedLines[grp]) {
      groupedLines[grp].push(line);
    } else {
      groupedLines['기타'].push(line);
    }
  });

  return (
    <div className="space-y-3">
      {FIXED_GROUPS.map(group => {
        const groupItems = groupedLines[group] || [];

        // Hide empty groups if not one of the main 4 unless user explicitly wants to see empty ones
        if (group === '기타' && groupItems.length === 0) return null;

        const isOpen = !!openGroups[group];
        const selectedItems = groupItems.filter(i => i.selected && i.quantityTon > 0);
        const totalTon = selectedItems.reduce((sum, i) => sum + i.quantityTon, 0);

        // Weighted Average Unit Price in Million KRW / ton
        let weightedAvgPrice = 0;
        if (totalTon > 0) {
          const totalPrice = selectedItems.reduce((sum, i) => {
            const price = i.priceType === 'CUSTOM' ? (i.customUnitPrice ?? i.ledgerUnitPrice) : i.ledgerUnitPrice;
            return sum + (i.quantityTon * (price || 0));
          }, 0);
          weightedAvgPrice = totalPrice / totalTon;
        }

        const allSelected = groupItems.length > 0 && groupItems.every(i => i.selected);

        return (
          <div key={group} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
            {/* Accordion Header */}
            <div
              onClick={() => toggleGroup(group)}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label="Toggle group"
                >
                  {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <span className="font-bold text-slate-800 w-12">{group}</span>
                <span className="text-xs text-slate-500 font-mono">({groupItems.length}개 원료)</span>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-slate-500 text-xs mr-2">총 투입량:</span>
                  <span className="font-semibold text-emerald-800">{formatTonDisplay(totalTon)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs mr-2">평균단가:</span>
                  <span className="font-semibold text-slate-800">{formatPriceDisplay(weightedAvgPrice)} 백만원/t</span>
                </div>
              </div>
            </div>

            {/* Accordion Content */}
            {isOpen && (
              <div className="p-3 border-t border-slate-200 overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={e => onSelectAllGroup && onSelectAllGroup(group, e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="p-2">원료코드</th>
                      <th className="p-2">원료명</th>
                      <th className="p-2 text-right">투입량(t)</th>
                      <th className="p-2 text-right">단가(백만원/t)</th>
                      <th className="p-2 text-center">Ni%</th>
                      <th className="p-2 text-center">Co%</th>
                      <th className="p-2 text-center">Li%</th>
                      <th className="p-2 text-center">Mn%</th>
                      <th className="p-2 text-center">Cu%</th>
                      <th className="p-2 text-center font-normal">성부 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {groupItems.map(item => {
                      const hasComp = item.niPct !== undefined || item.coPct !== undefined || item.lcPct !== undefined;
                      const displayPrice = item.priceType === 'CUSTOM' ? (item.customUnitPrice ?? item.ledgerUnitPrice) : item.ledgerUnitPrice;

                      return (
                        <tr key={item.id} className={item.selected ? 'bg-white' : 'bg-slate-50/50 opacity-60'}>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={e => onLineChange(item.id, { selected: e.target.checked })}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-2 font-mono text-slate-800">{item.rawItemCode}</td>
                          <td className="p-2 font-medium text-slate-900">{item.rawItemName}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              value={item.quantityTon || 0}
                              onChange={e => onLineChange(item.id, { quantityTon: Math.max(0, Number(e.target.value)) })}
                              className="w-20 p-1 text-right border border-slate-300 rounded font-mono focus:ring-1 focus:ring-emerald-500"
                              min="0"
                              step="1"
                            />
                          </td>
                          <td className="p-2 text-right font-mono">
                            <input
                              type="number"
                              value={displayPrice || 0}
                              onChange={e => onLineChange(item.id, { priceType: 'CUSTOM', customUnitPrice: Number(e.target.value) })}
                              className="w-24 p-1 text-right border border-slate-300 rounded font-mono focus:ring-1 focus:ring-emerald-500"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              value={item.niPct ?? ''}
                              placeholder="-"
                              onChange={e => onLineChange(item.id, { niPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-14 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              value={item.coPct ?? ''}
                              placeholder="-"
                              onChange={e => onLineChange(item.id, { coPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-14 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              value={item.lcPct ?? ''}
                              placeholder="-"
                              onChange={e => onLineChange(item.id, { lcPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-14 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              value={item.mnPct ?? ''}
                              placeholder="-"
                              onChange={e => onLineChange(item.id, { mnPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-14 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              value={item.cuPct ?? ''}
                              placeholder="-"
                              onChange={e => onLineChange(item.id, { cuPct: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-14 p-1 text-center border border-slate-200 rounded font-mono text-xs"
                              step="0.1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {!hasComp ? (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded">
                                성분 미입력
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-xs">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
