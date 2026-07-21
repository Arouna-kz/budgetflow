// Helpers de style pour les exports Excel (via xlsx-js-style).
import * as XLSX from 'xlsx-js-style';

// Palette BudgetFlow
const INDIGO = '4F46E5';
const VIOLET = '7C3AED';
const LIGHT = 'EEF2FF';
const ZEBRA = 'F8FAFC';
const TOTAL_BG = 'E0E7FF';
const BORDER = 'D1D5DB';

const border = {
  top: { style: 'thin', color: { rgb: BORDER } },
  bottom: { style: 'thin', color: { rgb: BORDER } },
  left: { style: 'thin', color: { rgb: BORDER } },
  right: { style: 'thin', color: { rgb: BORDER } },
};

const setStyle = (ws: any, r: number, c: number, style: any) => {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) ws[ref] = { t: 's', v: '' };
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
};

/** Style une ligne d'en-tête (fond indigo, texte blanc gras, centré, bordures). */
export const styleHeaderRow = (ws: any, row: number, nCols: number, color: string = INDIGO) => {
  for (let c = 0; c < nCols; c++) {
    setStyle(ws, row, c, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: color } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    });
  }
};

/** Style une ligne de totaux (fond clair, gras). */
export const styleTotalRow = (ws: any, row: number, nCols: number) => {
  for (let c = 0; c < nCols; c++) {
    setStyle(ws, row, c, {
      font: { bold: true, color: { rgb: INDIGO }, sz: 11 },
      fill: { fgColor: { rgb: TOTAL_BG } },
      alignment: { vertical: 'center' },
      border,
    });
  }
};

/** Titre principal fusionné (grande police, indigo). */
export const styleTitle = (ws: any, row: number, nCols: number) => {
  setStyle(ws, row, 0, {
    font: { bold: true, color: { rgb: INDIGO }, sz: 16 },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: Math.max(0, nCols - 1) } });
};

/** Zébrage + bordures des lignes de données. */
export const styleDataRows = (ws: any, firstRow: number, lastRow: number, nCols: number) => {
  for (let r = firstRow; r <= lastRow; r++) {
    const zebra = (r - firstRow) % 2 === 1;
    for (let c = 0; c < nCols; c++) {
      setStyle(ws, r, c, {
        fill: zebra ? { fgColor: { rgb: ZEBRA } } : undefined,
        alignment: { vertical: 'center', wrapText: c < 3 },
        border,
      });
    }
  }
};

/** Met en évidence une ligne de sous-total / section (fond léger, gras). */
export const styleSectionRow = (ws: any, row: number, nCols: number) => {
  for (let c = 0; c < nCols; c++) {
    setStyle(ws, row, c, {
      font: { bold: true, color: { rgb: VIOLET }, sz: 10 },
      fill: { fgColor: { rgb: LIGHT } },
      border,
    });
  }
};

export const EXCEL_COLORS = { INDIGO, VIOLET, LIGHT, ZEBRA, TOTAL_BG };
