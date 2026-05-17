/* [Components: BudgetRequestPage, ApprovalHistPage, SettingsPage]
   예산 신청 · 승인 내역 · 시스템 설정 */
const { useState: useAdSt, useEffect: useAdEf, useMemo: useAdMemo } = React;

/* ═══════════════════════════
   BudgetRequestPage — 예산 신청
═══════════════════════════ */
const REQ_STATUS = {
  pending:   { label:'검토 대기', cls:'amber' },
  reviewing: { label:'검토 중',   cls:'amber' },
  approved:  { label:'승인 완료', cls:'green' },
  rejected:  { label:'반려',      cls:'red'   },
};
const URGENCY = {
  H: { label:'긴급', cls:'red'   },
  M: { label:'보통', cls:'amber' },
  L: { label:'일반', cls:'gray'  },
};

function BudgetRequestDrawer({ item, onClose, onAction }) {
  const [memo, setMemo] = useAdSt('');
  if (!item) return null;
  const st = REQ_STATUS[item.status] || REQ_STATUS.pending;
  const ur = URGENCY[item.urgency] || URGENCY.L;
  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer cb"><span className="cbl">BudgetRequestDrawer</span>
        <div className="drawer-head">
          <div>
            <div style={{fontWeight:700,fontSize:13,color:'var(--t1)',marginBottom:4}}>{item.title}</div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span className={`badge ${st.cls}`}>{st.label}</span>
              <span className={`badge ${ur.cls}`}>{ur.label}</span>
              <span style={{fontSize:11,color:'var(--t3)'}}>{item.id} · {item.submittedAt}</span>
            </div>
          </div>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div className="drawer-sec-title">신청 기본정보</div>
            <div className="drawer-grid">
              {[
                ['부서',     item.deptName],
                ['계정 분류',item.cat],
                ['신청 금액',`${item.amount.toLocaleString()}백만원`],
                ['신청자',   item.submitter],
                ['신청일',   item.submittedAt],
                ['긴급도',   <span className={`badge ${ur.cls}`}>{ur.label}</span>],
              ].map(([k,v]) => (
                <div key={k} className="drawer-field">
                  <span className="df-label">{k}</span>
                  <span className="df-value">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="drawer-section">
            <div className="drawer-sec-title">신청 사유</div>
            <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.7,padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--rsm)'}}>
              {item.reason}
            </div>
          </div>
          <div className="drawer-section">
            <div className="drawer-sec-title">검토 의견</div>
            <textarea className="memo-box" value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="승인/반려 사유, 검토 의견을 입력해주세요..." rows={3}/>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn sm primary" onClick={() => onAction('approved', item, memo)}>승인</button>
          <button className="btn sm" style={{color:'var(--red)',borderColor:'var(--red)'}}
            onClick={() => onAction('rejected', item, memo)}>반려</button>
          <button className="btn sm" onClick={() => onAction('reviewing', item, memo)}>검토 중으로 변경</button>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function BudgetRequestPage() {
  const D = window.HYCMData;
  const [items, setItems] = useAdSt(() => D.BUDGET_REQUESTS || []);
  const [statusMap, setStatusMap] = useAdSt({});
  const [selected, setSelected] = useAdSt(null);
  const [filterStatus, setFilterStatus] = useAdSt('ALL');
  const [showForm, setShowForm] = useAdSt(false);
  const [newReq, setNewReq] = useAdSt({ title:'', cat:'원재료비', amount:'', urgency:'M', reason:'' });

  const displayed = useAdMemo(() =>
    items.filter(i => filterStatus === 'ALL' || (statusMap[i.id] || i.status) === filterStatus),
    [items, statusMap, filterStatus]
  );

  const counts = useAdMemo(() => ({
    total:    items.length,
    pending:  items.filter(i => ['pending','reviewing'].includes(statusMap[i.id]||i.status)).length,
    approved: items.filter(i => (statusMap[i.id]||i.status) === 'approved').length,
    rejected: items.filter(i => (statusMap[i.id]||i.status) === 'rejected').length,
    totalAmt: items.reduce((s,i) => s+i.amount, 0),
  }), [items, statusMap]);

  const handleAction = (action, item) => {
    setStatusMap(p => ({ ...p, [item.id]: action }));
    setSelected(null);
  };

  const handleSubmit = () => {
    if (!newReq.title || !newReq.amount) return;
    const id = `BR-${String(items.length + 1).padStart(3,'0')}`;
    const now = new Date().toISOString().slice(0,10);
    setItems(prev => [{ id, dept:'—', deptName:'(본인 부서)', submitter:'관리자', submittedAt:now, status:'pending', ...newReq, amount:parseFloat(newReq.amount)||0 }, ...prev]);
    setNewReq({ title:'', cat:'원재료비', amount:'', urgency:'M', reason:'' });
    setShowForm(false);
  };

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">예산 신청</div>
          <div className="pg-sub">예산 외 집행 승인 또는 추가 예산 신청을 등록하고 검토 상태를 관리합니다.</div>
        </div>
        <div className="flex-1"/>
        <button className="btn sm primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '취소' : '+ 예산 신청'}
        </button>
      </div>

      {/* KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)'}}>
        {[
          { label:'총 신청 건수', val:`${counts.total}건`,         type:'gray',  status:'전체' },
          { label:'검토 대기',    val:`${counts.pending}건`,       type:'amber', status:'처리 필요' },
          { label:'승인 완료',    val:`${counts.approved}건`,      type:'green', status:'완료' },
          { label:'총 신청 금액', val:`${counts.totalAmt.toLocaleString()}M`, type:'gray', status:'합계' },
        ].map(k => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className="kpi-val" style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* 신청 폼 */}
      {showForm && (
        <div className="card cb"><span className="cbl">BudgetRequestForm</span>
          <div className="card-head"><span className="card-title">새 예산 신청</span></div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 160px 100px 100px',gap:10,marginBottom:10}}>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>신청 제목 <span style={{color:'var(--red)'}}>*</span></div>
                <input className="filter-sel" style={{width:'100%',padding:'5px 8px'}}
                  placeholder="예: 3분기 원재료 추가 구매" value={newReq.title}
                  onChange={e => setNewReq(p => ({...p,title:e.target.value}))}/>
              </div>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>계정 분류</div>
                <select className="filter-sel" style={{width:'100%'}} value={newReq.cat}
                  onChange={e => setNewReq(p => ({...p,cat:e.target.value}))}>
                  {['원재료비','인건비','경비','외주비','수선비','설비비','교육훈련비','소모품비'].map(c =>
                    <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>금액(백만원) <span style={{color:'var(--red)'}}>*</span></div>
                <input className="filter-sel" style={{width:'100%',padding:'5px 8px'}} type="number" min="0"
                  placeholder="0" value={newReq.amount}
                  onChange={e => setNewReq(p => ({...p,amount:e.target.value}))}/>
              </div>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>긴급도</div>
                <select className="filter-sel" style={{width:'100%'}} value={newReq.urgency}
                  onChange={e => setNewReq(p => ({...p,urgency:e.target.value}))}>
                  <option value="H">긴급</option>
                  <option value="M">보통</option>
                  <option value="L">일반</option>
                </select>
              </div>
            </div>
            <div>
              <div className="filter-label" style={{marginBottom:4}}>신청 사유</div>
              <textarea className="memo-box" rows={2} placeholder="신청 사유를 간략히 입력해주세요..."
                value={newReq.reason} onChange={e => setNewReq(p => ({...p,reason:e.target.value}))}/>
            </div>
          </div>
          <div className="card-foot" style={{justifyContent:'flex-end',gap:6}}>
            <button className="btn sm" onClick={() => setShowForm(false)}>취소</button>
            <button className="btn sm primary" onClick={handleSubmit}
              disabled={!newReq.title || !newReq.amount}>신청 등록</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        <span style={{fontSize:11,fontWeight:600,color:'var(--t2)'}}>상태 필터</span>
        {[
          {val:'ALL',      label:'전체'},
          {val:'pending',  label:'검토 대기'},
          {val:'reviewing',label:'검토 중'},
          {val:'approved', label:'승인 완료'},
          {val:'rejected', label:'반려'},
        ].map(f => (
          <button key={f.val} className={`btn sm${filterStatus===f.val?' primary':''}`}
            onClick={() => setFilterStatus(f.val)}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card cb"><span className="cbl">BudgetRequestTable</span>
        <div className="card-head">
          <span className="card-title">신청 목록</span>
          <span className="card-sub">{displayed.length}건</span>
          <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--t3)'}}>행 클릭 시 상세 검토</span>
        </div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>신청일</th>
              <th style={{textAlign:'left'}}>부서</th>
              <th style={{textAlign:'left'}}>신청 제목</th>
              <th style={{textAlign:'left'}}>계정</th>
              <th>금액(M)</th>
              <th>긴급도</th>
              <th>상태</th>
              <th style={{textAlign:'left'}}>신청자</th>
            </tr></thead>
            <tbody>
              {displayed.length === 0
                ? <tr><td colSpan={8} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>해당 조건의 신청 내역이 없습니다.</td></tr>
                : displayed.map(item => {
                    const st = REQ_STATUS[statusMap[item.id]||item.status] || REQ_STATUS.pending;
                    const ur = URGENCY[item.urgency] || URGENCY.L;
                    return (
                      <tr key={item.id} className="tbl-row-hover tbl-row-click"
                        style={{background:selected?.id===item.id?'var(--primary-bg)':''}}
                        onClick={() => setSelected(item)}>
                        <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{item.submittedAt}</td>
                        <td style={{textAlign:'left',fontWeight:500}}>{item.deptName}</td>
                        <td style={{textAlign:'left',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</td>
                        <td style={{textAlign:'left',color:'var(--t3)'}}>{item.cat}</td>
                        <td style={{fontWeight:600}}>{item.amount.toLocaleString()}</td>
                        <td><span className={`badge ${ur.cls}`}>{ur.label}</span></td>
                        <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td style={{textAlign:'left',color:'var(--t3)'}}>{item.submitter}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>SAMPLE DATA · 실제 신청은 ERP 연동 후 자동 수신</span>
        </div>
      </div>
      <div style={{height:8}}/>

      <BudgetRequestDrawer item={selected} onClose={() => setSelected(null)} onAction={handleAction}/>
    </>
  );
}

/* ═══════════════════════════
   ApprovalHistPage — 승인 내역
═══════════════════════════ */
function ApprovalHistPage() {
  const D = window.HYCMData;
  const [filterType, setFilterType] = useAdSt('ALL');
  const [filterAction, setFilterAction] = useAdSt('ALL');

  const items = D.APPROVAL_HISTORY || [];
  const displayed = useAdMemo(() =>
    items.filter(i =>
      (filterType === 'ALL' || i.type === filterType) &&
      (filterAction === 'ALL' || i.action === filterAction)
    ), [items, filterType, filterAction]
  );

  const counts = {
    total:    items.length,
    approved: items.filter(i => i.action === '승인').length,
    rejected: items.filter(i => i.action === '반려').length,
  };

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">승인 내역</div>
          <div className="pg-sub">예산 신청 및 집행 항목의 승인·반려 처리 이력을 조회합니다.</div>
        </div>
        <div className="flex-1"/>
        <button className="btn sm">내보내기</button>
      </div>

      {/* KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--gap)'}}>
        {[
          { label:'전체 처리 건수', val:`${counts.total}건`,    type:'gray',  status:'전체' },
          { label:'승인',           val:`${counts.approved}건`, type:'green', status:'완료' },
          { label:'반려',           val:`${counts.rejected}건`, type:'red',   status:'반려' },
        ].map(k => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className="kpi-val" style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        <div className="filter-group">
          <label className="filter-label">유형</label>
          <select className="filter-sel" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="ALL">전체</option>
            <option value="예산신청">예산신청</option>
            <option value="집행검토">집행검토</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">처리 결과</label>
          <select className="filter-sel" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="ALL">전체</option>
            <option value="승인">승인</option>
            <option value="반려">반려</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card cb"><span className="cbl">ApprovalTable</span>
        <div className="card-head">
          <span className="card-title">처리 이력</span>
          <span className="card-sub">{displayed.length}건</span>
        </div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>처리일</th>
              <th style={{textAlign:'left'}}>유형</th>
              <th style={{textAlign:'left'}}>참조 ID</th>
              <th style={{textAlign:'left'}}>부서</th>
              <th style={{textAlign:'left'}}>내용</th>
              <th>금액(M)</th>
              <th>결과</th>
              <th style={{textAlign:'left'}}>처리자</th>
              <th style={{textAlign:'left'}}>처리 의견</th>
            </tr></thead>
            <tbody>
              {displayed.length === 0
                ? <tr><td colSpan={9} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>해당 조건의 이력이 없습니다.</td></tr>
                : displayed.map(item => (
                    <tr key={item.id} className="tbl-row-hover">
                      <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{item.actedAt}</td>
                      <td style={{textAlign:'left'}}>
                        <span className={`badge ${item.type==='예산신청'?'amber':'gray'}`}>{item.type}</span>
                      </td>
                      <td style={{textAlign:'left',fontFamily:'monospace',color:'var(--t3)',fontSize:11}}>{item.refId}</td>
                      <td style={{textAlign:'left',color:'var(--t2)'}}>{item.dept}</td>
                      <td style={{textAlign:'left',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{item.title}</td>
                      <td style={{fontWeight:600}}>{typeof item.amount === 'number' ? item.amount.toLocaleString() : item.amount}</td>
                      <td>
                        <span className={`badge ${item.action==='승인'?'green':'red'}`}>{item.action}</span>
                      </td>
                      <td style={{textAlign:'left',color:'var(--t3)'}}>{item.actor}</td>
                      <td style={{textAlign:'left',fontSize:11,color:'var(--t3)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.memo}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>SAMPLE DATA · ERP 연동 시 실제 승인 이력 자동 반영</span>
        </div>
      </div>
      <div style={{height:8}}/>
    </>
  );
}

/* ═══════════════════════════
   SettingsPage — 시스템 설정
═══════════════════════════ */
function SettingsSection({ title, children }) {
  return (
    <div className="card cb"><span className="cbl">SettingsSection</span>
      <div className="card-head"><span className="card-title">{title}</span></div>
      <div className="card-body" style={{display:'flex',flexDirection:'column',gap:14}}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, desc, children }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'4px 0',borderBottom:'1px solid var(--border-lt)'}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--t1)'}}>{label}</div>
        {desc && <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>{desc}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );
}

function SettingsPage() {
  const D = window.HYCMData;
  const [confirmClear, setConfirmClear] = useAdSt(false);
  const [cleared, setCleared] = useAdSt(false);
  const [year, setYear] = useAdSt('2026');
  const [showLog, setShowLog] = useAdSt(false);

  const actualRows = D.loadActuals(year);
  const log = D.getUploadLog();

  const handleClear = () => {
    localStorage.removeItem(D.KEYS.ACTUAL(year));
    setCleared(true);
    setConfirmClear(false);
    setTimeout(() => setCleared(false), 3000);
  };

  const storageUsed = (() => {
    let total = 0;
    try {
      for (let k in localStorage) {
        if (k.startsWith('cleanmetal_') || k.startsWith('hycm_')) {
          total += (localStorage.getItem(k) || '').length * 2;
        }
      }
    } catch(e) {}
    return (total / 1024).toFixed(1);
  })();

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">시스템 설정</div>
          <div className="pg-sub">데이터 관리, 저장 현황, 연도 기준 및 표시 옵션을 구성합니다.</div>
        </div>
      </div>

      {/* 저장 현황 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)'}}>
        {[
          { label:'localStorage 사용량', val:`${storageUsed} KB`,     type:'gray', status:'HYCM 데이터' },
          { label:`${year}년 실적 행수`,  val:`${actualRows.length}건`,type: actualRows.length>0?'green':'gray', status: actualRows.length>0?'저장됨':'없음' },
          { label:'업로드 이력',          val:`${log.length}건`,       type:'gray', status:'누적' },
          { label:'시스템 상태',          val:'정상',                  type:'green', status:'운영 중' },
        ].map(k => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className="kpi-val" style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* 데이터 관리 */}
      <SettingsSection title="데이터 관리">
        <SettingsRow
          label="기준 연도"
          desc="실적 데이터 조회·삭제 대상 연도">
          <select className="filter-sel" value={year} onChange={e => setYear(e.target.value)}>
            {['2026','2025','2024'].map(y => <option key={y}>{y}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow
          label={`${year}년 실적 데이터 초기화`}
          desc={`현재 저장된 ${year}년 실적 행수: ${actualRows.length}건 · localStorage에서 완전 삭제됩니다.`}>
          {cleared
            ? <span className="badge green">삭제 완료</span>
            : confirmClear
              ? <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontSize:11,color:'var(--red)'}}>정말 삭제?</span>
                  <button className="btn sm" style={{color:'var(--red)',borderColor:'var(--red)'}} onClick={handleClear}>확인</button>
                  <button className="btn sm" onClick={() => setConfirmClear(false)}>취소</button>
                </div>
              : <button className="btn sm" style={{color:'var(--red)',borderColor:'var(--red)'}}
                  disabled={actualRows.length === 0}
                  onClick={() => setConfirmClear(true)}>
                  데이터 초기화
                </button>
          }
        </SettingsRow>
        <SettingsRow
          label="업로드 이력 보기"
          desc="최근 파일 업로드 기록">
          <button className="btn sm" onClick={() => setShowLog(v => !v)}>
            {showLog ? '접기' : '이력 보기'}
          </button>
        </SettingsRow>
        {showLog && log.length > 0 && (
          <table className="tbl" style={{marginTop:4}}>
            <thead><tr>
              <th style={{textAlign:'left'}}>파일명</th>
              <th style={{textAlign:'left'}}>업로드 일시</th>
              <th>행수</th>
              <th>상태</th>
            </tr></thead>
            <tbody>
              {log.slice(0,10).map((l,i) => (
                <tr key={i} className="tbl-row-hover">
                  <td style={{textAlign:'left',color:'var(--t2)'}}>{l.fileName}</td>
                  <td style={{textAlign:'left',color:'var(--t3)',fontSize:11}}>{new Date(l.uploadedAt).toLocaleString('ko-KR')}</td>
                  <td>{l.rowCount?.toLocaleString()}</td>
                  <td><span className="badge green">{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showLog && log.length === 0 && (
          <div style={{fontSize:11,color:'var(--t3)'}}>업로드 이력 없음</div>
        )}
      </SettingsSection>

      {/* 저장소 정보 */}
      <SettingsSection title="저장소 정보">
        <SettingsRow label="실적 데이터 키" desc="localStorage 키 형식">
          <code style={{fontSize:11,background:'var(--bg)',padding:'3px 8px',borderRadius:'var(--rsm)',color:'var(--t2)'}}>
            cleanmetal_actual_data_{'{연도}'}
          </code>
        </SettingsRow>
        <SettingsRow label="예산 데이터 키" desc="부서·연도·계획 구분별">
          <code style={{fontSize:11,background:'var(--bg)',padding:'3px 8px',borderRadius:'var(--rsm)',color:'var(--t2)'}}>
            cleanmetal_budget_data_{'{부서}_{연도}_{계획}'}
          </code>
        </SettingsRow>
        <SettingsRow label="부서 오버라이드" desc="기준정보 > 부서코드 추가·수정 내역">
          <code style={{fontSize:11,background:'var(--bg)',padding:'3px 8px',borderRadius:'var(--rsm)',color:'var(--t2)'}}>
            hycm_dept_overrides
          </code>
        </SettingsRow>
      </SettingsSection>

      {/* 시스템 정보 */}
      <SettingsSection title="시스템 정보">
        <SettingsRow label="포털 버전" desc="현재 운영 중인 버전">
          <span className="badge green">v2.0 — 2026-05</span>
        </SettingsRow>
        <SettingsRow label="데이터 소스" desc="실적 데이터 입력 방식">
          <span className="badge gray">파일 업로드 (ERP 연동 준비 중)</span>
        </SettingsRow>
        <SettingsRow label="지원 파일 형식" desc="업로드 가능한 파일 포맷">
          <div style={{display:'flex',gap:6}}>
            <span className="badge green">.xlsx</span>
            <span className="badge green">.csv</span>
          </div>
        </SettingsRow>
      </SettingsSection>

      <div style={{height:8}}/>
    </>
  );
}

Object.assign(window, { BudgetRequestPage, ApprovalHistPage, SettingsPage });
