/* [Component: ExecutionPage] — 집행 내역
   Task 4: execution table + detail drawer */
const { useState: useStateE } = React;

const ANOMALY_BADGE = {
  '정상':  { type:'green',  label:'정상'  },
  '초과':  { type:'amber',  label:'초과'  },
  '무예산':{ type:'red',    label:'무예산'},
  '미달':  { type:'amber',  label:'미달'  },
  '계정불일치': { type:'red', label:'계정 불일치' },
};

const STATUS_BADGE = {
  'confirmed': { type:'green', label:'확인 완료' },
  'pending':   { type:'gray',  label:'미검토'   },
  'reviewing': { type:'amber', label:'검토 중'  },
  'rejected':  { type:'red',   label:'반려'     },
  'action':    { type:'amber', label:'조치요청' },
};

/* ── Detail Drawer ── */
function DetailDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  const an = ANOMALY_BADGE[item.anomaly] || { type:'gray', label:item.anomaly };
  const st = STATUS_BADGE[item.status]   || { type:'gray', label:item.status };

  return (
    <div className="drawer-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="drawer cb"><span className="cbl">DetailDrawer</span>

        <div className="drawer-head">
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'var(--t1)',marginBottom:4}}>{item.desc}</div>
            <div style={{fontSize:11,color:'var(--t3)'}}>{item.id} · {item.date}</div>
          </div>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>

        <div className="drawer-body">
          {/* Basic info */}
          <div className="drawer-section">
            <div className="drawer-sec-title">집행 기본정보</div>
            <div className="drawer-grid">
              {[
                ['부서',   item.deptName],
                ['계정',   `${item.acc} (${item.accCode})`],
                ['거래처', item.vendor],
                ['집행일', item.date],
                ['집행금액', `${item.amount.toLocaleString()}백만원`],
                ['담당자', item.assignee],
              ].map(([k,v]) => (
                <div key={k} className="drawer-field">
                  <span className="df-label">{k}</span>
                  <span className="df-value">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget matching */}
          <div className="drawer-section">
            <div className="drawer-sec-title">예산 매칭 현황</div>
            <div className="drawer-grid">
              <div className="drawer-field">
                <span className="df-label">이상 유형</span>
                <span className={`badge ${an.type}`}>{an.label}</span>
              </div>
              <div className="drawer-field">
                <span className="df-label">검토 상태</span>
                <span className={`badge ${st.type}`}>{st.label}</span>
              </div>
              <div className="drawer-field">
                <span className="df-label">매칭 예산</span>
                <span className="df-value">{item.matched > 0 ? `${item.matched.toLocaleString()}백만원` : '예산 없음'}</span>
              </div>
              <div className="drawer-field">
                <span className="df-label">차이금액</span>
                <span className={`df-value ${item.diff > 0 ? 'neg' : 'pos'}`}>
                  {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}백만원
                </span>
              </div>
            </div>
            {item.anomaly === '무예산' && (
              <div className="drawer-notice">
                이 항목은 예산 편성 없이 집행되었습니다. 사유를 확인하고 조치 상태를 변경해주세요.
              </div>
            )}
          </div>

          {/* Review memo */}
          <div className="drawer-section">
            <div className="drawer-sec-title">검토 메모</div>
            <textarea className="memo-box" placeholder="검토 사유, 확인 내용 등을 입력해주세요..." rows={3} />
          </div>

          {/* Action history */}
          <div className="drawer-section">
            <div className="drawer-sec-title">조치 이력</div>
            {item.status === 'confirmed' ? (
              <div className="hist-item">
                <span className="hist-dot ok" />
                <span className="hist-text">확인 완료 처리됨 · {item.assignee}</span>
              </div>
            ) : (
              <div style={{fontSize:11,color:'var(--t3)'}}>조치 이력 없음</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="drawer-foot">
          <button className="btn sm primary" onClick={() => onAction('confirmed', item)}>확인 완료</button>
          <button className="btn sm" onClick={() => onAction('action', item)}>조치 요청</button>
          <button className="btn sm" onClick={() => onAction('rejected', item)}>반려</button>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ── ExecutionPage ── */
function ExecutionPage({ state }) {
  const F = window.HYCMFixtures;
  const hasData = state === 'uploaded' || state === 'partial';
  const [selectedItem, setSelectedItem] = useStateE(null);
  const [statusMap, setStatusMap] = useStateE({});
  const [filterAnomaly, setFilterAnomaly] = useStateE('ALL');

  const handleAction = (action, item) => {
    setStatusMap(prev => ({ ...prev, [item.id]: action }));
    setSelectedItem(null);
  };

  const displayItems = hasData
    ? F.EXECUTIONS.filter(e => filterAnomaly === 'ALL' || e.anomaly === filterAnomaly)
    : [];

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">집행 내역</div>
          <div className="pg-sub">실적 데이터를 예산과 매칭하여 초과·미달·무예산 집행 여부를 검토합니다.</div>
        </div>
        <div className="flex-1" />
        <button className="btn sm">내보내기</button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        {[['연도','2026','2025'],['월','5월','4월','3월'],['부서','전체','생산부','영업부','구매부','관리부','R&D']].map(([lbl,...opts])=>(
          <div className="filter-group" key={lbl}>
            <label className="filter-label">{lbl}</label>
            <select className="filter-sel">{opts.map(o=><option key={o}>{o}</option>)}</select>
          </div>
        ))}
        <div className="filter-group">
          <label className="filter-label">이상 유형</label>
          <select className="filter-sel" value={filterAnomaly} onChange={e=>setFilterAnomaly(e.target.value)}>
            {['ALL','정상','초과','무예산','미달'].map(v=><option key={v} value={v}>{v==='ALL'?'전체':v}</option>)}
          </select>
        </div>
        {!hasData && <span className="filter-warn">※ ERP 미연결 상태</span>}
      </div>

      {/* Table */}
      <div className="card cb"><span className="cbl">ExecutionTable</span>
        <div className="card-head">
          <span className="card-title">집행 내역 목록</span>
          {hasData && <span className="card-sub">{displayItems.length}건</span>}
          <div className="flex-1" />
          <span style={{fontSize:10.5,color:'var(--t3)'}}>행 클릭 시 상세 조회</span>
        </div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>집행일</th>
              <th style={{textAlign:'left'}}>부서</th>
              <th style={{textAlign:'left'}}>계정</th>
              <th style={{textAlign:'left'}}>거래처</th>
              <th style={{textAlign:'left'}}>적요</th>
              <th>집행금액</th><th>매칭 예산</th><th>차이</th>
              <th>이상 유형</th><th>검토 상태</th>
              <th style={{textAlign:'left'}}>담당자</th>
              <th style={{textAlign:'left'}}>액션</th>
            </tr></thead>
            <tbody>
              {!hasData ? (
                <tr><td colSpan={12} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>
                  ERP 연동 또는 실적 파일 업로드 후 집행 내역이 표시됩니다.
                </td></tr>
              ) : displayItems.length === 0 ? (
                <tr><td colSpan={12} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>
                  선택한 필터 조건에 해당하는 집행 내역이 없습니다.
                </td></tr>
              ) : displayItems.map(item => {
                const an = ANOMALY_BADGE[item.anomaly] || { type:'gray', label:item.anomaly };
                const curStatus = statusMap[item.id] || item.status;
                const st = STATUS_BADGE[curStatus] || { type:'gray', label:curStatus };
                return (
                  <tr key={item.id} className="tbl-row-hover tbl-row-click"
                    onClick={() => setSelectedItem(item)}
                    style={{background: selectedItem?.id===item.id ? 'var(--primary-bg)' : ''}}>
                    <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{item.date}</td>
                    <td style={{textAlign:'left',fontWeight:500}}>{item.deptName}</td>
                    <td style={{textAlign:'left',color:'var(--t2)'}}>{item.acc}</td>
                    <td style={{textAlign:'left',color:'var(--t2)',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.vendor}</td>
                    <td style={{textAlign:'left',color:'var(--t2)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.desc}</td>
                    <td style={{fontWeight:600}}>{item.amount.toLocaleString()}</td>
                    <td style={{color:'var(--t3)'}}>{item.matched > 0 ? item.matched.toLocaleString() : '—'}</td>
                    <td className={item.diff > 0 ? 'neg' : 'pos'}>{item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)}</td>
                    <td><span className={`badge ${an.type}`}>{an.label}</span></td>
                    <td><span className={`badge ${st.type}`}>{st.label}</span></td>
                    <td style={{textAlign:'left',color:'var(--t3)'}}>{item.assignee}</td>
                    <td style={{textAlign:'left'}}>
                      <span style={{fontSize:11,color:'var(--primary)',cursor:'pointer'}}
                        onClick={e=>{e.stopPropagation();setSelectedItem(item)}}>검토 →</span>
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

      {/* Detail Drawer */}
      <DetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAction={handleAction}
      />
    </>
  );
}

Object.assign(window, { ExecutionPage });
