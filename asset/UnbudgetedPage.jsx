/* [Component: UnbudgetedPage] — 무예산 집행 검토
   Task 5: summary cards, severity filter, table, matching panel */
const { useState: useStateU } = React;

const SEV_CONFIG = {
  H: { label:'High',   type:'red',   desc:'큰 금액 또는 반복 발생' },
  M: { label:'Medium', type:'amber', desc:'단발성 중간 금액' },
  L: { label:'Low',    type:'gray',  desc:'소액 또는 분류 확인 필요' },
};

const UB_STATUS = {
  'pending':   { label:'검토 대기', type:'gray'  },
  'reviewing': { label:'검토 중',   type:'amber' },
  'approved':  { label:'승인 완료', type:'green' },
  'rejected':  { label:'반려',      type:'red'   },
  'action':    { label:'조치요청',  type:'amber' },
};

/* ── Matching Suggestion Panel ── */
function MatchingPanel({ item, onClose, onAction }) {
  if (!item) return null;
  const sev = SEV_CONFIG[item.severity] || SEV_CONFIG.L;

  const suggestions = [
    { type:'유사 예산', desc:'수선비 / 생산부 (2026)', budget:0, note:'예산 편성 없음' },
    { type:'전년 동기', desc:'소모품비 / 생산부 (2025-03)', budget:18.5, note:'작년 3월 유사 집행' },
    { type:'동일 계정', desc:'경비 / 생산부 (5400)', budget:30.0, note:'계정 재분류 가능' },
  ];

  return (
    <div className="drawer-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="drawer cb"><span className="cbl">MatchingPanel</span>

        <div className="drawer-head">
          <div>
            <div style={{fontWeight:700,fontSize:13,color:'var(--t1)',marginBottom:4}}>{item.desc}</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span className={`badge ${sev.type}`}>{sev.label}</span>
              <span style={{fontSize:11,color:'var(--t3)'}}>{item.id} · {item.deptName} · {item.month}</span>
            </div>
          </div>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>

        <div className="drawer-body">
          {/* Key info */}
          <div className="drawer-section">
            <div className="drawer-sec-title">집행 정보</div>
            <div className="drawer-grid">
              {[
                ['계정',   `${item.accName} (${item.accCode})`],
                ['거래처', item.vendor],
                ['집행금액', `${item.amount.toFixed(1)}백만원`],
                ['담당자', item.assignee],
              ].map(([k,v])=>(
                <div key={k} className="drawer-field">
                  <span className="df-label">{k}</span>
                  <span className="df-value">{v}</span>
                </div>
              ))}
            </div>
            <div className="drawer-notice">
              예산 편성 없이 집행된 항목입니다. 사유를 확인하고 재분류 또는 사후 승인 처리를 해주세요.
            </div>
          </div>

          {/* Matching suggestions */}
          <div className="drawer-section">
            <div className="drawer-sec-title">
              유사 예산·집행 후보
              <span style={{marginLeft:6,fontSize:10,color:'var(--t3)',fontWeight:400}}>추천 — 참고용, 확정 아님</span>
            </div>
            {suggestions.map(s=>(
              <div key={s.type} className="suggest-item">
                <div className="suggest-type">{s.type}</div>
                <div className="suggest-desc">{s.desc}</div>
                <div className="suggest-note">{s.note}</div>
                {s.budget > 0 && <span className="suggest-amt">{s.budget.toFixed(1)}M</span>}
              </div>
            ))}
          </div>

          {/* Review memo */}
          <div className="drawer-section">
            <div className="drawer-sec-title">발생 사유 / 검토 메모</div>
            <textarea className="memo-box" placeholder="발생 경위, 담당자 확인 내용, 재분류 근거 등을 입력해주세요..." rows={3} />
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn sm primary" onClick={()=>onAction('approved',item)}>예산 외 집행 승인</button>
          <button className="btn sm" onClick={()=>onAction('action',item)}>계정 재분류 요청</button>
          <button className="btn sm" onClick={()=>onAction('action',item)}>부서 확인 요청</button>
          <button className="btn sm" onClick={()=>onAction('rejected',item)} style={{marginLeft:'auto'}}>반려</button>
        </div>
      </div>
    </div>
  );
}

/* ── UnbudgetedPage ── */
function UnbudgetedPage({ state }) {
  const F = window.HYCMFixtures;
  const hasData = state === 'uploaded' || state === 'partial';
  const [selected, setSelected] = useStateU(null);
  const [statusMap, setStatusMap] = useStateU({});
  const [filterSev, setFilterSev] = useStateU('ALL');

  const items = hasData
    ? F.UNBUDGETED.filter(u => filterSev === 'ALL' || u.severity === filterSev)
    : [];

  const counts = {
    total:    hasData ? F.UNBUDGETED.length : null,
    totalAmt: hasData ? F.UNBUDGETED.reduce((s,u)=>s+u.amount,0).toFixed(1) : null,
    pending:  hasData ? F.UNBUDGETED.filter(u=>u.status==='pending').length : null,
    action:   hasData ? 1 : null,
    approved: hasData ? F.UNBUDGETED.filter(u=>u.status==='approved').length : null,
    rejected: hasData ? 0 : null,
  };

  const handleAction = (action, item) => {
    setStatusMap(prev=>({...prev,[item.id]:action}));
    setSelected(null);
  };

  const summaryCards = [
    { label:'무예산 집행 건수', val: counts.total !== null ? `${counts.total}건`    : '—', type:'red',   status:'긴급 검토' },
    { label:'총 집행금액',     val: counts.totalAmt !== null ? `${counts.totalAmt}M` : '—', type:'red',   status:'합계' },
    { label:'검토 대기',       val: counts.pending !== null ? `${counts.pending}건`  : '—', type:'amber', status:'처리 필요' },
    { label:'조치 요청',       val: counts.action !== null ? `${counts.action}건`    : '—', type:'amber', status:'진행 중' },
    { label:'승인 완료',       val: counts.approved !== null ? `${counts.approved}건`: '—', type:'green', status:'완료' },
    { label:'반려',            val: counts.rejected !== null ? `${counts.rejected}건`: '—', type:'gray',  status:'완료' },
  ];

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">무예산 집행 검토</div>
          <div className="pg-sub">예산 편성 없이 집행된 항목을 확인하고 사유와 조치 상태를 관리합니다.</div>
        </div>
        <div className="flex-1" />
        <button className="btn sm">내보내기</button>
      </div>

      {/* Summary KPI cards */}
      <div className="kpi-row-6 cb"><span className="cbl">UnbudgetedKPIRow</span>
        {summaryCards.map(k=>(
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className={`kpi-val${!hasData?' empty':''}`} style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Severity filter */}
      <div className="filter-bar cb"><span className="cbl">SeverityFilter</span>
        <span style={{fontSize:11,fontWeight:600,color:'var(--t2)'}}>심각도 필터</span>
        {[
          {val:'ALL', label:'전체'},
          {val:'H',   label:'High — 즉시 검토'},
          {val:'M',   label:'Medium — 검토 필요'},
          {val:'L',   label:'Low — 확인 후 처리'},
        ].map(f=>(
          <button key={f.val}
            className={`btn sm${filterSev===f.val?' primary':''}`}
            onClick={()=>setFilterSev(f.val)}>{f.label}</button>
        ))}
        <div className="filter-group" style={{marginLeft:'auto'}}>
          <label className="filter-label">검토 상태</label>
          <select className="filter-sel">
            <option>전체</option><option>검토 대기</option><option>검토 중</option><option>완료</option>
          </select>
        </div>
        {!hasData && <span className="filter-warn">※ ERP 미연결 상태</span>}
      </div>

      {/* Main table */}
      <div className="card cb"><span className="cbl">UnbudgetedTable</span>
        <div className="card-head">
          <span className="card-title">무예산 집행 목록</span>
          {hasData && <span className="card-sub">{items.length}건</span>}
          <div className="flex-1" />
          <span style={{fontSize:10.5,color:'var(--t3)'}}>행 클릭 시 상세 검토</span>
        </div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>발생월</th>
              <th style={{textAlign:'left'}}>부서</th>
              <th style={{textAlign:'left'}}>계정</th>
              <th style={{textAlign:'left'}}>거래처</th>
              <th style={{textAlign:'left'}}>적요</th>
              <th>집행금액</th>
              <th>심각도</th><th>검토 상태</th>
              <th style={{textAlign:'left'}}>담당자</th>
              <th style={{textAlign:'left'}}>액션</th>
            </tr></thead>
            <tbody>
              {!hasData ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>
                  ERP 연동 또는 실적 파일 업로드 후 무예산 집행 내역이 표시됩니다.
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>
                  선택한 심각도 조건에 해당하는 항목이 없습니다.
                </td></tr>
              ) : items.map(item => {
                const sev = SEV_CONFIG[item.severity] || SEV_CONFIG.L;
                const curStatus = statusMap[item.id] || item.status;
                const st = UB_STATUS[curStatus] || { label:curStatus, type:'gray' };
                return (
                  <tr key={item.id} className="tbl-row-hover tbl-row-click"
                    onClick={()=>setSelected(item)}
                    style={{background:selected?.id===item.id?'var(--primary-bg)':''}}>
                    <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{item.month}</td>
                    <td style={{textAlign:'left',fontWeight:500}}>{item.deptName}</td>
                    <td style={{textAlign:'left',color:'var(--t2)'}}>{item.accName}</td>
                    <td style={{textAlign:'left',color:'var(--t2)',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.vendor}</td>
                    <td style={{textAlign:'left',color:'var(--t2)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.desc}</td>
                    <td style={{fontWeight:600,color: item.severity==='H'?'var(--red)':item.severity==='M'?'var(--amber)':'var(--t2)'}}>
                      {item.amount.toFixed(1)}M
                    </td>
                    <td><span className={`badge ${sev.type}`}>{sev.label}</span></td>
                    <td><span className={`badge ${st.type}`}>{st.label}</span></td>
                    <td style={{textAlign:'left',color:'var(--t3)'}}>{item.assignee}</td>
                    <td style={{textAlign:'left'}}>
                      <span style={{fontSize:11,color:'var(--primary)',cursor:'pointer'}}
                        onClick={e=>{e.stopPropagation();setSelected(item)}}>검토 →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>출처: ERP 자동 수신 또는 파일 업로드</span>
          <span>{hasData ? `기준: ${F.DEMO_META.syncedAt}` : '마지막 수신: —'}</span>
        </div>
      </div>
      <div style={{height:8}} />

      <MatchingPanel item={selected} onClose={()=>setSelected(null)} onAction={handleAction} />
    </>
  );
}

Object.assign(window, { UnbudgetedPage });
