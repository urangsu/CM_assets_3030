import fs from 'fs';

const file = 'src/pages/PlanActualUpload.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('inferManagementCategoryByAccountCode')) {
  code = code.replace(/import \{ INITIAL_CATEGORIES \} from '\.\/AccountSelection';/, "import { INITIAL_CATEGORIES } from './AccountSelection';\nimport { inferManagementCategoryByAccountCode } from '../lib/accountMaster';");
}

const targetStr = `const accountCode = String(row[3] || '');`;
const replacementStr = `const accountCode = String(row[3] || '');
        const autoControl = inferManagementCategoryByAccountCode(accountCode);
        const controlType = String(row[5] || '');
        const finalControlType = autoControl === '투자' ? '투자' : controlType;`;

code = code.replace(targetStr, replacementStr);
code = code.replace(/accountName: String\(row\[4\] \|\| ''\),\s*controlType: String\(row\[5\] \|\| ''\),/g, `accountName: String(row[4] || ''),
            controlType: typeof finalControlType !== 'undefined' ? finalControlType : String(row[5] || ''),`);

fs.writeFileSync(file, code);
