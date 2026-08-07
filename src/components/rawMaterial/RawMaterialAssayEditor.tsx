import React, { useState, useEffect } from 'react';
import { RawMaterialAssay, RawMaterialAssayStorage } from '../../lib/operation/rawMaterialAssayStorage';
import { AppButton } from '../ui/AppButton';
import { Save, RefreshCw, ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  year: string;
  month: number;
  rawItemCode: string;
  rawItemName: string;
  onSaved?: () => void;
}

export function RawMaterialAssayEditor({ year, month, rawItemCode, rawItemName, onSaved }: Props) {
  const [assay, setAssay] = useState<RawMaterialAssay | null>(null);
  const [showImpurities, setShowImpurities] = useState(false);

  // Form state
  const [niPct, setNiPct] = useState<string>('');
  const [coPct, setCoPct] = useState<string>('');
  const [lcPct, setLcPct] = useState<string>('');
  const [mnPct, setMnPct] = useState<string>('');
  const [cuPct, setCuPct] = useState<string>('');

  const [alPct, setAlPct] = useState<string>('');
  const [fePct, setFePct] = useState<string>('');
  const [fPct, setFPct] = useState<string>('');
  const [pPct, setPPct] = useState<string>('');
  const [mgPct, setMgPct] = useState<string>('');
  const [caPct, setCaPct] = useState<string>('');
  const [kPct, setKPct] = useState<string>('');
  const [pbPct, setPbPct] = useState<string>('');
  const [dcPct, setDcPct] = useState<string>('');
  const [moisturePct, setMoisturePct] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const loadCurrentAssay = () => {
    const existing = RawMaterialAssayStorage.getAssay(year, month, rawItemCode);
    if (existing) {
      setAssay(existing);
      setNiPct(existing.majorMetals.niPct !== undefined ? String(existing.majorMetals.niPct) : '');
      setCoPct(existing.majorMetals.coPct !== undefined ? String(existing.majorMetals.coPct) : '');
      setLcPct(existing.majorMetals.lcPct !== undefined ? String(existing.majorMetals.lcPct) : '');
      setMnPct(existing.majorMetals.mnPct !== undefined ? String(existing.majorMetals.mnPct) : '');
      setCuPct(existing.majorMetals.cuPct !== undefined ? String(existing.majorMetals.cuPct) : '');

      setAlPct(existing.impurities.alPct !== undefined ? String(existing.impurities.alPct) : '');
      setFePct(existing.impurities.fePct !== undefined ? String(existing.impurities.fePct) : '');
      setFPct(existing.impurities.fPct !== undefined ? String(existing.impurities.fPct) : '');
      setPPct(existing.impurities.pPct !== undefined ? String(existing.impurities.pPct) : '');
      setMgPct(existing.impurities.mgPct !== undefined ? String(existing.impurities.mgPct) : '');
      setCaPct(existing.impurities.caPct !== undefined ? String(existing.impurities.caPct) : '');
      setKPct(existing.impurities.kPct !== undefined ? String(existing.impurities.kPct) : '');
      setPbPct(existing.impurities.pbPct !== undefined ? String(existing.impurities.pbPct) : '');
      setDcPct(existing.impurities.dcPct !== undefined ? String(existing.impurities.dcPct) : '');
      setMoisturePct(existing.impurities.moisturePct !== undefined ? String(existing.impurities.moisturePct) : '');
      setNote(existing.note || '');
    } else {
      setAssay(null);
      setNiPct(''); setCoPct(''); setLcPct(''); setMnPct(''); setCuPct('');
      setAlPct(''); setFePct(''); setFPct(''); setPPct(''); setMgPct('');
      setCaPct(''); setKPct(''); setPbPct(''); setDcPct(''); setMoisturePct('');
      setNote('');
    }
  };

  useEffect(() => {
    loadCurrentAssay();
  }, [year, month, rawItemCode]);

  const parseOrUndefined = (val: string): number | undefined => {
    if (val.trim() === '') return undefined;
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  };

  const handleSave = () => {
    const updated: RawMaterialAssay = {
      id: assay?.id || `assay_${year}_${month}_${rawItemCode}_${Date.now()}`,
      year,
      month,
      rawItemCode,
      majorMetals: {
        niPct: parseOrUndefined(niPct),
        coPct: parseOrUndefined(coPct),
        lcPct: parseOrUndefined(lcPct),
        mnPct: parseOrUndefined(mnPct),
        cuPct: parseOrUndefined(cuPct),
      },
      impurities: {
        alPct: parseOrUndefined(alPct),
        fePct: parseOrUndefined(fePct),
        fPct: parseOrUndefined(fPct),
        pPct: parseOrUndefined(pPct),
        mgPct: parseOrUndefined(mgPct),
        caPct: parseOrUndefined(caPct),
        kPct: parseOrUndefined(kPct),
        pbPct: parseOrUndefined(pbPct),
        dcPct: parseOrUndefined(dcPct),
        moisturePct: parseOrUndefined(moisturePct),
      },
      note: note.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    RawMaterialAssayStorage.saveAssay(updated);
    setAssay(updated);
    if (onSaved) onSaved();
  };

  const handleCopyPrevMonth = () => {
    if (month <= 1) {
      alert('1월은 전월 데이터가 존재하지 않습니다.');
      return;
    }
    const prevAssay = RawMaterialAssayStorage.getAssay(year, month - 1, rawItemCode);
    if (!prevAssay) {
      alert(`[안내] ${year}년 ${month - 1}월에 등록된 '${rawItemCode}' 성분 정보가 없습니다.`);
      return;
    }
    setNiPct(prevAssay.majorMetals.niPct !== undefined ? String(prevAssay.majorMetals.niPct) : '');
    setCoPct(prevAssay.majorMetals.coPct !== undefined ? String(prevAssay.majorMetals.coPct) : '');
    setLcPct(prevAssay.majorMetals.lcPct !== undefined ? String(prevAssay.majorMetals.lcPct) : '');
    setMnPct(prevAssay.majorMetals.mnPct !== undefined ? String(prevAssay.majorMetals.mnPct) : '');
    setCuPct(prevAssay.majorMetals.cuPct !== undefined ? String(prevAssay.majorMetals.cuPct) : '');

    setAlPct(prevAssay.impurities.alPct !== undefined ? String(prevAssay.impurities.alPct) : '');
    setFePct(prevAssay.impurities.fePct !== undefined ? String(prevAssay.impurities.fePct) : '');
    setFPct(prevAssay.impurities.fPct !== undefined ? String(prevAssay.impurities.fPct) : '');
    setPPct(prevAssay.impurities.pPct !== undefined ? String(prevAssay.impurities.pPct) : '');
    setMgPct(prevAssay.impurities.mgPct !== undefined ? String(prevAssay.impurities.mgPct) : '');
    setCaPct(prevAssay.impurities.caPct !== undefined ? String(prevAssay.impurities.caPct) : '');
    setKPct(prevAssay.impurities.kPct !== undefined ? String(prevAssay.impurities.kPct) : '');
    setPbPct(prevAssay.impurities.pbPct !== undefined ? String(prevAssay.impurities.pbPct) : '');
    setDcPct(prevAssay.impurities.dcPct !== undefined ? String(prevAssay.impurities.dcPct) : '');
    setMoisturePct(prevAssay.impurities.moisturePct !== undefined ? String(prevAssay.impurities.moisturePct) : '');
  };

  const handleCopyLatest = () => {
    const latest = RawMaterialAssayStorage.getLatestAssay(rawItemCode);
    if (!latest) {
      alert(`[안내] 등록된 '${rawItemCode}' 최신 성분 정보가 없습니다.`);
      return;
    }
    setNiPct(latest.majorMetals.niPct !== undefined ? String(latest.majorMetals.niPct) : '');
    setCoPct(latest.majorMetals.coPct !== undefined ? String(latest.majorMetals.coPct) : '');
    setLcPct(latest.majorMetals.lcPct !== undefined ? String(latest.majorMetals.lcPct) : '');
    setMnPct(latest.majorMetals.mnPct !== undefined ? String(latest.majorMetals.mnPct) : '');
    setCuPct(latest.majorMetals.cuPct !== undefined ? String(latest.majorMetals.cuPct) : '');

    setAlPct(latest.impurities.alPct !== undefined ? String(latest.impurities.alPct) : '');
    setFePct(latest.impurities.fePct !== undefined ? String(latest.impurities.fePct) : '');
    setFPct(latest.impurities.fPct !== undefined ? String(latest.impurities.fPct) : '');
    setPPct(latest.impurities.pPct !== undefined ? String(latest.impurities.pPct) : '');
    setMgPct(latest.impurities.mgPct !== undefined ? String(latest.impurities.mgPct) : '');
    setCaPct(latest.impurities.caPct !== undefined ? String(latest.impurities.caPct) : '');
    setKPct(latest.impurities.kPct !== undefined ? String(latest.impurities.kPct) : '');
    setPbPct(latest.impurities.pbPct !== undefined ? String(latest.impurities.pbPct) : '');
    setDcPct(latest.impurities.dcPct !== undefined ? String(latest.impurities.dcPct) : '');
    setMoisturePct(latest.impurities.moisturePct !== undefined ? String(latest.impurities.moisturePct) : '');
  };

  const isAssayEntered = niPct || coPct || lcPct || mnPct || cuPct;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2 text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">{rawItemName} ({rawItemCode}) 성분 상세 설정</span>
          {isAssayEntered ? (
            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
              <CheckCircle className="w-3 h-3 text-emerald-600" /> 성분입력 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
              <AlertTriangle className="w-3 h-3 text-amber-600" /> 성분 미등록
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyPrevMonth}
            className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-medium text-slate-700 transition"
          >
            전월 성분 가져오기
          </button>
          <button
            type="button"
            onClick={handleCopyLatest}
            className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-medium text-slate-700 transition"
          >
            최근 성분 가져오기
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 text-[11px] bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 transition flex items-center gap-1"
          >
            <Save className="w-3 h-3" /> 성분 저장
          </button>
        </div>
      </div>

      {/* 주요 금속 */}
      <div>
        <div className="font-semibold text-slate-700 mb-1.5">주요금속 (%)</div>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Ni (니켈)', val: niPct, set: setNiPct },
            { label: 'Co (코발트)', val: coPct, set: setCoPct },
            { label: 'LC (탄산리튬)', val: lcPct, set: setLcPct },
            { label: 'Mn (망간)', val: mnPct, set: setMnPct },
            { label: 'Cu (구리)', val: cuPct, set: setCuPct },
          ].map(m => (
            <div key={m.label} className="bg-white p-2 rounded border border-slate-200">
              <label className="block text-[11px] text-slate-500 mb-1 font-medium">{m.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={m.val}
                  onChange={e => m.set(e.target.value)}
                  placeholder="0.0"
                  className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-brand-500 font-mono text-xs font-bold"
                />
                <span className="text-slate-400 font-medium">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 기타성분 / 불순물 Accordion */}
      <div className="border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={() => setShowImpurities(!showImpurities)}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold text-xs py-1"
        >
          {showImpurities ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          ▶ 기타성분 / 불순물
        </button>

        {showImpurities && (
          <div className="grid grid-cols-5 gap-2 mt-2 bg-white p-3 rounded-lg border border-slate-200">
            {[
              { label: 'Al (알루미늄)', val: alPct, set: setAlPct },
              { label: 'Fe (철)', val: fePct, set: setFePct },
              { label: 'F (불소)', val: fPct, set: setFPct },
              { label: 'P (인)', val: pPct, set: setPPct },
              { label: 'Mg (마그네슘)', val: mgPct, set: setMgPct },
              { label: 'Ca (칼슘)', val: caPct, set: setCaPct },
              { label: 'K (칼륨)', val: kPct, set: setKPct },
              { label: 'Pb (납)', val: pbPct, set: setPbPct },
              { label: 'DC (Direct Cap)', val: dcPct, set: setDcPct },
              { label: '수분 (%)', val: moisturePct, set: setMoisturePct },
            ].map(imp => (
              <div key={imp.label} className="p-1.5">
                <label className="block text-[10px] text-slate-500 mb-0.5">{imp.label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={imp.val}
                    onChange={e => imp.set(e.target.value)}
                    placeholder="-"
                    className="w-full text-right px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                  />
                  <span className="text-slate-400 text-[10px]">%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
