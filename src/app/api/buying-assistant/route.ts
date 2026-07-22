import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDBSafe } from '@/lib/mongodb';
import { Brand, Phone, PhoneSpecs } from '@/lib/models';
import { parseBuyingIntent } from '@/lib/intelligence/intent';
import { recommendPhones, type RecommendationCandidate } from '@/lib/intelligence/recommendations';
import { serializePhoneSpecs } from '@/app/api/[[...path]]/handlers/helpers';

export const dynamic = 'force-dynamic';
const schema = z.object({ query: z.string().trim().min(3).max(300) });
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please enter a short phone-buying question.' }, { status: 400, headers });
  const intent = parseBuyingIntent(parsed.data.query);
  const connection = await connectDBSafe();
  if (!connection) return NextResponse.json({ intent, results: [], warnings: ['Recommendation data is temporarily unavailable. No phone or specification has been fabricated.'], provider: 'phonedock-rule-engine', modelVersion: 'recommendation-v1', externalAIUsed: false }, { headers });
  const filter: Record<string, unknown> = { active: true, status: 'published', pricePKR: { $gt: 0 } };
  if (intent.budgetMax) filter.pricePKR = { $gt: 0, $lte: intent.budgetMax };
  if (intent.ptaRequired) filter.ptaApproved = true;
  const phones = await Phone.find(filter).select('brandId modelName slug pricePKR ptaApproved cameraScore performanceScore batteryScore displayScore valueScore overallRating lastVerifiedAt dataConfidence').sort({ valueScore: -1, overallRating: -1 }).limit(100).lean();
  const ids = phones.map(phone => phone._id); const brandIds = [...new Set(phones.map(phone => String(phone.brandId)))];
  const [specs, brands] = await Promise.all([PhoneSpecs.find({ phoneId: { $in: ids } }).lean(), Brand.find({ _id: { $in: brandIds } }).select('name slug').lean()]);
  const specsMap = new Map(specs.map(item => { const value = serializePhoneSpecs(item as unknown as Record<string, unknown>); return [String(item.phoneId), value ? { display: String(value.display || ''), charging: String(value.charging || ''), ram: String(value.ram || ''), storage: String(value.storage || '') } : undefined] as const; }));
  const brandMap = new Map(brands.map(item => [String(item._id), { name: item.name, slug: item.slug }]));
  const candidates: RecommendationCandidate[] = phones.map(phone => ({ id: String(phone._id), slug: phone.slug, modelName: phone.modelName, pricePKR: phone.pricePKR, ptaApproved: phone.ptaApproved, cameraScore: phone.cameraScore, performanceScore: phone.performanceScore, batteryScore: phone.batteryScore, displayScore: phone.displayScore, valueScore: phone.valueScore, overallRating: phone.overallRating, lastVerifiedAt: phone.lastVerifiedAt, dataConfidence: phone.dataConfidence, specs: specsMap.get(String(phone._id)) }));
  const results = recommendPhones(candidates, intent, 6).map(result => ({ ...result, phone: { ...result.phone, brand: brandMap.get(String(phones.find(item => String(item._id) === result.phone.id)?.brandId)), href: `/phones/${result.phone.slug}` } }));
  const warnings = [intent.condition ? 'New/used inventory condition is not yet verified, so it was not used as a filter.' : '', results.length === 0 ? 'No verified phones matched the requested filters.' : ''].filter(Boolean);
  return NextResponse.json({ intent, results, warnings, provider: 'phonedock-rule-engine', modelVersion: 'recommendation-v1', externalAIUsed: false }, { headers });
}
