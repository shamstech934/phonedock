/**
 * V2 Parsers — JSON, CSV, XLSX, ZIP.
 * Adds ZIP support, security validation, and strict size limits.
 * Reuses papaparse and xlsx from existing dependencies.
 */

import Papa from 'papaparse';
import JSZip from 'jszip';
import { readExcelRecords } from './excel-reader';
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
  const prototype = Object.getPrototypeOf(val);
  if (prototype === null || val.constructor?.name === 'Object' || val.constructor?.name === 'Array') {
    if (Object.keys(val).length > 500) return false;
    // Check OWN properties only — 'in' would also match constructor/__proto__ via
    // the prototype chain, which every normal object has, making this always false.
    const hasOwn = Object.prototype.hasOwnProperty;
    return !(hasOwn.call(val, '__proto__') || hasOwn.call(val, 'constructor') || hasOwn.call(val, 'prototype'));
  }
  return false;
}

/**
 * Parse JSON file content.
 */
export function parseJSON(content: string, fileName: string): ParsedFile {
  const warnings: string[] = [];
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (err: unknown) {
    return { records: [], fileType: 'json', fileName, totalRecords: 0, warnings: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`] };
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
    const obj = data as Record<string, unknown>;
    const wrapperKeys = ['phones', 'data', 'records', 'results', 'items', 'phone_data', 'phones_data'];
    for (const key of wrapperKeys) {
      if (Array.isArray(obj[key])) {
        const arr = obj[key] as unknown[];
        if (arr.length > MAX_RECORDS) warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${arr.length})`);
        return { records: (arr as Record<string, unknown>[]).slice(0, MAX_RECORDS), fileType: 'json', fileName, totalRecords: arr.length, warnings };
      }
    }
    // Single object
    if (obj.brand || obj.model || obj.modelName || obj.pricePKR) {
      return { records: [obj as Record<string, unknown>], fileType: 'json', fileName, totalRecords: 1, warnings };
    }
  }

  return { records: [], fileType: 'json', fileName, totalRecords: 0, warnings: ['JSON did not contain recognizable phone data'] };
}

/**
 * Parse CSV file content.
 */
export function parseCSV(content: string, fileName: string): ParsedFile {
  const warnings: string[] = [];

  // Strip a UTF-8 BOM if present, since it can otherwise become part of the first header name.
  const source = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

  const result = Papa.parse(source, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''),
  });

  // Reject heavily malformed CSV files. The previous condition compared the
  // record count with half of itself, so it could never be true. Treat a file as
  // unusable when parsing produced no rows, or when errors outnumber valid rows.
  if (result.errors.length > 0 && (result.data.length === 0 || result.errors.length > result.data.length)) {
    return { records: [], fileType: 'csv', fileName, totalRecords: 0, warnings: [`CSV parse errors: ${result.errors.length}`] };
  }
  if (result.errors.length > 0) {
    warnings.push(`CSV parsed with ${result.errors.length} warning${result.errors.length === 1 ? '' : 's'}`);
  }

  let records = result.data as Record<string, unknown>[];
  if (records.length > MAX_RECORDS) {
    warnings.push(`Truncated to ${MAX_RECORDS} records (total: ${records.length})`);
    records = records.slice(0, MAX_RECORDS);
  }

  // Sanitize each *value* against spreadsheet-formula injection (=, +, -, @ prefixes)
  // now that CSV structure (including commas inside quoted fields) has already
  // been parsed correctly — sanitizing the raw text before parsing would corrupt
  // any quoted field that itself contains a comma.
  const stripFormulaPrefix = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    return /^[=+\-@\t\r]/.test(value.trim()) ? '' : value;
  };
  const sanitizedRecords = records.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(row)) clean[key] = stripFormulaPrefix(row[key]);
    return clean;
  });

  // Sanitize each record for prototype pollution
  const safeRecords = sanitizedRecords.filter(r => isSafeObject(r));

  return { records: safeRecords, fileType: 'csv', fileName, totalRecords: records.length, warnings };
}

/** Parse XLSX buffer with maintained ExcelJS. */
export async function parseXLSX(buffer: ArrayBuffer, fileName: string): Promise<ParsedFile> {
  const warnings: string[] = [];
  try {
    let records = await readExcelRecords(buffer, MAX_RECORDS);
    const safeRecords = records.filter(record => isSafeObject(record));
    if (safeRecords.length !== records.length) warnings.push('Unsafe records were discarded');
    return { records: safeRecords, fileType: 'xlsx', fileName, totalRecords: records.length, warnings };
  } catch (err: unknown) {
    return { records: [], fileType: 'xlsx', fileName, totalRecords: 0, warnings: [`XLSX parse error: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

/**
 * Parse ZIP file — extracts and validates contained files.
 */
export async function parseZIP(buffer: ArrayBuffer, fileName: string): Promise<ParsedFile> {
  const warnings: string[] = [];
  try {
    const archive = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
    const entries = Object.values(archive.files);
    if (!entries.length) return { records: [], fileType: 'zip', fileName, totalRecords: 0, warnings: ['ZIP file is empty'] };
    if (entries.length > MAX_ZIP_FILE_COUNT) throw new Error(`ZIP contains ${entries.length} files (max ${MAX_ZIP_FILE_COUNT})`);
    let allRecords: Record<string, unknown>[] = [];
    let totalExtracted = 0;
    let totalFileCount = 0;
    for (const entry of entries) {
      const originalName = entry.name;
      if (entry.dir) continue;
      if (UNSAFE_PATTERNS.some(pattern => pattern.test(originalName))) throw new Error(`Unsafe entry rejected: ${originalName}`);
      const ext = originalName.toLowerCase().split('.').pop() || '';
      if (!['json', 'csv', 'xlsx'].includes(ext)) continue;
      const data = await entry.async('uint8array');
      totalExtracted += data.byteLength;
      if (totalExtracted > MAX_ZIP_TOTAL_SIZE) throw new Error(`Extracted data exceeds ${MAX_ZIP_TOTAL_SIZE / 1048576} MB limit`);
      if (buffer.byteLength > 0 && totalExtracted / buffer.byteLength > MAX_ZIP_COMPRESSION_RATIO) throw new Error('Suspicious ZIP compression ratio');
      totalFileCount++;
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const parsed = ext === 'json'
        ? parseJSON(new TextDecoder().decode(data), originalName)
        : ext === 'csv'
          ? parseCSV(new TextDecoder().decode(data), originalName)
          : await parseXLSX(arrayBuffer, originalName);
      allRecords.push(...parsed.records.map(record => ({ ...record, _sourceFile: originalName })));
      warnings.push(...parsed.warnings.map(warning => `[${originalName}] ${warning}`));
    }
    if (!totalFileCount) throw new Error('ZIP contains no supported files (JSON, CSV, or XLSX)');
    if (allRecords.length > MAX_RECORDS) { warnings.push(`Truncated to ${MAX_RECORDS} records`); allRecords = allRecords.slice(0, MAX_RECORDS); }
    return { records: allRecords, fileType: 'zip', fileName, totalRecords: allRecords.length, warnings };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown ZIP error';
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

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'zip') return parseZIP(buffer, fileName);

  if (detected === 'xlsx') {
    return await parseXLSX(buffer, fileName);
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