import { NextRequest, NextResponse } from 'next/server';
import { CollectorSource, CollectorJob, CollectedPhone, Brand, Phone, ActivityLog } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission, escapeRegex } from './helpers';

// ============ COLLECTOR POST ============

export async function handleCollectorPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/collector/sources ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { name: srcName, type: srcType, endpoint: srcEndpoint, enabled: srcEnabled, apiKeyEnvVar, mappingRules, headers, paginationConfig, brandFilter: srcBrandFilter } = body;
    if (!srcName || !srcType) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
    const source = await CollectorSource.create({ name: srcName, type: srcType, endpoint: srcEndpoint || '', enabled: srcEnabled !== false, apiKeyEnvVar: apiKeyEnvVar || '', mappingRules, headers, paginationConfig, brandFilter: srcBrandFilter });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_source', details: `Created source: ${srcName}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: source._id });
  }

  // ---- /api/collector/jobs ----
  if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { sourceId: jobSourceId, provider: jobProvider, maxItems, mode: jobMode, brandFilter: jobBrandFilter } = body;
    if (!jobSourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
    const job = await CollectorJob.create({ sourceId: jobSourceId, provider: jobProvider || '', maxItems: maxItems || 100, mode: jobMode || 'full', brandFilter: jobBrandFilter, status: 'pending', startedAt: new Date() });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_collector_job', details: `Created job for source ${jobSourceId}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
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
      const brand = await Brand.findOne({ name: new RegExp(`^${escapeRegex(item.brandName)}$`, 'i') });
      if (!brand) return NextResponse.json({ error: `Brand "${item.brandName}" not found` }, { status: 400 });
      const phone = await Phone.create({
        brandId: brand._id, modelName: item.model, slug: item.slug,
        pricePKR: 0, thumbnail: item.thumbnail || '',
        description: '', status: 'published', active: true,
        featured: false, trending: false, upcoming: false,
      });
      item.status = 'approved';
      item.approvedPhoneId = phone._id;
      await item.save();
      try { await ActivityLog.create({ adminId: admin._id, action: 'collector_approve', details: `Approved: ${item.brandName} ${item.model}`, entityType: 'collector' }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ success: true, phoneId: phone._id });
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
    return NextResponse.json({ success: false, error: 'Collector source testing not yet implemented.' }, { status: 501 });
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

  return undefined;
}