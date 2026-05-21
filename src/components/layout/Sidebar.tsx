import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getViewableDepts } from '../../constants';

// Reusable Icon component from shell.jsx translated to TypeScript
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

// Navigation structure organized by actual business operational workflow
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
    group: null,
    items: [
      { id: 'dashboard', label: '운영 관제 대시보드', icon: 'grid', href: '/dashboard' }
    ]
  },
  {
    group: '1단계. 기초 실적 및 마스터 설정',
    items: [
      { id: 'actual-upload', label: '실적 업로드 (Plan/Actual)', icon: 'upload', href: '/plan-actual-upload' },
      { id: 'budget', label: '통제 대상 계정 지정', icon: 'wallet', href: '/account-selection' },
    ]
  },
  {
    group: '2단계. 부서별 예산 수립',
    items: [
      { id: 'budget-write', label: '부서 경비 예산 작성', icon: 'list', href: '/budget-creation' },
      { id: 'expense-report', label: '업무활동경비 산출', icon: 'convert', href: '/business-activity-budget' },
    ]
  },
  {
    group: '3단계. 다차원 통제 및 분석',
    items: [
      { id: 'overrun', label: '실시간 예산 한도 통제', icon: 'alert', href: '/overrun-check' },
      { id: 'variance', label: '부서별 Plan vs Actual', icon: 'compare', href: '/variance-comparison' },
    ]
  },
  {
    group: '시스템 설정',
    items: [
      { id: 'settings', label: '권한 및 포털 계정 설정', icon: 'settings', href: '/user-management' },
    ]
  },
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

    // Check if actuals are uploaded
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

  // Determine current active page key based on URL path
  const currentPath = location.pathname;
  let activePageKey = 'dashboard';
  if (currentPath.includes('/dashboard')) activePageKey = 'dashboard';
  else if (currentPath.includes('/account-selection')) activePageKey = 'budget';
  else if (currentPath.includes('/variance-comparison')) activePageKey = 'variance';
  else if (currentPath.includes('/overrun-check')) activePageKey = 'overrun';
  else if (currentPath.includes('/budget-creation')) activePageKey = 'budget-write';
  else if (currentPath.includes('/business-activity-budget')) activePageKey = 'expense-report';
  else if (currentPath.includes('/plan-actual-upload')) activePageKey = 'actual-upload';
  else if (currentPath.includes('/user-management')) activePageKey = 'settings';

  // Filter groups and items depending on user permissions
  const filteredNavGroups = NAV_GROUPS_DEF.map(groupDef => {
    const filteredItems = groupDef.items.filter(item => {
      // Permission checks for admin-like roles (System Admin, Finance Team)
      if (item.href === '/plan-actual-upload' || item.href === '/business-activity-budget') {
        return currentUser && (currentUser.code === '99999' || currentUser.code === '32100');
      }
      if (item.href === '/user-management') {
        if (!currentUser) return false;
        if (currentUser.code === '99999' || currentUser.code === '32100') return true;
        const viewable = getViewableDepts(currentUser.code);
        return viewable.length > 0;
      }
      return true;
    });

    return {
      ...groupDef,
      items: filteredItems
    };
  }).filter(groupDef => groupDef.items.length > 0);

  // Find active group name
  const activeGroupName = filteredNavGroups.find(g => g.items.some(i => i.id === activePageKey))?.group || null;

  // Track accordion expand/collapse state
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (activeGroupName) s.add(activeGroupName);
    if (!hasData) s.add('1단계. 기초 실적 및 마스터 설정'); // Default open actual upload if no data
    return s;
  });

  // Auto-expand group of active page
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
      <span className="cbl">Sidebar</span>
      <nav className="flex-1">
        {filteredNavGroups.map(({ group, items }) => {
          const isGroupOpen = !group || openGroups.has(group);
          const hasActiveItem = items.some(i => i.id === activePageKey);

          return (
            <div key={group || '__home'} className="nav-group">
              {/* Group Header */}
              {group && (
                <div
                  className={`nav-group-hdr${hasActiveItem ? ' has-active' : ''}`}
                  onClick={() => toggleGroup(group)}
                >
                  <span className="nav-group-label">{group}</span>
                  <span className="ml-auto text-zinc-400 opacity-70">
                    <Ico id={isGroupOpen ? 'chevdown' : 'chevright'} size={11} />
                  </span>
                </div>
              )}

              {/* Group Nav Items */}
              {isGroupOpen && (
                <div className="flex flex-col">
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
                            필요
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
        <div className="text-[10px] text-zinc-400 opacity-70 px-4 py-1 tracking-wide font-medium">
          HYCM Portal v2.0
        </div>
      </div>
    </aside>
  );
}
