import React, { useState, useEffect } from 'react';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { MetalMarketPriceStorage, MetalMarketPriceSet, DEFAULT_RECOVERY_RATES } from '../lib/operation/metalMarketPriceStorage';
import { Save, Settings, DollarSign, Sliders, Layers, RefreshCw, CheckCircle } from 'lucide-react';
import { BOM_TEMPLATE_V1 } from '../lib/operation/bomTemplate';

export default function OperationSettings() {
  const [activeTab, setActiveTab] = useState<'metal_prices' | 'blend_criteria' | 'bom_defaults'>('metal_prices');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<number>(5);

  // Metal Prices State
  const [niPrice, setNiPrice] = useState<string>('0');
  const [coPrice, setCoPrice] = useState<string>('0');
  const [lcPrice, setLcPrice] = useState<string>('0');
  const [mnPrice, setMnPrice] = useState<string>('0');
  const [cuPrice, setCuPrice] = useState<string>('0');

  const [niRecovery, setNiRecovery] = useState<string>('98.0');
  const [coRecovery, setCoRecovery] = useState<string>('97.0');
  const [lcRecovery, setLcRecovery] = useState<string>('92.0');
  const [mnRecovery, setMnRecovery] = useState<string>('69.0');
  const [cuRecovery, setCuRecovery] = useState<string>('89.0');

  const [priceSource, setPriceSource] = useState<string>('LME / Fastmarkets');
  const [priceNote, setPriceNote] = useState<string>('');

  const loadMonthPrices = () => {
    const existing = MetalMarketPriceStorage.getMarketPriceForMonth(selectedYear, selectedMonth);
    if (existing) {
      setNiPrice(existing.values.NI !== undefined ? String(existing.values.NI) : '0');
      setCoPrice(existing.values.CO !== undefined ? String(existing.values.CO) : '0');
      setLcPrice(existing.values.LC !== undefined ? String(existing.values.LC) : '0');
      setMnPrice(existing.values.MN !== undefined ? String(existing.values.MN) : '0');
      setCuPrice(existing.values.CU !== undefined ? String(existing.values.CU) : '0');

      setNiRecovery(existing.recoveryRates?.NI !== undefined ? String(existing.recoveryRates.NI) : '98.0');
      setCoRecovery(existing.recoveryRates?.CO !== undefined ? String(existing.recoveryRates.CO) : '97.0');
      setLcRecovery(existing.recoveryRates?.LC !== undefined ? String(existing.recoveryRates.LC) : '92.0');
      setMnRecovery(existing.recoveryRates?.MN !== undefined ? String(existing.recoveryRates.MN) : '69.0');
      setCuRecovery(existing.recoveryRates?.CU !== undefined ? String(existing.recoveryRates.CU) : '89.0');

      setPriceSource(existing.source || 'LME / Fastmarkets');
      setPriceNote(existing.note || '');
    } else {
      setNiPrice('0');
      setCoPrice('0');
      setLcPrice('0');
      setMnPrice('0');
      setCuPrice('0');

      setNiRecovery('98.0');
      setCoRecovery('97.0');
      setLcRecovery('92.0');
      setMnRecovery('69.0');
      setCuRecovery('89.0');

      setPriceSource('LME / Fastmarkets');
      setPriceNote('');
    }
  };

  useEffect(() => {
    loadMonthPrices();
  }, [selectedYear, selectedMonth]);

  const handleSaveMetalPrices = () => {
    const parseFloatVal = (val: string, fallback = 0) => {
      const p = parseFloat(val);
      return isNaN(p) ? fallback : p;
    };

    const priceSet: MetalMarketPriceSet = {
      year: selectedYear,
      month: selectedMonth,
      values: {
        NI: parseFloatVal(niPrice),
        CO: parseFloatVal(coPrice),
        LC: parseFloatVal(lcPrice),
        MN: parseFloatVal(mnPrice),
        CU: parseFloatVal(cuPrice)
      },
      recoveryRates: {
        NI: parseFloatVal(niRecovery, 98.0),
        CO: parseFloatVal(coRecovery, 97.0),
        LC: parseFloatVal(lcRecovery, 92.0),
        MN: parseFloatVal(mnRecovery, 69.0),
        CU: parseFloatVal(cuRecovery, 89.0)
      },
      source: priceSource,
      note: priceNote,
      updatedAt: new Date().toISOString()
    };

    MetalMarketPriceStorage.saveMarketPriceForMonth(priceSet);
    alert(`[완료] ${selectedYear}년 ${selectedMonth}월 금속 시세 및 회수율 설정이 저장되었습니다.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-bold font-mono">6단계. 운영 모듈</span>
          <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded font-bold">운영 모듈 설정</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5">
          운영 모듈 마스터 설정
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          금속시세 마스터, 배합 적정범위 기준, BOM 원단위 Matrix 표준 템플릿을 관리합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e8eb] p-1 bg-white rounded-xl gap-2 shadow-xs">
        {[
          { key: 'metal_prices', label: '금속 시세 설정', icon: DollarSign },
          { key: 'blend_criteria', label: '배합 기준 범위', icon: Sliders },
          { key: 'bom_defaults', label: 'BOM 표준 Matrix', icon: Layers }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'metal_prices' && (
        <div className="space-y-4">
          <AppCard className="p-5 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-bold text-slate-800">월별 금속 시세 및 회수율 설정</h3>
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded font-medium bg-white"
                  >
                    <option value="2026">2026년</option>
                    <option value="2025">2025년</option>
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="px-2.5 py-1.5 border border-slate-300 rounded font-medium bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
              </div>
              <AppButton onClick={handleSaveMetalPrices} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                <Save className="w-3.5 h-3.5 mr-1" />
                시세 설정 저장
              </AppButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                    <th className="p-2.5">금속 품목</th>
                    <th className="p-2.5 text-right">시세 (USD / t)</th>
                    <th className="p-2.5 text-right">기본 회수율 (%)</th>
                    <th className="p-2.5">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { key: 'NI', label: '니켈 (Ni)', price: niPrice, setPrice: setNiPrice, rec: niRecovery, setRec: setNiRecovery, defaultRec: '98.0%' },
                    { key: 'CO', label: '코발트 (Co)', price: coPrice, setPrice: setCoPrice, rec: coRecovery, setRec: setCoRecovery, defaultRec: '97.0%' },
                    { key: 'LC', label: '탄산리튬 (LC)', price: lcPrice, setPrice: setLcPrice, rec: lcRecovery, setRec: setLcRecovery, defaultRec: '92.0%' },
                    { key: 'MN', label: '망간 (Mn)', price: mnPrice, setPrice: setMnPrice, rec: mnRecovery, setRec: setMnRecovery, defaultRec: '69.0%' },
                    { key: 'CU', label: '구리 (Cu)', price: cuPrice, setPrice: setCuPrice, rec: cuRecovery, setRec: setCuRecovery, defaultRec: '89.0%' },
                  ].map(row => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{row.label}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="text"
                          value={row.price}
                          onChange={e => row.setPrice(e.target.value)}
                          className="w-32 text-right px-2 py-1 border border-slate-300 rounded font-mono font-bold text-slate-900"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            value={row.rec}
                            onChange={e => row.setRec(e.target.value)}
                            className="w-20 text-right px-2 py-1 border border-slate-300 rounded font-mono font-bold text-emerald-700"
                          />
                          <span className="text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">
                        표준 회수율 {row.defaultRec}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">시세 출처</label>
                <input
                  type="text"
                  value={priceSource}
                  onChange={e => setPriceSource(e.target.value)}
                  placeholder="예: LME, Fastmarkets, Shanghai Metals Market"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">비고 / 메모</label>
                <input
                  type="text"
                  value={priceNote}
                  onChange={e => setPriceNote(e.target.value)}
                  placeholder="특이사항 기록"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          </AppCard>
        </div>
      )}

      {activeTab === 'blend_criteria' && (
        <AppCard className="p-5 bg-white border border-slate-200 text-xs">
          <h3 className="font-bold text-slate-800 text-sm mb-2">배합 조성 목표 범위 (시스템 표준)</h3>
          <p className="text-slate-500 mb-4">
            배합테스터에서 평가하는 주요 금속별 적정 함량 범위 기준입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <th className="p-2.5">금속</th>
                  <th className="p-2.5 text-right font-mono">최저 기준 (%)</th>
                  <th className="p-2.5 text-right font-mono">최고 기준 (%)</th>
                  <th className="p-2.5">상태 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr><td className="p-2.5 font-bold">Ni (니켈)</td><td className="p-2.5 text-right font-mono">23.0%</td><td className="p-2.5 text-right font-mono">26.0%</td><td className="p-2.5 text-emerald-600">적정</td></tr>
                <tr><td className="p-2.5 font-bold">Co (코발트)</td><td className="p-2.5 text-right font-mono">7.0%</td><td className="p-2.5 text-right font-mono">8.0%</td><td className="p-2.5 text-emerald-600">적정</td></tr>
                <tr><td className="p-2.5 font-bold">LC (탄산리튬)</td><td className="p-2.5 text-right font-mono">4.6%</td><td className="p-2.5 text-right font-mono">5.2%</td><td className="p-2.5 text-emerald-600">적정</td></tr>
                <tr><td className="p-2.5 font-bold">Mn (망간)</td><td className="p-2.5 text-right font-mono">8.0%</td><td className="p-2.5 text-right font-mono">9.2%</td><td className="p-2.5 text-emerald-600">적정</td></tr>
                <tr><td className="p-2.5 font-bold">Cu (구리)</td><td className="p-2.5 text-right font-mono">0.9%</td><td className="p-2.5 text-right font-mono">1.1%</td><td className="p-2.5 text-emerald-600">적정</td></tr>
              </tbody>
            </table>
          </div>
        </AppCard>
      )}

      {activeTab === 'bom_defaults' && (
        <AppCard className="p-5 bg-white border border-slate-200 text-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">BOM 표준 Matrix 템플릿 (BOM_TEMPLATE_V1)</h3>
              <p className="text-slate-500">
                원재료/부재료/조업재료/유틸리티 기본 원단위 계수 매트릭스입니다. (적용값 없음: '-', 적용대상 0: '0.00')
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <th className="p-2">구분</th>
                  <th className="p-2">부원료명</th>
                  <th className="p-2 text-right">Ni</th>
                  <th className="p-2 text-right">Co</th>
                  <th className="p-2 text-right">LC</th>
                  <th className="p-2 text-right">Mn</th>
                  <th className="p-2 text-right">Cu</th>
                  <th className="p-2">단위</th>
                  <th className="p-2 text-right">기본 단가 (원)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {BOM_TEMPLATE_V1.map((item) => {
                  const fmt = (val: number | undefined) => (val !== undefined ? val.toFixed(4) : '-');
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2 font-semibold text-slate-600">{item.category}</td>
                      <td className="p-2 font-bold text-slate-900">{item.itemName}</td>
                      <td className="p-2 text-right font-mono">{fmt(item.coefficients?.NI)}</td>
                      <td className="p-2 text-right font-mono">{fmt(item.coefficients?.CO)}</td>
                      <td className="p-2 text-right font-mono">{fmt(item.coefficients?.LC)}</td>
                      <td className="p-2 text-right font-mono">{fmt(item.coefficients?.MN)}</td>
                      <td className="p-2 text-right font-mono">{fmt(item.coefficients?.CU)}</td>
                      <td className="p-2 text-slate-500">{item.unit}</td>
                      <td className="p-2 text-right font-mono font-bold">₩{(item.unitPrice || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AppCard>
      )}
    </div>
  );
}
