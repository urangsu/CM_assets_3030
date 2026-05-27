import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Search, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  Activity, 
  AlertTriangle 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface ProductionRow {
  date: string;
  factory: string;
  processName: string; // e.g., 침출, 추출, 결정화
  targetTons: number;
  actualTons: number;
  yieldRate: number; // in %
  operator: string;
}

export default function ProductionStatus() {
  const [data, setData] = useState<ProductionRow[]>([]);
  const [selectedFactory, setSelectedFactory] = useState('all');

  useEffect(() => {
    const raw = localStorage.getItem('hycm_production_records_2026');
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch (e) {
        setData(getSeedProd());
      }
    } else {
      const seed = getSeedProd();
      setData(seed);
      localStorage.setItem('hycm_production_records_2026', JSON.stringify(seed));
    }
  }, []);

  const getSeedProd = (): ProductionRow[] => [
    { date: '2026-05-15', factory: '제1공장', processName: '침출파트 (Leaching)', targetTons: 150, actualTons: 148.5, yieldRate: 99.0, operator: '강혜원 계장' },
    { date: '2026-05-16', factory: '제1공장', processName: '추출파트 (Extraction)', targetTons: 130, actualTons: 129.2, yieldRate: 99.4, operator: '이주연 과장' },
    { date: '2026-05-17', factory: '제1공장', processName: '결정화파트 (Crystallization)', targetTons: 80, actualTons: 77.6, yieldRate: 97.0, operator: '송민호 대리' },
    { date: '2026-05-18', factory: '제2공장', processName: '리튬추출 (Lithium Recovery)', targetTons: 120, actualTons: 118.8, yieldRate: 99.0, operator: '김준혁 과장' },
    { date: '2026-05-19', factory: '제2공장', processName: '합성파트 (Precursor Synthesis)', targetTons: 95, actualTons: 93.1, yieldRate: 98.0, operator: '정재선 과장' }
  ];

  const filtered = selectedFactory === 'all' ? data : data.filter(r => r.factory === selectedFactory);

  return (
    <div className="space-y-6 animate-fade">
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-zinc-100 text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">Factory Floor</span>
          <span className="text-xs bg-teal-50 text-[#008f83] px-2 py-0.5 rounded font-bold">실시간 생산 현황</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
          현업 라인별 생산량 및 회수율(Yield) 통제 센터
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          금속 스크랩 투입 침출 공정, 고비중 용매 여과 추출 공정, 최종 하이니켈 하이드로 결정화 생산 수득률(Yield Rate)를 감계합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl">
          <span className="text-xs text-[#647067] block">금월 총 생산량 무게</span>
          <span className="text-xl font-bold text-[#111111] font-mono mt-1 block">
            {filtered.reduce((acc, r) => acc + r.actualTons, 0).toFixed(1)} Mt
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl">
          <span className="text-xs text-[#008f83] block">공장 라인 평균 실시간 마찰 실수율</span>
          <span className="text-xl font-bold text-[#008f83] font-mono mt-1 block">
            {(filtered.reduce((acc, r) => acc + r.yieldRate, 0) / (filtered.length || 1)).toFixed(2)}%
          </span>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl">
          <span className="text-xs text-zinc-500 block">공정 이상 징후 (DownTime)</span>
          <span className="text-xl font-bold text-emerald-600 font-mono mt-1 block">정상작동 (Active)</span>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#008f83]" /> 공정별 실제 수득 중량 산출 차트(Mt)
        </h3>
        <div className="h-[210px] w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
              <XAxis dataKey="processName" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => [`${v} Mt`, '실 생산량']} />
              <Area type="monotone" name="실 생산량" dataKey="actualTons" stroke="#008f83" fill="#e2ede3" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4.5 rounded-xl border border-[#dde5de] flex items-center gap-3">
        <span className="text-xs font-bold text-[#333333] font-sans">조회 대상 생산 공장:</span>
        <div className="flex gap-2">
          {['all', '제1공장', '제2공장'].map(f => (
            <button
              key={f}
              onClick={() => setSelectedFactory(f)}
              className={`p-1.5 px-4.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                selectedFactory === f 
                  ? 'bg-[#008f83] text-white border-[#008f83]' 
                  : 'bg-white text-zinc-650 border-zinc-200 hover:bg-zinc-55'
              }`}
            >
              {f === 'all' ? '전체 공장' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">공정 일시</th>
              <th className="px-5 py-3">소속 공장</th>
              <th className="px-5 py-3">공정 세목명</th>
              <th className="px-5 py-3 text-right">계획치 목표 (Mt)</th>
              <th className="px-5 py-3 text-right font-bold">실 생산 중량 (Mt)</th>
              <th className="px-5 py-3 text-center">회수율 % (Yield)</th>
              <th className="px-5 py-3">현장 실무 오퍼레이터</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {filtered.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#f7f9f7]/55">
                <td className="px-5 py-3.5 font-mono text-zinc-500">{row.date}</td>
                <td className="px-5 py-3.5 font-bold text-zinc-900">{row.factory}</td>
                <td className="px-5 py-3.5 font-semibold text-teal-850">{row.processName}</td>
                <td className="px-5 py-3.5 text-right font-mono">{row.targetTons.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-800">{row.actualTons.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-center font-mono font-bold text-emerald-600">{row.yieldRate}%</td>
                <td className="px-5 py-3.5 text-zinc-600 font-sans">{row.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
