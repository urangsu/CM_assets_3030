/* [Component: BudgetPage] — 예산 현황
   Task 3: filters, KPI summary, bar chart, dept table, account breakdown */
const { useState: useStateB, useMemo: useMemoB } = React;

function BudgetPage({ state }) {
  const F = window.HYCMFixtures;
  const hasData = state === 'uploaded' || state === 'partial';
  const [activeDept, setActiveDept] = useStateB('ALL');

  const filteredDepts = activeDept === 'ALL'
    ? F.deptSummary
    : F.deptSummary.filter(d => d.code === activeDept);

  const totBudget = filteredDepts.reduce((s,d) => s+d.budgetYTD, 0);
  const totActual = filteredDepts.reduce((s,d) => s+d.actualYTD, 0);
  const totRate   = totBudget > 0 ? +(totActual/totBudget*100).toFixed(1) : 0;

  const statusBadge = (d) => {
    if (!hasData) return <span className="badge gray">—</span>;
    if (d.status==='over')  return <span className="badge red">초과</span>;
    if (d.status==='under') return <span className="badge amber">미달</span>;
    return <span className="badge green">정상</span>;
  };

  return (
    <>
      {/* Page Header */}
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">예산 현황</div>
          <div className="pg-sub">부서·계정·월별 예산 집행률과 이상 항목을 확인합니다.</div>
        </div>
        <div className="flex-1" />
        <button className="btn sm">보고서 출력</button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        <div className="filter-group">
          <label className="filter-label">연도</label>
          <select className="filter-sel"><option>2026</option><option>2025</option></select>
        </div>
        <div className="filter-group">
          <label className="filter-label">월</label>
          <select className="filter-sel"><option>1–5월 누계</option><option>5월</option><option>4월</option></select>
        </div>
        <div className="filter-group">
          <label className="filter-label">계획 구분</label>
          <select className="filter-sel"><option>본예산</option><option>수정예산</option></select>
        </div>
        <div className="filter-group">
          <label className="filter-label">부서</label>
          <select className="filter-sel" value={activeDept} onChange={e=>setActiveDept(e.target.value)}>
            <option value="ALL">전체</option>
            {F.DEPARTMENTS.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">검토 상태</label>
          <select className="filter-sel"><option>전체</option><option>검토 필요</option><option>확인 완료</option></select>
        </div>
        {!hasData && <span className="filter-warn">※ ERP 미연결 상태 — 데이터 없음</span>}
      </div>

      {/* KPI Summary */}
      <div className="kpi-row-6 cb"><span className="cbl">BudgetKPIRow</span>
        {[
          { label:'총 예산 (연간)',   val: hasData ? `${F.KPI.totalBudgetAnnual.toLocaleString()}M` : '—', type:'green', status:'확정' },
          { label:'YTD 누적 집행',   val: hasData ? `${totActual.toLocaleString()}M` : '—', type:'green', status:'집계 완료' },
          { label:'잔여 예산',       val: hasData ? `${(F.KPI.totalBudgetAnnual - totActual).toLocaleString()}M` : '—', type:'green', status:'여유' },
          { label:'YTD 집행률',      val: hasData ? `${totRate}%` : '—', type: hasData && totRate>100?'red': hasData&&totRate<88?'amber':'green', status: hasData ? (totRate>100?'주의':'정상') : '—' },
          { label:'전월 대비',       val: hasData ? '-2.3%p' : '—', type:'amber', status:'하락' },
          { label:'전년 동월 대비',  val: hasData ? '+4.1%p' : '—', type:'green', status:'개선' },
        ].map(k => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className={`kpi-val${!hasData?' empty':''}`} style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Budget Execution Chart */}
      <div className="card cb"><span className="cbl">BudgetExecutionChart</span>
        <div className="card-head">
          <span className="card-title">월별 예산·실적 추이</span>
          <div className="chart-legend" style={{marginLeft:'auto'}}>
            <span className="leg"><span className="leg-box b" />예산</span>
            <span className="leg"><span className="leg-box a" />실적</span>
          </div>
        </div>
        <div className="card-body">
          {!hasData ? (
            <div className="empty-state">데이터 미연결 — ERP 연동 또는 실적 업로드 후 표시됩니다</div>
          ) : (
            <>
              <div className="chart-wrap" style={{height:96}}>
                {F.monthlyBudget.map((b,mi) => {
                  const a = F.monthlyActual[mi];
                  const maxV = Math.max(...F.monthlyBudget);
                  const bh = `${(b/maxV*88).toFixed(0)}px`;
                  const ah = a ? `${(a/maxV*88).toFixed(0)}px` : '0px';
                  return (
                    <div className="bar-grp" key={mi}>
                      <div className="bar b" style={{height:bh, opacity:mi>=F.CUR_MONTH?.3:1}} />
                      {a && <div className={`bar a${a>b?' over':''}`} style={{height:ah, opacity:mi===F.CUR_MONTH-1?.6:1}} />}
                    </div>
                  );
                })}
              </div>
              <div className="chart-labels">{F.MONTH_LABELS.map((m,i)=><span key={m} className={`clbl${i===F.CUR_MONTH-1?' active':''}`}>{m}</span>)}</div>
            </>
          )}
        </div>
      </div>

      {/* Department Table */}
      <div className="card cb"><span className="cbl">DeptTable</span>
        <div className="card-head">
          <span className="card-title">부서별 집행 현황</span>
          <span className="card-sub">YTD 기준 (1–5월 누계)</span>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:20}}>부서명</th>
              <th>YTD 예산</th><th>집행금액</th><th>잔여예산</th>
              <th>집행률</th><th>초과·미달</th><th>검토 상태</th><th>담당자</th>
              <th style={{textAlign:'left'}}>상세</th>
            </tr></thead>
            <tbody>
              {F.deptSummary.map(d => (
                <tr key={d.code} className="tbl-row-hover">
                  <td style={{textAlign:'left',paddingLeft:20,fontWeight:600,color:'var(--t1)'}}>{d.name}</td>
                  <td>{hasData ? d.budgetYTD.toLocaleString() : '—'}</td>
                  <td>{hasData ? d.actualYTD.toLocaleString() : '—'}</td>
                  <td className={hasData && d.variance<0 ? 'pos' : hasData && d.variance>0 ? 'neg' : ''}>
                    {hasData ? `${d.variance>0?'+':''}${d.variance}` : '—'}
                  </td>
                  <td className={hasData && d.rate>100 ? 'neg' : ''}>
                    {hasData ? (
                      <span style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                        {d.rate}%
                        <span style={{display:'inline-block',width:36,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                          <span style={{display:'block',height:'100%',width:`${Math.min(d.rate,100)}%`,background: d.status==='over'?'var(--red)':d.status==='under'?'var(--amber)':'var(--green)',borderRadius:2}} />
                        </span>
                      </span>
                    ) : '—'}
                  </td>
                  <td>{statusBadge(d)}</td>
                  <td>{hasData ? <span className="badge gray">검토 중</span> : <span className="badge gray">—</span>}</td>
                  <td style={{color:'var(--t3)'}}>{d.head}</td>
                  <td style={{textAlign:'left'}}>
                    <span style={{fontSize:11,color:'var(--primary)',cursor:'pointer'}}>상세 →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Breakdown */}
      <div className="card cb"><span className="cbl">AccountBreakdown</span>
        <div className="card-head">
          <span className="card-title">계정별 집행 현황</span>
          <span className="card-sub">집행률 기준 정렬</span>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:20}}>계정명</th>
              <th>YTD 예산</th><th>집행금액</th><th>집행률</th><th>상태</th>
            </tr></thead>
            <tbody>
              {F.ACCOUNT_VARIANCE.map(a => (
                <tr key={a.acc} className="tbl-row-hover">
                  <td style={{textAlign:'left',paddingLeft:20,fontWeight:500}}>{a.acc}</td>
                  <td>{hasData ? a.budget.toLocaleString() : '—'}</td>
                  <td>{hasData ? a.actual.toLocaleString() : '—'}</td>
                  <td>{hasData ? `${a.rate}%` : '—'}</td>
                  <td>
                    {hasData
                      ? a.status==='under'
                        ? <span className="badge amber">미달</span>
                        : <span className="badge green">정상</span>
                      : <span className="badge gray">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>출처: ERP 자동 수신 또는 파일 업로드</span>
          <span>{hasData ? `기준: ${F.DEMO_META.syncedAt}` : '—'}</span>
        </div>
      </div>
      <div style={{height:8}} />
    </>
  );
}

Object.assign(window, { BudgetPage });
