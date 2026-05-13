import fs from 'fs';

const file = 'src/pages/BudgetCreation.tsx';
let code = fs.readFileSync(file, 'utf8');

const tableWrapperRegex = /(<div\s+className="overflow-x-auto p-4"\s+ref=\{gridRef\}\s+onPaste=\{handlePaste\}\s*>)/;
if (tableWrapperRegex.test(code)) {
  code = code.replace(tableWrapperRegex, `<div className="flex flex-row overflow-hidden flex-1 group">\n          <div \n            className="overflow-x-auto p-4 flex-1"\n            ref={gridRef}\n            onPaste={handlePaste}\n          >`);
  console.log("table wrapper start modified");
}

const tableWrapperEndRegex = /(<\/table>\s*<\/div>\s*\)\}\s*<\/div>\s*\{\/\* Copy Quantity Modal \*\/)/s;
const rightPanelCode = `</table>
          </div>
          {/* Detail Panel */}
          {isDetailsExpanded && (
            <div className="w-[300px] flex-shrink-0 border-l border-lithium-200 bg-lithium-50 flex flex-col h-full overflow-y-auto">
              <div className="p-4 border-b border-lithium-200 sticky top-0 bg-lithium-50 z-10 flex justify-between items-center">
                <h3 className="font-bold text-eco-black text-sm">상세 내역</h3>
                <button onClick={() => setIsDetailsExpanded(false)} className="text-lithium-500 hover:text-lithium-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex-1 space-y-4">
                {selectedRows.size === 1 ? (
                  data.filter(r => selectedRows.has(r.id)).map(selectedRow => {
                    return (
                      <div key={selectedRow.id} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">계정과목</label>
                          <div className="text-sm font-medium text-eco-black overflow-hidden text-ellipsis whitespace-nowrap" title={selectedRow.name}>
                            [{selectedRow.code}] {selectedRow.name}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">내역</label>
                          <textarea
                            value={selectedRow.detail || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'detail', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[80px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="상세 내역 입력..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">산출기준</label>
                          <textarea
                            value={selectedRow.calculation || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'calculation', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[80px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="산출기준 입력..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-lithium-600 mb-1">비고 (메모)</label>
                          <textarea
                            value={selectedRow.remark || ''}
                            onChange={(e) => handleTextChange(selectedRow.id, 'remark', e.target.value)}
                            disabled={selectedRow.isReadOnly || isLocked}
                            className="w-full text-sm border-lithium-200 rounded p-2 min-h-[60px] outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-lithium-100 disabled:text-lithium-500"
                            placeholder="메모 입력..."
                          />
                        </div>
                      </div>
                    );
                  })
                ) : selectedRows.size > 1 ? (
                  <div className="text-sm text-lithium-500 text-center py-10">
                    단일 행을 선택하면 상세 내역을 편집할 수 있습니다.
                  </div>
                ) : (
                  <div className="text-sm text-lithium-500 text-center py-10">
                    그리드에서 행을 선택해주세요.
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Copy Quantity Modal */}`;

if (tableWrapperEndRegex.test(code)) {
  code = code.replace(tableWrapperEndRegex, rightPanelCode);
  console.log("table wrapper end modified");
}

fs.writeFileSync(file, code);
