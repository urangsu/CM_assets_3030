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
    window.dispatchEvent(new Event('operation-ledger-changed'));
  },

  deleteProductRecordsForMonth(year: string, month: number): void {
    const records = this.getProductRecords(year);
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    localStorage.setItem(this.getProductLedgerKey(year), JSON.stringify(filtered));
    window.dispatchEvent(new Event('operation-ledger-changed'));
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

  saveRawMaterialRecords(year: string, month: number, newRecords: RawMaterialLedgerRecord[]): void {
    const records = this.getRawMaterialRecords(year);
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    const combined = [...filtered, ...newRecords];
    localStorage.setItem(this.getRawMaterialLedgerKey(year), JSON.stringify(combined));

    window.dispatchEvent(new Event('operation-ledger-changed'));
  },

  deleteRawMaterialRecordsForMonth(year: string, month: number): void {
    const records = this.getRawMaterialRecords(year);
    const filtered = records.filter(r => !(Number(r.month) === Number(month)));
    localStorage.setItem(this.getRawMaterialLedgerKey(year), JSON.stringify(filtered));
    window.dispatchEvent(new Event('operation-ledger-changed'));
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
      id: Math.random().toString(36).substring(2, 9),
      uploadedAt: new Date().toISOString()
    };
    // Keep it ordered by newest first, overwrite if identical year/month/type
    const filtered = list.filter(item => !(item.year === history.year && Number(item.month) === Number(history.month) && item.type === history.type));
    localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify([newItem, ...filtered]));
  },

  deleteUploadHistory(id: string): void {
    const list = this.getUploadHistory();
    const itemToDelete = list.find(l => l.id === id);
    if (itemToDelete) {
      if (itemToDelete.type === 'product') {
        this.deleteProductRecordsForMonth(itemToDelete.year, itemToDelete.month);
      } else {
        this.deleteRawMaterialRecordsForMonth(itemToDelete.year, itemToDelete.month);
      }
    }
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(filtered));
  }
};
