import fs from 'fs';

const file = 'src/pages/VarianceComparison.tsx';
let code = fs.readFileSync(file, 'utf8');

if(!code.includes('isInvestmentAccount')) {
  code = code.replace(/import \{ INITIAL_CATEGORIES \} from '\.\/AccountSelection';/, "import { INITIAL_CATEGORIES } from './AccountSelection';\nimport { isInvestmentAccount } from '../lib/accountMaster';");
}

let target = `              if (selectedAccountCategory !== 'all') {
                if (catName !== selectedAccountCategory) return;
              }`;
let replacement = `              if (selectedAccountCategory !== 'all') {
                if (selectedAccountCategory === '투자예산') {
                  if (!isInvestmentAccount(item.accountCode)) return;
                } else if (selectedAccountCategory === '일반비용') {
                  if (isInvestmentAccount(item.accountCode)) return;
                } else {
                  if (catName !== selectedAccountCategory) return;
                }
              }`;

code = code.replace(target, replacement);

let target2 = `              if (selectedAccountCategory !== 'all') {
                if (catName !== selectedAccountCategory) return;
              }`;

let replacement2 = `              if (selectedAccountCategory !== 'all') {
                if (selectedAccountCategory === '투자예산') {
                  if (!isInvestmentAccount(row.code)) return;
                } else if (selectedAccountCategory === '일반비용') {
                  if (isInvestmentAccount(row.code)) return;
                } else {
                  if (catName !== selectedAccountCategory) return;
                }
              }`;

code = code.replace(target2, replacement2);

fs.writeFileSync(file, code);
