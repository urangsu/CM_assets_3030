/* [Component: AppShell, AppHeader, Sidebar — accordion nav] */
const { useState: useSt, useEffect: useEf } = React;

const NAV_GROUPS = [
  {
    group: null,
    items: [{ id:'dashboard', label:'대시보드', icon:'grid' }]
  },
  {
    group: '예산 관리',
    items: [
      { id:'budget',     label:'예산 현황',  icon:'wallet'  },
      { id:'execution',  label:'집행 내역',  icon:'list'    },
      { id:'variance',   label:'비교분석',   icon:'compare' },
      { id:'overrun',    label:'초과 항목',  icon:'up'      },
      { id:'under',      label:'미달 항목',  icon:'down'    },
      { id:'unbudgeted', label:'무예산 집행',icon:'alert'   },
    ]
  },
  {
    group: '예산 작성',
    items: [
      { id:'budget-request',  label:'예산 신청',    icon:'plus'   },
      { id:'approval-hist',   label:'승인 내역',    icon:'check'  },
      { id:'budget-write',    label:'예산 작성',    icon:'list',   badge:'준비 중', disabled:true },
      { id:'expense-report',  label:'업무활동경비', icon:'wallet', badge:'준비 중', disabled:true },
    ]
  },
  {
    group: '운영 모듈',
    items: [
      { id:'purchase',   label:'원료 구매',  icon:'cube'   },
      { id:'sales',      label:'판매 현황',  icon:'trend'  },
      { id:'rawmat-in',  label:'원료 입고',  icon:'upload', badge:'준비 중', disabled:true },
      { id:'production', label:'생산 실적',  icon:'bar',    badge:'준비 중', disabled:true },
    ]
  },
  {
    group: '기준정보',
    items: [
      { id:'dept-codes',    label:'부서 코드',   icon:'org'   },
      { id:'account-codes', label:'계정 코드',   icon:'tag'   },
      { id:'item-codes',    label:'품목 코드',   icon:'cube',  badge:'준비 중', disabled:true },
      { id:'partner-codes', label:'거래처 코드', icon:'user',  badge:'준비 중', disabled:true },
      { id:'country-codes', label:'국가 코드',   icon:'trend', badge:'준비 중', disabled:true },
    ]
  },
  {
    group: '데이터 관리',
    items: [
      { id:'actual-upload',    label:'실적 업로드',  icon:'upload'  },
      { id:'actual-transform', label:'실적 변환',    icon:'convert' },
      { id:'actual-cleanup',   label:'실적DB 정리', icon:'clean'   },
    ]
  },
  {
    group: '관리',
    items: [
      { id:'user-perms', label:'사용자 권한', icon:'user',     badge:'준비 중', disabled:true },
      { id:'settings',   label:'시스템 설정', icon:'settings'  },
    ]
  },
];

function Ico({ id, size=14 }) {
  const p = {
    grid:    <><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".45"/><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".45"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".25"/></>,
    upload:  <><path d="M8 10V3M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    convert: <><path d="M3 5h10M10 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 11H3M6 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>,
    clean:   <><path d="M3 13h10M5 10l2-7h2l2 7M4 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>,
    wallet:  <><rect x="2" y="4" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><circle cx="10" cy="8.5" r=".8" fill="currentColor"/><path d="M2 7h12" stroke="currentColor" strokeWidth="1.3"/></>,
    list:    <><path d="M2 4.5h12M2 8h8M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    plus:    <><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>,
    check:   <><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>,
    compare: <><rect x="2" y="2" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="5" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/></>,
    up:      <><path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>,
    down:    <><path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>,
    alert:   <><path d="M8 2L1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r=".7" fill="currentColor"/></>,
    org:     <><rect x="5" y="1" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3M3.5 11V9H8M12.5 11V9H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    tag:     <><path d="M9 2H14v5l-7 7-5-5 7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><circle cx="12" cy="5" r=".8" fill="currentColor"/></>,
    user:    <><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    cube:    <><path d="M8 2L2 5.5v5L8 14l6-3.5v-5L8 2z" stroke="currentColor" strokeWidth="1.3"/><path d="M8 2v12M2 5.5l6 3.5 6-3.5" stroke="currentColor" strokeWidth="1.3"/></>,
    bar:     <><rect x="3" y="8" width="3" height="6" rx=".8" stroke="currentColor" strokeWidth="1.3"/><rect x="7" y="5" width="3" height="9" rx=".8" stroke="currentColor" strokeWidth="1.3"/><rect x="11" y="2" width="3" height="12" rx=".8" stroke="currentColor" strokeWidth="1.3"/></>,
    trend:   <><path d="M2 12l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></>,
    settings:<><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.84.84M11.76 11.76l.84.84M3.4 12.6l.84-.84M11.76 4.24l.84-.84" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    chevdown:<><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>,
    chevright:<><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none">{p[id]||null}</svg>;
}
window.Ico = Ico;

function UploadStatusChip({ dataState }) {
  const cfg = {
    'no-upload': { label:'데이터 미업로드', cls:'status-chip' },
    'uploaded':  { label:'실적 업로드됨',   cls:'status-chip ok' },
    'partial':   { label:'일부 누락',        cls:'status-chip warn' },
    'error':     { label:'처리 오류',        cls:'status-chip err' },
  }[dataState] || { label:'미업로드', cls:'status-chip' };
  return <div className={cfg.cls}><span className="dot"/>{cfg.label}</div>;
}

function AppHeader({ dataState, isDemo }) {
  return (
    <header className="hdr cb"><span className="cbl">AppHeader</span>
      <span className="logo">HY<em>CM</em></span>
      <div className="vr"/>
      <span className="portal-name">운영 관제 포털</span>
      {isDemo && <span className="demo-chip"><span className="demo-dot"/>SAMPLE DATA</span>}
      <div className="flex-1"/>
      <UploadStatusChip dataState={dataState}/>
      <span className="hdr-date" id="hdrDate"/>
      <div className="avatar">관</div>
    </header>
  );
}

function Sidebar({ activePage, onNav }) {
  const D = window.HYCMData;
  const hasData = D.hasUploadedData('2026');

  // Find which group the active page belongs to
  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activePage))?.group || null;

  // Initially open: group of active page + 실적 관리 if no data
  const [openGroups, setOpenGroups] = useSt(() => {
    const s = new Set();
    if (activeGroup) s.add(activeGroup);
    if (!hasData) s.add('실적 관리');
    return s;
  });

  // Auto-open the active page's group when page changes
  useEf(() => {
    if (activeGroup) setOpenGroups(prev => { const n = new Set(prev); n.add(activeGroup); return n; });
  }, [activePage]);

  const toggle = g => setOpenGroups(prev => {
    const n = new Set(prev);
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  return (
    <aside className="sb cb"><span className="cbl">Sidebar</span>
      {NAV_GROUPS.map(({ group, items }) => {
        const isOpen = !group || openGroups.has(group);
        const hasActive = items.some(i => i.id === activePage);
        return (
          <div key={group || '__home'} className="nav-group">
            {/* Group header (collapsible) */}
            {group && (
              <div
                className={`nav-group-hdr${hasActive ? ' has-active' : ''}`}
                onClick={() => toggle(group)}
              >
                <span className="nav-group-label">{group}</span>
                <span style={{marginLeft:'auto',color:'var(--t3)',opacity:.7}}>
                  <Ico id={isOpen ? 'chevdown' : 'chevright'} size={11}/>
                </span>
              </div>
            )}
            {/* Nav items */}
            {isOpen && items.map(item => {
              const needsAttention = item.id === 'actual-upload' && !hasData;
              return (
                <div key={item.id}
                  className={`nl${activePage === item.id ? ' active' : ''}${item.disabled ? ' off' : ''}`}
                  onClick={() => !item.disabled && onNav(item.id)}
                >
                  <Ico id={item.icon}/>
                  {item.label}
                  {item.badge && <span className="nbadge">{item.badge}</span>}
                  {needsAttention && !item.badge && (
                    <span className="nbadge" style={{background:'var(--ac-bg)',color:'var(--ac)',borderColor:'var(--ac-rg)'}}>필요</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="sb-footer">
        <div style={{padding:'6px 16px 4px',fontSize:10,color:'var(--t3)',letterSpacing:'.04em'}}>
          HYCM Portal v2.0
        </div>
      </div>
    </aside>
  );
}

function AppShell({ children, activePage, onNav, dataState, isDemo }) {
  return (
    <div className="app">
      <AppHeader dataState={dataState} isDemo={isDemo}/>
      <Sidebar activePage={activePage} onNav={onNav}/>
      <main className="main">{children}</main>
    </div>
  );
}

Object.assign(window, { AppShell, AppHeader, Sidebar, Ico });
