/* [Component: VariancePage] — 비교분석
   탭 1: 부서별 실적 분석 (기존)
   탭 2: 시점 vs 시점 비교 (신규) */
const { useState: useVSt, useEffect: useVEf, useMemo: useVMemo } = React;

function VariancePage({ state, onNav }) {
  const [activeTab, setActiveTab] = useVSt('existing');

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">비교분석</div>
          <div className="pg-sub">실적·예산 데이터를 다양한 기준으로 비교·분석합니다.</div>
        </div>
        <div className="flex-1"/>
        <button className="btn sm">내보내기</button>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, background:'var(--white)', border:'1px solid var(--border)',
        borderRadius:'var(--r)', overflow:'hidden', boxShadow:'var(--shadow)', marginBottom:0 }}>
        {[
          { id:'existing', label:'부서별 실적 분석' },
          { id:'point',    label:'시점 vs 시점 비교' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex:1, padding:'9px 16px', fontSize:12.5, fontWeight: activeTab===t.id ? 700 : 500,
              color: activeTab===t.id ? 'var(--primary)' : 'var(--t3)',
              background: activeTab===t.id ? 'var(--primary-bg)' : 'var(--white)',
              border:'none', borderBottom: activeTab===t.id ? '2px solid var(--primary)' : '2px solid transparent',
              cursor:'pointer', fontFamily:'inherit', transition:'all .12s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'existing'
        ? <VarianceExistingContent state={state}/>
        : <PointCompareTab onNav={onNav}/>
      }
    </>
  );
}

/* ── 기존 분석 콘텐츠 (탭 1) ──────────────────────────────── */
function VarianceExistingContent({ state }) {
  const D = window.HYCMData;
  const [year, setYear] = useVSt('2026');
  const [period, setPeriod] = useVSt('전체');
  const [filterDept, setFilterDept] = useVSt('ALL');
  const [view, setView] = useVSt('dept'); // dept | account | monthly
  const [actuals, setActuals] = useVSt([]);

  useVEf(() => { setActuals(D.loadActuals(year)); }, [year, state]);

  const has = (state === 'uploaded' || state === 'partial') || actuals.length > 0;
  const displayActuals = has && actuals.length === 0 ? D.DEMO_ACTUALS : actuals;

  // Month filter
  const QUARTERS = { '1Q':[0,1,2], '2Q':[3,4,5], '3Q':[6,7,8], '4Q':[9,10,11] };
  const months = period === '전체' ? [0,1,2,3,4,5,6,7,8,9,10,11]
    : QUARTERS[period] ? QUARTERS[period]
    : [parseInt(period)-1];

  // Dept totals from actuals
  const deptData = useVMemo(() => {
    if (!has) return [];
    const map = {};
    displayActuals.forEach(a => {
      const mi = D.parsePeriodMonth(a.period);
      if (!months.includes(mi)) return;
      if (filterDept !== 'ALL' && a.usageCode !== filterDept) return;
      if (!map[a.usageCode]) map[a.usageCode] = { code:a.usageCode, name:D.DEPARTMENTS.find(d=>d.code===a.usageCode)?.name||a.usageCode, actual:0, rowCount:0 };
      map[a.usageCode].actual += (a.completed||0);
      map[a.usageCode].rowCount++;
    });
    return Object.values(map).sort((a,b)=>b.actual-a.actual);
  }, [displayActuals, months, filterDept, has]);

  // Monthly totals
  const monthlyData = useVMemo(() => {
    if (!has) return [];
    return D.MONTH_LABELS.map((label, mi) => {
      const actual = displayActuals
        .filter(a => D.parsePeriodMonth(a.period)===mi && (filterDept==='ALL'||a.usageCode===filterDept))
        .reduce((s,a)=>s+(a.completed||0),0);
      return { label, actual, mi };
    });
  }, [displayActuals, filterDept, has]);

  const totalActual = deptData.reduce((s,d)=>s+d.actual,0);
  const maxActual = Math.max(...deptData.map(d=>d.actual),1);
  const maxMonthly = Math.max(...monthlyData.map(d=>d.actual),1);

  const DEPT_OPTIONS = [{ code:'ALL', name:'전체 부서' },
    ...D.DEPARTMENTS.filter(d=>!['99999','99901','99902','99903','98000'].includes(d.code))];

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">비교분석</div>
          <div className="pg-sub">실적 데이터를 부서·계정·월별로 분석합니다. 예산 데이터 연동 시 차이분석이 활성화됩니다.</div>
        </div>
        <div className="flex-1"/>
        <button className="btn sm">내보내기</button>
      </div>

      {!has && (
        <div className="state-banner info">
          <span><strong>업로드된 실적 데이터가 없습니다.</strong> 실적 파일을 업로드하면 분석 데이터가 표시됩니다.</span>
        </div>
      )}
      {has && actuals.length === 0 && (
        <div className="state-banner warn"><span><strong>SAMPLE DATA 표시 중.</strong> 실제 업로드 데이터가 없어 샘플을 사용합니다.</span></div>
      )}

      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        <div className="filter-group"><label className="filter-label">연도</label>
          <select className="filter-sel" value={year} onChange={e=>setYear(e.target.value)}>
            {['2026','2025','2024'].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group"><label className="filter-label">기간</label>
          <select className="filter-sel" value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="전체">전체</option>
            <option value="1Q">1분기</option><option value="2Q">2분기</option>
            <option value="3Q">3분기</option><option value="4Q">4분기</option>
            {D.MONTH_LABELS.map((m,i)=><option key={m} value={`${i+1}월`}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group"><label className="filter-label">부서</label>
          <select className="filter-sel" value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
            {DEPT_OPTIONS.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div className="filter-group"><label className="filter-label">분석 기준</label>
          <select className="filter-sel" value={view} onChange={e=>setView(e.target.value)}>
            <option value="dept">부서별</option>
            <option value="monthly">월별</option>
            <option value="account">계정별</option>
          </select>
        </div>
      </div>

      {/* Summary KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)'}}>
        {[
          { label:'집계 실적 (완료실적)', val: has ? `${(totalActual/1000).toFixed(0)}천원` : '—', type: has?'green':'gray', status: has?'집계됨':'없음' },
          { label:'집계 부서 수',         val: has ? `${deptData.length}개` : '—',            type:'gray', status:'집계됨' },
          { label:'총 실적 건수',          val: has ? `${displayActuals.length}건` : '—',       type:'gray', status:'집계됨' },
          { label:'예산 비교',             val: '—',                                              type:'gray', status:'예산 미연동' },
        ].map(k=>(
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className={`kpi-val${!has?' empty':''}`} style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Main content: chart + table */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:'var(--gap)'}}>

        <div className="card cb"><span className="cbl">VarianceChart</span>
          <div className="card-head"><span className="card-title">{view==='monthly'?'월별 실적 추이':view==='dept'?'부서별 실적 현황':'계정별 실적 현황'}</span></div>
          <div className="card-body">
            {!has ? <div className="empty-state">실적 파일 업로드 후 표시됩니다.</div> : (
              view === 'monthly' ? (
                /* Monthly bar chart */
                <>
                  <div className="chart-wrap" style={{height:120}}>
                    {monthlyData.map((m,i)=>{
                      const h = `${(m.actual/maxMonthly*110).toFixed(0)}px`;
                      const inPeriod = months.includes(m.mi);
                      return (
                        <div className="bar-grp" key={i}>
                          <div className={`bar a${!inPeriod?' cur':''}`} style={{height:h, opacity:inPeriod?1:.25}}/>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-labels">{D.MONTH_LABELS.map((m,i)=><span key={m} className={`clbl${months.includes(i)?' active':''}`}>{m}</span>)}</div>
                </>
              ) : (
                /* Dept / Account horizontal bars */
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                  {deptData.slice(0,10).map(d=>(
                    <div key={d.code}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:11}}>
                        <span style={{color:'var(--t2)',fontWeight:500}}>{d.name}<span style={{color:'var(--t3)',fontWeight:400,marginLeft:4}}>{d.code}</span></span>
                        <span style={{color:'var(--t1)',fontVariantNumeric:'tabular-nums',fontWeight:600}}>{d.actual.toLocaleString()}</span>
                      </div>
                      <div className="prog-track" style={{height:6}}>
                        <div className="prog-fill ok" style={{width:`${(d.actual/maxActual*100).toFixed(0)}%`}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Insight panel */}
        <div className="card cb"><span className="cbl">InsightPanel</span>
          <div className="card-head"><span className="card-title">점검 후보</span><span className="card-sub">참고용</span></div>
          <div className="card-body">
            {!has ? <div style={{fontSize:11,color:'var(--t3)'}}>실적 업로드 후 표시됩니다.</div> : (
              <>
                <div className="aside-title" style={{marginBottom:6}}>실적 상위 부서</div>
                {deptData.slice(0,3).map(d=>(
                  <div key={d.code} className="rv amber" style={{marginBottom:5}}>
                    <div className="rv-row"><span className="rv-text">{d.name}</span><span className="badge amber">{(d.actual/1000).toFixed(0)}천</span></div>
                    <div className="rv-meta">집행 건수 {d.rowCount}건</div>
                  </div>
                ))}
                <div style={{height:10}}/>
                <div className="aside-title" style={{marginBottom:6}}>예산 대비 분석</div>
                <div className="rv" style={{marginBottom:5}}>
                  <div className="rv-text" style={{color:'var(--t3)'}}>예산 데이터 미연동</div>
                  <div className="rv-meta">예산 현황 페이지에서 예산 입력 후 활성화</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="card cb"><span className="cbl">VarianceTable</span>
        <div className="card-head"><span className="card-title">부서별 실적 집계 상세</span>{has&&<span className="card-sub">{deptData.length}개 부서</span>}</div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>부서코드</th>
              <th style={{textAlign:'left'}}>부서명</th>
              <th>실적 합계</th>
              <th>집계 건수</th>
              <th>예산</th>
              <th>차이</th>
              <th>판정</th>
            </tr></thead>
            <tbody>
              {!has
                ? <tr><td colSpan={7} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>실적 파일을 업로드해주세요.</td></tr>
                : deptData.length === 0
                  ? <tr><td colSpan={7} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>선택 조건에 해당하는 실적이 없습니다.</td></tr>
                  : deptData.map(d=>(
                      <tr key={d.code} className="tbl-row-hover">
                        <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{d.code}</td>
                        <td style={{textAlign:'left',fontWeight:600}}>{d.name}</td>
                        <td style={{fontWeight:600}}>{d.actual.toLocaleString()}</td>
                        <td>{d.rowCount}</td>
                        <td style={{color:'var(--t3)'}}>—</td>
                        <td style={{color:'var(--t3)'}}>—</td>
                        <td><span className="badge gray">예산 미연동</span></td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>출처: 엑셀/CSV 파일 업로드 · localStorage</span>
          <span>※ 예산 데이터 연동 시 차이율·판정 활성화</span>
        </div>
      </div>
      <div style={{height:8}}/>
    </>
  );
}

Object.assign(window, { VariancePage });
