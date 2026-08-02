import { NextRequest, NextResponse } from 'next/server';
import { CollectorSource, CollectorJob, CollectedPhone, ActivityLog, Phone } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { createProvider } from '@/lib/collectors/providers';
import { startJob, approveAndImport } from '@/lib/collectors/job-runner';
import type { ProviderConfig, ProviderType } from '@/lib/collectors/types';
import { detectCollectorSourceType } from '@/lib/collectors/source-detection';
import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { generateSlug } from '@/lib/import/validators';
import { randomUUID } from 'node:crypto';


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

const PROVIDER_TYPES: ProviderType[] = ['json_url', 'csv_url', 'api', 'xml_feed', 'rss_feed', 'manufacturer', 'manual_url', 'file_upload'];


function sanitizeCollectorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Collector request failed');
  if (/Headers\.(?:append|set)|invalid header value/i.test(raw)) {
    return 'Invalid HTTP header configuration. Remove non-text custom headers from this source and retry.';
  }
  return raw.replace(/\s+/g, ' ').slice(0, 500);
}

function sourceConfig(source: Record<string, unknown>): ProviderConfig {
  return {
    type: source.type as ProviderType, endpoint: String(source.endpoint || ''), apiKeyEnvVar: String(source.apiKeyEnvVar || ''),
    headers: toStringRecord(source.headers),
    brandFilter: (source.brandFilter as string[]) || [], allowedDomains: (source.allowedDomains as string[]) || [],
    dataPath: String(source.dataPath || ''), mappingRules: toStringRecord(source.mappingRules),
    timeoutMs: Number(source.timeoutMs || 30000), maxResponseBytes: Number(source.maxResponseBytes || 5242880), enabled: source.enabled !== false,
    pagination: { pageSize: Number(source.paginationPageSize || 50), maxPages: Number(source.paginationMaxPages || 10), pageParam: String(source.paginationPageParam || 'page') },
    parserId: String(source.parserId || 'auto'), maxProductPages: Number(source.maxProductPages || 20),
  };
}

// ============ COLLECTOR GET ============

export async function handleCollectorGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/dashboard ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'dashboard') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const [
      totalSources, activeSources, totalJobs, pendingReview, completedJobs,
      jobsRunning, jobsWaiting, jobsFailed, phonesCollectedToday, phonesImportedTotal,
      duplicatesDetected, recentActivity,
    ] = await Promise.all([
      CollectorSource.countDocuments(),
      CollectorSource.countDocuments({ enabled: true }),
      CollectorJob.countDocuments(),
      CollectedPhone.countDocuments({ status: { $in: ['pending', 'needs_review'] } }),
      CollectorJob.countDocuments({ status: { $in: ['completed', 'failed'] } }),
      CollectorJob.countDocuments({ status: 'running' }),
      CollectorJob.countDocuments({ status: 'queued' }),
      CollectorJob.countDocuments({ status: 'failed' }),
      CollectedPhone.countDocuments({ createdAt: { $gte: startOfToday } }),
      CollectedPhone.countDocuments({ status: 'imported' }),
      CollectedPhone.countDocuments({ hasExactDuplicate: true, status: { $in: ['pending', 'needs_review'] } }),
      ActivityLog.find({ entityType: 'collector' }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);
    const pagesPerInvocationEnv = parseInt(process.env.COLLECTOR_PAGES_PER_INVOCATION || '3');
    return NextResponse.json({
      totalSources, activeSources, totalJobs, pendingReview, completedJobs,
      jobsRunning, jobsWaiting, jobsFailed, phonesCollectedToday, phonesImportedTotal, duplicatesDetected,
      recentActivity: recentActivity.map((a: Record<string, unknown>) => ({ id: (a._id as { toString(): string })?.toString(), action: a.action, details: a.details, createdAt: a.createdAt })),
      config: {
        pagesPerInvocation: pagesPerInvocationEnv > 0 ? pagesPerInvocationEnv : 'unlimited',
        maxCollectPerJob: 2000,
        schedulerEnabled: true,
        deterministicOnly: true,
        aiDiscoverConfigured: false,
      },
    });
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
    // Recover serverless invocations that were terminated before the runner
    // could write a final status. A running job with no heartbeat for two
    // minutes is safe to pause and can be resumed from its last batch.
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    await CollectorJob.updateMany(
      {
        status: 'running',
        $or: [
          { lastProcessedAt: { $lt: staleBefore } },
          { lastProcessedAt: { $exists: false }, startedAt: { $lt: staleBefore } },
        ],
      },
      {
        $set: {
          status: 'paused',
          lastError: 'Collector run exceeded the serverless execution window. Resume to continue from the saved batch.',
          lastProcessedAt: new Date(),
        },
      },
    );
    const jobs = await CollectorJob.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ jobs: jobs.map((j: Record<string, unknown>) => ({
      ...j,
      id: (j._id as { toString(): string } | undefined)?.toString(),
      sourceId: (j.sourceId as { toString(): string } | undefined)?.toString(),
      lastError: j.lastError ? sanitizeCollectorMessage(j.lastError) : '',
      errorLog: Array.isArray(j.errorLog) ? j.errorLog.map(entry => sanitizeCollectorMessage(String(entry))).filter(Boolean) : [],
      warningLog: Array.isArray(j.warningLog) ? j.warningLog.map(entry => sanitizeCollectorMessage(String(entry))).filter(Boolean) : [],
    })) });
  }

  // ---- /api/collector/review — list the review queue ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'review') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'pending,needs_review';
    const brand = url.searchParams.get('brand') || '';
    const dupOnly = url.searchParams.get('duplicatesOnly') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20') || 20));
    const filter: Record<string, unknown> = { status: { $in: status.split(',').map(s => s.trim()).filter(Boolean) } };
    if (brand) filter.brandName = brand;
    if (dupOnly) filter.hasExactDuplicate = true;
    const [items, total] = await Promise.all([
      CollectedPhone.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CollectedPhone.countDocuments(filter),
    ]);
    return NextResponse.json({ items: items.map((i: Record<string, unknown>) => ({ ...i, id: (i._id as { toString(): string })?.toString() })), total, page, limit });
  }

  // ---- /api/collector/review/brands — distinct brand names currently in the review queue ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review' && segments[2] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:read'); if (permCheck) return permCheck;
    await connectDB();
    const brands = await CollectedPhone.distinct('brandName', { status: { $in: ['pending', 'needs_review'] } });
    return NextResponse.json({ brands: brands.sort() });
  }

  return undefined;
}

// ============ COLLECTOR POST ============

export async function handleCollectorPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/sources ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    const { name: srcName, type: srcType, endpoint: bodyEndpoint, url, enabled: srcEnabled, apiKeyEnvVar, mappingRules, headers, brandFilter: srcBrandFilter, allowedDomains, dataPath, pollingSchedule } = body;
    const srcEndpoint = String(bodyEndpoint || url || '').trim();
    const normalizedName = String(srcName || '').trim();
    if (!normalizedName) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!srcType) return NextResponse.json({ error: 'Source type is required' }, { status: 400 });
    if (!PROVIDER_TYPES.includes(srcType)) return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
    const detectedType = srcEndpoint ? detectCollectorSourceType(srcEndpoint).type : srcType;
    const normalizedType: ProviderType = srcType === 'manufacturer' || srcType === 'file_upload' ? srcType : detectedType;
    if (normalizedType === 'manufacturer') return NextResponse.json({ error: 'Manufacturer adapters require an approved adapter deployment.' }, { status: 400 });
    if (normalizedType !== 'file_upload') {
      if (!srcEndpoint) return NextResponse.json({ error: 'URL / Endpoint is required for this source type' }, { status: 400 });
      const checked = await validateUrlForFetch(srcEndpoint, allowedDomains || []);
      if (!checked.safe) return NextResponse.json({ error: checked.reason || 'Invalid endpoint' }, { status: 400 });
    }
    // Persist only primitive text headers. Normal HTML/feed sources do not
    // need custom request headers at all; API sources may keep sanitized
    // non-secret headers. This prevents legacy Maps/documents from ever being
    // stored as HTTP header values.
    const safeHeaders = normalizedType === 'api'
      ? Object.fromEntries(
          Object.entries(toStringRecord(headers)).filter(([key]) => !/authorization|api-key|cookie/i.test(key)),
        )
      : {};
    const normalizedBrands = Array.isArray(srcBrandFilter) ? srcBrandFilter : String(srcBrandFilter || '').split(',').map(value => value.trim()).filter(Boolean);
    const normalizedAllowedDomains = Array.isArray(allowedDomains) ? allowedDomains.map(value => String(value).trim().toLowerCase()).filter(Boolean) : String(allowedDomains || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (srcEndpoint && normalizedAllowedDomains.length === 0) normalizedAllowedDomains.push(new URL(srcEndpoint).hostname.toLowerCase());
    const duplicate = await CollectorSource.exists({ name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (duplicate) return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
    let source;
    try {
      source = await CollectorSource.create({ name: normalizedName, type: normalizedType, endpoint: srcEndpoint, enabled: srcEnabled !== false, apiKeyEnvVar: apiKeyEnvVar || '', mappingRules, headers: safeHeaders, brandFilter: normalizedBrands, allowedDomains: normalizedAllowedDomains, dataPath, pollingSchedule, lastSyncStatus: 'never', lastTestStatus: 'never' });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
      const message = error instanceof Error ? error.message : 'Collector source could not be saved';
      console.error('[collector.sources.create]', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_source', details: `Created source: ${srcName}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    const created = source.toObject();
    return NextResponse.json({ success: true, source: { ...created, id: source._id.toString() } }, { status: 201 });
  }

  // ---- /api/collector/sources/repair — sanitize legacy source headers and stale jobs ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources' && segments[2] === 'repair') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();

    const sources = await CollectorSource.find({});
    let repairedSources = 0;
    let clearedSourceErrors = 0;
    for (const source of sources) {
      const safeHeaders = toStringRecord(source.headers);
      const hadHeaderError = /invalid header|Headers\.(?:append|set)/i.test(String(source.lastError || source.lastTestMessage || ''));
      const before = toStringRecord((source.toObject({ flattenMaps: true }) as Record<string, unknown>).headers);
      const changed = JSON.stringify(before) !== JSON.stringify(safeHeaders);
      if (changed || hadHeaderError) {
        await CollectorSource.updateOne({ _id: source._id }, {
          $set: {
            headers: safeHeaders,
            lastError: hadHeaderError ? '' : source.lastError,
            lastTestMessage: hadHeaderError ? '' : source.lastTestMessage,
            lastTestStatus: hadHeaderError ? 'never' : source.lastTestStatus,
            lastSyncStatus: hadHeaderError ? 'never' : source.lastSyncStatus,
          },
        });
        repairedSources += 1;
        if (hadHeaderError) clearedSourceErrors += 1;
      }
    }

    const staleJobFilter = { status: 'failed', lastError: { $regex: 'invalid header|Headers\.(append|set)', $options: 'i' } };
    const staleJobs = await CollectorJob.find(staleJobFilter, { _id: 1 }).lean();
    if (staleJobs.length) {
      await CollectorJob.updateMany(staleJobFilter, {
        $set: { lastError: 'Legacy header configuration was repaired. Retry this job.', errorLog: [] },
        $unset: { completedAt: 1 },
      });
    }

    try { await ActivityLog.create({ adminId: admin._id, action: 'repair_collector_sources', details: `Repaired ${repairedSources} source(s) and ${staleJobs.length} stale job(s)`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, repairedSources, clearedSourceErrors, repairedJobs: staleJobs.length });
  }

  // ---- /api/collector/jobs/run-all — start a job for every enabled source without an active job ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'jobs' && segments[2] === 'run-all') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const enabledSources = await CollectorSource.find({ enabled: true }).lean();
    const sources = enabledSources.filter(source => source.type === 'file_upload' || Boolean(String(source.endpoint || '').trim()));
    const unconfigured = enabledSources.filter(source => !sources.some(candidate => String(candidate._id) === String(source._id))).map(source => source.name);
    if (!sources.length) return NextResponse.json({ error: 'No configured enabled sources to run', unconfigured }, { status: 400 });
    const started: string[] = []; const skipped: string[] = [];
    for (const source of sources) {
      const active = await CollectorJob.exists({ sourceId: source._id, status: { $in: ['queued', 'running', 'paused'] } });
      if (active) { skipped.push(source.name); continue; }
      const job = await CollectorJob.create({ sourceId: source._id, sourceName: source.name, mode: 'incremental', status: 'queued', requestId: randomUUID() });
      await startJob(job._id.toString());
      started.push(source.name);
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_run_all', details: `Started ${started.length} job(s), skipped ${skipped.length} (already active)`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, started, skipped, unconfigured });
  }

  // ---- /api/collector/jobs ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    const { sourceId: jobSourceId, mode: jobMode, brandFilter: jobBrandFilter } = body;
    if (!jobSourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
    const active = await CollectorJob.exists({ sourceId: jobSourceId, status: { $in: ['queued', 'running'] } });
    if (active) return NextResponse.json({ error: 'A job is already active for this source.' }, { status: 409 });
    const source = await CollectorSource.findById(jobSourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    if (!source.enabled) return NextResponse.json({ error: 'Source is disabled' }, { status: 409 });
    if (source.type !== 'file_upload' && !String(source.endpoint || '').trim()) return NextResponse.json({ error: 'Source has no endpoint configured' }, { status: 409 });
    const job = await CollectorJob.create({ sourceId: jobSourceId, sourceName: source.name, mode: jobMode === 'full' ? 'full' : 'incremental', filterBrand: jobBrandFilter || '', status: 'queued', requestId: req.headers.get('x-request-id') || randomUUID() });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_job', details: `Created job for source ${jobSourceId}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    await startJob(job._id.toString());
    return NextResponse.json({ success: true, id: job._id });
  }

  // ---- /api/collector/discover ----
  // AI/web-search discovery is intentionally disabled. Production collection
  // runs only from admin-approved JSON/CSV/XML/RSS/API/manual sources.
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'discover') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    return NextResponse.json({
      error: 'AI discovery is disabled. Configure an approved Collector Source and run a deterministic collector job.',
      deterministicOnly: true,
    }, { status: 410 });
  }

  // ---- /api/collector/discover/stage — save selected discovered models as pending CollectedPhone entries for review ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'discover' && segments[2] === 'stage') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const brand = String(body.brand || '').trim();
    const models: Array<{ name: string; sourceUrl?: string }> = Array.isArray(body.models) ? body.models : [];
    if (!brand || !models.length) return NextResponse.json({ error: 'Brand and at least one model are required' }, { status: 400 });
    let staged = 0;
    for (const m of models) {
      const modelName = String(m.name || '').trim();
      if (!modelName) continue;
      const slug = generateSlug(`${brand} ${modelName}`);
      const exists = (await CollectedPhone.exists({ slug })) || (await Phone.exists({ slug }));
      if (exists) continue;
      await CollectedPhone.create({
        status: 'pending', brandName: brand, model: modelName, slug,
        sourceName: 'Manual Discovery', sourceUrl: m.sourceUrl || '',
        collectedAt: new Date(), qualityScore: 0, completenessScore: 0, confidenceScore: 30,
        validationIssues: ['Manually staged without verified specifications. Run an approved collector source or import a verified dataset before approving.'],
        isValid: false,
      });
      staged++;
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_discover_stage', details: `Staged ${staged} discovered models for ${brand}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, staged });
  }

  // ---- /api/collector/review/bulk — bulk approve or reject multiple items ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review' && segments[2] === 'bulk') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    const action = body.action;
    if (!ids.length || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'ids[] and a valid action (approve|reject) are required' }, { status: 400 });
    let approved = 0, rejected = 0, failed = 0;
    const errors: string[] = [];
    for (const id of ids.slice(0, 200)) {
      const item = await CollectedPhone.findById(id);
      if (!item) { failed++; continue; }
      if (action === 'reject') {
        item.status = 'rejected';
        await item.save();
        rejected++;
      } else {
        if (!item.isValid) { failed++; errors.push(`${item.brandName} ${item.model}: has unresolved validation issues`); continue; }
        const result = await approveAndImport(item._id.toString());
        if (result.success) approved++; else { failed++; errors.push(`${item.brandName} ${item.model}: ${result.error || 'import failed'}`); }
      }
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_bulk_review', details: `Bulk ${action}: ${approved} approved, ${rejected} rejected, ${failed} failed`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, approved, rejected, failed, errors });
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

  // ---- /api/collector/jobs/:id/resume — continue a paused job from where it left off ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'jobs' && segments[3] === 'resume') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const job = await CollectorJob.findById(segments[2]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status !== 'paused') return NextResponse.json({ error: `Only paused jobs can be resumed (job is ${job.status})` }, { status: 409 });
    await CollectorJob.updateOne({ _id: job._id }, { $set: { status: 'queued' } });
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_job_resume', details: `Resumed job ${job._id} from page ${job.currentBatch}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    await startJob(job._id.toString());
    return NextResponse.json({ success: true });
  }

  // ---- /api/collector/jobs/:id/retry — restart a failed job from the beginning ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'jobs' && segments[3] === 'retry') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const job = await CollectorJob.findById(segments[2]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!['failed', 'partially_completed'].includes(job.status)) return NextResponse.json({ error: `Only failed or partially completed jobs can be retried (job is ${job.status})` }, { status: 409 });
    if (job.sourceId) {
      const source = await CollectorSource.findById(job.sourceId);
      if (!source) return NextResponse.json({ error: 'Collector source no longer exists' }, { status: 404 });
      const safeHeaders = source.type === 'api' ? toStringRecord(source.headers) : {};
      source.headers = new Map(Object.entries(safeHeaders));
      source.lastError = '';
      source.lastTestMessage = '';
      source.lastTestStatus = 'never';
      source.lastSyncStatus = 'never';
      await source.save();
    }
    await CollectorJob.updateOne({ _id: job._id }, {
      $set: { status: 'queued', currentBatch: 0, fetched: 0, normalized: 0, newPhones: 0, possibleUpdates: 0, duplicates: 0, conflictCount: 0, failureCount: 0, warningCount: 0, skippedCount: 0, errorLog: [], warningLog: [], lastError: '', retryCount: (job.retryCount || 0) + 1 },
      $unset: { completedAt: 1 },
    });
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_job_retry', details: `Retrying job ${job._id} from the start (attempt ${(job.retryCount || 0) + 1})`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    await startJob(job._id.toString());
    return NextResponse.json({ success: true });
  }

  // ---- /api/collector/jobs/:id/cancel — stop a running/queued/paused job permanently ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'jobs' && segments[3] === 'cancel') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const job = await CollectorJob.findById(segments[2]);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (['completed', 'partially_completed', 'cancelled'].includes(job.status)) return NextResponse.json({ error: `Job already ${job.status}` }, { status: 409 });
    await CollectorJob.updateOne({ _id: job._id }, { $set: { status: 'cancelled', completedAt: new Date() } });
    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_job_cancel', details: `Cancelled job ${job._id}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/collector/review/:id/repair — auto-fix unambiguous, deterministic issues only ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'review' && segments[3] === 'repair') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const item = await CollectedPhone.findById(segments[2]);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fixes: string[] = [];

    // Fix 1: regenerate a malformed slug deterministically from brand+model (never guessed)
    if (!item.slug || !/^[a-z0-9-]+$/.test(item.slug)) {
      const newSlug = generateSlug(`${item.brandName} ${item.model}`);
      if (newSlug) { item.slug = newSlug; fixes.push(`Regenerated slug: ${newSlug}`); }
    }

    // Fix 2: strip out image URLs that are not valid http(s) URLs (removes bad data, invents nothing)
    if (Array.isArray(item.images) && item.images.length > 0) {
      const validImages = item.images.filter((url: string) => {
        try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol); } catch { return false; }
      });
      if (validImages.length !== item.images.length) {
        fixes.push(`Removed ${item.images.length - validImages.length} invalid image URL(s)`);
        item.images = validImages;
      }
    }

    if (!fixes.length) return NextResponse.json({ success: true, fixes: [], message: 'No auto-fixable issues found. Remaining issues need manual review.' });

    // Re-run validation after fixes to update isValid/validationIssues
    const remainingIssues: string[] = [];
    if (!item.brandName?.trim()) remainingIssues.push('Brand name is required');
    if (!item.model?.trim()) remainingIssues.push('Model name is required');
    if (!item.slug || !/^[a-z0-9-]+$/.test(item.slug)) remainingIssues.push('Slug must contain only a-z, 0-9, and hyphens');
    item.validationIssues = remainingIssues;
    item.isValid = remainingIssues.length === 0;
    if (item.status === 'needs_review' && item.isValid) item.status = 'pending';
    await item.save();

    try { await ActivityLog.create({ adminId: admin._id, action: 'collector_auto_repair', details: `Auto-repaired ${item.brandName} ${item.model}: ${fixes.join('; ')}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, fixes, isValid: item.isValid });
  }

  // ---- /api/collector/sources/:id/test ----
  if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'sources' && segments[3] === 'test') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const source = await CollectorSource.findById(segments[2]).lean();
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    try {
      const config = sourceConfig(source as unknown as Record<string, unknown>);
      if (config.type !== 'api') config.headers = {};
      const provider = createProvider(config, String(source._id), String(source.name || 'Collector source'));
      const startedAt = Date.now();
      const fetchResult = await provider.fetch(1);
      const success = fetchResult.providerErrors.length === 0;
      const message = success
        ? fetchResult.providerWarnings?.length
          ? `Connected with warnings. Found ${fetchResult.phones.length} record(s). ${fetchResult.providerWarnings.join('; ')}`
          : `Connected. Found ${fetchResult.phones.length} record(s).`
        : fetchResult.providerErrors.join('; ');
      await CollectorSource.updateOne({ _id: source._id }, { $set: { lastTestAt: new Date(), lastTestStatus: success ? 'success' : 'failed', lastTestMessage: message, lastError: success ? '' : message } });
      return NextResponse.json({ success, message, sampleCount: fetchResult.phones.length, latencyMs: Date.now() - startedAt, sample: fetchResult.phones.slice(0, 5), errors: fetchResult.providerErrors, warnings: fetchResult.providerWarnings || [], skippedCount: fetchResult.skippedCount || 0 }, { status: success ? 200 : 422 });
    } catch (error) {
      const message = sanitizeCollectorMessage(error);
      await CollectorSource.updateOne({ _id: source._id }, { $set: { lastTestAt: new Date(), lastTestStatus: 'failed', lastTestMessage: message, lastError: message } });
      return NextResponse.json({ success: false, error: message, message, sample: [] }, { status: 422 });
    }
  }

  return undefined;
}

// ============ COLLECTOR PUT ============

export async function handleCollectorPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/sources/:id (toggle) ----
  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const source = await CollectorSource.findById(segments[2]);
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json().catch(() => null);
    if (!body || Object.keys(body).length === 0) {
      source.enabled = !source.enabled;
    } else {
      if (typeof body.enabled === 'boolean') source.enabled = body.enabled;
      if (typeof body.pollingSchedule === 'string') source.pollingSchedule = body.pollingSchedule;
      if (Number.isFinite(Number(body.syncFrequencyHours))) source.syncFrequencyHours = Math.max(0, Number(body.syncFrequencyHours));
      if (typeof body.reliabilityScore === 'number') source.reliabilityScore = Math.max(0, Math.min(1, body.reliabilityScore));
      if (typeof body.notes === 'string') source.notes = body.notes.slice(0, 2000);
    }
    await source.save();
    return NextResponse.json({ success: true, enabled: source.enabled, source: { ...source.toObject(), id: source._id.toString() } });
  }

  return undefined;
}

// ============ COLLECTOR DELETE ============

export async function handleCollectorDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/jobs (delete job) ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json().catch(() => null);
    if (!body?.jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    const job = await CollectorJob.findById(body.jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (['queued', 'running'].includes(job.status)) return NextResponse.json({ error: 'Cancel the running job before deleting it.' }, { status: 409 });
    await CollectorJob.findByIdAndDelete(body.jobId);
    return NextResponse.json({ success: true });
  }

  if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    await connectDB();
    const active = await CollectorJob.exists({ sourceId: segments[2], status: { $in: ['queued', 'running'] } });
    if (active) return NextResponse.json({ error: 'Cancel the active job before deleting this source.' }, { status: 409 });
    await Promise.all([CollectorSource.findByIdAndDelete(segments[2]), CollectorJob.deleteMany({ sourceId: segments[2] })]);
    return NextResponse.json({ success: true });
  }

  return undefined;
}
