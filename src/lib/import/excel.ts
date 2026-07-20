import * as XLSX from 'xlsx';

/**
 * Compatibility Excel parser retained so older deployments that still contain
 * this file continue to type-check. Uses the project's existing `xlsx`
 * dependency; no `exceljs` dependency is required.
 */
export async function parseExcelRecords(
  buffer: ArrayBuffer,
  maxRecords = 50_000,
): Promise<{ records: Record<string, unknown>[]; totalRecords: number; truncated: boolean }> {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    dense: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('Excel file has no sheets');

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error('Excel file has no readable first sheet');

  const allRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const totalRecords = allRecords.length;
  const records = allRecords.slice(0, Math.max(0, maxRecords));

  return {
    records,
    totalRecords,
    truncated: totalRecords > records.length,
  };
}
