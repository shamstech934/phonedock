import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Phone, PhoneSpecs, PhoneImage, PhonePrice, ActivityLog, AIResearchJob, AIResearchDraft } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { getAIStatus, type EnrichmentType } from '@/lib/ai-enrichment';
import { processAIResearchJob } from '@/lib/ai-research-worker';
import { parseBoundedInt } from '@/lib/http';
import { getAIResearchPolicy } from '@/lib/ai-research-policy';

const VALID_TYPES: EnrichmentType[] = ['specs', 'images', 'prices'];

// ============ GET ============

export async function handleAiResearchGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments[0] !== 'admin' || segments[1] !== 'ai-research') return undefined;

  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
  const permCheck = requirePermission(admin, 'ai-research:read'); if (permCheck) return permCheck;
  await connectDB();

  // ---- /api/admin/ai-research/status ----
  if (segments.length === 3 && segments[2] === 'status') {
    return NextResponse.json({ ...getAIStatus(), policy: getAIResearchPolicy() });
  }

  // ---- /api/admin/ai-research/jobs ----
  if (segments.length === 3 && segments[2] === 'jobs') {
    const url = new URL(req.url);
    const page = parseBoundedInt(url.searchParams.get('page'), 1, { min: 1, max: 10000 });
    const limit = parseBoundedInt(url.searchParams.get('limit'), 20, { min: 1, max: 100 });
    const [jobs, total] = await Promise.all([
      AIResearchJob.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AIResearchJob.countDocuments(),
    ]);
    return NextResponse.json({ jobs, total, page, limit });
  }

  // ---- /api/admin/ai-research/drafts ----
  if (segments.length === 3 && segments[2] === 'drafts') {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'pending_review';
    const type = url.searchParams.get('type');
    const page = parseBoundedInt(url.searchParams.get('page'), 1, { min: 1, max: 10000 });
    const limit = parseBoundedInt(url.searchParams.get('limit'), 20, { min: 1, max: 100 });
    const filter: Record<string, unknown> = {};
    if (status !== 'all') filter.status = status;
    if (type && VALID_TYPES.includes(type as EnrichmentType)) filter.type = type;
    const [drafts, total] = await Promise.all([
      AIResearchDraft.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('phoneId', 'modelName slug thumbnail').lean(),
      AIResearchDraft.countDocuments(filter),
    ]);
    return NextResponse.json({ drafts, total, page, limit });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ============ POST ============

export async function handleAiResearchPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments[0] !== 'admin' || segments[1] !== 'ai-research') return undefined;

  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
  const permCheck = requirePermission(admin, 'ai-research:execute'); if (permCheck) return permCheck;
  await connectDB();

  // ---- /api/admin/ai-research/jobs (create a bounded queued job) ----
  if (segments.length === 3 && segments[2] === 'jobs') {
    const body = await req.json();
    const policy = getAIResearchPolicy();
    if (!policy.enabled) return NextResponse.json({ error: 'AI Research is disabled by AI_RESEARCH_MODE=off' }, { status: 409 });
    const type = String(body.type || '') as EnrichmentType;
    const rawIds: string[] = Array.isArray(body.phoneIds) ? body.phoneIds : [];
    const phoneIds = [...new Set(rawIds.filter(id => mongoose.isValidObjectId(id)).slice(0, policy.maxPhonesPerJob))];
    const batchSize = Math.min(policy.batchSize, Math.max(1, Number(body.batchSize || policy.batchSize)));
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'type must be one of specs, images, prices' }, { status: 400 });
    if (phoneIds.length === 0) return NextResponse.json({ error: `phoneIds is required (max ${policy.maxPhonesPerJob} per job)` }, { status: 400 });

    const status = getAIStatus();
    if (!status.configured[type]) {
      return NextResponse.json({ error: `AI enrichment for "${type}" is not configured. Set the required provider/API keys first.` }, { status: 409 });
    }

    const existingIds = await Phone.find({ _id: { $in: phoneIds } }).distinct('_id');
    if (existingIds.length === 0) return NextResponse.json({ error: 'No matching phones found' }, { status: 404 });

    const job = await AIResearchJob.create({
      type,
      status: 'queued',
      mode: policy.mode === 'standard' ? 'standard' : 'lite',
      phoneIds: existingIds,
      total: existingIds.length,
      batchSize,
      cursor: 0,
      processed: 0,
      generated: 0,
      skipped: 0,
      failed: 0,
      providerCalls: 0,
      maxProviderCalls: policy.maxProviderCallsPerJob,
      createdBy: admin._id,
    });

    try { await ActivityLog.create({ adminId: admin._id, action: 'ai_research_job_queued', details: `Queued ${type} research for ${existingIds.length} phone(s)`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, jobId: job._id, status: job.status, total: job.total, batchSize: job.batchSize, mode: job.mode, maxProviderCalls: job.maxProviderCalls });
  }

  // ---- /api/admin/ai-research/jobs/:id/run (one serverless-safe batch) ----
  if (segments.length === 5 && segments[2] === 'jobs' && segments[4] === 'run') {
    const job = await AIResearchJob.findById(segments[3]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status === 'cancelled') return NextResponse.json({ error: 'Job is cancelled' }, { status: 409 });
    const result = await processAIResearchJob(String(job._id));
    return NextResponse.json({
      success: true,
      jobId: result.job._id,
      status: result.job.status,
      total: result.job.total,
      processed: result.job.processed,
      generated: result.job.generated,
      failed: result.job.failed,
      skipped: result.job.skipped,
      providerCalls: result.job.providerCalls,
      maxProviderCalls: result.job.maxProviderCalls,
      nextRunAfter: result.job.nextRunAfter,
      cursor: result.job.cursor,
      processedThisRun: result.processedThisRun,
      generatedThisRun: result.generatedThisRun,
      failuresThisRun: result.failuresThisRun,
      skippedThisRun: result.skippedThisRun,
      throttled: result.throttled,
    }, { status: result.throttled ? 429 : 200 });
  }

  // ---- /api/admin/ai-research/jobs/:id/cancel ----
  if (segments.length === 5 && segments[2] === 'jobs' && segments[4] === 'cancel') {
    const job = await AIResearchJob.findById(segments[3]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (['completed', 'completed_with_errors', 'failed'].includes(job.status)) return NextResponse.json({ error: `Job already ${job.status}` }, { status: 409 });
    job.status = 'cancelled';
    job.completedAt = new Date();
    await job.save();
    return NextResponse.json({ success: true, jobId: job._id, status: job.status });
  }

  // ---- /api/admin/ai-research/drafts/:id/approve ----
  if (segments.length === 5 && segments[2] === 'drafts' && segments[4] === 'approve') {
    const draft = await AIResearchDraft.findById(segments[3]);
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'pending_review') return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });

    const publishResult: { specs?: boolean; image?: boolean; price?: boolean; message?: string } = {};
    try {
      if (draft.type === 'specs' && draft.specs) {
        const setFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(draft.specs.toObject ? draft.specs.toObject() : draft.specs)) {
          if (value !== undefined && value !== null && value !== '') setFields[key] = value;
        }
        if (Object.keys(setFields).length > 0) {
          await PhoneSpecs.findOneAndUpdate({ phoneId: draft.phoneId }, { $set: { ...setFields, phoneId: draft.phoneId } }, { upsert: true });
          publishResult.specs = true;
        } else {
          publishResult.specs = false; publishResult.message = 'No non-empty spec fields to apply';
        }
      } else if (draft.type === 'images' && Array.isArray(draft.images) && draft.images.length > 0) {
        const existingCount = await PhoneImage.countDocuments({ phoneId: draft.phoneId });
        await PhoneImage.insertMany(draft.images.map((img: { url: string; sourceUrl?: string; title?: string }, i: number) => ({ phoneId: draft.phoneId, url: img.url, altText: img.title || '', sortOrder: existingCount + i })));
        publishResult.image = true;
      } else if (draft.type === 'prices' && draft.price?.valuePKR) {
        await PhonePrice.create({ phoneId: draft.phoneId, storeName: draft.price.sourceName || 'AI Research', price: draft.price.valuePKR, url: draft.price.sourceUrl || '', inStock: true });
        publishResult.price = true;
      } else {
        publishResult.message = 'Nothing usable in this draft to apply';
      }
    } catch (err: unknown) {
      return NextResponse.json({ error: `Failed to apply draft: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 });
    }

    draft.status = 'approved'; draft.reviewedBy = admin._id; draft.reviewedAt = new Date();
    draft.publishResult = publishResult as typeof draft.publishResult;
    await draft.save();

    try { await ActivityLog.create({ adminId: admin._id, action: 'ai_research_approve', details: `Approved AI ${draft.type} draft for phone ${draft.phoneId}`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, publishResult });
  }

  // ---- /api/admin/ai-research/drafts/:id/reject ----
  if (segments.length === 5 && segments[2] === 'drafts' && segments[4] === 'reject') {
    const draft = await AIResearchDraft.findById(segments[3]);
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'pending_review') return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });
    draft.status = 'rejected'; draft.reviewedBy = admin._id; draft.reviewedAt = new Date();
    await draft.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'ai_research_reject', details: `Rejected AI ${draft.type} draft for phone ${draft.phoneId}`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
