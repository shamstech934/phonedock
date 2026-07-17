import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ActivityLog } from '@/lib/models';
import {
  connectDB, getAdminFromRequest, requirePermission, sanitizeCsvValue,
  MAX_UPLOAD_SIZE, MAX_UPLOAD_RECORDS, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES,
} from './helpers';
import { importPhones } from '@/lib/import/import-engine';
import { parseFile, detectFileType } from '@/lib/import/parsers';

// ============ IMPORT GET ============

export async function handleImportGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/import/history ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'history') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
    await connectDB();
    const { ImportHistory } = await import('@/lib/models/ImportHistory');
    const history = await ImportHistory.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json(history);
  }

  // ---- /api/import/stats ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
    await connectDB();
    const { ImportHistory } = await import('@/lib/models/ImportHistory');
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [totalImports, successfulImports, failedImports, todayImports] = await Promise.all([
      ImportHistory.countDocuments({}),
      ImportHistory.countDocuments({ status: { $ne: 'failed' } }),
      ImportHistory.countDocuments({ status: 'failed' }),
      ImportHistory.countDocuments({ createdAt: { $gte: todayStart } }),
    ]);
    const lastImport = await ImportHistory.findOne().sort({ createdAt: -1 }).select('createdAt duration filename').lean();
    const totalRecords = await ImportHistory.aggregate([{ $group: { _id: null, total: { $sum: '$imported' }, updated: { $sum: '$updated' }, failed: { $sum: '$failed' } } }]);
    const t = totalRecords[0] || {};
    return NextResponse.json({
      totalImports, successfulImports, failedImports, todayImports,
      totalImported: t.total || 0, totalUpdated: t.updated || 0, totalFailed: t.failed || 0,
      lastImportTime: (lastImport as any)?.createdAt || null,
      lastImportDuration: (lastImport as any)?.duration || 0,
    });
  }

  return undefined;
}

// ============ IMPORT POST ============

export async function handleImportPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/import (file upload) ----
  if (segments.length === 1 && segments[0] === 'import') {
    return handleFileUpload(req);
  }

  // ---- /api/import/validate ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'validate') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[] = [];
    try {
      if (ext === 'json') {
        records = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(records)) records = [records];
      } else if (ext === 'csv') {
        const result = await new Promise<{ data: any[] }>((resolve) => {
          Papa.parse(buffer.toString('utf-8'), { header: true, skipEmptyLines: true, complete: resolve });
        });
        records = result.data;
      } else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (sheetName) {
          records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
        }
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 400 });
    }
    return NextResponse.json({ valid: true, totalRecords: records.length, sample: records.slice(0, 3) });
  }

  // ---- /api/import/rollback ----
  if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'rollback') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:execute'); if (permCheck) return permCheck;
    const body = await req.json();
    return NextResponse.json({ success: false, error: 'Rollback not yet implemented. Use /api/import/history to track imports.' }, { status: 501 });
  }

  return undefined;
}

// ============ FILE UPLOAD HANDLER (SECURED) ============

async function handleFileUpload(req: NextRequest): Promise<NextResponse> {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error as NextResponse;
  const admin = authResult.admin!;
  const permCheck = requirePermission(admin, 'imports:execute');
  if (permCheck) return permCheck;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const autoCategorize = formData.get('autoCategorize') === 'true';
    const autoSEO = formData.get('autoSEO') === 'true';
    const autoReview = formData.get('autoReview') === 'true';
    const skipExisting = formData.get('skipExisting') === 'true';

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // File size check
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 400 });
    }

    // Extension check
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const fileType = detectFileType(file.name, file.type);
    if (!fileType || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .json, .csv, or .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[] = [];

    // Parse based on file type
    try {
      if (fileType === 'json') {
        records = await parseFile(buffer.toString('utf-8'), 'json');
      } else if (fileType === 'csv') {
        records = await parseFile(buffer.toString('utf-8'), 'csv');
      } else if (fileType === 'xlsx') {
        records = await parseFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), 'xlsx');
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 400 });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No phone records found in file' }, { status: 400 });
    }

    // Record count check
    if (records.length > MAX_UPLOAD_RECORDS) {
      return NextResponse.json({ error: `Too many records (max ${MAX_UPLOAD_RECORDS})` }, { status: 400 });
    }

    // Use the proper import engine
    const result = await importPhones(records, {
      filename: file.name,
      fileType,
      autoCategorize,
      autoSEO,
      autoReview,
      skipExisting,
    });

    await ActivityLog.create({
      adminId: admin._id,
      action: 'import',
      details: `Imported ${file.name}: ${result.inserted} new, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed in ${Math.round(result.duration / 1000)}s`,
      entityType: 'phone',
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      totalRecords: result.total,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      errors: result.errors,
      warnings: result.warnings,
      duration: result.duration,
      historyId: result.historyId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Import error: ${e.message}` }, { status: 500 });
  }
}