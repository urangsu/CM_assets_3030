import fs from 'fs';

const file = 'src/pages/BudgetOverrunCheck.tsx';
let code = fs.readFileSync(file, 'utf8');

const thTarget = `                               <tr>
                                 <th className="px-3 py-2 text-left border-b border-lithium-200">월</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월예산</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월실적</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월초과금액</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월잔액</th>
                                 <th className="px-3 py-2 text-center border-b border-lithium-200">상태</th>
                               </tr>`;

const thReplace = `                               <tr>
                                 <th className="px-3 py-2 text-left border-b border-lithium-200">월</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월예산</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월실적</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월초과금액</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월미달금액</th>
                                 <th className="px-3 py-2 text-right border-b border-lithium-200">월잔액</th>
                                 <th className="px-3 py-2 text-center border-b border-lithium-200">상태</th>
                               </tr>`;

code = code.replace(thTarget, thReplace);

const tdTarget = `                                   <td className="px-3 py-2 text-eco-black font-medium">{m.month}월</td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.budget.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-right text-eco-black">{m.actual.toLocaleString()}원</td>
                                   <td className={\`px-3 py-2 text-right font-medium \${m.overrunAmount > 0 ? 'text-cobalt-600' : 'text-lithium-500'}\`}>
                                     {m.overrunAmount > 0 ? \`+\${m.overrunAmount.toLocaleString()}원\` : '-'}
                                   </td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.balance.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-center">
                                     <span className={\`inline-block px-2 py-0.5 rounded text-[10px] font-bold \${
                                       m.status === '정상' ? 'bg-lithium-100 text-lithium-600' :
                                       m.status === '무예산 집행' ? 'bg-cobalt-50 text-cobalt-600' :
                                       'bg-cobalt-100 text-cobalt-700'
                                     }\`}>{m.status}</span>
                                   </td>`;

const tdReplace = `                                   <td className="px-3 py-2 text-eco-black font-medium">{m.month}월</td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.budget.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-right text-eco-black">{m.actual.toLocaleString()}원</td>
                                   <td className={\`px-3 py-2 text-right font-medium \${m.overrunAmount > 0 ? 'text-cobalt-600' : 'text-lithium-400'}\`}>
                                     {m.overrunAmount > 0 ? \`+\${m.overrunAmount.toLocaleString()}원\` : '-'}
                                   </td>
                                   <td className={\`px-3 py-2 text-right font-medium \${m.shortfallAmount > 0 ? 'text-emerald-600' : 'text-lithium-400'}\`}>
                                     {m.shortfallAmount > 0 ? \`\${m.shortfallAmount.toLocaleString()}원\` : '-'}
                                   </td>
                                   <td className="px-3 py-2 text-right text-lithium-600">{m.balance.toLocaleString()}원</td>
                                   <td className="px-3 py-2 text-center">
                                     <span className={\`inline-block px-2 py-0.5 rounded text-[10px] font-bold \${
                                       m.status === '정상' ? 'bg-lithium-100 text-lithium-600' :
                                       m.status === '미달' ? 'bg-emerald-50 text-emerald-600' :
                                       m.status === '무예산 집행' ? 'bg-cobalt-50 text-cobalt-600' :
                                       'bg-cobalt-100 text-cobalt-700'
                                     }\`}>{m.status}</span>
                                   </td>`;

code = code.replace(tdTarget, tdReplace);

fs.writeFileSync(file, code);
