export interface ExportData {
  timestamp: string;
  version: string;
  data: Record<string, any>;
}

export const BackupRepository = {
  exportAll: (): string => {
    const backup: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cleanmetal_')) {
        try {
          backup[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          backup[key] = localStorage.getItem(key);
        }
      }
    }
    const exportData: ExportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: backup
    };
    return JSON.stringify(exportData, null, 2);
  },

  importAll: (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString) as ExportData;
      if (!parsed.data) return false;
      
      // We do not clear existing, we overwrite conflicts
      Object.entries(parsed.data).forEach(([key, value]) => {
        if (typeof value === 'object') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      });
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
};
