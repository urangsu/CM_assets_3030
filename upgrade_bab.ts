import fs from 'fs';

const file = 'src/pages/BusinessActivityBudget.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('AppTable')) {
  const importsTarget = `import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';`;
  const importsReplace = `import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppTable, AppTableHeader, AppTableRow, AppTableHead, AppTableBody, AppTableCell } from '../components/ui/AppTable';`;
  code = code.replace(importsTarget, importsReplace);
}

// target string
const tableTarget = `<table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f9fafb]">
                <th className="border p-1 w-8">선택</th>
                <th className="border p-1 w-20">구분</th>
                <th className="border p-1 w-24">부서코드</th>
                <th className="border p-1" style={{ width: deptNameWidth }}>
                  <ResizableHeader title="부서명" width={deptNameWidth} minWidth={100} onResize={setDeptNameWidth} />
                </th>
                {Array.from({length: 12}).map((_, i) => <th key={i} className="border p-1 text-center w-12">{i+1}월</th>)}
                <th className="border p-1 text-center w-20">합계</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(headcounts).filter(deptCode => {
                if (categoryFilter === '전체') return true;
                return headcounts[deptCode].category === categoryFilter;
              }).sort((a, b) => a.localeCompare(b)).map((deptCode, rowIndex) => {
                const dept = allDepts.find(d => d.code === deptCode);
                
                return (
                  <tr key={deptCode}>
                    <td className="border p-1 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedDepts.includes(deptCode)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDepts([...selectedDepts, deptCode]);
                          else setSelectedDepts(selectedDepts.filter(d => d !== deptCode));
                        }}
                      />
                    </td>
                    <td className="border p-1">
                      <select 
                        value={headcounts[deptCode]?.category || '판관'}
                        onChange={(e) => {
                          const newHeadcounts = {...headcounts};
                          newHeadcounts[deptCode].category = e.target.value as '제조' | '판관';
                          setHeadcounts(newHeadcounts);
                        }}
                        className="w-full p-0.5 border rounded"
                      >
                        <option value="제조">제조</option>
                        <option value="판관">판관</option>
                      </select>
                    </td>
                    <td className="border p-1">{deptCode}</td>
                    <td className="border p-1">{dept?.name || '알 수 없음'}</td>
                    {Array.from({length: 12}).map((_, i) => (
                      <td key={i} className="border p-0">
                        <input 
                          id={\`cell-\${rowIndex}-\${i}\`}
                          type="text"
                          value={headcounts[deptCode]?.data[i] || 0}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, i)}
                          onChange={(e) => {
                            let valStr = e.target.value.replace(/,/g, '');
                            if (valStr === '' || valStr === '-') valStr = '0';
                            const val = Number(valStr);
                            if (val < 0) return;
                            const newHeadcounts = {...headcounts};
                            newHeadcounts[deptCode].data[i] = val;
                            setHeadcounts(newHeadcounts);
                          }}
                          className="w-full p-0.5 text-right text-xs"
                        />
                      </td>
                    ))}
                    <td className="border p-1 text-right font-bold bg-[#f9fafb]">
                      {(headcounts[deptCode]?.data.reduce((a, b) => a + b, 0) || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>`;

const tableReplace = `<AppTable className="text-xs">
            <AppTableHeader>
              <tr>
                <AppTableHead className="w-8 sticky left-0 z-20">선택</AppTableHead>
                <AppTableHead className="w-20 sticky left-8 z-20">구분</AppTableHead>
                <AppTableHead className="w-24 sticky left-[112px] z-20">부서코드</AppTableHead>
                <AppTableHead className="p-0 sticky left-[208px] z-20 bg-lithium-50" style={{ width: deptNameWidth, minWidth: deptNameWidth }}>
                  <ResizableHeader title="부서명" width={deptNameWidth} minWidth={100} onResize={setDeptNameWidth} />
                </AppTableHead>
                {Array.from({length: 12}).map((_, i) => <AppTableHead key={i} className="text-center w-[72px] min-w-[72px]">{i+1}월</AppTableHead>)}
                <AppTableHead className="text-right w-28 min-w-[112px] sticky right-0 z-20 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] bg-lithium-50">합계</AppTableHead>
              </tr>
            </AppTableHeader>
            <AppTableBody className="divide-y divide-lithium-100">
              {Object.keys(headcounts).filter(deptCode => {
                if (categoryFilter === '전체') return true;
                return headcounts[deptCode].category === categoryFilter;
              }).sort((a, b) => a.localeCompare(b)).map((deptCode, rowIndex) => {
                const dept = allDepts.find(d => d.code === deptCode);
                const sum = headcounts[deptCode]?.data.reduce((a, b) => a + b, 0) || 0;
                const isSelected = selectedDepts.includes(deptCode);
                
                return (
                  <AppTableRow key={deptCode} className={isSelected ? 'bg-lithium-50' : 'hover:bg-lithium-50/50'}>
                    <AppTableCell className="text-center sticky left-0 z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDepts([...selectedDepts, deptCode]);
                          else setSelectedDepts(selectedDepts.filter(d => d !== deptCode));
                        }}
                      />
                    </AppTableCell>
                    <AppTableCell className="p-1 sticky left-8 z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">
                      <select 
                        value={headcounts[deptCode]?.category || '판관'}
                        onChange={(e) => {
                          const newHeadcounts = {...headcounts};
                          newHeadcounts[deptCode].category = e.target.value as '제조' | '판관';
                          setHeadcounts(newHeadcounts);
                        }}
                        className="w-full p-1 border border-lithium-200 rounded text-xs bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="제조">제조</option>
                        <option value="판관">판관</option>
                      </select>
                    </AppTableCell>
                    <AppTableCell className="text-lithium-600 font-mono sticky left-[112px] z-10 bg-inherit shadow-[1px_0_0_#F0F1F3]">{deptCode}</AppTableCell>
                    <AppTableCell className="font-medium sticky left-[208px] z-10 bg-inherit shadow-[1px_0_0_#F0F1F3] truncate" style={{ maxWidth: deptNameWidth, minWidth: deptNameWidth }}>{dept?.name || '알 수 없음'}</AppTableCell>
                    {Array.from({length: 12}).map((_, i) => {
                      const val = headcounts[deptCode]?.data[i] || 0;
                      return (
                        <AppTableCell key={i} className="p-0 border-r border-lithium-100 last:border-r-0">
                          <input 
                            id={\`cell-\${rowIndex}-\${i}\`}
                            type="text"
                            value={val === 0 ? '' : val.toLocaleString()}
                            placeholder="0"
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, i)}
                            onChange={(e) => {
                              let valStr = e.target.value.replace(/,/g, '');
                              const numVal = parseInt(valStr || '0', 10);
                              if (isNaN(numVal) || numVal < 0) return;
                              const newHeadcounts = {...headcounts};
                              newHeadcounts[deptCode].data[i] = numVal;
                              setHeadcounts(newHeadcounts);
                            }}
                            className={\`w-full h-10 px-2 text-right tabular-nums text-xs bg-transparent hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 \${val === 0 ? 'text-lithium-400' : 'text-eco-black font-medium'}\`}
                          />
                        </AppTableCell>
                      );
                    })}
                    <AppTableCell className={\`text-right font-bold tabular-nums sticky right-0 z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] \${sum > 0 ? 'text-brand-600 bg-brand-50/50' : 'text-lithium-400 bg-lithium-50/50'}\`}>
                      {sum.toLocaleString()}
                    </AppTableCell>
                  </AppTableRow>
                );
              })}
            </AppTableBody>
          </AppTable>`;

code = code.replace(tableTarget, tableReplace);

fs.writeFileSync(file, code);
