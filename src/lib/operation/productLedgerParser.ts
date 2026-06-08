import { resolveProductByRawName, getLithiumConversionRateForYear } from './productMaster';

export interface ProductLedgerRecord {
  id: string;
  year: string;
  month: number;

  sourceType: '제품수불부';
  sourceRowStartIndex: number;

  productCode?: string;
  rawProductName: string;
  productName: '황산니켈' | '황산코발트' | '탄산리튬' | '황산망간' | '구리';
  metal: 'Ni' | 'Co' | 'Li' | 'Mn' | 'Cu';

  unit: '수량' | '금액' | '단가';

  beginningInventory: number;

  normalReceipt: number;
  transferReceipt: number;
  returnReceipt: number;
  otherReceipt: number;
  receiptTotal: number;

  salesQuantity: number;
  reInput: number;
  compensation: number;
  sample: number;
  transferIssue: number;
  disposal: number;
  otherIssue: number;
  issueTotal: number;

  endingInventory: number;
  inventoryValuationLoss: number;
  valuationApplied: number;

  revenue: number;
  costOfSales: number;
  grossProfit: number;

  conversionRate?: number;
  convertedSalesQuantity?: number;
  convertedProductionQuantity?: number;
  convertedEndingInventory?: number;

  uploadedAt: string;
}

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  if (str === '-' || str === '') return 0;
  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
}

export function parseProductLedgerRows(
  rawRows: any[][],
  year: string,
  month: number
): ProductLedgerRecord[] {
  const records: ProductLedgerRecord[] = [];
  const conversionRate = getLithiumConversionRateForYear(year);

  // Filter out completely empty rows
  const cleanRows = rawRows.map(row => row.map(cell => (cell === undefined || cell === null ? '' : cell)));

  for (let i = 0; i < cleanRows.length; i++) {
    const row = cleanRows[i];
    const rawProductName = String(row[0] || '').trim();
    const unitStr = String(row[1] || '').trim();

    // Check if we found a block starting with '수량'
    if (unitStr === '수량') {
      // Resolve product name from row 0. If it's empty, we search upwards for the nearest non-empty product name
      let prodName = rawProductName;
      if (!prodName) {
        for (let searchIdx = i - 1; searchIdx >= 0; searchIdx--) {
          const upRow = cleanRows[searchIdx];
          const upName = String(upRow[0] || '').trim();
          if (upName && String(upRow[1] || '').trim()) {
            prodName = upName;
            break;
          }
        }
      }

      const resolved = resolveProductByRawName(prodName);
      if (!resolved) {
        continue; // Skip unrecognized products
      }

      // Find the adjacent '금액' and '단가' rows in the next few rows
      let amountRow: any[] | null = null;
      let priceRow: any[] | null = null;

      for (let j = i + 1; j < Math.min(i + 15, cleanRows.length); j++) {
        const nextRow = cleanRows[j];
        const nextUnit = String(nextRow[1] || '').trim();
        const nextProdName = String(nextRow[0] || '').trim();

        // If we hit another product name or "수량", stop searching
        if (nextUnit === '수량' || (nextProdName && nextProdName !== prodName && resolveProductByRawName(nextProdName))) {
          break;
        }

        if (nextUnit === '금액' && !amountRow) {
          amountRow = nextRow;
        } else if (nextUnit === '단가' && !priceRow) {
          priceRow = nextRow;
        }
      }

      // If amount or price rows aren't found, fallback to empty arrays
      const amtRow = amountRow || [];
      const prcRow = priceRow || [];

      // Extracted T-column values:
      // T-col represents: Row 1 (수량) = 매출액, Row 2 (금액) = 매출원가, Row 3 (단가) = 매출이익
      const revenueVal = parseNumber(row[19]);
      const costOfSalesVal = parseNumber(amtRow[19]);
      const grossProfitVal = parseNumber(prcRow[19]);

      // Helper to construct a record
      const createRecordInstance = (
        targetRow: any[],
        unitVal: '수량' | '금액' | '단가',
        rowOffset: number
      ): ProductLedgerRecord => {
        const rowProductNameText = String(targetRow[0] || prodName || '').trim();
        const beginningVal = parseNumber(targetRow[2]);
        const normReceiptVal = parseNumber(targetRow[3]);
        const transReceiptVal = parseNumber(targetRow[4]);
        const retReceiptVal = parseNumber(targetRow[5]);
        const othReceiptVal = parseNumber(targetRow[6]);
        const recTotalVal = parseNumber(targetRow[7]);

        const salesQtyVal = parseNumber(targetRow[8]);
        const reInputVal = parseNumber(targetRow[9]);
        const compVal = parseNumber(targetRow[10]);
        const sampleVal = parseNumber(targetRow[11]);
        const transIssueVal = parseNumber(targetRow[12]);
        const dispVal = parseNumber(targetRow[13]);
        const othIssueVal = parseNumber(targetRow[14]);
        const issTotalVal = parseNumber(targetRow[15]);

        const endInvVal = parseNumber(targetRow[16]);
        const invLossVal = parseNumber(targetRow[17]);
        const valAppliedVal = parseNumber(targetRow[18]);

        const rec: ProductLedgerRecord = {
          id: `${year}_${month}_${resolved.canonicalProductName}_${unitVal}`,
          year,
          month,
          sourceType: '제품수불부',
          sourceRowStartIndex: i + rowOffset,
          rawProductName: rowProductNameText || prodName,
          productName: resolved.canonicalProductName,
          metal: resolved.metal,
          unit: unitVal,

          beginningInventory: beginningVal,
          normalReceipt: normReceiptVal,
          transferReceipt: transReceiptVal,
          returnReceipt: retReceiptVal,
          otherReceipt: othReceiptVal,
          receiptTotal: recTotalVal,

          salesQuantity: salesQtyVal,
          reInput: reInputVal,
          compensation: compVal,
          sample: sampleVal,
          transferIssue: transIssueVal,
          disposal: dispVal,
          otherIssue: othIssueVal,
          issueTotal: issTotalVal,

          endingInventory: endInvVal,
          inventoryValuationLoss: invLossVal,
          valuationApplied: valAppliedVal,

          revenue: revenueVal,
          costOfSales: costOfSalesVal,
          grossProfit: grossProfitVal,
          uploadedAt: new Date().toISOString()
        };

        // Apply Lithium logical conversion for '수량'
        if (resolved.canonicalProductName === '탄산리튬') {
          rec.conversionRate = conversionRate;
          if (unitVal === '수량') {
            rec.convertedSalesQuantity = salesQtyVal / (conversionRate / 100);
            rec.convertedProductionQuantity = normReceiptVal / (conversionRate / 100);
            rec.convertedEndingInventory = endInvVal / (conversionRate / 100);
          } else {
            // For amount or price, just repeat the values or keep raw
            rec.convertedSalesQuantity = salesQtyVal;
            rec.convertedProductionQuantity = normReceiptVal;
            rec.convertedEndingInventory = endInvVal;
          }
        } else {
          // Others are same as raw
          rec.convertedSalesQuantity = salesQtyVal;
          rec.convertedProductionQuantity = normReceiptVal;
          rec.convertedEndingInventory = endInvVal;
        }

        return rec;
      };

      // Push Qty Record
      records.push(createRecordInstance(row, '수량', 0));

      // Push Amt Record if we had it
      if (amountRow) {
        records.push(createRecordInstance(amountRow, '금액', 1));
      }

      // Push Price Record if we had it
      if (priceRow) {
        records.push(createRecordInstance(priceRow, '단가', 2));
      }

      // Fast-forward i to skip parsed rows
      i += (amountRow ? 1 : 0) + (priceRow ? 1 : 0);
    }
  }

  return records;
}
