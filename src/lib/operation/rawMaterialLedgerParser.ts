import { RawMaterialLedgerRecord } from './operationStorage';

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  if (str === '-' || str === '') return 0;
  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
}

export function isRawItemCode(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (clean === '') return false;

  const blocked = [
    '합계', '소계', '총계', '구분', '단위', '품목', '원료', '금액', '수량', '단가',
    '이동', '출고', '입고', '기말', '기초', '평균', '누계', '원자재', '수불', '매매', '연도', '년도', '월', '비고', '계정'
  ];
  for (const b of blocked) {
    if (clean.includes(b)) return false;
  }

  // Ensure no Korean characters are in the code itself
  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(clean);
  if (hasKorean) return false;

  const hasLetter = /[A-Za-z]/.test(clean);
  if (!hasLetter) return false;

  // Code is typically shorter than 30 chars and does not have spaces
  if (clean.length > 30) return false;
  if (clean.includes(' ')) return false;

  return true;
}

export function resolveRawMaterialGroup(
  rawCode: string,
  amountRowName: string,
  priceRowName: string
): 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타' {
  const code = String(rawCode || '').trim().toUpperCase();
  const amount = String(amountRowName || '').trim().toUpperCase();
  const price = String(priceRowName || '').trim().toUpperCase();

  const context = `${code} ${amount} ${price}`
    .replace(/\s+/g, ' ')
    .trim();

  // 1. LCO: 코드 또는 하위 라벨에 LCO가 있으면 LCO
  if (
    code.startsWith('BLCO') ||
    /\bLCO\b/.test(context) ||
    context.includes('LITHIUM COBALT')
  ) {
    return 'LCO';
  }

  // 2. WET: 반드시 BM보다 먼저 판단
  // B622WE-USA-ABT, B622WT-..., B622WET-...,
  // 622 Wet(ABTC), Wet BM 모두 WET
  const wetSignals = [
    /^B\d*WE[A-Z0-9-]*/.test(code),
    /^B\d*WT[A-Z0-9-]*/.test(code),
    /^B\d*WET[A-Z0-9-]*/.test(code),
    code.includes('-WE'),
    code.includes('-WT'),
    code.includes('-WET'),
    /\bWET\b/.test(context),
    context.includes('WET BM'),
    context.includes('WETBM'),
  ];

  if (wetSignals.some(Boolean)) {
    return 'WET';
  }

  // 3. BP: 811 계열만 BP
  if (code.includes('811')) {
    return 'BP';
  }

  // 4. BM: 622 계열 중 WET 제외, 그리고 111 및 523 계열도 BM에 분류
  if (code.includes('622') || code.includes('111') || code.includes('523')) {
    return 'BM';
  }

  // 5. 망간류
  if (
    code.startsWith('MN') ||
    /\bMN\b/.test(context) ||
    context.includes('망간')
  ) {
    return 'MN';
  }

  // 6. 111, 523 등은 BP로 넣지 않음
  return '기타';
}

export function getRawMaterialGroup(rawCode: string, amountRowName: string, priceRowName: string): 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타' {
  const code = String(rawCode || '').trim().toUpperCase();
  const stored = localStorage.getItem('hycm_raw_material_group_mapping');
  if (stored) {
    try {
      const mapping = JSON.parse(stored);
      if (mapping[code]) {
        return mapping[code];
      }
    } catch {
      // ignore
    }
  }
  return resolveRawMaterialGroup(code, amountRowName, priceRowName);
}

const RAW_GROUP_MAPPING_VERSION_KEY = 'hycm_raw_material_group_mapping_version';
const RAW_GROUP_MAPPING_VERSION = '2026_raw_group_v4_111_523_bm';

export function migrateRawMaterialGroupMapping() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(RAW_GROUP_MAPPING_VERSION_KEY);

  if (current === RAW_GROUP_MAPPING_VERSION) return;

  const stored = localStorage.getItem('hycm_raw_material_group_mapping');

  if (stored) {
    try {
      const mapping = JSON.parse(stored);

      // 기존 잘못된 기본 매핑 제거
      delete mapping['B622WE-USA-ABT'];
      delete mapping['B622WT-USA-ABT'];
      delete mapping['B622WET-USA-ABT'];

      // 111/523 과거 매핑도 모두 함께 제거 (새 교체된 알고리즘의 BM 분류가 우선)
      Object.keys(mapping).forEach((key) => {
        const code = key.toUpperCase();
        if (code.includes('111') || code.includes('523')) {
          delete mapping[key];
        }
      });

      localStorage.setItem('hycm_raw_material_group_mapping', JSON.stringify(mapping));
    } catch {
      localStorage.removeItem('hycm_raw_material_group_mapping');
    }
  }

  localStorage.setItem(RAW_GROUP_MAPPING_VERSION_KEY, RAW_GROUP_MAPPING_VERSION);
}

const COL = {
  itemName: 0,
  beginning: 1,
  purchase: 2,
  transferIn: 3,
  receiptTotal: 4,

  processIssue: 5,
  salesIssue: 6,
  sampleIssue: 7,
  transferIssue: 8,
  disposalIssue: 9,
  devExpenseIssue: 10,
  devAssetIssue: 11,
  pilotIssue: 12,
  otherIssue: 13,
  issueTotal: 14,

  ending: 15,
};

export function parseRawMaterialLedgerRows(
  rawRows: any[][],
  year: string,
  month: number
): RawMaterialLedgerRecord[] {
  const records: RawMaterialLedgerRecord[] = [];
  const cleanRows = rawRows.map(row => row.map(cell => (cell === undefined || cell === null ? '' : cell)));

  for (let i = 0; i < cleanRows.length; i++) {
    const row = cleanRows[i];
    const firstCell = String(row[0] || '').trim();

    if (isRawItemCode(firstCell)) {
      // We found a Quantity row!
      // The Amount row should be right next to it: i + 1
      // The Price row should be next: i + 2
      if (i + 1 >= cleanRows.length) continue;

      const qRow = row;
      const aRow = cleanRows[i + 1];
      // Price row might be i + 2, let's verify if there is one or default to empty row
      const pRow = (i + 2 < cleanRows.length) ? cleanRows[i + 2] : [];

      const rawItemCode = firstCell;
      const amountLabel = String(aRow[0] || '').trim();
      const priceLabel = String(pRow[0] || '').trim();

      const group = getRawMaterialGroup(rawItemCode, amountLabel, priceLabel);

      // Quantities
      const beginningQty = parseNumber(qRow[COL.beginning]);
      const purchaseQty = parseNumber(qRow[COL.purchase]);
      const transferInQty = parseNumber(qRow[COL.transferIn]);
      const receiptTotalQty = parseNumber(qRow[COL.receiptTotal]);
      const processIssueQty = parseNumber(qRow[COL.processIssue]);
      const salesIssueQty = parseNumber(qRow[COL.salesIssue]);
      const sampleIssueQty = parseNumber(qRow[COL.sampleIssue]);
      const transferIssueQty = parseNumber(qRow[COL.transferIssue]);
      const disposalIssueQty = parseNumber(qRow[COL.disposalIssue]);
      const devExpenseIssueQty = parseNumber(qRow[COL.devExpenseIssue]);
      const devAssetIssueQty = parseNumber(qRow[COL.devAssetIssue]);
      const pilotIssueQty = parseNumber(qRow[COL.pilotIssue]);
      const otherIssueQty = parseNumber(qRow[COL.otherIssue]);
      const issueTotalQty = parseNumber(qRow[COL.issueTotal]);
      const endingQty = parseNumber(qRow[COL.ending]);

      // Amounts
      const beginningAmount = parseNumber(aRow[COL.beginning]);
      const purchaseAmount = parseNumber(aRow[COL.purchase]);
      const transferInAmount = parseNumber(aRow[COL.transferIn]);
      const receiptTotalAmount = parseNumber(aRow[COL.receiptTotal]);
      const processIssueAmount = parseNumber(aRow[COL.processIssue]);
      const salesIssueAmount = parseNumber(aRow[COL.salesIssue]);
      const sampleIssueAmount = parseNumber(aRow[COL.sampleIssue]);
      const transferIssueAmount = parseNumber(aRow[COL.transferIssue]);
      const disposalIssueAmount = parseNumber(aRow[COL.disposalIssue]);
      const devExpenseIssueAmount = parseNumber(aRow[COL.devExpenseIssue]);
      const devAssetIssueAmount = parseNumber(aRow[COL.devAssetIssue]);
      const pilotIssueAmount = parseNumber(aRow[COL.pilotIssue]);
      const otherIssueAmount = parseNumber(aRow[COL.otherIssue]);
      const issueTotalAmount = parseNumber(aRow[COL.issueTotal]);
      const endingAmount = parseNumber(aRow[COL.ending]);

      // Unit Prices
      const beginningUnitPrice = parseNumber(pRow[COL.beginning]);
      const purchaseUnitPrice = parseNumber(pRow[COL.purchase]);
      const transferInUnitPrice = parseNumber(pRow[COL.transferIn]);
      const receiptTotalUnitPrice = parseNumber(pRow[COL.receiptTotal]);
      const processIssueUnitPrice = parseNumber(pRow[COL.processIssue]);
      const salesIssueUnitPrice = parseNumber(pRow[COL.salesIssue]);
      const sampleIssueUnitPrice = parseNumber(pRow[COL.sampleIssue]);
      const transferIssueUnitPrice = parseNumber(pRow[COL.transferIssue]);
      const disposalIssueUnitPrice = parseNumber(pRow[COL.disposalIssue]);
      const devExpenseIssueUnitPrice = parseNumber(pRow[COL.devExpenseIssue]);
      const devAssetIssueUnitPrice = parseNumber(pRow[COL.devAssetIssue]);
      const pilotIssueUnitPrice = parseNumber(pRow[COL.pilotIssue]);
      const otherIssueUnitPrice = parseNumber(pRow[COL.otherIssue]);
      const issueTotalUnitPrice = parseNumber(pRow[COL.issueTotal]);
      const endingUnitPrice = parseNumber(pRow[COL.ending]);

      const rec: RawMaterialLedgerRecord = {
        id: `${year}_${month}_raw_${rawItemCode}`,
        year,
        month,
        sourceType: '원자재수불부',
        rawItemCode,
        rawItemName: amountLabel || rawItemCode,
        materialGroup: group,
        quantityRowLabel: rawItemCode,
        amountRowLabel: amountLabel,
        unitPriceRowLabel: priceLabel,

        beginningQty,
        beginningAmount,
        beginningUnitPrice,

        purchaseQty,
        purchaseAmount,
        purchaseUnitPrice,

        transferInQty,
        transferInAmount,
        transferInUnitPrice,

        receiptTotalQty,
        receiptTotalAmount,
        receiptTotalUnitPrice,

        processIssueQty,
        processIssueAmount,
        processIssueUnitPrice,

        salesIssueQty,
        salesIssueAmount,
        salesIssueUnitPrice,

        sampleIssueQty,
        sampleIssueAmount,
        sampleIssueUnitPrice,

        transferIssueQty,
        transferIssueAmount,
        transferIssueUnitPrice,

        disposalIssueQty,
        disposalIssueAmount,
        disposalIssueUnitPrice,

        devExpenseIssueQty,
        devExpenseIssueAmount,
        devExpenseIssueUnitPrice,

        devAssetIssueQty,
        devAssetIssueAmount,
        devAssetIssueUnitPrice,

        pilotIssueQty,
        pilotIssueAmount,
        pilotIssueUnitPrice,

        otherIssueQty,
        otherIssueAmount,
        otherIssueUnitPrice,

        issueTotalQty,
        issueTotalAmount,
        issueTotalUnitPrice,

        endingQty,
        endingAmount,
        endingUnitPrice,

        uploadedAt: new Date().toISOString(),

        // Backward-compatibility attributes
        rawMaterialName: amountLabel || rawItemCode,
        materialCode: rawItemCode,
        canonicalMaterialName: amountLabel || rawItemCode,
        unit: '수량',
        beginningInventory: beginningQty,
        receiptTotal: receiptTotalQty,
        issueTotal: issueTotalQty,
        endingInventory: endingQty
      };

      records.push(rec);

      // Skip the Amount row and Price row
      i += 2;
    }
  }

  return records;
}
