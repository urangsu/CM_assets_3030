import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  FileSpreadsheet, 
  Save, 
  Settings, 
  Database, 
  Clipboard, 
  Info, 
  FileText, 
  Calendar 
} from 'lucide-react';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { PRODUCT_NAME_MAP, getLithiumConversionRates, saveLithiumConversionRates } from '../lib/operation/productMaster';
import { parseProductLedgerRows, ProductLedgerRecord } from '../lib/operation/productLedgerParser';
import { parseRawMaterialLedgerRows } from '../lib/operation/rawMaterialLedgerParser';
import { OperationStorage, OperationUploadHistory, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';
import * as XLSX from 'xlsx';

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  if (str === '-' || str === '') return 0;
  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
}

export default function OperationUpload() {
  const [activeTab, setActiveTab] = useState<'product' | 'raw_material' | 'history'>('product');
  const [year, setYear] = useState<string>('2026');
  const [month, setMonth] = useState<number>(5);
  const [pasteData, setPasteData] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  
  // Validation, lists, and histories
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    rowLength: number;
    parsedProducts: string[];
    summary: {
      production: number;
      sales: number;
      endingInventory: number;
      revenue: number;
    };
    records: any[];
    error?: string;
  } | null>(null);

  const [rawValidationResult, setRawValidationResult] = useState<{
    success: boolean;
    rowLength: number;
    normalCount: number;
    warningCount: number;
    errorCount: number;
    warnings: string[];
    errors: string[];
    headerDetected: boolean;
    summary: {
      receipts: number;
      issues: number;
      ending: number;
    };
    records: RawMaterialLedgerRecord[];
  } | null>(null);

  const [historyList, setHistoryList] = useState<OperationUploadHistory[]>([]);
  const [lithiumRates, setLithiumRates] = useState<Record<string, number>>({});
  const [editingYear, setEditingYear] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const [rawGroupMapping, setRawGroupMapping] = useState<Record<string, 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타'>>({});
  const [newMappingCode, setNewMappingCode] = useState('');
  const [newMappingGroup, setNewMappingGroup] = useState<'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타'>('BP');

  useEffect(() => {
    setHistoryList(OperationStorage.getUploadHistory());
    setLithiumRates(getLithiumConversionRates());

    const storedMapping = localStorage.getItem('hycm_raw_material_group_mapping');
    if (storedMapping) {
      try {
        setRawGroupMapping(JSON.parse(storedMapping));
      } catch {
        setRawGroupMapping({});
      }
    } else {
      const defaultMapping: Record<string, 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타'> = {
        'B111OT-ETC-ETC': 'BP',
        'B622WE-USA-ABT': 'BM',
        'BLCOCE-IND-ANS': 'LCO',
        'MN-MN3O4': 'MN'
      };
      localStorage.setItem('hycm_raw_material_group_mapping', JSON.stringify(defaultMapping));
      setRawGroupMapping(defaultMapping);
    }
  }, []);

  const handleSaveGroupMapping = (code: string, group: 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타') => {
    const updated = { ...rawGroupMapping, [code]: group };
    setRawGroupMapping(updated);
    localStorage.setItem('hycm_raw_material_group_mapping', JSON.stringify(updated));
    window.dispatchEvent(new Event('operation-ledger-changed'));
  };

  const handleAddGroupMapping = () => {
    if (!newMappingCode.trim()) return;
    const cleanCode = newMappingCode.trim().toUpperCase();
    const updated = { ...rawGroupMapping, [cleanCode]: newMappingGroup };
    setRawGroupMapping(updated);
    localStorage.setItem('hycm_raw_material_group_mapping', JSON.stringify(updated));
    setNewMappingCode('');
    window.dispatchEvent(new Event('operation-ledger-changed'));
    alert(`[완료] 품목 매핑 등록 성공: ${cleanCode} -> ${newMappingGroup}`);
  };

  const handleDeleteGroupMapping = (code: string) => {
    const updated = { ...rawGroupMapping };
    delete updated[code];
    setRawGroupMapping(updated);
    localStorage.setItem('hycm_raw_material_group_mapping', JSON.stringify(updated));
    window.dispatchEvent(new Event('operation-ledger-changed'));
  };

  const handleUpdateHistoryAndList = () => {
    setHistoryList(OperationStorage.getUploadHistory());
  };

  const resetUploadState = () => {
    setPasteData('');
    setFile(null);
    setValidationResult(null);
    setRawValidationResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setPasteData(''); // Clear paste data
    }
  };

  // --- Parser and Validator for Product Ledger ---
  const handleValidateProductLedger = () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            setValidationResult({
              success: false,
              rowLength: 0,
              parsedProducts: [],
              summary: { production: 0, sales: 0, endingInventory: 0, revenue: 0 },
              records: [],
              error: '엑셀 파일에 활성화된 시트가 없습니다.'
            });
            return;
          }
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          processProductArrayAndValidate(jsonData);
        } catch (err: any) {
          setValidationResult({
            success: false,
            rowLength: 0,
            parsedProducts: [],
            summary: { production: 0, sales: 0, endingInventory: 0, revenue: 0 },
            records: [],
            error: `파일 파싱 중 에러 발생: ${err.message || err}`
          });
        }
      };
      reader.readAsBinaryString(file);
    } else if (pasteData.trim()) {
      try {
        const rows = pasteData.trim().split('\n').map(row => row.split('\t'));
        processProductArrayAndValidate(rows);
      } catch (err: any) {
        setValidationResult({
          success: false,
          rowLength: 0,
          parsedProducts: [],
          summary: { production: 0, sales: 0, endingInventory: 0, revenue: 0 },
          records: [],
          error: `붙여넣기 데이터 형식 및 탭 분할 오류: ${err.message || err}`
        });
      }
    } else {
      alert('엑셀 파일을 업로드하거나, 스프레드시트 영역을 아래 텍스트박스에 복사/붙여넣기 후 시도해 주십시오.');
    }
  };

  const processProductArrayAndValidate = (jsonData: any[][]) => {
    // We pass lines to parseProductLedgerRows
    const parsed = parseProductLedgerRows(jsonData, year, month);
    if (parsed.length === 0) {
      setValidationResult({
        success: false,
        rowLength: 0,
        parsedProducts: [],
        summary: { production: 0, sales: 0, endingInventory: 0, revenue: 0 },
        records: [],
        error: '황산니켈, 황산코발트, 탄산리튬, 황산망간, 구리 등 인식 가능한 제품 수불 묶음(B열단위=수량/금액/단가)을 찾을 수 없거나 데이터 서식이 맞지 않습니다.'
      });
      return;
    }

    // Get unique recognized names
    const names = Array.from(new Set(parsed.map(p => p.productName)));
    
    // Total numbers for summary (filter '수량' for Qty-based counts)
    const qtyRecords = parsed.filter(v => v.unit === '수량');
    const productionSum = qtyRecords.reduce((acc, r) => acc + (r.normalReceipt || 0), 0);
    const salesSum = qtyRecords.reduce((acc, r) => acc + (r.salesQuantity || 0), 0);
    const endInvSum = qtyRecords.reduce((acc, r) => acc + (r.endingInventory || 0), 0);
    
    // Revenue from '수량' unit row T-column (represented inside each record instance already)
    // T열은 수량 Row에 매출액이 저장됨
    const revenueSum = qtyRecords.reduce((acc, r) => acc + (r.revenue || 0), 0);

    setValidationResult({
      success: true,
      rowLength: parsed.length,
      parsedProducts: names,
      summary: {
        production: productionSum,
        sales: salesSum,
        endingInventory: endInvSum,
        revenue: revenueSum
      },
      records: parsed
    });
  };

  const handleSaveProductLedger = () => {
    if (!validationResult || !validationResult.success || validationResult.records.length === 0) {
      alert('먼저 데이터를 검증해 주십시오.');
      return;
    }

    try {
      const recordsToSave = validationResult.records;
      OperationStorage.saveProductRecords(year, month, recordsToSave);
      
      // Save history item too
      OperationStorage.addUploadHistory({
        year,
        month,
        type: 'product',
        fileName: file ? file.name : `${year}년 ${month}월 복사-붙여넣기 수동입력`,
        rowLength: recordsToSave.length
      });

      alert(`[완료] ${year}년 ${month}월 제품수불부 데이터(${recordsToSave.length}개 유닛 행)가 성공적으로 저장 및 덮어쓰기되었습니다.`);
      resetUploadState();
      handleUpdateHistoryAndList();
    } catch (e: any) {
      alert(`저장 중 오류 발생: ${e.message || e}`);
    }
  };

  // --- Parser and Validator for Raw Material Ledger ---
  const handleValidateRawMaterial = () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            alert('시트가 없습니다.');
            return;
          }
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          processRawMaterialArrayAndValidate(jsonData);
        } catch (err: any) {
          alert(`에러: ${err.message || err}`);
        }
      };
      reader.readAsBinaryString(file);
    } else if (pasteData.trim()) {
      try {
        const rows = pasteData.trim().split('\n').map(row => row.split('\t'));
        processRawMaterialArrayAndValidate(rows);
      } catch (err: any) {
        alert(`에러: ${err.message || err}`);
      }
    } else {
      alert('원자재수불부 데이터를 로딩할 엑셀 혹은 복사영역 데이터를 입력해 주십시오.');
    }
  };

  const processRawMaterialArrayAndValidate = (jsonData: any[][]) => {
    const records = parseRawMaterialLedgerRows(jsonData, year, month);

    if (jsonData.length === 0 || records.length === 0) {
      setRawValidationResult({
        success: false,
        rowLength: 0,
        normalCount: 0,
        warningCount: 0,
        errorCount: 1,
        warnings: [],
        errors: ['인식 가능한 원자재 3행 묶음(수량/금액/단가)을 찾지 못했습니다. 품목코드(A열), 기초(B열), 구매(C열), 이동(D열), 입고합계(E열) 등으로 구성된 3행 묶음 형식을 확인해 주세요.'],
        headerDetected: false,
        summary: { receipts: 0, issues: 0, ending: 0 },
        records: []
      });
      return;
    }

    // Checking headers
    let headerDetected = false;
    for (const row of jsonData.slice(0, 15)) {
      for (const cell of row) {
        const textStr = String(cell || '').trim();
        if (textStr.includes('원자재수불부') || textStr.includes('기초') || textStr.includes('입고') || textStr.includes('출고') || textStr.includes('수품') || textStr.includes('기말') || textStr.includes('이동')) {
          headerDetected = true;
          break;
        }
      }
      if (headerDetected) break;
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    if (!headerDetected) {
      warnings.push('헤더 감지 실패: 파일 상단에서 "원자재수불부" 또는 "기초", "입고" 등의 표준 수불 단어가 감지되지 않았습니다.');
    }

    function formatKRWMillion(val: number) {
      return `${Math.round(val / 1_000_000).toLocaleString()}백만원`;
    }

    // Run verification on each parsed record
    records.forEach((r) => {
      // 1. Missing item code
      if (!r.rawItemCode) {
        errors.push(`A열의 품목코드가 누락되었습니다.`);
      }

      // 2. Missing row checking inside the 3-row cluster
      if (!r.amountRowLabel) {
        errors.push(`품목 [${r.rawItemCode}]: 금액 행(2번째 행)의 라벨이 누락되었습니다.`);
      }
      if (!r.unitPriceRowLabel) {
        errors.push(`품목 [${r.rawItemCode}]: 단가 행(3번째 행)의 라벨이 누락되었습니다.`);
      }

      // 3. 입고합계 검증: 기초가 아니라 구매+이동 = 입고합계
      const sumReceiptQty = r.purchaseQty + r.transferInQty;
      const receiptDiff = Math.abs(sumReceiptQty - r.receiptTotalQty);
      if (receiptDiff > 0.1) {
        warnings.push(`[${r.rawItemCode}] 입고합계 불일치: 구매(${r.purchaseQty.toFixed(1)}) + 이동입고(${r.transferInQty.toFixed(1)}) = ${sumReceiptQty.toFixed(1)} Ton, 표기된 입고합계(${r.receiptTotalQty.toFixed(1)})와 ${receiptDiff.toFixed(1)} Ton 차이`);
      }

      // 4. 출고합계 검증: 공정+판매+견본+이동+폐기+개발비용+개발자산+시운전+기타 = 출고합계
      const sumIssueQty = r.processIssueQty + r.salesIssueQty + r.sampleIssueQty + r.transferIssueQty + r.disposalIssueQty + r.devExpenseIssueQty + r.devAssetIssueQty + r.pilotIssueQty + r.otherIssueQty;
      const issueDiff = Math.abs(sumIssueQty - r.issueTotalQty);
      if (issueDiff > 0.1) {
        warnings.push(`[${r.rawItemCode}] 출고합계 불일치: 세부 소계 합산(${sumIssueQty.toFixed(1)})과 표기된 출고합계(${r.issueTotalQty.toFixed(1)}) 사이에 ${issueDiff.toFixed(1)} Ton 차이`);
      }

      // 5. 기말 검증: 기초재고 + 입고합계 - 출고합계 = 기말재고
      const expectedEnd = r.beginningQty + r.receiptTotalQty - r.issueTotalQty;
      const endingDiff = Math.abs(expectedEnd - r.endingQty);
      if (endingDiff > 0.1) {
        warnings.push(`${r.rawItemCode}: 기말재고 산식 차이 ${endingDiff.toFixed(1)} Ton (산식값: 기초[${r.beginningQty.toFixed(1)}] + 입고[${r.receiptTotalQty.toFixed(1)}] - 출고[${r.issueTotalQty.toFixed(1)}] = ${expectedEnd.toFixed(1)}, 표기기말: ${r.endingQty.toFixed(1)})`);
      }

      // 6. 금액/수량/단가 검증: 금액 ÷ 수량 ≈ 단가
      if (r.beginningQty > 0.1 && r.beginningUnitPrice > 0) {
        const productAmt = r.beginningQty * r.beginningUnitPrice;
        const diffAmt = Math.abs(productAmt - r.beginningAmount);
        if (diffAmt > 5000000) {
          warnings.push(`[${r.rawItemCode}] 기초재고의 (수량 x 단가)와 금액 편차: ${formatKRWMillion(diffAmt)} 차이`);
        }
      }
      if (r.purchaseQty > 0.1 && r.purchaseUnitPrice > 0) {
        const productAmt = r.purchaseQty * r.purchaseUnitPrice;
        const diffAmt = Math.abs(productAmt - r.purchaseAmount);
        if (diffAmt > 5000000) {
          warnings.push(`[${r.rawItemCode}] 당기구매의 (수량 x 단가)와 금액 편차: ${formatKRWMillion(diffAmt)} 차이`);
        }
      }
      if (r.endingQty > 0.1 && r.endingUnitPrice > 0) {
        const productAmt = r.endingQty * r.endingUnitPrice;
        const diffAmt = Math.abs(productAmt - r.endingAmount);
        if (diffAmt > 5000000) {
          warnings.push(`[${r.rawItemCode}] 기말재고의 (수량 x 단가)와 금액 편차: ${formatKRWMillion(diffAmt)} 차이`);
        }
      }

      // 7. 원료군 분류 결과 경고
      if (r.materialGroup === 'MN') {
        warnings.push(`${r.rawItemCode}: 원료군 MN으로 분류됨, 대시보드 요약 제외`);
      } else if (r.materialGroup === '기타') {
        warnings.push(`${r.rawItemCode}: 원료군 '기타'로 분류됨`);
      }
    });

    const receiptsSum = records.reduce((acc, r) => acc + r.receiptTotalQty, 0);
    const issuesSum = records.reduce((acc, r) => acc + r.issueTotalQty, 0);
    const endingSum = records.reduce((acc, r) => acc + r.endingQty, 0);

    const errorCount = errors.length;
    const warningCount = warnings.length;
    const normalCount = Math.max(0, records.length - errorCount);

    setRawValidationResult({
      success: errors.length === 0,
      rowLength: records.length,
      normalCount,
      warningCount,
      errorCount,
      warnings,
      errors,
      headerDetected,
      summary: {
        receipts: receiptsSum,
        issues: issuesSum,
        ending: endingSum
      },
      records
    });
  };

  const handleSaveRawMaterial = () => {
    if (!rawValidationResult || rawValidationResult.records.length === 0) {
      alert('먼저 데이터를 검증해 주십시오.');
      return;
    }

    if (rawValidationResult.errorCount > 0) {
      alert(`[오류] 검증 오류가 ${rawValidationResult.errorCount}건 존재합니다. 오류 목록을 해결한 뒤 다시 시도해 주십시오.`);
      return;
    }

    try {
      const recordsToSave = rawValidationResult.records;
      OperationStorage.saveRawMaterialRecords(year, month, recordsToSave);
      
      OperationStorage.addUploadHistory({
        year,
        month,
        type: 'raw_material',
        fileName: file ? file.name : `${year}년 ${month}월 원자재 복사입력`,
        rowLength: recordsToSave.length
      });

      let alertMsg = `[완료] ${year}년 ${month}월 원자재 수불 데이터(${recordsToSave.length}품목)가 정상적으로 반영되었습니다.`;
      if (rawValidationResult.warningCount > 0) {
        alertMsg += `\n(주의: 경고 항목 ${rawValidationResult.warningCount}건이 존재합니다.)`;
      }
      alert(alertMsg);
      resetUploadState();
      handleUpdateHistoryAndList();
    } catch (e: any) {
      alert(`저장 중 오류: ${e.message || e}`);
    }
  };

  // --- Lithium Rate Handlers ---
  const handleEditRate = (yr: string, val: number) => {
    setEditingYear(yr);
    setEditingValue(String(val));
  };

  const handleSaveRate = (yr: string) => {
    const parsedVal = parseFloat(editingValue);
    if (isNaN(parsedVal) || parsedVal <= 0 || parsedVal > 100) {
      alert('1에서 100 사이의 소수를 입력해 주십시오.');
      return;
    }

    const nextRates = { ...lithiumRates, [yr]: parsedVal };
    setLithiumRates(nextRates);
    saveLithiumConversionRates(nextRates);
    setEditingYear(null);
    alert(`${yr}년 탄산리튬 Li 함량이 ${parsedVal}%로 수정되었습니다. 앞으로 수불부 업로드 시 자동 적용됩니다.`);
  };

  // --- History Delete ---
  const handleDeleteHistory = (id: string, name: string) => {
    if (window.confirm(`[확인] '${name}' 업로드 이력을 정말 삭제하시겠습니까? 해당 수불부 연동 기록이 영구히 제거됩니다.`)) {
      OperationStorage.deleteUploadHistory(id);
      handleUpdateHistoryAndList();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-[#dde5de] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded font-bold font-mono">Operation Module Upload</span>
          <span className="text-xs bg-emerald-50 text-[#008f83] px-2 py-0.5 rounded font-bold">수불부 기반 연동 센터</span>
        </div>
        <h2 className="text-[20px] font-bold text-[#111111] leading-tight mt-1.5 font-sans">
          운영모듈 수불부 업로드 관리
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          제품 및 원자재수불부를 일괄 주입/복사하여 당기 생산실적·판매현황·매출액/매출원가/재고평가 및 기말재고 현황을 실시간 자동 갱신합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e8eb] mb-2 p-1 bg-white rounded-xl gap-2 shadow-xs">
        {[
          { key: 'product', label: '제품수불부 업로드', icon: FileSpreadsheet },
          { key: 'raw_material', label: '원자재수불부 업로드', icon: Database },
          { key: 'history', label: '업로드 이력 및 관리', icon: Clipboard }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                resetUploadState();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-[#4e5968] hover:bg-[#f2f4f6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab !== 'history' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controls Card */}
          <AppCard className="p-6 md:col-span-2 space-y-6">
            <h3 className="text-sm font-bold text-[#191f28] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-500" />
              1단계. 업로드 기본 세부사항 설정
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#4e5968] mb-1.5">대상 연도</label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    resetUploadState();
                  }}
                  className="w-full text-xs p-2 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all"
                >
                  {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                    <option key={yr} value={yr}>{yr}년</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#4e5968] mb-1.5">대상 월</label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(Number(e.target.value));
                    resetUploadState();
                  }}
                  className="w-full text-xs p-2 bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-bold text-[#4e5968] mb-2 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-brand-500" />
                방법 A. 엑셀 파일 가져오기 (.xlsx, .xls)
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 transition-all cursor-pointer"
                />
                {file && (
                  <button onClick={() => setFile(null)} className="text-xs text-red-500 font-semibold hover:underline">
                    취소
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-[#e5e8eb]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-zinc-400 font-bold font-mono">OR</span>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-bold text-[#4e5968] mb-2 flex items-center gap-1.5">
                <Clipboard className="w-3.5 h-3.5 text-brand-500" />
                방법 B. 스프레드시트 복사영역 직접 붙여넣기 (Clipboard TSV)
              </h3>
              <textarea
                value={pasteData}
                onChange={(e) => {
                  setPasteData(e.target.value);
                  setFile(null); // Clear file
                }}
                className="w-full h-32 p-3 text-xs font-mono bg-[#f7f9f7] border border-[#dde5de] rounded-xl focus:border-brand-500 focus:bg-white focus:outline-none transition-all"
                placeholder="엑셀에서 A열부터 T열까지의 데이터를 드래그하여 복사(Ctrl+C)한 후 여기에 붙여넣기(Ctrl+V) 해주세요..."
              />
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-500 bg-[#f8f9fa] p-2 rounded-lg">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>정상입고 컬럼(D열)=생산실적, 판매수율 컬럼(I열)=판매현황, 기말수량 컬럼(Q열)=기말생산재고, 손익 컬럼(T열)=매출/원가/이익으로 매핑됩니다.</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-[#e5e8eb]">
              <AppButton 
                onClick={activeTab === 'product' ? handleValidateProductLedger : handleValidateRawMaterial} 
                className="bg-[#f0f3f1] border border-[#dde5de] text-zinc-700 hover:bg-[#e4ebd3]"
              >
                데이터 무결성 검증
              </AppButton>
              <AppButton 
                onClick={activeTab === 'product' ? handleSaveProductLedger : handleSaveRawMaterial} 
                className="bg-brand-500 text-white hover:bg-brand-600"
                disabled={activeTab === 'product' ? !validationResult?.success : (!rawValidationResult || rawValidationResult.errorCount > 0)}
              >
                <Save className="w-4 h-4 mr-1.5 inline-block" />
                수불부 최종 반영 및 저장
              </AppButton>
            </div>
          </AppCard>

          {/* Validation Result Sidebar Card */}
          <div className="space-y-4">
            <AppCard className="p-6">
              <h3 className="text-sm font-bold text-[#191f28] mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-600" />
                실시간 파싱 및 정밀 검증 결과
              </h3>

              {activeTab === 'product' ? (
                validationResult ? (
                  validationResult.success ? (
                    <div className="space-y-4 text-xs">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#008f83] rounded-xl flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">검증 완전 성공!</p>
                          <p className="text-[11px]">수불부 포맷 및 3행 블록 묶음 구조가 우수하게 인식되었습니다.</p>
                        </div>
                      </div>

                      <div className="space-y-2.5 bg-[#f8f9fa] p-3 rounded-xl border border-zinc-150">
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-semibold">총 인식 행:</span>
                          <span className="font-mono font-bold text-zinc-900">{validationResult.rowLength}행 (3행 패턴)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-semibold">인식된 제품군 ({validationResult.parsedProducts.length}개):</span>
                          <span className="font-bold text-slate-850 text-right">{validationResult.parsedProducts.join(', ')}</span>
                        </div>
                        <div className="border-t border-[#e5e8eb] my-2 pt-2 text-[11px] font-bold text-[#4e5968] uppercase font-mono">수량 & 손익 누적 지표</div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-500">당기 생산 (D열 합계):</span>
                          <span className="font-bold font-mono text-emerald-700">{validationResult.summary.production.toLocaleString()} Pt/Mt</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-500">판매량 (I열 합계):</span>
                          <span className="font-bold font-mono text-blue-700">{validationResult.summary.sales.toLocaleString()} Pt/Mt</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-500">기말재고 (Q열 합계):</span>
                          <span className="font-bold font-mono text-amber-700">{validationResult.summary.endingInventory.toLocaleString()} Pt/Mt</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-500">매출액 (T열 합계):</span>
                          <span className="font-bold font-mono text-purple-700">₩{validationResult.summary.revenue.toLocaleString()}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-400 italic">
                        *참고: 탄산리튬은 Li 함량({getLithiumConversionRates()[year] || 18.75}%)에 따라 자동 환산 계수가 적용되었습니다.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-xs">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">검증 실패 / 규격 미조율</p>
                        <p className="text-[11px] mt-1">{validationResult.error}</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-400">
                    <Database className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    가져오기 및 파일 업로드 후 검증 버튼을 클릭하면 세부 검증 로그가 여기에 표기됩니다.
                  </div>
                )
              ) : (
                rawValidationResult ? (
                  <div className="space-y-4 text-xs">
                    {/* Header check badge */}
                    <div className="flex justify-between items-center bg-[#f8f9fa] p-2 rounded-lg border border-zinc-150">
                      <span className="text-zinc-500 font-semibold font-sans">1. 헤더 표준 감지:</span>
                      {rawValidationResult.headerDetected ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">감지성공</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-bold">미감지(주의)</span>
                      )}
                    </div>

                    {/* Overall count */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5">
                      <div className="text-[11px] font-bold text-zinc-700 flex justify-between">
                        <span>2. 3행 품목 묶음 집계:</span>
                        <span className="font-mono text-zinc-900 font-extrabold">{rawValidationResult.rowLength}개 품목 감지</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 text-center font-sans">
                        <div className="bg-emerald-50 text-emerald-805 rounded p-1 text-[10px] font-bold">
                          정상: {rawValidationResult.normalCount}
                        </div>
                        <div className="bg-amber-50 text-amber-805 rounded p-1 text-[10px] font-bold">
                          주의: {rawValidationResult.warningCount}
                        </div>
                        <div className="bg-red-55 text-red-805 rounded p-1 text-[10px] font-bold">
                          오류: {rawValidationResult.errorCount}
                        </div>
                      </div>
                    </div>

                    {/* Validation logs (Errors) */}
                    {rawValidationResult.errors.length > 0 && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        <p className="text-[10px] font-bold text-red-650 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-500" /> 오류 로그 (저장 불가):
                        </p>
                        {rawValidationResult.errors.map((err, idx) => (
                          <div key={idx} className="p-1.5 bg-red-50 border border-red-150 text-red-750 rounded text-[10px] font-mono leading-tight">
                            • {err}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Validation logs (Warnings) */}
                    {rawValidationResult.warnings.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        <p className="text-[10px] font-bold text-amber-650 flex items-center gap-1">
                          <Info className="w-3 h-3 text-amber-500" /> 무결성 권고 및 경고 ({rawValidationResult.warningCount}건):
                        </p>
                        {rawValidationResult.warnings.map((warn, idx) => (
                          <div key={idx} className="p-1.5 bg-amber-50 border border-amber-150 text-amber-850 rounded text-[10px] font-mono leading-tight">
                            • {warn}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals Summary */}
                    <div className="space-y-2 bg-[#f8f9fa] p-3 rounded-xl border border-zinc-150">
                      <div className="text-[11px] font-bold text-zinc-700 mb-1 border-b pb-1 font-mono">수불 합산 단위 검증 (Ton)</div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500 font-sans">총 당기입고합계:</span>
                        <span className="font-mono font-bold text-emerald-700">{rawValidationResult.summary.receipts.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500 font-sans font-sans">총 당기출고합계:</span>
                        <span className="font-mono font-bold text-red-700">{rawValidationResult.summary.issues.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500 font-sans font-sans">기말 재고량 누적:</span>
                        <span className="font-mono font-bold text-indigo-700">{rawValidationResult.summary.ending.toLocaleString(undefined, { maximumFractionDigits: 1 })} Ton</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-400">
                    <Database className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    원자재 수불부 파일 업로드 또는 클립보드 복사입력 후 검증을 시작하십시오.
                  </div>
                )
              )}
            </AppCard>

            {/* Tab adaptive settings card */}
            {activeTab === 'product' ? (
              <AppCard className="p-6">
                <h3 className="text-xs font-bold text-[#191f28] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-700">
                    <Settings className="w-3.5 h-3.5 text-brand-600" />
                    탄산리튬 Li 함량(환산율) 마스터
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500 mb-3">
                  탄산리튬 원 수량을 Li 메탈 환산 물량으로 변환하는 함량 비율 마스터 수치입니다.
                </p>
                
                <div className="space-y-2">
                  {Object.entries(lithiumRates).sort().map(([yr, rateVal]) => {
                    const rate = rateVal as number;
                    return (
                      <div key={yr} className="flex justify-between items-center text-xs p-2 bg-[#f8f9fa] rounded-lg border border-zinc-150">
                        <span className="font-mono font-semibold text-zinc-600">{yr}년</span>
                        {editingYear === yr ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-16 p-1 text-right bg-white border border-[#dde5de] rounded text-xs font-mono font-bold"
                            />
                            <span className="text-zinc-500">%</span>
                            <button onClick={() => handleSaveRate(yr)} className="px-1.5 py-0.5 bg-brand-500 text-white rounded text-[10px] font-bold">
                              저장
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-700">{rate}%</span>
                            <button onClick={() => handleEditRate(yr, rate)} className="text-[10px] text-brand-600 font-semibold hover:underline">
                              수정
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AppCard>
            ) : (
              <AppCard className="p-6">
                <h3 className="text-xs font-bold text-[#191f28] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-700">
                    <Settings className="w-3.5 h-3.5 text-indigo-600" />
                    원자재 품목 매핑 마스터
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500 mb-3">
                  품목코드별 원료군 매핑 마스터입니다. 마스터에 등록된 코드는 업로드 검증 시 우선 순위로 반영됩니다.
                </p>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(rawGroupMapping).map(([code, g]) => (
                    <div key={code} className="flex justify-between items-center text-xs p-2 bg-[#f8f9fa] rounded-lg border border-zinc-150">
                      <span className="font-mono font-semibold text-zinc-600 truncate max-w-[120px]" title={code}>{code}</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={g}
                          onChange={(e) => handleSaveGroupMapping(code, e.target.value as any)}
                          className="text-[10px] p-1 bg-white border border-[#dde5de] rounded font-bold"
                        >
                          {['BP', 'BM', 'WET', 'LCO', 'MN', '기타'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteGroupMapping(code)}
                          className="text-[10px] text-red-500 font-bold hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-150 space-y-2">
                  <p className="text-[10px] font-bold text-zinc-700">새로운 품목 매핑 추가</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="품목코드 (예: B111-ETC)"
                      value={newMappingCode}
                      onChange={(e) => setNewMappingCode(e.target.value)}
                      className="text-[10px] p-1.5 border border-[#dde5de] bg-white rounded flex-1 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <select
                      value={newMappingGroup}
                      onChange={(e) => setNewMappingGroup(e.target.value as any)}
                      className="text-[10px] p-1.5 bg-white border border-[#dde5de] rounded font-bold"
                    >
                      {['BP', 'BM', 'WET', 'LCO', 'MN', '기타'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddGroupMapping}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-[10px] font-bold shrink-0"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </AppCard>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <AppCard className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#191f28] flex items-center gap-2">
                <FileText className="w-5 h-5 text-zinc-500" />
                운영 업로드 변경 이력 및 데이터 제어
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                지금까지 정상 등록된 이력입니다. 이력을 삭제하면 해당 년/월 수불부 연결 테이블도 자동 청소됩니다.
              </p>
            </div>
            <AppButton onClick={handleUpdateHistoryAndList} variant="secondary" className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1 inline-block" /> 이력 새로고침
            </AppButton>
          </div>

          {historyList.length === 0 ? (
            <div className="text-center py-12 border border-[#dde5de] border-dashed rounded-2xl bg-[#fafafa]">
              <Database className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-400">등록된 수불부 업로드 이력이 없습니다.</p>
              <p className="text-[10px] text-zinc-400 mt-1">제품수불부 탭 혹은 원자재수불부 탭에서 첫 업로드를 반영해 보십시오.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#e5e8eb] rounded-2xl shadow-xs">
              <table className="min-w-full divide-y divide-[#e5e8eb] text-left text-xs">
                <thead className="bg-[#f8f9fa] text-[#4e5968] font-bold font-mono">
                  <tr>
                    <th className="px-5 py-3">업로드 일시</th>
                    <th className="px-5 py-3 text-center">대상 구분</th>
                    <th className="px-5 py-3 text-center">연도 / 월</th>
                    <th className="px-5 py-3">업로드파일명/상세</th>
                    <th className="px-5 py-3 text-right">반영 행 개수</th>
                    <th className="px-5 py-3 text-center">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e8eb] bg-white">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f8f9fa]/50">
                      <td className="px-5 py-3.5 text-zinc-500 font-mono">
                        {new Date(item.uploadedAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold">
                        {item.type === 'product' ? (
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-blue-100">제품수불부</span>
                        ) : (
                          <span className="bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-orange-100">원자재수불</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono font-bold text-[#191f28]">
                        {item.year}년 {item.month}월
                      </td>
                      <td className="px-5 py-3.5 text-zinc-650 font-semibold max-w-xs truncate">
                        {item.fileName}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-700 font-mono">
                        {item.rowLength.toLocaleString()} Pt/Mt
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteHistory(item.id, `${item.year}년 ${item.month}월 ${item.type === 'product' ? '제품' : '원자재'}`)}
                          className="p-1 px-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors text-[10px] font-bold flex items-center gap-1 mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppCard>
      )}
    </div>
  );
}
