/**
 * Import Engine V2 — API handler.
 * Handles: job creation, validation, batch processing, progress, rollback, history.
 * All routes require admin auth + imports:execute permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { ImportJob, ImportBatch } from '@/lib/models';
import { validateRecords, estimateDuplicates, processBatch, cancelJob, rollbackJob, updateDuplicateEstimate, markBatchFailed } from '@/lib/import/import-v2-engine';
import { parseImportFile, generateFileHash } from '@/lib/import/v2-parsers';
import { safePost, safeFetch } from '@/lib/import/safe-fetch';

// ============ POST /api/admin/import-v2/upload ============
// Upload file, create ImportJob, return jobId.

export async function handleImportV2Upload(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 3 || segments[2] !== 'upload') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } }, { status: 400 });
  }

  // Size check
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB, max 10 MB)` } }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const importId = `imp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  // Compute MD5 hash manually — avoids crypto.createHash compatibility issues
  const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);

  try {
    const parsed = await parseImportFile(buffer.buffer as ArrayBuffer, file.name, file.type);

    const job = await ImportJob.create({
      importId,
      fileName: file.name,
      fileType: parsed.fileType,
      fileSize: file.size,
      fileHash: hash,
      totalRecords: parsed.totalRecords,
      status: 'parsing',
      totalBatches: 0,
      batchSize: 200,
      duplicateMode: 'skip',
      publishMode: 'immediate',
      dryRun: false,
      createMissingBrands: true,
      createdBy: authResult.admin._id,
      previewData: [],
      previewStats: undefined,
    });

    // Normalize and validate
    const { normalized, validCount, invalidCount, warnings, fieldInfo } = await validateRecords(importId, parsed.records);

    // Count total batches
    const totalBatches = Math.ceil(validCount / 200);
    await ImportJob.findOneAndUpdate(
      { importId },
      { $set: { status: 'ready', totalRecords: normalized.length, totalBatches, previewStats: { ...fieldInfo, totalRecords: normalized.length, validRecords: validCount, invalidRecords: invalidCount, warnings: warnings.length, duplicateEstimate: 0 } } },
    );

    // Update duplicate estimate
    await updateDuplicateEstimate(importId);

    return NextResponse.json({
      success: true,
      data: {
        importId,
        fileType: parsed.fileType,
        fileName: file.name,
        fileSize: file.size,
        totalRecords: normalized.length,
        validRecords: validCount,
        invalidRecords: invalidCount,
        warnings: warnings.length,
        duplicateEstimate: job.previewStats?.duplicateEstimate || 0,
        recognizedFields: fieldInfo.recognizedFields,
        ignoredFields: fieldInfo.ignoredFields,
        missingFields: fieldInfo.missingFields,
        firstRecords: normalized.slice(0, 20).map(r => ({
          rowNumber: r.originalRowNumber,
          normalized: r.normalizedData,
          errors: r.errors,
          warnings: r.warnings,
          duplicateKey: r.duplicateKey,
        })),
        totalBatches,
        sampleInvalidRecords: normalized.filter(r => r.errors.length > 0).slice(0, 10).map(r => ({
          rowNumber: r.originalRowNumber,
          brand: r.normalizedData.brand,
          model: r.normalizedData.model,
          errors: r.errors,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'PARSE_ERROR', message: err.message } }, { status: 400 });
  }
}

// ============ POST /api/admin/import-v2/jobs/:id/validate ============
// Re-validate an uploaded job — returns preview stats and records.
// URL: /api/admin/import-v2/jobs/imp_xxx/validate → segments[3]=importId, segments[4]='validate'

export async function handleImportV2Validate(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'validate') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const importId = segments[3];
  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });

  const recognizedFields: string[] = [];
  const ignoredFields: string[] = [];
  const missingFields: string[] = [];

  if (job.previewStats) {
    if (job.previewStats.recognizedFields) recognizedFields.push(...job.previewStats.recognizedFields);
    if (job.previewStats.ignoredFields) ignoredFields.push(...job.previewStats.ignoredFields);
    if (job.previewStats.missingFields) missingFields.push(...job.previewStats.missingFields);
  }

  return NextResponse.json({
    success: true,
    data: {
      importId,
      totalRecords: job.totalRecords,
      validRecords: job.previewStats?.validRecords || 0,
      invalidRecords: job.previewStats?.invalidRecords || 0,
      warnings: job.previewStats?.warnings || 0,
      duplicateEstimate: job.previewStats?.duplicateEstimate || 0,
      fields: { recognizedFields, ignoredFields, missingFields },
      preview: (job.previewData || []).map((r: any) => ({
        rowNumber: r.rowNumber,
        normalized: r.normalizedData,
        errors: r.errors,
        warnings: r.warnings,
        duplicateKey: r.duplicateKey,
      })),
    },
  });
}

// ============ POST /api/admin/import-v2/jobs/:id/config ============
// Set duplicate mode, batch size, publish mode, dry run.
// URL: /api/admin/import-v2/jobs/imp_xxx/config → segments[3]=importId, segments[4]='config'

export async function handleImportV2Config(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'config') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const body = await req.json();
  const { duplicateMode, batchSize, publishMode, dryRun } = body;

  if (duplicateMode && !['skip', 'update', 'replace', 'create_variant', 'review'].includes(duplicateMode)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_MODE', message: `Invalid duplicate mode: ${duplicateMode}` } }, { status: 400 });
  }

  const update: any = { updatedAt: new Date() };
  if (duplicateMode) update.duplicateMode = duplicateMode;
  if (batchSize && batchSize >= 50 && batchSize <= 500) update.batchSize = batchSize;
  if (publishMode) update.publishMode = publishMode;
  if (typeof dryRun === 'boolean') update.dryRun = dryRun;

  // Recalculate batches if batch size changed
  if (batchSize) {
    const job = await ImportJob.findOne({ importId }).select('totalBatches').lean();
    if (job?.totalBatches) {
      update.totalBatches = Math.ceil((job.totalBatches > 0 ? job.totalRecords : 0) / batchSize);
    }
  }

  await ImportJob.findOneAndUpdate({ importId }, { $set: update }, { new: true, upsert: true });

  return NextResponse.json({ success: true, data: { importId, ...update } });
}

// ============ POST /api/admin/import-v2/jobs/:id/start ============
// URL: /api/admin/import-v2/jobs/imp_xxx/start → segments[3]=importId, segments[4]='start'

export async function handleImportV2Start(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'start') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];

  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });
  if (!['ready', 'paused'].includes(job.status)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Job cannot be started (status: ${job.status})` } }, { status: 400 });
  }

  const totalBatches = Math.ceil(job.totalRecords / job.batchSize);
  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { status: 'queued', totalBatches, startedAt: new Date() } },
  );

  return NextResponse.json({ success: true, data: { importId, totalBatches, batchSize: job.batchSize, totalRecords: job.totalRecords, dryRun: job.dryRun } });
}

// ============ POST /api/admin/import-v2/jobs/:id/batches/:batchNumber ============
// URL: /api/admin/import-v2/jobs/imp_xxx/batches/1 → segments[3]=importId, segments[4]='batches', segments[5]=batchNumber

export async function handleImportV2Batch(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 6 || segments[2] !== 'jobs' || segments[4] !== 'batches') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const batchNumber = parseInt(segments[5]);
  const body = await req.json();

  if (!body.records || !Array.isArray(body.records)) {
    return NextResponse.json({ success: false, error: { code: 'NO_RECORDS', message: 'No records array in request body' } }, { status: 400 });
  }

  if (body.records.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'EMPTY_BATCH', message: 'Empty batch — no records to process' } }, { status: 400 });
  }

  const maxBatch = body.records.length > 500 ? 500 : body.records.length;
  const records = body.records.slice(0, maxBatch);

  const checksum = records.map((r: any) => {
    const key = `${r.brand || ''}|${r.model || ''}`;
    return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
  }).join(',');

  try {
    const result = await processBatch({
      records,
      importId,
      batchNumber,
      duplicateMode: body.duplicateMode || 'skip',
      dryRun: body.dryRun || false,
      publishMode: body.publishMode || 'immediate',
      createMissingBrands: body.createMissingBrands !== false,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    // FIX #8: Mark batch as failed and transition job so it never stays stuck in 'processing'
    try { await markBatchFailed(importId, batchNumber, err.message || 'Unknown error'); } catch { /* best effort */ }
    return NextResponse.json({
      success: false,
      error: { code: 'BATCH_FAILED', message: err.message || 'Batch processing failed' },
      status: 500,
    });
  }
}

// ============ GET /api/admin/import-v2/jobs/:id ============
// URL: /api/admin/import-v2/jobs/imp_xxx → segments[3]=importId
// Must NOT match known action names (config, start, batches, retry, cancel, rollback, errors.csv, quality-scan)

const IMPORT_V2_ACTIONS = new Set(['config', 'start', 'batches', 'retry', 'cancel', 'rollback', 'errors.csv', 'quality-scan', 'progress', 'failed-rows', 'validate']);

export async function handleImportV2GetJob(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 4 || segments[2] !== 'jobs' || !segments[3]) return undefined;
  // Never treat action names as importId
  if (IMPORT_V2_ACTIONS.has(segments[3])) return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const importId = segments[3];
  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });

  const batches = await ImportBatch.find({ importId }).sort({ batchNumber: 1 }).select('-errors -fieldChanges -createdPhoneIds -updatedPhoneIds').lean();
  const completedCount = batches.filter(b => b.status === 'completed').length;

  return NextResponse.json({
    success: true,
    data: {
      ...job,
      completedBatches: completedCount,
      totalBatches: job.totalBatches,
      batches: batches.map(b => ({
        batchNumber: b.batchNumber,
        status: b.status,
        attemptCount: b.attemptCount,
        created: b.created,
        updated: b.updated,
        replaced: b.replaced,
        skipped: b.skipped,
        failed: b.failed,
        errorCount: b.errors?.length || 0,
      })),
    },
  });
}

// ============ POST /api/admin/import-v2/jobs/:id/retry ============
// URL: /api/admin/import-v2/jobs/imp_xxx/retry → segments[3]=importId, segments[4]='retry'

export async function handleImportV2Retry(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'retry') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });
  if (job.status !== 'completed_with_errors' && job.status !== 'failed') {
    return NextResponse.json({ success: false, error: { code: 'NOT_RETRYABLE', message: 'Only failed or partially completed jobs can be retried' } }, { status: 400 });
  }

  // Find failed batches and re-run them
  const failedBatches = await ImportBatch.find({ importId, status: 'failed' }).sort({ batchNumber: 1 }).lean();
  if (failedBatches.length === 0) {
    return NextResponse.json({ success: true, data: { message: 'No failed batches to retry' } });
  }

  // Re-run failed batches
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalFailed = 0;
  const errors: any[] = [];

  for (const batch of failedBatches) {
    // Get original records from preview
    if (!job.previewData?.[batch.recordStart - 1]) continue;

    const batchRecords = job.previewData.slice(batch.recordStart - 1, batch.recordEnd);
    if (!batchRecords?.length) continue;

    try {
      const result = await processBatch({
        records: batchRecords,
        importId,
        batchNumber: batch.batchNumber,
        duplicateMode: job.duplicateMode || 'skip',
        dryRun: false,
        publishMode: job.publishMode || 'immediate',
        createMissingBrands: job.createMissingBrands !== false,
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalFailed += result.failed;
      errors.push(...result.errors.map(e => ({ ...e, batchNumber: batch.batchNumber })));
    } catch (err: any) {
      totalFailed++;
      errors.push({ errorCode: 'RETRY_FAILED', errorMessage: err.message, batchNumber: batch.batchNumber });
    }
  }

  return NextResponse.json({
    success: true,
    data: { retriedBatches: failedBatches.length, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, failed: totalFailed, errors: errors.slice(0, 50) },
  });
}

// ============ POST /api/admin/import-v2/jobs/:id/cancel ============
// URL: /api/admin/import-v2/jobs/imp_xxx/cancel → segments[3]=importId, segments[4]='cancel'

export async function handleImportV2Cancel(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'cancel') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  await cancelJob(importId);
  return NextResponse.json({ success: true, data: { importId } });
}

// ============ POST /api/admin/import-v2/jobs/:id/rollback ============
// URL: /api/admin/import-v2/jobs/imp_xxx/rollback → segments[3]=importId, segments[4]='rollback'

export async function handleImportV2Rollback(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'rollback') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const dryRun = req.headers.get('x-dry-run') === 'true';

  if (dryRun) {
    const job = await ImportJob.findOne({ importId }).select('fileName status totalRecords createdRecords updatedRecords totalBatches').lean();
    const batches = await ImportBatch.find({ importId, status: 'completed' }).select('createdPhoneIds updatedPhoneIds fieldChanges').lean();
    const wouldDelete = batches.reduce((sum, b) => sum + (b.createdPhoneIds?.length || 0), 0);
    const wouldRestore = batches.reduce((sum, b) => sum + (b.fieldChanges?.length || 0), 0);
    return NextResponse.json({
      success: true,
      data: { dryRun: true, importId, fileName: job.fileName, wouldDelete, wouldRestore, totalBatches: job.totalBatches },
    });
  }

  const result = await rollbackJob(importId);
  return NextResponse.json({ success: true, data: result });
}

// ============ GET /api/admin/import-v2/jobs/:id/errors.csv ============
// URL: /api/admin/import-v2/jobs/imp_xxx/errors.csv → segments[3]=importId, segments[4]='errors.csv'

export async function handleImportV2ErrorsCsv(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'errors.csv') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const importId = segments[3];

  const batches = await ImportBatch.find({ importId, errors: { $exists: true, $ne: [] } })
    .sort({ batchNumber: 1 })
    .select('errors batchNumber')
    .lean();

  const rows: string[][] = [
    ['rowNumber', 'brand', 'model', 'field', 'originalValue', 'errorCode', 'errorMessage', 'batchNumber', 'importId'],
  ];
  for (const batch of batches) {
    for (const err of (batch.errors || [])) {
      rows.push([
        String(err.rowNumber),
        err.brand || '',
        err.model || '',
        err.field || '',
        String(err.originalValue || '').replace(/^[=+\-@]/, "'"),
        err.errorCode || '',
        err.errorMessage || '',
        String(batch.batchNumber),
        importId,
      ]);
    }
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="import-${importId}-errors.csv"` },
  });
}

// ============ GET /api/admin/import-v2/history ============

export async function handleImportV2History(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 3 || segments[2] !== 'history') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') || '20'));

  const [jobs, total] = await Promise.all([
    ImportJob.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ImportJob.countDocuments({}),
  ]);

  return NextResponse.json({
    success: true,
    data: { jobs: jobs.map(j => ({
      importId: j.importId,
      fileName: j.fileName,
      fileType: j.fileType,
      fileSize: j.fileSize,
      totalRecords: j.totalRecords,
      processedRecords: j.processedRecords,
      createdRecords: j.createdRecords,
      updatedRecords: j.updatedRecords,
      skippedRecords: j.skippedRecords,
      failedRecords: j.failedRecords,
      status: j.status,
      duplicateMode: j.duplicateMode,
      currentBatch: j.currentBatch,
      totalBatches: j.totalBatches,
      dryRun: j.dryRun,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      duration: j.startedAt && j.completedAt ? Math.round(j.completedAt.getTime() - j.startedAt.getTime()) : null,
      rollbackStatus: j.rollbackStatus,
      errorSummary: j.errorSummary,
    })),
    total,
    page,
    limit,
  } });
}

// ============ POST /api/admin/import-v2/jobs/:id/quality-scan ============
// Trigger a data quality scan on phones from a completed import job.
// URL: /api/admin/import-v2/jobs/imp_xxx/quality-scan → segments[3]=importId, segments[4]='quality-scan'

export async function handleImportV2QualityScan(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'quality-scan') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });

  const { startScan, executeScan } = await import('@/lib/data-quality/scanner');

  const { scanId } = await startScan({
    type: 'import',
    adminId: authResult.admin._id.toString(),
    importId,
  });

  // FIX #12: Execute scan with error handling — don't fire-and-forget
  executeScan(scanId).catch(e => {
    console.error(`[ImportV2] Post-import quality scan ${scanId} failed:`, e);
    // Scan job status is already set to 'failed' by executeScan's catch block
  });

  return NextResponse.json({ success: true, scanId, message: 'Quality scan started for imported phones' });
}