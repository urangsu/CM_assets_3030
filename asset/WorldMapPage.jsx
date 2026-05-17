/* [WorldMapPage.jsx v3]
   실제 국가 경계 choropleth — D3 geoNaturalEarth1 + world-atlas TopoJSON
   국가별 fill color로 판매/구매 규모 시각화 (원형 마커 방식 폐기)        */
const {
  useState: useWSt, useEffect: useWEf, useMemo: useWMemo, useRef: useWRef,
} = React;

/* ═══════════════════════════════════════════════════════════
   ISO 3166-1 numeric → alpha-2 (world-atlas countries-110m용)
═══════════════════════════════════════════════════════════ */
const NUM2 = {
  4:'AF', 8:'AL', 12:'DZ', 24:'AO', 32:'AR', 36:'AU', 40:'AT',
  44:'BS', 48:'BH', 50:'BD', 56:'BE', 64:'BT', 68:'BO', 70:'BA',
  72:'BW', 76:'BR', 100:'BG', 104:'MM', 108:'BI', 112:'BY',
  116:'KH', 120:'CM', 124:'CA', 140:'CF', 144:'LK', 148:'TD',
  152:'CL', 156:'CN', 170:'CO', 174:'KM', 178:'CG', 180:'CD',
  188:'CR', 191:'HR', 192:'CU', 196:'CY', 203:'CZ', 204:'BJ',
  208:'DK', 214:'DO', 218:'EC', 818:'EG', 222:'SV', 231:'ET',
  246:'FI', 250:'FR', 266:'GA', 276:'DE', 288:'GH', 300:'GR',
  304:'GL', 320:'GT', 324:'GN', 328:'GY', 332:'HT', 340:'HN',
  348:'HU', 356:'IN', 360:'ID', 364:'IR', 368:'IQ', 372:'IE',
  376:'IL', 380:'IT', 388:'JM', 392:'JP', 398:'KZ', 400:'JO',
  404:'KE', 408:'KP', 410:'KR', 414:'KW', 418:'LA', 422:'LB',
  426:'LS', 430:'LR', 434:'LY', 440:'LT', 442:'LU', 450:'MG',
  454:'MW', 458:'MY', 466:'ML', 478:'MR', 484:'MX', 496:'MN',
  498:'MD', 504:'MA', 508:'MZ', 516:'NA', 524:'NP', 528:'NL',
  554:'NZ', 558:'NI', 562:'NE', 566:'NG', 578:'NO', 586:'PK',
  591:'PA', 598:'PG', 600:'PY', 604:'PE', 608:'PH', 616:'PL',
  620:'PT', 634:'QA', 642:'RO', 643:'RU', 646:'RW', 682:'SA',
  688:'RS', 694:'SL', 706:'SO', 710:'ZA', 716:'ZW', 724:'ES',
  728:'SS', 729:'SD', 752:'SE', 756:'CH', 760:'SY', 762:'TJ',
  764:'TH', 788:'TN', 792:'TR', 800:'UG', 804:'UA', 784:'AE',
  826:'GB', 834:'TZ', 840:'US', 858:'UY', 860:'UZ', 862:'VE',
  704:'VN', 887:'YE', 894:'ZM',
};

const KO = {
  KR:'대한민국', JP:'일본',     CN:'중국',    US:'미국',    DE:'독일',
  HU:'헝가리',   PL:'폴란드',   FI:'핀란드',  FR:'프랑스',  GB:'영국',
  IN:'인도',     AU:'호주',     CL:'칠레',    AR:'아르헨티나',PH:'필리핀',
  ID:'인도네시아',CD:'콩고(DRC)',ZA:'남아공',  CA:'캐나다',  RU:'러시아',
  BR:'브라질',   MX:'멕시코',   SA:'사우디',  TR:'튀르키예',NG:'나이지리아',
  EG:'이집트',   TH:'태국',     MY:'말레이시아',VN:'베트남', KP:'북한',
  IT:'이탈리아', ES:'스페인',   NL:'네덜란드',SE:'스웨덴',  NO:'노르웨이',
  CH:'스위스',   AT:'오스트리아',GR:'그리스',  UA:'우크라이나',KZ:'카자흐스탄',
  IR:'이란',     IQ:'이라크',   PK:'파키스탄',BE:'벨기에',  PT:'포르투갈',
  CZ:'체코',     RO:'루마니아', DK:'덴마크',  RS:'세르비아',
};

/* ── Nickel green 5단계 ── */
const C_SCALE = ['#CDE9E3','#68BFB6','#00A398','#008F83','#005058'];
const C_NONE  = '#EEF2EC'; // lithium (데이터 없음)
const C_WARN  = '#F7A059'; // cobalt orange (주의)
const C_SEL   = '#004F48'; // 선택 국가 fill

function choropleth(value, max) {
  if (!value || value <= 0 || !max) return C_NONE;
  const ratio = Math.pow(value / max, 0.5);
  return C_SCALE[Math.min(Math.floor(ratio * C_SCALE.length), C_SCALE.length - 1)];
}

/* ── Topology CDN fetch (모듈 레벨 캐시) ── */
let _topoProm  = null;
let _topoCache = null;

function ensureTopo() {
  if (_topoCache) return Promise.resolve(_topoCache);
  if (_topoProm)  return _topoProm;
  _topoProm = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { _topoCache = d; return d; })
    .catch(err => { _topoProm = null; return Promise.reject(err); });
  return _topoProm;
}

/* ════════════════════════════════════════════════════════════
   ChoroplethMap
   - shapes: useEffect로 D3 path 문자열 사전 계산 후 state에 저장
   - 렌더: path.fill만 byCode/valueKey 기반으로 동적 계산
════════════════════════════════════════════════════════════ */
function ChoroplethMap({ byCode, valueKey, mode, selected, onSelect }) {
  /* 모든 useState는 조건 없이 최상단 */
  const [status, setStatus]   = useWSt('loading'); // loading | ready | error
  const [shapes, setShapes]   = useWSt([]); // [{id, alpha2, d}]
  const [borders, setBorders] = useWSt(''); // mesh path string
  const [tip, setTip]         = useWSt(null); // {alpha2, data, x, y}
  const containerRef           = useWRef(null);

  /* 최대값 (fill color 계산용) */
  const maxVal = useWMemo(() =>
    Math.max(...Object.values(byCode).map(d => d[valueKey] || 0), 1),
    [byCode, valueKey]
  );

  /* 토폴로지 로드 + SVG path 사전 계산 (1회) */
  useWEf(() => {
    const d3   = window.d3;
    const tj   = window.topojson;
    if (!d3 || !tj) { setStatus('error'); return; }

    ensureTopo()
      .then(topology => {
        const proj = d3.geoNaturalEarth1()
          .scale(153)
          .translate([480, 275]);
        const gen  = d3.geoPath().projection(proj);

        const feats = tj.feature(topology, topology.objects.countries).features;
        const mesh  = tj.mesh(topology, topology.objects.countries, (a, b) => a !== b);

        const computed = feats
          .map(f => ({ id: f.id, alpha2: NUM2[f.id] || null, d: gen(f) || '' }))
          .filter(f => f.d.length > 0);

        setShapes(computed);
        setBorders(gen(mesh) || '');
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []); /* eslint-disable-line react-hooks/exhaustive-deps */

  /* 마우스 추적 (functional update — stale closure 방지) */
  function trackMouse(e) {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setTip(prev => prev
      ? { ...prev, x: e.clientX - r.left, y: e.clientY - r.top }
      : null
    );
  }

  /* ── Render: loading ── */
  if (status === 'loading') return (
    <div style={{ height:380, display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--t3)', fontSize:12, flexDirection:'column', gap:8 }}>
      <div style={{ width:24, height:24, border:'2px solid var(--border)',
        borderTopColor:'var(--primary)', borderRadius:'50%',
        animation:'wm-spin 0.8s linear infinite' }}/>
      세계지도 로딩 중…
    </div>
  );

  /* ── Render: error ── */
  if (status === 'error') return (
    <div style={{ height:380, display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:12, color:'var(--t3)' }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>
        지도 데이터를 불러올 수 없습니다
      </div>
      <div style={{ fontSize:11 }}>cdn.jsdelivr.net 연결 확인 후 재시도해주세요.</div>
      <button className="btn sm" onClick={() => {
        setStatus('loading');
        ensureTopo().then(() => setStatus('ready')).catch(() => setStatus('error'));
      }}>재시도</button>
    </div>
  );

  /* ── Render: ready ── */
  return (
    <div ref={containerRef}
      style={{ position:'relative', lineHeight:0 }}
      onMouseMove={trackMouse}
      onMouseLeave={() => setTip(null)}>

      <svg viewBox="0 0 960 540" style={{ width:'100%', height:'auto', display:'block' }}>
        {/* 해양 배경 */}
        <rect width={960} height={540} fill="#EBF4F3"/>

        {/* 국가 polygon — choropleth fill */}
        {shapes.map(({ id, alpha2, d }) => {
          const data  = alpha2 ? byCode[alpha2] : null;
          const val   = data?.[valueKey] || 0;
          const isWarn= data?.status === 'warning';
          const isSel = Boolean(alpha2 && alpha2 === selected);
          const fill  = isSel ? C_SEL : isWarn ? C_WARN : choropleth(val, maxVal);

          return (
            <path key={id} d={d}
              fill={fill}
              stroke={isSel ? '#111' : '#ffffff'}
              strokeWidth={isSel ? 1.5 : 0.45}
              style={{ cursor: alpha2 ? 'pointer' : 'default' }}
              onMouseEnter={e => {
                if (!alpha2 || !containerRef.current) return;
                const r = containerRef.current.getBoundingClientRect();
                setTip({ alpha2, data, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              onMouseLeave={() => setTip(null)}
              onClick={() => alpha2 && onSelect(alpha2 === selected ? null : alpha2)}
            />
          );
        })}

        {/* 국경선 mesh */}
        {borders && (
          <path d={borders} fill="none" stroke="#ffffff" strokeWidth={0.4} opacity={0.5}/>
        )}
      </svg>

      {/* HTML Tooltip — 국가 hover 시 */}
      {tip && tip.data && (() => {
        const { alpha2, data, x, y } = tip;
        const cw = containerRef.current?.offsetWidth  || 800;
        const ch = containerRef.current?.offsetHeight || 380;
        const W  = 190, H = 135;
        const left = x + 14 + W > cw ? x - W - 10 : x + 14;
        const top  = y + H      > ch ? y - H - 8  : y + 6;
        const val  = data[valueKey] || 0;
        return (
          <div style={{
            position:'absolute', left, top, width:W, zIndex:200, pointerEvents:'none',
            background:'rgba(17,17,17,.92)', borderRadius:8,
            padding:'10px 13px', color:'#fff', fontSize:11, lineHeight:1.7,
            boxShadow:'0 4px 18px rgba(0,0,0,.28)',
          }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:5 }}>
              {KO[alpha2] || alpha2}
            </div>
            <div>
              {mode === 'sales' ? '매출액' : '구매금액'}:{' '}
              <strong>${(val / 1e6).toFixed(2)}M</strong>
            </div>
            <div>수량: <strong>{(data.quantity || 0).toLocaleString()} MT</strong></div>
            {(data.topProductName || data.topMaterialName) && (
              <div style={{ opacity:.85 }}>
                주요: {data.topProductName || data.topMaterialName}
              </div>
            )}
            <div style={{ opacity:.75 }}>
              {mode === 'sales'
                ? `고객사 ${data.customerCount || 0}개`
                : `공급사 ${data.supplierCount || 0}개`}
            </div>
          </div>
        );
      })()}

      {/* 범례 */}
      <div style={{
        position:'absolute', bottom:10, left:10,
        background:'rgba(255,255,255,.92)', borderRadius:6,
        padding:'5px 10px', display:'flex', alignItems:'center', gap:5,
        fontSize:10, color:'var(--t2)', boxShadow:'0 1px 5px rgba(0,0,0,.09)',
      }}>
        <span style={{ color:'var(--t3)' }}>낮음</span>
        {C_SCALE.map(c => (
          <div key={c} style={{ width:16, height:10, background:c, borderRadius:2 }}/>
        ))}
        <span style={{ color:'var(--t3)' }}>높음</span>
        <div style={{ width:1, height:12, background:'var(--border)', margin:'0 5px' }}/>
        <div style={{ width:14, height:10, background:C_NONE,
          border:'1px solid var(--border)', borderRadius:2 }}/>
        <span style={{ color:'var(--t3)' }}>없음</span>
        <div style={{ width:1, height:12, background:'var(--border)', margin:'0 5px' }}/>
        <div style={{ width:14, height:10, background:C_WARN, borderRadius:2 }}/>
        <span style={{ color:'var(--t3)' }}>주의</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CountryDetailPanel — 우측 국가 상세
════════════════════════════════════════════════════════════ */
function CountryDetailPanel({ alpha2, byCode, valueKey, mode, allRecords, onClose }) {
  const isSales = mode === 'sales';
  const vKey    = isSales ? 'revenue' : 'amount';

  /* ⚠ Hook 먼저, conditional return은 hook 이후 */
  const trend = useWMemo(() => {
    if (!alpha2) return [];
    const map = {};
    allRecords
      .filter(r => r.countryCode === alpha2)
      .forEach(r => { map[r.month] = (map[r.month] || 0) + (r[vKey] || 0); });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({ m: m.slice(5) + '월', v }));
  }, [alpha2, allRecords, isSales]);

  const cd = alpha2 ? byCode[alpha2] : null;
  if (!alpha2 || !cd) return null;

  const pv          = cd[valueKey] || 0;
  const itemMap     = isSales ? cd.products   : cd.materials;
  const partnerList = isSales ? cd.customers  : cd.suppliers;
  const tMax        = Math.max(...trend.map(t => t.v), 1);

  return (
    <div style={{
      width:288, flexShrink:0, borderLeft:'1px solid var(--border)',
      background:'var(--white)', display:'flex', flexDirection:'column',
    }}>
      {/* 헤더 */}
      <div style={{ padding:'13px 16px 10px', borderBottom:'1px solid var(--border-lt)',
        display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--t1)' }}>
            {KO[alpha2] || alpha2}
          </div>
          <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>
            {alpha2} · {isSales ? '판매 현황' : '구매 현황'}
          </div>
        </div>
        <button className="btn sm" onClick={onClose} style={{ padding:'3px 9px', flexShrink:0 }}>×</button>
      </div>

      <div style={{ padding:'12px 16px', flex:1, overflowY:'auto' }}>
        {/* KPI 4칸 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
          {[
            { l: isSales ? '총 매출'    : '총 구매',     v:`$${(pv/1e6).toFixed(2)}M` },
            { l: '수량',                               v:`${(cd.quantity||0).toLocaleString()} MT` },
            { l: isSales ? '제품 수'    : '원료 수',    v:`${(isSales?cd.productCount:cd.materialCount)||0}종` },
            { l: isSales ? '고객사'     : '공급사',     v:`${partnerList?.length||0}개` },
          ].map(({ l, v }) => (
            <div key={l} style={{ background:'var(--bg)', borderRadius:'var(--rsm)', padding:'8px 10px' }}>
              <div style={{ fontSize:10, color:'var(--t3)' }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginTop:2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* 품목 비중 */}
        <div style={{ fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:8 }}>
          {isSales ? '제품별 매출' : '원료별 구매액'}
        </div>
        {Object.entries(itemMap || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, val]) => (
          <div key={name} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, marginBottom:3 }}>
              <span style={{ color:'var(--t2)', overflow:'hidden', textOverflow:'ellipsis',
                whiteSpace:'nowrap', maxWidth:158 }}>{name}</span>
              <span style={{ fontWeight:600, color:'var(--t1)', flexShrink:0 }}>
                ${(val/1e6).toFixed(2)}M
              </span>
            </div>
            <div style={{ height:4, background:'var(--border-lt)', borderRadius:2 }}>
              <div style={{ height:'100%', borderRadius:2, background:'var(--primary)',
                width:`${pv > 0 ? (val/pv*100).toFixed(0) : 0}%`, transition:'width .3s' }}/>
            </div>
          </div>
        ))}

        {/* 거래처 */}
        <div style={{ fontSize:11, fontWeight:600, color:'var(--t2)', margin:'12px 0 6px' }}>
          {isSales ? '고객사' : '공급사'}
        </div>
        {(partnerList || []).slice(0, 5).map(n => (
          <div key={n} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 0',
            borderBottom:'1px solid var(--border-lt)' }}>
            <div style={{ width:5, height:5, borderRadius:'50%',
              background:'var(--primary)', flexShrink:0 }}/>
            <span style={{ fontSize:11, color:'var(--t2)' }}>{n}</span>
          </div>
        ))}

        {/* 월별 추이 */}
        {trend.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--t2)', margin:'14px 0 6px' }}>
              월별 추이
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:52,
              borderBottom:'1px solid var(--border-lt)', marginBottom:4 }}>
              {trend.map(({ m, v }) => (
                <div key={m} style={{ flex:1, height:'100%', display:'flex',
                  alignItems:'flex-end', justifyContent:'center' }}>
                  <div style={{
                    width:'100%', background:'var(--primary)', opacity:.85,
                    borderRadius:'2px 2px 0 0',
                    height:`${Math.max(v > 0 ? (v/tMax*48) : 0, v>0?2:0).toFixed(0)}px`,
                    transition:'height .3s',
                  }}/>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:3 }}>
              {trend.map(({ m }) => (
                <div key={m} style={{ flex:1, textAlign:'center', fontSize:8.5, color:'var(--t3)' }}>
                  {m}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RankingTable — 국가별 순위 테이블
   테이블 행 클릭 → 지도 선택 동기화
════════════════════════════════════════════════════════════ */
function RankingTable({ rows, mode, selected, onSelect }) {
  const isSales = mode === 'sales';
  const total   = rows.reduce((s, r) => s + (isSales?r.revenue:r.amount), 0);

  return (
    <div className="card cb"><span className="cbl">RankingTable</span>
      <div className="card-head">
        <span className="card-title">국가별 {isSales?'판매':'구매'} 순위</span>
        <span className="card-sub">{rows.length}개국 · 행 클릭 → 지도 연동</span>
      </div>
      <div style={{ padding:0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign:'left', paddingLeft:16, width:36 }}>#</th>
              <th style={{ textAlign:'left' }}>국가</th>
              <th>{isSales?'매출액':'구매금액'}(M USD)</th>
              <th>{isSales?'판매':'구매'}량(MT)</th>
              <th style={{ textAlign:'left' }}>{isSales?'주요 제품':'주요 원료'}</th>
              <th>{isSales?'고객사':'공급사'}</th>
              <th style={{ minWidth:120 }}>비중</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const val   = isSales ? r.revenue : r.amount;
              const pct   = total > 0 ? val / total * 100 : 0;
              const isSel = r.countryCode === selected;
              const isW   = r.status === 'warning';
              return (
                <tr key={r.countryCode}
                  className="tbl-row-hover tbl-row-click"
                  style={{ background: isSel ? 'var(--primary-bg)' : '' }}
                  onClick={() => onSelect(r.countryCode === selected ? null : r.countryCode)}>
                  <td style={{ paddingLeft:16, color:'var(--t3)', fontWeight:600 }}>{i+1}</td>
                  <td style={{ textAlign:'left' }}>
                    <span style={{ fontWeight:600 }}>{KO[r.countryCode]||r.countryName}</span>
                    <span style={{ fontSize:10, color:'var(--t3)', marginLeft:6 }}>{r.countryCode}</span>
                  </td>
                  <td style={{ fontWeight:600 }}>${(val/1e6).toFixed(2)}</td>
                  <td>{(r.quantity||0).toLocaleString()}</td>
                  <td style={{ textAlign:'left', fontSize:11, color:'var(--t2)' }}>
                    {isSales ? r.topProductName : r.topMaterialName}
                  </td>
                  <td>{isSales ? r.customerCount : r.supplierCount}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ flex:1, height:4, background:'var(--border-lt)', borderRadius:2 }}>
                        <div style={{
                          height:'100%', borderRadius:2,
                          width:`${pct.toFixed(0)}%`,
                          background: isSel ? '#004F48' : isW ? 'var(--ac)' : 'var(--primary)',
                          transition:'width .3s',
                        }}/>
                      </div>
                      <span style={{ fontSize:10, color:'var(--t3)', minWidth:34, textAlign:'right' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${isW ? 'amber' : 'green'}`}>
                      {isW ? '주의' : '정상'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-foot">
        <span>SAMPLE DATA · 실제 데이터 업로드 시 자동 대체됩니다</span>
        <span>{rows.length}개국</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   OpsPage — Sales / Purchase 공통 페이지
════════════════════════════════════════════════════════════ */
function OpsPage({ mode }) {
  const SD = window.HYCMSalesData || {
    DEMO_SALES:[], DEMO_PURCHASES:[],
    getSalesByCountry: () => [], getPurchaseByCountry: () => [],
    getSalesByProduct: () => [], getPurchaseByMaterial: () => [],
  };
  const isSales = mode === 'sales';

  const [selCountry,  setSelCountry]  = useWSt(null);
  const [filterMonth, setFilterMonth] = useWSt('ALL');
  const [filterItem,  setFilterItem]  = useWSt('ALL');

  const rawAll      = isSales ? SD.DEMO_SALES     : SD.DEMO_PURCHASES;
  const itemCodeKey = isSales ? 'productCode'     : 'materialCode';
  const itemNameKey = isSales ? 'productName'     : 'materialName';
  const valueKey    = isSales ? 'revenue'         : 'amount';

  /* 필터 옵션 */
  const itemOpts = useWMemo(() =>
    [...new Map(rawAll.map(r => [r[itemCodeKey], r[itemNameKey]])).entries()]
      .map(([code, name]) => ({ code, name })),
    [rawAll, itemCodeKey, itemNameKey]
  );

  /* 필터 적용 */
  const records = useWMemo(() =>
    rawAll
      .filter(r => filterMonth === 'ALL' || r.month?.endsWith(`-${filterMonth.padStart(2,'0')}`))
      .filter(r => filterItem  === 'ALL' || r[itemCodeKey] === filterItem),
    [filterMonth, filterItem, rawAll, itemCodeKey]
  );

  /* 국가별 집계 (배열 + 맵) */
  const byCountryArr = useWMemo(() =>
    isSales ? SD.getSalesByCountry(records) : SD.getPurchaseByCountry(records),
    [records, isSales]
  );

  const byCode = useWMemo(() =>
    Object.fromEntries(byCountryArr.map(d => [d.countryCode, d])),
    [byCountryArr]
  );

  /* KPI */
  const totals = useWMemo(() => {
    const topArr = isSales
      ? SD.getSalesByProduct(records)
      : SD.getPurchaseByMaterial(records);
    return {
      value:  records.reduce((s, r) => s + (r[valueKey] || 0), 0),
      qty:    records.reduce((s, r) => s + (r.quantity   || 0), 0),
      ctries: new Set(records.map(r => r.countryCode)).size,
      topItem:(topArr[0]?.[isSales?'productName':'materialName']||'—').split('(')[0],
    };
  }, [records, isSales, valueKey]);

  const itemLbl = isSales ? '제품' : '원료';

  return (
    <>
      {/* 페이지 헤더 */}
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">{isSales ? '판매 현황' : '원료 구매'}</div>
          <div className="pg-sub">
            국가별 {isSales?'판매':'구매'}금액을 choropleth 색상으로 표현합니다.
            국가 hover → 툴팁 · 클릭 → 상세 패널
          </div>
        </div>
        <div className="flex-1"/>
        <button className="btn sm">내보내기</button>
      </div>

      {/* SAMPLE DATA 배너 */}
      <div className="state-banner warn">
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="11" r=".7" fill="currentColor"/>
        </svg>
        <span>
          <strong>SAMPLE DATA</strong> — 실제 {isSales?'판매':'구매'} 데이터가 아닙니다. UI 확인용 샘플입니다.
        </span>
      </div>

      {/* 필터 바 */}
      <div className="filter-bar cb"><span className="cbl">FilterBar</span>
        <div className="filter-group">
          <label className="filter-label">연도</label>
          <select className="filter-sel"><option>2026</option></select>
        </div>
        <div className="filter-group">
          <label className="filter-label">월</label>
          <select className="filter-sel" value={filterMonth}
            onChange={e => { setFilterMonth(e.target.value); setSelCountry(null); }}>
            <option value="ALL">전체</option>
            {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m =>
              <option key={m} value={m}>{m}월</option>
            )}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">{itemLbl}</label>
          <select className="filter-sel" value={filterItem}
            onChange={e => { setFilterItem(e.target.value); setSelCountry(null); }}>
            <option value="ALL">전체 {itemLbl}</option>
            {itemOpts.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--ac)' }}>
          SAMPLE DATA
        </span>
      </div>

      {/* KPI 4칸 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--gap)' }}>
        {[
          { l:isSales?'총 판매금액':'총 구매금액', v:`$${(totals.value/1e6).toFixed(1)}M`,     t:'green', s:'집계됨' },
          { l:isSales?'총 판매량':'총 구매수량',   v:`${totals.qty.toLocaleString()} MT`,       t:'gray',  s:'합계'   },
          { l:'국가 수',                            v:`${totals.ctries}개국`,                    t:'green', s:isSales?'판매':'구매' },
          { l:`주요 ${itemLbl}`,                   v:totals.topItem,                             t:'gray',  s:'금액 1위' },
        ].map(k => (
          <div className="kpi" key={k.l}>
            <div className="kpi-label">{k.l}</div>
            <div className="kpi-sw"><span className={`badge ${k.t}`}>{k.s}</span></div>
            <div className="kpi-val" style={{ fontSize:18 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* 지도 카드 (choropleth + 상세 패널) */}
      <div className="card cb"><span className="cbl">WorldMapCard</span>
        <div className="card-head">
          <span className="card-title">
            국가별 {isSales?'판매':'구매'} 현황 — choropleth
          </span>
          <span className="card-sub" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span>국가 hover: 툴팁</span>
            <span>·</span>
            <span>클릭: 상세 패널</span>
            <span>·</span>
            <span>색상 = {isSales?'판매':'구매'}금액</span>
          </span>
          {selCountry && (
            <button className="btn sm" style={{ marginLeft:'auto' }}
              onClick={() => setSelCountry(null)}>
              상세 닫기
            </button>
          )}
        </div>

        <div style={{ display:'flex', borderTop:'1px solid var(--border-lt)', minHeight:300 }}>
          {/* 지도 */}
          <div style={{ flex:1, padding:'14px 18px', minWidth:0 }}>
            <ChoroplethMap
              byCode={byCode}
              valueKey={valueKey}
              mode={mode}
              selected={selCountry}
              onSelect={setSelCountry}
            />
          </div>
          {/* 상세 패널 */}
          {selCountry && (
            <CountryDetailPanel
              alpha2={selCountry}
              byCode={byCode}
              valueKey={valueKey}
              mode={mode}
              allRecords={records}
              onClose={() => setSelCountry(null)}
            />
          )}
        </div>

        <div className="card-foot">
          <span>
            SAMPLE DATA · 색상 농도: {isSales?'판매':'구매'}금액 기준 ·
            데이터 없는 국가: 연한 gray
          </span>
          <span>표시 국가: {byCountryArr.length}개</span>
        </div>
      </div>

      {/* 순위 테이블 — 지도와 선택 연동 */}
      <RankingTable
        rows={byCountryArr}
        mode={mode}
        selected={selCountry}
        onSelect={setSelCountry}
      />

      <div style={{ height:8 }}/>
    </>
  );
}

function SalesPage()    { return <OpsPage mode="sales"/>; }
function PurchasePage() { return <OpsPage mode="purchase"/>; }

Object.assign(window, { SalesPage, PurchasePage });
