import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getViewableDepts } from '../../constants';
import { X, BookOpen, Info, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
      { id: 'dashboard', label: '운영 대시보드', icon: 'grid', href: '/dashboard' }
    ]
  },
  {
    group: "1단계. 실적 관리",
    items: [
      { id: 'actual-upload', label: '실적 업로드', icon: 'upload', href: '/plan-actual-upload' },
      { id: 'department-assignment', label: '실적 귀속부서 관리', icon: 'convert', href: '/department-assignment' }
    ]
  },
  {
    group: "2단계. 예산 준비",
    items: [
      { id: 'account-selection', label: '계정 선택', icon: 'tag', href: '/account-selection' },
      { id: 'account-management', label: '계정/부서 기준 확인', icon: 'list', href: '/account-management' }
    ]
  },
  {
    group: "3단계. 예산 작성",
    items: [
      { id: 'budget-write', label: '예산 작성', icon: 'plus', href: '/budget-creation' },
      { id: 'business-activity', label: '업무활동경비 산출', icon: 'wallet', href: '/business-activity-budget' },
      { id: 'budget-status', label: '예산 제출/승인 현황', icon: 'check', href: '/budget-status?tab=approval' }
    ]
  },
  {
    group: "4단계. 예산 검토",
    items: [
      { id: 'budget-status-review', label: '예산 현황', icon: 'list', href: '/budget-status?tab=overview' },
      { id: 'execution-ledger', label: '집행 내역', icon: 'list', href: '/execution-ledger' },
      { id: 'overrun', label: '초과·미달 항목', icon: 'alert', href: '/overrun-check' },
      { id: 'unbudgeted', label: '무예산 집행', icon: 'up', href: '/overrun-check?status=unbudgeted' }
    ]
  },
  {
    group: "5단계. 비교분석",
    items: [
      { id: 'variance', label: '비교분석', icon: 'trend', href: '/variance-comparison' },
      { id: 'compare-time', label: '시점 vs 시점 비교', icon: 'compare', href: '/variance-comparison?tab=time' },
      { id: 'compare-dept', label: '부서별 비교', icon: 'org', href: '/variance-comparison?tab=dept' },
      { id: 'compare-account', label: '계정별 비교', icon: 'tag', href: '/variance-comparison?tab=account' },
      { id: 'compare-multi', label: '다중계획 비교', icon: 'list', href: '/variance-comparison?tab=multi_plan' }
    ]
  },
  {
    group: "6단계. 운영 모듈",
    items: [
      { id: 'operation-dashboard', label: '운영 대시보드', icon: 'grid', href: '/operation-dashboard' },
      { id: 'sales-status', label: '판매 현황', icon: 'bar', href: '/sales-status' },
      { id: 'production-status', label: '생산 현황', icon: 'trend', href: '/production-status' },
      { id: 'product-status', label: '제품 수불 현황', icon: 'list', href: '/product-status' },
      { id: 'raw-material-status', label: '원자재 수불 현황', icon: 'cube', href: '/raw-material-status' },
      { id: 'blend-tester', label: '배합테스터', icon: 'cube', href: '/blend-tester', badge: '신규' },
      { id: 'operation-upload', label: '운영 업로드', icon: 'upload', href: '/operation-upload' }
    ]
  },
  {
    group: "관리",
    items: [
      { id: 'settings', label: '사용자 권한', icon: 'user', href: '/user-management' },
      { id: 'account-master-direct', label: '계정 코드 관리', icon: 'tag', href: '/account-management' },
      { id: 'department-master', label: '부서 코드 관리', icon: 'org', href: '/department-management' },
      { id: 'budget-lock-dept', label: '예산 잠금 관리', icon: 'lock', href: '/budget-lock-management' },
      { id: 'system-settings', label: '시스템 설정', icon: 'settings', href: '/user-management?tab=settings' }
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

  const [activeModal, setActiveModal] = useState<'guide' | 'privacy' | null>(null);
  const closeModal = () => setActiveModal(null);

  const privacyContent = (
    <div className="space-y-6 text-[#4e5968] text-sm leading-relaxed text-left">
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">1. 수집하는 개인정보 항목</h4>
        <p>• 필수항목: 사번(ID), 성명</p>
        <p>• 선택항목: 소속 부서, 연락처</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">2. 개인정보의 수집 및 이용 목적</h4>
        <p>• 사내 예산 및 원자재/생산/배합 모듈 이용 권한 및 작성 담당자 확인</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">3. 개인정보의 보유 및 이용 기간</h4>
        <p>• 퇴사 시 또는 시스템 운영 종료 시까지 (또는 사내 규정에 따름)</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">4. 개인정보의 파기 절차 및 방법</h4>
        <p>• 계정 삭제 시 시스템 내 저장된 데이터 즉시 파기</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">5. 보안 조치 사항</h4>
        <p>• 사용자 관리 메뉴는 지정된 관리자만 이용 가능합니다.</p>
        <p className="text-red-500 font-bold mt-2">※ 당사의 지정 사용자외 사용을 엄금합니다.</p>
      </section>
    </div>
  );

  const guideContent = (
    <div className="space-y-6 text-[#4e5968] text-sm leading-relaxed text-left">
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">1. 로그인 및 계정 관리</h4>
        <p>• 부여받은 사번과 비밀번호로 로그인합니다. 보안을 위해 최초 로그인 후 \'내 정보 관리\'에서 비밀번호를 변경하시기 바랍니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">2. 예산 계정 선택</h4>
        <p>• [예산 계정 선택] 메뉴에서 해당 부서에서 사용할 계정들을 체크하여 저장합니다. 선택된 계정만 예산 작성 화면에 나타납니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">3. 예산 작성 및 제출</h4>
        <p>• [예산 작성] 메뉴에서 월별 예산 금액을 입력합니다. 작성이 완료되면 우측 상단의 \'제출\' 버튼을 눌러 확정합니다.</p>
        <p className="text-red-500 font-medium mt-1">※ 제출 후에는 수정이 불가능하므로 관리자에게 반려 요청을 해야 합니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">4. 비교 분석</h4>
        <p>• [비교 분석] 메뉴를 통해 계획 대비 실적 현황을 그래프와 표로 한눈에 파악할 수 있습니다.</p>
      </section>
      <section>
        <h4 className="font-bold text-[#191f28] mb-2">5. 기타 문의</h4>
        <p>• 시스템 오류나 계정 관련 문의는 하단의 Feedback 링크를 통해 담당자에게 메일을 보내주시기 바랍니다.</p>
      </section>
    </div>
  );

  const fullPath = location.pathname + location.search;
  let activePageKey = 'dashboard';
  let bestMatchScore = -1;

  NAV_GROUPS_DEF.forEach(group => {
    group.items.forEach(item => {
      if (!item.href) return;
      if (item.href === fullPath) {
        activePageKey = item.id;
        bestMatchScore = 10;
      } else if (item.href === location.pathname && bestMatchScore < 5) {
        activePageKey = item.id;
        bestMatchScore = 5;
      } else if (location.pathname.startsWith(item.href.split('?')[0]) && bestMatchScore < 2) {
        activePageKey = item.id;
        bestMatchScore = 2;
      }
    });
  });

  const filteredNavGroups = NAV_GROUPS_DEF.map(groupDef => {
    const filteredItems = groupDef.items.filter(item => {
      const isAdminOnly =
        item.href?.startsWith('/user-management') ||
        item.href?.startsWith('/department-management') ||
        item.id === 'account-master-direct';

      const isFinanceOrAdmin =
        item.href?.startsWith('/plan-actual-upload');

      if (isAdminOnly) {
        return currentUser && currentUser.code === '99999';
      }

      if (isFinanceOrAdmin) {
        return currentUser && ['99999', '32100'].includes(currentUser.code);
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
    s.add("1단계. 실적 관리");
    s.add("2단계. 예산 준비");
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
    <aside className="sb">
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
      <div className="sb-footer flex flex-col gap-1 px-4 py-3 border-t border-zinc-250">
        <div className="text-[9px] text-zinc-400 opacity-60 tracking-wider font-bold font-mono">
          HYCM 운영 포털
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-zinc-500">
          <button 
            onClick={() => setActiveModal('guide')}
            className="hover:text-[#008f83] transition-colors cursor-pointer"
          >
            사용 가이드
          </button>
          <span className="text-zinc-300">·</span>
          <a 
            href="mailto:su@poscohycm.com"
            className="hover:text-[#008f83] transition-colors"
          >
            피드백
          </a>
          <span className="text-zinc-300">·</span>
          <button 
            onClick={() => setActiveModal('privacy')}
            className="hover:text-[#008f83] transition-colors cursor-pointer"
          >
            개인정보
          </button>
        </div>
      </div>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-left"
            >
              <div className="px-6 py-4 border-b border-[#e5e8eb] flex justify-between items-center bg-[#f9fafb]">
                <h3 className="text-lg font-bold text-[#191f28] flex items-center gap-2">
                  {activeModal === 'guide' ? (
                    <><BookOpen className="w-5 h-5 text-[#008f83]" /> 사용 가이드라인</>
                  ) : (
                    <><Info className="w-5 h-5 text-[#008f83]" /> 개인정보 처리방침</>
                  )}
                </h3>
                <button 
                  onClick={closeModal}
                  className="p-2 text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {activeModal === 'guide' ? guideContent : privacyContent}
              </div>
              <div className="px-6 py-4 border-t border-[#e5e8eb] bg-[#f9fafb] flex justify-end">
                <button 
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-[#008f83] hover:bg-[#00786f] text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}
