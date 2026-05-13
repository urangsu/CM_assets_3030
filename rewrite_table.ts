import fs from 'fs';

const file = 'src/pages/BudgetCreation.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace standard columns from 1478 (thead start) to 1608 (thead end)
const theadRegex = /(<table className="w-full text-left border-collapse".*?<thead>\s*<tr>).*?(<\/tr>\s*<\/thead>)/su;
const tbodyRegex = /(<td className=\{`sticky left-0 z-10.*?>\s*<div className="flex items-center justify-center h-full min-h-\[44px\]">\s*<input[^>]+>\s*<\/div>\s*<\/td>).*?(<td className=\{`sticky left-12 z-10[^>]+>\{row\.code\}<\/td>\s*<td className=\{`sticky left-36 z-10[^>]+>\{row\.name\}<\/td>).*?(<\/tr>)/su;

const newThead = `$1
                  <th className="sticky left-0 z-10 bg-lithium-50 p-0 border border-lithium-200 w-12">
                    <div className="flex items-center justify-center px-4 py-3 w-full">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-nickel-600 rounded border-gray-300 focus:ring-nickel-500 cursor-pointer"
                        checked={sortedData.length > 0 && selectedRows.size === sortedData.length}
                        onChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-16">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      연도
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-20">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      계획구분
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-20">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      예산유형
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-24">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      관리구분
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-28">
                    <div className="flex items-center justify-center px-4 py-3 text-xs font-semibold text-lithium-600 w-full whitespace-nowrap">
                      작성부서
                    </div>
                  </th>
                  <th className="bg-lithium-50 p-0 border border-lithium-200 w-28">
                    <div className="flex flex-col w-full">
                      <button 
                        onClick={() => handleSort('dept')}
                        className="flex items-center justify-center gap-1.5 px-4 pt-2 pb-1 text-xs font-semibold text-lithium-600 w-full hover:bg-lithium-100 transition-colors group border-b border-lithium-200"
                      >
                        귀속부서
                        {sortConfig.key === 'dept' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-nickel-500" /> : <ArrowDown className="w-3 h-3 text-nickel-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-lithium-300 opacity-0 group-hover:opacity-100" />
                        )}
                      </button>
                      {selectedDeptCode !== 'all' && (
                        <div className="px-2 py-1 bg-white">
                          <select 
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="w-full text-[10px] bg-lithium-50 border-none rounded p-1 focus:ring-1 focus:ring-nickel-500 outline-none font-medium"
                          >
                            <option value="all">전체 부서</option>
                            {allDepts.filter((d: any) => d.code !== '99999').map((dept: any) => (
                              <option key={dept.code} value={dept.code}>{dept.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="sticky left-12 z-10 bg-lithium-50 p-0 border border-lithium-200 w-24">
                    <button 
                      onClick={() => handleSort('code')}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-lithium-600 w-full hover:bg-lithium-100 transition-colors group"
                    >
                      계정코드
                      {sortConfig.key === 'code' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-nickel-500" /> : <ArrowDown className="w-3 h-3 text-nickel-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-lithium-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="sticky left-36 z-10 bg-lithium-50 p-0 border border-lithium-200" style={{ width: colWidths.name, minWidth: colWidths.name }}>
                    <ResizableHeader 
                      title="계정명" 
                      width={colWidths.name} 
                      minWidth={80} 
                      onResize={handleNameColResize} 
                    />
                  </th>
                  <th className="bg-brand-50 p-0 border border-[#e5e8eb] w-32">
                    <button 
                      onClick={() => handleSort('total')}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-brand-700 w-full hover:bg-brand-100 transition-colors group"
                    >
                      연간금액
                      {sortConfig.key === 'total' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-brand-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <th key={i} className="bg-[#f9fafb] p-0 border border-[#e5e8eb]" style={{ width: colWidths.months[i], minWidth: colWidths.months[i] }}>
                      <ResizableHeader 
                        title={\`\${i + 1}월\`} 
                        width={colWidths.months[i]} 
                        minWidth={60} 
                        onResize={(w: number) => handleMonthColResize(i, w)} 
                      />
                    </th>
                  ))}
$2`;

code = code.replace(theadRegex, newThead);

const newTbody = `$1
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">{year}</td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">{planType}</td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        <select 
                          value={row.budgetType || inferBudgetTypeByAccountCode(row.code)}
                          onChange={(e) => handleAttributedDeptChange(row.id, e.target.value)}
                          className="bg-transparent appearance-none text-center outline-none"
                          disabled
                        >
                          <option value="GENERAL">일반</option>
                          <option value="INVESTMENT">투자</option>
                        </select>
                      </td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        {row.managementCategory || inferManagementCategoryByAccountCode(row.code)}
                      </td>
                      <td className="bg-white px-4 py-2 text-sm border border-[#e5e8eb] text-center align-top whitespace-nowrap">
                        {currentDept.name}
                      </td>
                      <td className="bg-white p-0 border border-[#e5e8eb] text-center align-top">
                        {selectedDeptCode !== 'all' ? (
                          <select
                            value={row.attributedDeptCode}
                            onChange={(e) => handleAttributedDeptChange(row.id, e.target.value)}
                            disabled={(row.isReadOnly && planType !== '실적') || isLocked}
                            className={\`w-full h-full min-h-[44px] px-3 py-2 text-sm text-[#191f28] bg-transparent outline-none focus:ring-2 focus:ring-brand-500 appearance-none font-medium text-center \${((row.isReadOnly && planType !== '실적') || isLocked) ? 'bg-[#f9fafb] cursor-not-allowed' : ''}\`}
                          >
                            {allDepts.filter((d: any) => d.code !== '99999').map((dept: any) => (
                              <option key={dept.code} value={dept.code}>{dept.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="px-4 py-2 whitespace-nowrap">{deptName}</div>
                        )}
                      </td>$2
                      <td className="px-4 py-2 text-sm font-bold text-brand-700 border border-[#e5e8eb] text-right bg-brand-50/30 align-top">
                        {rowTotal.toLocaleString()}
                      </td>
                      {row.values.map((val: number, colIndex: number) => {
                        const actualKey = \`\${row.attributedDeptCode}_\${row.sourceDeptCode || row.attributedDeptCode}_\${row.code}\`;
                        const actualVal = actualsMap.get(actualKey)?.[colIndex];
                        return (
                          <td key={colIndex} className="p-0 border border-[#e5e8eb] align-top">
                            <div className="relative group h-full">
                              <input
                                id={\`cell-\${rowIndex}-\${colIndex}\`}
                                type="text"
                                value={formatNumber(val)}
                                onChange={(e) => {
                                  let valStr = e.target.value.replace(/,/g, '');
                                  if (valStr === '' || valStr === '-') valStr = '0';
                                  const num = Number(valStr);
                                  if (num < 0) return;
                                  handleCellChange(row.id, colIndex, e.target.value);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                onFocus={() => setFocusedCell({ rowIndex, colIndex })}
                                readOnly={row.isReadOnly || isLocked}
                                className={\`w-full h-full min-h-[44px] px-4 py-3 text-right text-sm outline-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:z-20 relative bg-transparent text-[#191f28] \${(row.isReadOnly || isLocked) ? 'bg-[#f9fafb] cursor-not-allowed' : ''}\`}
                                placeholder="0"
                              />
                              {planType === '실적' && row.budgetValues && row.budgetValues[colIndex] !== 0 && (
                                <div className="absolute bottom-0.5 left-1 pointer-events-none">
                                  <span className="text-[9px] text-gray-400 font-medium bg-gray-50 px-1 rounded leading-none">
                                    계획: {formatNumber(row.budgetValues[colIndex])}
                                  </span>
                                </div>
                              )}
                              {actualVal !== undefined && actualVal !== 0 && planType !== '실적' && (
                                <div className="absolute bottom-0.5 right-1 pointer-events-none">
                                  <span className="text-[9px] text-brand-500 font-bold bg-brand-50 px-1 rounded leading-none">
                                    실적: {actualVal.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} className="sticky left-0 z-10 bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-[#191f28] border border-[#e5e8eb] text-center">
                    합계
                  </td>
                  <td className="bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-brand-700 border border-[#e5e8eb] text-right">
                    {filteredAndSortedData.filter(r => !r.isHandedOver).reduce((sum, row) => sum + row.values.reduce((a: number, b: number) => a + b, 0), 0).toLocaleString()}
                  </td>
                  {Array.from({ length: 12 }).map((_, colIndex) => {
                    const colTotal = filteredAndSortedData.filter(r => !r.isHandedOver).reduce((sum, row) => sum + row.values[colIndex], 0);
                    return (
                      <td key={colIndex} className="bg-[#f2f4f6] px-4 py-3 text-sm font-bold text-[#191f28] border border-[#e5e8eb] text-right">
                        {colTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>`;

if (tbodyRegex.test(code)) {
    console.log("tbody regex matched");
} else {
    console.log("tbody regex DID NOT match");
}

code = code.replace(tbodyRegex, newTbody);
fs.writeFileSync(file, code);
console.log('Update done');
