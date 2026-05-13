import fs from 'fs';

const file = 'src/pages/BudgetCreation.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /(const handlePaste = \(e: React\.ClipboardEvent\) => \{)[\s\S]*?(setData\(newData\);\n  \};)/;
const replacement = `$1
    if (isLocked) return;
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;

    const rows = clipboardData.replace(/\\r?\\n$/, '').split(/\\r?\\n/).map(row => row.split('\\t'));
    
    const newData = [...data];
    
    if (focusedCell) {
      const startRow = focusedCell.rowIndex;
      
      rows.forEach((row, rIdx) => {
        const targetRow = startRow + rIdx;
        if (targetRow < newData.length) {
          if (focusedCell.colIndex !== undefined) {
            // Pasting into month columns
            const startCol = focusedCell.colIndex;
            row.forEach((cell, cIdx) => {
              const targetCol = startCol + cIdx;
              if (targetCol < 12) {
                const val = parseFloat(cell.replace(/,/g, ''));
                if (!isNaN(val)) {
                  newData[targetRow].values[targetCol] = val;
                }
              }
            });
          } else if (focusedCell.field === 'detail') {
            newData[targetRow].detail = (row && row[0]) ? row[0] : '';
            if (row && row[1] !== undefined) newData[targetRow].calculation = row[1];
            for (let i = 0; i < 12; i++) {
              if (row && row[2 + i] !== undefined) {
                const val = parseFloat(row[2 + i].replace(/,/g, ''));
                if (!isNaN(val)) newData[targetRow].values[i] = val;
              }
            }
          } else if (focusedCell.field === 'calculation') {
            newData[targetRow].calculation = (row && row[0]) ? row[0] : '';
            for (let i = 0; i < 12; i++) {
              if (row && row[1 + i] !== undefined) {
                const val = parseFloat(row[1 + i].replace(/,/g, ''));
                if (!isNaN(val)) newData[targetRow].values[i] = val;
              }
            }
          }
        }
      });
    } else {
      rows.forEach((row, rowIndex) => {
        if (rowIndex < newData.length && row.length > 0) {
          // 24컬럼: 선택, 연도, 계획구분, 투자여부, 일반구분, 작성부서, 귀속부서, 계정과목코드, 계정과목, 내역, 산출기준, 금액, 1월~12월
          if (row.length >= 24) {
            const budgetTypeStr = row[3];
            const mgmtCategoryStr = row[4];
            
            newData[rowIndex].detail = row[9] || newData[rowIndex].detail || '';
            newData[rowIndex].calculation = row[10] || newData[rowIndex].calculation || '';
            
            const amountTotal = parseFloat((row[11] || '0').replace(/,/g, '')) || 0;
            
            let monthSum = 0;
            for (let i = 0; i < 12; i++) {
              if (row[12 + i] !== undefined) {
                const val = parseFloat(row[12 + i].replace(/,/g, ''));
                if (!isNaN(val)) {
                  newData[rowIndex].values[i] = val;
                  monthSum += val;
                }
              }
            }
            if (monthSum === 0 && amountTotal > 0) {
              // 1월~12월 값이 모두 비어있고 금액만 있으면 배분 필요 상태
            }
          } 
          // 12개월 데이터만 복사한 경우
          else if (row.length === 12) {
            row.forEach((cell, colIndex) => {
              const val = parseFloat(cell.replace(/,/g, ''));
              if (!isNaN(val)) {
                newData[rowIndex].values[colIndex] = val;
              }
            });
          } 
          // 그 외의 경우 (숫자 데이터 위주로 처리)
          else {
            row.forEach((cell, colIndex) => {
              const val = parseFloat(cell.replace(/,/g, ''));
              if (!isNaN(val) && colIndex < 12) {
                newData[rowIndex].values[colIndex] = val;
              }
            });
          }
        }
      });
    }
    setData(newData);
  };`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log("BudgetCreation handlePaste modified");
} else {
  console.log("Could not find handlePaste in BudgetCreation.tsx");
}
