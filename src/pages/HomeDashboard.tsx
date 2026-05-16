import React, { useState, useEffect } from 'react';
import { AppCard } from '../components/ui/AppCard';
import { Calculator, AlertTriangle, FileSpreadsheet, BarChart3, Upload, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HomeDashboard() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const metrics = [
    { title: '작성 대상 부서 수', value: '15건', icon: Calculator },
    { title: '제출 완료 부서 수', value: '12건', icon: FileSpreadsheet },
    { title: '초과 항목 수', value: '3건', icon: AlertTriangle, variant: 'warning' },
  ];

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-lithium-200">
        <h2 className="text-2xl font-bold text-eco-black">안녕하세요, {user.name}님</h2>
        <p className="text-lithium-500">2026년 경영계획 예산관리 시스템입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <AppCard key={i} className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${m.variant === 'warning' ? 'bg-orange-50 text-orange-600' : 'bg-lithium-50 text-lithium-600'}`}>
              <m.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-lithium-500">{m.title}</p>
              <p className="text-xl font-bold text-eco-black">{m.value}</p>
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
        </div>
      </AppCard>
    </div>
  );
}
