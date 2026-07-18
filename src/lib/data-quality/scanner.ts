import { Types } from 'mongoose';
import { Phone, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice, Brand, DataQualityIssue, ScanJob, ActivityLog, PriceSource, PhoneRetailListing, ImportJob, ImportBatch } from '@/lib/models';
import { ALL_QUALITY_RULES, getRuleById } from './rules';
import { DetectedIssue, DetectionContext, FixContext, FixResult, HealthCategory, HEALTH_CATEGORIES } from './types';

const BATCH_SIZE = 100;

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
  });
  return { scanId };
}

export async function executeScan(scanId: string): Promise<void> {
  const job = await ScanJob.findOne({ scanId });
  if (!job) throw new Error('Scan not found');
  if (job.status === 'running') throw new Error('Scan already running');

  await ScanJob.updateOne({ scanId }, {
    $set: { status: 'running', startedAt: new Date() },
  });

  try {
    const activeRules = job.rules.length > 0
      ? job.rules.map(rid => getRuleById(rid)).filter(Boolean)
      : ALL_QUALITY_RULES;

    const ctx = await buildDetectionContext(job);
    const allIssues: DetectedIssue[] = [];

    if (job.type === 'import' && job.importId) {
      // Import-specific: only scan phones from this import
      await scanImportPhones(job, activeRules, ctx, allIssues);
    } else if (job.entityIds && job.entityIds.length > 0) {
      // Entity-specific scan
      const phones = await Phone.find({ _id: { $in: job.entityIds.map(id => new Types.ObjectId(id)) }, deletedAt: null }).lean();
      ctx.entities = phones;
      await runRulesOnBatch(activeRules, ctx, allIssues);
    } else if (job.type === 'incremental') {
      // Incremental: phones updated since last completed scan
      const lastScan = await ScanJob.findOne({ status: { $in: ['completed', 'completed_with_errors'] } }).sort({ completedAt: -1 }).lean();
      const query = lastScan?.completedAt
        ? { updatedAt: { $gt: lastScan.completedAt }, deletedAt: null }
        : { deletedAt: null };
      await scanAllPhones(job, query, activeRules, ctx, allIssues);
    } else {
      // Full scan
      await scanAllPhones(job, { deletedAt: null }, activeRules, ctx, allIssues);
    }

    // Also scan for orphan records (not covered by phone-based rules)
    await scanOrphans(ctx, allIssues);

    // Persist issues (deduplicated by issueKey)
    let created = 0;
    if (!job.dryRun) {
      created = await persistIssues(allIssues, job.importId || undefined);
    }

    await ScanJob.updateOne({ scanId }, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        issuesFound: allIssues.length,
        issuesCreated: created,
      },
    });
  } catch (e: any) {
    await ScanJob.updateOne({ scanId }, {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        errorSummary: (e?.message || 'Unknown error').slice(0, 500),
      },
    });
    throw e;
  }
}

// ─── CONTEXT BUILDER ──────────────────────────────────────────────

async function buildDetectionContext(job: any): Promise<DetectionContext> {
  // Fetch all brands
  const brands = await Brand.find({}).lean();
  const brandsMap = new Map(brands.map((b: any) => [b._id.toString(), b]));

  // Fetch all specs
  const allSpecs = await PhoneSpecs.find({}).lean();
  const specsMap = new Map(allSpecs.map((s: any) => [s.phoneId?.toString(), s]));

  // Fetch all images grouped by phoneId
  const allImages = await PhoneImage.find({}).sort({ phoneId: 1, sortOrder: 1 }).lean();
  const imagesMap = new Map<string, any[]>();
  for (const img of allImages) {
    const pid = img.phoneId?.toString();
    if (pid) {
      if (!imagesMap.has(pid)) imagesMap.set(pid, []);
      imagesMap.get(pid)!.push(img);
    }
  }

  // Fetch all prices grouped by phoneId
  const allPrices = await PhonePrice.find({}).lean();
  const pricesMap = new Map<string, any[]>();
  for (const pr of allPrices) {
    const pid = pr.phoneId?.toString();
    if (pid) {
      if (!pricesMap.has(pid)) pricesMap.set(pid, []);
      pricesMap.get(pid)!.push(pr);
    }
  }

  // Fetch all benchmarks
  const allBenchmarks = await PhoneBenchmark.find({}).lean();
  const benchmarksMap = new Map(allBenchmarks.map((b: any) => [b.phoneId?.toString(), b]));

  return {
    entities: [],
    lookups: { brands: brandsMap, specs: specsMap, images: imagesMap, prices: pricesMap, benchmarks: benchmarksMap },
    importId: job.importId || undefined,
  };
}

// ─── SCAN ALL PHONES (with batch processing) ─────────────────────

async function scanAllPhones(
  job: any,
  query: any,
  rules: any[],
  ctx: DetectionContext,
  allIssues: DetectedIssue[],
) {
  let cursor = job.lastProcessedId
    ? Phone.find({ ...query, _id: { $gt: new Types.ObjectId(job.lastProcessedId) } })
    : Phone.find(query);

  cursor = cursor.sort({ _id: 1 }).select('_id brandId modelName slug pricePKR status thumbnail releaseDate ptaStatus dataConfidence lastPriceCheckedAt').lean().batchSize(BATCH_SIZE);

  const docs = await cursor.lean();
  const phoneIds = docs.map((d: any) => d._id.toString());
  const total = phoneIds.length;

  for (let i = 0; i < phoneIds.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    ctx.entities = batch;
    await runRulesOnBatch(rules, ctx, allIssues);

    const lastDoc = batch[batch.length - 1];
    await ScanJob.updateOne({ scanId: job.scanId }, {
      $set: { processed: Math.min(i + BATCH_SIZE, total), currentBatch: Math.floor(i / BATCH_SIZE) + 1, total },
    });
  }
}

// ─── IMPORT-SPECIFIC SCAN ────────────────────────────────────────

async function scanImportPhones(
  job: any,
  rules: any[],
  ctx: DetectionContext,
  allIssues: DetectedIssue[],
) {
  const importJob = await ImportJob.findOne({ importId: job.importId }).lean();
  if (!importJob) return;

  // Get all batch details to find created/updated phone IDs
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
      entityType: 'import', entityId: job.importId,
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

async function runRulesOnBatch(rules: any[], ctx: DetectionContext, allIssues: DetectedIssue[]) {
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

async function scanOrphans(ctx: DetectionContext, allIssues: DetectedIssue[]) {
  const phoneIds = new Set(ctx.lookups.specs.keys());

  // Orphan specs
  const specsArr = Array.from(ctx.lookups.specs.values());
  for (const spec of specsArr) {
    const pid = spec.phoneId?.toString();
    if (pid && !phoneIds.has(pid)) {
      // Verify against actual phones (some may not be in the batch)
      const exists = await Phone.findById(pid).select('_id').lean();
      if (!exists) {
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
  }

  // Duplicate specs
  const specPhoneIds = specsArr.map(s => s.phoneId?.toString()).filter(Boolean);
  const specCount = new Map<string, number>();
  for (const pid of specPhoneIds) {
    specCount.set(pid, (specCount.get(pid) || 0) + 1);
  }
  for (const [pid, count] of specCount) {
    if (count > 1) {
      allIssues.push({
        issueKey: `SPECS_DUPLICATE:phone_specs:${pid}`,
        entityType: 'phone_specs', entityId: pid,
        issueType: 'SPECS_DUPLICATE', severity: 'high',
        field: 'phoneId', currentValue: count,
        suggestedValue: 'Keep one, remove duplicates',
        source: 'system', confidence: 1,
      });
    }
  }

  // Orphan images, prices, benchmarks — batch check
  const allPhoneIds = await Phone.find({ deletedAt: null }).select('_id').lean();
  const validPhoneIds = new Set(allPhoneIds.map((p: any) => p._id.toString()));

  // Orphan images
  const allImages = await PhoneImage.find({}).select('phoneId').lean();
  for (const img of allImages) {
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

  // Orphan prices
  const allPrices = await PhonePrice.find({}).select('phoneId storeName').lean();
  for (const pr of allPrices) {
    const pid = pr.phoneId?.toString();
    if (pid && !validPhoneIds.has(pid)) {
      allIssues.push({
        issueKey: `ORPHAN_PRICE:phone_price:${pid}:${pr.storeName}`,
        entityType: 'phone_price', entityId: pid,
        issueType: 'ORPHAN_PRICE', severity: 'medium',
        field: 'phoneId', currentValue: pid,
        suggestedValue: 'Delete orphan price records',
        source: 'system', confidence: 1,
      });
    }
  }

  // Orphan benchmarks
  const allBenchmarks = await PhoneBenchmark.find({}).select('phoneId').lean();
  for (const bm of allBenchmarks) {
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

  // Brand duplicates
  const brands = await Brand.find({}).lean();
  const normBrandMap = new Map<string, any[]>();
  for (const brand of brands) {
    const norm = brand.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    if (!norm) continue;
    if (!normBrandMap.has(norm)) normBrandMap.set(norm, []);
    normBrandMap.get(norm)!.push(brand);
  }
  for (const [, entries] of normBrandMap) {
    if (entries.length > 1) {
      for (const brand of entries) {
        const id = (brand as any)._id?.toString();
        if (!id) continue;
        allIssues.push({
          issueKey: `BRAND_DUPLICATE_NORMALIZED:brand:${id}`,
          entityType: 'brand', entityId: id,
          issueType: 'BRAND_DUPLICATE_NORMALIZED', severity: 'high',
          field: 'name', currentValue: brand.name,
          suggestedValue: 'Review and merge duplicate brands',
          source: 'system', confidence: 0.7,
          metadata: { candidateIds: entries.map((b: any) => b._id?.toString()) },
        });
      }
    }
  }

  // Brand missing logo
  for (const brand of brands) {
    const id = (brand as any)._id?.toString();
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

  // Brand missing slug
  for (const brand of brands) {
    const id = (brand as any)._id?.toString();
    if (!id || brand.slug) continue;
    allIssues.push({
      issueKey: `BRAND_MISSING_LOGO:brand:${id}:slug`,
      entityType: 'brand', entityId: id,
      issueType: 'BRAND_DUPLICATE_NORMALIZED', severity: 'medium',
      field: 'slug', currentValue: null,
      suggestedValue: 'Generate brand slug',
      source: 'system', confidence: 1,
    });
  }
}

// ─── PERSIST ISSUES (upsert by issueKey for unresolved) ───────────

async function persistIssues(issues: DetectedIssue[], importId?: string): Promise<number> {
  if (issues.length === 0) return 0;

  const bulkOps: any[] = [];
  const issueKeys = issues.map(i => i.issueKey);

  // Find existing unresolved issues with the same keys
  const existing = await DataQualityIssue.find({
    issueKey: { $in: issueKeys },
    status: { $in: ['open', 'ignored', 'needs_review'] },
  }).select('issueKey').lean();
  const existingKeys = new Set(existing.map((e: any) => e.issueKey));

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
  } catch (e: any) {
    // Duplicate key errors are expected — some issues may have been created between check and insert
    if (e.code === 11000) {
      // Retry one by one to get the actual count
      let inserted = 0;
      for (const op of bulkOps) {
        try {
          await DataQualityIssue.create(op.insertOne.document);
          inserted++;
        } catch (dupErr: any) {
          if (dupErr.code !== 11000) console.error('[DataQuality] persist error:', dupErr);
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
  const issue = await DataQualityIssue.findById(issueId).lean();
  if (!issue) throw new Error('Issue not found');

  const rule = getRuleById((issue as any).issueType);
  if (!rule || !rule.canAutoFix || !rule.autoFix) {
    throw new Error('This issue type does not support auto-fix');
  }

  const fixCtx: FixContext = { adminId, dryRun };
  const detectedIssue: DetectedIssue = {
    issueKey: (issue as any).issueKey,
    entityType: (issue as any).entityType,
    entityId: (issue as any).entityId,
    issueType: (issue as any).issueType,
    severity: (issue as any).severity,
    field: (issue as any).field,
    currentValue: (issue as any).currentValue,
    suggestedValue: (issue as any).suggestedValue,
    source: (issue as any).source || 'system',
    confidence: (issue as any).confidence || 0,
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
          resolution: `Auto-fixed: ${result.changes.map(c => `${c.field}`).join(', ')}`,
        },
      },
    );
    try {
      await ActivityLog.create({
        adminId: new Types.ObjectId(adminId),
        action: 'data_quality_auto_fix',
        details: `Auto-fixed issue ${(issue as any).issueKey}: ${result.changes.map(c => `${c.field}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join('; ')}`,
        entityType: 'data_quality',
        entityId: issueId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }
  }

  return result;
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

  const base = publishedPhones || 1; // Avoid division by zero
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
          (missingModel / base) * 6
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
        const allSpecs = await PhoneSpecs.find({}).lean();
        const specPhoneIds = new Set(allSpecs.map((s: any) => s.phoneId?.toString()).filter(Boolean));
        const missingSpecs = publishedPhones - specPhoneIds.size;
        const emptySpecs = allSpecs.filter((s: any) => {
          const keys = ['chipset', 'ram', 'storage', 'display', 'battery'];
          return keys.every(k => !s[k] || !s[k].trim());
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
        const phonesWithoutThumb = await Phone.countDocuments({ deletedAt: null, status: 'published', $or: [{ thumbnail: '' }, { thumbnail: null }] });
        const phonesWithImages = await PhoneImage.distinct('phoneId');
        const phonesNoImg = publishedPhones - phonesWithImages.length;
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