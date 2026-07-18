/**
 * V2 Parsers — JSON, CSV, XLSX, ZIP.
 * Adds ZIP support, security validation, and strict size limits.
 * Reuses papaparse and xlsx from existing dependencies.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { detectFileType } from './parsers'; // reuse V1 detection

// ── Security Constants ─────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ZIP_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB extracted
const MAX_ZIP_FILE_COUNT = 50;
const MAX_ZIP_COMPRESSION_RATIO = 50; // extracted/compressed > 50x = likely bomb
const MAX_RECORDS = 50000;
const MAX_NESTED_DEPTH = 5;

// ── Unsafe patterns for ZIP entries ───────────────────────────────────
const UNSAFE_PATTERNS = [
  /^.*\.\./,               // path traversal
  /^\/(etc|proc|sys|dev)\//,  // system paths
  /^\//,                      // absolute path
  /\.(exe|\.bat|\.sh|\.cmd|\.ps1|\.vbs|\.wsf|\.hta|\.scr)$/i, // executables
  /\.zip$/i,                  // nested archive
  /\.(jar|\.war)$/i,           // Java archives
];

export interface ParsedFile {
  records: Record<string, unknown>[];
  fileType: string;
  fileName: string;
  totalRecords: number;
  warnings: string[];
}

/**
 * Check if a value is a safe object (no prototype pollution, reasonable depth).
 */
function isSafeObject(val: unknown, depth = 0): boolean {
  if (depth > MAX_NESTED_DEPTH) return false;
  if (val == null || typeof val !== 'object') return true;
  if (Array.isArray(val)) return val.length <= 1000 && val.every(v => isSafeObject(v, depth + 1));
  if (val instanceof Date || val instanceof RegExp) return true;
  if (val.constructor?.name === 'Object' || val.constructor?.name === 'Array') {
    if (Object.keys(val).length > 500) return false;
    return !('__proto__' in val || 'constructor' in val || 'prototype' in val);
  }
  return false;
}

/**
 * Parse JSON file content.
 */
export function parseJSON(content: string, fileName: string): ParsedFile {
  const warnings: string[] = [];
  let data: any;

  try {
    data = JSON.parse(content);
  } catch (err: any) {
    return { records: [], fileType: 'json', fileName, totalRecords: 0, warnings: [`JSON parse error: ${err.message}`] };
  }

  // Array of objects
  if (Array.isArray(data)) {
    if (data.length > MAX_RECORDS) {
      return { records: data.slice(0, MAX_RECORDS), fileType: 'json', fileName, totalRecords: data.length, warnings: [...warnings, `Truncated to ${MAX_RECORDS} records (total: ${data.length})`] };
    }
    if (data.length === 0) return { records: [], fileType: 'json', fileName, totalRecords: 0, warnings };
    return { records: data, fileType: 'json', fileName, totalRecords: data.length, warnings };
  }

  // Wrapper: { phones: [...], data: [...], etc }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const wrapperKeys = ['phones', 'data', 'records', 'results', 'items', 'phone_data', 'phones_data'];
    for (const key of wrapperKeys) {
      if (Array.isArray(data[key])) {
        const arr = data[key];
        if (arr.length > MAX_RECORDS) warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${arr.length})`);
        return { records: arr.slice(0, MAX_RECORDS), fileType: 'json', fileName, totalRecords: arr.length, warnings };
      }
    }
    // Single object
    if (data.brand || data.model || data.modelName || data.pricePKR) {
      return { records: [data], fileType: 'json', fileName, totalRecords: 1, warnings };
    }
  }

  return { records: [], fileType: 'json', fileName, totalRecords: 0, warnings: ['JSON did not contain recognizable phone data'] };
}

/**
 * Parse CSV file content.
 */
export function parseCSV(content: string, fileName: string): ParsedFile {
  const warnings: string[] = [];

  // Sanitize: remove formula prefixes from cells
  const sanitized = content.split('\n').map(line => {
    return line.split(',').map(cell => {
      const trimmed = cell.trim();
      if (/^[=+\-@\t\r]/.test(trimmed)) return '';
      return trimmed;
    }).join(',');
  }).join('\n');

  const result = Papa.parse(sanitized, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''),
  });

  if (result.errors.length > 0 && result.data.length < result.data.length * 0.5) {
    return { records: [], fileType: 'csv', fileName, totalRecords: 0, warnings: [`CSV parse errors: ${result.errors.length}`] };
  }

  const records = result.data;
  if (records.length > MAX_RECORDS) {
    warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${records.length})`);
    records = records.slice(0, MAX_RECORDS);
  }

  // Sanitize each record for prototype pollution
  const safeRecords = records.filter(r => isSafeObject(r));

  return { records: safeRecords, fileType: 'csv', fileName, totalRecords: records.length, warnings };
}

/**
 * Parse XLSX buffer.
 */
export function parseXLSX(buffer: ArrayBuffer, fileName: string): ParsedFile {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'array', raw: false, cellDates: true });
    const sheetName = workbook.SheetNames[0] || 'Sheet1';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return { records: [], fileType: 'xlsx', fileName, totalRecords: 0, warnings: ['No sheets found in workbook'] };
    }

    const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (records.length > MAX_RECORDS) {
      warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${records.length})`);
      records = records.slice(0, MAX_RECORDS);
    }

    // Sanitize
    const safeRecords = records.filter(r => isSafeObject(r));

    return { records: safeRecords, fileType: 'xlsx', fileName, totalRecords: records.length, warnings };
  } catch (err: any) {
    return { records: [], fileType: 'xlsx', fileName, totalRecords: 0, warnings: [`XLSX parse error: ${err.message}`] };
  }
}

/**
 * Parse ZIP file — extracts and validates contained files.
 */
export async function parseZIP(buffer: ArrayBuffer, fileName: string): Promise<ParsedFile> {
  const warnings: string[] = [];

  try {
    const zip = new AdmZip(buffer);

    // Security: check compression ratio
    const compressedSize = buffer.byteLength;
    let totalExtracted = 0;
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return { records: [], fileType: 'zip', fileName, totalRecords: 0, warnings: ['ZIP file is empty'] };
    }

    if (entries.length > MAX_ZIP_FILE_COUNT) {
      throw new Error(`ZIP contains ${entries.length} files (max ${MAX_ZIP_FILE_COUNT})`);
    }

    // Validate each entry
    for (const entry of entries) {
      const entryName = entry.entryName;

      // Path traversal check
      for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.test(entryName)) {
          throw new Error(`Unsafe entry rejected: ${entryName}`);
        }
      }
    }

    // Extract and parse each valid file
    let allRecords: Record<string, unknown>[] = [];
    let totalFileCount = 0;

    for (const entry of entries) {
      const entryName = entry.entryName.toLowerCase();
      if (entry.isDirectory) continue;

      const ext = entryName.split('.').pop() || '';
      if (!['json', 'csv', 'xlsx'].includes(ext)) continue;

      totalFileCount++;
      const data = entry.getData();

      let parsed: ParsedFile;
      if (ext === 'json') {
        parsed = parseJSON(new TextDecoder().decode(data), entryName);
      } else if (ext === 'csv') {
        parsed = parseCSV(new TextDecoder().decode(data), entryName);
      } else if (ext === 'xlsx') {
        parsed = parseXLSX(data.buffer, entryName);
      } else {
        continue;
      }

      allRecords.push(...parsed.records.map(r => ({ ...r, _sourceFile: entryName })));
      totalExtracted += data.byteLength;
      warnings.push(...parsed.warnings.map(w => `[${entryName}] ${w}`));
    }

    // Compression ratio check
    if (totalExtracted > 0 && compressedSize > 0) {
      const ratio = totalExtracted / compressedSize;
      if (ratio > MAX_ZIP_COMPRESSION_RATIO) {
        throw new Error(`Suspicious compression ratio: ${ratio.toFixed(1)}x (max ${MAX_ZIP_COMPRESSION_RATIO}x). Possible ZIP bomb.`);
      }
    }

    if (totalExtracted > MAX_ZIP_TOTAL_SIZE) {
      throw new Error(`Extracted data exceeds ${MAX_ZIP_TOTAL_SIZE / (1024 * 1024)} MB limit`);
    }

    if (totalFileCount === 0) {
      throw new Error('ZIP contains no supported files (JSON, CSV, or XLSX)');
    }

    if (allRecords.length > MAX_RECORDS) {
      warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${allRecords.length})`);
      allRecords = allRecords.slice(0, MAX_RECORDS);
    }

    return { records: allRecords, fileType: 'zip', fileName, totalRecords: allRecords.length, warnings };
  } catch (err: any) {
    let message = err.message || 'Unknown ZIP error';
    if (message.includes('password')) message = 'ZIP file is password-protected (not supported)';
    return { records: [], fileType: 'zip', fileName, totalRecords: 0, warnings: [`ZIP error: ${message}`] };
  }
}

/**
 * Unified parse dispatcher. Detects type and routes to correct parser.
 */
export async function parseImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType?: string,
): Promise<ParsedFile> {
  const detected = detectFileType(fileName, mimeType);

  if (detected === 'zip') {
    return parseZIP(buffer, fileName);
  }
  if (detected === 'xlsx') {
    return parseXLSX(buffer, fileName);
  }
  if (detected === 'csv') {
    const content = new TextDecoder().decode(buffer);
    return parseCSV(content, fileName);
  }
  if (detected === 'json') {
    const content = new TextDecoder().decode(buffer);
    return parseJSON(content, fileName);
  }

  throw new Error(`Unsupported file type: ${fileName} (${mimeType || 'unknown'})`);
}

/**
 * Generate a simple hash for file integrity checking.
 */
export function generateFileHash(buffer: ArrayBuffer): string {
  const data = new Uint8Array(buffer);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash ^ data[i]) >>> 0) * 0x01000193;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}