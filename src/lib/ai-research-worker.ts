import mongoose from 'mongoose';
import { AIResearchDraft, AIResearchJob, Phone } from '@/lib/models';
import { generateEnrichmentSuggestions, getAIStatus, type EnrichmentType } from '@/lib/ai-enrichment';
import { getAIResearchPolicy } from '@/lib/ai-research-policy';

type LeanPhone = {
  _id: mongoose.Types.ObjectId;
  modelName: string;
  slug?: string;
  brand?: { name?: string } | mongoose.Types.ObjectId | null;
};

function brandNameOf(phone: LeanPhone): string {
  const brand = phone.brand;
  return brand && typeof brand === 'object' && 'name' in brand ? String(brand.name || '') : '';
}

function trimFailures(job: { failures: unknown[] }, max: number) {
  if (job.failures.length > max) job.failures = job.failures.slice(-max);
}

export async function processAIResearchJob(jobId: string) {
  const policy = getAIResearchPolicy();
  if (!policy.enabled) throw new Error('AI Research is disabled by AI_RESEARCH_MODE=off');

  const now = new Date();
  const lockUntil = new Date(now.getTime() + 90_000);
  const job = await AIResearchJob.findOneAndUpdate(
    {
      _id: jobId,
      status: { $in: ['queued', 'running', 'paused'] },
      $and: [
        { $or: [{ lockUntil: { $exists: false } }, { lockUntil: null }, { lockUntil: { $lte: now } }] },
        { $or: [{ nextRunAfter: { $exists: false } }, { nextRunAfter: null }, { nextRunAfter: { $lte: now } }] },
      ],
    },
    { $set: { status: 'running', lockUntil, lastRunAt: now } },
    { new: true },
  );

  if (!job) {
    const existing = await AIResearchJob.findById(jobId).lean();
    if (!existing) throw new Error('AI research job not found');
    if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(String(existing.status))) {
      return { job: existing, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 0, skippedThisRun: 0, throttled: false };
    }
    return { job: existing, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 0, skippedThisRun: 0, throttled: true };
  }

  const type = job.type as EnrichmentType;
  const providerStatus = getAIStatus();
  if (!providerStatus.configured[type]) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.lockUntil = undefined;
    job.failures.push({ message: `AI enrichment for "${type}" is not configured`, attempts: 1 });
    job.failed = Math.max(Number(job.failed || 0), 1);
    trimFailures(job, policy.maxFailuresStored);
    await job.save();
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 1, skippedThisRun: 0, throttled: false };
  }

  if (Number(job.providerCalls || 0) >= Number(job.maxProviderCalls || policy.maxProviderCallsPerJob)) {
    job.status = Number(job.generated || 0) > 0 ? 'completed_with_errors' : 'failed';
    job.completedAt = new Date();
    job.lockUntil = undefined;
    job.failures.push({ message: 'Provider-call budget reached before all phones were processed', attempts: 1 });
    trimFailures(job, policy.maxFailuresStored);
    await job.save();
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 1, skippedThisRun: 0, throttled: false };
  }

  const start = Math.max(0, Number(job.cursor || 0));
  const batchSize = Math.min(policy.batchSize, Math.max(1, Number(job.batchSize || policy.batchSize)));
  const ids = (job.phoneIds || []).slice(start, start + batchSize);
  if (ids.length === 0) {
    job.status = Number(job.failed || 0) > 0 ? 'completed_with_errors' : 'completed';
    job.completedAt = new Date();
    job.lockUntil = undefined;
    await job.save();
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 0, skippedThisRun: 0, throttled: false };
  }

  job.startedAt ||= new Date();
  const phones = await Phone.find({ _id: { $in: ids } }).populate('brand', 'name').lean() as unknown as LeanPhone[];
  const phoneMap = new Map(phones.map(phone => [String(phone._id), phone]));
  let generatedThisRun = 0;
  let failuresThisRun = 0;
  let skippedThisRun = 0;

  for (const id of ids) {
    const phone = phoneMap.get(String(id));
    if (!phone) {
      job.failures.push({ phoneId: id, message: 'Phone no longer exists', attempts: 1 });
      failuresThisRun++;
      continue;
    }

    const freshSince = new Date(Date.now() - policy.draftFreshHours * 60 * 60 * 1000);
    const existingDraft = await AIResearchDraft.findOne({
      phoneId: phone._id,
      type,
      status: 'pending_review',
      updatedAt: { $gte: freshSince },
    }).select('_id').lean();
    if (existingDraft) {
      skippedThisRun++;
      continue;
    }

    if (Number(job.providerCalls || 0) >= Number(job.maxProviderCalls || policy.maxProviderCallsPerJob)) {
      skippedThisRun += ids.length - generatedThisRun - failuresThisRun - skippedThisRun;
      break;
    }

    try {
      job.providerCalls = Number(job.providerCalls || 0) + 1;
      const suggestions = await generateEnrichmentSuggestions(type, [{
        id: String(phone._id),
        brand: brandNameOf(phone),
        model: phone.modelName,
        slug: phone.slug,
      }]);
      const suggestion = suggestions[0];
      if (!suggestion) throw new Error('No usable data generated for this phone');

      await AIResearchDraft.findOneAndUpdate(
        { phoneId: phone._id, type, status: 'pending_review' },
        {
          $set: {
            jobId: job._id,
            brand: suggestion.brand,
            model: suggestion.model,
            confidence: suggestion.confidence,
            sourceNotes: suggestion.sourceNotes,
            sources: suggestion.sources || [],
            conflicts: suggestion.conflicts || [],
            specs: suggestion.specs,
            images: suggestion.images,
            price: suggestion.price,
            createdBy: job.createdBy,
          },
          $setOnInsert: { phoneId: phone._id, type, status: 'pending_review' },
        },
        { upsert: true, new: true },
      );
      generatedThisRun++;
    } catch (error) {
      job.failures.push({
        phoneId: phone._id,
        message: error instanceof Error ? error.message.slice(0, 1000) : 'AI enrichment failed',
        attempts: 1,
      });
      failuresThisRun++;
    }
  }

  job.cursor = start + ids.length;
  job.processed = Math.min(Number(job.total || job.phoneIds.length), Number(job.processed || 0) + ids.length);
  job.generated = Number(job.generated || 0) + generatedThisRun;
  job.skipped = Number(job.skipped || 0) + skippedThisRun;
  job.failed = Number(job.failed || 0) + failuresThisRun;
  job.lastRunAt = new Date();
  job.lockUntil = undefined;
  trimFailures(job, policy.maxFailuresStored);

  if (job.cursor >= job.phoneIds.length || Number(job.providerCalls || 0) >= Number(job.maxProviderCalls || policy.maxProviderCallsPerJob)) {
    job.status = Number(job.failed || 0) > 0
      ? (Number(job.generated || 0) > 0 ? 'completed_with_errors' : 'failed')
      : 'completed';
    job.completedAt = new Date();
  } else {
    job.status = 'queued';
    job.nextRunAfter = new Date(Date.now() + policy.cooldownSeconds * 1000);
  }
  await job.save();

  return { job, processedThisRun: ids.length, generatedThisRun, failuresThisRun, skippedThisRun, throttled: false };
}
