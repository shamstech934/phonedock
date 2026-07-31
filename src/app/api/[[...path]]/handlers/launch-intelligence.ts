import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, LaunchCandidate } from '@/lib/models';
import { approveLaunchCandidate } from '@/lib/launch-intelligence';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { revalidatePublicContent } from '@/lib/revalidate';

export async function handleLaunchIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'news:read');
  if (denied) return denied;
  await connectDB();

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 30)));
  const filter = status === 'all' ? {} : { status };
  const [items, total, counts] = await Promise.all([
    LaunchCandidate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('linkedPhoneId', 'modelName slug status').lean(),
    LaunchCandidate.countDocuments(filter),
    LaunchCandidate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((x: { _id: string; count: number }) => [x._id, x.count])) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleLaunchIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:create');
  if (denied) return denied;
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  const action = String(body.action || '');
  if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Valid id and action are required' }, { status: 400 });

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
