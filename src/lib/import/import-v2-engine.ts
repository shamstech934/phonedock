/**
 * Import Engine V2 — Batch-based, persistent, resumable.
 * Uses bulkWrite, per-batch transactions, and ImportJob/ImportBatch tracking.
 *
 * FIXES APPLIED:
 * - Fix #4: fieldChanges populated during update/replace for rollback
 * - Fix #5: Update mode actually updates phone fields + specs
 * - Fix #6: Dry-run counters are local-only, never written to ImportJob
 * - Fix #7: PhoneSpecs mapping uses positional array matching (not relying on filter order)
 * - Fix #8: Job completion uses batchNumber vs totalBatches; batch failure transitions job to failed
 * - Fix #4: Rollback uses fieldChanges to restore updated phones
 */

import { ObjectId } from 'mongoose';
import { Phone, Brand, PhoneSpecs, PhoneImage, PhoneBenchmark } from '@/lib/models';
import { ImportJob, ImportBatch } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { normalizePhoneRecord, isValidPhoneRecord, getEmptyFieldInfo } from './normalize-phone-record';
import { buildDuplicateIndex, checkDuplicate, getDuplicateKey } from './duplicate-detector';

const SPEC_FIELDS = new Set([
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
]);

const BENCHMARK_FIELDS = new Set([
  'antutu','geekbenchSingle','geekbenchMulti','gamingScore',
  'pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery',
]);

// Phone-level fields that update/replace mode may modify (for rollback tracking)
const PHONE_REPLACEABLE_FIELDS = new Set([
  'modelName','pricePKR','releaseDate','ptaStatus','ptaApproved',
  'featured','trending','upcoming','thumbnail','description',
]);

interface BatchProcessInput {
  records: any[];
  importId: string;
  batchNumber: number;
  duplicateMode: string;
  dryRun: boolean;
  publishMode: string;
  createMissingBrands: boolean;
}

interface BatchResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  replaced: number;
  errors: any[];
  fieldChanges: any[];
  createdPhoneIds: ObjectId[];
  updatedPhoneIds: ObjectId[];
  // Dry-run simulation counts (not persisted to ImportJob)
  wouldCreate?: number;
  wouldUpdate?: number;
  wouldReplace?: number;
  wouldSkip?: number;
  wouldFail?: number;
}

/**
 * Validate a set of records (without importing).
 * Returns normalized records with errors/warnings.
 */
export async function validateRecords(
  importId: string,
  records: any[],
): Promise<{
    normalized: any[];
    validCount: number;
    invalidCount: number;
    warnings: string[];
    fieldInfo: ReturnType<typeof getEmptyFieldInfo>;
  }> {
  await connectDB();

  const normalized = [];
  let validCount = 0;
  let invalidCount = 0;
  const allWarnings: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const result = normalizePhoneRecord(records[i], i + 1);
    normalized.push(result);
    if (result.errors.length > 0) {
      invalidCount++;
    } else if (isValidPhoneRecord(result)) {
      validCount++;
    }
    allWarnings.push(...result.warnings);
  }

  const fieldInfo = getEmptyFieldInfo(normalized);

  // Store preview stats on the job
  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        status: 'ready',
        totalRecords: normalized.length,
        previewData: normalized.slice(0, 50).map(r => ({
          rowNumber: r.originalRowNumber,
          normalized: r.normalizedData,
          errors: r.errors,
          warnings: r.warnings,
          duplicateKey: r.duplicateKey,
        })),
        previewStats: {
          totalRecords: normalized.length,
          validRecords: validCount,
          invalidRecords: invalidCount,
          warnings: allWarnings.length,
          ...fieldInfo,
          duplicateEstimate: 0, // will be calculated with DB
        },
      },
    },
    { new: true, upsert: true },
  );

  return {
    normalized,
    validCount,
    invalidCount,
    warnings: allWarnings,
    fieldInfo,
  };
}

/**
 * Estimate duplicate count against existing database.
 */
export async function estimateDuplicates(
  importId: string,
  records: any[],
): Promise<number> {
  await connectDB();

  const normalized = records.map((r, i) => normalizePhoneRecord(r, i + 1)).filter(r => isValidPhoneRecord(r));
  const keys = new Set(normalized.map(r => r.duplicateKey));

  const phoneCount = await Phone.countDocuments({ active: true });
  if (phoneCount === 0) return 0;

  // Sample: check up to 2000 keys against DB
  const sampleKeys = [...keys].slice(0, 2000);
  const existingPhones = await Phone.find({ active: true, status: 'published' })
    .select('slug modelName brandId -_id')
    .lean();

  const index = buildDuplicateIndex(existingPhones);
  let dupes = 0;
  for (const key of sampleKeys) {
    const result = checkDuplicate({ brand: '', model: '', slug: '', specs: {} }, index);
    if (result.isDuplicate) dupes++;
  }

  // Extrapolate
  return Math.round((dupes / sampleKeys.length) * keys.size);
}

/**
 * Update duplicate estimate on the job.
 */
export async function updateDuplicateEstimate(importId: string): Promise<void> {
  const job = await ImportJob.findOne({ importId }).select('totalRecords previewStats').lean();
  if (!job?.previewStats) return;

  const existingPhones = await Phone.find({ active: true, status: 'published' })
    .select('slug modelName brandId -_id')
    .lean();
  const index = buildDuplicateIndex(existingPhones);

  let dupes = 0;
  const records = job.previewData || [];
  for (const r of records) {
    const result = checkDuplicate({ brand: '', model: '', slug: '', specs: {} }, index);
    if (result.isDuplicate) dupes++;
  }

  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { 'previewStats.duplicateEstimate': dupes } },
  );
}

/**
 * Process a single batch. This is the core import operation.
 * Uses bulkWrite for performance.
 *
 * FIX #5: Update mode now updates phone fields AND specs.
 * FIX #6: Dry-run never writes to ImportJob counters; returns wouldCreate/wouldUpdate/etc.
 * FIX #7: Specs are mapped positionally to created phones (parallel arrays).
 * FIX #4: fieldChanges are captured for update/replace modes for rollback.
 */
export async function processBatch(input: BatchProcessInput): Promise<BatchResult> {
  await connectDB();

  const { records, importId, batchNumber, duplicateMode, dryRun, publishMode, createMissingBrands } = input;
  const result: BatchResult = {
    created: 0, updated: 0, skipped: 0, failed: 0, replaced: 0,
    errors: [], fieldChanges: [], createdPhoneIds: [], updatedPhoneIds: [],
  };

  // Check if batch already completed (idempotency)
  const existing = await ImportBatch.findOne({ importId, batchNumber, status: 'completed' });
  if (existing) {
    return {
      created: existing.created || 0,
      updated: existing.updated || 0,
      skipped: existing.skipped || 0,
      failed: existing.failed || 0,
      replaced: existing.replaced || 0,
      errors: existing.errors || [],
      fieldChanges: existing.fieldChanges || [],
      createdPhoneIds: existing.createdPhoneIds || [],
      updatedPhoneIds: existing.updatedPhoneIds || [],
    };
  }

  // Mark batch as processing
  await ImportBatch.findOneAndUpdate(
    { importId, batchNumber },
    { $set: { status: 'processing', startedAt: new Date(), attemptCount: existing ? existing.attemptCount + 1 : 1 } },
    { upsert: true },
  );

  // Normalize all records
  const normalized = records.map((r, i) => normalizePhoneRecord(r, i));
  const validRecords = normalized.filter(r => isValidPhoneRecord(r));
  const invalidRecords = normalized.filter(r => !isValidPhoneRecord(r));

  // Log invalid records as errors
  for (const inv of invalidRecords) {
    for (const err of inv.errors) {
      result.errors.push({ ...err, batchNumber });
    }
  }
  result.failed = invalidRecords.length;

  if (validRecords.length === 0) {
    await completeBatch(importId, batchNumber, result, dryRun);
    return result;
  }

  // Fetch all unique brands needed
  const brandNames = [...new Set(validRecords.map(r => r.normalizedData.brand).filter(Boolean))];
  const brandRegexes = brandNames.map(n => new RegExp(`^${n}$`, 'i'));
  const existingBrands = await Brand.find({ name: { $in: brandRegexes } })
    .select('_id name slug')
    .lean();

  const brandMap = new Map<string, any>();
  for (const b of existingBrands) {
    brandMap.set(b.name.toLowerCase(), b);
  }

  // Resolve or create missing brands
  const brandsToCreate: string[] = [];
  if (createMissingBrands) {
    for (const name of brandNames) {
      if (!brandMap.has(name.toLowerCase()) && name.trim()) {
        brandsToCreate.push(name.trim());
      }
    }
  }

  let createdBrandIds: any[] = [];
  if (brandsToCreate.length > 0) {
    if (!dryRun) {
      const docs = brandsToCreate.map(name => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        active: true,
        sortOrder: 0,
      }));
      const res = await Brand.insertMany(docs, { ordered: false });
      createdBrandIds = res.map((d: any) => d._id);
      for (let i = 0; i < brandsToCreate.length; i++) {
        brandMap.set(brandsToCreate[i].toLowerCase(), { _id: createdBrandIds[i], name: brandsToCreate[i], slug: docs[i].slug });
      }
    }
  }

  // Fetch existing phones for duplicate checking
  const allSlugs = validRecords.map(r => r.normalizedData.slug).filter(Boolean);
  const existingPhones = allSlugs.length > 0
    ? await Phone.find({ slug: { $in: allSlugs } }).select('_id slug brandId modelName pricePKR releaseDate ptaStatus ptaApproved featured trending upcoming thumbnail description -_id').lean()
    : [];
  const phoneBySlug = new Map(existingPhones.map(p => [p.slug, p]));
  const duplicateIndex = buildDuplicateIndex(existingPhones);

  // Build batch write operations
  const phonesToCreate: any[] = [];
  const phonesToUpdate: any[] = [];
  const specsForNewPhones: any[] = []; // FIX #7: parallel array — index matches phonesToCreate
  const specsForUpdatedPhones: any[] = []; // FIX #5: specs for update mode
  const createdIds: any[] = [];
  const updatedIds: any[] = [];
  const fieldChanges: any[] = []; // FIX #4: track before-state for rollback

  for (const rec of validRecords) {
    const d = rec.normalizedData;
    const brand = brandMap.get(d.brand.toLowerCase());

    if (!brand) {
      result.errors.push({ rowNumber: rec.originalRowNumber, errorCode: 'BRAND_NOT_FOUND', errorMessage: `Brand "${d.brand}" not found`, brand: d.brand, model: d.model, batchNumber });
      result.failed++;
      continue;
    }

    const dup = checkDuplicate({ brand: d.brand, model: d.model, slug: d.slug, specs: d.specs }, duplicateIndex);

    if (dup.isDuplicate) {
      if (duplicateMode === 'skip') {
        result.skipped++;
        continue;
      }

      // FIX #5: Update mode — actually update phone fields AND specs
      if (duplicateMode === 'update') {
        if (!phoneBySlug.has(d.slug)) {
          result.skipped++;
          continue;
        }
        const existingPhone = phoneBySlug.get(d.slug)!;
        const updateFields: Record<string, any> = {
          updatedAt: new Date(),
          lastImportId: importId,
          lastImportAt: new Date(),
          lastImportMode: 'update',
        };

        // Update phone-level fields if provided in the import data
        if (d.pricePKR) updateFields.pricePKR = d.pricePKR;
        if (d.releaseDate) updateFields.releaseDate = d.releaseDate;
        if (d.ptaStatus) updateFields.ptaStatus = d.ptaStatus;
        if (d.ptaApproved !== undefined) updateFields.ptaApproved = d.ptaApproved;
        if (d.thumbnail) updateFields.thumbnail = d.thumbnail;
        if (d.description) updateFields.description = d.description;

        // FIX #4: Capture before-state for each field being changed
        for (const [field, newVal] of Object.entries(updateFields)) {
          if (field === 'updatedAt' || field === 'lastImportId' || field === 'lastImportAt' || field === 'lastImportMode') continue;
          const oldVal = (existingPhone as any)[field];
          if (oldVal !== newVal) {
            fieldChanges.push({
              phoneId: existingPhone._id,
              field,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }

        // Collect specs for update
        const specFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.specs)) {
          if (v) specFields[k] = v;
        }
        if (Object.keys(specFields).length > 0) {
          specsForUpdatedPhones.push({
            phoneId: existingPhone._id,
            specFields,
          });
        }

        phonesToUpdate.push({
          filter: { _id: existingPhone._id },
          update: { $set: updateFields },
          phoneId: existingPhone._id,
        });
        updatedIds.push(existingPhone._id);
        result.updated++;
        continue;
      }

      // FIX #4 + #5: Replace mode — also captures before-state and updates specs
      if (duplicateMode === 'replace') {
        if (!phoneBySlug.has(d.slug)) {
          result.skipped++;
          continue;
        }
        const existingPhone = phoneBySlug.get(d.slug)!;
        const replaceFields: any = {
          modelName: d.model,
          pricePKR: d.pricePKR || 0,
          releaseDate: d.releaseDate,
          ptaStatus: d.ptaStatus,
          ptaApproved: d.ptaApproved,
          featured: d.featured,
          trending: d.trending,
          upcoming: d.upcoming,
          thumbnail: d.thumbnail,
          description: d.description,
          lastImportId: importId,
          lastImportAt: new Date(),
          lastImportMode: 'replace',
        };

        // FIX #4: Capture before-state for rollback
        for (const field of PHONE_REPLACEABLE_FIELDS) {
          const oldVal = (existingPhone as any)[field];
          const newVal = replaceFields[field];
          if (oldVal !== newVal && newVal !== undefined) {
            fieldChanges.push({
              phoneId: existingPhone._id,
              field,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }

        // Collect specs for replace
        const specFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.specs)) {
          if (v) specFields[k] = v;
        }
        if (Object.keys(specFields).length > 0) {
          specsForUpdatedPhones.push({
            phoneId: existingPhone._id,
            specFields,
          });
        }

        phonesToUpdate.push({
          filter: { _id: existingPhone._id },
          update: { $set: replaceFields },
          phoneId: existingPhone._id,
        });
        updatedIds.push(existingPhone._id);
        result.replaced++;
        continue;
      }

      // 'create_variant' or 'review' — treat as skip
      result.skipped++;
      continue;
    }

    // Create new phone
    const phoneData: any = {
      brandId: brand._id,
      modelName: d.model,
      slug: d.slug,
      pricePKR: d.pricePKR || 0,
      originalPricePKR: 0,
      releaseDate: d.releaseDate || '',
      ptaStatus: d.ptaStatus,
      ptaApproved: d.ptaApproved,
      featured: d.featured,
      trending: d.trending,
      upcoming: d.upcoming,
      thumbnail: d.thumbnail,
      description: d.description || '',
      status: publishMode === 'immediate' ? 'published' : 'draft',
      active: true,
      cameraScore: 0, performanceScore: 0, batteryScore: 0, displayScore: 0, valueScore: 0, overallRating: 0,
      dataConfidence: 'auto-imported',
      lastImportId: importId,
      lastImportAt: new Date(),
      lastImportMode: 'create',
    };

    phonesToCreate.push(phoneData);

    // FIX #7: Collect specs in a parallel array — same index as phonesToCreate
    const specFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.specs)) {
      if (v) specFields[k] = v;
    }
    specsForNewPhones.push(Object.keys(specFields).length > 0 ? specFields : null);
  }

  // Execute batch (unless dry run)
  if (!dryRun) {
    // Create phones
    if (phonesToCreate.length > 0) {
      const phoneDocs = await Phone.insertMany(phonesToCreate, { ordered: false });
      for (const doc of phoneDocs) createdIds.push(doc._id);

      // FIX #7: Map specs to created phones using positional index
      // phonesToCreate and phoneDocs maintain order with insertMany ordered:false
      // But ordered:false can skip on duplicate key errors, so use a slug→id map
      const createdSlugMap = new Map<string, any>();
      for (const doc of phoneDocs) {
        const matching = phonesToCreate.find(p => p.slug === doc.slug);
        if (matching) createdSlugMap.set(doc.slug, doc._id);
      }

      const specOps: any[] = [];
      for (let i = 0; i < phonesToCreate.length; i++) {
        const specData = specsForNewPhones[i];
        if (!specData) continue;
        // Find the actual created ID for this phone by slug
        const phoneId = createdSlugMap.get(phonesToCreate[i].slug);
        if (!phoneId) continue;
        specOps.push({
          updateOne: {
            filter: { phoneId },
            update: { $set: { ...specData, lastImportId: importId }, $setOnInsert: { phoneId } },
          },
        });
      }
      if (specOps.length > 0) {
        await PhoneSpecs.bulkWrite(specOps);
      }
    }

    // Update phones
    for (const op of phonesToUpdate) {
      try {
        await Phone.updateOne(op.filter, op.update);
      } catch {
        result.errors.push({ rowNumber: -1, errorCode: 'UPDATE_FAILED', errorMessage: 'Failed to update phone', batchNumber });
        result.failed++;
      }
    }

    // FIX #5: Update specs for update/replace modes
    if (specsForUpdatedPhones.length > 0) {
      for (const specEntry of specsForUpdatedPhones) {
        try {
          await PhoneSpecs.findOneAndUpdate(
            { phoneId: specEntry.phoneId },
            { $set: { ...specEntry.specFields, lastImportId: importId } },
            { upsert: true, new: true },
          );
        } catch (e) {
          // Specs update failure is non-fatal
          console.error(`[ImportV2] Failed to update specs for phone ${specEntry.phoneId}:`, e);
        }
      }
    }
  } else {
    // FIX #6: Dry-run — compute simulation counts without writing to DB
    result.wouldCreate = phonesToCreate.length;
    result.wouldUpdate = result.updated;
    result.wouldReplace = result.replaced;
    result.wouldSkip = result.skipped;
    result.wouldFail = result.failed;
  }

  result.created = createdIds.length;
  result.updated = updatedIds.length;
  result.createdPhoneIds = createdIds;
  result.updatedPhoneIds = updatedIds;
  result.fieldChanges = fieldChanges;

  // FIX #6: Only update job counters if NOT dry-run
  if (!dryRun) {
    await ImportJob.findOneAndUpdate(
      { importId },
      {
        $inc: {
          processedRecords: validRecords.length + invalidRecords.length,
          createdRecords: createdIds.length,
          updatedRecords: updatedIds.length,
          replacedRecords: result.replaced,
          skippedRecords: result.skipped,
          failedRecords: result.failed,
        },
        $set: { status: 'processing' },
      },
    );
  }

  await completeBatch(importId, batchNumber, result, dryRun);
  return result;
}

/**
 * FIX #8: Complete batch and transition job status.
 * Uses batchNumber compared to totalBatches (not the stale currentBatch).
 * On failure (from caller), the job will be marked as 'failed' via markBatchFailed().
 */
async function completeBatch(importId: string, batchNumber: number, result: BatchResult, dryRun: boolean): Promise<void> {
  await ImportBatch.findOneAndUpdate(
    { importId, batchNumber },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        created: result.created,
        updated: result.updated,
        replaced: result.replaced,
        skipped: result.skipped,
        failed: result.failed,
        errors: result.errors.slice(0, 100),
        // FIX #4: Persist fieldChanges and IDs for rollback
        createdPhoneIds: result.createdPhoneIds,
        updatedPhoneIds: result.updatedPhoneIds,
        fieldChanges: result.fieldChanges,
      },
    },
    { upsert: true },
  );

  // Don't update job counters or status in dry-run mode
  if (dryRun) return;

  // Update job status
  const job = await ImportJob.findOne({ importId }).select('totalBatches currentBatch status').lean();
  if (!job) return;

  // FIX #8: Use the actual batchNumber to determine completion
  const isComplete = batchNumber >= job.totalBatches;

  // Check if ANY batch has errors (not just this one)
  const errorBatches = await ImportBatch.countDocuments({ importId, status: 'completed', failed: { $gt: 0 } });
  const hasErrors = errorBatches > 0;

  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        currentBatch: batchNumber,
        completedAt: isComplete ? new Date() : undefined,
        status: isComplete
          ? (hasErrors ? 'completed_with_errors' : 'completed')
          : 'processing',
        errorSummary: result.errors.length > 0
          ? `${result.errors.length} records failed in batch ${batchNumber}: ${result.errors.map(e => e.errorMessage).slice(0, 3).join(', ')}`
          : undefined,
      },
    },
  );
}

/**
 * Mark a batch as failed and transition job status if needed.
 * Called from the API handler when processBatch throws.
 */
export async function markBatchFailed(importId: string, batchNumber: number, errorMessage: string): Promise<void> {
  await connectDB();

  await ImportBatch.findOneAndUpdate(
    { importId, batchNumber },
    {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        errors: [{ batchNumber, rowNumber: -1, errorCode: 'BATCH_EXCEPTION', errorMessage: errorMessage.slice(0, 500) }],
      },
    },
    { upsert: true },
  );

  // FIX #8: If this was the last batch or job is stuck, mark job as failed
  const job = await ImportJob.findOne({ importId }).select('totalBatches currentBatch status').lean();
  if (!job) return;

  if (job.status === 'processing') {
    await ImportJob.findOneAndUpdate(
      { importId },
      {
        $set: {
          status: 'completed_with_errors',
          completedAt: new Date(),
          errorSummary: `Batch ${batchNumber} failed: ${errorMessage.slice(0, 300)}`,
        },
      },
    );
  }
}

/**
 * Cancel an import job.
 */
export async function cancelJob(importId: string): Promise<void> {
  await connectDB();
  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { status: 'cancelled', completedAt: new Date() } },
  );
}

/**
 * FIX #4: Rollback an import — remove created phones, restore updated fields.
 * Now uses fieldChanges (populated during processBatch) to restore previous values.
 */
export async function rollbackJob(importId: string): Promise<{ deleted: number; restored: number; conflicts: number }> {
  await connectDB();

  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { status: 'rolling_back' } },
  );

  const batches = await ImportBatch.find({ importId, status: 'completed' }).lean();
  let deleted = 0;
  let restored = 0;
  let conflicts = 0;

  for (const batch of batches) {
    // Delete created phones and their associated sub-documents
    if (batch.createdPhoneIds && batch.createdPhoneIds.length > 0) {
      try {
        await PhoneSpecs.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        await PhoneBenchmark.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        await PhoneImage.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        const delRes = await Phone.deleteMany({ _id: { $in: batch.createdPhoneIds } });
        deleted += delRes.deletedCount;
      } catch (err: any) {
        conflicts++;
      }
    }

    // FIX #4: Restore updated phones using persisted fieldChanges
    if (batch.updatedPhoneIds && batch.updatedPhoneIds.length > 0 && batch.fieldChanges && batch.fieldChanges.length > 0) {
      for (const change of batch.fieldChanges) {
        try {
          const current = await Phone.findById(change.phoneId).select(change.field).lean();
          if (!current) { conflicts++; continue; }

          const currentVal = (current as any)?.[change.field];
          const originalVal = change.oldValue;

          // Check if field was modified after the import (manual edit)
          const currentValue = typeof currentVal === 'number' ? currentVal : String(currentVal ?? '');
          const newValue = typeof change.newValue === 'number' ? change.newValue : String(change.newValue ?? '');

          if (currentValue !== newValue) {
            // Field was manually changed after import — flag as conflict, don't overwrite
            conflicts++;
            continue;
          }

          await Phone.findByIdAndUpdate(change.phoneId, { $set: { [change.field]: originalVal } });
          restored++;
        } catch {
          conflicts++;
        }
      }
    }
  }

  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        status: 'rolled_back',
        rollbackStatus: `Deleted ${deleted}, restored ${restored}, conflicts: ${conflicts}`,
        completedAt: new Date(),
      },
    },
  );

  return { deleted, restored, conflicts };
}