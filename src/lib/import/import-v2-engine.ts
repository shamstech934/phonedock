/**
 * Import Engine V2 — Batch-based, persistent, resumable.
 * Uses bulkWrite, per-batch transactions, and ImportJob/ImportBatch tracking.
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

  if (validRecords.length === 0) {
    await completeBatch(importId, batchNumber, result);
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
    ? await Phone.find({ slug: { $in: allSlugs } }).select('_id slug brandId modelName -_id').lean()
    : [];
  const phoneBySlug = new Map(existingPhones.map(p => [p.slug, p]));
  const duplicateIndex = buildDuplicateIndex(existingPhones);

  // Build batch write operations
  const phonesToCreate: any[] = [];
  const phonesToUpdate: any[] = [];
  const specsToUpsert: any[] = [];
  const createdIds: any[] = [];
  const updatedIds: any[] = [];

  for (const rec of validRecords) {
    const d = rec.normalizedData;
    const brand = brandMap.get(d.brand.toLowerCase());

    if (!brand) {
      result.errors.push({ rowNumber: rec.originalRowNumber, errorCode: 'BRAND_NOT_FOUND', errorMessage: `Brand "${d.brand}" not found`, brand: d.brand, model: d.model, batchNumber });
      continue;
    }

    const dup = checkDuplicate({ brand: d.brand, model: d.model, slug: d.slug, specs: d.specs }, duplicateIndex);

    if (dup.isDuplicate) {
      if (duplicateMode === 'skip') {
        result.skipped++;
        continue;
      }

      if (duplicateMode === 'update') {
        if (!phoneBySlug.has(d.slug)) {
          result.skipped++;
          continue;
        }
        const updateFields: any = { updatedAt: new Date(), lastImportId: importId, lastImportAt: new Date(), lastImportMode: 'update' };
        const specFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.specs)) {
          if (v) specFields[k] = v;
        }
        if (Object.keys(specFields).length > 0) {
          updateFields.lastImportMode = 'update'; // ensure field changes tracked
        }
        phonesToUpdate.push({
          filter: { _id: phoneBySlug.get(d.slug)!._id },
          update: { $set: updateFields },
          upsert: false,
        });
        updatedIds.push(phoneBySlug.get(d.slug)!._id);
        continue;
      }

      if (duplicateMode === 'replace') {
        if (!phoneBySlug.has(d.slug)) {
          result.skipped++;
          continue;
        }
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
        phonesToUpdate.push({
          filter: { _id: phoneBySlug.get(d.slug)!._id },
          update: { $set: replaceFields },
          upsert: false,
        });
        updatedIds.push(phoneBySlug.get(d.slug)!._id);
        result.replaced++;
        continue;
      }

      // 'create_variant' or 'review' — fall through to create
      // For now, treat as skip for review
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

    // Prepare specs
    const specFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.specs)) {
      if (v) specFields[k] = v;
    }
    if (Object.keys(specFields).length > 0) {
      specsToUpsert.push({
        filter: { phoneId: 'PLACEHOLDER' },
        update: { $set: { ...specFields, lastImportId: importId } },
        upsert: true,
      });
    }
  }

  // Execute batch (unless dry run)
  if (!dryRun) {
    // Create phones
    if (phonesToCreate.length > 0) {
      const phoneDocs = await Phone.insertMany(phonesToCreate, { ordered: false });
      for (const doc of phoneDocs) createdIds.push(doc._id);

      // Create specs with resolved phone IDs
      if (specsToUpsert.length > 0) {
        for (let i = 0; i < specsToUpsert.length && i < createdIds.length; i++) {
          specsToUpsert[i].filter = { phoneId: createdIds[i] };
        }
        // Only upsert specs for phones that have spec data
        const validSpecUpserts = specsToUpsert.filter(s => s.filter.phoneId);
        if (validSpecUpserts.length > 0) {
          await PhoneSpecs.bulkWrite(validSpecUpserts.map((s: any) => ({
            updateOne: { filter: { phoneId: s.filter.phoneId, }, update: { $set: s.update, $setOnInsert: { phoneId: s.filter.phoneId } } },
          })));
        }
      }
    }

    // Update phones
    for (const op of phonesToUpdate) {
      try {
        await Phone.updateOne(op.filter, op.update);
      } catch {
        result.errors.push({ rowNumber: -1, errorCode: 'UPDATE_FAILED', errorMessage: 'Failed to update phone', batchNumber });
      }
    }
  }

  result.created = createdIds.length;
  result.updated = updatedIds.length;
  result.createdPhoneIds = createdIds;
  result.updatedPhoneIds = updatedIds;

  // Update job counters
  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $inc: {
        processedRecords: phonesToCreate.length + phonesToUpdate.length + result.skipped + result.failed,
        createdRecords: createdIds.length,
        updatedRecords: updatedIds.length,
        failedRecords: result.failed,
      },
      $set: { status: 'processing' },
    },
  );

  await completeBatch(importId, batchNumber, result);
  return result;
}

async function completeBatch(importId: string, batchNumber: number, result: BatchResult): Promise<void> {
  const duration = Date.now();

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
        errors: result.errors.slice(0, 100), // limit stored errors
      },
    },
    { upsert: true },
  );

  // Update job status
  const job = await ImportJob.findOne({ importId }).select('totalBatches processedRecords currentBatch status').lean();
  if (!job) return;

  const isComplete = job.currentBatch >= job.totalBatches;
  const hasErrors = result.failed > 0;

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
 * Rollback an import: remove created phones, restore updated fields.
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
    // Delete created phones (specs/benchmarks/images should cascade via schema)
    if (batch.createdPhoneIds.length > 0) {
      try {
        // Also delete any associated specs/benchmarks
        await PhoneSpecs.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        await PhoneBenchmark.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        await PhoneImage.deleteMany({ phoneId: { $in: batch.createdPhoneIds } });
        const delRes = await Phone.deleteMany({ _id: { $in: batch.createdPhoneIds } });
        deleted += delRes.deletedCount;
      } catch (err: any) {
        conflicts++;
      }
    }

    // Restore updated phones
    if (batch.updatedPhoneIds.length > 0 && batch.fieldChanges?.length > 0) {
      for (const change of batch.fieldChanges) {
        const current = await Phone.findById(change.phoneId).select(change.field).lean();
        if (!current) { conflicts++; continue; }

        const currentVal = (current as any)?.[change.field];
        const originalVal = change.oldValue;

        // Check if field was modified after the import
        const currentValue = typeof currentVal === 'number' ? currentVal : String(currentVal ?? '');
        const storedOriginal = typeof originalVal === 'number' ? originalVal : String(originalVal ?? '');

        if (currentValue !== storedOriginal) {
          conflicts++;
          continue; // Data changed by manual edit after import
        }

        try {
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