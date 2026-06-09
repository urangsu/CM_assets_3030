import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Info,
  ShieldCheck,
  TrendingUp,
  PackageCheck,
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
  Legend 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { OperationStorage, ProductLedgerRecord, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import { ExchangeRateStorage } from '../lib/operation/exchangeRateStorage';

export default function RawMaterialStatus() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('all'); // 'all' or '1'~'12'
  const [currencyMode, setCurrencyMode] = useState<'KRW' | 'USD'>('KRW');
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
    window.addEventListener('operation-ledger-changed', loadData);
    return () => {
      window.removeEventListener('operation-ledger-changed', loadData);
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

  // Convert Monetary values
  const getExchangeRate = (mNum?: number) => {
    const month = mNum || (activeMonth === 'all' ? 5 : Number(activeMonth));
    return ExchangeRateStorage.getRate(activeYear, month);
  };

  const convertAmount = (krwVal: number, mNum?: number) => {
    if (currencyMode === 'USD') {
      return krwVal / getExchangeRate(mNum);
    }
    return krwVal;
  };

  const formatCurrency = (val: number) => {
    if (currencyMode === 'USD') {
      return `$${Math.round(val).toLocaleString()}`;
    }
    return `₩${Math.round(val / 1_000_000).toLocaleString()}M`;
  };

  // --- Filtering Completed ---
  const qtyProducts = realProducts.filter(r => r.unit === '수량');
  const amtProducts = realProducts.filter(r => r.unit === '금액');

  const filteredQtyProducts = qtyProducts.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredRawMaterials = realMaterials.filter(r => {
    if (activeMonth !== 'all' && Number(r.month) !== Number(activeMonth)) return false;
    if (filterMaterial !== 'all' && r.rawMaterialName !== filterMaterial) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return r.rawMaterialName.toLowerCase().includes(q);
    }
    return true;
  });

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
    endingQty: number;          // endingInventory column
    convertedEndingQty: number; // convertedEndingInventory column
    endingAmt: number;          // endingInventory 금액 column
    valuationLoss: number;      // inventoryValuationLoss column
    valuationApplied: number;   // valuationApplied column
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

  filteredQtyProducts.forEach(qRec => {
    const existing = productAggregatesMap.get(qRec.productName);
    if (existing) {
      existing.endingQty += qRec.endingInventory || 0;
      existing.convertedEndingQty += qRec.convertedEndingInventory || qRec.endingInventory || 0;

      const matchingAmt = amtProducts.find(a => a.productName === qRec.productName && Number(a.month) === Number(qRec.month));
      if (matchingAmt) {
        existing.endingAmt += matchingAmt.endingInventory || 0;
        existing.valuationLoss += matchingAmt.inventoryValuationLoss || 0;
        existing.valuationApplied += matchingAmt.valuationApplied || 0;
      }
    }
  });

  const productAggList = Array.from(productAggregatesMap.values());

  const endQtySum = productAggList.reduce((acc, item) => acc + item.endingQty, 0);
  const endConvertedQtySum = productAggList.reduce((acc, item) => acc + item.convertedEndingQty, 0);
  const endAmtSum = productAggList.reduce((acc, item) => acc + item.endingAmt, 0);
  const totalValuationLoss = productAggList.reduce((acc, item) => acc + item.valuationLoss, 0);
  const totalValuationApplied = productAggList.reduce((acc, item) => acc + item.valuationApplied, 0);

  // Raw Materials Group aggregates
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

  const chartData = productAggList.map(item => ({
    name: item.productName,
    '기말재고 평가액': convertAmount(item.endingAmt),
    '재고평가손': convertAmount(item.valuationLoss)
  }));

  return (
    <div className="space-y-6 animate-fade">
      {/* Simulation Alert */}
      {isSampleData && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ RUNNING SAMPLE (재고 샘플 모드)</p>
              <p className="text-[#647067] mt-0.5">
                현재 업로드된 원자재 및 제품 수불 정보가 없는 경우 정량 규명 모형 데이터가 출력됩니다. 실물 정산을 위해 운영 업로드 탭을 이용하십시오.
              </p>
            </div>
          </div>
          <AppButton 
            onClick={() => navigate('/operation-upload')}
            className="text-xs bg-amber-500 text-white hover:bg-amber-600 font-bold border-0"
          >
            운영 수불부 업로드로 이동
          </AppButton>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">수불 장부 연계</span>
          </div>
          <h2 className="text-[20px] font-bold text-zinc-900 leading-tight mt-1">원자재 수불 현황</h2>
          <p className="text-xs text-zinc-500 mt-1">
            원자재수불부와 제품수불부 원장을 동시 연동하여 원료 처분, 기말 폐기 감량, 평가실손 충당을 가늠하는 자본 정량 관리 계기판입니다.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Currency Switcher */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setCurrencyMode('KRW')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'KRW' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'
              }`}
            >
              원화 보기
            </button>
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                currencyMode === 'USD' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-500'
              }`}
            >
              달러 보기
            </button>
          </div>

          {/* Time Picker */}
          <div className="flex items-center bg-[#f8f9fa] border border-zinc-150 p-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-zinc-400 mr-1.5" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                <option key={yr} value={yr}>{yr}년</option>
              ))}
            </select>
            <span className="text-zinc-300 mx-1">|</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-zinc-700"
            >
              <option value="all">연간 전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-[#647067] font-bold block">완제품 기말재고 합량</span>
          <span className="text-base font-bold text-zinc-900 mt-1 block font-mono">
            {endQtySum.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-white border border-[#dde5de] p-4.5 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-[#008f83] font-bold block">보정 환산 기말합량</span>
          <span className="text-base font-bold text-teal-800 mt-1 block font-mono">
            {endConvertedQtySum.toLocaleString()} Mt
          </span>
        </div>
        <div className="bg-[#fcfdfc] border border-[#dde5de] p-4.5 rounded-xl text-center shadow-sm">
          <span className="text-[10px] text-zinc-600 font-bold block">기말 재고가치액</span>
          <span className="text-base font-bold text-[#111111] mt-1 block font-mono">
            {formatCurrency(convertAmount(endAmtSum))}
          </span>
        </div>
        <div className="bg-rose-50/30 border border-rose-150 p-4.5 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-rose-700 font-bold block">총 재고평가손 (-)</span>
          <span className="text-base font-bold text-rose-700 mt-1 block font-mono">
            {formatCurrency(convertAmount(totalValuationLoss))}
          </span>
        </div>
        <div className="bg-emerald-50/30 border border-teal-150 p-4.5 rounded-xl text-center shadow-xs">
          <span className="text-[10px] text-[#008f83] font-bold block">당기 평가손반영액</span>
          <span className="text-base font-bold text-emerald-850 mt-1 block font-mono">
            {formatCurrency(convertAmount(totalValuationApplied))}
          </span>
        </div>
      </div>

      {/* Recharts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-[#dde5de] shadow-xs lg:col-span-2">
          <h3 className="text-xs font-bold text-zinc-805 mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-650" />
            완제품별 기말 재고 평가액 및 평가손 차트
          </h3>
          <div className="h-[210px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ec" />
                <XAxis dataKey="name" stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#8b95a1" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${Math.round(Number(v)).toLocaleString()}`, '']} />
                <Legend iconType="circle" />
                <Bar name="재고가격 가치" dataKey="기말재고 평가액" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={22} />
                <Bar name="재고평가손실" dataKey="재고평가손" fill="#f87171" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ledger Guide Card */}
        <AppCard className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#111111] mb-2 flex items-center gap-1.5">
              <PackageCheck className="w-4.5 h-4.5 text-emerald-600" />
              재고평가손 장부 조정가 산식
            </h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
              공장 제품기말 수부에서 최종 발생한 감량 손상분을 가중하여 차감 보정 가격을 장부에 대입합니다. 달러 환산 시 연동 고시 환율을 기준으로 자동 환전합니다.
            </p>
            <div className="mt-2 p-3 bg-[#f8f9fa] border border-zinc-150 rounded-xl text-[10px] font-mono space-y-1.5 text-zinc-700">
              <div className="flex justify-between">
                <span>기말재고 정상평가:</span>
                <span>{formatCurrency(convertAmount(endAmtSum))}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold">
                <span>평가실소 차감금액:</span>
                <span>-{formatCurrency(convertAmount(totalValuationLoss))}</span>
              </div>
              <div className="flex justify-between text-teal-800 font-extrabold border-t border-[#dde5de] pt-1.5">
                <span>정산가 조정 후 잔액:</span>
                <span>{formatCurrency(convertAmount(endAmtSum - totalValuationLoss))}</span>
              </div>
            </div>
          </div>
          <span className="text-[9px] text-[#8b95a1] pt-3 block border-t border-[#e5e8eb]">
            기준 환율: 1 USD = {getExchangeRate().toLocaleString()} KRW
          </span>
        </AppCard>
      </div>

      {/* Finished Product Grid Detailed Section */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-3.5 bg-indigo-600 rounded"></span>
          <h3 className="text-xs font-bold text-zinc-800">1. 완제품 기말재고 수불대장</h3>
        </div>
        
        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">완제품명구분</th>
                <th className="px-5 py-3.5 text-center">연동메탈</th>
                <th className="px-5 py-3.5 text-right">기말재고 수량</th>
                <th className="px-5 py-3.5 text-right">보정 환산 재고량</th>
                <th className="px-5 py-3.5 text-right">기말재고 금액</th>
                <th className="px-5 py-3.5 text-right">평균 기말단가 / Mt</th>
                <th className="px-5 py-3.5 text-right text-rose-600">재고평가손</th>
                <th className="px-5 py-3.5 text-right text-emerald-800">평가손반영액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {productAggList.map(item => {
                const displayAmt = convertAmount(item.endingAmt);
                const displayLoss = convertAmount(item.valuationLoss);
                const displayApplied = convertAmount(item.valuationApplied);
                const avgPrice = item.endingQty > 0 ? (displayAmt / item.endingQty) : 0;

                return (
                  <tr key={item.productName} className="hover:bg-[#f7f9f7]/55 font-mono">
                    <td className="px-5 py-3.5 font-bold font-sans text-zinc-900">{item.productName}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-zinc-400">
                      <span className="bg-slate-100 text-zinc-650 text-[10px] px-2 py-0.5 rounded font-mono">{item.metal}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-900 font-bold">{item.endingQty.toLocaleString()} Mt</td>
                    <td className="px-5 py-3.5 text-right text-indigo-850 font-extrabold bg-indigo-50/5">{item.convertedEndingQty.toLocaleString()} Mt</td>
                    <td className="px-5 py-3.5 text-right text-zinc-800">{formatCurrency(displayAmt)}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-550">{formatCurrency(avgPrice)}/Mt</td>
                    <td className="px-5 py-3.5 text-right text-rose-600 font-semibold">-{formatCurrency(displayLoss)}</td>
                    <td className="px-5 py-3.5 text-right text-[#008f83] font-semibold">{formatCurrency(displayApplied)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Material Inventory Section */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded"></span>
            <h3 className="text-xs font-bold text-zinc-800">2. 원자재수불부 연계 원료 창고대장</h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 text-[11px]">검색:</span>
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="text-[11px] p-1.5 bg-white border border-[#dde5de] rounded-xl focus:outline-none w-48"
            >
              <option value="all">전체 자재 품종 [All]</option>
              {rawMaterialUniqueNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-[#dde5de] rounded-2xl shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-[#eef2ec] text-left">
            <thead className="bg-[#f7f9f7] text-[10px] text-[#647067] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">원자재 품종 등급</th>
                <th className="px-5 py-3.5 text-center">자재 단위</th>
                <th className="px-5 py-3.5 text-right">기초 재고수량</th>
                <th className="px-5 py-3.5 text-right text-teal-800">총 입고량</th>
                <th className="px-5 py-3.5 text-right text-rose-600">총 불출소요량</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-indigo-900 bg-indigo-50/5">당기 기말실효값</th>
                <th className="px-5 py-3.5 text-center">대장상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2ec] bg-white text-xs">
              {rawAggList.map(item => (
                <tr key={item.materialName} className="hover:bg-[#f7f9f7]/55 font-mono">
                  <td className="px-5 py-3.5 font-sans font-semibold text-zinc-900">{item.materialName}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-zinc-400">{item.unit}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-550">{item.beginningQty.toLocaleString()} {item.unit}</td>
                  <td className="px-5 py-3.5 text-right text-teal-805">{item.receiptQty.toLocaleString()} {item.unit}</td>
                  <td className="px-5 py-3.5 text-right text-rose-605">{item.issueQty.toLocaleString()} {item.unit}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-indigo-950 bg-indigo-50/10">
                    {item.endingQty.toLocaleString()} {item.unit}
                  </td>
                  <td className="px-5 py-3.5 text-center font-sans">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 text-emerald-800 rounded-full text-[10px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 수불검수필
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
