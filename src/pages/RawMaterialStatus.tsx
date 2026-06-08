import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Search, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  CheckCircle, 
  ShieldCheck,
  PackageCheck,
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  DollarSign
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
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';

export default function RawMaterialStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('all');

  const [realProducts, setRealProducts] = useState<ProductLedgerRecord[]>([]);
  const [realMaterials, setRealMaterials] = useState<RawMaterialLedgerRecord[]>([]);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  const loadData = () => {
    const listProducts = OperationStorage.getProductRecords(activeYear);
    const listMaterials = OperationStorage.getRawMaterialRecords(activeYear);
    
    if ((listProducts && listProducts.length > 0) || (listMaterials && listMaterials.length > 0)) {
      setRealProducts(listProducts);
      setRealMaterials(listMaterials);
      setIsSampleData(false);
    } else {
      // Load synchronized sample data
      setRealProducts(getSampleProductLedgers(activeYear));
      setRealMaterials(getSampleRawMaterials(activeYear));
      setIsSampleData(true);
    }
  };

  useEffect(() => {
    loadData();

    const handler = () => {
      loadData();
    };
    window.addEventListener('operation-ledger-changed', handler);
    return () => {
      window.removeEventListener('operation-ledger-changed', handler);
    };
  }, [activeYear]);

  // Product ledger sample generator for ending inventory
  const getSampleProductLedgers = (yearStr: string): ProductLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const sampleRecords: ProductLedgerRecord[] = [];

    const products = [
      { name: '황산니켈' as const, metal: 'Ni' as const, baseQty: 120, unitPrice: 24_000_000, evalLoss: 45_000_000 },
      { name: '황산코발트' as const, metal: 'Co' as const, baseQty: 45, unitPrice: 58_000_000, evalLoss: 14_000_000 },
      { name: '탄산리튬' as const, metal: 'Li' as const, baseQty: 85, unitPrice: 38_000_000, evalLoss: 80_000_000 },
      { name: '황산망간' as const, metal: 'Mn' as const, baseQty: 150, unitPrice: 12_000_000, evalLoss: 0 },
      { name: '구리' as const, metal: 'Cu' as const, baseQty: 300, unitPrice: 9_500_000, evalLoss: 5_000_000 },
    ];

    months.forEach((m) => {
      const factor = 1.0 + Math.sin((m / 4) * Math.PI) * 0.2;

      products.forEach((p) => {
        const endQty = Math.round(p.baseQty * factor);
        const endAmt = Math.round(endQty * p.unitPrice);
        const loss = m % 3 === 0 ? p.evalLoss : 0;
        const applied = loss > 0 ? loss * 0.9 : 0;

        // Qty record
        const recQty: ProductLedgerRecord = {
          id: `sample_inv_${yearStr}_${m}_${p.name}_수량`,
          year: yearStr,
          month: m,
          sourceType: '제품수불부',
          sourceRowStartIndex: 0,
          rawProductName: `${p.metal} ${p.name}`,
          productName: p.name,
          metal: p.metal,
          unit: '수량',
          beginningInventory: endQty,
          normalReceipt: 0,
          transferReceipt: 0,
          returnReceipt: 0,
          otherReceipt: 0,
          receiptTotal: 0,
          salesQuantity: 0,
          reInput: 0,
          compensation: 0,
          sample: 0,
          transferIssue: 0,
          disposal: 0,
          otherIssue: 0,
          issueTotal: 0,
          endingInventory: endQty, // Q열 기말재고
          inventoryValuationLoss: 0,
          valuationApplied: 0,
          revenue: 0,
          costOfSales: 0,
          grossProfit: 0,
          uploadedAt: new Date().toISOString()
        };

        if (p.name === '탄산리튬') {
          const rate = 18.75;
          recQty.conversionRate = rate;
          recQty.convertedEndingInventory = endQty / (rate / 100);
        } else {
          recQty.convertedEndingInventory = endQty;
        }

        // Amt record
        const recAmt: ProductLedgerRecord = {
          ...recQty,
          id: `sample_inv_${yearStr}_${m}_${p.name}_금액`,
          unit: '금액',
          endingInventory: endAmt,
          inventoryValuationLoss: loss,
          valuationApplied: applied
        };

        sampleRecords.push(recQty);
        sampleRecords.push(recAmt);
      });
    });

    return sampleRecords;
  };

  // Raw material sample generator
  const getSampleRawMaterials = (yearStr: string): RawMaterialLedgerRecord[] => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const materials: RawMaterialLedgerRecord[] = [];

    const matSeeds = [
      { name: '수산화리튬 (LiOH)', unit: 'Mt', beginning: 45.3, receipt: 120.4, issue: 95.2 },
      { name: '황산니켈 용액 (Ni)', unit: 'Mt', beginning: 120.0, receipt: 340.5, issue: 290.0 },
      { name: '황산코발트 고체 (Co)', unit: 'Mt', beginning: 12.5, receipt: 45.8, issue: 42.1 },
      { name: '폐배터리 블랙매스 (BlackMass)', unit: 'Mt', beginning: 210.4, receipt: 650.0, issue: 580.0 }
    ];

    months.forEach((m) => {
      const idxFactor = 0.95 + (m % 5) * 0.04;
      matSeeds.forEach((seed, sIdx) => {
        const start = Math.round(seed.beginning * idxFactor * 10) / 10;
        const rec = Math.round(seed.receipt * idxFactor * 10) / 10;
        const iss = Math.round(seed.issue * idxFactor * 10) / 10;
        const end = Math.round((start + rec - iss) * 10) / 10;

        materials.push({
          id: `sample_raw_${yearStr}_${m}_${sIdx}`,
          year: yearStr,
          month: m,
          sourceType: '원자재수불부',
          rawMaterialName: seed.name,
          unit: seed.unit,
          beginningInventory: start,
          receiptTotal: rec,
          issueTotal: iss,
          endingInventory: end,
          uploadedAt: new Date().toISOString()
        });
      });
    });

    return materials;
  };

  // --- Filtering Completed ---
  // Finished Products Filters
  const qtyProducts = realProducts.filter(r => r.unit === '수량');
  const amtProducts = realProducts.filter(r => r.unit === '금액');

  const filteredQtyProducts = qtyProducts.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q) || r.rawProductName.toLowerCase().includes(q);
    }
    return true;
  });

  // Raw Materials Filters
  const filteredRawMaterials = realMaterials.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterMaterial !== 'all' && r.rawMaterialName !== filterMaterial) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.rawMaterialName.toLowerCase().includes(q);
    }
    return true;
  });

  // unique Raw Materials list for search dropdown
  const rawMaterialUniqueNames = Array.from(new Set(realMaterials.map(m => m.rawMaterialName)));

  // Finished Product Group aggregates
  const CANONICAL_PRODUCTS = [
    { name: '황산니켈' as const, metal: 'Ni' as const },
    { name: '황산코발트' as const, metal: 'Co' as const },
    { name: '탄산리튬' as const, metal: 'Li' as const },
    { name: '황산망간' as const, metal: 'Mn' as const },
    { name: '구리' as const, metal: 'Cu' as const },
  ];

  const productAggregatesMap = new Map<string, {
    productName: '황산니켈' | '황산코발트' | '탄산리튬' | '황산망간' | '구리';
    metal: 'Ni' | 'Co' | 'Li' | 'Mn' | 'Cu';
    endingQty: number;          // endingInventory on '수량'
    convertedEndingQty: number; // convertedEndingInventory on '수량'
    endingAmt: number;          // endingInventory on '금액'
    valuationLoss: number;      // inventoryValuationLoss on '금액'
    valuationApplied: number;   // valuationApplied on '금액'
  }>();

  CANONICAL_PRODUCTS.forEach(p => {
    productAggregatesMap.set(p.name, {
      productName: p.name,
      metal: p.metal,
      endingQty: 0,
      convertedEndingQty: 0,
      endingAmt: 0,
      valuationLoss: 0,
      valuationApplied: 0,
    });
  });

  // Calculate aggregates
  filteredQtyProducts.forEach(qRec => {
    const existing = productAggregatesMap.get(qRec.productName);
    if (existing) {
      existing.endingQty += qRec.endingInventory || 0;
      existing.convertedEndingQty += qRec.convertedEndingInventory || qRec.endingInventory || 0;

      // Look up corresponding amount row to sum amount, evaluation loss and applied valuation
      const matchingAmt = amtProducts.find(a => a.productName === qRec.productName && Number(a.month) === Number(qRec.month));
      if (matchingAmt) {
        existing.endingAmt += matchingAmt.endingInventory || 0;
        existing.valuationLoss += matchingAmt.inventoryValuationLoss || 0;
        existing.valuationApplied += matchingAmt.valuationApplied || 0;
      }
    }
  });

  const productAggList = Array.from(productAggregatesMap.values());

  // KPI Calculations
  const endQtySum = productAggList.reduce((acc, item) => acc + item.endingQty, 0);
  const endConvertedQtySum = productAggList.reduce((acc, item) => acc + item.convertedEndingQty, 0);
  const endAmtSum = productAggList.reduce((acc, item) => acc + item.endingAmt, 0);
  const totalValuationLoss = productAggList.reduce((acc, item) => acc + item.valuationLoss, 0);
  const totalValuationApplied = productAggList.reduce((acc, item) => acc + item.valuationApplied, 0);

  // Raw Materials Group aggregates by name
  const rawAggregatesMap = new Map<string, {
    materialName: string;
    unit: string;
    beginningQty: number;
    receiptQty: number;
    issueQty: number;
    endingQty: number;
  }>();

  filteredRawMaterials.forEach(rm => {
    const existing = rawAggregatesMap.get(rm.rawMaterialName);
    if (existing) {
      existing.beginningQty += rm.beginningInventory || 0;
      existing.receiptQty += rm.receiptTotal || 0;
      existing.issueQty += rm.issueTotal || 0;
      existing.endingQty += rm.endingInventory || 0;
    } else {
      rawAggregatesMap.set(rm.rawMaterialName, {
        materialName: rm.rawMaterialName,
        unit: rm.unit || 'Mt',
        beginningQty: rm.beginningInventory || 0,
        receiptQty: rm.receiptTotal || 0,
        issueQty: rm.issueTotal || 0,
        endingQty: rm.endingInventory || 0
      });
    }
  });

  const rawAggList = Array.from(rawAggregatesMap.values());

  // Recharts ending inventory amount data
  const chartData = productAggList.map(item => ({
    name: item.productName,
    '기말재고 금액': item.endingAmt,
    '재고평가손': item.valuationLoss
  }));

  return (
    <div className="space-y-6 animate-fade">
      {/* Banner / Warning indicator if viewing sample data */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs animate-fade">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">⚠️ SAMPLE DATA (샘플 시뮬레이션 활용중)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 수불부 원본 자료가 없으므로 화면 설명용 샘플 데이터가 가동 중입니다. 
                실제 기말재고 및 재고소실을 반영하려면 [운영 업로드]에서 엑셀 수불부를 업로드해 주십시오.
              </p>
            </div>
          </div>
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-0 shrink-0"
          >
            운영 수불부 업로드로 이동
            <ChevronRight className="w-3.5 h-3.5 ml-1 inline" />
          </AppButton>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#f2f4f6] text-[#4e5968] px-2.5 py-0.5 rounded font-bold font-mono">Stock Keeping</span>
            <span className="text-xs bg-teal-50 text-[#008f83] px-2 py-0.5 rounded font-bold">실물 수불부 연동 기말재고</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
            공장 완제품 및 원자재 실시간 재고 제어 대시보드
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            제품수불부의 &apos;Q열 기말재고, R열 재고평가손, S열 평가손반영&apos; 데이터를 완제품 지표로 삼고, 원자재수불부 항목을 원료 실물재고로 연계합니다.
          </p>
        </div>

        {/* Global Year/Month Filters */}
        <div className="flex items-center gap-2.5 bg-[#f8f9fa] p-2 rounded-xl border border-zinc-150">
          <Calendar className="w-4 h-4 text-zinc-400 font-bold" />
          <select
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 cursor-pointer"
          >
            {['2024', '2025', '2026', '2027', '2028'].map(yr => (
              <option key={yr} value={yr}>{yr}년</option>
            ))}
          </select>

          <span className="text-zinc-300">|</span>

          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="text-xs font-semibold bg-transparent border-0 focus:ring-0 cursor-pointer"
          >
            <option value="all">연간 전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={String(m)}>{m}월 합산</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-center">
          <span className="text-[10px] text-[#647067] uppercase font-bold block">완제품 기말재고 중량</span>
          <span className="text-base font-bold text-[#111111] mt-1.5 font-mono block">{endQtySum.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-center">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">Li 보정 완제품 수량</span>
          <span className="text-base font-bold text-teal-800 mt-1.5 font-mono block">{endConvertedQtySum.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mt</span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-center">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">기말재고 평가금액</span>
          <span className="text-base font-bold text-[#111111] mt-1.5 font-mono block">₩{endAmtSum.toLocaleString()}</span>
        </div>
        <div className="bg-[#fff1f2] border border-rose-150 p-4.5 rounded-xl text-center">
          <span className="text-[10px] text-rose-700 font-bold block">기말 재고평가손</span>
          <span className="text-base font-bold text-rose-700 font-mono mt-1.5 block">₩{totalValuationLoss.toLocaleString()}</span>
        </div>
        <div className="bg-[#f0f9f8] border border-teal-150 p-4.5 rounded-xl text-center">
          <span className="text-[10px] text-[#008f83] font-bold block">충당 평가손반영액</span>
          <span className="text-base font-bold text-[#008f83] font-mono mt-1.5 block">₩{totalValuationApplied.toLocaleString()}</span>
        </div>
      </div>

      {/* Grid: Chart & Finished Product Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
          <h3 className="text-xs font-bold text-[#111111] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#008f83]" /> 제품 기말평가액 및 재고평가손 차트 (₩)
          </h3>
          <div className="h-[210px] w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                <XAxis dataKey="name" stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#8b95a1" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₩${(v / 1_000_000).toLocaleString()}M`} />
                <Tooltip formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '']} />
                <Legend iconType="circle" />
                <Bar name="기말재고 가치" dataKey="기말재고 금액" fill="#0c8599" radius={[3, 3, 0, 0]} barSize={26} />
                <Bar name="재고평가손" dataKey="재고평가손" fill="#fa5252" radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Finished Products Inventory Board */}
        <AppCard className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5 mb-1">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              완제품 기말 실소평가 충당 가이드
            </h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">
              수불대장 Q(기말), R(평가손), S(평가반영)를 동기화하여 완제품 시세 변동 및 결함 등의 불량 폐기 감액분을 장부에 최종 차감하여 보고서에 적용합니다.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 text-[10px]">
              <div className="flex justify-between font-mono">
                <span>감액반영 전 원자재:</span>
                <span className="font-semibold text-zinc-900">₩{endAmtSum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-mono text-rose-600 font-bold">
                <span>평가손 차감액 (-):</span>
                <span>₩{totalValuationLoss.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-mono text-emerald-700 font-bold border-t border-dashed border-zinc-200 pt-1.5">
                <span>순실현가능 장부금액:</span>
                <span>₩{(endAmtSum - totalValuationLoss).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-zinc-400 mt-2">
            *주의: 탄산리튬을 제외한 다른 메탈류는 원 수량이 곧 환산 수량입니다.
          </p>
        </AppCard>
      </div>

      {/* Finished Product Storage List */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-1.5 h-3.5 bg-teal-600 rounded"></span>
          <h3 className="text-xs font-bold text-zinc-800">1. 완제품 기말 재고 관리대장 (제품수불부 연동)</h3>
        </div>
        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">완제품명</th>
                <th className="px-5 py-3 text-center">연동 메탈</th>
                <th className="px-5 py-3 text-right">기말재고 수량</th>
                <th className="px-5 py-3 text-right">보정 환산 수량</th>
                <th className="px-5 py-3 text-right">기말재고 금액</th>
                <th className="px-5 py-3 text-right">기말 단가 (/Mt)</th>
                <th className="px-5 py-3 text-right text-rose-600">재고평가손</th>
                <th className="px-5 py-3 text-right text-teal-800">평가손반영액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {productAggList.map((row) => {
                const avgPrice = row.endingQty > 0 ? Math.round(row.endingAmt / row.endingQty) : 0;
                return (
                  <tr key={row.productName} className="hover:bg-[#f7f9f7]/55">
                    <td className="px-5 py-3.5 font-bold text-zinc-900">
                      {row.productName}
                      {row.productName === '탄산리튬' && (
                        <span className="ml-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">Li 보정형</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-zinc-500 font-mono">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px]">{row.metal}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-zinc-800 font-bold">{row.endingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt</td>
                    <td className="px-5 py-3.5 text-right font-mono text-indigo-800 font-bold bg-indigo-50/5">{row.convertedEndingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt</td>
                    <td className="px-5 py-3.5 text-right font-mono text-zinc-900">₩{row.endingAmt.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-zinc-500">₩{avgPrice.toLocaleString()}/Mt</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-rose-600 bg-rose-50/5">₩{row.valuationLoss.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#008f83] bg-[#f0f9f8]/10">₩{row.valuationApplied.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Material Inventory Log */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded"></span>
            <h3 className="text-xs font-bold text-zinc-800">2. 원료 및 원자재 창고 수불대장 (원자재수불부 연동)</h3>
          </div>
          
          <select
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="text-[11px] p-1 bg-white border border-[#dde5de] rounded-lg focus:outline-none w-48"
          >
            <option value="all">전체 자재 품종 [All]</option>
            {rawMaterialUniqueNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">입고 원료 자재명</th>
                <th className="px-5 py-3 text-center">자재 단위</th>
                <th className="px-5 py-3 text-right">기초 재고량</th>
                <th className="px-5 py-3 text-right text-emerald-800 font-bold">당기 총입고수량</th>
                <th className="px-5 py-3 text-right text-rose-700 font-bold">당기 총출고수량</th>
                <th className="px-5 py-3 text-right font-extrabold font-mono text-zinc-900">당기 기말재고량</th>
                <th className="px-5 py-3 text-center">창고 검정상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {rawAggList.map((row) => (
                <tr key={row.materialName} className="hover:bg-[#f7f9f7]/55">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{row.materialName}</td>
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-zinc-500">{row.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-zinc-550">{row.beginningQty.toLocaleString()} {row.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-emerald-700 font-semibold">{row.receiptQty.toLocaleString()} {row.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-rose-600 font-semibold">{row.issueQty.toLocaleString()} {row.unit}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-indigo-900 bg-indigo-50/5">
                    {row.endingQty.toLocaleString()} {row.unit}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-emerald-700 rounded-full text-[10px] font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 수불검수합격
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
