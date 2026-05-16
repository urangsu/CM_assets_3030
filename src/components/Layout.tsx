import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, FileSpreadsheet, Calculator, BarChart3, LogOut, Upload, Briefcase, Users, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEPARTMENTS, getViewableDepts } from '../constants';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      navigate('/');
    }
  }, [navigate]);

  if (!currentUser) return null;

  const navigation = [
    { category: '홈', name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
    { category: '예산 입력', name: '예산 계정 선택', href: '/account-selection', icon: Settings },
    { category: '예산 입력', name: '예산 작성', href: '/budget-creation', icon: FileSpreadsheet },
    { category: '예산 입력', name: '업무활동경비', href: '/business-activity-budget', icon: Briefcase },
    { category: '실적/업로드', name: '계획/실적 업로드', href: '/actual-upload', icon: Upload },
    { category: '분석/점검', name: '예산 점검', href: '/overrun-check', icon: AlertTriangle },
    { category: '분석/점검', name: '비교 분석', href: '/variance-comparison', icon: BarChart3 },
    { 
      category: '관리',
      name: '사용자 및 부서관리', 
      href: '/user-management',
      icon: Users, 
      showIf: (user: any) => {
        if (user.code === '99999' || user.code === '32100') return true;
        const viewable = getViewableDepts(user.code);
        return viewable.length > 0;
      }
    },
  ];

  const filteredNavigation = navigation.filter(item => {
    if (item.showIf) {
      return item.showIf(currentUser);
    }
    if (item.name === '계획/실적 업로드' || item.name === '업무활동경비') {
      return currentUser.code === '99999' || currentUser.code === '32100';
    }
    return true;
  });

  // Group by category
  const groupedNavigation = filteredNavigation.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof navigation>);

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#f7f9f7]">
      {/* Sidebar */}
      <div className="w-64 bg-[#111111] text-white border-r border-black/10 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <Calculator className="w-6 h-6 text-nickel-500 mr-2" />
          <span className="text-lg font-bold text-white tracking-tight">클린메탈 예산</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          {Object.entries(groupedNavigation).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">
                {category}
              </div>
              {items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href!}
                    className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                      isActive
                        ? 'bg-nickel-600 text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-nickel-100" />
                    )}
                    <item.icon className={`w-4 h-4 mr-3 transition-colors ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center px-3 py-3 rounded-xl hover:bg-white/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-nickel-500 flex items-center justify-center text-white font-bold mr-3 shadow-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-white/40 truncate">{currentUser.code}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-white/40 hover:text-white ml-2 transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-[#dde5de] flex items-center px-8 shadow-sm z-10">
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">
            {navigation.find((item) => item.href === location.pathname)?.name || '클린메탈 예산'}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-8 flex flex-col bg-[#f7f9f7]">
          <div className="max-w-7xl mx-auto w-full flex-1">
            {children}
          </div>
          <Footer isLoggedIn={true} />
        </main>
      </div>
    </div>
  );
}
