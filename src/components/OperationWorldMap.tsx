import React from 'react';
import { MapPin, Globe, Loader2 } from 'lucide-react';

interface OperationMapPoint {
  id: string;
  countryCode: string;
  countryName: string;
  locationName: string;
  type: 'sales' | 'purchase' | 'both' | 'hq';
  salesQuantity: number;
  salesRevenue: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  products: string[];
  coords: { x: number; y: number };
}

interface OperationWorldMapProps {
  mapPoints: OperationMapPoint[];
  selectedLocation: OperationMapPoint | null;
  onSelectLocation: (pt: OperationMapPoint) => void;
  currencyMode: 'KRW' | 'USD';
  formatCurrencyAmount: (val: number, isKPI?: boolean) => string;
}

export function OperationWorldMap({
  mapPoints,
  selectedLocation,
  onSelectLocation,
  currencyMode,
  formatCurrencyAmount,
}: OperationWorldMapProps) {
  // Safe extraction of HQ for curved connector arcs
  const hqPoint = mapPoints.find((p) => p.type === 'hq' || p.countryCode === 'KR');

  return (
    <div className="relative w-full bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm flex flex-col justify-between p-4 group select-none">
      {/* Light Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(59,130,246,0.03),_transparent_65%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(99,102,241,0.02),_transparent_55%)] pointer-events-none" />

      {/* Map Header / Status HUD in Light Mode */}
      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10.5px] tracking-wider text-zinc-700 font-extrabold uppercase font-sans">
            HYCM SOURCING & SALES GLOBAL FLOW MAP
          </span>
        </div>
        <div className="flex gap-3 text-[10px] text-zinc-600 font-bold bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-200 shadow-2xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> HQ 광양/포항
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" /> 원료 공급처
          </span>
        </div>
      </div>

      {/* SVG Container - Light mode soft oceanic fill */}
      <div className="relative h-[300px] lg:h-[350px] w-full bg-[#f1f6fb] rounded-xl border border-zinc-200 overflow-hidden flex items-center justify-center">
        {/* Underlay Grid Gridline Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.035)_1px,_transparent_1px),_linear-gradient(90deg,_rgba(59,130,246,0.035)_1px,_transparent_1px)] bg-[size:18px_18px] opacity-80 pointer-events-none" />

        <svg
          viewBox="0 0 1000 420"
          className="absolute inset-0 w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle Equatorial dashed divider for geography HUD */}
          <line x1="0" y1="210" x2="1000" y2="210" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="5 5" opacity="0.4" />
          
          {/* World map Landmass collection styled with high-profile clean light theme */}
          <g className="fill-white stroke-slate-200 stroke-[0.8] hover:fill-slate-50 transition-colors duration-300">
            {/* North America */}
            <path d="M 80,40 L 95,35 L 120,40 L 140,25 L 160,28 L 195,35 L 210,50 L 220,45 L 250,55 L 275,30 L 290,45 L 270,70 L 260,95 L 290,115 L 285,130 L 250,155 L 225,175 L 212,185 L 200,165 L 175,155 L 150,150 L 145,130 L 130,110 L 105,95 L 85,90 Z" />
            
            {/* Greenland */}
            <path d="M 270,18 L 320,12 L 310,40 L 285,55 L 255,38 Z" />

            {/* Central America & Caribbean */}
            <path d="M 210,186 L 215,200 L 235,212 L 245,215 L 250,210 L 245,202 L 230,195 L 220,184 Z" />

            {/* South America */}
            <path d="M 235,220 L 270,225 L 295,245 L 315,275 L 325,300 L 305,335 L 280,365 L 260,385 L 248,395 L 245,395 L 246,380 L 252,350 L 250,330 L 242,305 L 235,280 L 230,245 Z" />

            {/* Africa */}
            <path d="M 445,170 L 485,155 L 520,165 L 538,185 L 565,192 L 575,210 L 582,235 L 578,255 L 560,278 L 545,315 L 530,345 L 518,345 L 512,310 L 498,280 L 478,250 L 460,240 L 440,230 L 418,212 L 410,195 Z" />
            <path d="M 586,280 L 595,285 L 592,305 L 585,310 L 580,295 Z" /> {/* Madagascar */}

            {/* Western Europe & Northern Europe */}
            <path d="M 405,115 L 420,105 L 435,78 L 450,75 L 460,65 L 452,50 L 475,48 L 490,68 L 485,90 L 470,105 L 462,125 L 450,140 L 435,165 L 410,165 L 398,150 Z" />
            <path d="M 410,60 L 425,55 L 430,70 L 415,75 Z" /> {/* UK & Ireland */}
            <path d="M 470,35 L 485,30 L 490,45 L 475,55 Z" /> {/* Scandinavia Peninsula */}

            {/* Russia / Eastern Asia / China / Middle East */}
            <path d="M 495,68 L 530,62 L 565,58 L 610,48 L 665,45 L 720,40 L 760,35 L 810,42 L 850,55 L 895,70 L 910,95 L 890,115 L 865,130 L 872,165 L 850,185 L 835,215 L 815,225 L 810,210 L 785,215 L 778,198 L 745,215 L 730,195 L 715,190 L 675,195 L 635,210 L 592,208 L 572,205 L 560,190 L 525,188 L 495,145 L 488,115 L 492,95 Z" />
            
            {/* Japan */}
            <path d="M 838,135 L 848,138 L 845,155 L 835,160 Q 830,140 838,135 Z" />

            {/* Indian Subcontinent */}
            <path d="M 678,196 L 702,194 L 708,215 L 696,225 L 685,210 Z" />

            {/* Southeast Asia & Indonesia Archipelago */}
            <path d="M 748,216 L 762,216 L 766,230 L 755,242 L 748,230 Z" /> {/* Indochina */}
            <path d="M 740,250 L 752,248 L 770,255 L 765,260 L 745,256 Z" /> {/* Sumatra */}
            <path d="M 770,260 L 795,258 L 790,268 L 765,268 Z" /> {/* Java */}
            <path d="M 780,242 L 795,240 L 798,252 L 785,255 Z" /> {/* Kalimantan/Borneo */}
            <path d="M 802,242 L 812,245 L 808,258 L 798,250 Z" /> {/* Sulawesi */}
            <path d="M 810,230 L 820,232 L 818,245 L 812,240 Z" /> {/* Philippines */}
            <path d="M 822,250 L 845,248 L 840,258 L 820,258 Z" /> {/* New Guinea */}

            {/* Australia & New Zealand */}
            <path d="M 785,285 L 830,285 L 860,305 L 855,335 L 830,350 L 795,335 L 780,312 Z" />
            <path d="M 870,345 L 880,355 L 872,370 L 865,360 Z" /> {/* NZ */}
          </g>

          {/* Sourcing Arcs toward HQ with precise light-theme gradients */}
          {hqPoint && (
            <g>
              <defs>
                <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {mapPoints.map((pt) => {
                if (pt.id === 'KR' || pt.type === 'hq') return null;

                const startX = pt.coords.x * 10;
                const startY = pt.coords.y * 4.2;
                const endX = hqPoint.coords.x * 10;
                const endY = hqPoint.coords.y * 4.2;

                // Curved control points
                const dx = endX - startX;
                const dy = endY - startY;
                const cx = (startX + endX) / 2 - dy * 0.18;
                const cy = (startY + endY) / 2 - Math.abs(dx) * 0.18;

                const pathString = `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;

                return (
                  <g key={`flow_arc_${pt.id}`}>
                    {/* Faint static light track */}
                    <path
                      d={pathString}
                      fill="none"
                      stroke="#dcdfe7"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      opacity={0.8}
                    />

                    {/* Gradient Arc */}
                    <path
                      d={pathString}
                      fill="none"
                      stroke="url(#arcGradient)"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />

                    {/* Blue dynamic animated traveler block */}
                    <path
                      d={pathString}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray="8, 18"
                      className="animate-dash"
                      style={{
                        strokeDashoffset: 'var(--dash-offset, 0)',
                        animation: 'dash 5.5s linear infinite',
                      }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Sourcing Node Point Markers */}
          {mapPoints.map((pt) => {
            const isHQ = pt.type === 'hq';
            const isSelected = selectedLocation?.id === pt.id;
            const markerX = pt.coords.x * 10;
            const markerY = pt.coords.y * 4.2;

            return (
              <g
                key={`marker_${pt.id}`}
                className="cursor-pointer"
                onClick={() => onSelectLocation(pt)}
              >
                {/* Outer ring pulses */}
                {isHQ ? (
                  <>
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={18}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      className="opacity-40 animate-ping"
                      style={{ transformOrigin: `${markerX}px ${markerY}px`, animationDuration: '3s' }}
                    />
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={9}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      className="opacity-65"
                    />
                  </>
                ) : (
                  <>
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={13}
                      fill="none"
                      stroke={isSelected ? '#3b82f6' : '#6366f1'}
                      strokeWidth={1.5}
                      className="opacity-55 animate-pulse"
                    />
                  </>
                )}

                {/* Inner point dot anchor */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r={isHQ ? 6 : 4.5}
                  fill={isHQ ? '#10b981' : isSelected ? '#3b82f6' : '#6366f1'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="transition-all duration-200"
                />

                {/* SVG Foreign HTML Nameplate text element */}
                <foreignObject
                  x={markerX - 55}
                  y={markerY - 29}
                  width={110}
                  height={24}
                  className="overflow-visible pointer-events-none"
                >
                  <div className="flex flex-col items-center justify-end w-full h-full">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md shadow-xs border whitespace-nowrap transition-all duration-200 font-sans ${
                        isHQ
                          ? 'bg-emerald-600 text-white border-emerald-650'
                          : isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 scale-105 shadow font-bold'
                          : 'bg-white text-zinc-700 border-zinc-200 shadow-2xs'
                      }`}
                    >
                      {pt.countryName}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay at Bottom-Left side */}
        <div className="absolute bottom-3 left-3 bg-white/95 border border-zinc-200 shadow-md rounded-lg p-2.5 flex flex-col gap-1 z-10">
          <span className="text-[8.5px] font-extrabold text-zinc-500 block font-sans">망상 전송 흐름도 (Legend)</span>
          <div className="flex items-center gap-3.5 text-[9px] font-sans text-zinc-700">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              <span className="font-semibold">대한민국 HQ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white" />
              <span className="font-semibold">원자재 수입 거점</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4.5 h-0.5 border-t border-dashed border-indigo-400 inline-block" />
              <span className="text-[8.5px] text-zinc-500 font-semibold">수송 흐름</span>
            </div>
          </div>
        </div>

        {/* Floating instruction message on bottom-right */}
        <div className="absolute bottom-3 right-3 text-[9px] font-bold text-zinc-600 bg-white/95 border border-zinc-250 shadow-md px-2.5 py-1.5 rounded-md hidden md:block">
          💡 지도 상의 국가 핀을 클릭하시면 해상 거점별 요약 지표와 연계 조달 물량을 검색하실 수 있습니다.
        </div>
      </div>

      {/* Animation CSS Injected Dynamically */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
        .animate-dash {
          animation: dash 5s linear infinite;
        }
      `}</style>
    </div>
  );
}
