import { CollectorSource, CollectedPhone, CollectorJob, Phone, Brand, PhoneSpecs, PhoneImage, PhoneBenchmark, ActivityLog } from '@/lib/models';
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';
import { createProvider, ProviderFetchResult } from './providers';
import { NormalizedPhone } from './types';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance } from './services';
import { generateSlug } from '@/lib/import/validators';

const BATCH_SIZE = 25;
const MAX_COLLECT_PER_JOB = 2000;

// ============ JOB RUNNER ============
export async function startJob(jobId: string): Promise<void> {
  const job = await CollectorJob.findById(jobId);
  if (!job) return;

  await CollectorJob.updateOne({ _id: jobId }, { $set: { status: 'running', startedAt: new Date() } });

  try {
    if (job.sourceId) {
      const source = await CollectorSource.findById(job.sourceId);
      if (!source) throw new Error('Source not found');
      if (!source.enabled) throw new Error('Source is disabled');

      const config = buildProviderConfig(source);
      const provider = createProvider(config, (source._id as any).toString(), source.name);

      let page = 1;
      let hasNext = true;
      let totalFetched = 0;

      const existingPhones = await Phone.find({ active: true }, { modelName: 1, slug: 1, brandId: 1 }).populate({ path: 'brand', select: 'name' }).lean();
      const existingWithBrand = existingPhones.map((p: any) => ({
        _id: p._id, modelName: p.modelName, slug: p.slug,
        brand: p.brand ? { name: p.brand.name } : undefined,
        weight: '', battery: '', display: '', chipset: '', os: '', pricePKR: 0,
      }));

      while (hasNext && totalFetched < MAX_COLLECT_PER_JOB) {
        // Check if job was paused
        const currentJob = await CollectorJob.findById(jobId);
        if (!currentJob || currentJob.status === 'paused') {
          await CollectorJob.updateOne({ _id: jobId }, { $set: { status: 'paused', lastProcessedAt: new Date() } });
          return;
        }

        const result: ProviderFetchResult = await provider.fetch(page);

        for (const phone of result.phones) {
          await processCollectedPhone(phone, config, (source._id as any).toString(), source.name, source.endpoint || '', existingWithBrand, (job._id as any).toString(), source.reliabilityScore);
        }

        totalFetched += result.phones.length;
        const fetchedCount = result.phones.length;
        let actualNewCount = 0;
        for (const phone of result.phones) {
          const isDuplicate = existingWithBrand.some((ep: any) => ep.slug === phone.slug);
          if (!isDuplicate) actualNewCount++;
        }

        await CollectorJob.updateOne({ _id: jobId }, {
          $inc: {
            fetched: fetchedCount,
            normalized: fetchedCount,
            newPhones: actualNewCount,
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
          $set: { lastSyncAt: new Date(), lastSyncStatus: result.providerErrors.length > 0 ? 'partial' : 'success' },
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
  } catch (e: any) {
    await CollectorJob.updateOne({ _id: jobId }, {
      $set: { status: 'failed', lastError: e.message, completedAt: new Date() },
    });
    await ActivityLog.create({
      action: 'collector_sync_failed',
      details: `Job ${jobId} failed: ${e.message}`,
      entityType: 'collector',
      entityId: jobId,
    });
  }
}

// ============ PROCESS SINGLE PHONE ============
async function processCollectedPhone(
  phone: NormalizedPhone,
  config: any,
  sourceId: string,
  sourceName: string,
  sourceUrl: string,
  existingPhones: any[],
  jobId: string,
  reliability: number,
): Promise<void> {
  // Validate
  const issues = validateCollectedPhone(phone);
  const isValid = !issues.some(i => i.severity === 'error');

  // Detect duplicates
  const dupResult = detectDuplicates(phone, existingPhones);

  // Detect conflicts with best match
  const conflicts: any[] = [];
  if (dupResult.matches.length > 0) {
    const bestMatch = dupResult.matches[0];
    const existingPhone = existingPhones.find((p: any) => p._id.toString() === bestMatch.phoneId);
    if (existingPhone) {
      const conflictList = detectConflicts(phone, existingPhone, sourceName);
      conflicts.push(...conflictList);
    }
  }

  // Suggest category and SEO
  const categories = suggestCategory(phone);
  const seo = suggestSEO(phone);

  // Build provenance
  const fieldProvenance = buildFieldProvenance(phone, sourceId, sourceName, sourceUrl, reliability);

  // Determine status
  let status: 'pending' | 'needs_review' | 'approved' | 'rejected' | 'imported' | 'failed' = 'pending';
  if (!isValid) status = 'needs_review';
  else if (dupResult.isDuplicate && conflicts.length > 0) status = 'needs_review';
  else if (dupResult.isDuplicate) status = 'needs_review';

  await CollectedPhone.create({
    status,
    brandName: phone.brandName,
    model: phone.model,
    slug: phone.slug,
    releaseDate: phone.releaseDate || '',
    announcedDate: phone.announcedDate || '',
    availability: phone.availability || '',
    deviceStatus: phone.deviceStatus || '',
    deviceType: phone.deviceType || '',
    display: phone.display || {},
    processor: phone.processor || {},
    memory: phone.memory || {},
    camera: phone.camera || {},
    battery: phone.battery || {},
    body: phone.body || {},
    connectivity: phone.connectivity || {},
    software: phone.software || {},
    audio: phone.audio || {},
    sensors: phone.sensors || {},
    benchmarks: phone.benchmarks || {},
    images: phone.images || [],
    thumbnail: phone.thumbnail || '',
    pakistanPrice: phone.pakistanPrice ?? null,
    ptaApproved: phone.ptaApproved ?? null,
    ptaStatus: phone.ptaStatus || '',
    suggestedCategory: categories.join(', '),
    suggestedSeoTitle: seo.title,
    suggestedSeoDescription: seo.description,
    suggestedKeywords: seo.keywords,
    sourceId: new Types.ObjectId(sourceId),
    sourceName,
    sourceUrl,
    providerRecordId: phone.slug || '',
    fieldProvenance,
    duplicateMatches: dupResult.matches.map(m => ({
      type: m.type, phoneId: m.phoneId || '', modelName: m.modelName || '',
      brandName: m.brandName || '', slug: m.slug || '', confidence: m.confidence,
    })),
    hasExactDuplicate: dupResult.matches.some(m => m.type === 'exact_slug'),
    duplicatePhoneId: dupResult.matches[0]?.phoneId || '',
    conflicts,
    conflictCount: conflicts.length,
    validationIssues: issues.map(i => `${i.severity}: ${i.field} - ${i.message}`),
    isValid,
    jobId: new Types.ObjectId(jobId),
    sourceReliability: reliability,
  });
}

// ============ APPROVE AND IMPORT ============
export async function approveAndImport(draftId: string, adminEdits?: any): Promise<{ success: boolean; phoneId?: string; error?: string }> {
  const draft = await CollectedPhone.findById(draftId);
  if (!draft) return { success: false, error: 'Draft not found' };

  // Apply admin edits if provided
  if (adminEdits) {
    for (const [key, value] of Object.entries(adminEdits)) {
      if (key === 'brandName' || key === 'model' || key === 'slug' || key === 'releaseDate' || key === 'thumbnail' || key === 'description') {
        (draft as any)[key] = value;
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

  const phoneData: Record<string, any> = {
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
    status: 'published',
    active: true,
  };

  if (isUpdate) {
    await Phone.updateOne({ _id: draft.duplicatePhoneId }, { $set: phoneData });
    phoneId = draft.duplicatePhoneId;
  } else {
    const newPhone = await Phone.create(phoneData);
    phoneId = (newPhone._id as any).toString();
  }

  // Specs
  const specsData: Record<string, any> = {};
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
    const benchData: Record<string, any> = {};
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
function buildProviderConfig(source: any): any {
  const headers: Record<string, string> = {};
  if (source.headers) {
    for (const [k, v] of Object.entries(source.headers)) headers[k] = v as string;
  }
  const mappingRules: Record<string, string> = {};
  if (source.mappingRules) {
    for (const [k, v] of Object.entries(source.mappingRules)) mappingRules[k] = v as string;
  }
  return {
    type: source.type,
    endpoint: source.endpoint || '',
    apiKeyEnvVar: source.apiKeyEnvVar || '',
    headers,
    brandFilter: source.brandFilter || [],
    countryFilter: source.countryFilter || '',
    region: source.region || '',
    dataPath: source.dataPath || '',
    mappingRules,
    pagination: {
      pageSize: source.paginationPageSize || 50,
      maxPages: source.paginationMaxPages || 10,
      pageParam: source.paginationPageParam || 'page',
    },
    enabled: source.enabled,
  };
}