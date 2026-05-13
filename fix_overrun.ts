import fs from 'fs';

let code = fs.readFileSync('src/pages/BudgetOverrunCheck.tsx', 'utf8');

code = code.replace(/const \[quarter, setQuarter\] = useState\('1Q'\);/, "const [period, setPeriod] = useState('1Q');");

code = code.replace(/const qMonths = quarter === '전체' \? MONTHS : QUARTERS\[quarter\];/, `let qMonths = MONTHS;
    if (period in QUARTERS) {
      qMonths = QUARTERS[period];
    } else if (period.endsWith('월')) {
      qMonths = [parseInt(period) - 1];
    }`);

const filterQuarterRegex = /<FilterItem label="분기">[\s\S]*?<\/FilterItem>/;
const filterPeriodHtml = `<FilterItem label="분석기간">
          <AppSelect value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="전체">전체 연도</option>
            <option value="1Q">1분기</option>
            <option value="2Q">2분기</option>
            <option value="3Q">3분기</option>
            <option value="4Q">4분기</option>
            <option value="1월">1월</option>
            <option value="2월">2월</option>
            <option value="3월">3월</option>
            <option value="4월">4월</option>
            <option value="5월">5월</option>
            <option value="6월">6월</option>
            <option value="7월">7월</option>
            <option value="8월">8월</option>
            <option value="9월">9월</option>
            <option value="10월">10월</option>
            <option value="11월">11월</option>
            <option value="12월">12월</option>
          </AppSelect>
        </FilterItem>`;
code = code.replace(filterQuarterRegex, filterPeriodHtml);

code = code.replace(/_\$\{quarter\}/, "_${period}");

fs.writeFileSync('src/pages/BudgetOverrunCheck.tsx', code);
