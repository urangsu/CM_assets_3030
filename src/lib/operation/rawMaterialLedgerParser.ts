import { RawMaterialLedgerRecord } from './operationStorage';

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  if (str === '-' || str === '') return 0;
  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
}

export function resolveRawMaterial(rawName: string): { code: string; canonicalName: string } {
  const clean = rawName.toUpperCase().replace(/\s+/g, '');
  if (clean.includes('BP') || clean.includes('POWDER') || clean.includes('파우더') || clean.includes('블랙파우더')) {
    return { code: 'BP', canonicalName: 'BP (Black Powder 원료)' };
  }
  if (clean.includes('WET') || clean.includes('습식')) {
    return { code: 'WET', canonicalName: 'WET (Wet BM)' };
  }
  if (clean.includes('LCO') || clean.includes('산화물') || clean.includes('리튬코발트')) {
    return { code: 'LCO', canonicalName: 'LCO (리튬코발트산화물, Lithium Cobalt Oxide)' };
  }
  if (clean.includes('BM') || clean.includes('MASS') || clean.includes('블랙매스')) {
    return { code: 'BM', canonicalName: 'BM (Black Mass)' };
  }
  return { code: rawName, canonicalName: rawName };
}

export function parseRawMaterialLedgerRows(
  rawRows: any[][],
  year: string,
  month: number
): RawMaterialLedgerRecord[] {
  const records: RawMaterialLedgerRecord[] = [];
  const cleanRows = rawRows.map(row => row.map(cell => (cell === undefined || cell === null ? '' : cell)));

  for (let i = 0; i < cleanRows.length; i++) {
    const row = cleanRows[i];
    const rawMaterialName = String(row[0] || '').trim();
    const unitStr = String(row[1] || '').trim();

    // Check if we found a block starting with '수량'
    if (unitStr === '수량' && rawMaterialName) {
      if (rawMaterialName.includes('계') || rawMaterialName.includes('품목')) {
        continue;
      }
      
      const resolved = resolveRawMaterial(rawMaterialName);
      let amountRow: any[] | null = null;
      let priceRow: any[] | null = null;

      // Find '금액' and '단가' rows matching the pattern
      for (let j = i + 1; j < Math.min(i + 15, cleanRows.length); j++) {
        const nextRow = cleanRows[j];
        const nextUnit = String(nextRow[1] || '').trim();
        const nextSubName = String(nextRow[0] || '').trim();

        if (nextUnit === '수량' || (nextSubName && nextSubName !== rawMaterialName && resolveRawMaterial(nextSubName).code !== resolved.code)) {
          break;
        }

        if (nextUnit === '금액' && !amountRow) {
          amountRow = nextRow;
        } else if (nextUnit === '단가' && !priceRow) {
          priceRow = nextRow;
        }
      }

      const amtRow = amountRow || [];
      const prcRow = priceRow || [];

      // Extract raw values
      // Column indexes mapping:
      // Col 2: beginning (기초)
      // Col 3: purchase / receipt (구매/정상입고)
      // Col 8: issue / usage (재투입/생산불출/출고)
      // Col 16: ending (기말재고)
      const beginningQty = parseNumber(row[2]);
      const beginningAmount = parseNumber(amtRow[2]);
      const beginningUnitPrice = parseNumber(prcRow[2]);

      const purchaseQty = parseNumber(row[3]) || parseNumber(row[7]); // normal purchase or sum
      const purchaseAmount = parseNumber(amtRow[3]) || parseNumber(amtRow[7]);
      const purchaseUnitPrice = parseNumber(prcRow[3]) || parseNumber(prcRow[7]);

      const issueQty = parseNumber(row[8]) || parseNumber(row[15]); // normal issue or sum
      const issueAmount = parseNumber(amtRow[8]) || parseNumber(amtRow[15]);
      const issueUnitPrice = parseNumber(prcRow[8]) || parseNumber(prcRow[15]);

      const endingQty = parseNumber(row[16]);
      const endingAmount = parseNumber(amtRow[16]);
      const endingUnitPrice = parseNumber(prcRow[16]);

      const rec: RawMaterialLedgerRecord = {
        id: `${year}_${month}_raw_${resolved.code}`,
        year,
        month,
        sourceType: '원자재수불부',
        rawMaterialName: rawMaterialName,
        materialCode: resolved.code,
        canonicalMaterialName: resolved.canonicalName,
        unit: '수량',

        beginningQty,
        beginningAmount,
        beginningUnitPrice,

        purchaseQty,
        purchaseAmount,
        purchaseUnitPrice,

        issueQty,
        issueAmount,
        issueUnitPrice,

        endingQty,
        endingAmount,
        endingUnitPrice,

        // Keep backward compat fields just in case
        beginningInventory: beginningQty,
        receiptTotal: purchaseQty,
        issueTotal: issueQty,
        endingInventory: endingQty,

        uploadedAt: new Date().toISOString()
      };

      records.push(rec);

      // Fast-forward i to skip金額 and 단가
      i += (amountRow ? 1 : 0) + (priceRow ? 1 : 0);
    }
  }

  return records;
}
