import { describe, it, expect, beforeEach } from 'vitest';
import { OperationStorage, RawMaterialLedgerRecord } from '../lib/operation/operationStorage';

const mockStorage: Record<string, string> = {};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  };
}

describe('Raw Material Storage Upsert & History Deletion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should support upsert mode without deleting other records in the same month', () => {
    const existingRecord: RawMaterialLedgerRecord = {
      id: 'rec_1',
      year: '2026',
      month: 7,
      sourceType: '원자재수불부',
      rawItemCode: 'ITEM_A',
      rawItemName: 'ITEM_A',
      materialGroup: 'BM',
      quantityRowLabel: '수량',
      amountRowLabel: '금액',
      unitPriceRowLabel: '단가',
      beginningQty: 100,
      beginningUnitPrice: 5,
      beginningAmount: 500,
      purchaseQty: 0, purchaseUnitPrice: 0, purchaseAmount: 0,
      transferInQty: 0, transferInUnitPrice: 0, transferInAmount: 0,
      receiptTotalQty: 100, receiptTotalUnitPrice: 5, receiptTotalAmount: 500,
      processIssueQty: 50, processIssueUnitPrice: 5, processIssueAmount: 250,
      salesIssueQty: 0, salesIssueUnitPrice: 0, salesIssueAmount: 0,
      sampleIssueQty: 0, sampleIssueUnitPrice: 0, sampleIssueAmount: 0,
      transferIssueQty: 0, transferIssueUnitPrice: 0, transferIssueAmount: 0,
      disposalIssueQty: 0, disposalIssueUnitPrice: 0, disposalIssueAmount: 0,
      devExpenseIssueQty: 0, devExpenseIssueUnitPrice: 0, devExpenseIssueAmount: 0,
      devAssetIssueQty: 0, devAssetIssueUnitPrice: 0, devAssetIssueAmount: 0,
      pilotIssueQty: 0, pilotIssueUnitPrice: 0, pilotIssueAmount: 0,
      otherIssueQty: 0, otherIssueUnitPrice: 0, otherIssueAmount: 0,
      issueTotalQty: 50, issueTotalUnitPrice: 5, issueTotalAmount: 250,
      endingQty: 50, endingUnitPrice: 5, endingAmount: 250,
      uploadedAt: new Date().toISOString()
    };

    OperationStorage.saveRawMaterialRecords('2026', 7, [existingRecord], 'replace_month');

    let loaded = OperationStorage.getRawMaterialRecords('2026');
    expect(loaded.length).toBe(1);
    expect(loaded[0].rawItemCode).toBe('ITEM_A');

    // Perform upsert with a new record for the same month
    const newRecord: RawMaterialLedgerRecord = {
      ...existingRecord,
      id: 'rec_2',
      rawItemCode: 'ITEM_B',
      materialGroup: 'BP'
    };

    OperationStorage.saveRawMaterialRecords('2026', 7, [newRecord], 'upsert');

    loaded = OperationStorage.getRawMaterialRecords('2026');
    expect(loaded.length).toBe(2);
    expect(loaded.map(r => r.rawItemCode)).toContain('ITEM_A');
    expect(loaded.map(r => r.rawItemCode)).toContain('ITEM_B');
  });

  it('should keep upload history items per batch and allow deleting history log separately', () => {
    OperationStorage.addUploadHistory({
      year: '2026',
      month: 7,
      type: 'raw_material',
      fileName: 'upload1.xlsx',
      rowLength: 5
    });

    OperationStorage.addUploadHistory({
      year: '2026',
      month: 7,
      type: 'raw_material',
      fileName: 'upload2.xlsx',
      rowLength: 3
    });

    const history = OperationStorage.getUploadHistory();
    expect(history.length).toBe(2);

    const batch1Id = history[1].id;
    OperationStorage.deleteUploadHistoryOnly(batch1Id);

    const updatedHistory = OperationStorage.getUploadHistory();
    expect(updatedHistory.length).toBe(1);
  });
});
