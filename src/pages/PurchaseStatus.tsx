import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  Layers, 
  Clock, 
  Plus, 
  Coins, 
  Percent, 
  Globe,
  AlertOctagon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface PurchaseRow {
  id: string;
  itemName: string;
  sourceCountry: string;
  supplier: string;
  tonnage: number;
  pricePerTonUSD: number;
  totalExchangeAmountKRW: number;
  status: 'ARRIVED' | 'TRANSIT' | 'CUSTOMS_CLEARANCE';
}

export default function PurchaseStatus() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalKRW, setTotalKRW] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem('hycm_purchase_data_2026');
    if (raw) {
      try {
        setPurchases(JSON.parse(raw));
      } catch (e) {
        setPurchases(getSeedPurchases());
      }
    } else {
      const seed = getSeedPurchases();
      setPurchases(seed);
      localStorage.setItem('hycm_purchase_data_2026', JSON.stringify(seed));
    }
  }, []);

  const getSeedPurchases = (): PurchaseRow[] => [
    { id: 'P-9901', itemName: '수산화리튬 무수물 (LiOH)', sourceCountry: '칠레 SQM', supplier: 'Glencore Global', tonnage: 300, pricePerTonUSD: 14200, totalExchangeAmountKRW: 5680000000, status: 'ARRIVED' },
    { id: 'P-9902', itemName: '고순도 황산니켈 메트', sourceCountry: '인도네시아 모로왈리', supplier: 'Tsingshan Trading', tonnage: 1500, pricePerTonUSD: 16800, totalExchangeAmountKRW: 33600000000, status: 'TRANSIT' },
    { id: 'P-9903', itemName: '블랙매스 (Battery Scrap)', sourceCountry: '미국 테네시', supplier: 'Li-Cycle Corp', tonnage: 800, pricePerTonUSD: 5200, totalExchangeAmountKRW: 5546000000, status: 'CUSTOMS_CLEARANCE' },
    { id: 'P-9904', itemName: '황산코발트 조수물 (Co)', sourceCountry: '콩고민주공화국', supplier: 'Trafigura Int', tonnage: 120, pricePerTonUSD: 28500, totalExchangeAmountKRW: 4560000000, status: 'ARRIVED' }
  ];

  useEffect(() => {
    const filtered = purchases.filter(x => {
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return x.itemName.toLowerCase().includes(t) || x.supplier.toLowerCase().includes(t);
      }
      return true;
    });
    setTotalKRW(filtered.reduce((acc, r) => acc + r.totalExchangeAmountKRW, 0));
  }, [purchases, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-zinc-100 text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">Resource Sourcing</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            글로벌 이차전지 핵심 메탈 원료 수급 동향기
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            리튬, 니켈, 코발트, 블랙매스 폐배터리 스크랩의 해외 공급망 계약 조달 상황 및 톤당 USD 환율 정산 비용 지도를 종합 검증합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl">
          <span className="text-xs text-[#647067] block">수입 정산 총 대금액</span>
          <span className="text-xl font-bold text-rose-600 font-mono mt-1 block">{(totalKRW / 100000000).toFixed(1)}억 원</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-5 rounded-xl">
          <span className="text-xs text-zinc-500 block">원자재 수입 규모 (Mt)</span>
          <span className="text-xl font-bold text-zinc-900 font-mono mt-1 block">
            {purchases.reduce((a, b) => a + b.tonnage, 0).toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-5 rounded-xl">
          <span className="text-xs text-[#008f83] block">글로벌 원사 공급사수</span>
          <span className="text-xl font-bold text-[#008f83] font-mono mt-1 block">4대 메이저</span>
        </div>
      </div>

      {/* BarChart */}
      <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs">
        <h3 className="text-sm font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#008f83]" /> 해외 원료 공급망 수입 조달 비중 ( Mt )
        </h3>
        <div className="h-[210px] w-full font-mono text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={purchases} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
              <XAxis dataKey="itemName" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => [`${v} Mt`, '수입량']} />
              <Bar name="수입 인도 중량" dataKey="tonnage" fill="#718872" radius={[4, 4, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs p-2.5 pl-9 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:outline-none focus:bg-white"
          placeholder="소싱 정련 업체, 광산 거래처 명명 필터..."
        />
      </div>

      <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
        <table className="min-w-full divide-y divide-[#eef2ec] text-left">
          <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">코드</th>
              <th className="px-5 py-3">소싱 메탈 원료명</th>
              <th className="px-5 py-3">공급처 (소싱 국가)</th>
              <th className="px-5 py-3">글로벌 무역 트레이더</th>
              <th className="px-5 py-3 text-right">수입 중량 (Tonnage)</th>
              <th className="px-5 py-3 text-right">인도가 USD ($ / Mt)</th>
              <th className="px-5 py-3 text-right font-bold">환율 정산 가치 (KRW)</th>
              <th className="px-5 py-3 text-center">선적 및 통관상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
            {purchases.map(row => (
              <tr key={row.id} className="hover:bg-[#f7f9f7]/55">
                <td className="px-5 py-3.5 font-mono text-zinc-500">{row.id}</td>
                <td className="px-5 py-3.5 font-bold text-[#111111]">{row.itemName}</td>
                <td className="px-5 py-3.5 text-zinc-805"><span className="text-zinc-400 font-sans block text-[10px]">Origin:</span>{row.sourceCountry}</td>
                <td className="px-5 py-3.5 text-zinc-650">{row.supplier}</td>
                <td className="px-5 py-3.5 text-right font-mono">{row.tonnage.toLocaleString()} Mt</td>
                <td className="px-5 py-3.5 text-right font-mono text-zinc-500">${row.pricePerTonUSD.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-700">{row.totalExchangeAmountKRW.toLocaleString()}원</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    row.status === 'ARRIVED' ? 'bg-emerald-50 text-[#008f83]' : row.status === 'TRANSIT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700 font-sans'
                  }`}>
                    {row.status === 'ARRIVED' ? '하역 완료' : row.status === 'TRANSIT' ? '태평양 선적' : '부산 통관중'}
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
