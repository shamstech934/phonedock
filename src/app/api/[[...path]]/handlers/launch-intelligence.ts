import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, LaunchCandidate, Phone } from '@/lib/models';
import { approveLaunchCandidate } from '@/lib/launch-intelligence';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { revalidatePublicContent } from '@/lib/revalidate';

const LIFECYCLE_STATUSES = ['rumored', 'announced', 'coming_soon', 'available', 'limited', 'discontinued', 'cancelled'] as const;
type LifecycleStatus = typeof LIFECYCLE_STATUSES[number];

function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return LIFECYCLE_STATUSES.includes(String(value || '') as LifecycleStatus);
}

function upcomingFor(status: LifecycleStatus): boolean {
  return status === 'rumored' || status === 'announced' || status === 'coming_soon';
}

export async function handleLaunchIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:read');
  if (denied) return denied;
  await connectDB();

  const view = req.nextUrl.searchParams.get('view') || 'lifecycle';
  if (view === 'candidates') {
    const status = req.nextUrl.searchParams.get('status') || 'pending';
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 30)));
    const filter = status === 'all' ? {} : { status };
    const [items, total, counts] = await Promise.all([
      LaunchCandidate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('linkedPhoneId', 'modelName slug status availabilityStatus').lean(),
      LaunchCandidate.countDocuments(filter),
      LaunchCandidate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    return NextResponse.json({ view, items, total, page, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((x: { _id: string; count: number }) => [x._id, x.count])) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const status = req.nextUrl.searchParams.get('status') || 'all';
  const q = String(req.nextUrl.searchParams.get('q') || '').trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 40)));
  const filter: Record<string, unknown> = { deletedAt: null, active: true };
  if (status !== 'all' && isLifecycleStatus(status)) filter.availabilityStatus = status;
  if (q) filter.modelName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const today = new Date().toISOString().slice(0, 10);
  const [items, total, grouped, candidateCounts, needsReview] = await Promise.all([
    Phone.find(filter)
      .select('brandId modelName slug status availabilityStatus upcoming releaseDate announcedAt expectedLaunchAt pakistanLaunchAt availableFrom discontinuedAt lifecycleManualLock lifecycleLockReason lifecycleUpdatedAt thumbnail')
      .populate('brandId', 'name slug')
      .sort({ lifecycleManualLock: -1, expectedLaunchAt: 1, releaseDate: 1, updatedAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Phone.countDocuments(filter),
    Phone.aggregate([
      { $match: { deletedAt: null, active: true } },
      { $group: { _id: '$availabilityStatus', count: { $sum: 1 } } },
    ]),
    LaunchCandidate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Phone.countDocuments({
      deletedAt: null, active: true,
      $or: [
        { availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] }, expectedLaunchAt: '' },
        { availabilityStatus: 'available', $and: [{ releaseDate: '' }, { availableFrom: '' }] },
        { availabilityStatus: 'discontinued', discontinuedAt: '' },
        { availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] }, upcoming: { $ne: true } },
        { availabilityStatus: { $in: ['available', 'limited', 'discontinued', 'cancelled'] }, upcoming: true },
      ],
    }),
  ]);

  const counts = Object.fromEntries(LIFECYCLE_STATUSES.map(key => [key, 0])) as Record<LifecycleStatus, number>;
  for (const row of grouped as Array<{ _id?: LifecycleStatus; count: number }>) if (row._id && isLifecycleStatus(row._id)) counts[row._id] = row.count;
  const candidates = Object.fromEntries((candidateCounts as Array<{ _id: string; count: number }>).map(row => [row._id, row.count]));

  return NextResponse.json({
    view: 'lifecycle', items, total, page, pages: Math.ceil(total / limit), counts, candidates,
    needsReview, today,
    upcomingTotal: counts.rumored + counts.announced + counts.coming_soon,
    liveTotal: counts.available + counts.limited,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleLaunchIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:edit');
  if (denied) return denied;
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'update_phone') {
    const id = String(body.id || '');
    const availabilityStatus = String(body.availabilityStatus || '');
    if (!id || !isLifecycleStatus(availabilityStatus)) return NextResponse.json({ error: 'Valid phone and lifecycle status are required' }, { status: 400 });
    const updates: Record<string, unknown> = {
      availabilityStatus,
      upcoming: upcomingFor(availabilityStatus),
      lifecycleManualLock: body.lock !== false,
      lifecycleLockReason: String(body.reason || '').slice(0, 300),
      lifecycleUpdatedAt: new Date(),
      lifecycleUpdatedBy: auth.admin._id,
    };
    for (const field of ['announcedAt', 'expectedLaunchAt', 'pakistanLaunchAt', 'availableFrom', 'releaseDate', 'discontinuedAt']) {
      if (body[field] !== undefined) updates[field] = String(body[field] || '');
    }
    if (availabilityStatus === 'available' && !updates.availableFrom && body.useToday === true) updates.availableFrom = new Date().toISOString().slice(0, 10);
    if (availabilityStatus === 'discontinued' && !updates.discontinuedAt && body.useToday === true) updates.discontinuedAt = new Date().toISOString().slice(0, 10);
    const phone = await Phone.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: updates }, { new: true }).select('modelName slug availabilityStatus upcoming lifecycleManualLock lifecycleLockReason');
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'phone_lifecycle_updated', entityType: 'phone', entityId: phone._id, details: `${phone.modelName}: ${availabilityStatus}` });
    revalidatePublicContent();
    return NextResponse.json({ success: true, phone });
  }

  if (action === 'unlock_phone') {
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Phone id is required' }, { status: 400 });
    const phone = await Phone.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { lifecycleManualLock: false, lifecycleLockReason: '', lifecycleUpdatedAt: new Date(), lifecycleUpdatedBy: auth.admin._id } }, { new: true }).select('modelName availabilityStatus lifecycleManualLock');
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'phone_lifecycle_unlocked', entityType: 'phone', entityId: phone._id, details: `${phone.modelName}: automation enabled` });
    return NextResponse.json({ success: true, phone });
  }

  if (action === 'bulk_update') {
    const ids: string[] = Array.isArray(body.ids)
      ? Array.from(new Set<string>(body.ids.map((value: unknown) => String(value || '')).filter(Boolean))).slice(0, 100)
      : [];
    const availabilityStatus = String(body.availabilityStatus || '');
    if (!ids.length || !isLifecycleStatus(availabilityStatus)) return NextResponse.json({ error: 'Select phones and a valid lifecycle status' }, { status: 400 });
    const result = await Phone.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: {
      availabilityStatus, upcoming: upcomingFor(availabilityStatus), lifecycleManualLock: true,
      lifecycleLockReason: String(body.reason || 'Bulk admin lifecycle update').slice(0, 300), lifecycleUpdatedAt: new Date(), lifecycleUpdatedBy: auth.admin._id,
    } });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'phone_lifecycle_bulk_updated', entityType: 'phone', details: `${result.modifiedCount} phones → ${availabilityStatus}` });
    revalidatePublicContent();
    return NextResponse.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
  }

  if (action === 'run_lifecycle') {
    const today = new Date().toISOString().slice(0, 10);
    const [upcomingConsistency, launched, discontinued] = await Promise.all([
      Phone.updateMany({ deletedAt: null, lifecycleManualLock: { $ne: true }, availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] }, upcoming: { $ne: true } }, { $set: { upcoming: true, lifecycleUpdatedAt: new Date() } }),
      Phone.updateMany({ deletedAt: null, lifecycleManualLock: { $ne: true }, availabilityStatus: { $in: ['rumored', 'announced', 'coming_soon'] }, $or: [{ availableFrom: { $ne: '', $lte: today } }, { releaseDate: { $ne: '', $lte: today } }] }, { $set: { availabilityStatus: 'available', upcoming: false, lifecycleUpdatedAt: new Date() } }),
      Phone.updateMany({ deletedAt: null, lifecycleManualLock: { $ne: true }, discontinuedAt: { $ne: '', $lte: today }, availabilityStatus: { $nin: ['discontinued', 'cancelled'] } }, { $set: { availabilityStatus: 'discontinued', upcoming: false, lifecycleUpdatedAt: new Date() } }),
    ]);
    await ActivityLog.create({ adminId: auth.admin._id, action: 'lifecycle_automation_run', entityType: 'phone', details: `normalised ${upcomingConsistency.modifiedCount}; launched ${launched.modifiedCount}; discontinued ${discontinued.modifiedCount}` });
    revalidatePublicContent();
    return NextResponse.json({ success: true, upcomingNormalised: upcomingConsistency.modifiedCount, launched: launched.modifiedCount, discontinued: discontinued.modifiedCount });
  }

  // Existing candidate review actions stay available inside the same workspace.
  const id = String(body.id || '');
  if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Valid action is required' }, { status: 400 });

  if (action === 'reject') {
    const candidate = await LaunchCandidate.findByIdAndUpdate(id, {
      $set: { status: 'rejected', reviewedBy: auth.admin._id, reviewedAt: new Date(), reviewNotes: String(body.notes || '') },
    }, { new: true });
    if (!candidate) return NextResponse.json({ error: 'Launch candidate not found' }, { status: 404 });
    await ActivityLog.create({ adminId: auth.admin._id, action: 'launch_candidate_rejected', entityType: 'launch_candidate', entityId: candidate._id, details: candidate.sourceTitle });
    return NextResponse.json({ success: true, candidate });
  }

  try {
    const candidate = await approveLaunchCandidate(id, auth.admin._id, String(body.notes || ''));
    await ActivityLog.create({ adminId: auth.admin._id, action: 'launch_candidate_approved', entityType: 'launch_candidate', entityId: candidate._id, details: `${candidate.brandName} ${candidate.modelName}` });
    revalidatePublicContent();
    return NextResponse.json({ success: true, candidate });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Approval failed' }, { status: 400 });
  }
}
