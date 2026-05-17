/* [Component: UploadPage] — 실제 CSV/XLSX 파싱 + localStorage 저장
   actualUploadParser.ts 로직 포팅 */
const { useState: useUpSt, useRef: useUpRef } = React;

const STEPS = [
  { id:0, label:'파일 선택' },
  { id:1, label:'검증 결과' },
  { id:2, label:'미리보기'  },
  { id:3, label:'DB 반영'  },
];

function UploadStepper({ step }) {
  return (
    <div className="stepper cb"><span className="cbl">Stepper</span>
      {STEPS.map((s,i) => (
        <React.Fragment key={s.id}>
          <div className={`step${step===i?' active':step>i?' done':''}`}>
            <div className="step-num">{step>i?'✓':i+1}</div>
            <div className="step-label">{s.label}</div>
          </div>
          {i < STEPS.length-1 && <div className={`step-line${step>i?' done':''}`}/>}
        </React.Fragment>
      ))}
    </div>
  );
}

function UploadPage({ state, onNav }) {
  const D = window.HYCMData;
  const [step, setStep] = useUpSt(0);
  const [file, setFile] = useUpSt(null);
  const [year, setYear] = useUpSt('2026');
  const [validation, setValidation] = useUpSt(null);
  const [saving, setSaving] = useUpSt(false);
  const [saved, setSaved] = useUpSt(false);
  const [err, setErr] = useUpSt('');
  const fileRef = useUpRef();

  const log = D.getUploadLog();

  /* ── Parse file ── */
  async function handleParse(f) {
    setErr(''); setValidation(null);
    try {
      let headers, records;

      if (f.name.endsWith('.csv') || f.type === 'text/csv') {
        const text = await f.text();
        const parsed = D.parseCSV(text);
        headers  = parsed.headers;
        records  = parsed.records;
      } else if (window.XLSX) {
        // SheetJS
        const buf = await f.arrayBuffer();
        const wb  = XLSX.read(buf, { type:'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        const rawH = (json[0] || []).map(h => String(h));
        headers   = rawH;
        const normH = rawH.map(D.normalizeHeader);
        records   = json.slice(1).filter(row => row.some(v=>v!==''&&v!==null)).map(row => {
          const rec = {};
          normH.forEach((k,i) => { rec[k] = row[i] ?? ''; });
          return rec;
        });
      } else {
        setErr('xlsx 파일 지원을 위해 SheetJS 라이브러리가 필요합니다. CSV 형식을 사용해주세요.');
        return;
      }

      if (!headers || headers.length === 0) { setErr('파일에서 헤더를 읽을 수 없습니다.'); return; }

      const result = D.parseRecords(headers, records, year);
      setValidation({ ...result, headers, recordCount: records.length });
      setStep(1);
    } catch(e) {
      setErr(`파일 파싱 오류: ${e.message}`);
    }
  }

  function handleFileSelect(f) {
    if (!f) return;
    setFile(f); setSaved(false); setValidation(null); setStep(0);
  }

  async function handleSave() {
    if (!validation?.data?.length) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 600)); // UX feedback
    const ok = D.saveActuals(year, validation.data);
    setSaving(false);
    if (ok) { setSaved(true); setStep(3); }
    else setErr('저장 실패. 브라우저 저장 공간을 확인해주세요.');
  }

  return (
    <>
      <div className="pg-hdr cb"><span className="cbl">PageHeader</span>
        <div>
          <div className="pg-title">실적 업로드</div>
          <div className="pg-sub">ERP에서 추출한 엑셀/CSV 실적 파일을 업로드하고 검증합니다.</div>
        </div>
        <div className="flex-1"/>
        <div className="filter-group">
          <label className="filter-label">기준 연도</label>
          <select className="filter-sel" value={year} onChange={e=>setYear(e.target.value)}>
            {['2026','2025','2024'].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <UploadStepper step={step}/>

      {/* Step 0: 파일 선택 */}
      {step === 0 && (
        <div className="card cb"><span className="cbl">UploadArea</span>
          <div className="card-head"><span className="card-title">파일 선택</span><span className="card-sub">xlsx · csv 지원</span></div>
          <div className="card-body">
            <div className="drop-zone"
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f){handleFileSelect(f);}}}
              onClick={()=>fileRef.current?.click()}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {file
                ? <><div className="drop-file">{file.name}</div><div className="drop-sub">{(file.size/1024).toFixed(1)} KB · 클릭하거나 드래그하여 다른 파일 선택</div></>
                : <><div className="drop-msg">파일을 여기에 드래그하거나 클릭하여 선택</div><div className="drop-sub">지원 형식: .xlsx, .csv · 귀속부서코드 / 계정코드 / 월별실적 컬럼 필요</div></>
              }
              <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFileSelect(f);}}/>
            </div>

            {err && <div style={{marginTop:10,padding:'8px 12px',background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--rsm)',fontSize:12,color:'var(--red)'}}>{err}</div>}

            {/* 지원 형식 안내 */}
            <div style={{marginTop:16,padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--rsm)',fontSize:11,color:'var(--t3)',lineHeight:1.7}}>
              <div style={{fontWeight:600,color:'var(--t2)',marginBottom:4}}>지원 컬럼 형식</div>
              <div>① <strong>실적 월별 Wide 형식</strong>: 귀속부서코드 / 계정코드 / 귀속부서 / 1월실적 ~ 12월실적</div>
              <div>② <strong>실적 Flat 형식</strong>: 기간 / 계정코드 / 귀속부서코드 / 완료실적</div>
              <div style={{marginTop:4,color:'var(--amber)'}}>※ 헤더 이름이 다를 경우 "실적 변환" 페이지에서 컬럼 매핑 후 업로드하세요.</div>
            </div>

            {/* 최근 업로드 이력 */}
            {log.length > 0 && (
              <div style={{marginTop:16}}>
                <div className="aside-title" style={{marginBottom:8}}>최근 업로드 이력</div>
                <table className="tbl">
                  <thead><tr><th style={{textAlign:'left'}}>파일명</th><th style={{textAlign:'left'}}>업로드 일시</th><th>건수</th><th>상태</th></tr></thead>
                  <tbody>
                    {log.slice(0,5).map((l,i)=>(
                      <tr key={i} className="tbl-row-hover">
                        <td style={{textAlign:'left',color:'var(--t2)'}}>{l.fileName}</td>
                        <td style={{textAlign:'left',color:'var(--t3)',fontSize:11}}>{new Date(l.uploadedAt).toLocaleString('ko-KR')}</td>
                        <td>{l.rowCount?.toLocaleString()}</td>
                        <td><span className="badge green">{l.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card-foot" style={{justifyContent:'flex-end'}}>
            <button className="btn sm primary" disabled={!file} onClick={()=>handleParse(file)} style={{opacity:file?1:.5}}>
              검증 시작 →
            </button>
          </div>
        </div>
      )}

      {/* Step 1: 검증 결과 */}
      {step === 1 && validation && (
        <div className="card cb"><span className="cbl">ValidationResult</span>
          <div className="card-head">
            <span className="card-title">검증 결과</span>
            <span className="card-sub">포맷: {validation.format}</span>
          </div>
          <div className="card-body">
            {/* Summary KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--gap)',marginBottom:16}}>
              {[
                {label:'전체 행',  val:validation.totalRows,  type:'gray' },
                {label:'정상 행',  val:validation.validRows,  type:'green'},
                {label:'오류 행',  val:validation.errorRows,  type: validation.errorRows>0?'red':'green'},
                {label:'경고 행',  val:validation.warnRows,   type: validation.warnRows>0?'amber':'green'},
              ].map(k=>(
                <div className="kpi" key={k.label}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-val" style={{fontSize:22}}>{k.val}</div>
                </div>
              ))}
            </div>

            {validation.format === 'UNKNOWN' && (
              <div style={{padding:'12px 14px',background:'var(--red-bg)',borderRadius:'var(--rsm)',fontSize:12,color:'var(--red)',marginBottom:12}}>
                파일 형식을 인식할 수 없습니다. 실적 변환 페이지에서 컬럼 매핑 후 재업로드하세요.
              </div>
            )}

            {validation.issues?.length > 0 && (
              <table className="tbl">
                <thead><tr><th style={{textAlign:'left'}}>유형</th><th style={{textAlign:'left'}}>내용</th></tr></thead>
                <tbody>
                  {validation.issues.slice(0,20).map((iss,i)=>(
                    <tr key={i}>
                      <td style={{textAlign:'left'}}><span className={`badge ${iss.severity==='error'?'red':'amber'}`}>{iss.severity==='error'?'오류':'경고'}</span></td>
                      <td style={{textAlign:'left',fontSize:11}}>{iss.message}</td>
                    </tr>
                  ))}
                  {validation.issues.length > 20 && <tr><td colSpan={2} style={{textAlign:'center',color:'var(--t3)',fontSize:11}}>...외 {validation.issues.length-20}건</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <div className="card-foot">
            <button className="btn sm" onClick={()=>setStep(0)}>← 다시 선택</button>
            {validation.validRows > 0 && (
              <button className="btn sm primary" style={{marginLeft:'auto'}} onClick={()=>setStep(2)}>미리보기 →</button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: 미리보기 */}
      {step === 2 && validation && (
        <div className="card cb"><span className="cbl">DataPreview</span>
          <div className="card-head">
            <span className="card-title">저장 전 미리보기</span>
            <span className="card-sub">{validation.validRows}건 반영 예정</span>
          </div>
          <div style={{padding:0}}>
            <table className="tbl">
              <thead><tr>
                <th style={{textAlign:'left',paddingLeft:16}}>부서코드</th>
                <th style={{textAlign:'left'}}>계정코드</th>
                <th style={{textAlign:'left'}}>기간</th>
                <th>완료실적</th>
              </tr></thead>
              <tbody>
                {validation.data.slice(0,10).map((r,i)=>(
                  <tr key={i} className="tbl-row-hover">
                    <td style={{textAlign:'left',paddingLeft:16,color:'var(--t3)'}}>{r.usageCode}</td>
                    <td style={{textAlign:'left',color:'var(--t2)'}}>{r.accountCode}</td>
                    <td style={{textAlign:'left',color:'var(--t3)'}}>{r.period}</td>
                    <td style={{fontWeight:600}}>{r.completed?.toLocaleString()}</td>
                  </tr>
                ))}
                {validation.data.length > 10 && (
                  <tr><td colSpan={4} style={{textAlign:'center',color:'var(--t3)',fontSize:11,padding:'8px'}}>...총 {validation.data.length}건</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <button className="btn sm" onClick={()=>setStep(1)}>← 이전</button>
            <span style={{fontSize:11,color:'var(--t3)'}}>{year}년 실적DB에 반영 · 기존 데이터 덮어쓰기</span>
            <button className="btn sm primary" style={{marginLeft:'auto'}} disabled={saving} onClick={handleSave}>
              {saving ? '저장 중...' : '실적DB에 반영 →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 완료 */}
      {step === 3 && (
        <div className="card cb"><span className="cbl">UploadComplete</span>
          <div className="card-body" style={{textAlign:'center',padding:'48px 24px'}}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" style={{margin:'0 auto 12px',display:'block'}}>
              <circle cx={12} cy={12} r={10} stroke="var(--green)" strokeWidth="1.5"/>
              <path d="M8 12l3 3 5-5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{fontSize:15,fontWeight:700,color:'var(--t1)',marginBottom:6}}>실적DB 반영 완료</div>
            <div style={{fontSize:12,color:'var(--t3)',marginBottom:20}}>{validation?.validRows || 0}건이 {year}년 실적DB에 저장되었습니다.</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button className="btn sm" onClick={()=>{setStep(0);setFile(null);setValidation(null);setSaved(false);}}>새 파일 업로드</button>
              <button className="btn sm primary" onClick={()=>onNav('dashboard')}>대시보드 확인 →</button>
            </div>
          </div>
        </div>
      )}

      <div style={{height:8}}/>
    </>
  );
}

Object.assign(window, { UploadPage });
