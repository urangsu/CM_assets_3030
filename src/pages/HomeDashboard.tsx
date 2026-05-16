import React, { useState, useEffect } from 'react';
import { AppCard } from '../components/ui/AppCard';
import { Calculator, AlertTriangle, FileSpreadsheet, BarChart3, Upload, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAllDepartments, getViewableDepts } from '../constants';
import { getBudgetDataKey, getActualDataKey } from '../lib/storageKeys';

export default function HomeDashboard() {
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);

      const year = '2026';
      const planType = '경영계획';
      const depts = u ? getViewableDepts(u.code) : [];
      let totalBudget = 0;
      let totalActual = 0;
      let totalPlanned = 0;
      let totalCompleted = 0;
      let overrunCount = 0;
      
      depts.forEach(dept => {
        const budgetKey = getBudgetDataKey(dept.code, year, planType);
        const budgetRows = JSON.parse(localStorage.getItem(budgetKey) || '[]');
        budgetRows.forEach((row: any) => {
           row.values.forEach((v: number) => totalBudget += v);
        });
        
        const actualKey = getActualDataKey(year);
        const actualRows = JSON.parse(localStorage.getItem(actualKey) || '[]');
        actualRows.filter((r: any) => r.usageCode === dept.code).forEach((r: any) => {
            totalCompleted += r.completed;
            if (r.planned + r.completed > (r.amount + r.additional + r.transferred + r.carriedOver)) overrunCount++;
        });
      });

      setMetrics([
        { title: '총 예산', value: `${totalBudget.toLocaleString()}원`, icon: Calculator },
        { title: '집행 금액', value: `${totalCompleted.toLocaleString()}원`, icon: FileSpreadsheet },
        { title: '잔여 예산', value: `${(totalBudget - totalCompleted).toLocaleString()}원`, icon: AlertTriangle, variant: 'warning' },
        { title: '집행률', value: `${totalBudget > 0 ? ((totalCompleted / totalBudget) * 100).toFixed(1) : 0}%`, icon: BarChart3 },
        { title: '초과 건수', value: `${overrunCount}건`, icon: AlertTriangle }
      ]);
    }
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-lithium-200">
        <h2 className="text-2xl font-bold text-eco-black">안녕하세요, {user.name}님</h2>
        <p className="text-lithium-500">2026년 경영계획 예산관리 시스템입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
          <AppCard key={i} className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${m.variant === 'warning' ? 'bg-orange-50 text-orange-600' : 'bg-lithium-50 text-lithium-600'}`}>
              <m.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-lithium-500">{m.title}</p>
              <p className="text-lg font-bold text-eco-black">{m.value}</p>
            </div>
          </AppCard>
        ))}
      </div>
      
      <AppCard className="p-6">
        <h3 className="font-bold mb-4">주요 작업 바로가기</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={() => navigate('/budget-creation')} className="flex items-center p-3 border rounded-xl hover:bg-neutral-50">
                <FileSpreadsheet className="w-5 h-5 mr-3 text-lithium-500"/>
                예산 작성
            </button>
            <button onClick={() => navigate('/business-activity-budget')} className="flex items-center p-3 border rounded-xl hover:bg-neutral-50">
                <Briefcase className="w-5 h-5 mr-3 text-lithium-500"/>
                업무활동경비
            </button>
            <button onClick={() => navigate('/overrun-check')} className="flex items-center p-3 border rounded-xl hover:bg-neutral-50">
                <AlertTriangle className="w-5 h-5 mr-3 text-lithium-500"/>
                예산 점검
            </button>
            <button onClick={() => navigate('/plan-actual-upload')} className="flex items-center p-3 border rounded-xl hover:bg-neutral-50">
                <Upload className="w-5 h-5 mr-3 text-lithium-500"/>
                실적 업로드
            </button>
        </div>
      </AppCard>
    </div>
  );
}
