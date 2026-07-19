import { Types } from 'mongoose';
import { Phone, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice, Brand, DataQualityIssue, ScanJob, ActivityLog, PriceSource, PhoneRetailListing, ImportJob, ImportBatch } from '@/lib/models';
import { ALL_QUALITY_RULES, getRuleById } from './rules';
import { DetectedIssue, DetectionContext, FixContext, FixResult, HealthCategory, HEALTH_CATEGORIES, RuleDefinition, EntityType, Severity } from './types';

const BATCH_SIZE = 100;

// ─── Lean Document Types ──────────────────────────────────────────

interface LeanPhone {
  _id: Types.ObjectId;
  [key: string]: unknown;
}

interface LeanBrand {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo: string;
  country: string;
  description: string;
  sortOrder: number;
  active: boolean;
  website: string;
  seoTitle: string;
  seoDescription: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LeanSpecs {
  _id: Types.ObjectId;
  phoneId?: Types.ObjectId;
  [key: string]: unknown;
}

interface LeanPrice {
  _id: Types.ObjectId;
  phoneId?: Types.ObjectId;
  storeName: string;
  [key: string]: unknown;
}

interface LeanScanJob {
  scanId: string;
  type: string;
  status: string;
  importId?: string;
  rules: string[];
  currentBatch?: number;
  processed?: number;
  lastProcessedId?: string;
  dryRun?: boolean;
  entityIds?: string[];
  [key: string]: unknown;
}

interface LeanDataQualityIssue {
  _id: Types.ObjectId;
  issueKey: string;
  entityType: string;
  entityId: string;
  issueType: string;
  severity: string;
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  source: string;
  confidence: number;
  status: string;
  importId?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── SCAN ORCHESTRATOR ────────────────────────────────────────────

export async function startScan(params: {
  type: 'full' | 'incremental' | 'entity' | 'import' | 'manual';
  adminId: string;
  entityIds?: string[];
  entityType?: string;
  importId?: string;
  dryRun?: boolean;
  rules?: string[];
}): Promise<{ scanId: string }> {
  const scanId = new Types.ObjectId().toString();
  await ScanJob.create({
    scanId,
    type: params.type,
    status: 'queued',
    createdBy: new Types.ObjectId(params.adminId),
    entityType: params.entityType || '',
    entityIds: params.entityIds || [],
    importId: params.importId || '',
    dryRun: params.dryRun || false,
    rules: params.rules || [],
    batchSize: BATCH_SIZE,
  });
  return { scanId };
}

/**
 * FIX #12: Safe, resumable scan execution.
 * - Supports resuming from lastProcessedId (cursor-based)
 * - Does NOT use fire-and-forget; caller is responsible for lifecycle
 * - Updates ScanJob with progress after each batch
 * - Transitions to completed/completed_with_errors/failed
 */
export async function executeScan(scanId: string): Promise<void> {
  const job = await ScanJob.findOne({ scanId });
  if (!job) throw new Error('Scan not found');

  // FIX #12: Allow resuming a 'running' scan (in case of previous crash/timeout)
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw new Error(`Scan cannot be executed (status: ${job.status})`);
  }

  await ScanJob.updateOne({ scanId }, {
    $set: { status: 'running', startedAt: job.startedAt || new Date() },
  });

  try {
    const activeRules = job.rules.length > 0
      ? job.rules.map((rid: string) => getRuleById(rid)).filter(Boolean)
      : ALL_QUALITY_RULES;

    // FIX #9: Only load brands in context (small set). Specs/images/prices loaded per batch.
    const ctx = await buildDetectionContext(job);
    const allIssues: DetectedIssue[] = [];

    if (job.type === 'import' && job.importId) {
      await scanImportPhones(job, activeRules, ctx, allIssues);
    } else if (job.entityIds && job.entityIds.length > 0) {
      const phones = await Phone.find({ _id: { $in: job.entityIds.map((id: string) => new Types.ObjectId(id)) }, deletedAt: null }).lean();
      ctx.entities = phones;
      // Load lookups for just these phones
      await loadLookupsForPhoneIds(ctx, phones.map((p: { _id: Types.ObjectId }) => p._id.toString()));
      await runRulesOnBatch(activeRules, ctx, allIssues);
    } else if (job.type === 'incremental') {
      const lastScan = await ScanJob.findOne({ status: { $in: ['completed', 'completed_with_errors'] } }).sort({ completedAt: -1 }).lean();
      const query = lastScan?.completedAt
        ? { updatedAt: { $gt: lastScan.completedAt }, deletedAt: null }
        : { deletedAt: null };
      await scanAllPhones(job, query, activeRules, ctx, allIssues);
    } else {
      await scanAllPhones(job, { deletedAt: null }, activeRules, ctx, allIssues);
    }

    // Full/incremental scans include global relationship and price-tracker checks.
    // Entity/import scans must remain scoped and should not unexpectedly scan the entire database.
    if (job.type === 'full' || job.type === 'incremental' || job.type === 'manual') {
      await scanOrphans(allIssues);
      await scanPriceTrackerIssues(allIssues);
    }

    // Persist issues (deduplicated by issueKey)
    let created = 0;
    if (!job.dryRun) {
      created = await persistIssues(allIssues, job.importId || undefined);
    }

    // Quality findings are not scanner execution errors. Critical findings mark the
    // scan as completed_with_errors so operators can distinguish clean scans.
    const scanErrors = allIssues.filter(i => i.severity === 'critical').length;

    await ScanJob.updateOne({ scanId }, {
      $set: {
        status: scanErrors > 0 ? 'completed_with_errors' : 'completed',
        completedAt: new Date(),
        issuesFound: allIssues.length,
        issuesCreated: created,
        issuesResolved: 0,
        // Clear resume cursor on successful completion
        lastProcessedId: '',
      },
    });
  } catch (e: unknown) {
    // FIX #12: Don't clear lastProcessedId on failure — allows resume
    await ScanJob.updateOne({ scanId }, {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        errorSummary: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      },
    });
    throw e;
  }
}

// ─── CONTEXT BUILDER ──────────────────────────────────────────────
// FIX #9: Only loads brands (small set). Other lookups loaded per-phone-batch.

async function buildDetectionContext(job: LeanScanJob): Promise<DetectionContext> {
  const brands = await Brand.find({}).lean();
  const brandsMap = new Map(brands.map((b: LeanBrand) => [b._id.toString(), b]));

  return {
    entities: [],
    lookups: {
      brands: brandsMap,
      specs: new Map(),
      images: new Map(),
      prices: new Map(),
      benchmarks: new Map(),
    },
    importId: job.importId || undefined,
  };
}

/**
 * FIX #9: Load lookups (specs, images, prices, benchmarks) for a specific set of phone IDs.
 * Called per batch to avoid loading entire collections into memory.
 */
async function loadLookupsForPhoneIds(ctx: DetectionContext, phoneIds: string[]): Promise<void> {
  if (phoneIds.length === 0) return;
  const objectIds = phoneIds.map(id => new Types.ObjectId(id));

  const [specs, images, prices, benchmarks] = await Promise.all([
    PhoneSpecs.find({ phoneId: { $in: objectIds } }).lean(),
    PhoneImage.find({ phoneId: { $in: objectIds } }).sort({ sortOrder: 1 }).lean(),
    PhonePrice.find({ phoneId: { $in: objectIds } }).lean(),
    PhoneBenchmark.find({ phoneId: { $in: objectIds } }).lean(),
  ]);

  const specsMap = new Map<string, LeanSpecs>();
  for (const s of specs) {
    const key = s.phoneId?.toString();
    if (key) specsMap.set(key, s);
  }
  const imagesMap = new Map<string, Record<string, unknown>[]>();
  for (const img of images) {
    const pid = img.phoneId?.toString();
    if (pid) {
      if (!imagesMap.has(pid)) imagesMap.set(pid, []);
      imagesMap.get(pid)!.push(img);
    }
  }
  const pricesMap = new Map<string, Record<string, unknown>[]>();
  for (const pr of prices) {
    const pid = pr.phoneId?.toString();
    if (pid) {
      if (!pricesMap.has(pid)) pricesMap.set(pid, []);
      pricesMap.get(pid)!.push(pr);
    }
  }
  const benchmarksMap = new Map<string, LeanSpecs>();
  for (const b of benchmarks) {
    const key = b.phoneId?.toString();
    if (key) benchmarksMap.set(key, b);
  }

  ctx.lookups.specs = specsMap;
  ctx.lookups.images = imagesMap;
  ctx.lookups.prices = pricesMap;
  ctx.lookups.benchmarks = benchmarksMap;
}

// ─── SCAN ALL PHONES (with batch processing) ─────────────────────
// FIX #9: Uses cursor-based batch loading + per-batch lookup loading.

async function scanAllPhones(
  job: LeanScanJob,
  query: Record<string, unknown>,
  rules: RuleDefinition[],
  ctx: DetectionContext,
  allIssues: DetectedIssue[],
) {
  const total = await Phone.countDocuments(query);

  // Preserve progress when resuming a failed/running scan.
  let processed = job.processed || 0;
  let batchNum = job.currentBatch || 0;
  let lastId = job.lastProcessedId || '';

  // Process in cursor-based batches — never loads all phones at once
  let hasMore = true;
  while (hasMore) {
    const batchQuery = lastId
      ? Phone.find({ ...query, _id: { $gt: new Types.ObjectId(lastId) } })
      : Phone.find(query);

    const batch = await batchQuery
      .sort({ _id: 1 })
      .select('_id brandId modelName slug pricePKR status thumbnail releaseDate ptaStatus dataConfidence lastPriceCheckedAt')
      .lean()
      .limit(BATCH_SIZE);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const batchPhoneIds = batch.map((d: { _id: Types.ObjectId }) => d._id.toString());

    // FIX #9: Load lookups for this batch only
    await loadLookupsForPhoneIds(ctx, batchPhoneIds);

    ctx.entities = batch;
    await runRulesOnBatch(rules, ctx, allIssues);

    processed += batch.length;
    batchNum++;
    lastId = batch[batch.length - 1]._id.toString();

    // Update progress (safe to call multiple times)
    await ScanJob.updateOne({ scanId: job.scanId }, {
      $set: {
        processed,
        currentBatch: batchNum,
        total,
        lastProcessedId: lastId,
      },
    });
  }
}

// ─── IMPORT-SPECIFIC SCAN ────────────────────────────────────────

async function scanImportPhones(
  job: LeanScanJob,
  rules: RuleDefinition[],
  ctx: DetectionContext,
  allIssues: DetectedIssue[],
) {
  const importJob = await ImportJob.findOne({ importId: job.importId }).lean();
  if (!importJob) return;

  const batches = await ImportBatch.find({ importId: job.importId }).lean();
  const phoneIds = new Set<string>();
  for (const batch of batches) {
    for (const id of (batch.createdPhoneIds || [])) phoneIds.add(id.toString());
    for (const id of (batch.updatedPhoneIds || [])) phoneIds.add(id.toString());
  }

  if (phoneIds.size === 0) return;

  const phones = await Phone.find({
    _id: { $in: Array.from(phoneIds).map(id => new Types.ObjectId(id)) },
    deletedAt: null,
  }).lean();

  // FIX #9: Load lookups for just these phones
  await loadLookupsForPhoneIds(ctx, phones.map((p: { _id: Types.ObjectId }) => p._id.toString()));

  ctx.entities = phones;
  await runRulesOnBatch(rules, ctx, allIssues);

  // Check for import failures
  let totalFailed = 0;
  for (const batch of batches) {
    totalFailed += batch.errors?.length || 0;
  }
  if (totalFailed > 0) {
    allIssues.push({
      issueKey: `IMPORT_FAILED_ROWS:import:${job.importId}`,
      entityType: 'import', entityId: job.importId || '',
      issueType: 'IMPORT_FAILED_ROWS', severity: 'medium',
      field: 'errors', currentValue: totalFailed,
      suggestedValue: 'Review and retry failed rows',
      source: 'system', confidence: 1, importId: job.importId,
    });
  }

  await ScanJob.updateOne({ scanId: job.scanId }, {
    $set: { total: phones.length, processed: phones.length },
  });
}

// ─── RUN RULES ON BATCH ───────────────────────────────────────────

async function runRulesOnBatch(rules: RuleDefinition[], ctx: DetectionContext, allIssues: DetectedIssue[]) {
  for (const rule of rules) {
    try {
      const issues = await rule.detect(ctx);
      allIssues.push(...issues);
    } catch (e) {
      console.error(`[DataQuality] Rule ${rule.ruleId} failed:`, e);
    }
  }
}

// ─── ORPHAN DETECTION ────────────────────────────────────────────
// FIX #10: PhoneSpecs orphan detection now correctly fetches ALL phone IDs
//          from the Phone collection, not from the specs map keys.
// FIX #9:  Orphan detection uses batched queries, not full collection loads.

async function scanOrphans(allIssues: DetectedIssue[]) {
  // FIX #10: Build validPhoneIds from actual phones, NOT from specs keys
  const allPhoneIds = await Phone.find({ deletedAt: null }).select('_id').lean();
  const validPhoneIds = new Set(allPhoneIds.map((p: { _id: Types.ObjectId }) => p._id.toString()));

  // Orphan specs — check each PhoneSpecs document references a valid phone
  let lastSpecId: string | null = null;
  let hasMoreSpecs = true;
  while (hasMoreSpecs) {
    const specFilter: Record<string, unknown> = lastSpecId ? { _id: { $gt: new Types.ObjectId(lastSpecId) } } : {};
    const specsBatch: LeanSpecs[] = await PhoneSpecs.find(specFilter).sort({ _id: 1 }).select('phoneId').lean().limit(500);

    if (specsBatch.length === 0) {
      hasMoreSpecs = false;
      break;
    }

    for (const spec of specsBatch) {
      const pid = spec.phoneId?.toString();
      if (!pid) continue;

      if (!validPhoneIds.has(pid)) {
        allIssues.push({
          issueKey: `ORPHAN_SPECS:phone_specs:${pid}`,
          entityType: 'phone_specs', entityId: pid,
          issueType: 'ORPHAN_SPECS', severity: 'high',
          field: 'phoneId', currentValue: pid,
          suggestedValue: 'Delete orphan specs document',
          source: 'system', confidence: 1,
        });
      }
    }

    lastSpecId = specsBatch[specsBatch.length - 1]._id.toString();
  }

  // Detect duplicates globally so duplicates split across cursor batches are not missed.
  const duplicateSpecs = await PhoneSpecs.aggregate([
    { $match: { phoneId: { $ne: null } } },
    { $group: { _id: '$phoneId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  for (const duplicate of duplicateSpecs) {
    const pid = duplicate._id?.toString();
    if (!pid) continue;
    allIssues.push({
      issueKey: `SPECS_DUPLICATE:phone_specs:${pid}`,
      entityType: 'phone_specs', entityId: pid,
      issueType: 'SPECS_DUPLICATE', severity: 'high',
      field: 'phoneId', currentValue: duplicate.count,
      suggestedValue: 'Keep one, remove duplicates',
      source: 'system', confidence: 1,
    });
  }

  // Orphan images (batched)
  let lastImgId: string | null = null;
  let hasMoreImgs = true;
  while (hasMoreImgs) {
    const imgFilter: Record<string, unknown> = lastImgId ? { _id: { $gt: new Types.ObjectId(lastImgId) } } : {};
    const imgBatch: LeanSpecs[] = await PhoneImage.find(imgFilter).sort({ _id: 1 }).select('phoneId').lean().limit(1000);

    if (imgBatch.length === 0) { hasMoreImgs = false; break; }

    for (const img of imgBatch) {
      const pid = img.phoneId?.toString();
      if (pid && !validPhoneIds.has(pid)) {
        allIssues.push({
          issueKey: `ORPHAN_IMAGE:phone_image:${pid}`,
          entityType: 'phone_image', entityId: pid,
          issueType: 'ORPHAN_IMAGE', severity: 'medium',
          field: 'phoneId', currentValue: pid,
          suggestedValue: 'Delete orphan image records',
          source: 'system', confidence: 1,
        });
      }
    }
    lastImgId = imgBatch[imgBatch.length - 1]._id.toString();
  }

  // Orphan prices (batched)
  let lastPriceId: string | null = null;
  let hasMorePrices = true;
  while (hasMorePrices) {
    const priceFilter: Record<string, unknown> = lastPriceId ? { _id: { $gt: new Types.ObjectId(lastPriceId) } } : {};
    const priceBatch: LeanPrice[] = await PhonePrice.find(priceFilter).sort({ _id: 1 }).select('phoneId storeName').lean().limit(1000);

    if (priceBatch.length === 0) { hasMorePrices = false; break; }

    for (const pr of priceBatch) {
      const pid = pr.phoneId?.toString();
      if (pid && !validPhoneIds.has(pid)) {
        allIssues.push({
          issueKey: `ORPHAN_PRICE:phone_price:${pid}:${pr.storeName || ''}`,
          entityType: 'phone_price', entityId: pid,
          issueType: 'ORPHAN_PRICE', severity: 'medium',
          field: 'phoneId', currentValue: pid,
          suggestedValue: 'Delete orphan price records',
          source: 'system', confidence: 1,
        });
      }
    }
    lastPriceId = priceBatch[priceBatch.length - 1]._id.toString();
  }

  // Orphan benchmarks (batched)
  let lastBmId: string | null = null;
  let hasMoreBms = true;
  while (hasMoreBms) {
    const bmFilter: Record<string, unknown> = lastBmId ? { _id: { $gt: new Types.ObjectId(lastBmId) } } : {};
    const bmBatch: LeanSpecs[] = await PhoneBenchmark.find(bmFilter).sort({ _id: 1 }).select('phoneId').lean().limit(1000);

    if (bmBatch.length === 0) { hasMoreBms = false; break; }

    for (const bm of bmBatch) {
      const pid = bm.phoneId?.toString();
      if (pid && !validPhoneIds.has(pid)) {
        allIssues.push({
          issueKey: `ORPHAN_BENCHMARK:phone_benchmark:${pid}`,
          entityType: 'phone_benchmark', entityId: pid,
          issueType: 'ORPHAN_BENCHMARK', severity: 'medium',
          field: 'phoneId', currentValue: pid,
          suggestedValue: 'Delete orphan benchmark records',
          source: 'system', confidence: 1,
        });
      }
    }
    lastBmId = bmBatch[bmBatch.length - 1]._id.toString();
  }

  // Brand duplicates
  const brands = await Brand.find({}).lean();
  const normBrandMap = new Map<string, LeanBrand[]>();
  for (const brand of brands) {
    const norm = brand.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    if (!norm) continue;
    if (!normBrandMap.has(norm)) normBrandMap.set(norm, []);
    normBrandMap.get(norm)!.push(brand);
  }
  for (const [, entries] of normBrandMap) {
    if (entries.length > 1) {
      for (const brand of entries) {
        const id = brand._id?.toString();
        if (!id) continue;
        allIssues.push({
          issueKey: `BRAND_DUPLICATE_NORMALIZED:brand:${id}`,
          entityType: 'brand', entityId: id,
          issueType: 'BRAND_DUPLICATE_NORMALIZED', severity: 'high',
          field: 'name', currentValue: brand.name,
          suggestedValue: 'Review and merge duplicate brands',
          source: 'system', confidence: 0.7,
          metadata: { candidateIds: entries.map((b: LeanBrand) => b._id?.toString()) },
        });
      }
    }
  }

  // Brand missing logo
  for (const brand of brands) {
    const id = brand._id?.toString();
    if (!id || brand.logo) continue;
    allIssues.push({
      issueKey: `BRAND_MISSING_LOGO:brand:${id}`,
      entityType: 'brand', entityId: id,
      issueType: 'BRAND_MISSING_LOGO', severity: 'low',
      field: 'logo', currentValue: null,
      suggestedValue: 'Upload brand logo',
      source: 'system', confidence: 1,
    });
  }

  // FIX: Brand missing slug — was using wrong issueType (BRAND_DUPLICATE_NORMALIZED), now correct
  for (const brand of brands) {
    const id = brand._id?.toString();
    if (!id || brand.slug) continue;
    allIssues.push({
      issueKey: `BRAND_MISSING_SLUG:brand:${id}`,
      entityType: 'brand', entityId: id,
      issueType: 'BRAND_MISSING_SLUG',
      severity: 'medium',
      field: 'slug', currentValue: null,
      suggestedValue: 'Generate brand slug',
      source: 'system', confidence: 1,
    });
  }
}

// ─── PERSIST ISSUES (upsert by issueKey for unresolved) ───────────

async function persistIssues(issues: DetectedIssue[], importId?: string): Promise<number> {
  if (issues.length === 0) return 0;

  const bulkOps: Array<{ insertOne: { document: Record<string, unknown> } }> = [];
  const issueKeys = issues.map(i => i.issueKey);

  // Find existing unresolved issues with the same keys
  const existing = await DataQualityIssue.find({
    issueKey: { $in: issueKeys },
    status: { $in: ['open', 'ignored', 'needs_review'] },
  }).select('issueKey').lean();
  const existingKeys = new Set(existing.map((e: { issueKey: string }) => e.issueKey));

  for (const issue of issues) {
    if (existingKeys.has(issue.issueKey)) continue; // Skip duplicate

    bulkOps.push({
      insertOne: {
        document: {
          issueKey: issue.issueKey,
          entityType: issue.entityType,
          entityId: issue.entityId,
          issueType: issue.issueType,
          severity: issue.severity,
          field: issue.field,
          currentValue: issue.currentValue,
          suggestedValue: issue.suggestedValue,
          source: issue.source,
          confidence: issue.confidence,
          status: 'open',
          detectedAt: new Date(),
          importId: importId || null,
          metadata: issue.metadata || {},
        },
      },
    });
  }

  if (bulkOps.length === 0) return 0;

  try {
    const result = await DataQualityIssue.bulkWrite(bulkOps, { ordered: false });
    return result.insertedCount;
  } catch (e: unknown) {
    // Duplicate key errors are expected — some issues may have been created between check and insert
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 11000) {
      // Retry one by one to get the actual count
      let inserted = 0;
      for (const op of bulkOps) {
        try {
          await DataQualityIssue.create(op.insertOne.document);
          inserted++;
        } catch (dupErr: unknown) {
          if (typeof dupErr === 'object' && dupErr !== null && 'code' in dupErr && (dupErr as { code: number }).code !== 11000) console.error('[DataQuality] persist error:', dupErr);
        }
      }
      return inserted;
    }
    throw e;
  }
}

// ─── AUTO-FIX ENGINE ─────────────────────────────────────────────

export async function executeAutoFix(
  issueId: string,
  adminId: string,
  dryRun: boolean,
): Promise<FixResult> {
  const issue = await DataQualityIssue.findById(issueId).lean() as LeanDataQualityIssue | null;
  if (!issue) throw new Error('Issue not found');

  const rule = getRuleById(issue.issueType);
  if (!rule || !rule.canAutoFix || !rule.autoFix) {
    throw new Error('This issue type does not support auto-fix');
  }

  const fixCtx: FixContext = { adminId, dryRun };
  const detectedIssue: DetectedIssue = {
    issueKey: issue.issueKey,
    entityType: issue.entityType as EntityType,
    entityId: issue.entityId,
    issueType: issue.issueType,
    severity: issue.severity as Severity,
    field: issue.field,
    currentValue: issue.currentValue,
    suggestedValue: issue.suggestedValue,
    source: issue.source || 'system',
    confidence: issue.confidence || 0,
  };

  const result = await rule.autoFix(detectedIssue, fixCtx);

  if (!dryRun && result.success) {
    await DataQualityIssue.updateOne(
      { _id: issueId },
      {
        $set: {
          status: 'auto_fixed',
          resolvedAt: new Date(),
          resolvedBy: new Types.ObjectId(adminId),
          resolution: `Auto-fixed: ${result.changes.map((c: { field: string; oldValue: unknown; newValue: unknown }) => `${c.field}`).join(', ')}`,
        },
      },
    );
    try {
      await ActivityLog.create({
        adminId: new Types.ObjectId(adminId),
        action: 'data_quality_auto_fix',
        details: `Auto-fixed issue ${issue.issueKey}: ${result.changes.map((c: { field: string; oldValue: unknown; newValue: unknown }) => `${c.field}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join('; ')}`,
        entityType: 'data_quality',
        entityId: issueId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }
  }

  return result;
}

// ─── PRICE TRACKER ISSUE SCANNER ─────────────────────────────────

async function scanPriceTrackerIssues(allIssues: DetectedIssue[]): Promise<void> {
  // 1. Stale tracked prices — listings not checked in 14+ days
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const staleListings = await PhoneRetailListing.find({
      enabled: true,
      $or: [
        { lastCheckedAt: null },
        { lastCheckedAt: { $lt: fourteenDaysAgo } },
      ],
    }).select('phoneId currentSourcePrice lastCheckedAt sourceId').lean();

    for (const listing of staleListings) {
      const pid = listing.phoneId?.toString();
      const lid = listing._id?.toString();
      if (!pid || !lid) continue;
      allIssues.push({
        issueKey: `PRICE_STALE_TRACKED:retail_listing:${lid}`,
        entityType: 'retail_listing', entityId: lid,
        issueType: 'PRICE_STALE_TRACKED', severity: 'low',
        field: 'lastCheckedAt',
        currentValue: listing.lastCheckedAt?.toISOString() || 'never',
        suggestedValue: 'Re-check this listing',
        source: 'price_tracker', confidence: 0.9,
        metadata: { phoneId: pid, sourcePrice: listing.currentSourcePrice },
      });
    }
  } catch (e) {
    console.error('[DataQuality] Price stale scan error:', e);
  }

  // 2. Inactive / failed price sources
  try {
    const inactiveSources = await PriceSource.find({
      $or: [
        { enabled: false, status: { $ne: 'active' } },
        { status: 'failed', failureCount: { $gt: 3 } },
      ],
    }).lean();

    for (const src of inactiveSources) {
      const sid = src._id?.toString();
      if (!sid) continue;
      allIssues.push({
        issueKey: `PRICE_SOURCE_INACTIVE:price_source:${sid}`,
        entityType: 'price_source', entityId: sid,
        issueType: 'PRICE_SOURCE_INACTIVE', severity: 'info',
        field: 'status',
        currentValue: src.status || (src.enabled ? 'enabled' : 'disabled'),
        suggestedValue: src.status === 'failed' ? 'Fix source configuration or disable' : 'Review source status',
        source: 'price_tracker', confidence: 1,
        metadata: { sourceName: src.name, failureCount: src.failureCount, enabled: src.enabled },
      });
    }
  } catch (e) {
    console.error('[DataQuality] Price source scan error:', e);
  }

  // 3. Price outliers — listing price >50% different from phone.pricePKR
  try {
    const enabledListings = await PhoneRetailListing.find({
      enabled: true,
      verificationStatus: { $ne: 'rejected' },
      currentSourcePrice: { $gt: 0 },
    }).select('phoneId currentSourcePrice sourceId').lean();

    const byPhone = new Map<string, typeof enabledListings>();
    for (const l of enabledListings) {
      const pid = l.phoneId?.toString();
      if (!pid) continue;
      if (!byPhone.has(pid)) byPhone.set(pid, []);
      byPhone.get(pid)!.push(l);
    }

    const phoneIds = [...byPhone.keys()];
    if (phoneIds.length > 0) {
      const phones = await Phone.find({ _id: { $in: phoneIds } }).select('_id pricePKR modelName').lean();
      const phoneMap = new Map(phones.map((p: { _id: Types.ObjectId; pricePKR: number; modelName: string }) => [p._id.toString(), p]));

      for (const [pid, listings] of byPhone) {
        const phone = phoneMap.get(pid);
        if (!phone || !phone.pricePKR || phone.pricePKR <= 0) continue;

        for (const listing of listings) {
          const lid = listing._id?.toString();
          const deviation = (listing.currentSourcePrice - phone.pricePKR) / phone.pricePKR;
          if (Math.abs(deviation) > 0.5) {
            allIssues.push({
              issueKey: `PRICE_OUTLIER:retail_listing:${lid}`,
              entityType: 'retail_listing', entityId: lid,
              issueType: 'PRICE_OUTLIER', severity: 'medium',
              field: 'currentSourcePrice',
              currentValue: listing.currentSourcePrice,
              suggestedValue: `Phone price is PKR ${phone.pricePKR.toLocaleString()} (${Math.round(deviation * 100)}% deviation)`,
              source: 'price_tracker', confidence: 0.7,
              metadata: { phoneId: pid, phonePrice: phone.pricePKR, deviation: Math.round(deviation * 100) },
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('[DataQuality] Price outlier scan error:', e);
  }

  // 4. Price mismatch — lowest listing is much lower but phone not updated
  try {
    const activeListings = await PhoneRetailListing.find({
      enabled: true,
      availability: 'in_stock',
      verificationStatus: { $in: ['verified', 'pending'] },
      currentSourcePrice: { $gt: 0 },
    }).select('phoneId currentSourcePrice').lean();

    const byPhone = new Map<string, number[]>();
    for (const l of activeListings) {
      const pid = l.phoneId?.toString();
      if (!pid) continue;
      if (!byPhone.has(pid)) byPhone.set(pid, []);
      byPhone.get(pid)!.push(l.currentSourcePrice);
    }

    const phoneIds = [...byPhone.keys()];
    if (phoneIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const phones = await Phone.find({
        _id: { $in: phoneIds },
        manualLock: { $ne: true },
        $or: [
          { lastPriceChangedAt: null },
          { lastPriceChangedAt: { $lt: thirtyDaysAgo } },
        ],
      }).select('_id pricePKR lastPriceChangedAt').lean();
      const phoneMap = new Map(phones.map((p: { _id: Types.ObjectId; pricePKR: number; lastPriceChangedAt: Date | null }) => [p._id.toString(), p]));

      for (const [pid, prices] of byPhone) {
        const phone = phoneMap.get(pid);
        if (!phone || !phone.pricePKR || phone.pricePKR <= 0) continue;

        const lowestListing = Math.min(...prices);
        const diff = (phone.pricePKR - lowestListing) / phone.pricePKR;
        if (diff > 0.1) {
          allIssues.push({
            issueKey: `PRICE_MISMATCH:phone:${pid}`,
            entityType: 'retail_listing', entityId: pid,
            issueType: 'PRICE_MISMATCH', severity: 'medium',
            field: 'pricePKR',
            currentValue: phone.pricePKR,
            suggestedValue: `Lowest listing is PKR ${lowestListing.toLocaleString()} (${Math.round(diff * 100)}% lower)`,
            source: 'price_tracker', confidence: 0.6,
            metadata: { lowestListing, deviation: Math.round(diff * 100) },
          });
        }
      }
    }
  } catch (e) {
    console.error('[DataQuality] Price mismatch scan error:', e);
  }
}

// ─── HEALTH SCORE CALCULATOR ─────────────────────────────────────

export async function calculateHealthScore(): Promise<{
  score: number;
  categories: Array<{ name: string; score: number; deduction: number; maxDeduction: number; details: string }>;
  totals: {
    totalPhones: number;
    publishedPhones: number;
    draftPhones: number;
  };
}> {
  const [totalPhones, publishedPhones, draftPhones] = await Promise.all([
    Phone.countDocuments({ deletedAt: null }),
    Phone.countDocuments({ deletedAt: null, status: 'published' }),
    Phone.countDocuments({ deletedAt: null, status: { $in: ['draft', 'pending'] } }),
  ]);

  const base = publishedPhones || 1;
  const categories: Array<{ name: string; score: number; deduction: number; maxDeduction: number; details: string }> = [];

  for (const cat of HEALTH_CATEGORIES) {
    let deduction = 0;
    let details = '';

    switch (cat.name) {
      case 'Core Identity': {
        const missingBrand = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ brandId: null }, { brandId: { $exists: false } }] });
        const missingSlug = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ slug: '' }, { slug: null }] });
        const missingModel = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ modelName: '' }, { modelName: null }] });
        const missingStatus = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ ptaStatus: 'Unknown' }, { ptaStatus: '' }, { ptaStatus: null }] });
        deduction = Math.min(cat.maxDeduction,
          (missingBrand / base) * 8 +
          (missingSlug / base) * 6 +
          (missingModel / base) * 4 +
          (missingStatus / base) * 2
        );
        const parts: string[] = [];
        if (missingBrand > 0) parts.push(`${missingBrand} missing brand`);
        if (missingSlug > 0) parts.push(`${missingSlug} missing slug`);
        if (missingModel > 0) parts.push(`${missingModel} missing model`);
        if (missingStatus > 0) parts.push(`${missingStatus} missing PTA status`);
        details = parts.length > 0 ? parts.join(', ') : 'All phones have core identity fields';
        break;
      }
      case 'Specifications': {
        const publishedIds = await Phone.find({ deletedAt: null, status: 'published' }).distinct('_id');
        const allSpecs = await PhoneSpecs.find({ phoneId: { $in: publishedIds } }).lean();
        const specPhoneIds = new Set(allSpecs.map((s: LeanSpecs) => s.phoneId?.toString()).filter(Boolean));
        const missingSpecs = Math.max(0, publishedPhones - specPhoneIds.size);
        const emptySpecs = allSpecs.filter((s: LeanSpecs) => {
          const keys = ['chipset', 'ram', 'storage', 'display', 'battery'];
          return keys.every(k => {
            const val = s[k];
            return !val || (typeof val === 'string' && !val.trim());
          });
        }).length;
        deduction = Math.min(cat.maxDeduction,
          (missingSpecs / base) * 15 +
          (emptySpecs / base) * 10
        );
        const parts: string[] = [];
        if (missingSpecs > 0) parts.push(`${missingSpecs} missing specs`);
        if (emptySpecs > 0) parts.push(`${emptySpecs} empty specs`);
        details = parts.length > 0 ? parts.join(', ') : 'All phones have specs';
        break;
      }
      case 'Images': {
        const publishedIds = await Phone.find({ deletedAt: null, status: 'published' }).distinct('_id');
        const phonesWithoutThumb = await Phone.countDocuments({ _id: { $in: publishedIds }, $or: [{ thumbnail: '' }, { thumbnail: null }] });
        const phonesWithImages = await PhoneImage.distinct('phoneId', { phoneId: { $in: publishedIds } });
        const phonesNoImg = Math.max(0, publishedPhones - phonesWithImages.length);
        const imgIssues = Math.max(phonesWithoutThumb, phonesNoImg);
        deduction = Math.min(cat.maxDeduction, (imgIssues / base) * 15);
        details = imgIssues > 0 ? `${imgIssues} phones missing images` : 'All phones have images';
        break;
      }
      case 'Prices': {
        const noPrice = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ pricePKR: 0 }, { pricePKR: null }, { pricePKR: { $lt: 0 } }] });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const stalePrices = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ lastPriceCheckedAt: null }, { lastPriceCheckedAt: { $lt: thirtyDaysAgo } }] });
        deduction = Math.min(cat.maxDeduction,
          (noPrice / base) * 10 +
          (stalePrices / base) * 5
        );
        const parts: string[] = [];
        if (noPrice > 0) parts.push(`${noPrice} missing price`);
        if (stalePrices > 0) parts.push(`${stalePrices} stale prices`);
        details = parts.length > 0 ? parts.join(', ') : 'All prices are valid';
        break;
      }
      case 'Relationships': {
        const openOrphanIssues = await DataQualityIssue.countDocuments({ status: 'open', issueType: { $in: ['ORPHAN_SPECS', 'ORPHAN_IMAGE', 'ORPHAN_PRICE', 'ORPHAN_BENCHMARK'] } });
        deduction = Math.min(cat.maxDeduction, (openOrphanIssues / base) * 10);
        details = openOrphanIssues > 0 ? `${openOrphanIssues} orphan records` : 'No orphan records';
        break;
      }
      case 'Duplicates': {
        const openDupIssues = await DataQualityIssue.countDocuments({ status: 'open', issueType: { $in: ['PHONE_DUPLICATE_SLUG', 'PHONE_DUPLICATE_NORMALIZED', 'BRAND_DUPLICATE_NORMALIZED', 'SPECS_DUPLICATE'] } });
        deduction = Math.min(cat.maxDeduction, (openDupIssues / base) * 10);
        details = openDupIssues > 0 ? `${openDupIssues} duplicate candidates` : 'No duplicates';
        break;
      }
      case 'Verification': {
        const unverified = await Phone.countDocuments({ deletedAt: null, status: 'published', dataConfidence: { $ne: 'verified' } });
        deduction = Math.min(cat.maxDeduction, (unverified / base) * 5);
        details = unverified > 0 ? `${unverified} unverified phones` : 'All phones verified';
        break;
      }
    }

    categories.push({
      name: cat.name,
      score: Math.max(0, cat.weight - deduction),
      deduction: Math.round(deduction * 10) / 10,
      maxDeduction: cat.maxDeduction,
      details,
    });
  }

  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  const score = Math.max(0, Math.min(100, Math.round(totalScore)));

  return { score, categories, totals: { totalPhones, publishedPhones, draftPhones } };
}