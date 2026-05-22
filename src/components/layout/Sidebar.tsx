import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getViewableDepts } from '../../constants';

export function Ico({ id, size = 14 }: { id: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".45" />
        <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".45" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".25" />
      </>
    ),
    upload: (
      <>
        <path d="M8 10V3M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 13h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    convert: (
      <>
        <path d="M3 5h10M10 2l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 11H3M6 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    clean: (
      <>
        <path d="M3 13h10M5 10l2-7h2l2 7M4 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    wallet: (
      <>
        <rect x="2" y="4" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10" cy="8.5" r=".8" fill="currentColor" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
    list: (
      <>
        <path d="M2 4.5h12M2 8h8M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    plus: (
      <>
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    check: (
      <>
        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    compare: (
      <>
        <rect x="2" y="2" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="5" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
    up: (
      <>
        <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    down: (
      <>
        <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    alert: (
      <>
        <path d="M8 2L1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11" r=".7" fill="currentColor" />
      </>
    ),
    org: (
      <>
        <rect x="5" y="1" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="1" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="10" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 5v3M3.5 11V9H8M12.5 11V9H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    tag: (
      <>
        <path d="M9 2H14v5l-7 7-5-5 7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="12" cy="5" r=".8" fill="currentColor" />
      </>
    ),
    user: (
      <>
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    cube: (
      <>
        <path d="M8 2L2 5.5v5L8 14l6-3.5v-5L8 2z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 2v12M2 5.5l6 3.5 6-3.5" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
    bar: (
      <>
        <rect x="3" y="8" width="3" height="6" rx=".8" stroke="currentColor" strokeWidth="1.3" />
        <rect x="7" y="5" width="3" height="9" rx=".8" stroke="currentColor" strokeWidth="1.3" />
        <rect x="11" y="2" width="3" height="12" rx=".8" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
    trend: (
      <>
        <path d="M2 12l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    settings: (
      <>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.84.84M11.76 11.76l.84.84M3.4 12.6l.84-.84M11.76 4.24l.84-.84" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    chevdown: (
      <>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    chevright: (
      <>
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {p[id] || null}
    </svg>
  );
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  badge?: string;
  disabled?: boolean;
}

interface NavGroup {
  group: string | null;
  items: NavItem[];
}

const NAV_GROUPS_DEF: NavGroup[] = [
  {
    group: "대시보드",
    items: [
      { id: 'dashboard', label: '운영 관제 대시보드', icon: 'grid', href: '/dashboard' }
    ]
  },
  {
    group: "1단계. 예산 준비",
    items: [
      { id: 'actual-upload', label: '실적 업로드', icon: 'upload', href: '/plan-actual-upload' },
      { id: 'account-selection', label: '계정 선택', icon: 'tag', href: '/account-selection' },
      { id: 'department-assignment', label: '부서 귀속 변경', icon: 'convert', href: '/department-assignment' },
      { id: 'account-master-view', label: '계정/부서 기준 확인', icon: 'list', href: '/account-management' }
    ]
  },
  {
    group: "2단계. 예산 작성",
    items: [
      { id: 'budget-write', label: '예산 작성', icon: 'plus', href: '/budget-creation' },
      { id: 'business-activity', label: '업무활동경비 산출', icon: 'wallet', href: '/business-activity-budget' },
      { id: 'budget-status', label: '예산 제출/승인 현황', icon: 'check', href: '/budget-status' }
    ]
  },
  {
    group: "3단계. 예산 검토",
    items: [
      { id: 'budget-status-review', label: '예산 현황', icon: 'list', href: '/budget-status' },
      { id: 'execution-ledger', label: '예산 한도 점검', icon: 'compare', href: '/execution-ledger' },
      { id: 'overrun', label: '초과 항목', icon: 'alert', href: '/overrun-check' },
      { id: 'underrun', label: '미달 항목', icon: 'down', href: '/underrun-check' },
      { id: 'unbudgeted', label: '무예산 집행', icon: 'up', href: '/unbudgeted-check' }
    ]
  },
  {
    group: "4단계. 비교분석",
    items: [
      { id: 'variance', label: '비교분석', icon: 'trend', href: '/variance-comparison' },
      { id: 'compare-time', label: '시점 vs 시점 비교', icon: 'compare', href: '/variance-comparison?tab=time' },
      { id: 'compare-dept', label: '부서별 비교', icon: 'org', href: '/variance-comparison?tab=dept' },
      { id: 'compare-account', label: '계정별 비교', icon: 'tag', href: '/variance-comparison?tab=account' }
    ]
  },
  {
    group: "5단계. 운영 모듈",
    items: [
      { id: 'purchase-status', label: '원료 구매', icon: 'cube', href: '/purchase-status' },
      { id: 'sales-status', label: '판매 현황', icon: 'bar', href: '/sales-status' },
      { id: 'production-status', label: '생산 실적', icon: 'trend', href: '/production-status' },
      { id: 'raw-material-status', label: '원료 입고', icon: 'cube', href: '/raw-material-status' }
    ]
  },
  {
    group: "관리",
    items: [
      { id: 'settings', label: '사용자 권한', icon: 'user', href: '/user-management' },
      { id: 'account-master-direct', label: '계정 코드 관리', icon: 'tag', href: '/account-management' },
      { id: 'department-master', label: '부서 코드 관리', icon: 'org', href: '/department-management' },
      { id: 'system-settings', label: '시스템 설정', icon: 'settings', href: '/user-management' }
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasData, setHasData] = useState<boolean>(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    const rawActuals = localStorage.getItem('cleanmetal_actual_data_2026');
    if (rawActuals) {
      try {
        const rows = JSON.parse(rawActuals);
        setHasData(rows.length > 0);
      } catch (e) {
        setHasData(false);
      }
    }
  }, [location.pathname]);

  const currentPath = location.pathname;
  let activePageKey = 'dashboard';
  if (currentPath.includes('/dashboard')) activePageKey = 'dashboard';
  else if (currentPath.includes('/budget-status')) activePageKey = 'budget-status';
  else if (currentPath.includes('/execution-ledger')) activePageKey = 'execution-ledger';
  else if (currentPath.includes('/overrun-check') || currentPath.includes('/overrun')) activePageKey = 'overrun';
  else if (currentPath.includes('/underrun-check') || currentPath.includes('/underrun')) activePageKey = 'underrun';
  else if (currentPath.includes('/unbudgeted-check') || currentPath.includes('/unbudgeted')) activePageKey = 'unbudgeted';
  else if (currentPath.includes('/plan-actual-upload') || currentPath.includes('/actual-upload') || currentPath.includes('/upload')) activePageKey = 'actual-upload';
  else if (currentPath.includes('/budget-creation') || currentPath.includes('/plan-create') || currentPath.includes('/budget')) activePageKey = 'budget-write';
  else if (currentPath.includes('/business-activity-budget') || currentPath.includes('/business-activity')) activePageKey = 'business-activity';
  else if (currentPath.includes('/variance-comparison') || currentPath.includes('/comparison') || currentPath.includes('/compare')) activePageKey = 'variance';
  else if (currentPath.includes('/account-selection') || currentPath.includes('/account')) activePageKey = 'account-selection';
  else if (currentPath.includes('/account-management') || currentPath.includes('/account-master')) activePageKey = 'account-master-direct';
  else if (currentPath.includes('/department-management') || currentPath.includes('/department-master')) activePageKey = 'department-master';
  else if (currentPath.includes('/department-assignment')) activePageKey = 'department-assignment';
  else if (currentPath.includes('/user-management')) activePageKey = 'settings';
  else if (currentPath.includes('/sales-status')) activePageKey = 'sales-status';
  else if (currentPath.includes('/purchase-status')) activePageKey = 'purchase-status';
  else if (currentPath.includes('/production-status')) activePageKey = 'production-status';
  else if (currentPath.includes('/raw-material-status')) activePageKey = 'raw-material-status';

  const filteredNavGroups = NAV_GROUPS_DEF.map(groupDef => {
    const filteredItems = groupDef.items.filter(item => {
      // Basic protection limits for raw uploads and system profiles
      const isRestricted = item.href?.startsWith('/plan-actual-upload') || 
                           item.href?.startsWith('/user-management') || 
                           item.href?.startsWith('/account-management') || 
                           item.href?.startsWith('/department-management');
      if (isRestricted) {
        return currentUser && (currentUser.code === '99999' || currentUser.code === '32100');
      }
      return true;
    });

    return {
      ...groupDef,
      items: filteredItems
    };
  }).filter(groupDef => groupDef.items.length > 0);

  const activeGroupName = filteredNavGroups.find(g => g.items.some(i => i.id === activePageKey))?.group || null;

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add("1단계. 예산 준비");
    s.add("2단계. 예산 작성");
    if (activeGroupName) s.add(activeGroupName);
    return s;
  });

  useEffect(() => {
    if (activeGroupName) {
      setOpenGroups(prev => {
        const next = new Set(prev);
        next.add(activeGroupName);
        return next;
      });
    }
  }, [activeGroupName]);

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupLabel)) {
        next.delete(groupLabel);
      } else {
        next.add(groupLabel);
      }
      return next;
    });
  };

  const handleNavClick = (item: any) => {
    if (item.disabled || !item.href) return;
    navigate(item.href);
  };

  return (
    <aside className="sb cb">
      <span className="cbl">Navigation Console</span>
      <nav className="flex-1 mt-4">
        {filteredNavGroups.map(({ group, items }) => {
          const isGroupOpen = !group || openGroups.has(group);
          const hasActiveItem = items.some(i => i.id === activePageKey);

          return (
            <div key={group || '__home'} className="nav-group">
              {group && (
                <div
                  className={`nav-group-hdr${hasActiveItem ? ' has-active text-[#008f83]' : ''} hover:text-[#008f83]`}
                  onClick={() => toggleGroup(group)}
                >
                  <span className="nav-group-label">{group}</span>
                  <span className="ml-auto text-zinc-400 opacity-70">
                    <Ico id={isGroupOpen ? 'chevdown' : 'chevright'} size={11} />
                  </span>
                </div>
              )}

              {isGroupOpen && (
                <div className="flex flex-col mb-2.5">
                  {items.map(item => {
                    const isActive = activePageKey === item.id;
                    const needsAttention = item.id === 'actual-upload' && !hasData;

                    return (
                      <div
                        key={item.id}
                        className={`nl${isActive ? ' active' : ''}${item.disabled ? ' off' : ''}`}
                        onClick={() => handleNavClick(item)}
                      >
                        <Ico id={item.icon} />
                        <span className="nl-label">{item.label}</span>
                        {item.badge && <span className="nbadge">{item.badge}</span>}
                        {needsAttention && !item.badge && (
                          <span
                            className="nbadge"
                            style={{
                              background: 'var(--nickel-50)',
                              color: 'var(--nickel-600)',
                              borderColor: 'var(--nickel-100)',
                            }}
                          >
                            설정 필요
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sb-footer">
        <div className="text-[10px] text-zinc-400 opacity-60 px-4 py-1.5 tracking-wider font-bold font-mono">
          HYCM CONTROL CENTER v2.1
        </div>
      </div>
    </aside>
  );
}
