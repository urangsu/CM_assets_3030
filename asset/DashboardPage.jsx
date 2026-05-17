/* [Component: DashboardPage] — 업로드 상태 기반, localStorage 연동 */
const { useState: useDst, useEffect: useDef } = React;

function StateBanner({ dataState, onNav }) {
  if (dataState === 'uploaded') return null;
  const cfg = {
    'no-upload': { cls:'state-banner info', msg:<><strong>업로드된 실적 파일이 없습니다.</strong> 실적 업로드 페이지에서 엑셀 또는 CSV 파일을 업로드하세요.</>, cta:<><button className="btn sm" onClick={()=>onNav('actual-upload')}>실적 업로드하러 가기 →</button></> },
    'partial':   { cls:'state-banner warn', msg:<><strong>일부 기간의 실적 데이터가 누락되어 있습니다.</strong> 실적DB 정리에서 확인해주세요.</>, cta:null },
    'error':     { cls:'state-banner err',  msg:<><strong>데이터 처리 중 오류가 발생했습니다.</strong> 파일을 다시 업로드하거나 시스템 관리자에게 문의해주세요.</>, cta:<button className="btn sm" onClick={()=>onNav('actual-upload')}>재업로드</button> },
  }[dataState];
  if (!cfg) return null;
  return <div className={cfg.cls}><svg width={13} height={13} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r=".7" fill="currentColor"/></svg><span>{cfg.msg}</span>{cfg.cta && <div style={{marginLeft:'auto'}}>{cfg.cta}</div>}</div>;
}

function DataStatusStrip({ dataState, uploadedAt }) {
  if (dataState === 'no-upload') return null;
  const items = [
    { label:'실적 데이터',   value: dataState==='error' ? '처리 오류' : dataState==='partial' ? '일부 누락' : '업로드됨', type: dataState==='error'?'red':dataState==='partial'?'amber':'green' },
    { label:'예산 데이터',   value: '준비됨',    type:'green' },
    { label:'최근 업로드',   value: uploadedAt || '—', type:'gray' },
    { label:'검토 상태',     value: '대기 중',   type:'amber' },
  ];
  return (
    <div className="status-strip cb"><span className="cbl">DataStatusStrip</span>
      {items.map(it => (
        <div className="ss-item" key={it.label}>
          <span className="ss-label">{it.label}</span>
          <span className={`badge ${it.type}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function KPIRow({ dataState, summary }) {
  const has = dataState === 'uploaded' || dataState === 'partial';
  const K = summary;
  const items = has ? [
    { label:'총 집행 (YTD)',    status:'집계 완료', stype:'green', val:`${(K.totalActual/1000).toFixed(1)}M`, desc:'완료실적 합계' },
    { label:'초과 항목',        status: K.overrunCount>0?'검토 필요':'없음', stype:K.overrunCount>0?'amber':'green', val:`${K.overrunCount}건`, desc:'예산 대비 초과 집행' },
    { label:'무예산 집행',      status:K.noBudgetCount>0?'긴급 검토':'없음', stype:K.noBudgetCount>0?'red':'green', val:`${K.noBudgetCount}건`, desc:'예산 없이 집행된 건' },
    { label:'데이터 기준',      status:'업로드됨', stype:'green', val:'2026년', desc:`${K.rowCount}건 수신` },
  ] : [
    { label:'총 집행 (YTD)',    status:'데이터 없음', stype:'gray', val:'—', desc:'실적 파일 업로드 후 표시' },
    { label:'초과 항목',        status:'대기 중',     stype:'gray', val:'—', desc:'예산 대비 초과 집행' },
    { label:'무예산 집행',      status:'대기 중',     stype:'gray', val:'—', desc:'예산 없이 집행된 건' },
    { label:'데이터 상태',      status:'미업로드',    stype:'gray', val:'—', desc:'실적 파일 업로드 필요' },
  ];
  return (
    <div className="kpi-row cb"><span className="cbl">KPIRow</span>
      {items.map(k => (
        <div className="kpi cb" key={k.label}><span className="cbl">KPICard</span>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-sw"><span className={`badge ${k.stype}`}>{k.status}</span></div>
          <div className={`kpi-val${!has?' empty':''}`}>{k.val}</div>
          <div className="kpi-desc">{k.desc}</div>
        </div>
      ))}
    </div>
  );
}

function ActualBarChart({ actuals }) {
  const D = window.HYCMData;
  const byMonth = Array.from({length:12}, (_,mi) => {
    const total = actuals.filter(a => D.parsePeriodMonth(a.period)===mi).reduce((s,a)=>s+(a.completed||0),0);
    return total;
  });
  const max = Math.max(...byMonth, 1);
  return (
    <div className="cb"><span className="cbl">ActualBarChart</span>
      <div className="chart-hdr">
        <span className="chart-title">월별 실적 집계 <span className="chart-unit">(단위: 천원)</span></span>
        <div className="chart-legend"><span className="leg"><span className="leg-box a"/>실적(완료실적)</span></div>
      </div>
      <div className="chart-wrap" style={{height:88}}>
        {byMonth.map((v, mi) => {
          const h = `${(v/max*84).toFixed(0)}px`;
          const isCur = mi === D.CUR_MONTH - 1;
          return (
            <div className="bar-grp" key={mi}>
              <div className="bar b" style={{height:'50%', opacity:.25}} />
              {v > 0 && <div className={`bar a${isCur?' cur':''}`} style={{height:h, opacity:isCur?.6:1}} />}
            </div>
          );
        })}
      </div>
      <div className="chart-labels">{D.MONTH_LABELS.map((m,i)=><span key={m} className={`clbl${i===D.CUR_MONTH-1?' active':''}`}>{m}</span>)}</div>
    </div>
  );
}

function DeptProgress({ actuals }) {
  const D = window.HYCMData;
  const deptTotals = {};
  actuals.forEach(a => { deptTotals[a.usageCode] = (deptTotals[a.usageCode]||0) + (a.completed||0); });
  const sorted = Object.entries(deptTotals).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = sorted[0]?.[1] || 1;
  const getDeptName = code => D.DEPARTMENTS.find(d=>d.code===code)?.name || code;
  return (
    <div className="cb"><span className="cbl">DeptProgress</span>
      <div className="aside-title">부서별 실적 현황</div>
      <div className="prog-list">
        {sorted.length === 0 ? <div style={{fontSize:11,color:'var(--t3)'}}>데이터 없음</div> :
          sorted.map(([code, val]) => (
            <div key={code}>
              <div className="prog-row">
                <span className="prog-name">{getDeptName(code)}</span>
                <span className="prog-val ok">{val.toLocaleString()}</span>
              </div>
              <div className="prog-track"><div className="prog-fill ok" style={{width:`${(val/max*100).toFixed(0)}%`}}/></div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function OpsModuleRow({ onNav }) {
  const SD = window.HYCMSalesData || { DEMO_SALES:[], DEMO_PURCHASES:[] };
  const salesRecs = SD.DEMO_SALES;
  const purchRecs = SD.DEMO_PURCHASES;

  const totalRevenue  = salesRecs.reduce((s,r)=>s+(r.revenue||0),0);
  const salesCountries= new Set(salesRecs.map(r=>r.countryCode)).size;
  const topSalesCtry  = Object.entries(salesRecs.reduce((m,r)=>{m[r.countryName]=(m[r.countryName]||0)+r.revenue;return m;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  const topProduct    = Object.entries(salesRecs.reduce((m,r)=>{m[r.productName]=(m[r.productName]||0)+r.revenue;return m;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';

  const totalPurchase = purchRecs.reduce((s,r)=>s+(r.amount||0),0);
  const purchCountries= new Set(purchRecs.map(r=>r.countryCode)).size;
  const topPurchCtry  = Object.entries(purchRecs.reduce((m,r)=>{m[r.countryName]=(m[r.countryName]||0)+r.amount;return m;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  const topMaterial   = Object.entries(purchRecs.reduce((m,r)=>{m[r.materialName]=(m[r.materialName]||0)+r.amount;return m;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';

  function ModuleCard({ title, stats, navId, children }) {
    return (
      <div className="card cb" style={{cursor:'pointer'}} onClick={()=>onNav(navId)}><span className="cbl">ModuleCard</span>
        <div className="card-head">
          <span className="card-title">{title}</span>
          <span className="demo-chip" style={{marginLeft:'auto'}}><span className="demo-dot"/>SAMPLE</span>
        </div>
        <div className="card-body" style={{paddingTop:8}}>
          {children}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
            {stats.map(({l,v})=>(
              <div key={l} style={{background:'var(--bg)',borderRadius:'var(--rsm)',padding:'6px 10px'}}>
                <div style={{fontSize:10,color:'var(--t3)'}}>{l}</div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--t1)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</div>
              </div>
            ))}
          </div>
          <button className="btn sm primary" style={{width:'100%',justifyContent:'center'}}
            onClick={e=>{e.stopPropagation();onNav(navId);}}>
            {title} 보기 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'var(--gap)'}} className="cb">
      <span className="cbl">OpsModuleRow</span>

      <ModuleCard title="판매 현황" navId="sales" stats={[
        {l:'총 매출',   v:`$${(totalRevenue/1e6).toFixed(1)}M`},
        {l:'판매 국가', v:`${salesCountries}개국`},
        {l:'TOP 국가',  v:topSalesCtry},
        {l:'TOP 제품',  v:topProduct.split('(')[0]},
      ]}>
        <div style={{fontSize:11,color:'var(--t3)',marginBottom:10}}>국가·제품·고객사별 판매량과 매출 현황</div>
      </ModuleCard>

      <ModuleCard title="원료 구매" navId="purchase" stats={[
        {l:'총 구매금액', v:`$${(totalPurchase/1e6).toFixed(1)}M`},
        {l:'구매 국가',   v:`${purchCountries}개국`},
        {l:'TOP 국가',    v:topPurchCtry},
        {l:'TOP 원료',    v:topMaterial.split('(')[0]},
      ]}>
        <div style={{fontSize:11,color:'var(--t3)',marginBottom:10}}>국가·공급사·원료별 구매금액과 현황</div>
      </ModuleCard>

      <div className="shell-card cb"><span className="cbl">ProductionCard</span>
        <div className="shell-hdr"><span className="shell-title">생산 실적</span><span className="shell-tag">준비 중</span></div>
        <div className="shell-body"><Ico id="bar" size={20}/><span className="shell-msg">데이터 미연결</span><span className="shell-sub">MES 연동 검토 중</span></div>
        <div className="skel-list"><div className="skel" style={{width:'100%'}}/><div className="skel" style={{width:'68%'}}/><div className="skel" style={{width:'84%'}}/></div>
      </div>
    </div>
  );
}

function DashboardPage({ state, onNav }) {
  const D = window.HYCMData;
  const [actuals, setActuals] = useDst([]);
  const [log, setLog] = useDst([]);
  const isDemo = state === 'uploaded' && actuals.length === 0;
  const displayActuals = state === 'uploaded'
    ? (actuals.length > 0 ? actuals : D.DEMO_ACTUALS)
    : actuals;

  useDef(() => {
    setActuals(D.loadActuals('2026'));
    setLog(D.getUploadLog());
  }, [state]);

  const summary = {
    totalActual: displayActuals.reduce((s,a)=>s+(a.completed||0),0),
    rowCount: displayActuals.length,
    overrunCount: 0,   // requires budget data — placeholder
    noBudgetCount: 0,  // requires budget data — placeholder
  };

  const uploadedAt = log[0]?.uploadedAt ? new Date(log[0].uploadedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : D.DEMO_META.uploadedAt;
  const has = state === 'uploaded' || state === 'partial';

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div><div className="pg-title">대시보드</div><div className="pg-sub">실적 파일 업로드 후 현황이 표시됩니다.</div></div>
        <div className="flex-1"/>
        <button className="btn sm" onClick={()=>onNav('actual-upload')}>실적 업로드</button>
      </div>

      <StateBanner dataState={state} onNav={onNav}/>
      {has && isDemo && (
        <div className="state-banner warn">
          <span>로컬 업로드 데이터가 없어 <strong>SAMPLE DATA</strong>를 표시 중입니다. 실적 파일을 업로드하면 실제 데이터로 대체됩니다.</span>
        </div>
      )}
      <DataStatusStrip dataState={state} uploadedAt={uploadedAt}/>
      <KPIRow dataState={state} summary={summary}/>

      <div className="budget-card cb"><span className="cbl">ActualSection</span>
        <div className="budget-head">
          <span className="budget-head-title">실적 집계 현황</span>
          <span className="budget-head-sub">업로드된 완료실적 기준</span>
          <span className="budget-head-tag">핵심 영역</span>
        </div>
        <div className="tabs">
          {['월별 집계','부서별 현황','계정별 현황','무예산 집행'].map((t,i)=>(
            <div key={t} className={`tab${i===0?' active':''}`} onClick={()=>i===3&&onNav('unbudgeted')}>{t}</div>
          ))}
        </div>
        <div className="budget-body">
          <div className="budget-main cb"><span className="cbl">ActualChart</span>
            {!has ? (
              <div className="conn-guide">
                <span className="conn-guide-text">실적 파일을 업로드하면 월별 집계 차트가 표시됩니다.</span>
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <button className="btn sm primary" onClick={()=>onNav('actual-upload')}>실적 업로드</button>
                  <button className="btn sm" onClick={()=>onNav('actual-transform')}>실적 변환</button>
                </div>
              </div>
            ) : <ActualBarChart actuals={displayActuals}/>}
          </div>
          <div className="budget-aside cb"><span className="cbl">DeptAside</span>
            {has ? <DeptProgress actuals={displayActuals}/> : (
              <><div className="aside-title">부서별 실적 현황</div>
              <div style={{fontSize:11,color:'var(--t3)'}}>실적 업로드 후 표시됩니다.</div></>
            )}
          </div>
        </div>
        <div className="card-foot">
          <span>출처: 엑셀/CSV 파일 업로드</span>
          <span>{has ? `기준: ${uploadedAt}` : '최근 업로드: 없음'}</span>
        </div>
      </div>

      <OpsModuleRow onNav={onNav}/>
      <div style={{height:8}}/>
    </>
  );
}

Object.assign(window, { DashboardPage });
