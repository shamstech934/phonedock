import mongoose from 'mongoose';
import { AIResearchDraft, AIResearchJob, Phone } from '@/lib/models';
import { generateEnrichmentSuggestions, getAIStatus, type EnrichmentType } from '@/lib/ai-enrichment';

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

export async function processAIResearchJob(jobId: string) {
  const job = await AIResearchJob.findById(jobId);
  if (!job) throw new Error('AI research job not found');
  if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(job.status)) {
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 0 };
  }

  const type = job.type as EnrichmentType;
  const providerStatus = getAIStatus();
  if (!providerStatus.configured[type]) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.failures.push({ message: `AI enrichment for "${type}" is not configured`, attempts: 1 });
    job.failed = Math.max(Number(job.failed || 0), 1);
    await job.save();
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 1 };
  }

  const start = Math.max(0, Number(job.cursor || 0));
  const batchSize = Math.min(10, Math.max(1, Number(job.batchSize || 3)));
  const ids = (job.phoneIds || []).slice(start, start + batchSize);
  if (ids.length === 0) {
    job.status = Number(job.failed || 0) > 0 ? 'completed_with_errors' : 'completed';
    job.completedAt = new Date();
    await job.save();
    return { job, processedThisRun: 0, generatedThisRun: 0, failuresThisRun: 0 };
  }

  job.status = 'running';
  job.startedAt ||= new Date();
  job.lastRunAt = new Date();
  await job.save();

  const phones = await Phone.find({ _id: { $in: ids } }).populate('brand', 'name').lean() as unknown as LeanPhone[];
  const phoneMap = new Map(phones.map(phone => [String(phone._id), phone]));
  let generatedThisRun = 0;
  let failuresThisRun = 0;

  for (const id of ids) {
    const phone = phoneMap.get(String(id));
    if (!phone) {
      job.failures.push({ phoneId: id, message: 'Phone no longer exists', attempts: 1 });
      failuresThisRun++;
      continue;
    }

    try {
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
  job.failed = Number(job.failed || 0) + failuresThisRun;
  job.lastRunAt = new Date();
  if (job.cursor >= job.phoneIds.length) {
    job.status = Number(job.failed || 0) > 0 ? (Number(job.generated || 0) > 0 ? 'completed_with_errors' : 'failed') : 'completed';
    job.completedAt = new Date();
  } else {
    job.status = 'queued';
  }
  await job.save();

  return { job, processedThisRun: ids.length, generatedThisRun, failuresThisRun };
}
