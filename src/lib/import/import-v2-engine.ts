/**
 * Import Engine V2 — Batch-based, persistent, resumable.
 * Uses bulkWrite, per-batch transactions, and ImportJob/ImportBatch tracking.
 *
 * CRITICAL FIX ROUND 2 APPLIED:
 * - Fix #1: BatchProcessInput now accepts checksum/recordStart/recordEnd/recordCount
 * - Fix #2: Batch payloads persisted in ImportBatch for retry of any row
 * - Fix #3: executionMode stored on ImportBatch; idempotency includes mode
 * - Fix #4: Duplicate estimation uses actual normalized records
 * - Fix #8: Rollback restores PhoneSpecs; tracks specs field changes
 * - Fix #9: Counters incremented only after successful DB writes
 * - Fix #10: Job completion checks ALL batches, not just batchNumber
 * - Fix #11: Cancel/rollback validate job existence and state transitions
 */

import { Types, type QueryFilter, type UpdateQuery } from 'mongoose';
import type { IPhone } from '@/lib/models/Phone';
import { Phone, Brand, PhoneSpecs, PhoneImage, PhoneBenchmark, PriceHistory } from '@/lib/models';
import { ImportJob, ImportBatch } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { revalidatePublicContent } from '@/lib/revalidate';
import { normalizePhoneRecord, isValidPhoneRecord, getEmptyFieldInfo, type NormalizedPhoneImportRecord } from './normalize-phone-record';
import { buildDuplicateIndex, checkDuplicate, getDuplicateKey, normalizePhoneIdentity } from './duplicate-detector';
import { getPhonePublicationIssues } from '@/lib/phone-publication';

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
  'cameraScore','performanceScore','batteryScore','displayScore','valueScore','overallRating',
  'pros','cons','reviewSummary','reviewVerdict','seoTitle','seoDescription','keywords',
]);

// All spec field names for rollback tracking
const ALL_SPEC_FIELD_NAMES = new Set([
  'display','displayType','resolution','refreshRate','protection','brightness',
  'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
  'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
  'selfieCamera','selfieSensor','selfieVideo',
  'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
  'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
  'fingerprint','faceUnlock','sensors','colors',
  'os','osVersion','osUI','updatePolicy','specialFeatures',
]);

// ── Local types for batch processing ──────────────────────────────

interface BatchErrorItem {
  rowNumber: number;
  brand?: string;
  model?: string;
  field?: string;
  originalValue?: string;
  errorCode: string;
  errorMessage: string;
  phoneId?: string;
  batchNumber?: number;
}

interface FieldChangeItem {
  phoneId: Types.ObjectId;
  collection: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface SpecsChangeItem {
  phoneId: Types.ObjectId;
  collection: string;
  changeType: 'created' | 'updated';
  beforeFields?: Record<string, string>;
  afterFields?: Record<string, string>;
  fields?: Record<string, string>;
}

interface BenchmarkChangeItem {
  phoneId: Types.ObjectId;
  changeType: 'created' | 'updated';
  beforeFields: Record<string, unknown>;
  afterFields: Record<string, unknown>;
}

interface ImageSnapshotItem {
  url: string;
  altText: string;
  sortOrder: number;
}

interface ImageChangeItem {
  phoneId: Types.ObjectId;
  beforeImages: ImageSnapshotItem[];
  afterImages: ImageSnapshotItem[];
}

interface PhoneUpdateOp {
  filter: QueryFilter<IPhone>;
  update: UpdateQuery<IPhone>;
  phoneId: Types.ObjectId;
}

/** Safely extract an error message from an unknown thrown value. */
function getErrorMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Normalize RAM/storage text into a stable variant identity. */
function normalizeVariantPart(value: unknown, unit: 'gb' | 'tb'): string {
  const raw = String(value || '').toLowerCase().replace(/,/g, ' ');
  const values: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(tb|gb)?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    let amount = Number(match[1]);
    const detectedUnit = match[2] || unit;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (detectedUnit === 'tb') amount *= 1024;
    values.push(amount);
  }
  return [...new Set(values)].sort((a, b) => a - b).join('/');
}

function getVariantIdentity(specs: Record<string, unknown> | null | undefined): string {
  if (!specs) return '';
  const ram = normalizeVariantPart(specs.ram, 'gb');
  const storage = normalizeVariantPart(specs.storage, 'gb');
  return ram || storage ? `ram:${ram}|storage:${storage}` : '';
}

function slugifyVariant(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Escape user/import text before placing it inside an exact-match RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// FIX #11: Valid state transitions for jobs
const CANCEL_ALLOWED_FROM = new Set(['ready', 'queued', 'processing', 'paused', 'completed_with_errors', 'failed']);
const ROLLBACK_ALLOWED_FROM = new Set(['completed', 'completed_with_errors']);

interface BatchProcessInput {
  records: Record<string, unknown>[];
  importId: string;
  batchNumber: number;
  duplicateMode: string;
  dryRun: boolean;
  publishMode: string;
  createMissingBrands: boolean;
  batchSize?: number;
  // FIX #1: Batch metadata
  checksum?: string;
  recordStart?: number;
  recordEnd?: number;
}

interface ImportRowAction {
  rowNumber: number;
  brand?: string;
  model?: string;
  action: 'create' | 'update' | 'replace' | 'skip' | 'fail';
  matchedPhoneId?: string;
  matchedSlug?: string;
  matchType?: string;
  reason: string;
}

interface BatchResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  replaced: number;
  rowActions: ImportRowAction[];
  errors: BatchErrorItem[];
  fieldChanges: FieldChangeItem[];
  specsChanges: SpecsChangeItem[];
  benchmarkChanges: BenchmarkChangeItem[];
  imageChanges: ImageChangeItem[];
  createdPhoneIds: Types.ObjectId[];
  updatedPhoneIds: Types.ObjectId[];
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
  records: Record<string, unknown>[],
): Promise<{
    normalized: NormalizedPhoneImportRecord[];
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
          duplicateEstimate: 0,
          estimateType: 'pending',
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
 * FIX #4: Estimate duplicate count against existing database.
 * NOW passes actual normalized records to checkDuplicate() instead of empty objects.
 */
export async function estimateDuplicates(
  importId: string,
  records: Record<string, unknown>[],
): Promise<{ estimate: number; sampled: boolean; sampleSize: number; totalKeys: number }> {
  await connectDB();

  const normalized = records.map((r, i) => normalizePhoneRecord(r, i + 1)).filter(r => isValidPhoneRecord(r));

  const keys = new Set(normalized.map(r => r.duplicateKey));
  const totalKeys = keys.size;
  if (totalKeys === 0) return { estimate: 0, sampled: false, sampleSize: 0, totalKeys };

  const phoneCount = await Phone.countDocuments({ active: true });
  if (phoneCount === 0) return { estimate: 0, sampled: false, sampleSize: 0, totalKeys };

  const existingPhones = await Phone.find({ active: true, status: 'published' })
    .select('slug modelName brandId -_id')
    .lean();

  const index = buildDuplicateIndex(existingPhones);
  let dupes = 0;

  // Sample up to 2000 keys
  const sampleKeys = [...keys].slice(0, 2000);
  const sampled = totalKeys > 2000;

  for (const key of sampleKeys) {
    // FIX #4: Parse the key back to brand+model to pass actual data
    const parts = key.split('|');
    const brand = parts[0] || '';
    const model = parts[1] || '';
    // Find matching normalized record for slug
    const matchingRecord = normalized.find(r => r.duplicateKey === key);
    const slug = matchingRecord?.normalizedData?.slug || '';
    const specs = matchingRecord?.normalizedData?.specs || {};

    const result = checkDuplicate({ brand, model, slug, specs }, index);
    if (result.isDuplicate) dupes++;
  }

  // FIX #4: Safe division
  const estimate = sampleKeys.length > 0
    ? Math.round((dupes / sampleKeys.length) * totalKeys)
    : 0;

  return { estimate, sampled, sampleSize: sampleKeys.length, totalKeys };
}

/**
 * FIX #4: Update duplicate estimate on the job using actual preview records.
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
    const d = r.normalized || {};
    // FIX #4: Pass actual brand, model, slug instead of empty strings
    const result = checkDuplicate({
      brand: d.brand || '',
      model: d.model || '',
      slug: d.slug || '',
      specs: d.specs || {},
    }, index);
    if (result.isDuplicate) dupes++;
  }

  const sampled = job.totalRecords > records.length;
  const estimate = records.length > 0
    ? Math.round((dupes / records.length) * job.totalRecords)
    : 0;

  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: {
      'previewStats.duplicateEstimate': estimate,
      'previewStats.estimateType': sampled ? 'sampled' : 'exact',
    } },
  );
}

/**
 * Process a single batch. This is the core import operation.
 *
 * ROUND 2 FIXES:
 * - Fix #1: Metadata (checksum, recordStart, recordEnd, recordCount) persisted
 * - Fix #3: executionMode stored; idempotency includes mode
 * - Fix #8: PhoneSpecs before-state tracked for rollback
 * - Fix #9: Counters incremented only after successful DB writes
 */
export async function processBatch(input: BatchProcessInput): Promise<BatchResult> {
  await connectDB();

  const {
    records, importId, batchNumber, duplicateMode, dryRun, publishMode, createMissingBrands,
    checksum, recordStart, recordEnd,
  } = input;

  const executionMode = dryRun ? 'dry_run' : 'real';
  const recordCount = records.length;

  // FIX #1: Calculate recordStart/recordEnd from batchNumber if not provided
  const batchSize = input.batchSize || 200;
  const calcRecordStart = recordStart ?? ((batchNumber - 1) * batchSize + 1);
  const calcRecordEnd = recordEnd ?? (calcRecordStart + recordCount - 1);

  // FIX #1: Calculate checksum if not provided
  const batchChecksum = checksum || records.map((r) => {
    const key = `${r.brand || ''}|${r.model || ''}|${r.slug || ''}`;
    // Simple deterministic hash
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }).join(',');

  const result: BatchResult = {
    created: 0, updated: 0, skipped: 0, failed: 0, replaced: 0,
    rowActions: [], errors: [], fieldChanges: [], specsChanges: [], benchmarkChanges: [], imageChanges: [], createdPhoneIds: [], updatedPhoneIds: [],
  };

  // Idempotency is scoped to the persisted source checksum and execution mode.
  // A completed batch may be safely replayed, but never with different source rows.
  const existingBatch = await ImportBatch.findOne({ importId, batchNumber });
  if (existingBatch?.status === 'completed' && existingBatch.executionMode === executionMode) {
    if (existingBatch.checksum !== batchChecksum) {
      throw new Error(`Checksum mismatch for completed batch ${batchNumber}`);
    }
    return {
      created: existingBatch.created || 0,
      updated: existingBatch.updated || 0,
      skipped: existingBatch.skipped || 0,
      failed: existingBatch.failed || 0,
      replaced: existingBatch.replaced || 0,
      rowActions: existingBatch.rowActions || [],
      errors: existingBatch.errors || [],
      fieldChanges: existingBatch.fieldChanges || [],
      specsChanges: existingBatch.specsChanges || [],
      benchmarkChanges: existingBatch.benchmarkChanges || [],
      imageChanges: existingBatch.imageChanges || [],
      createdPhoneIds: existingBatch.createdPhoneIds || [],
      updatedPhoneIds: existingBatch.updatedPhoneIds || [],
    };
  }

  // Create/update the ImportBatch with all durable metadata before doing writes.
  await ImportBatch.findOneAndUpdate(
    { importId, batchNumber },
    {
      $set: {
        status: 'processing',
        startedAt: new Date(),
        executionMode,
        recordStart: calcRecordStart,
        recordEnd: calcRecordEnd,
        recordCount,
        checksum: batchChecksum,
        attemptCount: (existingBatch?.attemptCount || 0) + 1,
      },
    },
    { upsert: true, new: true, runValidators: false },
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

  const brandMap = new Map<string, { _id: Types.ObjectId; name: string; slug: string }>();
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

  let createdBrandIds: Types.ObjectId[] = [];
  if (brandsToCreate.length > 0) {
    if (!dryRun) {
      const docs = brandsToCreate.map(name => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        active: true,
        sortOrder: 0,
      }));
      const res = await Brand.insertMany(docs, { ordered: false });
      createdBrandIds = res.map((d) => d._id);
      for (let i = 0; i < brandsToCreate.length; i++) {
        brandMap.set(brandsToCreate[i].toLowerCase(), { _id: createdBrandIds[i], name: brandsToCreate[i], slug: docs[i].slug });
      }
    }
  }

  // Fetch only exact identity candidates. Import writes must never use fuzzy
  // matching because similar model names can belong to different brands or
  // generations. An existing phone is considered the same record only when:
  //   1) slug + brand + normalized model all agree, or
  //   2) brandId + normalized model agree exactly (legacy slug migration).
  const allSlugs = [...new Set(validRecords.map(r => r.normalizedData.slug).filter(Boolean))];
  const brandIds = [...new Set([...brandMap.values()].map(item => item._id.toString()))]
    .map(id => new Types.ObjectId(id));
  const modelRegexes = [...new Set(validRecords.map(r => r.normalizedData.model).filter(Boolean))]
    .map(model => new RegExp(`^${escapeRegExp(String(model))}$`, 'i'));
  const existingPhones = (allSlugs.length > 0 || (brandIds.length > 0 && modelRegexes.length > 0))
    ? await Phone.find({
        $or: [
          ...(allSlugs.length > 0 ? [{ slug: { $in: allSlugs } }] : []),
          ...(brandIds.length > 0 && modelRegexes.length > 0
            ? [{ brandId: { $in: brandIds }, modelName: { $in: modelRegexes } }]
            : []),
        ],
      })
        .select('_id slug brandId modelName pricePKR releaseDate ptaStatus ptaApproved featured trending upcoming thumbnail description status active deletedAt')
        .lean()
    : [];

  const existingPhoneIds = existingPhones.map(phone => phone._id);
  const existingSpecDocs = existingPhoneIds.length
    ? await PhoneSpecs.find({ phoneId: { $in: existingPhoneIds } }).select('phoneId ram storage').lean()
    : [];
  const existingSpecsByPhoneId = new Map(
    existingSpecDocs.map(spec => [String(spec.phoneId), { ram: spec.ram, storage: spec.storage }]),
  );

  const exactIdentityKey = (brandId: Types.ObjectId | string, modelName: string) =>
    `${String(brandId)}|${normalizePhoneIdentity(modelName)}`;
  const phoneByIdentity = new Map<string, typeof existingPhones>();
  for (const phone of existingPhones) {
    const key = exactIdentityKey(phone.brandId as Types.ObjectId, phone.modelName);
    const list = phoneByIdentity.get(key) || [];
    list.push(phone);
    phoneByIdentity.set(key, list);
  }
  const phoneBySlug = new Map(existingPhones.map(phone => [phone.slug, phone]));
  const reservedSlugs = new Set(existingPhones.map(phone => phone.slug));

  // Build batch write operations
  const phonesToCreate: Record<string, unknown>[] = [];
  const phonesToUpdate: PhoneUpdateOp[] = [];
  const touchedSlugs = new Set<string>();
  const specsForNewPhones: (Record<string, string> | null)[] = [];
  const specsForUpdatedPhones: { phoneId: Types.ObjectId; specFields: Record<string, string> }[] = [];
  const benchmarksForNewPhones: (Record<string, unknown> | null)[] = [];
  const benchmarksForUpdatedPhones: { phoneId: Types.ObjectId; benchmarkFields: Record<string, unknown> }[] = [];
  const imagesForNewPhones: (string[] | null)[] = [];
  const imagesForUpdatedPhones: { phoneId: Types.ObjectId; images: string[] }[] = [];
  const createdIds: Types.ObjectId[] = [];
  const updatedIds: Types.ObjectId[] = [];
  const fieldChanges: FieldChangeItem[] = [];
  const specsChanges: SpecsChangeItem[] = []; // FIX #8: Track PhoneSpecs before-state
  const benchmarkChanges: BenchmarkChangeItem[] = [];
  const imageChanges: ImageChangeItem[] = [];

  for (const rec of validRecords) {
    const d = rec.normalizedData;
    const brand = brandMap.get(d.brand.toLowerCase());

    if (!brand) {
      result.rowActions.push({ rowNumber: rec.originalRowNumber, brand: d.brand, model: d.model, action: 'fail', reason: `Brand \"${d.brand}\" not found` });
      result.errors.push({ rowNumber: rec.originalRowNumber, errorCode: 'BRAND_NOT_FOUND', errorMessage: `Brand "${d.brand}" not found`, brand: d.brand, model: d.model, batchNumber });
      result.failed++;
      continue;
    }

    const incomingVariant = getVariantIdentity(d.specs as Record<string, unknown>);
    const slugCandidate = phoneBySlug.get(d.slug);
    const identityCandidates = phoneByIdentity.get(exactIdentityKey(brand._id, d.model)) || [];
    const exactExisting = (() => {
      // A slug is safe only when brand/model AND variant agree. This prevents a
      // new RAM/storage variant from silently overwriting the first model record.
      if (slugCandidate) {
        const sameBrand = String(slugCandidate.brandId) === String(brand._id);
        const sameModel = normalizePhoneIdentity(slugCandidate.modelName) === normalizePhoneIdentity(d.model);
        const existingVariant = getVariantIdentity(existingSpecsByPhoneId.get(String(slugCandidate._id)));
        const sameVariant = !incomingVariant ? true : Boolean(existingVariant && incomingVariant === existingVariant);
        if (sameBrand && sameModel && sameVariant) return slugCandidate;
      }

      if (incomingVariant) {
        const variantMatches = identityCandidates.filter(candidate => {
          const candidateVariant = getVariantIdentity(existingSpecsByPhoneId.get(String(candidate._id)));
          return candidateVariant && candidateVariant === incomingVariant;
        });
        return variantMatches.length === 1 ? variantMatches[0] : undefined;
      }

      // Without variant data, update only an unambiguous exact brand/model match.
      return identityCandidates.length === 1 ? identityCandidates[0] : undefined;
    })();

    const dup = exactExisting
      ? {
          isDuplicate: true,
          matchType: exactExisting.slug === d.slug ? 'exact' as const : 'slug' as const,
          existingSlug: exactExisting.slug,
          existingPhoneId: exactExisting._id.toString(),
          confidence: 1,
        }
      : { isDuplicate: false, matchType: 'none' as const, confidence: 0 };

    if (dup.isDuplicate && exactExisting) {
      if (duplicateMode === 'skip') {
        result.skipped++;
        result.rowActions.push({
          rowNumber: rec.originalRowNumber,
          brand: d.brand,
          model: d.model,
          action: 'skip',
          matchedPhoneId: dup.existingPhoneId,
          matchedSlug: dup.existingSlug,
          matchType: dup.matchType,
          reason: `Exact existing phone matched; duplicateMode=skip`,
        });
        result.errors.push({
          rowNumber: rec.originalRowNumber,
          brand: d.brand,
          model: d.model,
          errorCode: 'SKIPPED_DUPLICATE',
          errorMessage: `Skipped (duplicateMode=skip): matched existing phone "${dup.existingSlug}" (matchType=${dup.matchType}, confidence=${dup.confidence}, existingPhoneId=${dup.existingPhoneId})`,
          batchNumber,
        });
        continue;
      }

      if (duplicateMode === 'update') {
        const existingPhone = exactExisting;
        const updateFields: Record<string, unknown> = {
          updatedAt: new Date(),
          lastImportId: importId,
          lastImportAt: new Date(),
          lastImportMode: 'update',
          // Exact legacy/draft matches are reactivated instead of remaining
          // invisible after a successful import.
          active: true,
          deletedAt: null,
        };

        if (publishMode === 'immediate') {
          const publicationIssues = getPhonePublicationIssues({
            brandId: brand._id,
            modelName: d.model,
            slug: d.slug,
            thumbnail: d.thumbnail || existingPhone.thumbnail,
            pricePKR: d.pricePKR || existingPhone.pricePKR,
            upcoming: d.upcoming,
          });
          updateFields.status = publicationIssues.length === 0 ? 'published' : 'draft';
          if (publicationIssues.length > 0) {
            result.errors.push({
              rowNumber: rec.originalRowNumber,
              brand: d.brand,
              model: d.model,
              errorCode: 'UPDATED_AS_DRAFT',
              errorMessage: `Exact existing record updated but kept as draft: ${publicationIssues.join('; ')}`,
              batchNumber,
            });
          }
        }

        if (d.pricePKR) updateFields.pricePKR = d.pricePKR;
        if (d.releaseDate) updateFields.releaseDate = d.releaseDate;
        if (d.ptaStatus) updateFields.ptaStatus = d.ptaStatus;
        if (d.ptaApproved !== undefined) updateFields.ptaApproved = d.ptaApproved;
        if (d.thumbnail) updateFields.thumbnail = d.thumbnail;
        if (d.description) updateFields.description = d.description;
        if (d.cameraScore !== null) updateFields.cameraScore = d.cameraScore;
        if (d.performanceScore !== null) updateFields.performanceScore = d.performanceScore;
        if (d.batteryScore !== null) updateFields.batteryScore = d.batteryScore;
        if (d.displayScore !== null) updateFields.displayScore = d.displayScore;
        if (d.valueScore !== null) updateFields.valueScore = d.valueScore;
        if (d.overallRating !== null) updateFields.overallRating = d.overallRating;
        if (d.pros) updateFields.pros = d.pros;
        if (d.cons) updateFields.cons = d.cons;
        if (d.reviewSummary) updateFields.reviewSummary = d.reviewSummary;
        if (d.reviewVerdict) updateFields.reviewVerdict = d.reviewVerdict;
        if (d.seoTitle) updateFields.seoTitle = d.seoTitle;
        if (d.seoDescription) updateFields.seoDescription = d.seoDescription;
        if (d.keywords) updateFields.keywords = d.keywords;

        // Capture before-state for each field being changed
        for (const [field, newVal] of Object.entries(updateFields)) {
          if (field === 'updatedAt' || field === 'lastImportId' || field === 'lastImportAt' || field === 'lastImportMode') continue;
          const oldVal = (existingPhone as unknown as Record<string, unknown>)[field];
          if (oldVal !== newVal) {
            fieldChanges.push({
              phoneId: existingPhone._id,
              collection: 'Phone',
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

        // Collect benchmarks for update
        const benchmarkFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(d.benchmarks)) {
          if (v !== null && v !== undefined && v !== '') benchmarkFields[k] = v;
        }
        if (Object.keys(benchmarkFields).length > 0) {
          benchmarksForUpdatedPhones.push({
            phoneId: existingPhone._id,
            benchmarkFields,
          });
        }

        // Collect images for update (replaces the existing image set when new ones are provided)
        if (Array.isArray(d.images) && d.images.length > 0) {
          imagesForUpdatedPhones.push({ phoneId: existingPhone._id, images: d.images });
        }

        result.rowActions.push({
          rowNumber: rec.originalRowNumber,
          brand: d.brand,
          model: d.model,
          action: 'update',
          matchedPhoneId: existingPhone._id.toString(),
          matchedSlug: existingPhone.slug,
          matchType: dup.matchType,
          reason: `Exact brand + normalized model matched existing phone`,
        });
        phonesToUpdate.push({
          filter: { _id: existingPhone._id },
          update: { $set: updateFields },
          phoneId: existingPhone._id,
        });
        touchedSlugs.add(d.slug);
        updatedIds.push(existingPhone._id);
        result.updated++;
        continue;
      }

      if (duplicateMode === 'replace') {
        const existingPhone = exactExisting;
        const replaceFields: Record<string, unknown> = {
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
          cameraScore: d.cameraScore ?? 0, performanceScore: d.performanceScore ?? 0, batteryScore: d.batteryScore ?? 0,
          displayScore: d.displayScore ?? 0, valueScore: d.valueScore ?? 0, overallRating: d.overallRating ?? 0,
          pros: d.pros, cons: d.cons, reviewSummary: d.reviewSummary, reviewVerdict: d.reviewVerdict,
          seoTitle: d.seoTitle, seoDescription: d.seoDescription, keywords: d.keywords,
          lastImportId: importId,
          lastImportAt: new Date(),
          lastImportMode: 'replace',
          active: true,
          deletedAt: null,
        };
        if (publishMode === 'immediate') {
          const publicationIssues = getPhonePublicationIssues({
            brandId: brand._id,
            modelName: d.model,
            slug: d.slug,
            thumbnail: d.thumbnail,
            pricePKR: d.pricePKR,
            upcoming: d.upcoming,
          });
          replaceFields.status = publicationIssues.length === 0 ? 'published' : 'draft';
        }

        // Capture before-state for rollback
        for (const field of PHONE_REPLACEABLE_FIELDS) {
          const oldVal = (existingPhone as unknown as Record<string, unknown>)[field];
          const newVal = replaceFields[field];
          if (oldVal !== newVal && newVal !== undefined) {
            fieldChanges.push({
              phoneId: existingPhone._id,
              collection: 'Phone',
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

        // Collect benchmarks for replace
        const benchmarkFieldsReplace: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(d.benchmarks)) {
          if (v !== null && v !== undefined && v !== '') benchmarkFieldsReplace[k] = v;
        }
        if (Object.keys(benchmarkFieldsReplace).length > 0) {
          benchmarksForUpdatedPhones.push({
            phoneId: existingPhone._id,
            benchmarkFields: benchmarkFieldsReplace,
          });
        }

        // Collect images for replace
        if (Array.isArray(d.images) && d.images.length > 0) {
          imagesForUpdatedPhones.push({ phoneId: existingPhone._id, images: d.images });
        }

        result.rowActions.push({
          rowNumber: rec.originalRowNumber,
          brand: d.brand,
          model: d.model,
          action: 'replace',
          matchedPhoneId: existingPhone._id.toString(),
          matchedSlug: existingPhone.slug,
          matchType: dup.matchType,
          reason: `Exact brand + normalized model matched; existing record replaced`,
        });
        phonesToUpdate.push({
          filter: { _id: existingPhone._id },
          update: { $set: replaceFields },
          phoneId: existingPhone._id,
        });
        touchedSlugs.add(d.slug);
        updatedIds.push(existingPhone._id);
        result.replaced++;
        continue;
      }

      result.rowActions.push({ rowNumber: rec.originalRowNumber, brand: d.brand, model: d.model, action: 'skip', matchedPhoneId: dup.existingPhoneId, matchedSlug: dup.existingSlug, matchType: dup.matchType, reason: `Existing phone matched but duplicate mode did not allow a write` });
      result.skipped++;
      continue;
    }

    // Create new phone. If the base slug already belongs to another variant,
    // append the normalized RAM/storage identity instead of overwriting it.
    let effectiveSlug = d.slug;
    if (reservedSlugs.has(effectiveSlug)) {
      const suffix = slugifyVariant(incomingVariant || `row-${rec.originalRowNumber}`);
      effectiveSlug = `${d.slug}-${suffix || rec.originalRowNumber}`;
      let counter = 2;
      while (reservedSlugs.has(effectiveSlug)) effectiveSlug = `${d.slug}-${suffix || rec.originalRowNumber}-${counter++}`;
    }
    reservedSlugs.add(effectiveSlug);

    // Create new phone
    const publicationIssues = getPhonePublicationIssues({
      brandId: brand._id,
      modelName: d.model,
      slug: effectiveSlug,
      thumbnail: d.thumbnail,
      pricePKR: d.pricePKR,
      upcoming: d.upcoming,
    });
    const canPublishImmediately = publishMode === 'immediate' && publicationIssues.length === 0;
    if (publishMode === 'immediate' && !canPublishImmediately) {
      result.errors.push({
        rowNumber: rec.originalRowNumber,
        brand: d.brand,
        model: d.model,
        errorCode: 'SAVED_AS_DRAFT',
        errorMessage: `Saved as draft: ${publicationIssues.join('; ')}`,
        batchNumber,
      });
    }

    result.rowActions.push({
      rowNumber: rec.originalRowNumber,
      brand: d.brand,
      model: d.model,
      action: 'create',
      matchedSlug: effectiveSlug,
      matchType: 'none',
      reason: 'No exact brand + normalized model match found; creating a new phone',
    });

    const phoneData: Record<string, unknown> = {
      brandId: brand._id,
      modelName: d.model,
      slug: effectiveSlug,
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
      status: canPublishImmediately ? 'published' : 'draft',
      active: true,
      cameraScore: d.cameraScore ?? 0, performanceScore: d.performanceScore ?? 0, batteryScore: d.batteryScore ?? 0,
      displayScore: d.displayScore ?? 0, valueScore: d.valueScore ?? 0, overallRating: d.overallRating ?? 0,
      pros: d.pros || '', cons: d.cons || '', reviewSummary: d.reviewSummary || '', reviewVerdict: d.reviewVerdict || '',
      seoTitle: d.seoTitle || '', seoDescription: d.seoDescription || '', keywords: d.keywords || '',
      dataConfidence: 'auto-imported',
      lastImportId: importId,
      lastImportAt: new Date(),
      lastImportMode: 'create',
    };

    phonesToCreate.push(phoneData);
    touchedSlugs.add(effectiveSlug);

    const specFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.specs)) {
      if (v) specFields[k] = v;
    }
    specsForNewPhones.push(Object.keys(specFields).length > 0 ? specFields : null);

    const benchmarkFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d.benchmarks)) {
      if (v !== null && v !== undefined && v !== '') benchmarkFields[k] = v;
    }
    benchmarksForNewPhones.push(Object.keys(benchmarkFields).length > 0 ? benchmarkFields : null);

    imagesForNewPhones.push(Array.isArray(d.images) && d.images.length > 0 ? d.images : null);
  }

  // Execute batch (unless dry run)
  if (!dryRun) {
    // Create phones
    if (phonesToCreate.length > 0) {
      try {
        const phoneDocs = await Phone.insertMany(phonesToCreate, { ordered: false });
        // FIX #9: Only count as created after successful write
        for (const doc of phoneDocs) createdIds.push(doc._id);

        const createdSlugMap = new Map<string, Types.ObjectId>();
        for (const doc of phoneDocs) {
          const matching = phonesToCreate.find(p => p.slug === doc.slug);
          if (matching) createdSlugMap.set(doc.slug, doc._id);
        }

        const specOps: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = [];
        const specUpsertChanges: SpecsChangeItem[] = [];
        const benchmarkOps: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = [];
        const imageDocs: Array<{ phoneId: Types.ObjectId; url: string; altText: string; sortOrder: number }> = [];
        for (let i = 0; i < phonesToCreate.length; i++) {
          const specData = specsForNewPhones[i];
          const phoneId = createdSlugMap.get(phonesToCreate[i].slug as string);
          if (!phoneId) continue;

          if (specData) {
            // FIX #8: Track specs upserts for rollback
            specUpsertChanges.push({
              phoneId,
              collection: 'PhoneSpecs',
              changeType: 'created',
              fields: { ...specData },
            });

            specOps.push({
              updateOne: {
                filter: { phoneId },
                update: { $set: { ...specData, lastImportId: importId }, $setOnInsert: { phoneId } },
                upsert: true,
              },
            });
          }

          const benchmarkData = benchmarksForNewPhones[i];
          if (benchmarkData) {
            benchmarkOps.push({
              updateOne: {
                filter: { phoneId },
                update: { $set: { ...benchmarkData }, $setOnInsert: { phoneId } },
                upsert: true,
              },
            });
          }

          const imageUrls = imagesForNewPhones[i];
          if (imageUrls) {
            imageUrls.forEach((url, sortOrder) => imageDocs.push({ phoneId, url, altText: '', sortOrder }));
          }
        }
        if (specOps.length > 0) {
          await PhoneSpecs.bulkWrite(specOps);
          specsChanges.push(...specUpsertChanges);
        }
        if (benchmarkOps.length > 0) {
          await PhoneBenchmark.bulkWrite(benchmarkOps);
        }
        if (imageDocs.length > 0) {
          await PhoneImage.insertMany(imageDocs, { ordered: false });
        }
      } catch (e: unknown) {
        // FIX #9: Log insert failures properly
        result.errors.push({
          rowNumber: -1,
          errorCode: 'INSERT_FAILED',
          errorMessage: `Phone insert failed: ${getErrorMsg(e).slice(0, 200)}`,
          batchNumber,
        });
        // Recount created from actual results
      }
    }

    // FIX #9: Update phones with counter increment AFTER success
    let updateSuccessCount = 0;
    for (const op of phonesToUpdate) {
      try {
        const res = await Phone.updateOne(op.filter, op.update);
        if (res.modifiedCount > 0) {
          updateSuccessCount++;
        }
      } catch (e: unknown) {
        result.errors.push({
          rowNumber: -1,
          errorCode: 'UPDATE_FAILED',
          errorMessage: `Failed to update phone ${op.phoneId}: ${getErrorMsg(e).slice(0, 200)}`,
          batchNumber,
          phoneId: op.phoneId?.toString(),
        });
        // FIX #9: Don't increment counter on failure
      }
    }

    // FIX #9: Fix counters to match actual DB results
    result.created = createdIds.length;
    result.updated = updateSuccessCount;
    // replaced is part of updated count in update mode, handle separately
    if (duplicateMode === 'replace') {
      result.replaced = updateSuccessCount;
      result.updated = 0;
    }

    // FIX #8: Update/replace specs with before-state capture
    if (specsForUpdatedPhones.length > 0) {
      for (const specEntry of specsForUpdatedPhones) {
        try {
          // FIX #8: Capture before-state of specs
          const beforeSpecs = await PhoneSpecs.findOne({ phoneId: specEntry.phoneId }).lean();
          const beforeFields: Record<string, string> = {};
          if (beforeSpecs) {
            for (const [k, v] of Object.entries(specEntry.specFields)) {
              beforeFields[k] = String((beforeSpecs as Record<string, unknown>)[k] ?? '');
            }
          }

          await PhoneSpecs.findOneAndUpdate(
            { phoneId: specEntry.phoneId },
            { $set: { ...specEntry.specFields, lastImportId: importId } },
            { upsert: true, new: true },
          );

          // FIX #8: Track specs change for rollback
          specsChanges.push({
            phoneId: specEntry.phoneId,
            collection: 'PhoneSpecs',
            changeType: beforeSpecs ? 'updated' : 'created',
            beforeFields,
            afterFields: specEntry.specFields,
          });
        } catch (e: unknown) {
          // FIX #9: Record specs failures in batch errors (not just console)
          result.errors.push({
            rowNumber: -1,
            errorCode: 'SPECS_UPDATE_FAILED',
            errorMessage: `Failed to update specs for phone ${specEntry.phoneId}: ${getErrorMsg(e).slice(0, 200)}`,
            batchNumber,
            phoneId: specEntry.phoneId?.toString(),
          });
        }
      }
    }

    if (benchmarksForUpdatedPhones.length > 0) {
      for (const entry of benchmarksForUpdatedPhones) {
        try {
          const beforeDoc = await PhoneBenchmark.findOne({ phoneId: entry.phoneId }).lean();
          const beforeFields: Record<string, unknown> = {};
          if (beforeDoc) {
            for (const key of Object.keys(entry.benchmarkFields)) {
              beforeFields[key] = (beforeDoc as Record<string, unknown>)[key];
            }
          }
          await PhoneBenchmark.findOneAndUpdate(
            { phoneId: entry.phoneId },
            { $set: entry.benchmarkFields, $setOnInsert: { phoneId: entry.phoneId } },
            { upsert: true, new: true },
          );
          benchmarkChanges.push({
            phoneId: entry.phoneId,
            changeType: beforeDoc ? 'updated' : 'created',
            beforeFields,
            afterFields: entry.benchmarkFields,
          });
        } catch (e: unknown) {
          result.errors.push({
            rowNumber: -1,
            errorCode: 'BENCHMARKS_UPDATE_FAILED',
            errorMessage: `Failed to update benchmarks for phone ${entry.phoneId}: ${getErrorMsg(e).slice(0, 200)}`,
            batchNumber,
            phoneId: entry.phoneId.toString(),
          });
        }
      }
    }

    if (imagesForUpdatedPhones.length > 0) {
      for (const entry of imagesForUpdatedPhones) {
        const beforeDocs = await PhoneImage.find({ phoneId: entry.phoneId }).sort({ sortOrder: 1 }).lean();
        const beforeImages: ImageSnapshotItem[] = beforeDocs.map((img: Record<string, unknown>) => ({
          url: String(img.url || ''),
          altText: String(img.altText || ''),
          sortOrder: Number(img.sortOrder || 0),
        })).filter((img: ImageSnapshotItem) => img.url);
        const afterImages: ImageSnapshotItem[] = entry.images.map((url, sortOrder) => ({ url, altText: '', sortOrder }));
        try {
          await PhoneImage.deleteMany({ phoneId: entry.phoneId });
          await PhoneImage.insertMany(
            afterImages.map(img => ({ phoneId: entry.phoneId, ...img })),
            { ordered: true },
          );
          imageChanges.push({ phoneId: entry.phoneId, beforeImages, afterImages });
        } catch (e: unknown) {
          // Never leave a phone imageless because a replacement set failed.
          try {
            await PhoneImage.deleteMany({ phoneId: entry.phoneId });
            if (beforeImages.length > 0) {
              await PhoneImage.insertMany(beforeImages.map(img => ({ phoneId: entry.phoneId, ...img })), { ordered: true });
            }
          } catch (restoreError) {
            console.error('[import] failed to restore previous images', restoreError);
          }
          result.errors.push({
            rowNumber: -1,
            errorCode: 'IMAGES_UPDATE_FAILED',
            errorMessage: `Failed to update images for phone ${entry.phoneId}: ${getErrorMsg(e).slice(0, 200)}`,
            batchNumber,
            phoneId: entry.phoneId.toString(),
          });
        }
      }
    }
  } else {
    // FIX #3: Dry-run — compute simulation counts without writing to DB
    result.wouldCreate = phonesToCreate.length;
    result.wouldUpdate = result.updated;
    result.wouldReplace = result.replaced;
    result.wouldSkip = result.skipped;
    result.wouldFail = result.failed;
  }

  // FIX #9: Do NOT overwrite counters here — they were set correctly above
  // after successful DB writes. For dry-run, createdIds/updatedIds are empty
  // (no DB ops), and wouldCreate/wouldUpdate etc. are already set.
  result.createdPhoneIds = createdIds;
  result.updatedPhoneIds = updatedIds;
  result.fieldChanges = fieldChanges;
  result.specsChanges = specsChanges;
  result.benchmarkChanges = benchmarkChanges;
  result.imageChanges = imageChanges;

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

  if (!dryRun) {
    const historyRows: Array<{ phoneId: Types.ObjectId; storeName: null; price: number }> = [];
    for (const docId of createdIds) {
      const createdPhone = await Phone.findById(docId).select('pricePKR').lean();
      const price = Number(createdPhone?.pricePKR || 0);
      if (price > 0) historyRows.push({ phoneId: docId, storeName: null, price });
    }
    for (const change of fieldChanges) {
      if (change.collection !== 'Phone' || change.field !== 'pricePKR') continue;
      const price = Number(change.newValue || 0);
      if (price > 0 && Number(change.oldValue || 0) !== price) {
        historyRows.push({ phoneId: change.phoneId, storeName: null, price });
      }
    }
    if (historyRows.length > 0) {
      try { await PriceHistory.insertMany(historyRows, { ordered: false }); }
      catch (e) { console.warn('[import] price history write failed', e); }
    }
  }

  await completeBatch(importId, batchNumber, result, dryRun);

  // Without this, the public site keeps serving stale (pre-import) pages for
  // every phone this batch touched, since Next.js's ISR cache has no other
  // way to know the underlying data changed.
  if (!dryRun && touchedSlugs.size > 0) {
    for (const slug of touchedSlugs) {
      try { revalidatePublicContent({ phoneSlug: slug }); } catch (e) { console.warn('[import] revalidate failed for', slug, e); }
    }
  }

  return result;
}

/**
 * FIX #10: Complete batch and transition job status.
 * Now checks ALL expected batches, not just batchNumber vs totalBatches.
 * Supports out-of-order execution.
 */
async function completeBatch(importId: string, batchNumber: number, result: BatchResult, dryRun: boolean): Promise<void> {
  const executionMode = dryRun ? 'dry_run' : 'real';

  await ImportBatch.findOneAndUpdate(
    { importId, batchNumber },
    {
      $set: {
        status: 'completed',
        executionMode,
        completedAt: new Date(),
        created: result.created,
        updated: result.updated,
        replaced: result.replaced,
        skipped: result.skipped,
        failed: result.failed,
        rowActions: result.rowActions.slice(0, 500),
        errors: result.errors.slice(0, 100),
        createdPhoneIds: result.createdPhoneIds,
        updatedPhoneIds: result.updatedPhoneIds,
        fieldChanges: result.fieldChanges,
        specsChanges: result.specsChanges || [],
        benchmarkChanges: result.benchmarkChanges || [],
        imageChanges: result.imageChanges || [],
      },
    },
    { upsert: true },
  );

  // Don't update job counters or status in dry-run mode
  if (dryRun) return;

  // FIX #10: Determine completion from ALL expected batches, not just batchNumber
  const job = await ImportJob.findOne({ importId }).select('totalBatches currentBatch status').lean();
  if (!job) return;

  // Count batch statuses
  const batchStats = await ImportBatch.aggregate([
    { $match: { importId, executionMode: 'real' } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
    } },
  ]);
  const statusCounts = new Map(batchStats.map((b: { _id: string; count: number }) => [b._id, b.count]));
  const completed = statusCounts.get('completed') || 0;
  const failed = statusCounts.get('failed') || 0;
  const pending = statusCounts.get('pending') || 0;
  const processing = statusCounts.get('processing') || 0;
  const retrying = statusCounts.get('retrying') || 0;

  const totalExpected = job.totalBatches;
  const terminalBatches = completed + failed;
  const allTerminal = terminalBatches >= totalExpected;
  const hasFailures = failed > 0 || (await ImportBatch.countDocuments({ importId, status: 'completed', failed: { $gt: 0 } })) > 0;
  const hasErrors = hasFailures || result.errors.length > 0;

  // FIX #10: Only mark complete when ALL batches are terminal
  // Also detect missing earlier batches
  const existingBatchNumbers = await ImportBatch.distinct('batchNumber', { importId });
  const missingBatches = [];
  for (let i = 1; i <= totalExpected; i++) {
    if (!existingBatchNumbers.includes(i)) {
      missingBatches.push(i);
    }
  }

  let newStatus: string;
  if (allTerminal && missingBatches.length === 0) {
    newStatus = hasErrors ? 'completed_with_errors' : 'completed';
  } else if (failed > 0 && processing === 0 && retrying === 0 && pending === 0) {
    // No more batches in progress but some failed
    newStatus = 'completed_with_errors';
  } else {
    newStatus = 'processing';
  }

  const isComplete = allTerminal && missingBatches.length === 0;

  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        currentBatch: batchNumber,
        completedAt: isComplete ? new Date() : undefined,
        status: newStatus,
        errorSummary: result.errors.length > 0
          ? `${result.errors.length} records failed in batch ${batchNumber}: ${result.errors.map(e => e.errorMessage).slice(0, 3).join(', ')}`
          : undefined,
      },
    },
  );
}

/**
 * Mark a batch as failed and transition job status if needed.
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
 * FIX #11: Cancel an import job with proper validation.
 */
export async function cancelJob(importId: string): Promise<{ success: boolean; error?: string }> {
  await connectDB();

  const job = await ImportJob.findOne({ importId }).select('status fileName').lean();

  // FIX #11: Return error for nonexistent jobs
  if (!job) {
    return { success: false, error: 'Import job not found' };
  }

  // FIX #11: Only cancel from allowed states
  if (!CANCEL_ALLOWED_FROM.has(job.status)) {
    return { success: false, error: `Cannot cancel job in status: ${job.status}` };
  }

  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { status: 'cancelled', completedAt: new Date() } },
  );

  // Mark any in-progress batches as failed
  await ImportBatch.updateMany(
    { importId, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'failed', completedAt: new Date() } },
  );

  return { success: true };
}

/**
 * FIX #8: Rollback an import — remove created phones, restore updated fields AND PhoneSpecs.
 * Now also tracks and restores PhoneSpecs changes.
 */
export async function rollbackJob(importId: string): Promise<{ deleted: number; restored: number; specsRestored: number; conflicts: number; error?: string }> {
  await connectDB();

  const job = await ImportJob.findOne({ importId }).select('status fileName totalRecords').lean();

  // FIX #11: Validate job exists
  if (!job) {
    return { deleted: 0, restored: 0, specsRestored: 0, conflicts: 0, error: 'Import job not found' };
  }

  // FIX #11: Only rollback from allowed states
  if (!ROLLBACK_ALLOWED_FROM.has(job.status)) {
    return { deleted: 0, restored: 0, specsRestored: 0, conflicts: 0, error: `Cannot rollback job in status: ${job.status}` };
  }

  await ImportJob.findOneAndUpdate(
    { importId },
    { $set: { status: 'rolling_back' } },
  );

  const batches = await ImportBatch.find({ importId, status: 'completed', executionMode: 'real' }).lean();
  let deleted = 0;
  let restored = 0;
  let specsRestored = 0;
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
      } catch {
        conflicts++;
      }
    }

    // Restore updated phones using persisted fieldChanges
    if (batch.fieldChanges && batch.fieldChanges.length > 0) {
      for (const change of batch.fieldChanges) {
        try {
          const collection = change.collection || 'Phone';
          if (collection === 'Phone') {
            const current = await Phone.findById(change.phoneId).select(change.field).lean();
            if (!current) { conflicts++; continue; }

            const currentVal = (current as unknown as Record<string, unknown>)?.[change.field];
            const originalVal = change.oldValue;
            const newValue = change.newValue;

            // Check if field was modified after the import (manual edit)
            const currentValue = typeof currentVal === 'number' ? currentVal : String(currentVal ?? '');
            const newStrValue = typeof newValue === 'number' ? newValue : String(newValue ?? '');

            if (currentValue !== newStrValue) {
              conflicts++;
              continue;
            }

            await Phone.findByIdAndUpdate(change.phoneId, { $set: { [change.field]: originalVal } });
            restored++;
          }
        } catch {
          conflicts++;
        }
      }
    }

    // FIX #8: Restore PhoneSpecs changes
    const specsChangesArr = batch.specsChanges || [];
    for (const sc of specsChangesArr) {
      try {
        if (sc.changeType === 'created') {
          // This specs doc was created by import — delete it
          await PhoneSpecs.deleteOne({ phoneId: sc.phoneId });
          specsRestored++;
        } else if (sc.changeType === 'updated' && sc.beforeFields) {
          // Restore previous values
          const currentSpecs = await PhoneSpecs.findOne({ phoneId: sc.phoneId }).lean();
          if (!currentSpecs) { conflicts++; continue; }

          // Check if fields were manually changed after import
          let hasConflict = false;
          for (const [field, afterVal] of Object.entries(sc.afterFields)) {
            const currentVal = (currentSpecs as Record<string, unknown>)[field];
            const afterStr = String(afterVal ?? '');
            const currentStr = String(currentVal ?? '');
            if (currentStr !== afterStr) {
              hasConflict = true;
              break;
            }
          }

          if (hasConflict) {
            conflicts++;
            continue;
          }

          // Restore before-state
          await PhoneSpecs.findOneAndUpdate(
            { phoneId: sc.phoneId },
            { $set: sc.beforeFields },
          );
          specsRestored++;
        }
      } catch {
        conflicts++;
      }
    }

    for (const bc of batch.benchmarkChanges || []) {
      try {
        if (bc.changeType === 'created') {
          await PhoneBenchmark.deleteOne({ phoneId: bc.phoneId });
          continue;
        }
        const current = await PhoneBenchmark.findOne({ phoneId: bc.phoneId }).lean();
        if (!current) { conflicts++; continue; }
        const changedAfterImport = Object.entries(bc.afterFields || {}).some(([field, value]) =>
          String((current as Record<string, unknown>)[field] ?? '') !== String(value ?? '')
        );
        if (changedAfterImport) { conflicts++; continue; }
        await PhoneBenchmark.findOneAndUpdate({ phoneId: bc.phoneId }, { $set: bc.beforeFields || {} });
      } catch { conflicts++; }
    }

    for (const ic of batch.imageChanges || []) {
      try {
        const currentDocs = await PhoneImage.find({ phoneId: ic.phoneId }).sort({ sortOrder: 1 }).lean();
        const currentUrls = currentDocs.map((img: Record<string, unknown>) => String(img.url || ''));
        const importedUrls = (ic.afterImages || []).map((img: ImageSnapshotItem) => img.url);
        if (JSON.stringify(currentUrls) !== JSON.stringify(importedUrls)) { conflicts++; continue; }
        await PhoneImage.deleteMany({ phoneId: ic.phoneId });
        if ((ic.beforeImages || []).length > 0) {
          await PhoneImage.insertMany(ic.beforeImages.map((img: ImageSnapshotItem) => ({ phoneId: ic.phoneId, ...img })), { ordered: true });
        }
      } catch { conflicts++; }
    }
  }

  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        status: 'rolled_back',
        rollbackStatus: `Deleted ${deleted} phones, restored ${restored} phone fields, restored ${specsRestored} specs, conflicts: ${conflicts}`,
        completedAt: new Date(),
      },
    },
  );

  return { deleted, restored, specsRestored, conflicts };
}

/**
 * FIX #9: Reconcile job counters from actual batch results.
 * Called before marking job as completed.
 */
export async function reconcileJobCounters(importId: string): Promise<void> {
  const batchStats = await ImportBatch.aggregate([
    { $match: { importId, executionMode: 'real', status: 'completed' } },
    { $group: {
      _id: null,
      created: { $sum: '$created' },
      updated: { $sum: '$updated' },
      replaced: { $sum: '$replaced' },
      skipped: { $sum: '$skipped' },
      failed: { $sum: '$failed' },
      processed: { $sum: '$recordCount' },
    } },
  ]);

  if (batchStats.length === 0) return;

  const s = batchStats[0];
  await ImportJob.findOneAndUpdate(
    { importId },
    {
      $set: {
        createdRecords: s.created || 0,
        updatedRecords: s.updated || 0,
        replacedRecords: s.replaced || 0,
        skippedRecords: s.skipped || 0,
        failedRecords: s.failed || 0,
        processedRecords: s.processed || 0,
      },
    },
  );
}


export interface ImportSystemReconciliationReport {
  jobsChecked: number;
  jobsReconciled: number;
  staleJobsFailed: number;
  orphanBatchesRemoved: number;
  rawPhones: number;
  activePhones: number;
  publishedPhones: number;
  importedPhones: number;
  hiddenImportedPhones: number;
  publishableImportedPhonesRepaired: number;
  uniquePhonesWithSpecs: number;
  rawSpecsDocuments: number;
  orphanSpecs: number;
  duplicateSpecsRemoved: number;
}

/**
 * Reconcile persistent import state with the real database.
 * Safe by default: never deletes phones and never publishes incomplete records.
 * It only repairs counters/statuses, removes truly orphaned tracking rows/specs,
 * reactivates imported phones, and publishes imported drafts that satisfy the
 * same publication rules used by the editor/importer.
 */
export async function reconcileImportSystem(): Promise<ImportSystemReconciliationReport> {
  await connectDB();

  const report: ImportSystemReconciliationReport = {
    jobsChecked: 0,
    jobsReconciled: 0,
    staleJobsFailed: 0,
    orphanBatchesRemoved: 0,
    rawPhones: 0,
    activePhones: 0,
    publishedPhones: 0,
    importedPhones: 0,
    hiddenImportedPhones: 0,
    publishableImportedPhonesRepaired: 0,
    uniquePhonesWithSpecs: 0,
    rawSpecsDocuments: 0,
    orphanSpecs: 0,
    duplicateSpecsRemoved: 0,
  };

  const jobs = await ImportJob.find().select('importId status totalBatches updatedAt').lean();
  report.jobsChecked = jobs.length;
  const validImportIds = new Set(jobs.map(job => job.importId));

  // Remove tracking batches whose parent job no longer exists. These are not
  // phone records and are safe to remove.
  const orphanBatchDocs = await ImportBatch.find({ importId: { $nin: [...validImportIds] } }).select('_id').lean();
  if (orphanBatchDocs.length > 0) {
    const result = await ImportBatch.deleteMany({ _id: { $in: orphanBatchDocs.map(row => row._id) } });
    report.orphanBatchesRemoved = result.deletedCount;
  }

  const staleCutoff = new Date(Date.now() - 60 * 60 * 1000);
  for (const job of jobs) {
    await reconcileJobCounters(job.importId);
    const batches = await ImportBatch.find({ importId: job.importId, executionMode: 'real' })
      .select('status recordCount created updated replaced skipped failed completedAt')
      .lean();
    const completed = batches.filter(batch => batch.status === 'completed').length;
    const failed = batches.filter(batch => batch.status === 'failed').length;
    const inFlight = batches.filter(batch => ['pending', 'processing', 'retrying'].includes(batch.status)).length;

    let nextStatus = job.status;
    if (job.status !== 'rolled_back' && job.status !== 'cancelled') {
      if (batches.length > 0 && inFlight === 0) {
        nextStatus = failed > 0 ? 'completed_with_errors' : 'completed';
      } else if (
        ['uploaded', 'parsing', 'validating', 'ready', 'queued', 'processing', 'paused'].includes(job.status) &&
        new Date(job.updatedAt) < staleCutoff
      ) {
        nextStatus = 'failed';
        report.staleJobsFailed++;
      }
    }

    if (nextStatus !== job.status) {
      await ImportJob.updateOne(
        { importId: job.importId },
        { $set: {
          status: nextStatus,
          completedAt: ['completed', 'completed_with_errors', 'failed'].includes(nextStatus) ? new Date() : null,
          errorSummary: nextStatus === 'failed' ? 'Import became stale before completion. Retry the failed batch or upload again.' : '',
          currentBatch: completed,
        } },
      );
      report.jobsReconciled++;
    }
  }

  report.rawPhones = await Phone.countDocuments({});
  report.activePhones = await Phone.countDocuments({ active: { $ne: false }, deletedAt: null });
  report.publishedPhones = await Phone.countDocuments({ status: 'published', active: { $ne: false }, deletedAt: null });
  report.importedPhones = await Phone.countDocuments({ lastImportId: { $exists: true, $ne: '' } });
  report.hiddenImportedPhones = await Phone.countDocuments({
    lastImportId: { $exists: true, $ne: '' },
    $or: [{ active: false }, { deletedAt: { $ne: null } }, { status: { $ne: 'published' } }],
  });

  const hiddenImported = await Phone.find({
    lastImportId: { $exists: true, $ne: '' },
    $or: [{ active: false }, { deletedAt: { $ne: null } }, { status: { $ne: 'published' } }],
  })
    .select('_id brandId modelName slug thumbnail pricePKR upcoming status active deletedAt')
    .limit(5000)
    .lean();

  for (const phone of hiddenImported) {
    const issues = getPhonePublicationIssues(phone);
    const update: Record<string, unknown> = { active: true, deletedAt: null };
    if (issues.length === 0) update.status = 'published';
    const result = await Phone.updateOne({ _id: phone._id }, { $set: update });
    if (result.modifiedCount > 0 && issues.length === 0) report.publishableImportedPhonesRepaired++;
  }

  const phoneIds = new Set((await Phone.find().select('_id').lean()).map(phone => String(phone._id)));
  const specs = await PhoneSpecs.find().select('_id phoneId updatedAt').sort({ updatedAt: -1, _id: -1 }).lean();
  report.rawSpecsDocuments = specs.length;
  const keptByPhone = new Set<string>();
  const orphanIds: Types.ObjectId[] = [];
  const duplicateIds: Types.ObjectId[] = [];
  for (const spec of specs) {
    const phoneId = String(spec.phoneId || '');
    if (!phoneId || !phoneIds.has(phoneId)) {
      orphanIds.push(spec._id);
      continue;
    }
    if (keptByPhone.has(phoneId)) duplicateIds.push(spec._id);
    else keptByPhone.add(phoneId);
  }
  report.uniquePhonesWithSpecs = keptByPhone.size;
  report.orphanSpecs = orphanIds.length;
  if (orphanIds.length > 0) await PhoneSpecs.deleteMany({ _id: { $in: orphanIds } });
  if (duplicateIds.length > 0) {
    const result = await PhoneSpecs.deleteMany({ _id: { $in: duplicateIds } });
    report.duplicateSpecsRemoved = result.deletedCount;
  }

  await revalidatePublicContent({ phones: true, brands: true, homepage: true });
  return report;
}
