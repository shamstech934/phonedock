import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Phone, PhoneSpecs, PhoneImage, PhonePrice, ActivityLog, AIResearchJob, AIResearchDraft } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { getAIStatus, generateEnrichmentSuggestions, type EnrichmentType } from '@/lib/ai-enrichment';
import { parseBoundedInt } from '@/lib/http';

const VALID_TYPES: EnrichmentType[] = ['specs', 'images', 'prices'];

// ============ GET ============

export async function handleAiResearchGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  if (segments[0] !== 'admin' || segments[1] !== 'ai-research') return undefined;

  const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
  const permCheck = requirePermission(admin, 'ai-research:read'); if (permCheck) return permCheck;
  await connectDB();

  // ---- /api/admin/ai-research/status ----
  if (segments.length === 3 && segments[2] === 'status') {
    return NextResponse.json(getAIStatus());
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

  // ---- /api/admin/ai-research/jobs (create + run a job) ----
  if (segments.length === 3 && segments[2] === 'jobs') {
    const body = await req.json();
    const type = String(body.type || '') as EnrichmentType;
    const phoneIds: string[] = Array.isArray(body.phoneIds) ? body.phoneIds.slice(0, 10) : [];
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'type must be one of specs, images, prices' }, { status: 400 });
    if (phoneIds.length === 0) return NextResponse.json({ error: 'phoneIds is required (max 10 per job)' }, { status: 400 });

    const status = getAIStatus();
    if (!status.configured[type]) {
      return NextResponse.json({ error: `AI enrichment for "${type}" is not configured. Set the required provider/API keys first.` }, { status: 409 });
    }

    const phones = await Phone.find({ _id: { $in: phoneIds } }).populate('brand', 'name').lean();
    if (phones.length === 0) return NextResponse.json({ error: 'No matching phones found' }, { status: 404 });

    const job = await AIResearchJob.create({
      type, status: 'running', phoneIds: phones.map(p => p._id), total: phones.length, createdBy: admin._id, startedAt: new Date(), lastRunAt: new Date(),
    });

    const input = phones.map((p) => ({
      id: String(p._id), brand: (p.brand as unknown as { name?: string } | null)?.name || '', model: p.modelName, slug: p.slug,
    }));

    let generated = 0; const failures: Array<{ phoneId: mongoose.Types.ObjectId; message: string }> = [];
    try {
      // generateEnrichmentSuggestions already caps at 10 phones per call and throws per-phone
      // context on failure; we still guard the whole call so one bad batch doesn't crash the job record.
      const suggestions = await generateEnrichmentSuggestions(type, input);
      for (const suggestion of suggestions) {
        await AIResearchDraft.create({
          phoneId: suggestion.phoneId, type, status: 'pending_review', jobId: job._id,
          brand: suggestion.brand, model: suggestion.model, confidence: suggestion.confidence,
          sourceNotes: suggestion.sourceNotes, sources: suggestion.sources || [], conflicts: suggestion.conflicts || [],
          specs: suggestion.specs, images: suggestion.images, price: suggestion.price, createdBy: admin._id,
        });
        generated++;
      }
      // Any requested phone that didn't get a suggestion counts as a failure so the job total is honest.
      const succeededIds = new Set(await AIResearchDraft.find({ jobId: job._id }).distinct('phoneId').then(ids => ids.map(String)));
      for (const p of phones) {
        if (!succeededIds.has(String(p._id))) failures.push({ phoneId: p._id, message: 'No usable data generated for this phone' });
      }
    } catch (err: unknown) {
      // generateEnrichmentSuggestions throws on the first hard failure (missing sources, provider
      // error, etc.) rather than silently returning partial/fabricated data — that's by design, so
      // we record it as a job failure rather than pretending the batch succeeded.
      const message = err instanceof Error ? err.message : 'AI enrichment failed';
      for (const p of phones) failures.push({ phoneId: p._id, message });
    }

    const finalStatus = failures.length === 0 ? 'completed' : (generated > 0 ? 'completed_with_errors' : 'failed');
    await AIResearchJob.updateOne({ _id: job._id }, {
      $set: { status: finalStatus, processed: phones.length, generated, failed: failures.length, failures, completedAt: new Date() },
    });

    try { await ActivityLog.create({ adminId: admin._id, action: 'ai_research_job', details: `AI research (${type}): ${generated} draft(s) generated, ${failures.length} failed, from ${phones.length} phone(s)`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, jobId: job._id, status: finalStatus, total: phones.length, generated, failed: failures.length, failures });
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
