import fs from 'fs';

const file = 'src/pages/BusinessActivityBudget.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Lock check function
const depsDeleteTarget = `  const deleteSelectedDepts = () => {
    if (selectedDepts.length === 0) {
      showAlert('삭제할 부서를 선택해주세요.');
      return;
    }
    showConfirm(\`\${selectedDepts.length}개의 부서를 삭제하시겠습니까?\`, () => {
      const next = { ...headcounts };
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];

      selectedDepts.forEach(deptCode => {
        delete next[deptCode];
        const storageKey = getBudgetDataKey(deptCode, year, planType);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const rows = JSON.parse(stored);
          const filtered = rows.filter((r: any) => !targetAccountCodes.includes(r.code));
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      });
      setHeadcounts(next);
      localStorage.setItem(\`budget_headcounts_\${year}_\${planType}\`, JSON.stringify(next));
      setSelectedDepts([]);
    });
  };`;

const depsDeleteReplace = `  const deleteSelectedDepts = () => {
    if (selectedDepts.length === 0) {
      showAlert('삭제할 부서를 선택해주세요.');
      return;
    }
    
    // Check lock
    for (const deptCode of selectedDepts) {
      if (isBudgetLocked(deptCode, year, planType)) {
        showAlert(\`[\${deptCode}] 부서는 제출/검토/확정/잠금 상태이므로 수정할 수 없습니다.\`);
        return;
      }
    }

    showConfirm(\`\${selectedDepts.length}개의 부서를 삭제하시겠습니까?\`, () => {
      const next = { ...headcounts };
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];

      selectedDepts.forEach(deptCode => {
        delete next[deptCode];
        const storageKey = getBudgetDataKey(deptCode, year, planType);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const rows = JSON.parse(stored);
          const filtered = rows.filter((r: any) => !(targetAccountCodes.includes(r.code) && r.sourceType === 'BUSINESS_ACTIVITY_AUTO'));
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      });
      setHeadcounts(next);
      localStorage.setItem(\`budget_headcounts_\${year}_\${planType}\`, JSON.stringify(next));
      setSelectedDepts([]);
    });
  };`;
code = code.replace(depsDeleteTarget, depsDeleteReplace);


const resetTarget = `  const reset = () => {
    showConfirm('정말 초기화하시겠습니까?', () => {
      setHeadcounts({});
      localStorage.removeItem(\`budget_headcounts_\${year}_\${planType}\`);
      
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
      allDepts.forEach(dept => {
        const storageKey = getBudgetDataKey(dept.code, year, planType);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const rows = JSON.parse(stored);
          const filtered = rows.filter((r: any) => !targetAccountCodes.includes(r.code));
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      });
    });
  };`;

const resetReplace = `  const reset = () => {
    // Check locks for any dept in headcounts
    for (const deptCode of Object.keys(headcounts)) {
      if (isBudgetLocked(deptCode, year, planType)) {
        showAlert(\`잠금 상태인 부서(\${deptCode})가 포함되어 초기화할 수 없습니다.\`);
        return;
      }
    }

    showConfirm('정말 초기화하시겠습니까?', () => {
      setHeadcounts({});
      localStorage.removeItem(\`budget_headcounts_\${year}_\${planType}\`);
      
      const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
      allDepts.forEach(dept => {
        const storageKey = getBudgetDataKey(dept.code, year, planType);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const rows = JSON.parse(stored);
          const filtered = rows.filter((r: any) => !(targetAccountCodes.includes(r.code) && r.sourceType === 'BUSINESS_ACTIVITY_AUTO'));
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      });
    });
  };`;
code = code.replace(resetTarget, resetReplace);


const applyTarget = `  const confirmApplyToBudget = () => {
    const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
    
    // 1. First, remove AUTO accounts from ALL departments
    allDepts.forEach(dept => {
      const storageKey = getBudgetDataKey(dept.code, year, planType);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const rows = JSON.parse(stored);
        // Only keep rows that are NOT the target accounts OR rows that are NOT auto-generated
        // Wait, here we only want to drop auto-generated target accounts.
        // If a user manually added 'A60624102', we want to keep it?
        // Let's assume we overwrite all auto ones.
        const filtered = rows.filter((r: any) => {
          if (!targetAccountCodes.includes(r.code)) return true;
          // if it's a target account, only keep it if it was NOT auto generated
          return r.sourceType !== 'BUSINESS_ACTIVITY_AUTO';
        });
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    });`;

const applyReplace = `  const confirmApplyToBudget = () => {
    const targetAccountCodes = ['A60624102', 'B52224102', 'A60601123', 'B52201123', 'A60601155', 'B52201155'];
    
    // Check lock
    for (const deptCode of Object.keys(headcounts)) {
      if (isBudgetLocked(deptCode, year, planType)) {
        showAlert(\`[\${deptCode}] 부서는 제출/검토/확정/잠금 상태이므로 반영할 수 없습니다.\`);
        return;
      }
    }

    // 1. First, remove AUTO accounts from ALL departments
    allDepts.forEach(dept => {
      const storageKey = getBudgetDataKey(dept.code, year, planType);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const rows = JSON.parse(stored);
        const filtered = rows.filter((r: any) => {
          if (!targetAccountCodes.includes(r.code)) return true;
          return r.sourceType !== 'BUSINESS_ACTIVITY_AUTO';
        });
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    });`;
code = code.replace(applyTarget, applyReplace);

fs.writeFileSync(file, code);
