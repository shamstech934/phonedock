import ExcelJS from 'exceljs';

export type ExcelRecord = Record<string, unknown>;

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;
  if ('result' in value) return value.result ?? '';
  if ('text' in value) return value.text;
  if ('richText' in value) return value.richText.map(part => part.text).join('');
  if ('hyperlink' in value) { const link = value as { text?: string; hyperlink?: string }; return link.text || link.hyperlink || ''; }
  return String(value);
}

export async function readExcelRecords(buffer: ArrayBuffer, maxRecords = 50_000): Promise<ExcelRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) return [];
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[])
    .slice(1)
    .map((value, index) => String(cellValue(value) || `column_${index + 1}`).trim());
  const records: ExcelRecord[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || records.length >= maxRecords) return;
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    if (values.every(value => value == null || value === '')) return;
    const record: ExcelRecord = Object.create(null);
    headers.forEach((header, index) => {
      if (!header || ['__proto__', 'prototype', 'constructor'].includes(header.toLowerCase())) return;
      record[header] = cellValue(values[index]);
    });
    records.push(record);
  });
  return records;
}
