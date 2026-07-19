/**
 * Import Engine V2 — API handler.
 * Handles: job creation, validation, batch processing, progress, rollback, history.
 * All routes require admin auth + imports:execute permission.
 *
 * CRITICAL FIX ROUND 2 APPLIED:
 * - Fix #2: Retry uses persisted batch payloads, not previewData
 * - Fix #5: Config selects totalRecords, rejects invalid batchSize, no upsert
 * - Fix #6: Batch handler uses saved job config, validates batchNumber
 * - Fix #7: All error responses use proper HTTP status codes
 * - Fix #12: CSV generation uses RFC-compatible escaping
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { ImportJob, ImportBatch, ImportRecord } from '@/lib/models';
import { validateRecords, estimateDuplicates, processBatch, cancelJob, rollbackJob, updateDuplicateEstimate, markBatchFailed, reconcileJobCounters } from '@/lib/import/import-v2-engine';
import { parseImportFile, generateFileHash } from '@/lib/import/v2-parsers';

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
  const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);

  try {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const parsed = await parseImportFile(arrayBuffer, file.name, file.type);

    await ImportJob.create({
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

    // Persist every source row server-side. This is the durable source of truth for
    // processing, retry, resume, and browser-refresh recovery. Rows are stored as
    // separate documents to avoid MongoDB's 16 MB document limit on large imports.
    const RECORD_INSERT_CHUNK = 500;
    for (let offset = 0; offset < parsed.records.length; offset += RECORD_INSERT_CHUNK) {
      const chunk = parsed.records.slice(offset, offset + RECORD_INSERT_CHUNK).map((payload, index) => ({
        importId,
        rowNumber: offset + index + 1,
        payload,
        checksum: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      }));
      if (chunk.length > 0) await ImportRecord.insertMany(chunk, { ordered: true });
    }

    // Normalize and validate
    const { normalized, validCount, invalidCount, warnings, fieldInfo } = await validateRecords(importId, parsed.records);

    // Every source row must belong to exactly one batch, including invalid rows.
    const totalBatches = Math.ceil(normalized.length / 200);
    await ImportJob.findOneAndUpdate(
      { importId },
      { $set: { status: 'ready', totalRecords: normalized.length, totalBatches, previewStats: { ...fieldInfo, totalRecords: normalized.length, validRecords: validCount, invalidRecords: invalidCount, warnings: warnings.length, duplicateEstimate: 0, estimateType: 'pending' } } },
    );

    // Update duplicate estimate
    await updateDuplicateEstimate(importId);

    // Re-read job to get the updated duplicateEstimate
    const updatedJob = await ImportJob.findOne({ importId }).select('previewStats.duplicateEstimate').lean();

    return NextResponse.json({
      success: true,
      data: {
        importId,
        jobId: importId,
        fileType: parsed.fileType,
        fileName: file.name,
        fileSize: file.size,
        totalRecords: normalized.length,
        validRecords: validCount,
        invalidRecords: invalidCount,
        warnings: warnings.length,
        duplicateEstimate: updatedJob?.previewStats?.duplicateEstimate || 0,
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
  } catch (err: unknown) {
    // Avoid leaving a half-created job/source payload after parse or persistence failure.
    await Promise.allSettled([
      ImportRecord.deleteMany({ importId }),
      ImportBatch.deleteMany({ importId }),
      ImportJob.deleteOne({ importId }),
    ]);
    return NextResponse.json({ success: false, error: { code: 'PARSE_ERROR', message: err instanceof Error ? err.message : String(err) } }, { status: 400 });
  }
}

// ============ POST /api/admin/import-v2/jobs/:id/validate ============

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
      estimateType: (job.previewStats as Record<string, unknown> | null)?.estimateType || 'unknown',
      fields: { recognizedFields, ignoredFields, missingFields },
      preview: (job.previewData || []).map((r: Record<string, unknown>) => ({
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
// FIX #5: Select totalRecords, reject invalid batchSize, no upsert, 404 for missing jobs

export async function handleImportV2Config(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'config') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const body = await req.json();
  const { duplicateMode, batchSize, publishMode, dryRun, createMissingBrands } = body;

  if (duplicateMode && !['skip', 'update', 'replace', 'create_variant', 'review'].includes(duplicateMode)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_MODE', message: `Invalid duplicate mode: ${duplicateMode}` } }, { status: 400 });
  }

  // FIX #5: Select both totalBatches AND totalRecords
  const job = await ImportJob.findOne({ importId }).select('totalBatches totalRecords status').lean();

  // FIX #5: Return 404 when importId does not exist
  if (!job) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });
  }

  // FIX #5: Reject if not in configurable state
  if (!['ready', 'parsing'].includes(job.status)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot configure job in status: ${job.status}` } }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (duplicateMode) update.duplicateMode = duplicateMode;

  // FIX #5: Validate and clamp batchSize
  if (batchSize !== undefined && batchSize !== null) {
    if (!Number.isInteger(batchSize) || batchSize < 50 || batchSize > 500) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_BATCH_SIZE', message: 'batchSize must be an integer between 50 and 500' } }, { status: 400 });
    }
    update.batchSize = batchSize;
    // FIX #5: Use totalRecords (now properly selected) to recalculate
    const totalRecords = job.totalRecords || 0;
    update.totalBatches = Math.ceil(totalRecords / batchSize);
  }

  if (publishMode && ['immediate', 'review'].includes(publishMode)) update.publishMode = publishMode;
  if (typeof createMissingBrands === 'boolean') update.createMissingBrands = createMissingBrands;
  if (typeof dryRun === 'boolean') update.dryRun = dryRun;

  // FIX #5: Do NOT use upsert: true — never create a fake job through config
  const updated = await ImportJob.findOneAndUpdate({ importId }, { $set: update }, { new: true });

  return NextResponse.json({ success: true, data: { importId, ...update } });
}

// ============ POST /api/admin/import-v2/jobs/:id/start ============

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
// FIX #6: Uses saved job config, validates batchNumber and checksum

export async function handleImportV2Batch(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 6 || segments[2] !== 'jobs' || segments[4] !== 'batches') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const batchNumber = Number.parseInt(segments[5], 10);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* body is optional; source rows live in MongoDB */ }

  // FIX #6: Load job and use its saved configuration
  const job = await ImportJob.findOne({ importId }).select(
    'duplicateMode dryRun publishMode createMissingBrands batchSize totalBatches status totalRecords'
  ).lean();

  // FIX #6: Verify job exists
  if (!job) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });
  }

  // FIX #6: Verify job is in allowed state
  if (!['queued', 'processing', 'paused', 'completed_with_errors'].includes(job.status)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Job cannot accept batches in status: ${job.status}` } }, { status: 400 });
  }

  // FIX #6: Reject batchNumber outside valid range
  if (batchNumber < 1 || batchNumber > job.totalBatches) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_BATCH', message: `batchNumber must be 1..${job.totalBatches} (got ${batchNumber})` } }, { status: 400 });
  }

  // Load the durable server-side source rows for this range. The browser never
  // needs to retain or re-send the original file, so retry/resume works after refresh.
  const recordStart = (batchNumber - 1) * job.batchSize + 1;
  const recordEnd = Math.min(recordStart + job.batchSize - 1, job.totalRecords);
  const sourceRows = await ImportRecord.find({
    importId,
    rowNumber: { $gte: recordStart, $lte: recordEnd },
  }).sort({ rowNumber: 1 }).select('rowNumber payload checksum -_id').lean();

  const expectedCount = recordEnd - recordStart + 1;
  if (sourceRows.length !== expectedCount) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SOURCE_ROWS_MISSING',
        message: `Expected ${expectedCount} persisted rows for batch ${batchNumber}, found ${sourceRows.length}`,
      },
    }, { status: 409 });
  }

  const records = sourceRows.map(row => row.payload as Record<string, unknown>);
  const checksum = crypto.createHash('sha256')
    .update(sourceRows.map(row => `${row.rowNumber}:${row.checksum}`).join('|'))
    .digest('hex');

  if (typeof body.checksum === 'string' && body.checksum !== checksum) {
    return NextResponse.json({ success: false, error: { code: 'CHECKSUM_MISMATCH', message: 'Batch checksum mismatch' } }, { status: 409 });
  }

  // FIX #6: Use saved job config, NOT request body
  const duplicateMode = job.duplicateMode || 'skip';
  const dryRun = job.dryRun || false;
  const publishMode = job.publishMode || 'immediate';
  const createMissingBrands = job.createMissingBrands !== false;

  try {
    const result = await processBatch({
      records,
      importId,
      batchNumber,
      duplicateMode,
      dryRun,
      publishMode,
      createMissingBrands,
      batchSize: job.batchSize,
      checksum,
      recordStart,
      recordEnd,
    });

    // FIX #9: Reconcile counters before potentially completing
    await reconcileJobCounters(importId);

    return NextResponse.json({ success: true, data: { ...result, total: records.length } });
  } catch (err: unknown) {
    // FIX #7: Return actual HTTP 500, not 200 with status in body
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    try { await markBatchFailed(importId, batchNumber, errMsg); } catch { /* best effort */ }
    return NextResponse.json({
      success: false,
      error: { code: 'BATCH_FAILED', message: errMsg },
    }, { status: 500 });
  }
}

// ============ GET /api/admin/import-v2/jobs/:id ============

const IMPORT_V2_ACTIONS = new Set(['config', 'start', 'batches', 'retry', 'cancel', 'rollback', 'errors.csv', 'quality-scan', 'progress', 'failed-rows', 'validate']);

export async function handleImportV2GetJob(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 4 || segments[2] !== 'jobs' || !segments[3]) return undefined;
  if (IMPORT_V2_ACTIONS.has(segments[3])) return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const importId = segments[3];
  const job = await ImportJob.findOne({ importId }).lean();
  if (!job) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });

  const batches = await ImportBatch.find({ importId }).sort({ batchNumber: 1 }).select('-errors -fieldChanges -createdPhoneIds -updatedPhoneIds -specsChanges').lean();
  const completedCount = batches.filter(b => b.status === 'completed').length;

  return NextResponse.json({
    success: true,
    data: {
      ...job,
      completedBatches: completedCount,
      totalBatches: job.totalBatches,
      batches: batches.map(b => ({
        batchNumber: b.batchNumber,
        executionMode: (b as unknown as { executionMode?: string }).executionMode || 'real',
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
// FIX #2: Retry uses persisted batch payloads, not previewData (which only has 50 rows)

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

  const failedBatches = await ImportBatch.find({ importId, status: 'failed' }).sort({ batchNumber: 1 }).lean();
  if (failedBatches.length === 0) {
    return NextResponse.json({ success: true, data: { message: 'No failed batches to retry', retried: 0 } });
  }

  await ImportJob.updateOne({ importId }, { $set: { status: 'processing', completedAt: null } });

  const retryResults: Array<Record<string, unknown>> = [];
  for (const batch of failedBatches) {
    const recordStart = (batch.batchNumber - 1) * job.batchSize + 1;
    const recordEnd = Math.min(recordStart + job.batchSize - 1, job.totalRecords);
    const sourceRows = await ImportRecord.find({
      importId,
      rowNumber: { $gte: recordStart, $lte: recordEnd },
    }).sort({ rowNumber: 1 }).select('rowNumber payload checksum -_id').lean();

    const expectedCount = recordEnd - recordStart + 1;
    if (sourceRows.length !== expectedCount) {
      const message = `Persisted source rows missing for batch ${batch.batchNumber}: expected ${expectedCount}, found ${sourceRows.length}`;
      await markBatchFailed(importId, batch.batchNumber, message);
      retryResults.push({ batchNumber: batch.batchNumber, success: false, error: message });
      continue;
    }

    const checksum = crypto.createHash('sha256')
      .update(sourceRows.map(row => `${row.rowNumber}:${row.checksum}`).join('|'))
      .digest('hex');

    await ImportBatch.updateOne(
      { importId, batchNumber: batch.batchNumber },
      { $set: { status: 'retrying', completedAt: null } },
    );

    try {
      const result = await processBatch({
        records: sourceRows.map(row => row.payload as Record<string, unknown>),
        importId,
        batchNumber: batch.batchNumber,
        duplicateMode: job.duplicateMode,
        dryRun: job.dryRun,
        publishMode: job.publishMode,
        createMissingBrands: job.createMissingBrands,
        batchSize: job.batchSize,
        checksum,
        recordStart,
        recordEnd,
      });
      retryResults.push({ batchNumber: batch.batchNumber, success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await markBatchFailed(importId, batch.batchNumber, message);
      retryResults.push({ batchNumber: batch.batchNumber, success: false, error: message });
    }
  }

  await reconcileJobCounters(importId);

  const remainingFailed = await ImportBatch.countDocuments({ importId, status: 'failed' });
  const completed = await ImportBatch.countDocuments({ importId, status: 'completed', executionMode: job.dryRun ? 'dry_run' : 'real' });
  const allDone = completed >= job.totalBatches && remainingFailed === 0;
  await ImportJob.updateOne({ importId }, {
    $set: {
      status: allDone ? 'completed' : 'completed_with_errors',
      completedAt: new Date(),
      errorSummary: remainingFailed > 0 ? `${remainingFailed} batch(es) still failed after retry` : '',
    },
  });

  return NextResponse.json({
    success: remainingFailed === 0,
    data: {
      retried: failedBatches.length,
      remainingFailed,
      results: retryResults,
    },
  }, { status: remainingFailed === 0 ? 200 : 207 });
}

// ============ POST /api/admin/import-v2/jobs/:id/cancel ============
// FIX #11: Cancel validates job existence and state

export async function handleImportV2Cancel(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'cancel') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const result = await cancelJob(importId);

  if (!result.success) {
    // FIX #7: Return proper HTTP status
    const status = result.error?.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: { code: 'CANCEL_FAILED', message: result.error } }, { status });
  }

  return NextResponse.json({ success: true, data: { importId } });
}

// ============ POST /api/admin/import-v2/jobs/:id/rollback ============
// FIX #11: Rollback validates job existence and state

export async function handleImportV2Rollback(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'rollback') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:execute'); if (permCheck) return permCheck;

  const importId = segments[3];
  const dryRun = req.headers.get('x-dry-run') === 'true';

  if (dryRun) {
    const job = await ImportJob.findOne({ importId }).select('fileName status totalRecords createdRecords updatedRecords totalBatches').lean();
    // FIX #11: Check job exists
    if (!job) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Import job not found' } }, { status: 404 });
    }
    // FIX #11: Check rollback is allowed
    if (!['completed', 'completed_with_errors'].includes(job.status)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot rollback job in status: ${job.status}` } }, { status: 400 });
    }
    const batches = await ImportBatch.find({ importId, status: 'completed', executionMode: 'real' }).select('createdPhoneIds updatedPhoneIds fieldChanges specsChanges').lean();
    const wouldDelete = batches.reduce((sum, b) => sum + (b.createdPhoneIds?.length || 0), 0);
    const wouldRestore = batches.reduce((sum, b) => sum + (b.fieldChanges?.length || 0), 0);
    const wouldRestoreSpecs = batches.reduce((sum, b) => sum + ((b as unknown as { specsChanges?: unknown[] }).specsChanges?.length || 0), 0);
    return NextResponse.json({
      success: true,
      data: { dryRun: true, importId, fileName: job.fileName, wouldDelete, wouldRestore, wouldRestoreSpecs, totalBatches: job.totalBatches },
    });
  }

  const result = await rollbackJob(importId);

  // FIX #7: Return proper HTTP status for errors
  if (result.error) {
    const status = result.error.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: { code: 'ROLLBACK_FAILED', message: result.error } }, { status });
  }

  return NextResponse.json({ success: true, data: result });
}

// ============ GET /api/admin/import-v2/jobs/:id/errors.csv ============
// FIX #12: RFC-compatible CSV escaping

/**
 * RFC 4180 compliant CSV field escaping.
 * - Quotes are doubled
 * - Fields containing commas, quotes, or newlines are quoted
 * - Formula injection protection preserved
 */
function escapeCsvField(value: string): string {
  // Formula injection protection
  const safe = value.replace(/^[=+\-@\t\r]/, "'$&");
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function handleImportV2ErrorsCsv(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments.length !== 5 || segments[2] !== 'jobs' || segments[4] !== 'errors.csv') return undefined;
  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
  const permCheck = requirePermission(authResult.admin, 'imports:read'); if (permCheck) return permCheck;

  const importId = segments[3];

  const batches = await ImportBatch.find({ importId, errors: { $exists: true, $ne: [] } })
    .sort({ batchNumber: 1 })
    .select('errors batchNumber')
    .lean();

  // FIX #12: Use RFC-compatible escaping
  const rows: string[][] = [
    ['rowNumber', 'brand', 'model', 'field', 'originalValue', 'errorCode', 'errorMessage', 'batchNumber', 'importId'],
  ];
  for (const batch of batches) {
    for (const err of (batch.errors || [])) {
      rows.push([
        String(err.rowNumber),
        escapeCsvField(err.brand || ''),
        escapeCsvField(err.model || ''),
        escapeCsvField(err.field || ''),
        escapeCsvField(String(err.originalValue || '')),
        escapeCsvField(err.errorCode || ''),
        escapeCsvField(err.errorMessage || ''),
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

  executeScan(scanId).catch(e => {
    console.error(`[ImportV2] Post-import quality scan ${scanId} failed:`, e);
  });

  return NextResponse.json({ success: true, scanId, message: 'Quality scan started for imported phones' });
}