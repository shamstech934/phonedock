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
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compute completeness in MongoDB so a 9k-phone catalogue is not loaded into
  // a serverless function on every admin page request.
  const scoreFilledExpr = (field: string) => ({ $cond: [{ $gt: [{ $ifNull: [`$${field}`, 0] }, 0] }, 1, 0] });
  const numericBenchmarkExpr = (field: string) => ({ $cond: [{ $gt: [{ $ifNull: [`$benchmark.${field}`, 0] }, 0] }, 1, 0] });
  const textBenchmarkExpr = (field: string) => ({ $cond: [{ $gt: [{ $strLenCP: { $trim: { input: { $ifNull: [`$benchmark.${field}`, ''] } } } }, 0] }, 1, 0] });

  const pipeline: any[] = [
    { $match: { deletedAt: null, active: true } },
    { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brandDoc' } },
    { $lookup: { from: 'phonebenchmarks', localField: '_id', foreignField: 'phoneId', as: 'benchmarkDocs' } },
    { $set: { brandId: { $first: '$brandDoc' }, benchmark: { $first: '$benchmarkDocs' } } },
  ];
  if (q) pipeline.push({ $match: { $or: [{ modelName: { $regex: escaped, $options: 'i' } }, { 'brandId.name': { $regex: escaped, $options: 'i' } }, { slug: { $regex: escaped, $options: 'i' } }] } });
  pipeline.push(
    { $set: {
      scoresFilled: { $add: scoreFields.map((key) => scoreFilledExpr(key)) },
      benchmarksFilled: { $add: [
        ...['antutu','geekbenchSingle','geekbenchMulti','gamingScore'].map((key) => numericBenchmarkExpr(key)),
        ...['pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery'].map((key) => textBenchmarkExpr(key)),
      ] },
    } },
    { $set: { filled: { $add: ['$scoresFilled', '$benchmarksFilled'] } } },
    { $set: { completenessState: { $switch: { branches: [
      { case: { $eq: ['$filled', 0] }, then: 'missing' },
      { case: { $lt: ['$filled', scoreFields.length + benchmarkFields.length] }, then: 'partial' },
    ], default: 'complete' } } } },
  );
  if (status !== 'all') pipeline.push({ $match: { completenessState: status } });
  pipeline.push(
    { $sort: { updatedAt: -1, modelName: 1 } },
    { $facet: {
      items: [
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { brandDoc: 0, benchmarkDocs: 0 } },
      ],
      total: [{ $count: 'value' }],
    } },
  );

  const [result] = await Phone.aggregate(pipeline);
  // Summary is intentionally computed across the full active catalogue, not the
  // current status filter, so the three cards remain stable while filtering.
  const summaryPipeline = pipeline.slice(0, q ? 8 : 7).filter((stage) => !('$facet' in stage) && !('$sort' in stage));
  // Remove an optional status match from the derived summary pipeline.
  const summaryBase = summaryPipeline.filter((stage:any) => !(stage.$match && Object.prototype.hasOwnProperty.call(stage.$match, 'completenessState')));
  summaryBase.push({ $group: { _id: '$completenessState', count: { $sum: 1 } } });
  const summaryRows = await Phone.aggregate(summaryBase);
  const summary: Record<string, number> = { missing: 0, partial: 0, complete: 0 };
  for (const row of summaryRows) if (row?._id in summary) summary[row._id] = Number(row.count || 0);

  const items = (result?.items || []).map((row:any) => ({
    phone: row,
    benchmark: row.benchmark || null,
    completeness: { scoresFilled: row.scoresFilled || 0, benchmarksFilled: row.benchmarksFilled || 0, filled: row.filled || 0, total: scoreFields.length + benchmarkFields.length, state: row.completenessState },
  }));
  const total = Number(result?.total?.[0]?.value || 0);
  return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary }, { headers: { 'Cache-Control':'no-store' } });
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
    const raw = scores[key];
    if (raw === null || raw === '') { phone[key] = 0; continue; }
    const value = Number(raw);
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
      const raw = benchmarkInput[key];
      if (raw === null || raw === '') { update[key] = 0; continue; }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return NextResponse.json({ error:`${key} must be a non-negative number` }, { status:400 });
      update[key] = value;
    } else update[key] = benchmarkInput[key] === null ? '' : String(benchmarkInput[key] || '').trim();
  }
  const sourceName = String(body.sourceName || '').trim().slice(0, 160);
  const sourceUrl = String(body.sourceUrl || '').trim().slice(0, 1000);
  if (sourceUrl) { try { const parsed = new URL(sourceUrl); if (!['http:','https:'].includes(parsed.protocol)) throw new Error('bad protocol'); } catch { return NextResponse.json({ error:'sourceUrl must be a valid http(s) URL' }, { status:400 }); } }
  const benchmark = await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set:{ ...update, phoneId: phone._id, sourceName, sourceUrl, verifiedAt: new Date(), verifiedBy: auth.admin._id } }, { upsert:true, new:true });
  await ActivityLog.create({ adminId:auth.admin._id, action:'ratings_benchmarks_updated', entityType:'phone', entityId:phone._id, details:`Ratings/benchmarks updated for ${phone.modelName}` });
  revalidatePublicContent();
  return NextResponse.json({ success:true, phone, benchmark });
}
