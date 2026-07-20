import ExcelJS from 'exceljs';

function cellValueToPrimitive(value: ExcelJS.CellValue): unknown {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  if ('result' in value) {
    const result = value.result;
    return result instanceof Date ? result.toISOString() : (result ?? '');
  }
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map(part => part.text).join('');
  }
  if ('hyperlink' in value && typeof value.text === 'string') return value.text;
  if ('error' in value) return '';

  return String(value);
}

/**
 * Parse the first worksheet from an XLSX file into plain objects.
 * Formula cells are reduced to their cached result; formula source is never executed.
 */
export async function parseExcelRecords(
  buffer: ArrayBuffer,
  maxRecords = 50_000,
): Promise<{ records: Record<string, unknown>[]; totalRecords: number; truncated: boolean }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as unknown as ExcelJS.Buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel file has no sheets');

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const headerCount = Math.min(headerRow.cellCount, 500);
  for (let column = 1; column <= headerCount; column += 1) {
    const raw = cellValueToPrimitive(headerRow.getCell(column).value);
    const rawHeader = String(raw ?? '').trim();
    const unsafeHeader = ['__proto__', 'prototype', 'constructor'].includes(rawHeader.toLowerCase());
    let header = !rawHeader || unsafeHeader ? `column_${column}` : rawHeader;
    if (headers.includes(header)) header = `${header}_${column}`;
    headers.push(header);
  }

  if (headers.every(header => /^column_\d+$/.test(header))) {
    throw new Error('Excel sheet has no header row');
  }

  const records: Record<string, unknown>[] = [];
  let totalRecords = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: Record<string, unknown> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      const value = cellValueToPrimitive(row.getCell(index + 1).value);
      record[header] = value;
      if (value !== '' && value != null) hasValue = true;
    });

    if (!hasValue) return;
    totalRecords += 1;
    if (records.length < maxRecords) records.push(record);
  });

  if (totalRecords === 0) throw new Error('Excel sheet is empty or has no valid rows');

  return { records, totalRecords, truncated: totalRecords > records.length };
}
