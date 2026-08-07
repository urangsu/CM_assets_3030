export type BomCategory = '원재료' | '부재료' | '조업재료' | '유틸리티';

export interface BomMatrixRow {
  id: string;
  category: BomCategory;
  itemName: string;
  unit: string;
  coefficients: {
    NI?: number;
    CO?: number;
    LC?: number;
    MN?: number;
    CU?: number;
  };
  unitPrice: number; // KRW
}

export interface BomMatrixParseResult {
  validCount: number;
  warningCount: number;
  items: BomMatrixRow[];
  warnings: string[];
}

function parseCoeff(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  const str = String(val).trim();
  if (str === '' || str === '-' || str === '0') return undefined;
  const num = Number(str.replace(/,/g, ''));
  return isNaN(num) || num === 0 ? undefined : num;
}

function parseNum(val: any, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim().replace(/,/g, '');
  if (str === '' || str === '-') return fallback;
  const num = Number(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Parses pasted Excel matrix range formatted as:
 * 구분 | 부원료 | 니켈 | 코발트 | 탄산리튬 | 망간 | 구리 | 단위 | 단가
 * Supports inheritance of merged category cells.
 */
export function parseBomMatrixPasteText(rawText: string): BomMatrixParseResult {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const items: BomMatrixRow[] = [];
  const warnings: string[] = [];

  let validCount = 0;
  let warningCount = 0;
  let currentCategory: BomCategory = '부재료';

  lines.forEach((line, index) => {
    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < 2) return;

    // Header check
    const headerCheck = cols.join(' ');
    if (headerCheck.includes('구분') && (headerCheck.includes('부원료') || headerCheck.includes('니켈'))) {
      return;
    }

    // Category detection or inheritance
    let catStr = cols[0];
    if (catStr.includes('원재료')) currentCategory = '원재료';
    else if (catStr.includes('부재료')) currentCategory = '부재료';
    else if (catStr.includes('조업')) currentCategory = '조업재료';
    else if (catStr.includes('유틸리티')) currentCategory = '유틸리티';
    // If empty category, inherit currentCategory!

    const itemName = cols[1] || (cols[0] && !cols[0].match(/원재료|부재료|조업재료|유틸리티/) ? cols[0] : `BOM 품목 ${index + 1}`);

    // Check if columns match matrix format:
    // cols: [0: 구분, 1: 부원료, 2: Ni, 3: Co, 4: LC, 5: Mn, 6: Cu, 7: 단위, 8: 단가]
    let niCoeff = parseCoeff(cols[2]);
    let coCoeff = parseCoeff(cols[3]);
    let lcCoeff = parseCoeff(cols[4]);
    let mnCoeff = parseCoeff(cols[5]);
    let cuCoeff = parseCoeff(cols[6]);

    let unit = cols[7] || 'kg';
    let unitPrice = parseNum(cols[8], 0);

    // Alternative simpler columns format fallback if pasted with fewer columns: [구분, 부원료, 사용량, 단가]
    if (cols.length <= 5 && !headerCheck.includes('니켈')) {
      unit = cols[2] || 'kg';
      unitPrice = parseNum(cols[4], parseNum(cols[3], 0));
    }

    const hasAnyCoeff = niCoeff !== undefined || coCoeff !== undefined || lcCoeff !== undefined || mnCoeff !== undefined || cuCoeff !== undefined;

    if (!itemName) {
      warningCount++;
      warnings.push(`행 ${index + 1}: 품목명 없음`);
      return;
    }

    validCount++;

    items.push({
      id: 'bom_m_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
      category: currentCategory,
      itemName,
      unit,
      coefficients: {
        NI: niCoeff,
        CO: coCoeff,
        LC: lcCoeff,
        MN: mnCoeff,
        CU: cuCoeff
      },
      unitPrice
    });
  });

  return {
    validCount,
    warningCount,
    items,
    warnings
  };
}
