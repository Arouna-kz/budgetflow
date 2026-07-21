// Helpers d'export réutilisables (PDF + Excel colorés) pour les listes.
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { styleTitle, styleHeaderRow, styleDataRows, styleTotalRow } from './excelStyle';

export interface ListColumn {
  label: string;
  width: number;                 // largeur relative (mm) — ajustée à la page
  align?: 'left' | 'right' | 'center';
}

/** Nombre formaté « 2 000 ». */
export const fmtAmount = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/ | /g, ' ');

/** Export PDF paysage : titre indigo, en-tête indigo/blanc, zébrage, ligne de totaux. */
export const exportListPDF = (opts: {
  title: string;
  subtitle?: string;
  columns: ListColumn[];
  rows: string[][];
  totalRow?: string[];
  filename: string;
}) => {
  const { title, subtitle, columns, rows, totalRow, filename } = opts;
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const scale = (pageW - margin * 2) / totalW;
  const cols = columns.map(c => ({ ...c, width: c.width * scale, align: c.align || 'left' }));

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(79, 70, 229);
  pdf.text(title, pageW / 2, 15, { align: 'center' });
  if (subtitle) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(90, 90, 90);
    pdf.text(subtitle, pageW / 2, 21, { align: 'center' });
  }

  let y = subtitle ? 28 : 24;
  const drawHeader = () => {
    let x = margin;
    pdf.setFillColor(79, 70, 229);
    pdf.rect(margin, y, pageW - margin * 2, 9, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255, 255, 255);
    cols.forEach(c => {
      const tw = pdf.getTextWidth(c.label);
      const tx = c.align === 'right' ? x + c.width - tw - 2 : c.align === 'center' ? x + (c.width - tw) / 2 : x + 2;
      pdf.text(c.label, tx, y + 6);
      x += c.width;
    });
    y += 9;
    pdf.setTextColor(0, 0, 0); pdf.setFont('helvetica', 'normal');
  };
  drawHeader();

  pdf.setFontSize(8);
  rows.forEach((row, ri) => {
    if (y > pageH - 18) { pdf.addPage(); y = 15; drawHeader(); }
    if (ri % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, pageW - margin * 2, 7, 'F'); }
    let x = margin;
    row.forEach((cell, ci) => {
      const c = cols[ci];
      if (!c) return;
      const text = pdf.splitTextToSize(cell || '', c.width - 3)[0] || '';
      const tw = pdf.getTextWidth(text);
      const tx = c.align === 'right' ? x + c.width - tw - 2 : c.align === 'center' ? x + (c.width - tw) / 2 : x + 2;
      pdf.text(text, tx, y + 5);
      x += c.width;
    });
    y += 7;
  });

  if (totalRow) {
    if (y > pageH - 18) { pdf.addPage(); y = 15; }
    pdf.setFillColor(224, 231, 255);
    pdf.rect(margin, y, pageW - margin * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(79, 70, 229);
    let x = margin;
    totalRow.forEach((cell, ci) => {
      const c = cols[ci];
      if (!c) return;
      const tw = pdf.getTextWidth(cell || '');
      const tx = c.align === 'right' ? x + c.width - tw - 2 : c.align === 'center' ? x + (c.width - tw) / 2 : x + 2;
      pdf.text(cell || '', tx, y + 5.5);
      x += c.width;
    });
  }
  pdf.save(filename);
};

/** Export Excel coloré : titre, en-tête indigo, zébrage, ligne de totaux. */
export const exportListExcel = (opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  totalRow?: (string | number)[];
  colWidths?: number[];
  sheetName: string;
  filename: string;
}) => {
  const { title, subtitle, headers, rows, totalRow, colWidths, sheetName, filename } = opts;
  const aoa: any[] = [];
  aoa.push([title]);
  if (subtitle) aoa.push([subtitle]);
  aoa.push([]);
  const headerRowIdx = aoa.length;
  aoa.push(headers);
  const firstDataRow = aoa.length;
  rows.forEach(r => aoa.push(r));
  const lastDataRow = aoa.length - 1;
  let totalRowIdx = -1;
  if (totalRow) { aoa.push(totalRow); totalRowIdx = aoa.length - 1; }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
  const n = headers.length;
  styleTitle(ws, 0, n);
  styleHeaderRow(ws, headerRowIdx, n);
  if (lastDataRow >= firstDataRow) styleDataRows(ws, firstDataRow, lastDataRow, n);
  if (totalRowIdx >= 0) styleTotalRow(ws, totalRowIdx, n);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
};
