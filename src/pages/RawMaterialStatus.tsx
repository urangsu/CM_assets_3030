import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Search, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  CheckCircle, 
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface MaterialReceiptRow {
  receiptDate: string;
  itemName: string;
  spec: string;
  actualWeight: number; // Mt
  inspectedWeight: number; // Mt
  warehouseLocation: string;
  qaPassed: boolean;
}

export default function RawMaterialStatus() {
  const [records, setRecords] = useState<MaterialReceiptRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('hycm_warehouse_receipts_2026');
    if (raw) {
      try {
        setRecords(JSON.parse(raw));
      } catch (e) {
        setRecords(getSeedReceipts());
      }
    } else {
      const seed = getSeedReceipts();
      setRecords(seed);
      localStorage.setItem('hycm_warehouse_receipts_2026', JSON.stringify(seed));
    }
  }, []);

  const getSeedReceipts = (): MaterialReceiptRow[] => [
    { receiptDate: '2026-05-18', itemName: '수산화리튬 (LiOH)', spec: 'Battery Grade (99.5%)', actualWeight: 45.3, inspectedWeight: 45.2, warehouseLocation: 'A-3 리튬특수소재창고', qaPassed: true },
    { receiptDate: '2026-05-19', itemName: '황산니켈 용액 (Ni)', spec: 'Liquid Grade (Ni 22%)', actualWeight: 120.0, inspectedWeight: 120.0, warehouseLocation: 'B-1 고비중액상탱크', qaPassed: true },
    { receiptDate: '2026-05-19', itemName: '황산코발트 고체 (Co)', spec: 'Solid Fine Crystal', actualWeight: 12.5, inspectedWeight: 12.45, warehouseLocation: 'C-2 특수유독원료고', qaPassed: true },
    { receiptDate: '2026-05-20', itemName: '폐배터리 블랙매스 (BlackMass)', spec: 'Co/Ni Recoverable Scrap', actualWeight: 210.4, inspectedWeight: 209.1, warehouseLocation: '야적 제4스크랩사일로', qaPassed: true }
  ];

  const filtered = records.filter(x => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return x.itemName.toLowerCase().includes(t) || x.warehouseLocation.toLowerCase().includes(t);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-zinc-100 text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">Inventory Control</span>
          <span className="text-xs bg-teal-50 text-[#008f83] px-2 py-0.5 rounded font-bold">원자재 창고 입하 수급고</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
          실물 계근(Scale Check) 및 품질 검수 원료 입고판
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          트럭 계근대 실측 실소 무게와 실물 검사용 샘플링 융점 적정 검사를 통과한 실물 메탈 원료 창고 입고 로그를 점검합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#647067] uppercase font-bold block">금일 총 입하 중량</span>
          <span className="text-lg font-bold text-[#111111] mt-1.5 font-mono block">{filtered.reduce((acc, r) => acc + r.actualWeight, 0).toFixed(1)} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">계근 정밀 검정량</span>
          <span className="text-lg font-bold text-teal-800 mt-1.5 font-mono block">{filtered.reduce((acc, r) => acc + r.inspectedWeight, 0).toFixed(1)} Mt</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4.5 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">품질 분석 합격율</span>
          <span className="text-lg font-bold text-[#008f83] font-mono mt-1.5 block">100.0%</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4.5 rounded-xl shadow-xs text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">창고 연동 상태</span>
          <span className="text-lg font-bold text-[#008f83] font-mono mt-1.5 block">정상 동기화</span>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 font-bold" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
          placeholder="소재 품종, 보관 저장 조 위치명 일괄 서치..."
        />
      </div>

      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">입고 검수 일자</th>
              <th className="px-5 py-3">품목 원리재명</th>
              <th className="px-5 py-3">규격 / 스펙</th>
              <th className="px-5 py-3 text-right">실제 계근중량 (Mt)</th>
              <th className="px-5 py-3 text-right font-bold font-mono">정밀 검수량 (Mt)</th>
              <th className="px-5 py-3">적재 보관지 사일로</th>
              <th className="px-5 py-3 text-center">품질 합격</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {filtered.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#f7f9f7]/55">
                <td className="px-5 py-3.5 font-mono text-zinc-550">{row.receiptDate}</td>
                <td className="px-5 py-3.5 font-semibold text-zinc-900">{row.itemName}</td>
                <td className="px-5 py-3.5 text-zinc-500 italic">{row.spec}</td>
                <td className="px-5 py-3.5 text-right font-mono">{row.actualWeight.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-800">{row.inspectedWeight.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-teal-850 font-semibold">{row.warehouseLocation}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-[#008f83] rounded-full text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" /> QA합격
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
