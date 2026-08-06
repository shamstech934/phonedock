import mongoose from 'mongoose';
import { Brand, DeviceSpecDataset, Phone, PhoneSpecs, SpecsIntelligenceScanJob, SpecsIntelligenceSignal } from '@/lib/models';

const FIELDS = ['display','chipset','ram','storage','battery','mainCamera','fiveG'] as const;
const CRITICAL = new Set<string>(['display','chipset','ram','storage','battery']);
const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const PHONE_SCOPE = { deletedAt: null, active: true } as const;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;
const LEASE_MS = 45_000;

type JobLike = any;

function publicJob(job: JobLike) {
  return {
    id: String(job._id), status: job.status, totalCount: job.totalCount || 0,
    processedCount: job.processedCount || 0, openedCount: job.openedCount || 0,
    withRecommendationCount: job.withRecommendationCount || 0, failedCount: job.failedCount || 0,
    batchSize: job.batchSize || DEFAULT_BATCH_SIZE, lastError: job.lastError || '',
    startedAt: job.startedAt, completedAt: job.completedAt, lastHeartbeatAt: job.lastHeartbeatAt,
    progress: job.totalCount > 0 ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 100)) : 0,
  };
}

export async function getLatestSpecsIntelligenceJob() {
  const job = await SpecsIntelligenceScanJob.findOne().sort({ createdAt: -1 }).lean();
  return job ? publicJob(job) : null;
}

export async function startSpecsIntelligenceScan({ adminId, batchSize = DEFAULT_BATCH_SIZE }: { adminId?: unknown; batchSize?: number } = {}) {
  const active = await SpecsIntelligenceScanJob.findOne({ status: { $in: ['queued', 'running'] } }).sort({ createdAt: -1 });
  if (active) return processSpecsIntelligenceBatch({ jobId: String(active._id) });

  const safeBatchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(batchSize) || DEFAULT_BATCH_SIZE));
  const totalCount = await Phone.countDocuments(PHONE_SCOPE).maxTimeMS(5000);
  const job = await SpecsIntelligenceScanJob.create({
    status: 'queued', totalCount, processedCount: 0, batchSize: safeBatchSize,
    initiatedBy: adminId || null, startedAt: new Date(), lastHeartbeatAt: new Date(),
  });
  return processSpecsIntelligenceBatch({ jobId: String(job._id) });
}

export async function cancelSpecsIntelligenceScan(jobId: string) {
  const job = await SpecsIntelligenceScanJob.findByIdAndUpdate(jobId, {
    $set: { status: 'cancelled', completedAt: new Date(), leaseOwner: '', leaseExpiresAt: null },
  }, { new: true });
  return job ? publicJob(job) : null;
}

export async function processSpecsIntelligenceBatch({ jobId }: { jobId: string }) {
  if (!mongoose.isValidObjectId(jobId)) throw new Error('Invalid Specs Intelligence scan job id');
  const now = new Date();
  const leaseOwner = new mongoose.Types.ObjectId().toString();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);

  const job = await SpecsIntelligenceScanJob.findOneAndUpdate({
    _id: jobId,
    status: { $in: ['queued', 'running'] },
    $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
  }, {
    $set: { status: 'running', leaseOwner, leaseExpiresAt, lastHeartbeatAt: now, lastError: '' },
  }, { new: true });

  if (!job) {
    const existing = await SpecsIntelligenceScanJob.findById(jobId).lean();
    if (!existing) throw new Error('Specs Intelligence scan job not found');
    return { ...publicJob(existing), busy: existing.status === 'running' };
  }

  try {
    const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(job.batchSize) || DEFAULT_BATCH_SIZE));
    const cursorFilter = job.cursor && mongoose.isValidObjectId(job.cursor)
      ? { _id: { $gt: new mongoose.Types.ObjectId(job.cursor) } }
      : {};
    const phones: any[] = await Phone.find({ ...PHONE_SCOPE, ...cursorFilter })
      .select('_id modelName brandId')
      .sort({ _id: 1 })
      .limit(batchSize)
      .maxTimeMS(5000)
      .lean();

    if (phones.length === 0) {
      job.status = 'completed'; job.completedAt = new Date(); job.leaseOwner = ''; job.leaseExpiresAt = null;
      job.lastHeartbeatAt = new Date(); await job.save();
      return publicJob(job);
    }

    const phoneIds = phones.map(phone => phone._id);
    const brandIds = [...new Set(phones.map(phone => String(phone.brandId || '')).filter(Boolean))];
    const [specRows, brandRows] = await Promise.all([
      PhoneSpecs.find({ phoneId: { $in: phoneIds } }).select(`phoneId ${FIELDS.join(' ')}`).maxTimeMS(5000).lean(),
      Brand.find({ _id: { $in: brandIds } }).select('_id name').maxTimeMS(5000).lean(),
    ]);
    const specsByPhone = new Map(specRows.map((row: any) => [String(row.phoneId), row]));
    const brandById = new Map<string, string>(brandRows.map((row: any) => [String(row._id), String(row.name || '')] as [string, string]));

    const identities = phones.map(phone => ({
      phone, brand: brandById.get(String(phone.brandId)) || '', model: String(phone.modelName || ''),
      normalizedBrand: normalize(brandById.get(String(phone.brandId)) || ''), normalizedModel: normalize(String(phone.modelName || '')),
    }));
    const modelKeys = [...new Set(identities.map(item => item.normalizedModel).filter(Boolean))];
    const datasets: any[] = modelKeys.length
      ? await DeviceSpecDataset.find({ normalizedModel: { $in: modelKeys } }).select(`normalizedBrand normalizedModel ${FIELDS.join(' ')} sourceName sourceUrl`).maxTimeMS(5000).lean()
      : [];
    const exactDataset = new Map<string, any>();
    const modelDataset = new Map<string, any>();
    for (const dataset of datasets) {
      const modelKey = String(dataset.normalizedModel || '');
      const exactKey = `${String(dataset.normalizedBrand || '')}|${modelKey}`;
      if (!exactDataset.has(exactKey)) exactDataset.set(exactKey, dataset);
      if (!modelDataset.has(modelKey)) modelDataset.set(modelKey, dataset);
    }

    const operations: any[] = [];
    let opened = 0; let withRecommendation = 0;
    const seenAt = new Date();
    for (const item of identities) {
      const specs: any = specsByPhone.get(String(item.phone._id)) || null;
      const dataset = exactDataset.get(`${item.normalizedBrand}|${item.normalizedModel}`) || modelDataset.get(item.normalizedModel) || null;
      for (const field of FIELDS) {
        const current = String(specs?.[field] || '').trim();
        if (current) {
          operations.push({ updateOne: { filter: { phoneId: item.phone._id, field, status: 'open' }, update: { $set: { status: 'resolved', resolvedAt: seenAt, resolutionNotes: 'Field is now populated.' } } } });
          continue;
        }
        const recommended = String(dataset?.[field] || '').trim();
        if (recommended) withRecommendation++;
        opened++;
        operations.push({ updateOne: {
          filter: { phoneId: item.phone._id, field },
          update: { $set: {
            status: 'open', severity: CRITICAL.has(field) ? 'critical' : 'warning', currentValue: '', recommendedValue: recommended,
            sourceName: String(dataset?.sourceName || ''), sourceUrl: String(dataset?.sourceUrl || ''), confidence: recommended ? 85 : 25,
            evidence: { datasetMatched: Boolean(dataset), brand: item.brand, model: item.model }, lastSeenAt: seenAt,
            resolvedAt: null, resolutionNotes: '',
          }, $setOnInsert: { detectedAt: seenAt } }, upsert: true,
        } });
      }
    }
    if (operations.length) await SpecsIntelligenceSignal.bulkWrite(operations, { ordered: false });

    job.processedCount += phones.length;
    job.openedCount += opened;
    job.withRecommendationCount += withRecommendation;
    job.cursor = String(phones[phones.length - 1]._id);
    job.lastHeartbeatAt = new Date();
    job.leaseOwner = ''; job.leaseExpiresAt = null;
    if (phones.length < batchSize || job.processedCount >= job.totalCount) {
      job.status = 'completed'; job.completedAt = new Date();
    } else {
      job.status = 'queued';
    }
    await job.save();
    return publicJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Specs Intelligence scan error';
    await SpecsIntelligenceScanJob.findByIdAndUpdate(jobId, {
      $set: { status: 'failed', lastError: message.slice(0, 1000), completedAt: new Date(), leaseOwner: '', leaseExpiresAt: null, lastHeartbeatAt: new Date() },
      $inc: { failedCount: 1 },
    });
    throw error;
  }
}

// Backward-compatible bounded entry point. It processes one durable batch only.
export async function scanSpecsIntelligence({ limit = DEFAULT_BATCH_SIZE }: { limit?: number } = {}) {
  const result = await startSpecsIntelligenceScan({ batchSize: limit });
  return { scanned: result.processedCount, opened: result.openedCount, withRecommendation: result.withRecommendationCount, limit: result.batchSize, job: result };
}
