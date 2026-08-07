import { ProductLedgerRecord } from './productLedgerParser';
export type { ProductLedgerRecord };

export interface RawMaterialLedgerRecord {
  id: string;
  year: string;
  month: number;
  sourceType: '원자재수불부';

  rawItemCode: string; // A
  rawItemName: string; // A label / details
  materialGroup: 'BP' | 'BM' | 'WET' | 'LCO' | 'MN' | '기타';

  quantityRowLabel: string;
  amountRowLabel: string;
  unitPriceRowLabel: string;

  beginningQty: number;
  beginningAmount: number;
  beginningUnitPrice: number;

  purchaseQty: number;
  purchaseAmount: number;
  purchaseUnitPrice: number;

  transferInQty: number;
  transferInAmount: number;
  transferInUnitPrice: number;

  receiptTotalQty: number;
  receiptTotalAmount: number;
  receiptTotalUnitPrice: number;

  processIssueQty: number;
  processIssueAmount: number;
  processIssueUnitPrice: number;

  salesIssueQty: number;
  salesIssueAmount: number;
  salesIssueUnitPrice: number;

  sampleIssueQty: number;
  sampleIssueAmount: number;
  sampleIssueUnitPrice: number;

  transferIssueQty: number;
  transferIssueAmount: number;
  transferIssueUnitPrice: number;

  disposalIssueQty: number;
  disposalIssueAmount: number;
  disposalIssueUnitPrice: number;

  devExpenseIssueQty: number;
  devExpenseIssueAmount: number;
  devExpenseIssueUnitPrice: number;

  devAssetIssueQty: number;
  devAssetIssueAmount: number;
  devAssetIssueUnitPrice: number;

  pilotIssueQty: number;
  pilotIssueAmount: number;
  pilotIssueUnitPrice: number;

  otherIssueQty: number;
  otherIssueAmount: number;
  otherIssueUnitPrice: number;

  issueTotalQty: number;
  issueTotalAmount: number;
  issueTotalUnitPrice: number;

  endingQty: number;
  endingAmount: number;
  endingUnitPrice: number;

  uploadedAt: string;

  // Backward-compatibility attributes
  rawMaterialName?: string;
  materialCode?: string;
  canonicalMaterialName?: string;
  unit?: string;
  beginningInventory?: number;
  receiptTotal?: number;
  issueTotal?: number;
  endingInventory?: number;
}

export interface OperationUploadHistory {
  id: string;
  year: string;
  month: number;
  type: 'product' | 'raw_material';
  fileName: string;
  rowLength: number;
  uploadedAt: string;
}

const PRODUCT_LEDGER_PREFIX = 'hycm_product_ledger_';
const RAW_MATERIAL_LEDGER_PREFIX = 'hycm_raw_material_ledger_';
const UPLOAD_HISTORY_KEY = 'hycm_operation_upload_history';

export const OperationStorage = {
  // --- Product Ledger ---
  getProductLedgerKey(year: string): string {
    return `${PRODUCT_LEDGER_PREFIX}${year}`;
  },

  getProductRecords(year: string): ProductLedgerRecord[] {
    const key = this.getProductLedgerKey(year);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  saveProductRecords(year: string, month: number, newRecords: ProductLedgerRecord[]): void {
    const records = this.getProductRecords(year);
    
    // Filter out existing records for the same month and productName (to support overwriting)
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    
    // Concat and save
    const combined = [...filtered, ...newRecords];
    localStorage.setItem(this.getProductLedgerKey(year), JSON.stringify(combined));

    // Dispatch change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('operation-ledger-changed'));
    }
  },

  deleteProductRecordsForMonth(year: string, month: number): void {
    const records = this.getProductRecords(year);
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    localStorage.setItem(this.getProductLedgerKey(year), JSON.stringify(filtered));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('operation-ledger-changed'));
    }
  },

  // --- Raw Material Ledger ---
  getRawMaterialLedgerKey(year: string): string {
    return `${RAW_MATERIAL_LEDGER_PREFIX}${year}`;
  },

  getRawMaterialRecords(year: string): RawMaterialLedgerRecord[] {
    const key = this.getRawMaterialLedgerKey(year);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  saveRawMaterialRecords(
    year: string,
    month: number,
    newRecords: RawMaterialLedgerRecord[],
    mode: 'upsert' | 'replace_month' = 'upsert'
  ): void {
    const records = this.getRawMaterialRecords(year);
    let updatedRecords: RawMaterialLedgerRecord[] = [];

    if (mode === 'replace_month') {
      const otherMonths = records.filter(r => !(Number(r.month) === Number(month)));
      updatedRecords = [...otherMonths, ...newRecords];
    } else {
      // Upsert mode: match by rawItemCode or id
      const otherMonths = records.filter(r => Number(r.month) !== Number(month));
      const currentMonthRecords = records.filter(r => Number(r.month) === Number(month));

      const updatedMonthRecords = [...currentMonthRecords];
      for (const newRec of newRecords) {
        const existingIdx = updatedMonthRecords.findIndex(
          r => r.rawItemCode === newRec.rawItemCode || r.id === newRec.id
        );
        if (existingIdx >= 0) {
          updatedMonthRecords[existingIdx] = newRec;
        } else {
          updatedMonthRecords.push(newRec);
        }
      }
      updatedRecords = [...otherMonths, ...updatedMonthRecords];
    }

    localStorage.setItem(this.getRawMaterialLedgerKey(year), JSON.stringify(updatedRecords));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('operation-ledger-changed'));
    }
  },

  deleteRawMaterialRecordsForMonth(year: string, month: number): void {
    const records = this.getRawMaterialRecords(year);
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    localStorage.setItem(this.getRawMaterialLedgerKey(year), JSON.stringify(filtered));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('operation-ledger-changed'));
    }
  },

  // --- Upload History ---
  getUploadHistory(): OperationUploadHistory[] {
    const stored = localStorage.getItem(UPLOAD_HISTORY_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  addUploadHistory(history: Omit<OperationUploadHistory, 'id' | 'uploadedAt'>): void {
    const list = this.getUploadHistory();
    const newItem: OperationUploadHistory = {
      ...history,
      id: 'batch_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      uploadedAt: new Date().toISOString()
    };
    // Keep all upload batches in history list (do not overwrite previous upload logs)
    localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify([newItem, ...list]));
  },

  deleteUploadHistoryOnly(id: string): void {
    const list = this.getUploadHistory();
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(filtered));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('operation-ledger-changed'));
    }
  },

  revertUploadBatch(id: string): void {
    const list = this.getUploadHistory();
    const itemToDelete = list.find(l => l.id === id);
    if (itemToDelete) {
      if (itemToDelete.type === 'product') {
        this.deleteProductRecordsForMonth(itemToDelete.year, itemToDelete.month);
      } else {
        this.deleteRawMaterialRecordsForMonth(itemToDelete.year, itemToDelete.month);
      }
    }
    this.deleteUploadHistoryOnly(id);
  },

  deleteUploadHistory(id: string): void {
    this.revertUploadBatch(id);
  }
};
