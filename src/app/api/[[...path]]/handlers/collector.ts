import { NextRequest, NextResponse } from 'next/server';
import { CollectorSource, CollectorJob, CollectedPhone, ActivityLog } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { createProvider } from '@/lib/collectors/providers';
import { startJob, approveAndImport } from '@/lib/collectors/job-runner';
import type { ProviderConfig, ProviderType } from '@/lib/collectors/types';
import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { randomUUID } from 'node:crypto';

const PROVIDER_TYPES: ProviderType[] = ['json_url', 'csv_url', 'api', 'xml_feed', 'rss_feed', 'manufacturer', 'manual_url', 'file_upload'];

function sourceConfig(source: Record<string, unknown>): ProviderConfig {
  return {
    type: source.type as ProviderType, endpoint: String(source.endpoint || ''), apiKeyEnvVar: String(source.apiKeyEnvVar || ''),
    headers: Object.fromEntries(Object.entries((source.headers as Record<string, unknown>) || {}).map(([key, value]) => [key, String(value)])),
    brandFilter: (source.brandFilter as string[]) || [], allowedDomains: (source.allowedDomains as string[]) || [],
    dataPath: String(source.dataPath || ''), mappingRules: Object.fromEntries(Object.entries((source.mappingRules as Record<string, unknown>) || {}).map(([key, value]) => [key, String(value)])),
    timeoutMs: Number(source.timeoutMs || 30000), maxResponseBytes: Number(source.maxResponseBytes || 5242880), enabled: source.enabled !== false,
    pagination: { pageSize: Number(source.paginationPageSize || 50), maxPages: Number(source.paginationMaxPages || 10), pageParam: String(source.paginationPageParam || 'page') },
  };
}

// ============ COLLECTOR GET ============

export async function handleCollectorGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/dashboard ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'dashboard') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const [totalSources, activeSources, totalJobs, pendingReview, completedJobs] = await Promise.all([
      CollectorSource.countDocuments(),
      CollectorSource.countDocuments({ enabled: true }),
      CollectorJob.countDocuments(),
      CollectedPhone.countDocuments({ status: { $in: ['pending', 'needs_review'] } }),
      CollectorJob.countDocuments({ status: { $in: ['completed', 'failed'] } }),
    ]);
    return NextResponse.json({ totalSources, activeSources, totalJobs, pendingReview, completedJobs });
  }

  // ---- /api/collector/sources ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const sources = await CollectorSource.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ sources: sources.map((s: Record<string, unknown>) => ({ ...s, id: (s._id as { toString(): string } | undefined)?.toString() })) });
  }

  // ---- /api/collector/jobs ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const jobs = await CollectorJob.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ jobs: jobs.map((j: Record<string, unknown>) => ({ ...j, id: (j._id as { toString(): string } | undefined)?.toString(), sourceId: (j.sourceId as { toString(): string } | undefined)?.toString() })) });
  }

  return undefined;
}

// ============ COLLECTOR POST ============

export async function handleCollectorPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/sources ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    const { name: srcName, type: srcType, endpoint: bodyEndpoint, url, enabled: srcEnabled, apiKeyEnvVar, mappingRules, headers, brandFilter: srcBrandFilter, allowedDomains, dataPath, pollingSchedule } = body;
    const srcEndpoint = String(bodyEndpoint || url || '').trim();
    const normalizedName = String(srcName || '').trim();
    if (!normalizedName) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!srcType) return NextResponse.json({ error: 'Source type is required' }, { status: 400 });
    if (!PROVIDER_TYPES.includes(srcType)) return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
    if (srcType === 'manufacturer') return NextResponse.json({ error: 'Manufacturer adapters require an approved adapter deployment.' }, { status: 400 });
    if (srcType !== 'file_upload') {
      if (!srcEndpoint) return NextResponse.json({ error: 'URL / Endpoint is required for this source type' }, { status: 400 });
      const checked = await validateUrlForFetch(srcEndpoint, allowedDomains || []);
      if (!checked.safe) return NextResponse.json({ error: checked.reason || 'Invalid endpoint' }, { status: 400 });
    }
    const safeHeaders = Object.fromEntries(Object.entries((headers || {}) as Record<string, string>).filter(([key]) => !/authorization|api-key|cookie/i.test(key)));
    const normalizedBrands = Array.isArray(srcBrandFilter) ? srcBrandFilter : String(srcBrandFilter || '').split(',').map(value => value.trim()).filter(Boolean);
    const duplicate = await CollectorSource.exists({ name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (duplicate) return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
    let source;
    try {
      source = await CollectorSource.create({ name: normalizedName, type: srcType, endpoint: srcEndpoint, enabled: srcEnabled !== false, apiKeyEnvVar: apiKeyEnvVar || '', mappingRules, headers: safeHeaders, brandFilter: normalizedBrands, allowedDomains, dataPath, pollingSchedule });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
      throw error;
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_source', details: `Created source: ${srcName}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    const created = source.toObject();
    return NextResponse.json({ success: true, source: { ...created, id: source._id.toString() } }, { status: 201 });
  }

  // ---- /api/collector/jobs ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { sourceId: jobSourceId, mode: jobMode, brandFilter: jobBrandFilter } = body;
    if (!jobSourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
    const active = await CollectorJob.exists({ sourceId: jobSourceId, status: { $in: ['queued', 'running'] } });
    if (active) return NextResponse.json({ error: 'A job is already active for this source.' }, { status: 409 });
    const source = await CollectorSource.findById(jobSourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    const job = await CollectorJob.create({ sourceId: jobSourceId, sourceName: source.name, mode: jobMode === 'full' ? 'full' : 'incremental', filterBrand: jobBrandFilter || '', status: 'queued', requestId: req.headers.get('x-request-id') || randomUUID() });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_job', details: `Created job for source ${jobSourceId}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    await startJob(job._id.toString());
    return NextResponse.json({ success: true, id: job._id });
  }

  // ---- /api/collector/review/:id ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { action } = body;
    const item = await CollectedPhone.findById(segments[2]);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'approve') {
      if (!item.isValid) return NextResponse.json({ error: 'Invalid records cannot be approved.' }, { status: 409 });
      const result = await approveAndImport(item._id.toString(), body.adminEdits);
      if (!result.success) return NextResponse.json({ error: result.error || 'Import failed' }, { status: 409 });
      try { await ActivityLog.create({ adminId: admin._id, action: 'collector_approve', details: `Approved: ${item.brandName} ${item.model}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ success: true, phoneId: result.phoneId });
    } else if (action === 'reject') {
      item.status = 'rejected';
      await item.save();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // ---- /api/collector/sources/:id/test ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'sources' && segments[3] === 'test') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const source = await CollectorSource.findById(segments[2]).lean();
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    const provider = createProvider(sourceConfig(source as unknown as Record<string, unknown>), String(source._id), String(source.name));
    const result = await provider.test();
    await CollectorSource.updateOne({ _id: source._id }, { $set: result.success ? { lastSuccessfulSyncAt: new Date(), lastError: '' } : { lastError: result.message } });
    return NextResponse.json({ ...result, sample: result.success ? (await provider.fetch(1)).phones.slice(0, 5) : [] }, { status: result.success ? 200 : 422 });
  }

  return undefined;
}

// ============ COLLECTOR PUT ============

export async function handleCollectorPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/sources/:id (toggle) ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const source = await CollectorSource.findById(segments[2]);
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    source.enabled = !source.enabled;
    await source.save();
    return NextResponse.json({ success: true, enabled: source.enabled });
  }

  return undefined;
}

// ============ COLLECTOR DELETE ============

export async function handleCollectorDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/jobs (delete job) ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    await CollectorJob.findByIdAndDelete(body.jobId);
    return NextResponse.json({ success: true });
  }

  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const active = await CollectorJob.exists({ sourceId: segments[2], status: { $in: ['queued', 'running'] } });
    if (active) return NextResponse.json({ error: 'Cancel the active job before deleting this source.' }, { status: 409 });
    await Promise.all([CollectorSource.findByIdAndDelete(segments[2]), CollectorJob.deleteMany({ sourceId: segments[2] })]);
    return NextResponse.json({ success: true });
  }

  return undefined;
}
