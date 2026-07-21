import { readExcelRecords } from './excel-reader';
export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  return readExcelRecords(buffer);
}
