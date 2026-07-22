import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { Phone, PhoneSpecs } from '@/lib/models';
import { generatePhoneReview } from '@/lib/intelligence/review-engine';
import { getAdminFromRequest, connectDB, requirePermission } from '@/app/api/[[...path]]/handlers/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest) {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return { error: auth.error };
  const forbidden = requirePermission(auth.admin, 'phones:edit');
  return forbidden ? { error: forbidden } : { admin: auth.admin };
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.phoneIds) ? body.phoneIds.filter((id: unknown) => Types.ObjectId.isValid(String(id))).slice(0, 100) : [];
  const query = ids.length ? { _id: { $in: ids } } : { active: true, status: { $ne: 'archived' } };
  const limit = ids.length ? ids.length : Math.min(Math.max(Number(body.limit) || 25, 1), 100);
  const overwrite = body.overwrite === true;

  const phones = await Phone.find(query).limit(limit);
  const specRows = await PhoneSpecs.find({ phoneId: { $in: phones.map(p => p._id) } }).lean();
  const specMap = new Map(specRows.map(s => [String(s.phoneId), s]));

  const results = [];
  for (const phone of phones) {
    if (!overwrite && phone.reviewSummary && phone.reviewVerdict && phone.overallRating > 0) {
      results.push({ id: String(phone._id), slug: phone.slug, status: 'skipped_existing' });
      continue;
    }
    const review = generatePhoneReview({
      modelName: phone.modelName,
      pricePKR: phone.pricePKR,
      cameraScore: phone.cameraScore,
      performanceScore: phone.performanceScore,
      batteryScore: phone.batteryScore,
      displayScore: phone.displayScore,
      valueScore: phone.valueScore,
      specs: specMap.get(String(phone._id)) as Record<string, unknown> | undefined,
    });
    phone.cameraScore = review.scores.camera;
    phone.performanceScore = review.scores.performance;
    phone.batteryScore = review.scores.battery;
    phone.displayScore = review.scores.display;
    phone.valueScore = review.scores.value;
    phone.overallRating = review.scores.overall;
    phone.pros = review.pros.join('\n');
    phone.cons = review.cons.join('\n');
    phone.reviewSummary = review.fullSummary;
    phone.reviewVerdict = review.verdict;
    phone.updatedBy = new Types.ObjectId(auth.admin._id.toString());
    await phone.save();
    results.push({ id: String(phone._id), slug: phone.slug, status: 'updated', review });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    updated: results.filter(r => r.status === 'updated').length,
    skipped: results.filter(r => r.status !== 'updated').length,
    engineVersion: 'review-v2',
    results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
