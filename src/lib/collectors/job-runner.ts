import { CollectorSource, CollectedPhone, CollectorJob, Phone, Brand, PhoneSpecs, PhoneImage, PhoneBenchmark, ActivityLog } from '@/lib/models';
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';
import { createProvider, ProviderFetchResult } from './providers';
import { NormalizedPhone, ProviderConfig, ProviderType, ConflictInfo } from './types';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance, scoreCollectedPhone } from './services';
import { createHash } from 'node:crypto';
import { generateSlug } from '@/lib/import/validators';

const MAX_COLLECT_PER_JOB = 2000;
// Vercel serverless: limit pages per invocation to stay within timeout.
// Set via env var (default 3 pages ~ safe for 60s Pro tier).
// For self-hosted or long-running functions, set to 0 for unlimited.
const PAGES_PER_INVOCATION = parseInt(process.env.COLLECTOR_PAGES_PER_INVOCATION || '1') || 0;


function sanitizeCollectorError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Collector job failed');
  if (/Headers\.(?:append|set)|invalid header value/i.test(raw)) {
    return 'Invalid HTTP header configuration. Remove non-text custom headers from the collector source and retry.';
  }
  // Prevent raw Mongo/Mongoose documents, secrets, or huge HTML responses from
  // leaking into dashboard cards and activity logs.
  return raw.replace(/\s+/g, ' ').slice(0, 500);
}

function plainSourceRecord(source: unknown): Record<string, unknown> {
  if (source && typeof source === 'object' && 'toObject' in source && typeof (source as { toObject?: unknown }).toObject === 'function') {
    return (source as { toObject: (options?: Record<string, unknown>) => Record<string, unknown> }).toObject({ flattenMaps: true });
  }
  return (source || {}) as Record<string, unknown>;
}

// ============ JOB RUNNER ============

function toStringRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value) return result;
  const add = (key: unknown, rawValue: unknown): void => {
    if (typeof key !== 'string' || !key.trim()) return;
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean') return;
    const normalized = String(rawValue).trim();
    if (!normalized || /[\r\n]/.test(normalized)) return;
    result[key] = normalized;
  };
  if (value instanceof Map) {
    value.forEach((entryValue, key) => add(key, entryValue));
    return result;
  }
  const candidate = value as { entries?: () => IterableIterator<[unknown, unknown]>; toObject?: () => unknown };
  if (typeof candidate.entries === 'function') {
    try {
      for (const [key, entryValue] of candidate.entries()) add(key, entryValue);
      return result;
    } catch { /* continue */ }
  }
  if (typeof candidate.toObject === 'function') {
    try { return toStringRecord(candidate.toObject()); } catch { /* continue */ }
  }
  if (typeof value === 'object') {
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) add(key, entryValue);
  }
  return result;
}

export async function startJob(jobId: string): Promise<void> {
  await connectDB();
  const job = await CollectorJob.findById(jobId);
  if (!job) return;

  const resumingFromPage = job.currentBatch > 0 ? job.currentBatch + 1 : 1;
  await CollectorJob.updateOne({ _id: jobId }, { $set: { status: 'running', startedAt: job.startedAt || new Date(), lastError: '', errorLog: [] } });

  try {
    if (job.sourceId) {
      const source = await CollectorSource.findById(job.sourceId);
      if (!source) throw new Error('Source not found');
      if (!source.enabled) throw new Error('Source is disabled');

      // Repair legacy/custom header values before every run. Older source records
      // may contain Mongoose Maps or non-string values. Only primitive text
      // headers are valid for fetch/undici, so persist the sanitized record and
      // clear stale header-related errors automatically.
      const repairedHeaders = toStringRecord(source.headers);
      const sourceHeadersObject = toStringRecord(plainSourceRecord(source).headers);
      const headerRecord = { ...sourceHeadersObject, ...repairedHeaders };
      const shouldRepairHeaders = JSON.stringify(headerRecord) !== JSON.stringify(sourceHeadersObject);
      if (shouldRepairHeaders || /invalid header|Headers\.(?:append|set)/i.test(String(source.lastError || ''))) {
        await CollectorSource.updateOne(
          { _id: source._id },
          { $set: { headers: headerRecord, lastError: '', lastTestMessage: '', lastSyncStatus: 'never' } },
        );
        source.headers = new Map(Object.entries(headerRecord));
        source.lastError = '';
      }

      const config = buildProviderConfig(plainSourceRecord(source));
      // Public/manual/feed sources do not need arbitrary custom headers. Legacy
      // source records sometimes stored a whole Mongoose document in the header
      // map, which caused undici to throw `Headers.append ... invalid header`.
      // Only API providers may use configured headers; all other providers use
      // the provider's safe built-in request headers.
      if (config.type !== 'api') config.headers = {};
      const provider = createProvider(config, source._id.toString(), String(source.name || 'Collector source'));

      let page = resumingFromPage;
      let hasNext = true;
      let totalFetched = 0;
      let pagesProcessedThisInvocation = 0;

      const existingPhones = await Phone.find({ active: true }, { modelName: 1, slug: 1, brandId: 1 }).populate({ path: 'brand', select: 'name' }).lean();
      const existingWithBrand: Array<{ _id: string; modelName: string; slug: string; brandId?: string; brand?: { name: string } }> = existingPhones.map((p) => ({
        _id: p._id.toString(), modelName: p.modelName, slug: p.slug,
        brandId: p.brandId?.toString(),
        brand: p.brand ? { name: (p.brand as { name?: string }).name || '' } : undefined,
      }));

      while (hasNext && totalFetched < MAX_COLLECT_PER_JOB) {
        // Serverless page-limit: stop early if configured
        if (PAGES_PER_INVOCATION > 0 && pagesProcessedThisInvocation >= PAGES_PER_INVOCATION) {
          // Save progress for next invocation
          await CollectorJob.updateOne({ _id: jobId }, {
            $set: { status: 'paused', lastProcessedAt: new Date() },
          });
          await ActivityLog.create({
            action: 'collector_sync_paused',
            details: `Job ${jobId} paused at page ${page} (serverless page limit). Re-trigger to continue.`,
            entityType: 'collector',
            entityId: jobId,
          });
          return;
        }

        // Check if job was paused or cancelled
        const currentJob = await CollectorJob.findById(jobId);
        if (!currentJob || currentJob.status === 'cancelled') {
          return;
        }
        if (currentJob.status === 'paused') {
          await CollectorJob.updateOne({ _id: jobId }, { $set: { status: 'paused', lastProcessedAt: new Date() } });
          return;
        }

        await CollectorJob.updateOne({ _id: jobId }, { $set: { lastProcessedAt: new Date(), currentBatch: Math.max(0, page - 1) } });
        const result: ProviderFetchResult = await provider.fetch(page);
        pagesProcessedThisInvocation += 1;

        let actualNewCount = 0;
        let possibleUpdateCount = 0;
        let duplicateCount = 0;
        let conflictCount = 0;
        for (const phone of result.phones) {
          const outcome = await processCollectedPhone(phone, config, source._id.toString(), source.name, phone.sourceUrl || source.endpoint || '', existingWithBrand, job._id.toString(), source.reliabilityScore);
          if (outcome.isNew) actualNewCount += 1;
          if (outcome.isPossibleUpdate) possibleUpdateCount += 1;
          if (outcome.isDuplicate) duplicateCount += 1;
          conflictCount += outcome.conflicts;
        }

        totalFetched += result.phones.length;
        const fetchedCount = result.phones.length;

        await CollectorJob.updateOne({ _id: jobId }, {
          $inc: {
            fetched: fetchedCount,
            normalized: fetchedCount,
            newPhones: actualNewCount,
            possibleUpdates: possibleUpdateCount,
            duplicates: duplicateCount,
            conflictCount,
            failureCount: result.providerErrors.length,
          },
          $set: {
            lastProcessedAt: new Date(),
            currentBatch: page,
            errorLog: result.providerErrors.slice(0, 20),
          },
        });

        // Update source stats
        await CollectorSource.updateOne({ _id: source._id }, {
          $inc: { totalCollected: fetchedCount, totalFailed: result.providerErrors.length },
          $set: { lastSyncAt: new Date(), lastSuccessfulSyncAt: result.providerErrors.length > 0 ? source.lastSuccessfulSyncAt : new Date(), lastSyncStatus: result.providerErrors.length > 0 ? 'partial' : 'success', lastError: result.providerErrors.join('; ').slice(0, 1000) },
        });

        hasNext = result.hasNextPage;
        page++;

        if (result.totalAvailable) {
          await CollectorJob.updateOne({ _id: jobId }, { $set: { totalExpected: result.totalAvailable } });
        }
      }
    }

    const finalJob = await CollectorJob.findById(jobId);
    const hasFailures = (finalJob?.failureCount || 0) > 0;
    const status = hasFailures ? 'partially_completed' : 'completed';
    await CollectorJob.updateOne({ _id: jobId }, {
      $set: { status, completedAt: new Date(), duration: Date.now() - (finalJob?.startedAt?.getTime() || Date.now()) },
    });

    await ActivityLog.create({
      action: 'collector_sync_completed',
      details: `Job ${jobId} ${status}: ${finalJob?.fetched || 0} fetched, ${finalJob?.newPhones || 0} new`,
      entityType: 'collector',
      entityId: jobId,
    });
  } catch (e: unknown) {
    const errMsg = sanitizeCollectorError(e);
    await CollectorJob.updateOne({ _id: jobId }, {
      $set: { status: 'failed', lastError: errMsg, completedAt: new Date() },
      $inc: { failureCount: 1 },
    });
    await ActivityLog.create({
      action: 'collector_sync_failed',
      details: `Job ${jobId} failed: ${errMsg}`,
      entityType: 'collector',
      entityId: jobId,
    });
  }
}

// ============ PROCESS SINGLE PHONE ============
async function processCollectedPhone(
  phone: NormalizedPhone,
  config: ProviderConfig,
  sourceId: string,
  sourceName: string,
  sourceUrl: string,
  existingPhones: Array<{ _id: string; modelName: string; slug: string; brandId?: string; brand?: { name: string } }>,
  jobId: string,
  reliability: number,
): Promise<{ isNew: boolean; isPossibleUpdate: boolean; isDuplicate: boolean; conflicts: number }> {
  const issues = validateCollectedPhone(phone);
  const isValid = !issues.some(issue => issue.severity === 'error');
  const scores = scoreCollectedPhone(phone, issues, reliability);
  const dupResult = detectDuplicates(phone, existingPhones);
  const conflicts: ConflictInfo[] = [];
  if (dupResult.matches.length > 0) {
    const bestMatch = dupResult.matches[0];
    const existingPhone = existingPhones.find(candidate => candidate._id?.toString() === bestMatch.phoneId);
    if (existingPhone) conflicts.push(...detectConflicts(phone, existingPhone as unknown as { modelName: string; slug: string; pricePKR: number; [key: string]: unknown }, sourceName));
  }
  const categories = suggestCategory(phone);
  const seo = suggestSEO(phone);
  const recordSourceUrl = phone.sourceUrl || sourceUrl;
  const fieldProvenance = buildFieldProvenance(phone, sourceId, sourceName, recordSourceUrl, reliability);
  const status = !isValid || dupResult.isDuplicate ? 'needs_review' : 'pending';
  const providerRecordId = phone.slug || generateSlug(`${phone.brandName} ${phone.model}`);
  const checksum = createHash('sha256').update(JSON.stringify(phone)).digest('hex');
  const data = {
    status, brandName: phone.brandName, model: phone.model, slug: phone.slug,
    releaseDate: phone.releaseDate || '', announcedDate: phone.announcedDate || '', availability: phone.availability || '',
    deviceStatus: phone.deviceStatus || '', deviceType: phone.deviceType || '', display: phone.display || {},
    processor: phone.processor || {}, memory: phone.memory || {}, camera: phone.camera || {}, battery: phone.battery || {},
    body: phone.body || {}, connectivity: phone.connectivity || {}, software: phone.software || {}, audio: phone.audio || {},
    sensors: phone.sensors || {}, benchmarks: phone.benchmarks || {}, images: phone.images || [], thumbnail: phone.thumbnail || '',
    pakistanPrice: phone.pakistanPrice ?? null, ptaApproved: phone.ptaApproved ?? null, ptaStatus: phone.ptaStatus || '',
    suggestedCategory: categories.join(', '), suggestedSeoTitle: seo.title, suggestedSeoDescription: seo.description,
    suggestedKeywords: seo.keywords, sourceId: new Types.ObjectId(sourceId), sourceName, sourceUrl: recordSourceUrl,
    providerRecordId, checksum, lastVerifiedAt: new Date(), collectedAt: new Date(), fieldProvenance,
    duplicateMatches: dupResult.matches.map(match => ({ type: match.type, phoneId: match.phoneId || '', modelName: match.modelName || '', brandName: match.brandName || '', slug: match.slug || '', confidence: match.confidence })),
    hasExactDuplicate: dupResult.matches.some(match => match.type === 'exact_slug'), duplicatePhoneId: dupResult.matches[0]?.phoneId || '',
    conflicts, conflictCount: conflicts.length, validationIssues: issues.map(issue => `${issue.severity}: ${issue.field} - ${issue.message}`),
    validationErrors: issues.filter(issue => issue.severity === 'error').map(issue => `${issue.field}: ${issue.message}`),
    validationWarnings: issues.filter(issue => issue.severity === 'warning').map(issue => `${issue.field}: ${issue.message}`),
    isValid, ...scores, jobId: new Types.ObjectId(jobId), sourceReliability: reliability,
  };

  const existingDraft = await CollectedPhone.findOne({ sourceId: new Types.ObjectId(sourceId), providerRecordId, status: { $in: ['pending', 'needs_review', 'failed'] } }, { _id: 1, checksum: 1 }).lean();
  if (existingDraft) {
    await CollectedPhone.updateOne({ _id: existingDraft._id }, { $set: data });
  } else {
    await CollectedPhone.create(data);
  }
  return { isNew: !dupResult.isDuplicate, isPossibleUpdate: dupResult.isDuplicate, isDuplicate: dupResult.isDuplicate, conflicts: conflicts.length };
}

// ============ APPROVE AND IMPORT ============
export async function approveAndImport(draftId: string, adminEdits?: Record<string, unknown>): Promise<{ success: boolean; phoneId?: string; error?: string }> {
  const draft = await CollectedPhone.findById(draftId);
  if (!draft) return { success: false, error: 'Draft not found' };

  // Apply admin edits if provided
  if (adminEdits) {
    for (const [key, value] of Object.entries(adminEdits)) {
      if (key === 'brandName' || key === 'model' || key === 'slug' || key === 'releaseDate' || key === 'thumbnail' || key === 'description') {
        (draft as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  await connectDB();

  // Resolve or create brand
  let brand = await Brand.findOne({ name: new RegExp(`^${draft.brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
  if (!brand) {
    brand = await Brand.create({
      name: draft.brandName,
      slug: generateSlug(draft.brandName),
      logo: '',
      country: '',
      description: `${draft.brandName} smartphones`,
    });
  }

  const brandId = brand._id as Types.ObjectId;
  const isUpdate = draft.duplicatePhoneId && Types.ObjectId.isValid(draft.duplicatePhoneId);
  let phoneId: string;

  const phoneData: Record<string, unknown> = {
    modelName: draft.model,
    slug: draft.slug,
    brandId,
    pricePKR: draft.pakistanPrice || 0,
    ptaStatus: draft.ptaStatus || 'Unknown',
    ptaApproved: draft.ptaApproved || false,
    thumbnail: draft.thumbnail || '',
    description: '',
    releaseDate: draft.releaseDate || '',
    seoTitle: draft.suggestedSeoTitle || '',
    seoDescription: draft.suggestedSeoDescription || '',
    keywords: draft.suggestedKeywords || '',
    // Approval imports the record for an editorial pass. Publishing stays an
    // explicit admin action so incomplete collector data cannot leak publicly.
    status: 'draft',
    active: true,
  };

  if (isUpdate) {
    await Phone.updateOne({ _id: draft.duplicatePhoneId }, { $set: phoneData });
    phoneId = draft.duplicatePhoneId;
  } else {
    const newPhone = await Phone.create(phoneData);
    phoneId = newPhone._id.toString();
  }

  // Specs
  const specsData: Record<string, unknown> = {};
  if (draft.display?.size) specsData.display = `${draft.display.type ? draft.display.type + ' ' : ''}${draft.display.size}`;
  if (draft.display?.type) specsData.displayType = draft.display.type;
  if (draft.display?.resolution) specsData.resolution = draft.display.resolution;
  if (draft.display?.refreshRate) specsData.refreshRate = draft.display.refreshRate;
  if (draft.display?.brightness) specsData.brightness = draft.display.brightness;
  if (draft.display?.protection) specsData.protection = draft.display.protection;
  if (draft.processor?.chipset) specsData.chipset = draft.processor.chipset;
  if (draft.processor?.cpu) specsData.cpu = draft.processor.cpu;
  if (draft.processor?.gpu) specsData.gpu = draft.processor.gpu;
  if (draft.processor?.process) specsData.process = draft.processor.process;
  if (draft.memory?.ram) specsData.ram = draft.memory.ram;
  if (draft.memory?.ramType) specsData.ramType = draft.memory.ramType;
  if (draft.memory?.storage) specsData.storage = draft.memory.storage;
  if (draft.memory?.cardSlot) specsData.cardSlot = draft.memory.cardSlot;
  if (draft.camera?.rearModules) specsData.mainCamera = draft.camera.rearModules;
  if (draft.camera?.frontCamera) specsData.selfieCamera = draft.camera.frontCamera;
  if (draft.camera?.aperture) specsData.aperture = draft.camera.aperture;
  if (draft.camera?.ois) specsData.ois = draft.camera.ois;
  if (draft.camera?.videoRecording) specsData.videoRecording = draft.camera.videoRecording;
  if (draft.battery?.capacity) specsData.battery = draft.battery.capacity;
  if (draft.battery?.wiredCharging) specsData.charging = draft.battery.wiredCharging;
  if (draft.battery?.wirelessCharging) specsData.wirelessCharge = draft.battery.wirelessCharging;
  if (draft.battery?.reverseCharging) specsData.reverseCharge = draft.battery.reverseCharging;
  if (draft.body?.dimensions) specsData.dimensions = draft.body.dimensions;
  if (draft.body?.weight) specsData.weight = draft.body.weight;
  if (draft.body?.build) specsData.build = draft.body.build;
  if (draft.body?.sim) specsData.sim = draft.body.sim;
  if (draft.body?.waterResistance) specsData.ipRating = draft.body.waterResistance;
  if (draft.body?.colors) specsData.colors = draft.body.colors;
  if (draft.connectivity?.network) specsData.network = draft.connectivity.network;
  if (draft.connectivity?.fiveG) specsData.fiveG = draft.connectivity.fiveG;
  if (draft.connectivity?.wifi) specsData.wifi = draft.connectivity.wifi;
  if (draft.connectivity?.bluetooth) specsData.bluetooth = draft.connectivity.bluetooth;
  if (draft.connectivity?.nfc) specsData.nfc = draft.connectivity.nfc;
  if (draft.connectivity?.usb) specsData.usb = draft.connectivity.usb;
  if (draft.connectivity?.infrared) specsData.infrared = draft.connectivity.infrared;
  if (draft.sensors?.fingerprint) specsData.fingerprint = draft.sensors.fingerprint;
  if (draft.sensors?.others) specsData.sensors = draft.sensors.others;
  if (draft.software?.os) specsData.os = draft.software.os;
  if (draft.software?.osVersion) specsData.osVersion = draft.software.osVersion;
  if (draft.software?.osUI) specsData.osUI = draft.software.osUI;
  if (draft.software?.updatePolicy) specsData.updatePolicy = draft.software.updatePolicy;
  if (draft.audio?.speakers) specsData.specialFeatures = draft.audio.speakers;

  if (Object.keys(specsData).length > 0) {
    await PhoneSpecs.updateOne({ phoneId }, { $set: specsData }, { upsert: true });
  }

  // Benchmarks
  if (draft.benchmarks) {
    const benchData: Record<string, unknown> = {};
    if (draft.benchmarks.antutu) benchData.antutu = draft.benchmarks.antutu;
    if (draft.benchmarks.geekbenchSingle) benchData.geekbenchSingle = draft.benchmarks.geekbenchSingle;
    if (draft.benchmarks.geekbenchMulti) benchData.geekbenchMulti = draft.benchmarks.geekbenchMulti;
    if (draft.benchmarks.gamingScore) benchData.gamingScore = draft.benchmarks.gamingScore;
    if (draft.benchmarks.pubgFps) benchData.pubgFps = draft.benchmarks.pubgFps;
    if (draft.benchmarks.codMobileFps) benchData.codMobileFps = draft.benchmarks.codMobileFps;
    if (draft.benchmarks.genshinFps) benchData.genshinFps = draft.benchmarks.genshinFps;
    if (Object.keys(benchData).length > 0) {
      await PhoneBenchmark.updateOne({ phoneId }, { $set: benchData }, { upsert: true });
    }
  }

  // Images
  if (draft.images && draft.images.length > 0) {
    await PhoneImage.deleteMany({ phoneId });
    await PhoneImage.insertMany(
      draft.images.map((url: string, idx: number) => ({ phoneId, url, altText: `${draft.model} image ${idx + 1}`, sortOrder: idx }))
    );
  }

  // Update draft status
  await CollectedPhone.updateOne({ _id: draftId }, {
    $set: { status: 'imported', importedPhoneId: phoneId },
  });

  await ActivityLog.create({
    action: 'collector_import',
    details: `Imported ${draft.brandName} ${draft.model} (${isUpdate ? 'updated' : 'new'}) from collector`,
    entityType: 'collector',
    entityId: draftId,
  });

  return { success: true, phoneId };
}

// ============ HELPER ============
function buildProviderConfig(source: Record<string, unknown>): ProviderConfig {
  const headers = toStringRecord(source.headers);
  const mappingRules = toStringRecord(source.mappingRules);
  return {
    type: source.type as ProviderType,
    endpoint: (source.endpoint as string) || '',
    apiKeyEnvVar: (source.apiKeyEnvVar as string) || '',
    apiKeyHeader: (source.apiKeyHeader as string) || '',
    headers,
    brandFilter: (source.brandFilter as string[]) || [],
    countryFilter: (source.countryFilter as string) || '',
    region: (source.region as string) || '',
    dataPath: (source.dataPath as string) || '',
    mappingRules,
    allowedDomains: (source.allowedDomains as string[]) || [],
    timeoutMs: (source.timeoutMs as number) || 30000,
    maxResponseBytes: (source.maxResponseBytes as number) || 5 * 1024 * 1024,
    defaultValues: Object.fromEntries(Object.entries((source.defaultValues as Record<string, unknown>) || {})),
    pagination: {
      pageSize: (source.paginationPageSize as number) || 50,
      maxPages: (source.paginationMaxPages as number) || 10,
      pageParam: (source.paginationPageParam as string) || 'page',
    },
    enabled: source.enabled as boolean,
    parserId: String(source.parserId || 'auto'),
    maxProductPages: Number(source.maxProductPages || 20),
  };
}
