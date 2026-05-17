/* ════════════════════════════════════════════════════════════════
   HYCM Portal — Data Layer
   실제 데이터 구조 기반 (CM_assets_3030 호환)
   localStorage 키: cleanmetal_actual_data_{year}
                    cleanmetal_budget_data_{deptCode}_{year}_{planType}
════════════════════════════════════════════════════════════════ */
window.HYCMData = (() => {

  /* ── Storage Keys (CM_assets_3030 호환) ── */
  const KEYS = {
    ACTUAL:     year => `cleanmetal_actual_data_${year}`,
    BUDGET:     (dept, year, plan) => `cleanmetal_budget_data_${dept}_${year}_${plan}`,
    SUBMISSION: 'cleanmetal_submission_status',
    GLOBAL_ACC: 'cleanmetal_global_accounts',
    UPLOAD_LOG: 'hycm_upload_log',
  };

  /* ── Real Department Master (constants.ts 그대로) ── */
  const DEPARTMENTS = [
    { code:'99999', name:'운영자',       group:'시스템'  },
    { code:'32100', name:'기획재무그룹', group:'경영지원' },
    { code:'20000', name:'임원실',       group:'임원'   },
    { code:'21001', name:'정도경영그룹', group:'경영지원' },
    { code:'21002', name:'안전환경센터', group:'경영지원' },
    { code:'21100', name:'전략소싱그룹', group:'영업'   },
    { code:'21110', name:'마케팅섹션',   group:'영업'   },
    { code:'32000', name:'경영기획실',   group:'경영지원' },
    { code:'32200', name:'인사행정그룹', group:'경영지원' },
    { code:'50000', name:'생산기술실',   group:'생산'   },
    { code:'50200', name:'1공장',        group:'생산'   },
    { code:'50201', name:'물류반',       group:'생산'   },
    { code:'50210', name:'침출파트',     group:'생산'   },
    { code:'50220', name:'추출파트',     group:'생산'   },
    { code:'50240', name:'결정화파트',   group:'생산'   },
    { code:'50250', name:'리튬파트',     group:'생산'   },
    { code:'50400', name:'품질기술부',   group:'품질'   },
    { code:'50410', name:'품질분석섹션', group:'품질'   },
    { code:'50411', name:'분석파트',     group:'품질'   },
    { code:'50420', name:'품질기술섹션', group:'품질'   },
    { code:'50600', name:'설비관리섹션', group:'설비'   },
    { code:'50610', name:'기계파트',     group:'설비'   },
    { code:'50620', name:'전기파트',     group:'설비'   },
    { code:'98000', name:'고문',         group:'기타'   },
  ];

  /* ── Investment Account Codes (accountMaster.ts 그대로) ── */
  const INVESTMENT_CODES = new Set([
    '12310000','12320000','12330000','12340000',
    '12360000','12370000','12390000','12480000','12480200','12107401'
  ]);

  /* ── Header normalization (actualUploadParser.ts 포팅) ── */
  function normalizeHeader(h) {
    return String(h ?? '').trim().replace(/\s+/g,'').replace(/[()[\]{}]/g,'').toLowerCase();
  }

  const H_DEPT  = ['귀속부서코드','사용처코드','부서코드','deptcode','usagecode'];
  const H_ACC   = ['계정코드','계정과목코드','accountcode'];
  const H_DEPT_NAME = ['귀속부서','사용처','부서','부서명'];
  const H_ACC_NAME  = ['계정명','계정과목','accountname'];

  function hasAlias(normHeaders, aliases) {
    return aliases.some(a => normHeaders.includes(normalizeHeader(a)));
  }

  /* ── Upload Format Detection ── */
  function detectFormat(headers) {
    const norm = headers.map(normalizeHeader);
    const hasDept = hasAlias(norm, H_DEPT);
    const hasAcc  = hasAlias(norm, H_ACC);
    const monthActual = norm.filter(h => /^\d{1,2}월(실적)?$/.test(h) || ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].includes(h)).length;
    const hasPeriod   = hasAlias(norm, ['기간','월','period']);
    const hasCompleted = hasAlias(norm, ['완료실적','실적','completed']);
    if (hasDept && hasAcc && monthActual > 0) return 'ACTUAL_WIDE_MONTHLY';
    if (hasPeriod && hasAcc && (hasDept) && hasCompleted) return 'ACTUAL_FLAT';
    return 'UNKNOWN';
  }

  /* ── Period parser (budgetAggregation.ts 포팅) ── */
  function parsePeriodMonth(period) {
    if (typeof period === 'number') return period - 1;
    const s = String(period).trim();
    const m = s.match(/(?:^\d{4}[-./])?(0?[1-9]|1[0-2])월?$/);
    if (m) return parseInt(m[1], 10) - 1;
    const nums = s.replace(/[^0-9]/g, '');
    if (nums.length === 6) { const mn = parseInt(nums.slice(4), 10); if (mn >= 1 && mn <= 12) return mn - 1; }
    const n = parseInt(nums, 10);
    if (n >= 1 && n <= 12) return n - 1;
    return null;
  }

  /* ── Wide-monthly row parser ── */
  function parseWideMonthly(records, year) {
    const actualRows = [];
    const errorRows  = [];
    const MONTH_EN = ['','jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

    records.forEach((rec, idx) => {
      const rowNum = idx + 2;
      // Find dept/account by alias
      const usageCode = findVal(rec, H_DEPT);
      const accountCode = findVal(rec, H_ACC);
      const usageDept   = findVal(rec, H_DEPT_NAME) || '';
      const accountName = findVal(rec, H_ACC_NAME)  || '';

      if (!usageCode || !accountCode) {
        errorRows.push({ rowNum, message: '귀속부서코드 또는 계정코드 누락', severity: 'error' });
        return;
      }

      for (let i = 1; i <= 12; i++) {
        const aliases = [`${i}월실적`, `${i}월 실적`, `${i}월`, `m${String(i).padStart(2,'0')}`, MONTH_EN[i]];
        const val = findVal(rec, aliases);
        const completed = Number(String(val ?? '').replace(/,/g,'')) || 0;
        if (completed !== 0) {
          actualRows.push({
            id: actualRows.length + 1,
            year, period: `${i}월`,
            accountCode, accountName,
            controlType:'', usageCode, usageDept,
            amount:0, additional:0, transferred:0, carriedOver:0, planned:0,
            completed, balance: -completed,
            remarks: `업로드 (WIDE_MONTHLY)`
          });
        }
      }
    });
    return { format:'ACTUAL_WIDE_MONTHLY', sourceRowCount:records.length, actualRows, errorRows, warningRows:[] };
  }

  /* ── Flat row parser ── */
  function parseFlat(records, year) {
    const actualRows = [];
    const errorRows  = [];
    records.forEach((rec, idx) => {
      const rowNum = idx + 2;
      const period = findVal(rec, ['기간','월','period']) || '';
      const accountCode = findVal(rec, H_ACC) || '';
      const usageCode   = findVal(rec, H_DEPT) || '';
      const completed   = Number(String(findVal(rec, ['완료실적','실적','completed']) ?? '').replace(/,/g,'')) || 0;
      if (!period || !accountCode || !usageCode) {
        errorRows.push({ rowNum, message:'필수 항목 누락 (기간/계정코드/부서코드)', severity:'error' });
        return;
      }
      actualRows.push({
        id: actualRows.length + 1,
        year: findVal(rec, ['연도']) || year, period, accountCode,
        accountName: findVal(rec, H_ACC_NAME) || '',
        controlType: findVal(rec, ['통제구분','관리구분']) || '',
        usageCode, usageDept: findVal(rec, H_DEPT_NAME) || '',
        amount: Number(findVal(rec, ['예산']) || 0),
        additional:0, transferred:0, carriedOver:0, planned:0,
        completed, balance: Number(findVal(rec, ['잔액']) || 0),
        remarks: findVal(rec, ['비고']) || ''
      });
    });
    return { format:'ACTUAL_FLAT', sourceRowCount:records.length, actualRows, errorRows, warningRows:[] };
  }

  function findVal(rec, aliases) {
    for (const a of aliases) {
      const k = normalizeHeader(a);
      if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') return rec[k];
    }
    return undefined;
  }

  /* ── CSV Parser ── */
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers:[], records:[] };
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const normHeaders = rawHeaders.map(normalizeHeader);
    const records = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const rec = {};
      normHeaders.forEach((k, i) => { rec[k] = vals[i] ?? ''; });
      return rec;
    });
    return { headers: rawHeaders, normHeaders, records };
  }

  /* ── Validate parsed result ── */
  function validate(parseResult) {
    const { actualRows, errorRows } = parseResult;
    const warnRows = [];
    const seen = new Set();
    actualRows.forEach(r => {
      const key = `${r.usageCode}_${r.accountCode}_${r.period}`;
      if (seen.has(key)) warnRows.push({ message:`중복 가능성: ${r.usageCode} ${r.accountCode} ${r.period}`, severity:'warning' });
      else seen.add(key);
      if (!DEPARTMENTS.some(d => d.code === r.usageCode)) {
        warnRows.push({ message:`미등록 부서코드: ${r.usageCode} (${r.accountCode} ${r.period})`, severity:'warning' });
      }
    });
    return {
      totalRows: parseResult.sourceRowCount,
      validRows: actualRows.length,
      errorRows: errorRows.length,
      warnRows:  warnRows.length,
      issues: [...errorRows, ...warnRows],
      data: actualRows,
      format: parseResult.format,
    };
  }

  /* ── Parse entry point ── */
  function parseRecords(headers, records, year) {
    const fmt = detectFormat(headers);
    if (fmt === 'ACTUAL_WIDE_MONTHLY') return validate(parseWideMonthly(records, year));
    if (fmt === 'ACTUAL_FLAT')         return validate(parseFlat(records, year));
    return { totalRows:records.length, validRows:0, errorRows:records.length, warnRows:0,
      issues:[{ message:'지원하지 않는 파일 형식입니다. 귀속부서코드/계정코드/월별실적 컬럼을 확인해주세요.', severity:'error' }],
      data:[], format:'UNKNOWN' };
  }

  /* ── localStorage I/O ── */
  function saveActuals(year, rows) {
    try {
      localStorage.setItem(KEYS.ACTUAL(year), JSON.stringify(rows));
      const log = getUploadLog();
      log.unshift({ fileName:`업로드_${year}.csv`, uploadedAt: new Date().toISOString(),
        rowCount: rows.length, year, status:'완료' });
      localStorage.setItem(KEYS.UPLOAD_LOG, JSON.stringify(log.slice(0, 20)));
      return true;
    } catch(e) { return false; }
  }

  function loadActuals(year) {
    try {
      const raw = localStorage.getItem(KEYS.ACTUAL(year));
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function loadBudget(deptCode, year, planType='본예산') {
    try {
      const raw = localStorage.getItem(KEYS.BUDGET(deptCode, year, planType));
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function getUploadLog() {
    try { return JSON.parse(localStorage.getItem(KEYS.UPLOAD_LOG) || '[]'); }
    catch(e) { return []; }
  }

  function hasUploadedData(year) {
    const rows = loadActuals(year);
    return rows.length > 0;
  }

  /* ── Aggregation (budgetAggregation.ts 포팅) ── */
  function aggregateByDeptAccount(actualRows, budgetRows, months) {
    const unionKeys = new Set();
    const budgetMap = new Map();
    budgetRows.forEach(r => {
      const key = `${r.attributedDeptCode}_${r.code}`;
      unionKeys.add(key);
      budgetMap.set(key, r);
    });

    const actualMap = new Map();
    actualRows.forEach(a => {
      const mi = parsePeriodMonth(a.period);
      if (mi === null) return;
      const key = `${a.usageCode}_${a.accountCode}`;
      unionKeys.add(key);
      const ex = actualMap.get(key) || { qActual:0, yActual:0, accountName: a.accountName || a.accountCode, monthly:{} };
      if (!months || months.includes(mi)) ex.qActual += (a.completed || 0);
      ex.yActual += (a.completed || 0);
      ex.monthly[mi] = (ex.monthly[mi] || 0) + (a.completed || 0);
      actualMap.set(key, ex);
    });

    return Array.from(unionKeys).map(key => {
      const [deptCode, accountCode] = key.split('_');
      const br = budgetMap.get(key);
      const ar = actualMap.get(key);
      const monthList = months || [0,1,2,3,4,5,6,7,8,9,10,11];
      const qBudget = br ? monthList.reduce((s,m) => s + (br.values[m] || 0), 0) : 0;
      const qActual = ar ? ar.qActual : 0;
      let status = '정상';
      if (qBudget === 0 && qActual > 0) status = '무예산 집행';
      else if (qActual > qBudget) status = '초과';
      else if (qBudget > 0 && qActual < qBudget * 0.85) status = '미달';
      return {
        deptCode, accountCode,
        accountName: br?.name || ar?.accountName || accountCode,
        qBudget, qActual,
        yBudget: br ? br.values.reduce((s,v) => s+(v||0),0) : 0,
        yActual: ar ? ar.yActual : 0,
        balance: qBudget - qActual,
        overrunAmount: Math.max(qActual - qBudget, 0),
        status,
        monthly: ar?.monthly || {},
      };
    });
  }

  /* ── Demo fixtures (SAMPLE — for UI preview only) ── */
  const DEMO_META = {
    isDemo: true,
    label: 'SAMPLE DATA',
    year: '2026',
    notice: 'UI 미리보기용 샘플 데이터입니다. 실제 HYCM 운영 데이터와 무관합니다.',
    uploadedAt: '2026-05-16 09:41',
  };

  // Demo actual rows (명확한 샘플, 실제 데이터 아님)
  const DEMO_ACTUALS = (() => {
    const rows = [];
    let id = 1;
    const dept_acc = [
      ['50210','A10010','인건비(제조)'],
      ['50220','A10010','인건비(제조)'],
      ['50240','A10010','인건비(제조)'],
      ['50250','A10010','인건비(제조)'],
      ['50210','A20010','원재료비'],
      ['50220','A20010','원재료비'],
      ['50400','B10010','인건비(판관)'],
      ['32100','B10010','인건비(판관)'],
    ];
    const SAMPLE_MONTHLY = [
      [120,118,115,122,60, 0,0,0,0,0,0,0],  // 정상
      [ 80, 82, 78, 79,40, 0,0,0,0,0,0,0],
      [ 90, 88, 93, 89,45, 0,0,0,0,0,0,0],
      [ 70, 72, 68, 85,35, 0,0,0,0,0,0,0],  // 4월 초과
      [200,195,188,235,104,0,0,0,0,0,0,0],  // 3월 초과
      [150,148,152,149, 72,0,0,0,0,0,0,0],
      [ 60, 58, 61, 59, 29,0,0,0,0,0,0,0],
      [ 50, 48, 51, 50, 25,0,0,0,0,0,0,0],
    ];
    dept_acc.forEach(([dept, acc, name], di) => {
      const vals = SAMPLE_MONTHLY[di] || SAMPLE_MONTHLY[0];
      for (let mi = 0; mi < 5; mi++) {
        if (vals[mi] > 0) {
          rows.push({ id: id++, year:'2026', period:`${mi+1}월`,
            accountCode: acc, accountName: name, controlType:'',
            usageCode: dept, usageDept: DEPARTMENTS.find(d=>d.code===dept)?.name || dept,
            amount:0, additional:0, transferred:0, carriedOver:0, planned:0,
            completed: vals[mi], balance:-vals[mi], remarks:'SAMPLE DATA' });
        }
      }
    });
    return rows;
  })();

  /* ── Demo Budget / Execution fixtures ── */

  const DEPT_SUMMARY = [
    { code:'50200', name:'1공장',        budgetYTD:850,  actualYTD:912,  variance:-62,  rate:107.3, status:'over',  head:'김공장' },
    { code:'50400', name:'품질기술부',   budgetYTD:420,  actualYTD:388,  variance:32,   rate:92.4,  status:'under', head:'이품질' },
    { code:'32100', name:'기획재무그룹', budgetYTD:310,  actualYTD:298,  variance:12,   rate:96.1,  status:'ok',    head:'박재무' },
    { code:'21001', name:'정도경영그룹', budgetYTD:180,  actualYTD:172,  variance:8,    rate:95.6,  status:'ok',    head:'최경영' },
    { code:'50600', name:'설비관리섹션', budgetYTD:560,  actualYTD:601,  variance:-41,  rate:107.3, status:'over',  head:'정설비' },
    { code:'32200', name:'인사행정그룹', budgetYTD:240,  actualYTD:218,  variance:22,   rate:90.8,  status:'under', head:'강인사' },
  ];

  const KPI_DEMO = {
    totalBudgetAnnual: 8420,
  };

  const MONTHLY_BUDGET = [680,720,750,800,820,830,840,850,820,780,760,700];
  const MONTHLY_ACTUAL = [658,704,738,812,395,  0,  0,  0,  0,  0,  0,  0];

  const ACCOUNT_VARIANCE = [
    { acc:'인건비',   budget:2100, actual:1980, rate:94.3,  status:'ok'    },
    { acc:'원재료비', budget:3200, actual:3380, rate:105.6, status:'over'  },
    { acc:'경비',     budget:850,  actual:720,  rate:84.7,  status:'under' },
    { acc:'수선비',   budget:420,  actual:398,  rate:94.8,  status:'ok'    },
    { acc:'외주비',   budget:580,  actual:612,  rate:105.5, status:'over'  },
  ];

  const EXECUTIONS = [
    { id:'EX-001', date:'2026-05-02', deptName:'1공장',        acc:'원재료비', accCode:'A20010', vendor:'삼성화학',        desc:'원재료 월간 구매',          amount:45.2, matched:40.0, diff:5.2,  anomaly:'초과',   status:'pending',   assignee:'김생산' },
    { id:'EX-002', date:'2026-05-05', deptName:'설비관리섹션', acc:'수선비',   accCode:'A40020', vendor:'현대설비',        desc:'압축기 정기점검',            amount:12.8, matched:15.0, diff:-2.2, anomaly:'정상',   status:'confirmed', assignee:'정설비' },
    { id:'EX-003', date:'2026-05-08', deptName:'1공장',        acc:'경비',     accCode:'A50010', vendor:'(없음)',          desc:'출장비 선급',                amount:3.5,  matched:0,    diff:3.5,  anomaly:'무예산', status:'pending',   assignee:'박과장' },
    { id:'EX-004', date:'2026-05-10', deptName:'품질기술부',   acc:'외주비',   accCode:'B30010', vendor:'한국분석원',      desc:'품질 외부 검사',             amount:8.2,  matched:10.0, diff:-1.8, anomaly:'정상',   status:'confirmed', assignee:'이품질' },
    { id:'EX-005', date:'2026-05-12', deptName:'기획재무그룹', acc:'경비',     accCode:'B50010', vendor:'(없음)',          desc:'회의비 지출',                amount:1.2,  matched:2.0,  diff:-0.8, anomaly:'정상',   status:'pending',   assignee:'박재무' },
    { id:'EX-006', date:'2026-05-14', deptName:'1공장',        acc:'소모품비', accCode:'A50020', vendor:'삼공산업',        desc:'생산라인 소모품',            amount:6.5,  matched:0,    diff:6.5,  anomaly:'무예산', status:'reviewing', assignee:'김생산' },
    { id:'EX-007', date:'2026-04-28', deptName:'설비관리섹션', acc:'수선비',   accCode:'A40020', vendor:'한일엔지니어링',  desc:'펌프 교체 수선',             amount:18.0, matched:12.0, diff:6.0,  anomaly:'초과',   status:'action',    assignee:'정설비' },
    { id:'EX-008', date:'2026-04-25', deptName:'인사행정그룹', acc:'인건비',   accCode:'B10010', vendor:'—',              desc:'4월 급여',                   amount:52.0, matched:55.0, diff:-3.0, anomaly:'정상',   status:'confirmed', assignee:'강인사' },
    { id:'EX-009', date:'2026-04-20', deptName:'1공장',        acc:'원재료비', accCode:'A20010', vendor:'한국화학',        desc:'긴급 원재료 조달',            amount:28.0, matched:20.0, diff:8.0,  anomaly:'초과',   status:'action',    assignee:'김생산' },
    { id:'EX-010', date:'2026-03-30', deptName:'품질기술부',   acc:'시험비',   accCode:'B30020', vendor:'국가품질원',      desc:'분기 외부 시험',             amount:4.8,  matched:5.0,  diff:-0.2, anomaly:'정상',   status:'confirmed', assignee:'이품질' },
  ];

  const UNBUDGETED = [
    { id:'UB-001', month:'2026-05', deptName:'1공장',        deptCode:'50200', accCode:'A50010', accName:'경비',       vendor:'(없음)',       desc:'출장비 선급',          amount:3.5,  severity:'M', status:'pending',   assignee:'박과장' },
    { id:'UB-002', month:'2026-05', deptName:'1공장',        deptCode:'50200', accCode:'A50020', accName:'소모품비',   vendor:'삼공산업',     desc:'생산라인 소모품',      amount:6.5,  severity:'H', status:'reviewing', assignee:'김생산' },
    { id:'UB-003', month:'2026-04', deptName:'설비관리섹션', deptCode:'50600', accCode:'A40030', accName:'특수수선비', vendor:'현대설비',     desc:'긴급 설비 수리',       amount:22.0, severity:'H', status:'action',    assignee:'정설비' },
    { id:'UB-004', month:'2026-03', deptName:'품질기술부',   deptCode:'50400', accCode:'B30020', accName:'시험비',     vendor:'한국시험원',   desc:'신규 시험항목 추가',   amount:4.8,  severity:'L', status:'approved',  assignee:'이품질' },
  ];

  /* ── Budget request / approval demo data ── */
  const BUDGET_REQUESTS = [
    { id:'BR-001', dept:'50200', deptName:'1공장',        title:'원료 추가 구매 예산 신청', amount:120, cat:'원재료비', status:'pending',  submitter:'김생산', submittedAt:'2026-05-10', urgency:'H', reason:'3분기 생산계획 증가로 원료 추가 물량 필요' },
    { id:'BR-002', dept:'50600', deptName:'설비관리섹션', title:'압축기 교체 예산 신청',   amount:85,  cat:'설비비',   status:'reviewing',submitter:'정설비', submittedAt:'2026-05-12', urgency:'M', reason:'노후 압축기 고장 빈도 증가, 교체 불가피' },
    { id:'BR-003', dept:'50400', deptName:'품질기술부',   title:'외부 분석 장비 임차',     amount:30,  cat:'외주비',   status:'approved', submitter:'이품질', submittedAt:'2026-05-01', urgency:'L', reason:'신규 제품 인증을 위한 특수 분석 필요' },
    { id:'BR-004', dept:'32100', deptName:'기획재무그룹', title:'시스템 도입 용역비',      amount:200, cat:'외주비',   status:'rejected', submitter:'박재무', submittedAt:'2026-04-28', urgency:'M', reason:'ERP 고도화 프로젝트 컨설팅 용역' },
    { id:'BR-005', dept:'21001', deptName:'정도경영그룹', title:'임직원 교육비 추가',      amount:15,  cat:'교육훈련비',status:'pending', submitter:'최경영', submittedAt:'2026-05-14', urgency:'L', reason:'하반기 법정의무교육 대상자 증가' },
  ];

  const APPROVAL_HISTORY = [
    { id:'AP-001', refId:'BR-003', type:'예산신청', dept:'품질기술부',   title:'외부 분석 장비 임차',   amount:30,  action:'승인', actor:'김부장', actedAt:'2026-05-05', memo:'긴급성 확인, 승인' },
    { id:'AP-002', refId:'BR-004', type:'예산신청', dept:'기획재무그룹', title:'시스템 도입 용역비',   amount:200, action:'반려', actor:'이이사', actedAt:'2026-05-03', memo:'금액 과다, 사업계획 재검토 후 재신청' },
    { id:'AP-003', refId:'EX-002', type:'집행검토', dept:'설비관리섹션', title:'압축기 정기점검',       amount:12.8,action:'승인', actor:'박과장', actedAt:'2026-05-06', memo:'정기 유지보수 확인 완료' },
    { id:'AP-004', refId:'EX-004', type:'집행검토', dept:'품질기술부',   title:'품질 외부 검사',        amount:8.2, action:'승인', actor:'이품질', actedAt:'2026-05-11', memo:'계획 범위 내 집행' },
    { id:'AP-005', refId:'EX-008', type:'집행검토', dept:'인사행정그룹', title:'4월 급여',              amount:52,  action:'승인', actor:'강인사', actedAt:'2026-04-26', memo:'정기 급여 처리' },
  ];

  return {
    KEYS, DEPARTMENTS, INVESTMENT_CODES,
    normalizeHeader, detectFormat, parseCSV, parseRecords,
    saveActuals, loadActuals, loadBudget, getUploadLog, hasUploadedData,
    aggregateByDeptAccount, parsePeriodMonth,
    DEMO_META: { ...DEMO_META, syncedAt: '2026-05-16 09:41' },
    DEMO_ACTUALS,
    // Budget / execution demo
    deptSummary: DEPT_SUMMARY,
    KPI: KPI_DEMO,
    monthlyBudget: MONTHLY_BUDGET,
    monthlyActual: MONTHLY_ACTUAL,
    ACCOUNT_VARIANCE,
    EXECUTIONS,
    UNBUDGETED,
    BUDGET_REQUESTS,
    APPROVAL_HISTORY,
    // Legacy compat
    MONTH_LABELS: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    CUR_MONTH: 5,
  };
})();

// Expose legacy alias
window.HYCMFixtures = window.HYCMData;
