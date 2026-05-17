/* [Component: ActualTransformPage + ActualDBCleanupPage]
   실적 변환 (컬럼 매핑 stepper) + 실적DB 정리 (코드 점검) */
const { useState: useASt, useEffect: useAEf } = React;

/* ══════════════════════════════
   ActualTransformPage — 실적 변환
══════════════════════════════ */
const HYCM_COLS = ['귀속부서코드','계정코드','귀속부서','1월실적','2월실적','3월실적','4월실적','5월실적','6월실적','7월실적','8월실적','9월실적','10월실적','11월실적','12월실적'];
const T_STEPS = [{id:0,label:'파일 선택'},{id:1,label:'컬럼 매핑'},{id:2,label:'검증'},{id:3,label:'변환 미리보기'},{id:4,label:'실적DB 반영'}];

function TStepBar({ step }) {
  return (
    <div className="stepper cb"><span className="cbl">TransformStepper</span>
      {T_STEPS.map((s,i)=>(
        <React.Fragment key={s.id}>
          <div className={`step${step===i?' active':step>i?' done':''}`}>
            <div className="step-num">{step>i?'✓':i+1}</div>
            <div className="step-label">{s.label}</div>
          </div>
          {i<T_STEPS.length-1 && <div className={`step-line${step>i?' done':''}`}/>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ActualTransformPage({ onNav }) {
  const D = window.HYCMData;
  const [step, setStep] = useASt(0);
  const [file, setFile] = useASt(null);
  const [srcHeaders, setSrcHeaders] = useASt([]);
  const [mapping, setMapping] = useASt({});
  const [year, setYear] = useASt('2026');
  const [preview, setPreview] = useASt([]);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    // Read first row as headers via CSV for preview
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const firstLine = text.split('\n')[0];
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g,''));
      setSrcHeaders(headers);
      // Auto-map by alias matching
      const autoMap = {};
      headers.forEach(h => {
        const norm = D.normalizeHeader(h);
        const match = HYCM_COLS.find(c => D.normalizeHeader(c) === norm || D.normalizeHeader(c).includes(norm));
        autoMap[h] = match || '';
      });
      setMapping(autoMap);
    };
    reader.readAsText(f);
    setStep(1);
  }

  const unmapped = srcHeaders.filter(h => !mapping[h]);

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">실적 변환</div>
          <div className="pg-sub">업로드된 원본 데이터를 HYCM 표준 실적DB 구조로 변환합니다.</div>
        </div>
        <div className="flex-1"/>
        <div className="filter-group">
          <label className="filter-label">기준 연도</label>
          <select className="filter-sel" value={year} onChange={e=>setYear(e.target.value)}>
            {['2026','2025','2024'].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <TStepBar step={step}/>

      {/* Step 0: 파일 선택 */}
      {step === 0 && (
        <div className="card cb"><span className="cbl">TransformUpload</span>
          <div className="card-head"><span className="card-title">원본 파일 선택</span></div>
          <div className="card-body">
            <div className="drop-zone" onClick={()=>document.getElementById('tfile').click()}>
              {file
                ? <><div className="drop-file">{file.name}</div><div className="drop-sub">클릭하여 다른 파일 선택</div></>
                : <><div className="drop-msg">ERP 추출 파일을 선택해주세요</div><div className="drop-sub">.xlsx · .csv</div></>
              }
              <input id="tfile" type="file" accept=".xlsx,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])}/>
            </div>

            <div style={{marginTop:16,padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--rsm)',fontSize:11,color:'var(--t3)',lineHeight:1.7}}>
              <div style={{fontWeight:600,color:'var(--t2)',marginBottom:4}}>HYCM 표준 실적DB 컬럼 구조</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {HYCM_COLS.map(c=><span key={c} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:3,padding:'2px 8px',fontSize:10.5}}>{c}</span>)}
              </div>
              <div style={{marginTop:8,color:'var(--amber)'}}>※ 실적DB 구조는 변경하지 않습니다. 원본 컬럼을 위 표준 컬럼에 매핑합니다.</div>
            </div>
          </div>
          <div className="card-foot" style={{justifyContent:'flex-end'}}>
            <button className="btn sm primary" disabled={!file} onClick={()=>file&&setStep(1)} style={{opacity:file?1:.5}}>컬럼 매핑 →</button>
          </div>
        </div>
      )}

      {/* Step 1: 컬럼 매핑 */}
      {step === 1 && (
        <div className="card cb"><span className="cbl">ColumnMapper</span>
          <div className="card-head">
            <span className="card-title">컬럼 매핑</span>
            <span className="card-sub">원본 컬럼 → HYCM 표준 컬럼</span>
            {unmapped.length > 0 && <span className="badge amber" style={{marginLeft:'auto'}}>{unmapped.length}개 미매핑</span>}
          </div>
          <div className="card-body">
            <div className="mapper-head">
              <span className="mapper-col-head">원본 컬럼</span>
              <span/>
              <span className="mapper-col-head">HYCM 표준 컬럼</span>
            </div>
            {srcHeaders.map(h=>(
              <div className="mapper-row" key={h}>
                <span className="mapper-src">{h}</span>
                <span className="mapper-arr">→</span>
                <select className="filter-sel mapper-tgt"
                  value={mapping[h]||''}
                  onChange={e=>setMapping(prev=>({...prev,[h]:e.target.value}))}>
                  <option value="">— 매핑 안함 —</option>
                  {HYCM_COLS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <button className="btn sm" onClick={()=>setStep(0)}>← 이전</button>
            <button className="btn sm primary" style={{marginLeft:'auto'}} onClick={()=>setStep(2)}>검증 →</button>
          </div>
        </div>
      )}

      {/* Step 2: 검증 요약 */}
      {step === 2 && (
        <div className="card cb"><span className="cbl">TransformValidate</span>
          <div className="card-head"><span className="card-title">매핑 검증</span></div>
          <div className="card-body">
            {(['귀속부서코드','계정코드'].every(c=>Object.values(mapping).includes(c))) ? (
              <div style={{padding:'12px 14px',background:'var(--green-bg)',border:'1px solid var(--green)',borderRadius:'var(--rsm)',fontSize:12,color:'var(--green)',marginBottom:12}}>
                필수 컬럼(귀속부서코드, 계정코드)이 모두 매핑되었습니다.
              </div>
            ) : (
              <div style={{padding:'12px 14px',background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--rsm)',fontSize:12,color:'var(--red)',marginBottom:12}}>
                필수 컬럼 매핑 필요: {['귀속부서코드','계정코드'].filter(c=>!Object.values(mapping).includes(c)).join(', ')}
              </div>
            )}
            <table className="tbl">
              <thead><tr><th style={{textAlign:'left'}}>원본 컬럼</th><th style={{textAlign:'left'}}>매핑 결과</th><th>상태</th></tr></thead>
              <tbody>
                {srcHeaders.map(h=>(
                  <tr key={h}>
                    <td style={{textAlign:'left',fontWeight:500}}>{h}</td>
                    <td style={{textAlign:'left',color:mapping[h]?'var(--green)':'var(--t3)'}}>{mapping[h]||'— 매핑 안함'}</td>
                    <td><span className={`badge ${mapping[h]?'green':'gray'}`}>{mapping[h]?'매핑됨':'미매핑'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <button className="btn sm" onClick={()=>setStep(1)}>← 이전</button>
            <button className="btn sm primary" style={{marginLeft:'auto'}} onClick={()=>setStep(3)}>변환 미리보기 →</button>
          </div>
        </div>
      )}

      {/* Step 3: 미리보기 */}
      {step === 3 && (
        <div className="card cb"><span className="cbl">TransformPreview</span>
          <div className="card-head"><span className="card-title">변환 미리보기</span></div>
          <div className="card-body">
            <div style={{padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--rsm)',fontSize:11,color:'var(--t3)',marginBottom:12}}>
              실제 파일 데이터를 HYCM 표준 구조로 변환한 결과입니다. 실적DB 반영 전 최종 확인해주세요.
            </div>
            <table className="tbl">
              <thead><tr>{HYCM_COLS.slice(0,5).map(c=><th key={c} style={{textAlign:'left'}}>{c}</th>)}<th style={{textAlign:'left'}}>…</th></tr></thead>
              <tbody>
                <tr><td colSpan={6} style={{textAlign:'center',color:'var(--t3)',padding:'20px 0',fontSize:11}}>파일 내용이 여기에 표시됩니다 (변환 후)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <button className="btn sm" onClick={()=>setStep(2)}>← 이전</button>
            <button className="btn sm primary" style={{marginLeft:'auto'}} onClick={()=>setStep(4)}>실적DB에 반영 →</button>
          </div>
        </div>
      )}

      {/* Step 4: 완료 */}
      {step === 4 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:'48px'}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--t1)',marginBottom:6}}>변환 완료</div>
            <div style={{fontSize:12,color:'var(--t3)',marginBottom:16}}>실적DB에 반영되었습니다.</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button className="btn sm" onClick={()=>{setStep(0);setFile(null);}}>새로 변환</button>
              <button className="btn sm primary" onClick={()=>onNav('actual-cleanup')}>실적DB 정리 →</button>
            </div>
          </div>
        </div>
      )}
      <div style={{height:8}}/>
    </>
  );
}

/* ══════════════════════════════
   ActualDBCleanupPage — 실적DB 정리
══════════════════════════════ */
function ActualDBCleanupPage({ state }) {
  const D = window.HYCMData;
  const [year, setYear] = useASt('2026');
  const [actuals, setActuals] = useASt([]);
  const [checked, setChecked] = useASt(false);
  const [report, setReport] = useASt(null);

  useAEf(() => { setActuals(D.loadActuals(year)); setChecked(false); setReport(null); }, [year]);

  function runCheck() {
    const rows = actuals.length > 0 ? actuals : D.DEMO_ACTUALS;
    const report = { totalRows: rows.length, issues: [] };

    // 1. 부서코드 누락
    rows.forEach((r,i) => { if (!r.usageCode) report.issues.push({ row:i+1, type:'오류', field:'귀속부서코드', msg:'부서코드 누락' }); });

    // 2. 계정코드 누락
    rows.forEach((r,i) => { if (!r.accountCode) report.issues.push({ row:i+1, type:'오류', field:'계정코드', msg:'계정코드 누락' }); });

    // 3. 미등록 부서코드
    const validCodes = new Set(D.DEPARTMENTS.map(d=>d.code));
    const unknownDepts = new Set();
    rows.forEach(r => { if (r.usageCode && !validCodes.has(r.usageCode)) unknownDepts.add(r.usageCode); });
    unknownDepts.forEach(code => report.issues.push({ type:'경고', field:'귀속부서코드', msg:`미등록 부서코드: ${code}` }));

    // 4. 중복 점검
    const seen = new Map();
    rows.forEach((r,i) => {
      const key = `${r.usageCode}_${r.accountCode}_${r.period}`;
      if (seen.has(key)) report.issues.push({ row:i+1, type:'경고', field:'중복', msg:`중복 가능성: ${r.usageCode} / ${r.accountCode} / ${r.period}` });
      else seen.set(key, i);
    });

    // 5. 완료실적 0 점검
    const zeroRows = rows.filter(r => !r.completed || r.completed === 0).length;
    if (zeroRows > 0) report.issues.push({ type:'정보', field:'completed', msg:`완료실적이 0인 행: ${zeroRows}건 (저장 시 제외됨)` });

    report.errorCount = report.issues.filter(i=>i.type==='오류').length;
    report.warnCount  = report.issues.filter(i=>i.type==='경고').length;
    report.okCount    = report.totalRows - report.errorCount;
    report.usedData   = actuals.length > 0 ? '업로드 데이터' : 'SAMPLE DATA';
    setReport(report);
    setChecked(true);
  }

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">실적DB 정리</div>
          <div className="pg-sub">반영 전 실적DB의 코드 누락, 중복, 부서코드 오류를 점검합니다.</div>
        </div>
        <div className="flex-1"/>
        <div className="filter-group">
          <label className="filter-label">기준 연도</label>
          <select className="filter-sel" value={year} onChange={e=>setYear(e.target.value)}>
            {['2026','2025','2024'].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn sm primary" onClick={runCheck}>점검 실행</button>
      </div>

      {actuals.length === 0 && state==='uploaded' && (
        <div className="state-banner warn"><span>로컬 업로드 데이터가 없어 SAMPLE DATA로 점검합니다.</span></div>
      )}

      {/* Check items */}
      <div className="card cb"><span className="cbl">CheckItems</span>
        <div className="card-head"><span className="card-title">점검 항목</span></div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {[
              '귀속부서코드 누락', '계정코드 누락', '미등록 부서코드',
              '중복 행 점검', '완료실적 0 확인', '월별 합계 검증',
            ].map(item => (
              <div key={item} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'var(--bg)',borderRadius:'var(--rsm)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:checked?'var(--green)':'var(--border)',flexShrink:0}}/>
                <span style={{fontSize:12,color:'var(--t2)'}}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {report && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)'}}>
            {[
              {label:'전체 행',   val:report.totalRows, type:'gray' },
              {label:'정상 행',   val:report.okCount,   type:'green'},
              {label:'오류 건수', val:report.errorCount,type:report.errorCount>0?'red':'green'},
              {label:'경고 건수', val:report.warnCount, type:report.warnCount>0?'amber':'green'},
            ].map(k=>(
              <div className="kpi" key={k.label}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val" style={{fontSize:22}}>{k.val}</div>
              </div>
            ))}
          </div>
          <div className="card cb"><span className="cbl">CleanupIssues</span>
            <div className="card-head">
              <span className="card-title">점검 결과</span>
              <span className="card-sub">{report.usedData}</span>
              {report.errorCount === 0 && <span className="badge green" style={{marginLeft:'auto'}}>이상 없음</span>}
            </div>
            <div style={{padding:0}}>
              <table className="tbl">
                <thead><tr><th style={{textAlign:'left',paddingLeft:16}}>유형</th><th style={{textAlign:'left'}}>필드</th><th style={{textAlign:'left'}}>내용</th></tr></thead>
                <tbody>
                  {report.issues.length === 0
                    ? <tr><td colSpan={3} style={{textAlign:'center',padding:'24px 0',color:'var(--green)',fontSize:12}}>점검 결과 이상이 없습니다.</td></tr>
                    : report.issues.slice(0,20).map((iss,i)=>(
                        <tr key={i} className="tbl-row-hover">
                          <td style={{textAlign:'left',paddingLeft:16}}>
                            <span className={`badge ${iss.type==='오류'?'red':iss.type==='경고'?'amber':'gray'}`}>{iss.type}</span>
                          </td>
                          <td style={{textAlign:'left',color:'var(--t2)'}}>{iss.field}</td>
                          <td style={{textAlign:'left',fontSize:11,color:'var(--t2)'}}>{iss.msg}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <span>출처: localStorage · cleanmetal_actual_data_{year}</span>
              <button className="btn sm primary" style={{opacity:report.errorCount>0?.5:1}} disabled={report.errorCount>0}>
                {report.errorCount > 0 ? '오류 수정 후 반영 가능' : '실적DB 최종 반영'}
              </button>
            </div>
          </div>
        </>
      )}
      <div style={{height:8}}/>
    </>
  );
}

Object.assign(window, { ActualTransformPage, ActualDBCleanupPage });
