import Papa from 'papaparse';
import { parseExcelRecords } from './excel';
import { RawPhoneRecord } from './types';
import { sanitizeCsvValue } from '@/lib/auth';

// ============ JSON PARSER ============
export function parseJSON(content: string): RawPhoneRecord[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      // Try to detect if it's a single object or has a wrapper key
      if (typeof parsed === 'object' && parsed !== null) {
        // Check for common wrapper keys
        const wrapperKeys = ['phones', 'data', 'records', 'results', 'items'];
        for (const key of wrapperKeys) {
          if (Array.isArray(parsed[key])) {
            return parsed[key];
          }
        }
        // Single object
        return [parsed];
      }
      throw new Error('JSON must be an array or object containing a phone array');
    }
    return parsed;
  } catch (e: unknown) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ============ CSV PARSER ============
export async function parseCSV(content: string): Promise<RawPhoneRecord[]> {
  const results = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results: Papa.ParseResult<Record<string, unknown>>) => resolve(results),
      error: (error: Error) => reject(new Error(`CSV parsing error: ${error.message}`)),
    });
  });

  if (results.errors.length > 0) {
    const criticalErrors = results.errors.filter(
      (e: { type: string; code?: string; message: string }) => e.type === 'FieldMismatch' && e.code !== 'TooManyFields'
    );
    if (criticalErrors.length > results.data.length * 0.5) {
      throw new Error(`CSV parsing errors: ${criticalErrors.map((e) => e.message).join(', ')}`);
    }
  }
  if (!results.data || results.data.length === 0) {
    throw new Error('CSV file is empty or has no valid rows');
  }
  // Apply CSV formula injection protection to all string values
  const sanitized = results.data.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      clean[key] = typeof value === 'string' ? sanitizeCsvValue(value) : value;
    }
    return clean;
  });
  return sanitized as RawPhoneRecord[];
}

// ============ XLSX PARSER ============
export async function parseXLSX(buffer: ArrayBuffer): Promise<RawPhoneRecord[]> {
  try {
    const { records } = await parseExcelRecords(buffer);
    return records as RawPhoneRecord[];
  } catch (e: unknown) {
    throw new Error(`Excel parsing error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ============ DETECT FILE TYPE ============
export function detectFileType(filename: string, mimeType?: string): 'json' | 'csv' | 'xlsx' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'csv') return 'csv';
  if (['xlsx', 'xls'].includes(ext || '')) return 'xlsx';

  // Fallback to MIME type
  if (mimeType) {
    if (mimeType === 'application/json') return 'json';
    if (mimeType === 'text/csv') return 'csv';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  }

  return null;
}

// ============ PARSE BY TYPE ============
export async function parseFile(content: string | ArrayBuffer, fileType: 'json' | 'csv' | 'xlsx'): Promise<RawPhoneRecord[]> {
  switch (fileType) {
    case 'json':
      return parseJSON(typeof content === 'string' ? content : new TextDecoder().decode(content));
    case 'csv':
      return parseCSV(typeof content === 'string' ? content : new TextDecoder().decode(content));
    case 'xlsx':
      return await parseXLSX(content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}