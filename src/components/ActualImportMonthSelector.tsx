import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check } from 'lucide-react';
import {
  ALL_ACTUAL_IMPORT_MONTHS,
  formatSelectedMonths,
  normalizeSelectedMonths,
  readSelectedActualImportMonths,
  writeSelectedActualImportMonths,
} from '../lib/actualImportMonthSelection';

export default function ActualImportMonthSelector() {
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => readSelectedActualImportMonths());

  useEffect(() => {
    writeSelectedActualImportMonths(selectedMonths);
  }, [selectedMonths]);

  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);

  const toggleMonth = (month: number) => {
    setSelectedMonths(previous => normalizeSelectedMonths(
      previous.includes(month)
        ? previous.filter(value => value !== month)
        : [...previous, month],
    ));
  };

  const selectThroughCurrentMonth = () => {
    const currentMonth = new Date().getMonth() + 1;
    setSelectedMonths(ALL_ACTUAL_IMPORT_MONTHS.filter(month => month <= currentMonth));
  };

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
            <CalendarRange className="h-4 w-4 text-blue-600" />
            실적 업로드 월 선택
          </div>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            선택한 월의 실적만 가져옵니다. 선택하지 않은 월의 기존 실적은 삭제하거나 변경하지 않습니다.
            경영계획·RP 업로드에는 이 설정이 적용되지 않습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonths([...ALL_ACTUAL_IMPORT_MONTHS])}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={selectThroughCurrentMonth}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            1월~현재월
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonths([])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            선택 해제
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
        {ALL_ACTUAL_IMPORT_MONTHS.map(month => {
          const active = selectedSet.has(month);
          return (
            <button
              key={month}
              type="button"
              aria-pressed={active}
              onClick={() => toggleMonth(month)}
              className={[
                'flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                active
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50',
              ].join(' ')}
            >
              {active && <Check className="h-3 w-3" />}
              {month}월
            </button>
          );
        })}
      </div>

      <div className={[
        'mt-3 rounded-lg px-3 py-2 text-xs font-semibold',
        selectedMonths.length > 0
          ? 'bg-white text-blue-800'
          : 'border border-red-200 bg-red-50 text-red-700',
      ].join(' ')}>
        가져올 월: {formatSelectedMonths(selectedMonths)}
        {selectedMonths.length === 0 && ' — 실적 파일을 올리기 전에 한 개 이상의 월을 선택해야 합니다.'}
      </div>
    </section>
  );
}
