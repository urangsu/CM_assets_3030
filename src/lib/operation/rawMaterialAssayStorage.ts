export interface RawMaterialAssay {
  id: string;
  year: string;
  month: number;
  rawItemCode: string;

  majorMetals: {
    niPct?: number;
    coPct?: number;
    lcPct?: number;
    mnPct?: number;
    cuPct?: number;
  };

  impurities: {
    alPct?: number;
    fePct?: number;
    fPct?: number;
    pPct?: number;
    mgPct?: number;
    caPct?: number;
    kPct?: number;
    pbPct?: number;
    dcPct?: number;
    moisturePct?: number;
  };

  note?: string;
  updatedAt: string;
}

const ASSAY_PREFIX = 'hycm_raw_material_assay_';

export const RawMaterialAssayStorage = {
  getAssayKey(year: string): string {
    return `${ASSAY_PREFIX}${year}`;
  },

  getAssays(year: string): RawMaterialAssay[] {
    const key = this.getAssayKey(year);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  getAssay(year: string, month: number, rawItemCode: string): RawMaterialAssay | null {
    const list = this.getAssays(year);
    const found = list.find(
      a => Number(a.month) === Number(month) && a.rawItemCode === rawItemCode
    );
    return found || null;
  },

  saveAssay(assay: RawMaterialAssay): void {
    const list = this.getAssays(assay.year);
    const idx = list.findIndex(
      a => Number(a.month) === Number(assay.month) && a.rawItemCode === assay.rawItemCode
    );
    if (idx >= 0) {
      list[idx] = assay;
    } else {
      list.push(assay);
    }
    localStorage.setItem(this.getAssayKey(assay.year), JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('raw-material-assay-changed'));
    }
  },

  saveAssays(year: string, newAssays: RawMaterialAssay[]): void {
    const list = this.getAssays(year);
    const updated = [...list];
    for (const item of newAssays) {
      const idx = updated.findIndex(
        a => Number(a.month) === Number(item.month) && a.rawItemCode === item.rawItemCode
      );
      if (idx >= 0) {
        updated[idx] = item;
      } else {
        updated.push(item);
      }
    }
    localStorage.setItem(this.getAssayKey(year), JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('raw-material-assay-changed'));
    }
  },

  getLatestAssay(rawItemCode: string): RawMaterialAssay | null {
    // Search across all years starting from current year
    const currentYear = '2026';
    const list = this.getAssays(currentYear);
    const codeAssays = list
      .filter(a => a.rawItemCode === rawItemCode)
      .sort((a, b) => Number(b.month) - Number(a.month));
    return codeAssays[0] || null;
  },

  copyAssaysFromPreviousMonth(year: string, targetMonth: number): number {
    if (targetMonth <= 1) return 0;
    const prevMonth = targetMonth - 1;
    const list = this.getAssays(year);
    const prevAssays = list.filter(a => Number(a.month) === prevMonth);
    let copiedCount = 0;

    for (const prev of prevAssays) {
      const existing = list.find(
        a => Number(a.month) === targetMonth && a.rawItemCode === prev.rawItemCode
      );
      if (!existing) {
        this.saveAssay({
          ...prev,
          id: `assay_${year}_${targetMonth}_${prev.rawItemCode}_${Date.now()}`,
          month: targetMonth,
          updatedAt: new Date().toISOString()
        });
        copiedCount++;
      }
    }
    return copiedCount;
  }
};
