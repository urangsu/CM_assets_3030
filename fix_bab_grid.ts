import fs from 'fs';

const file = 'src/pages/BusinessActivityBudget.tsx';
let code = fs.readFileSync(file, 'utf8');

// Import AppTable
const importsTarget = `import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';`;
const importsReplace = `import { INITIAL_CATEGORIES } from './AccountSelection';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppTable, AppTableHeader, AppTableRow, AppTableHead, AppTableBody, AppTableCell } from '../components/ui/AppTable';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { AppSelect } from '../components/ui/AppSelect';`;
code = code.replace(importsTarget, importsReplace);


// Setup table state
const stateTarget = `  const [deptNameWidth, setDeptNameWidth] = useState(200);`;
const stateReplace = `  const DEFAULT_WIDTHS = {
    deptName: 180,
    month: 60,
    category: 70,
    deptCode: 90
  };
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('business_activity_grid_widths');
    if (saved) return JSON.parse(saved);
    return DEFAULT_WIDTHS;
  });
  const updateWidth = (key: string, width: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [key]: width };
      localStorage.setItem('business_activity_grid_widths', JSON.stringify(next));
      return next;
    });
  };`;
code = code.replace(stateTarget, stateReplace);

// Fix Table Render and Logic
// Wait, replacing everything is tricky. I'll read the file content of `BusinessActivityBudget.tsx` and just write a new file instead of patching.
