import React, { useState, useEffect } from 'react';
import { X, Save, Clock, HelpCircle, CheckCircle, AlertOctagon, CornerDownRight, Landmark } from 'lucide-react';

export interface ReviewItem {
  id: string; // e.g., dept_account_month or row index
  deptCode: string;
  deptName: string;
  accountCode: string;
  accountName: string;
  month?: string;
  budgetAmount: number;
  actualAmount: number;
  differenceAmount: number;
  burnRate: number;
  anomalyType: 'OVERRUN' | 'UNDERRUN' | 'UNBUDGETED' | 'NORMAL';
}

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReviewItem | null;
  onSave?: () => void;
}

interface SavedReviewState {
  note: string;
  status: 'DRAFT' | 'ACTION_REQ' | 'APPROVED' | 'REJECTED' | 'HELD';
  history: Array<{
    date: string;
    action: string;
    note: string;
  }>;
}

export default function ReviewDrawer({ isOpen, onClose, item, onSave }: ReviewDrawerProps) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTION_REQ' | 'APPROVED' | 'REJECTED' | 'HELD'>('DRAFT');
  const [history, setHistory] = useState<any[]>([]);

  // Load persistence for this specific review item
  useEffect(() => {
    if (!item) return;
    const allReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    const savedState = allReviews[item.id] as SavedReviewState | undefined;

    if (savedState) {
      setNote(savedState.note || '');
      setStatus(savedState.status || 'DRAFT');
      setHistory(savedState.history || []);
    } else {
      setNote('');
      setStatus('DRAFT');
      setHistory([]);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const saveState = (newStatus: 'DRAFT' | 'ACTION_REQ' | 'APPROVED' | 'REJECTED' | 'HELD', actionLabel: string, comment: string) => {
    const allReviews = JSON.parse(localStorage.getItem('hycm_review_items') || '{}');
    
    const timestamp = new Date().toLocaleString();
    const newHistoryEntry = {
      date: timestamp,
      action: actionLabel,
      note: comment || '메모 없이 조치됨.'
    };

    const nextHistory = [...history, newHistoryEntry];
    const newState: SavedReviewState = {
      note: comment,
      status: newStatus,
      history: nextHistory
    };

    allReviews[item.id] = newState;
    localStorage.setItem('hycm_review_items', JSON.stringify(allReviews));

    setHistory(nextHistory);
    setStatus(newStatus);
    setNote(comment);

    if (onSave) {
      onSave(); // let parent view re-recompute or refresh
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'ACTION_REQ':
        return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold font-sans">조치 요청</span>;
      case 'APPROVED':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold font-sans">승인</span>;
      case 'REJECTED':
        return <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold font-sans font-mono">반려</span>;
      case 'HELD':
        return <span className="bg-zinc-100 text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-full text-xs font-bold font-sans">보류</span>;
      default:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold font-sans">작성중</span>;
    }
  };

  const getAnomalyTag = (type: string) => {
    switch (type) {
      case 'OVERRUN':
        return <span className="bg-amber-50 text-[#F7A059] border border-[#fbd6b4] px-2 py-0.5 rounded text-[11px] font-bold">초과</span>;
      case 'UNDERRUN':
        return <span className="bg-zinc-100 text-[#647067] border border-zinc-200 px-2 py-0.5 rounded text-[11px] font-bold">미달</span>;
      case 'UNBUDGETED':
        return <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">무예산</span>;
      default:
        return <span className="bg-emerald-50 text-[#008f83] border border-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold">정상</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#111111]/35 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#dde5de] z-10 animate-in slide-in-from-right duration-250">
        
        {/* Header */}
        <div className="p-6 border-b border-[#eef2ec] bg-[#f7f9f7] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest font-bold text-zinc-400 uppercase">검토</span>
              {getAnomalyTag(item.anomalyType)}
            </div>
            <h3 className="text-lg font-bold text-[#111111] mt-1">검토 의견</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main Info Box */}
          <div className="bg-[#fcfdfe] rounded-xl border border-[#dde5de] p-5 space-y-4">
            <h4 className="text-xs font-bold text-[#647067] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" /> 기본 정보
            </h4>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
              <div>
                <span className="text-zinc-400 font-sans block">부서명 (부서코드)</span>
                <span className="font-bold text-[#111111] mt-0.5 block">{item.deptName} <span className="text-zinc-400 font-mono text-[11px]">({item.deptCode})</span></span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans">계정코드 (계정명)</span>
                <span className="font-bold text-[#111111] mt-0.5 block">{item.accountName} <span className="text-zinc-400 font-mono text-[11px]">({item.accountCode})</span></span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans font-mono">통제 및 발생월</span>
                <span className="font-bold text-[#111111] mt-0.5 font-mono block">{item.month || '2026 회계연도 전체'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-sans">현재 결재 상태</span>
                <div className="mt-1">{getStatusBadge(status)}</div>
              </div>
            </div>
          </div>

          {/* Budget Numbers Contrast Grid */}
          <div>
            <h4 className="text-xs font-bold text-[#647067] uppercase tracking-wider mb-3">편성 예산 vs 실제 집행 대조표</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-center">
                <span className="block text-[10px] text-zinc-500 font-sans uppercase">편성 예산액</span>
                <span className="block text-sm font-bold text-[#111111] mt-1.5 font-mono">
                  {item.budgetAmount.toLocaleString()}원
                </span>
              </div>
              <div className="bg-[#f0f9f8] border border-teal-100 p-4 rounded-xl text-center">
                <span className="block text-[10px] text-[#008f83] font-sans uppercase">실제 집행 누계</span>
                <span className="block text-sm font-bold text-[#008f83] mt-1.5 font-mono">
                  {item.actualAmount.toLocaleString()}원
                </span>
              </div>
              <div className={`p-4 rounded-xl border text-center ${item.differenceAmount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-[#f8fcf8] border-emerald-100'}`}>
                <span className="block text-[10px] text-zinc-400 font-sans uppercase">초과/잔여 차액</span>
                <span className={`block text-sm font-bold mt-1.5 font-mono ${item.differenceAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {item.differenceAmount > 0 ? `+${item.differenceAmount.toLocaleString()}` : item.differenceAmount.toLocaleString()}원
                </span>
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-400 block font-sans mb-1.5">
                <span>예산 한도 소진율 (집행률)</span>
                <span className="font-bold font-mono text-zinc-900">{item.burnRate}%</span>
              </div>
              <div className="w-full bg-[#eef2ec] h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.burnRate >= 100 
                      ? 'bg-rose-500' 
                      : item.burnRate >= 80 
                      ? 'bg-amber-400' 
                      : 'bg-[#008f83]'
                  }`}
                  style={{ width: `${Math.min(item.burnRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Anomaly Review Form */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-[#647067] uppercase tracking-wider block">검토 의견</h4>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">메모</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full text-xs p-3.5 border border-[#dde5de] rounded-xl focus:border-teal-500 focus:outline-none placeholder-zinc-300 font-sans"
                placeholder="내용을 입력하세요."
              />
            </div>
          </div>

          {/* Audit Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#647067] uppercase tracking-wider block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 처리 이력
            </h4>
            {history.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">처리 이력이 없습니다.</p>
            ) : (
              <div className="space-y-3 border-l-2 border-[#eef2ec] pl-4 ml-1">
                {history.map((log, lIdx) => (
                  <div key={lIdx} className="relative text-xs">
                    <div className="absolute -left-[21px] mt-0.5 bg-teal-500 border-2 border-white w-2 h-2 rounded-full" />
                    <div className="flex justify-between text-[11px] text-zinc-400 font-mono mb-0.5">
                      <span>{log.date}</span>
                      <span className="font-bold text-teal-600">{log.action}</span>
                    </div>
                    <p className="text-zinc-600 leading-normal">{log.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#f7f9f7] border-t border-[#eef2ec] grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => saveState('ACTION_REQ', '조치 요청 통지', note)}
            className="px-3 py-2 bg-[#F7A059] hover:bg-[#e48f49] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center"
          >
            조치 요청
          </button>
          
          <button
            onClick={() => saveState('APPROVED', '조정안 최종 승인', note)}
            className="px-3 py-2 bg-[#008f83] hover:bg-[#007369] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center"
          >
            승인
          </button>

          <button
            onClick={() => saveState('REJECTED', '집행 일시 반려', note)}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center"
          >
            반려
          </button>

          <button
            onClick={() => saveState('HELD', '임시 보류 조치', note)}
            className="px-3 py-2 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center col-span-2 sm:col-span-1"
          >
            보류
          </button>
        </div>

      </div>
    </div>
  );
}
