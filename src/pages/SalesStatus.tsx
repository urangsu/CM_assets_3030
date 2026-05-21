import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  DollarSign, 
  ShoppingCart, 
  Layers, 
  Clock, 
  Plus, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';

interface SalesRow {
  id: string;
  productName: string;
  clientName: string;
  volume: number; // Mt tons
  unitPrice: number; // KRW per Mt
  totalAmount: number;
  contractDate: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}

export default function SalesStatus() {
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalVolume: 0,
    averagePrice: 0,
    completedCount: 0
  });

  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('hycm_sales_data_2026');
    if (raw) {
      try {
        setSalesRows(JSON.parse(raw));
      } catch (e) {
        setSalesRows(getSeedSales());
      }
    } else {
      const seed = getSeedSales();
      setSalesRows(seed);
      localStorage.setItem('hycm_sales_data_2026', JSON.stringify(seed));
    }
  }, []);

  const getSeedSales = (): SalesRow[] => [
    { id: 'S-7101', productName: '하이니켈 전구체 NCM', clientName: '(주)엘지엔솔 울산공장', volume: 450, unitPrice: 32000000, totalAmount: 14400000000, contractDate: '2026-01-15', status: 'COMPLETED' },
    { id: 'S-7102', productName: '리튬 이차전지 양극재 LFP', clientName: '(주)삼성에스디아이 기흥', volume: 600, unitPrice: 18500000, totalAmount: 11100000000, contractDate: '2026-02-11', status: 'COMPLETED' },
    { id: 'S-7103', productName: '하이니켈 전구체 NCM', clientName: '(주)에스케이온 대전', volume: 380, unitPrice: 32500000, totalAmount: 12350000000, contractDate: '2026-03-05', status: 'COMPLETED' },
    { id: 'S-7104', productName: '고순도 황산니켈 용액', clientName: '(주)포스코퓨처엠 광양', volume: 1200, unitPrice: 4800000, totalAmount: 5760000000, contractDate: '2026-04-12', status: 'COMPLETED' },
    { id: 'S-7105', productName: '황산코발트 고체 크리스탈', clientName: '(주)에코프로비엠 청주', volume: 150, unitPrice: 85000000, totalAmount: 12750000000, contractDate: '2026-05-18', status: 'PENDING' }
  ];

  // Re-calculate KPIs
  useEffect(() => {
    const computed = salesRows.filter(row => {
      if (filterProduct !== 'all' && row.productName !== filterProduct) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return (
          row.clientName.toLowerCase().includes(t) ||
          row.productName.toLowerCase().includes(t)
        );
      }
      return true;
    });

    let rev = 0;
    let vol = 0;
    let completed = 0;
    computed.forEach(r => {
      rev += r.totalAmount;
      vol += r.volume;
      if (r.status === 'COMPLETED') completed++;
    });

    setKpis({
      totalRevenue: rev,
      totalVolume: vol,
      averagePrice: vol > 0 ? Math.round(rev / vol) : 0,
      completedCount: completed
    });

    // Monthly trend simulation (based on contractDates)
    const monthlyMap = new Map<string, number>();
    Array.from({ length: 12 }, (_, i) => `${i + 1}월`).forEach(m => monthlyMap.set(m, 0));
    computed.forEach(row => {
      const match = row.contractDate.match(/-(\d+)-/);
      if (match) {
        const mStr = `${parseInt(match[1])}월`;
        monthlyMap.set(mStr, (monthlyMap.get(mStr) || 0) + row.totalAmount);
      }
    });

    setMonthlyTrend(Array.from(monthlyMap.entries()).map(([m, val]) => ({
      month: m,
      '매출액': val
    })));

  }, [salesRows, searchTerm, filterProduct]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-[#008f83] px-2.5 py-0.5 rounded font-bold font-mono">CC Operating Sales</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            메탈 원자재 및 배터리 양극재 제품 판매 관제실
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            하이니켈 전구체, 황산니켈, LFP 양극재를 비롯한 리튬 2차전지 주력 제품 계약 체결 및 실제 인도 판매 매출 현황을 분석합니다.
          </p>
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-[#647067] block">누적 계약 매출액</span>
          <span className="text-lg font-bold text-zinc-900 font-mono mt-1 block">{(kpis.totalRevenue / 100000000).toFixed(1)}억 원</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-[#008f83] block">인도 완료 중량 (Tons)</span>
          <span className="text-lg font-bold text-[#008f83] font-mono mt-1 block">{kpis.totalVolume.toLocaleString()} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl shadow-xs">
          <span className="text-xs text-zinc-500 block">톤당 평균 매각 단가</span>
          <span className="text-lg font-bold text-zinc-800 font-mono mt-1 block">{kpis.averagePrice.toLocaleString()}원</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-xl shadow-xs">
          <span className="text-xs text-[#008f83] block">정상 종결 계약율</span>
          <span className="text-lg font-bold text-[#008f83] font-mono mt-1 block">
            {salesRows.length > 0 ? Math.round((kpis.completedCount / salesRows.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#008f83]" /> 월별 매출 출하액 전도 동향
        </h3>
        <div className="h-[210px] w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
              <XAxis dataKey="month" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/100000000).toLocaleString()}억`} />
              <Tooltip formatter={(value: any) => [`${(Number(value) / 10000).toLocaleString()}만 원`, '']} />
              <Bar name="매출 인도가치" dataKey="매출액" fill="#008f83" radius={[4, 4, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters Table tools */}
      <div className="bg-white p-4 rounded-xl border border-[#dde5de] flex flex-col sm:flex-row gap-3">
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="text-xs p-2.5 bg-white border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none w-full sm:w-60"
        >
          <option value="all">전체 제품군 [All]</option>
          <option value="하이니켈 전구체 NCM">하이니켈 전구체 NCM</option>
          <option value="리튬 이차전지 양극재 LFP">리튬 양극재 LFP</option>
          <option value="고순도 황산니켈 용액">고순도 황산니켈 용액</option>
          <option value="황산코발트 고체 크리스탈">황산코발트 크리스탈</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
            placeholder="상대 납품 거래사, 계약번호로 고유 검토..."
          />
        </div>
      </div>

      {/* Sales DataTable Grid */}
      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden animate-fade">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">계약번호</th>
              <th className="px-5 py-3">인도 제품명</th>
              <th className="px-5 py-3">거래 협력사(고객사)</th>
              <th className="px-5 py-3 text-right">출하 중량 (Mt)</th>
              <th className="px-5 py-3 text-right">톤당 거래단가</th>
              <th className="px-5 py-3 text-right font-bold">인도 확정 계약금액</th>
              <th className="px-5 py-3 text-center">계약체결일</th>
              <th className="px-5 py-3 text-center">인도 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {salesRows.map(row => (
              <tr key={row.id} className="hover:bg-[#f7f9f7]/55">
                <td className="px-5 py-3.5 font-mono text-zinc-500">{row.id}</td>
                <td className="px-5 py-3.5 font-semibold text-[#111111]">{row.productName}</td>
                <td className="px-5 py-3.5 text-zinc-700">{row.clientName}</td>
                <td className="px-5 py-3.5 text-right font-mono">{row.volume.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-right font-mono text-zinc-550">{row.unitPrice.toLocaleString()}원</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-800">
                  {row.totalAmount.toLocaleString()}원
                </td>
                <td className="px-5 py-3.5 text-center font-mono text-zinc-400">{row.contractDate}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    row.status === 'COMPLETED' ? 'bg-emerald-50 text-[#008f83]' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {row.status === 'COMPLETED' ? '인도 완료' : '인도 준비'}
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
