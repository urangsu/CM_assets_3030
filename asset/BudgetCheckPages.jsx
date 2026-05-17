/* [Components: OverrunPage, UnderPage, DeptCodesPage, AccountCodesPage, SettingsPage]
   검토/점검 및 기준정보 페이지 */
const { useState: useBSt, useEffect: useBEf } = React;

/* ── Shared review status badge ── */
const REVIEW_STATUS = {
  unreviewed:  { label:'미검토',   cls:'gray'  },
  reviewing:   { label:'검토 중',  cls:'amber' },
  confirmed:   { label:'확인 완료',cls:'green' },
  action:      { label:'조치요청', cls:'amber' },
  approved:    { label:'승인 완료',cls:'green' },
  rejected:    { label:'반려',     cls:'red'   },
};

/* ── Common review drawer ── */
function ReviewDrawer({ item, onClose, onAction }) {
  const [memo, setMemo] = useBSt('');
  if (!item) return null;
  const st = REVIEW_STATUS[item.reviewStatus] || REVIEW_STATUS.unreviewed;

  return (
    <div className="drawer-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="drawer cb"><span className="cbl">ReviewDrawer</span>
        <div className="drawer-head">
          <div>
            <div style={{fontWeight:700,fontSize:13,color:'var(--t1)',marginBottom:4}}>
              {item.deptName} · {item.accountCode}
            </div>
            <div style={{display:'flex',gap:8}}>
              <span className={`badge ${item.statusType||'amber'}`}>{item.anomaly}</span>
              <span style={{fontSize:11,color:'var(--t3)'}}>{item.period}</span>
            </div>
          </div>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div className="drawer-sec-title">집행 기본정보</div>
            <div className="drawer-grid">
              {[['부서코드',item.deptCode],['부서명',item.deptName],['계정코드',item.accountCode],
                ['기간',item.period],['완료실적',`${item.actual?.toLocaleString()||'—'}천원`],
                ['검토 상태',<span className={`badge ${st.cls}`}>{st.label}</span>]].map(([k,v])=>(
                <div key={k} className="drawer-field">
                  <span className="df-label">{k}</span>
                  <span className="df-value">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-sec-title">예산·실적 비교</div>
            <div className="drawer-grid">
              <div className="drawer-field"><span className="df-label">예산</span><span className="df-value">{item.budget?.toLocaleString()||'—'}</span></div>
              <div className="drawer-field"><span className="df-label">실적</span><span className="df-value">{item.actual?.toLocaleString()||'—'}</span></div>
              <div className="drawer-field"><span className="df-label">차이</span>
                <span className={`df-value ${item.diff>0?'neg':'pos'}`}>{item.diff!=null?(item.diff>0?'+':'')+item.diff.toLocaleString():'—'}</span>
              </div>
              <div className="drawer-field"><span className="df-label">이상 유형</span><span className={`badge ${item.statusType||'amber'}`}>{item.anomaly}</span></div>
            </div>
            {item.anomaly==='무예산 집행' && (
              <div className="drawer-notice">예산 편성 없이 집행된 항목입니다. 사유를 확인하고 조치 상태를 변경해주세요.</div>
            )}
          </div>

          <div className="drawer-section">
            <div className="drawer-sec-title">검토 메모</div>
            <textarea className="memo-box" value={memo} onChange={e=>setMemo(e.target.value)}
              placeholder="검토 사유, 확인 내용 등을 입력해주세요..." rows={3}/>
          </div>

          <div className="drawer-section">
            <div className="drawer-sec-title">조치 이력</div>
            <div style={{fontSize:11,color:'var(--t3)'}}>
              {item.reviewStatus==='confirmed'?'확인 완료 처리됨':'조치 이력 없음'}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn sm primary" onClick={()=>onAction('confirmed',item,memo)}>확인 완료</button>
          <button className="btn sm" onClick={()=>onAction('action',item,memo)}>조치 요청</button>
          <button className="btn sm" onClick={()=>onAction('rejected',item,memo)}>반려</button>
          <button className="btn sm" style={{marginLeft:'auto'}} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared anomaly table ── */
function AnomalyTable({ items, onSelect, selectedId, has }) {
  if (!has) return <tr><td colSpan={8} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>실적 파일을 업로드해주세요.</td></tr>;
  if (items.length === 0) return <tr><td colSpan={8} style={{textAlign:'center',padding:'32px 0',color:'var(--t3)'}}>해당 항목이 없습니다.</td></tr>;
  return items.map(it=>{
    const st = REVIEW_STATUS[it.reviewStatus]||REVIEW_STATUS.unreviewed;
    return (
      <tr key={it.id} className="tbl-row-hover tbl-row-click"
        style={{background:selectedId===it.id?'var(--primary-bg)':''}}
        onClick={()=>onSelect(it)}>
        <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{it.period}</td>
        <td style={{textAlign:'left',fontWeight:500}}>{it.deptName}</td>
        <td style={{textAlign:'left',color:'var(--t3)'}}>{it.deptCode}</td>
        <td style={{textAlign:'left',color:'var(--t2)'}}>{it.accountCode}</td>
        <td style={{fontWeight:600}}>{it.actual?.toLocaleString()||'—'}</td>
        <td style={{color:'var(--t3)'}}>{it.budget!=null?it.budget.toLocaleString():'—'}</td>
        <td><span className={`badge ${it.statusType}`}>{it.anomaly}</span></td>
        <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
      </tr>
    );
  });
}

/* ══════════════════════════════
   OverrunPage — 초과 항목
══════════════════════════════ */
function OverrunPage({ state }) {
  const D = window.HYCMData;
  const [actuals, setActuals] = useBSt([]);
  const [selected, setSelected] = useBSt(null);
  const [statusMap, setStatusMap] = useBSt({});

  useBEf(()=>{setActuals(D.loadActuals('2026'));},[state]);

  const has = state==='uploaded'||state==='partial'||actuals.length>0;
  const displayActuals = has&&actuals.length===0 ? D.DEMO_ACTUALS : actuals;

  // Group by dept+account+period and find where actual > 0 with no budget (simulate overrun)
  const overrunItems = has ? (() => {
    const map = {};
    displayActuals.forEach(a => {
      const key = `${a.usageCode}_${a.accountCode}_${a.period}`;
      if (!map[key]) map[key] = { ...a, id:key, deptCode:a.usageCode, deptName:D.DEPARTMENTS.find(d=>d.code===a.usageCode)?.name||a.usageCode, actual:0, budget:null };
      map[key].actual += (a.completed||0);
    });
    // Flag items with high actuals as potential overruns (no budget data = can't confirm, show as "점검 필요")
    return Object.values(map).filter(r=>r.actual>0).map(r=>({
      ...r, anomaly:'초과 (점검 필요)', statusType:'amber',
      diff: r.budget!=null ? r.actual-r.budget : null,
      reviewStatus: statusMap[r.id] || 'unreviewed',
    })).slice(0,20);
  })() : [];

  const handleAction = (action, item) => { setStatusMap(p=>({...p,[item.id]:action})); setSelected(null); };

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div><div className="pg-title">초과 항목</div>
        <div className="pg-sub">예산 대비 초과 집행된 항목을 검토합니다. 예산 연동 시 정확한 초과금액이 표시됩니다.</div></div>
        <div className="flex-1"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)'}}>
        {[
          {label:'점검 대상', val:has?`${overrunItems.length}건`:'—', type:overrunItems.length>0?'amber':'green', status:overrunItems.length>0?'검토 필요':'없음'},
          {label:'미검토',    val:has?`${overrunItems.filter(i=>!statusMap[i.id]||statusMap[i.id]==='unreviewed').length}건`:'—', type:'gray', status:'대기'},
          {label:'확인 완료', val:has?`${Object.values(statusMap).filter(s=>s==='confirmed').length}건`:'—', type:'green', status:'완료'},
          {label:'예산 비교', val:'—', type:'gray', status:'예산 미연동'},
        ].map(k=>(
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sw"><span className={`badge ${k.type}`}>{k.status}</span></div>
            <div className={`kpi-val${!has?' empty':''}`} style={{fontSize:20}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="card cb"><span className="cbl">OverrunTable</span>
        <div className="card-head"><span className="card-title">초과 항목 목록</span><span className="card-sub">행 클릭 시 상세 검토</span></div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>기간</th><th style={{textAlign:'left'}}>부서명</th>
              <th style={{textAlign:'left'}}>부서코드</th><th style={{textAlign:'left'}}>계정코드</th>
              <th>실적</th><th>예산</th><th>이상 유형</th><th>검토 상태</th>
            </tr></thead>
            <tbody><AnomalyTable items={overrunItems} onSelect={setSelected} selectedId={selected?.id} has={has}/></tbody>
          </table>
        </div>
        <div className="card-foot"><span>※ 예산 데이터 연동 시 정확한 초과금액 표시</span></div>
      </div>
      <div style={{height:8}}/>
      <ReviewDrawer item={selected} onClose={()=>setSelected(null)} onAction={handleAction}/>
    </>
  );
}

/* ══════════════════════════════
   UnderPage — 미달 항목
══════════════════════════════ */
function UnderPage({ state }) {
  const D = window.HYCMData;
  const [actuals, setActuals] = useBSt([]);
  const [selected, setSelected] = useBSt(null);
  const [statusMap, setStatusMap] = useBSt({});

  useBEf(()=>{setActuals(D.loadActuals('2026'));},[state]);

  const has = state==='uploaded'||state==='partial'||actuals.length>0;
  const displayActuals = has&&actuals.length===0 ? D.DEMO_ACTUALS : actuals;

  const underItems = has ? (() => {
    const map = {};
    displayActuals.forEach(a => {
      const key = `${a.usageCode}_${a.accountCode}`;
      if (!map[key]) map[key] = { ...a, id:key, deptCode:a.usageCode, deptName:D.DEPARTMENTS.find(d=>d.code===a.usageCode)?.name||a.usageCode, actual:0, budget:null };
      map[key].actual += (a.completed||0);
    });
    return Object.values(map).filter(r=>r.actual>0&&r.actual<500).map(r=>({
      ...r, anomaly:'미달 (점검 필요)', statusType:'amber', period:'YTD',
      diff:null, reviewStatus:statusMap[r.id]||'unreviewed',
    })).slice(0,10);
  })() : [];

  const handleAction = (action, item) => { setStatusMap(p=>({...p,[item.id]:action})); setSelected(null); };

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div><div className="pg-title">미달 항목</div>
        <div className="pg-sub">예산 대비 집행이 부진한 항목을 점검합니다. 예산 데이터 연동 시 정확한 미달율이 표시됩니다.</div></div>
      </div>
      <div className="card cb"><span className="cbl">UnderTable</span>
        <div className="card-head"><span className="card-title">미달 항목 목록</span><span className="card-sub">행 클릭 시 상세 검토</span></div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16}}>기간</th><th style={{textAlign:'left'}}>부서명</th>
              <th style={{textAlign:'left'}}>부서코드</th><th style={{textAlign:'left'}}>계정코드</th>
              <th>실적</th><th>예산</th><th>이상 유형</th><th>검토 상태</th>
            </tr></thead>
            <tbody><AnomalyTable items={underItems} onSelect={setSelected} selectedId={selected?.id} has={has}/></tbody>
          </table>
        </div>
        <div className="card-foot"><span>※ 예산 데이터 연동 시 정확한 미달율 표시</span></div>
      </div>
      <div style={{height:8}}/>
      <ReviewDrawer item={selected} onClose={()=>setSelected(null)} onAction={handleAction}/>
    </>
  );
}

/* ══════════════════════════════
   DeptCodesPage — 부서 코드 기준정보 (CRUD)
   localStorage: hycm_dept_overrides
   조직 변경(추가/삭제/수정) 지원
══════════════════════════════ */
const DEPT_STORE_KEY = 'hycm_dept_overrides';

function loadDeptOverrides() {
  try { return JSON.parse(localStorage.getItem(DEPT_STORE_KEY) || '{"added":[],"deleted":[],"renamed":{}}'); }
  catch(e) { return { added:[], deleted:[], renamed:{} }; }
}
function saveDeptOverrides(ov) {
  localStorage.setItem(DEPT_STORE_KEY, JSON.stringify(ov));
}

function DeptCodesPage() {
  const D = window.HYCMData;
  const ALL_GROUPS = [...new Set(D.DEPARTMENTS.map(d=>d.group)), '기타'];

  const [overrides, setOverrides] = useBSt(loadDeptOverrides);
  const [filterGroup, setFilterGroup] = useBSt('ALL');
  const [editingCode, setEditingCode] = useBSt(null);  // code being edited inline
  const [editName, setEditName] = useBSt('');
  const [editGroup, setEditGroup] = useBSt('');
  const [showAdd, setShowAdd] = useBSt(false);
  const [newCode, setNewCode] = useBSt('');
  const [newName, setNewName] = useBSt('');
  const [newGroup, setNewGroup] = useBSt('생산');
  const [confirmDel, setConfirmDel] = useBSt(null);

  // Build merged list
  const allDepts = [
    ...D.DEPARTMENTS.map(d => ({
      ...d,
      isBase: true,
      name: overrides.renamed[d.code] || d.name,
      group: overrides.renamedGroup?.[d.code] || d.group,
      deleted: overrides.deleted.includes(d.code),
    })),
    ...overrides.added.map(d => ({ ...d, isBase: false, deleted: false })),
  ];

  const visible = allDepts.filter(d =>
    !d.deleted &&
    (filterGroup === 'ALL' || d.group === filterGroup)
  );

  const persist = (ov) => { setOverrides(ov); saveDeptOverrides(ov); };

  const startEdit = (d) => { setEditingCode(d.code); setEditName(d.name); setEditGroup(d.group); };
  const saveEdit  = () => {
    const ov = { ...overrides,
      renamed: { ...overrides.renamed, [editingCode]: editName },
      renamedGroup: { ...(overrides.renamedGroup||{}), [editingCode]: editGroup },
    };
    persist(ov);
    setEditingCode(null);
  };

  const handleDelete = (code) => {
    const dept = allDepts.find(d=>d.code===code);
    if (dept.isBase) {
      persist({ ...overrides, deleted: [...overrides.deleted, code] });
    } else {
      persist({ ...overrides, added: overrides.added.filter(d=>d.code!==code) });
    }
    setConfirmDel(null);
  };

  const handleAdd = () => {
    if (!newCode.trim() || !newName.trim()) return;
    if (allDepts.some(d=>d.code===newCode.trim())) { alert('이미 존재하는 부서코드입니다.'); return; }
    persist({ ...overrides, added: [...overrides.added, { code:newCode.trim(), name:newName.trim(), group:newGroup }] });
    setNewCode(''); setNewName(''); setShowAdd(false);
  };

  const handleRestore = (code) => {
    const ov = { ...overrides, deleted: overrides.deleted.filter(c=>c!==code) };
    persist(ov);
  };

  const deletedCount  = overrides.deleted.length;
  const customCount   = overrides.added.length;

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">부서 코드</div>
          <div className="pg-sub">조직 변경에 따라 부서를 추가·수정·삭제할 수 있습니다. 기본 부서는 복원 가능합니다.</div>
        </div>
        <div className="flex-1"/>
        <div className="filter-group">
          <label className="filter-label">그룹</label>
          <select className="filter-sel" value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}>
            <option value="ALL">전체</option>
            {ALL_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button className="btn sm primary" onClick={()=>setShowAdd(v=>!v)}>
          {showAdd ? '취소' : '+ 부서 추가'}
        </button>
      </div>

      {/* 상태 요약 */}
      {(deletedCount > 0 || customCount > 0) && (
        <div className="state-banner warn" style={{flexWrap:'nowrap'}}>
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r=".7" fill="currentColor"/></svg>
          <span>
            {customCount > 0 && <><strong>{customCount}개 부서 추가됨</strong>. </>}
            {deletedCount > 0 && <><strong>{deletedCount}개 기본 부서 비활성화됨</strong> — 아래 '비활성 표시'에서 복원 가능.</>}
          </span>
        </div>
      )}

      {/* 추가 폼 */}
      {showAdd && (
        <div className="card cb"><span className="cbl">DeptAddForm</span>
          <div className="card-head"><span className="card-title">새 부서 추가</span></div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'160px 1fr 160px auto',gap:10,alignItems:'flex-end'}}>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>부서코드 <span style={{color:'var(--red)'}}>*</span></div>
                <input className="filter-sel" style={{width:'100%',padding:'5px 8px'}}
                  placeholder="예: 50260" value={newCode} onChange={e=>setNewCode(e.target.value)}/>
              </div>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>부서명 <span style={{color:'var(--red)'}}>*</span></div>
                <input className="filter-sel" style={{width:'100%',padding:'5px 8px'}}
                  placeholder="예: 정제파트" value={newName} onChange={e=>setNewName(e.target.value)}/>
              </div>
              <div>
                <div className="filter-label" style={{marginBottom:4}}>그룹</div>
                <select className="filter-sel" style={{width:'100%'}} value={newGroup} onChange={e=>setNewGroup(e.target.value)}>
                  {ALL_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <button className="btn sm primary" onClick={handleAdd} style={{alignSelf:'flex-end'}}>추가</button>
            </div>
            <div style={{marginTop:8,fontSize:11,color:'var(--t3)'}}>
              부서코드는 기존 코드와 중복될 수 없습니다. 조직 개편 시 기존 부서를 비활성화하고 새 코드로 추가하세요.
            </div>
          </div>
        </div>
      )}

      {/* 부서 목록 */}
      <div className="card cb"><span className="cbl">DeptTable</span>
        <div className="card-head">
          <span className="card-title">부서 코드 목록</span>
          <span className="card-sub">{visible.length}개 활성</span>
          <div className="flex-1"/>
          {deletedCount > 0 && (
            <span style={{fontSize:11,color:'var(--t3)',cursor:'pointer',textDecoration:'underline'}}
              onClick={()=>setFilterGroup('__deleted')}>
              비활성 {deletedCount}개 보기
            </span>
          )}
        </div>
        <div style={{padding:0}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:16,width:32}}></th>
              <th style={{textAlign:'left'}}>부서코드</th>
              <th style={{textAlign:'left'}}>부서명</th>
              <th style={{textAlign:'left'}}>그룹</th>
              <th style={{textAlign:'left'}}>구분</th>
              <th style={{textAlign:'center'}}>액션</th>
            </tr></thead>
            <tbody>
              {/* Active departments */}
              {filterGroup !== '__deleted' && visible.map(d => (
                <tr key={d.code} className="tbl-row-hover">
                  <td style={{paddingLeft:16}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:d.isBase?'var(--green)':'var(--ac)',margin:'0 auto'}}/>
                  </td>
                  <td style={{textAlign:'left',fontFamily:'monospace',color:'var(--t3)',fontSize:12}}>{d.code}</td>
                  <td style={{textAlign:'left'}}>
                    {editingCode === d.code ? (
                      <input className="filter-sel" style={{width:'100%',padding:'3px 6px'}}
                        value={editName} onChange={e=>setEditName(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCode(null);}}
                        autoFocus/>
                    ) : (
                      <span style={{fontWeight:500}}>{d.name}</span>
                    )}
                  </td>
                  <td style={{textAlign:'left'}}>
                    {editingCode === d.code ? (
                      <select className="filter-sel" value={editGroup} onChange={e=>setEditGroup(e.target.value)} style={{padding:'3px 6px'}}>
                        {ALL_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : (
                      <span style={{color:'var(--t3)'}}>{d.group}</span>
                    )}
                  </td>
                  <td style={{textAlign:'left'}}>
                    <span className={`badge ${d.isBase?'green':'amber'}`}>{d.isBase?'기본':'추가'}</span>
                  </td>
                  <td style={{textAlign:'center'}}>
                    {editingCode === d.code ? (
                      <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                        <button className="btn sm primary" onClick={saveEdit}>저장</button>
                        <button className="btn sm" onClick={()=>setEditingCode(null)}>취소</button>
                      </div>
                    ) : confirmDel === d.code ? (
                      <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                        <span style={{fontSize:11,color:'var(--red)'}}>삭제?</span>
                        <button className="btn sm" style={{color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>handleDelete(d.code)}>확인</button>
                        <button className="btn sm" onClick={()=>setConfirmDel(null)}>취소</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                        <button className="btn sm" onClick={()=>startEdit(d)}>수정</button>
                        <button className="btn sm" onClick={()=>setConfirmDel(d.code)}>비활성화</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {/* Deleted/deactivated departments */}
              {filterGroup === '__deleted' && allDepts.filter(d=>d.deleted&&d.isBase).map(d=>(
                <tr key={d.code} style={{opacity:.55}} className="tbl-row-hover">
                  <td style={{paddingLeft:16}}><div style={{width:6,height:6,borderRadius:'50%',background:'var(--border)',margin:'0 auto'}}/></td>
                  <td style={{textAlign:'left',fontFamily:'monospace',color:'var(--t3)',fontSize:12}}>{d.code}</td>
                  <td style={{textAlign:'left',color:'var(--t3)',textDecoration:'line-through'}}>{d.name}</td>
                  <td style={{textAlign:'left',color:'var(--t3)'}}>{d.group}</td>
                  <td><span className="badge gray">비활성</span></td>
                  <td style={{textAlign:'center'}}>
                    <button className="btn sm" onClick={()=>handleRestore(d.code)}>복원</button>
                  </td>
                </tr>
              ))}

              {visible.length === 0 && filterGroup !== '__deleted' && (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'24px 0',color:'var(--t3)'}}>해당 그룹의 부서가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span>기본 {D.DEPARTMENTS.length}개 · 추가 {customCount}개 · 비활성 {deletedCount}개</span>
          <span style={{fontSize:10.5,color:'var(--t3)'}}>저장소: hycm_dept_overrides (localStorage)</span>
        </div>
      </div>
      <div style={{height:8}}/>
    </>
  );
}

/* ══════════════════════════════
   AccountCodesPage — 계정 코드 기준정보
══════════════════════════════ */
function AccountCodesPage() {
  const invCodes = [
    {code:'12310000',name:'토지',cat:'투자'},
    {code:'12320000',name:'건물',cat:'투자'},
    {code:'12330000',name:'구축물',cat:'투자'},
    {code:'12340000',name:'기계장치',cat:'투자'},
    {code:'12360000',name:'공구와기구',cat:'투자'},
    {code:'12370000',name:'비품',cat:'투자'},
    {code:'12390000',name:'건설중인자산',cat:'투자'},
    {code:'12480000',name:'기타무형자산',cat:'투자'},
    {code:'12480200',name:'소프트웨어',cat:'투자'},
    {code:'12107401',name:'임차보증금',cat:'투자'},
  ];
  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div><div className="pg-title">계정 코드</div>
        <div className="pg-sub">HYCM 계정코드 분류 기준입니다. 코드 시작 문자(A=제조, B=판관) 및 투자 계정 목록을 확인합니다.</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--gap)'}}>
        <div className="card cb"><span className="cbl">AccTypeCard</span>
          <div className="card-head"><span className="card-title">계정 유형 분류 기준</span></div>
          <div className="card-body">
            {[
              {prefix:'A로 시작',cat:'제조',type:'GENERAL',desc:'제조원가 관련 계정'},
              {prefix:'B로 시작',cat:'판관',type:'GENERAL',desc:'판매관리비 관련 계정'},
              {prefix:'투자 코드',cat:'투자',type:'INVESTMENT',desc:'자산 취득 관련 계정'},
              {prefix:'기타',cat:'제조(기본)',type:'GENERAL',desc:'분류 미지정 시 제조 적용'},
            ].map(r=>(
              <div key={r.prefix} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border-lt)'}}>
                <code style={{fontSize:11,color:'var(--t3)',minWidth:80}}>{r.prefix}</code>
                <span className="badge green" style={{minWidth:36,justifyContent:'center'}}>{r.cat}</span>
                <span className="badge gray">{r.type}</span>
                <span style={{fontSize:11,color:'var(--t3)',flex:1}}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card cb"><span className="cbl">InvestAccCard</span>
          <div className="card-head"><span className="card-title">투자 계정 코드 목록</span></div>
          <div style={{padding:0}}>
            <table className="tbl">
              <thead><tr><th style={{textAlign:'left',paddingLeft:16}}>계정코드</th><th style={{textAlign:'left'}}>계정명</th><th>유형</th></tr></thead>
              <tbody>
                {invCodes.map(a=>(
                  <tr key={a.code} className="tbl-row-hover">
                    <td style={{textAlign:'left',paddingLeft:16,fontFamily:'monospace',color:'var(--t3)',fontSize:11}}>{a.code}</td>
                    <td style={{textAlign:'left',fontWeight:500}}>{a.name}</td>
                    <td><span className="badge amber">투자</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{height:8}}/>
    </>
  );
}

/* ── Simple placeholder ── */
function PlaceholderPage({ title, desc }) {
  return (
    <>
      <div className="pg-hdr"><div><div className="pg-title">{title}</div>{desc&&<div className="pg-sub">{desc}</div>}</div></div>
      <div className="card"><div className="card-body empty-state">이 화면은 다음 단계에서 구현될 예정입니다.</div></div>
    </>
  );
}

Object.assign(window, {
  OverrunPage, UnderPage, DeptCodesPage, AccountCodesPage,
  PlaceholderPage, ReviewDrawer,
});
