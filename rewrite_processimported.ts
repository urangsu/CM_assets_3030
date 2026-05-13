import fs from 'fs';

const file = 'src/pages/PlanActualUpload.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /(const processImportedData = \(rows: any\[\]\[\]\) => \{)[\s\S]*?(setValidationResult\(\{ validRows, warningRows, errorRows \}\);\n  \};)/;

const replacement = `$1
    const validRows: ActualData[] = [];
    const warningRows: ValidationIssue[] = [];
    const errorRows: ValidationIssue[] = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return Number(String(val).replace(/[^0-9.-]/g, '')) || 0;
      };

      if (planType !== '실적' && row.length >= 24) {
        // 계획 업로드: 선택, 연도, 계약구분, 투자여부, 일반구분, 작성부서, 귀속부서, 계정코드, 계정명, 내역, 산출기준, 금액, 1월~12월
        const yearVal = String(row[1] || year);
        const isInvestStr = String(row[3] || '');
        const mgmtCatStr = String(row[4] || '');
        const usageCodeVal = String(row[6] || '');
        const accountCode = String(row[7] || '');
        const accountName = String(row[8] || '');
        const remarks = String(row[9] || '');

        let hasError = false;
        
        if (isNaN(Number(yearVal)) || isNaN(Number(usageCodeVal))) {
          errorRows.push({ rowNum, message: '예산년도 또는 귀속부서(사용처) 코드가 숫자가 아닙니다.' });
          hasError = true;
        }

        // 투자여부 / 일반구분 조합 검증
        if (isInvestStr.includes('투자') && mgmtCatStr !== '투자') {
          warningRows.push({ rowNum, message: '투자예산은 일반구분이 "투자"로 설정되어야 합니다.' });
          // Note: In real logic we would correct it or force error, here we issue warning
        }

        if (!accountCode) {
          errorRows.push({ rowNum, message: '계정코드가 비어 있습니다.' });
          hasError = true;
        }

        if (currentUser?.code !== '99999' && !viewableDeptCodes.includes(usageCodeVal)) {
          errorRows.push({ rowNum, message: '조회 권한이 없는 부서의 데이터입니다.' });
          hasError = true;
        }

        if (!hasError) {
          for (let i = 0; i < 12; i++) {
            const amount = parseNum(row[12 + i]);
            if (amount !== 0) {
              validRows.push({
                id: data.length + validRows.length + 1,
                year: yearVal,
                period: \`\${i + 1}월\`,
                accountCode,
                accountName,
                controlType: '',
                usageCode: usageCodeVal,
                usageDept: String(row[5] || ''),
                amount,
                additional: 0,
                transferred: 0,
                carriedOver: 0,
                planned: 0,
                completed: 0,
                balance: amount,
                remarks
              });
            }
          }
        }
      } else {
        // 실적 업로드 (기존 로직)
        const yearVal = String(row[1] || year);
        const usageCodeVal = String(row[6] || '');
        const periodStr = String(row[2] || '');
        const accountCode = String(row[3] || '');

        let hasError = false;

        // 1. Year/Dept code validation
        if (isNaN(Number(yearVal)) || isNaN(Number(usageCodeVal))) {
          errorRows.push({ rowNum, message: '예산년도 또는 사용처코드가 숫자가 아닙니다.' });
          hasError = true;
        }
        if (yearVal.length !== 4) {
          warningRows.push({ rowNum, message: '예산년도가 4자리가 아닙니다.' });
        }

        // 2. Period validation
        const monthIndex = parsePeriodMonth(periodStr);
        if (monthIndex === null) {
          errorRows.push({ rowNum, message: \`기간 형식이 잘못되었습니다 ('\${periodStr}').\` });
          hasError = true;
        }

        // 3. Account code
        if (!accountCode) {
          errorRows.push({ rowNum, message: '계정코드가 비어 있습니다.' });
          hasError = true;
        }

        // 4. Permissions
        if (currentUser?.code !== '99999' && !viewableDeptCodes.includes(usageCodeVal)) {
          errorRows.push({ rowNum, message: '조회 권한이 없는 부서의 데이터입니다.' });
          hasError = true;
        }

        const amount = parseNum(row[8]);
        const additional = parseNum(row[9]);
        const transferred = parseNum(row[10]);
        const carriedOver = parseNum(row[11]);
        const planned = parseNum(row[12]);
        const completed = parseNum(row[13]);
        
        const calculatedBalance = (amount + additional + transferred + carriedOver) - (planned + completed);
        const rowBalanceStr = row[14] !== undefined ? String(row[14]) : '';
        const balance = rowBalanceStr !== '' ? parseNum(rowBalanceStr) : calculatedBalance;

        // 5. Balance check
        if (rowBalanceStr !== '' && balance !== calculatedBalance) {
          warningRows.push({ rowNum, message: '잔액 계산값이 수식과 불일치합니다.' });
        }

        if (!hasError) {
          const item: ActualData = {
            id: data.length + validRows.length + 1,
            year: yearVal,
            period: periodStr,
            accountCode,
            accountName: String(row[4] || ''),
            controlType: String(row[5] || ''),
            usageCode: usageCodeVal,
            usageDept: String(row[7] || ''),
            amount,
            additional,
            transferred,
            carriedOver,
            planned,
            completed,
            balance,
            remarks: String(row[15] || ''),
          };
          validRows.push(item);
        }
      }
    });

    if (validRows.length === 0 && errorRows.length === 0 && warningRows.length === 0) {
      setAlertModal({ isOpen: true, message: '유효한 데이터를 찾을 수 없습니다. 형식을 확인해 주세요.' });
      return;
    }

    setValidationResult({ validRows, warningRows, errorRows });
  };`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log("PlanActualUpload processImportedData modified");
} else {
  console.log("Regex mismatched!");
}
