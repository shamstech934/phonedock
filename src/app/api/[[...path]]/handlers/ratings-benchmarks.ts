import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, Phone, PhoneBenchmark } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { revalidatePublicContent } from '@/lib/revalidate';

const scoreFields = ['cameraScore','performanceScore','batteryScore','displayScore','valueScore','overallRating'] as const;
const benchmarkFields = ['antutu','geekbenchSingle','geekbenchMulti','gamingScore','pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery'] as const;

function completeness(phone: any, benchmark: any) {
  const scoresFilled = scoreFields.filter((key) => Number(phone?.[key] || 0) > 0).length;
  const benchmarksFilled = benchmarkFields.filter((key) => {
    const value = benchmark?.[key];
    return typeof value === 'number' ? value > 0 : Boolean(String(value || '').trim());
  }).length;
  const filled = scoresFilled + benchmarksFilled;
  const total = scoreFields.length + benchmarkFields.length;
  return { scoresFilled, benchmarksFilled, filled, total, state: filled === 0 ? 'missing' : filled < total ? 'partial' : 'complete' };
}

export async function handleRatingsBenchmarksGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req); if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:read'); if (denied) return denied;
  await connectDB();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') || 40)));
  const status = req.nextUrl.searchParams.get('status') || 'all';
  const q = String(req.nextUrl.searchParams.get('q') || '').trim();
  const filter: any = { deletedAt: null, active: true };
  if (q) filter.modelName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const phones: any[] = await Phone.find(filter).select('_id modelName slug brandId cameraScore performanceScore batteryScore displayScore valueScore overallRating status').populate('brandId','name').sort({ updatedAt: -1 }).lean();
  const ids = phones.map((phone:any)=>phone._id);
  const benchmarks: any[] = await PhoneBenchmark.find({ phoneId: { $in: ids } }).lean();
  const map = new Map(benchmarks.map((b:any)=>[String(b.phoneId), b]));
  const rows = phones.map((phone:any)=>({ phone, benchmark: map.get(String(phone._id)) || null, completeness: completeness(phone, map.get(String(phone._id)) || null) }));
  const filtered = status === 'all' ? rows : rows.filter((row:any)=>row.completeness.state === status);
  const total = filtered.length;
  const items = filtered.slice((page-1)*limit, page*limit);
  const summary = rows.reduce((acc:any,row:any)=>{ acc[row.completeness.state]=(acc[row.completeness.state]||0)+1; return acc; }, { missing:0, partial:0, complete:0 });
  return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total/limit)), summary }, { headers: { 'Cache-Control':'no-store' } });
}

export async function handleRatingsBenchmarksPost(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req); if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:edit'); if (denied) return denied;
  await connectDB();
  const body = await req.json().catch(()=>({}));
  const phoneId = String(body.phoneId || '');
  if (!phoneId) return NextResponse.json({ error:'phoneId is required' }, { status:400 });
  const phone:any = await Phone.findById(phoneId);
  if (!phone) return NextResponse.json({ error:'Phone not found' }, { status:404 });
  const scores = body.scores && typeof body.scores === 'object' ? body.scores : {};
  for (const key of scoreFields) {
    if (!(key in scores)) continue;
    const value = Number(scores[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) return NextResponse.json({ error:`${key} must be between 0 and 100` }, { status:400 });
    phone[key] = value;
  }
  phone.lastVerifiedAt = new Date();
  await phone.save();
  const benchmarkInput = body.benchmarks && typeof body.benchmarks === 'object' ? body.benchmarks : {};
  const update:any = {};
  for (const key of benchmarkFields) {
    if (!(key in benchmarkInput)) continue;
    if (['antutu','geekbenchSingle','geekbenchMulti','gamingScore'].includes(key)) {
      const value = Number(benchmarkInput[key]);
      if (!Number.isFinite(value) || value < 0) return NextResponse.json({ error:`${key} must be a non-negative number` }, { status:400 });
      update[key] = value;
    } else update[key] = String(benchmarkInput[key] || '').trim();
  }
  const benchmark = await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set:{ ...update, phoneId: phone._id } }, { upsert:true, new:true });
  await ActivityLog.create({ adminId:auth.admin._id, action:'ratings_benchmarks_updated', entityType:'phone', entityId:phone._id, details:`Ratings/benchmarks updated for ${phone.modelName}` });
  revalidatePublicContent();
  return NextResponse.json({ success:true, phone, benchmark });
}
