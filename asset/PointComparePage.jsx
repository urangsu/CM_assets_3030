/* [Component: PointCompareTab]
   시점 vs 시점 비교분석 — 기준 시점(A) vs 비교 시점(B) */
const { useState: usePCSt, useMemo: usePCMemo } = React;

/* ── Helpers ─────────────────────────────────────────────── */
function getPeriodMonths(basis, period) {
  if (basis === 'MONTH')   return typeof period === 'number' ? [period] : [];
  if (basis === 'QUARTER') return ({1:[0,1,2],2:[3,4,5],3:[6,7,8],4:[9,10,11]})[period] || [];
  if (basis === 'YTD')     return Array.from({length:(period||0)+1},(_,i)=>i);
  if (basis === 'YEAR')    return [0,1,2,3,4,5,6,7,8,9,10,11];
  return [];
}

function filterRecords(records, months, deptCode) {
  const D = window.HYCMData;
  return records.filter(r => {
    const mi = D.parsePeriodMonth(r.period);
    if (mi === null || !months.includes(mi)) return false;
    if (deptCode && deptCode !== 'ALL' && r.usageCode !== deptCode) return false;
    return true;
  });
}

function aggregateToMap(records) {
  const D = window.HYCMData;
  const map = {};
  records.forEach(r => {
    const key = `${r.usageCode}__${r.accountCode}`;
    if (!map[key]) map[key] = {
      deptCode:    r.usageCode,
      deptName:    D.DEPARTMENTS.find(d => d.code === r.usageCode)?.name || r.usageCode,
      accountCode: r.accountCode,
      accountName: r.accountName || r.accountCode,
      total: 0,
    };
    map[key].total += (r.completed || 0);
  });
  return map;
}

function detectChangeType(base, target) {
  const diff = target - base;
  const rate = base === 0 ? null : diff / base * 100;
  if (base === 0 && target > 0)  return '신규 발생';
  if (base > 0 && target === 0)  return '사라짐';
  if (diff === 0)                return '변동 없음';
  if (Math.abs(rate||0) >= 30 || Math.abs(diff) >= 10000) return '검토 필요';
  if (diff > 0) return '증가';
  return '감소';
}

function buildCompareRows(baseRecs, targetRecs) {
  const bMap = aggregateToMap(baseRecs);
  const tMap = aggregateToMap(targetRecs);
  const allKeys = new Set([...Object.keys(bMap), ...Object.keys(tMap)]);
  return Array.from(allKeys).map(key => {
    const b = bMap[key], t = tMap[key];
    const baseVal   = b?.total || 0;
    const targetVal = t?.total || 0;
    const diff      = targetVal - baseVal;
    const rate      = baseVal === 0 ? null : diff / baseVal * 100;
    const ref = b || t;
    return {
      id: key,
      deptCode:    ref.deptCode,
      deptName:    ref.deptName,
      accountCode: ref.accountCode,
      accountName: ref.accountName,
      baseValue:   baseVal,
      targetValue: targetVal,
      diffAmount:  diff,
      diffRate:    rate,
      changeType:  detectChangeType(baseVal, targetVal),
      reviewStatus:'미검토',
    };
  }).sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));
}

/* ── Change type style map ───────────────────────────────── */
const CT_STYLE = {
  '증가':     { cls:'green', label:'증가'    },
  '감소':     { cls:'amber', label:'감소'    },
  '변동 없음':{ cls:'gray',  label:'변동없음'},
  '신규 발생':{ cls:'green', label:'신규'    },
  '사라짐':   { cls:'red',   label:'사라짐'  },
  '검토 필요':{ cls:'amber', label:'검토 필요'},
};

const REVIEW_ST = {
  '미검토':   'gray',
  '검토중':   'amber',
  '확인완료': 'green',
  '조치요청': 'amber',
  '승인완료': 'green',
  '반려':     'red',
};

/* ── CompareParamsPanel ──────────────────────────────────── */
function CompareParamsPanel({ label, color, params, setParams, basis, deptOpts, monthOpts, quarterOpts }) {
  const periodOpts =
    basis === 'MONTH'   ? monthOpts :
    basis === 'QUARTER' ? quarterOpts :
    basis === 'YTD'     ? monthOpts.map(m => ({ val:m.val, label:`1~${m.label} 누계` })) :
    [{ val:'YEAR', label:'연간 전체' }];

  return (
    <div style={{ flex:1, background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{label}</span>
        <span style={{ fontSize:10, color:'var(--t3)', marginLeft:'auto' }}>{params.dataType === 'actual' ? '실적 데이터' : params.dataType}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>데이터 유형</div>
          <select className="filter-sel" style={{ width:'100%' }} value={params.dataType}
            onChange={e => setParams(p => ({ ...p, dataType:e.target.value }))}>
            <option value="actual">실적</option>
            <option value="budget" disabled>예산 (준비 중)</option>
            <option value="execution" disabled>집행 내역 (준비 중)</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>연도</div>
          <select className="filter-sel" style={{ width:'100%' }} value={params.year}
            onChange={e => setParams(p => ({ ...p, year:e.target.value }))}>
            {['2026','2025','2024'].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>시점</div>
          <select className="filter-sel" style={{ width:'100%' }} value={params.period}
            onChange={e => {
              const v = e.target.value;
              setParams(p => ({ ...p, period: isNaN(v) ? v : Number(v) }));
            }}>
            {periodOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>부서</div>
          <select className="filter-sel" style={{ width:'100%' }} value={params.dept}
            onChange={e => setParams(p => ({ ...p, dept:e.target.value }))}>
            {deptOpts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ── Compare Drawer ──────────────────────────────────────── */
function PointCompareDrawer({ row, statusMap, onClose, onAction }) {
  const [memo, setMemo] = usePCSt('');
  const D = window.HYCMData;
  if (!row) return null;
  const curStatus = statusMap[row.id] || row.reviewStatus;
  const ct = CT_STYLE[row.changeType] || CT_STYLE['변동 없음'];

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer cb"><span className="cbl">PointCompareDrawer</span>
        <div className="drawer-head">
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--t1)', marginBottom:4 }}>
              {row.deptName} · {row.accountCode}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <span className={`badge ${ct.cls}`}>{row.changeType}</span>
              <span style={{ fontSize:11, color:'var(--t3)' }}>{row.accountName}</span>
            </div>
          </div>
          <button className="btn sm" style={{ marginLeft:'auto' }} onClick={onClose}>닫기</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div className="drawer-sec-title">시점별 금액</div>
            <div className="drawer-grid">
              {[
                ['기준 시점', `${row.baseValue.toLocaleString()}천원`],
                ['비교 시점', `${row.targetValue.toLocaleString()}천원`],
                ['증감액', <span className={row.diffAmount > 0 ? 'neg' : row.diffAmount < 0 ? 'pos' : ''}>
                  {row.diffAmount > 0 ? '+' : ''}{row.diffAmount.toLocaleString()}천원
                </span>],
                ['증감률', row.diffRate !== null
                  ? `${row.diffRate > 0 ? '+' : ''}${row.diffRate.toFixed(1)}%`
                  : '신규 발생'],
                ['변화 유형', <span className={`badge ${ct.cls}`}>{row.changeType}</span>],
                ['검토 상태', <span className={`badge ${REVIEW_ST[curStatus]||'gray'}`}>{curStatus}</span>],
              ].map(([k, v]) => (
                <div key={k} className="drawer-field">
                  <span className="df-label">{k}</span>
                  <span className="df-value">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-sec-title">미니 비교 차트</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:16, height:80, padding:'0 8px' }}>
              {[
                { label:'기준', val:row.baseValue, color:'var(--lith2)' },
                { label:'비교', val:row.targetValue, color:'var(--primary)' },
              ].map(({ label, val, color }) => {
                const maxV = Math.max(row.baseValue, row.targetValue, 1);
                const h = Math.max((val / maxV) * 70, val > 0 ? 4 : 0);
                return (
                  <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:10, color:'var(--t3)', fontVariantNumeric:'tabular-nums' }}>
                      {(val/1000).toFixed(0)}천
                    </span>
                    <div style={{ width:'100%', height:`${h}px`, background:color, borderRadius:'3px 3px 0 0', transition:'height .3s' }}/>
                    <span style={{ fontSize:10.5, fontWeight:600, color:'var(--t2)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-sec-title">검토 메모</div>
            <textarea className="memo-box" rows={3} value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="검토 사유, 확인 내용 등을 입력해주세요..."/>
          </div>

          {row.changeType === '신규 발생' && (
            <div className="drawer-notice">
              기준 시점에는 집행이 없었으나 비교 시점에 신규 발생한 항목입니다. 발생 사유를 확인해주세요.
            </div>
          )}
          {row.changeType === '검토 필요' && (
            <div className="drawer-notice">
              증감 폭이 기준치(±30% 또는 ±10,000천원)를 초과합니다. 사유를 확인해주세요.
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn sm primary" onClick={() => onAction('확인완료', row, memo)}>확인 완료</button>
          <button className="btn sm" onClick={() => onAction('조치요청', row, memo)}>조치 요청</button>
          <button className="btn sm" onClick={() => onAction('반려', row, memo)}>반려</button>
          <button className="btn sm" style={{ marginLeft:'auto' }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ── Top Changes Chart ───────────────────────────────────── */
function TopChangesChart({ rows }) {
  const top10 = rows.filter(r => r.diffAmount !== 0).slice(0, 10);
  if (!top10.length) return null;
  const maxAbs = Math.max(...top10.map(r => Math.abs(r.diffAmount)), 1);

  return (
    <div>
      <div className="aside-title" style={{ marginBottom:10 }}>증감 Top 10</div>
      {top10.map(r => {
        const pct = Math.abs(r.diffAmount) / maxAbs * 100;
        const isPos = r.diffAmount >= 0;
        const ct = CT_STYLE[r.changeType] || CT_STYLE['변동 없음'];
        return (
          <div key={r.id} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, marginBottom:3 }}>
              <span style={{ color:'var(--t2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>
                {r.deptName} · {r.accountCode}
              </span>
              <span style={{ fontWeight:600, color: isPos ? 'var(--green)' : 'var(--amber)', flexShrink:0 }}>
                {isPos ? '+' : ''}{(r.diffAmount/1000).toFixed(0)}천
              </span>
            </div>
            <div style={{ height:5, background:'var(--border-lt)', borderRadius:3 }}>
              <div style={{
                height:'100%',
                width:`${pct.toFixed(0)}%`,
                background: ct.cls === 'green' ? 'var(--green)' : ct.cls === 'red' ? 'var(--red)' : 'var(--amber)',
                borderRadius:3,
                transition:'width .3s',
              }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   PointCompareTab — 메인 컴포넌트
════════════════════════════════════════ */
function PointCompareTab({ onNav }) {
  const D = window.HYCMData;

  /* selector state */
  const [basis,     setBasis]     = usePCSt('MONTH');
  const [baseP,     setBaseP]     = usePCSt({ dataType:'actual', year:'2026', period:2, dept:'ALL' });
  const [targetP,   setTargetP]   = usePCSt({ dataType:'actual', year:'2026', period:4, dept:'ALL' });

  /* filter / UI state */
  const [filterCT,  setFilterCT]  = usePCSt('ALL');
  const [selected,  setSelected]  = usePCSt(null);
  const [statusMap, setStatusMap] = usePCSt({});

  /* raw data */
  const rawRecords = usePCMemo(() => {
    const stored = D.loadActuals('2026');
    return stored.length > 0 ? stored : D.DEMO_ACTUALS;
  }, []);

  /* period options */
  const monthOpts   = D.MONTH_LABELS.map((l, i) => ({ val:i, label:l }));
  const quarterOpts = [1,2,3,4].map(q => ({ val:q, label:`${q}분기` }));
  const deptOpts    = [
    { code:'ALL', name:'전체 부서' },
    ...D.DEPARTMENTS.filter(d => !['99999','98000'].includes(d.code)).slice(0, 15),
  ];

  /* computed: filter + aggregate */
  const baseRecords = usePCMemo(() => {
    const months = basis === 'YEAR' ? [0,1,2,3,4,5,6,7,8,9,10,11]
      : getPeriodMonths(basis, baseP.period);
    return filterRecords(rawRecords, months, baseP.dept);
  }, [rawRecords, basis, baseP]);

  const targetRecords = usePCMemo(() => {
    const months = basis === 'YEAR' ? [0,1,2,3,4,5,6,7,8,9,10,11]
      : getPeriodMonths(basis, targetP.period);
    return filterRecords(rawRecords, months, targetP.dept);
  }, [rawRecords, basis, targetP]);

  const allRows = usePCMemo(() => buildCompareRows(baseRecords, targetRecords), [baseRecords, targetRecords]);

  const rows = usePCMemo(() =>
    filterCT === 'ALL' ? allRows : allRows.filter(r => r.changeType === filterCT),
    [allRows, filterCT]
  );

  /* totals */
  const T = usePCMemo(() => {
    const base   = allRows.reduce((s,r) => s + r.baseValue,   0);
    const target = allRows.reduce((s,r) => s + r.targetValue, 0);
    const diff   = target - base;
    const rate   = base > 0 ? diff / base * 100 : null;
    return {
      base, target, diff, rate,
      increased: allRows.filter(r => ['증가','신규 발생'].includes(r.changeType)).length,
      decreased: allRows.filter(r => ['감소','사라짐'].includes(r.changeType)).length,
      newItems:  allRows.filter(r => r.changeType === '신규 발생').length,
      goneItems: allRows.filter(r => r.changeType === '사라짐').length,
      review:    allRows.filter(r => r.changeType === '검토 필요').length,
      unchanged: allRows.filter(r => r.changeType === '변동 없음').length,
    };
  }, [allRows]);

  const handleAction = (action, row) => {
    setStatusMap(p => ({ ...p, [row.id]:action }));
    setSelected(null);
  };

  /* period label helper */
  const periodLabel = (p, basis) => {
    if (basis === 'YEAR') return `${p.year} 연간`;
    if (basis === 'MONTH') return `${p.year}년 ${D.MONTH_LABELS[p.period]}`;
    if (basis === 'QUARTER') return `${p.year}년 ${p.period}분기`;
    if (basis === 'YTD') return `${p.year}년 1~${D.MONTH_LABELS[p.period]} 누계`;
    return '';
  };

  const hasData = allRows.length > 0;

  return (
    <>
      {/* Basis selector */}
      <div className="filter-bar" style={{ gap:6 }}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--t2)' }}>비교 기준</span>
        {[
          { val:'MONTH',   label:'단월 비교'  },
          { val:'QUARTER', label:'분기 비교'  },
          { val:'YTD',     label:'누계 비교'  },
          { val:'YEAR',    label:'연간 비교'  },
        ].map(b => (
          <button key={b.val}
            className={`btn sm${basis === b.val ? ' primary' : ''}`}
            onClick={() => setBasis(b.val)}>{b.label}</button>
        ))}
        {hasData && (
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--t3)' }}>
            {periodLabel(baseP, basis)} → {periodLabel(targetP, basis)}
          </span>
        )}
      </div>

      {/* Two selection panels */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:10, alignItems:'center' }}>
        <CompareParamsPanel
          label="기준 시점 (A)"
          color="var(--lith2)"
          params={baseP}
          setParams={setBaseP}
          basis={basis}
          deptOpts={deptOpts}
          monthOpts={monthOpts}
          quarterOpts={quarterOpts}
        />
        <div style={{ textAlign:'center', fontSize:18, fontWeight:700, color:'var(--t3)', padding:'0 4px' }}>vs</div>
        <CompareParamsPanel
          label="비교 시점 (B)"
          color="var(--primary)"
          params={targetP}
          setParams={setTargetP}
          basis={basis}
          deptOpts={deptOpts}
          monthOpts={monthOpts}
          quarterOpts={quarterOpts}
        />
      </div>

      {/* Empty state */}
      {!hasData ? (
        <div className="card">
          <div className="card-body" style={{ textAlign:'center', padding:'48px 24px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:8 }}>
              선택한 두 시점에 비교할 데이터가 없습니다.
            </div>
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>
              실적 업로드 또는 예산 작성 후 다시 조회하세요.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button className="btn sm primary" onClick={() => onNav('actual-upload')}>실적 업로드하러 가기</button>
              <button className="btn sm" onClick={() => onNav('budget')}>예산 현황 보기</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'var(--gap)' }}>
            {[
              { l:'기준 시점',    v:`${(T.base/1000).toFixed(0)}천원`,   t:'gray',  s:periodLabel(baseP,basis) },
              { l:'비교 시점',    v:`${(T.target/1000).toFixed(0)}천원`, t:'gray',  s:periodLabel(targetP,basis) },
              { l:'증감액',       v:`${T.diff>=0?'+':''}${(T.diff/1000).toFixed(0)}천원`, t: T.diff > 0 ? 'amber' : T.diff < 0 ? 'green' : 'gray', s: T.diff > 0 ? '증가' : T.diff < 0 ? '감소' : '변동없음' },
              { l:'증감률',       v: T.rate !== null ? `${T.rate >= 0 ? '+' : ''}${T.rate.toFixed(1)}%` : '—', t: Math.abs(T.rate||0) >= 30 ? 'amber' : 'gray', s:'대비' },
              { l:'신규 발생',    v:`${T.newItems}건`,  t: T.newItems  > 0 ? 'amber' : 'gray', s:'항목' },
              { l:'사라진 항목',  v:`${T.goneItems}건`, t: T.goneItems > 0 ? 'amber' : 'gray', s:'항목' },
            ].map(k => (
              <div className="kpi" key={k.l}>
                <div className="kpi-label">{k.l}</div>
                <div className="kpi-sw"><span className={`badge ${k.t}`}>{k.s}</span></div>
                <div className="kpi-val" style={{ fontSize:17, fontVariantNumeric:'tabular-nums' }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Main grid: table + chart */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:'var(--gap)' }}>

            {/* Filter + Table */}
            <div className="card cb"><span className="cbl">CompareTable</span>
              <div className="card-head">
                <span className="card-title">시점 비교 상세</span>
                <span className="card-sub">{rows.length}건</span>
                <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
                  {['ALL','증가','감소','신규 발생','사라짐','검토 필요','변동 없음'].map(ct => (
                    <button key={ct}
                      className={`btn sm${filterCT === ct ? ' primary' : ''}`}
                      style={{ fontSize:10.5, padding:'3px 8px' }}
                      onClick={() => setFilterCT(ct)}>
                      {ct === 'ALL' ? '전체' : CT_STYLE[ct]?.label || ct}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding:0 }}>
                <table className="tbl">
                  <thead><tr>
                    <th style={{ textAlign:'left', paddingLeft:16 }}>부서</th>
                    <th style={{ textAlign:'left' }}>계정</th>
                    <th>기준(A)</th>
                    <th>비교(B)</th>
                    <th>증감액</th>
                    <th>증감률</th>
                    <th>변화 유형</th>
                    <th>검토 상태</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map(r => {
                      const ct  = CT_STYLE[r.changeType] || CT_STYLE['변동 없음'];
                      const cur = statusMap[r.id] || r.reviewStatus;
                      return (
                        <tr key={r.id} className="tbl-row-hover tbl-row-click"
                          style={{ background: selected?.id === r.id ? 'var(--primary-bg)' : '' }}
                          onClick={() => setSelected(r)}>
                          <td style={{ textAlign:'left', paddingLeft:16, fontWeight:500, fontSize:11 }}>{r.deptName}</td>
                          <td style={{ textAlign:'left', fontSize:11, color:'var(--t2)' }}>
                            <div>{r.accountName}</div>
                            <div style={{ fontSize:9.5, color:'var(--t3)' }}>{r.accountCode}</div>
                          </td>
                          <td style={{ color:'var(--t3)', fontVariantNumeric:'tabular-nums' }}>{r.baseValue.toLocaleString()}</td>
                          <td style={{ fontVariantNumeric:'tabular-nums' }}>{r.targetValue.toLocaleString()}</td>
                          <td style={{ fontVariantNumeric:'tabular-nums', fontWeight:600,
                            color: r.diffAmount > 0 ? 'var(--amber)' : r.diffAmount < 0 ? 'var(--green)' : 'var(--t3)' }}>
                            {r.diffAmount > 0 ? '+' : ''}{r.diffAmount.toLocaleString()}
                          </td>
                          <td style={{ fontVariantNumeric:'tabular-nums', color:'var(--t3)' }}>
                            {r.diffRate !== null ? `${r.diffRate >= 0 ? '+' : ''}${r.diffRate.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td><span className={`badge ${ct.cls}`}>{r.changeType}</span></td>
                          <td><span className={`badge ${REVIEW_ST[cur]||'gray'}`}>{cur}</span></td>
                        </tr>
                      );
                    })}
                    {rows.length > 50 && (
                      <tr><td colSpan={8} style={{ textAlign:'center', padding:'8px 0', fontSize:11, color:'var(--t3)' }}>
                        …외 {rows.length - 50}건
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="card-foot">
                <span>기준 {allRows.length}건 · 증가 {T.increased}건 · 감소 {T.decreased}건 · 검토 필요 {T.review}건</span>
                <span style={{ fontSize:10 }}>행 클릭 시 상세 검토</span>
              </div>
            </div>

            {/* Right panel: summary + chart */}
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--gap)' }}>
              {/* Change type summary */}
              <div className="card">
                <div className="card-head"><span className="card-title">변화 유형 요약</span></div>
                <div className="card-body" style={{ paddingTop:10 }}>
                  {[
                    { type:'신규 발생', cnt:T.newItems,  cls:'green' },
                    { type:'사라짐',    cnt:T.goneItems, cls:'red'   },
                    { type:'증가',      cnt:T.increased - T.newItems, cls:'amber' },
                    { type:'감소',      cnt:T.decreased - T.goneItems,cls:'green' },
                    { type:'검토 필요', cnt:T.review,   cls:'amber'  },
                    { type:'변동 없음', cnt:T.unchanged, cls:'gray'  },
                  ].map(({ type, cnt, cls }) => (
                    <div key={type} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'5px 0', borderBottom:'1px solid var(--border-lt)', cursor:'pointer' }}
                      onClick={() => setFilterCT(filterCT === type ? 'ALL' : type)}>
                      <span style={{ fontSize:11, color:'var(--t2)' }}>{type}</span>
                      <span className={`badge ${cls}`}>{cnt}건</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top changes chart */}
              <div className="card">
                <div className="card-head"><span className="card-title">증감 Top 10</span></div>
                <div className="card-body" style={{ paddingTop:10 }}>
                  <TopChangesChart rows={allRows}/>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer */}
          <PointCompareDrawer
            row={selected}
            statusMap={statusMap}
            onClose={() => setSelected(null)}
            onAction={handleAction}
          />
        </>
      )}
    </>
  );
}

Object.assign(window, { PointCompareTab });
