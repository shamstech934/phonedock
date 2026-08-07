import { NextRequest, NextResponse } from 'next/server';
import { DataQualityIssue, LaunchCandidate, Phone, PhoneImage, PhoneSpecs, PriceHistory } from '@/lib/models';
import { analyzePriceHistory } from '@/lib/intelligence/price-intelligence';
import { scoreSourceConfidence } from '@/lib/intelligence/source-confidence';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';

interface LeanLaunchCandidate {
  _id: unknown;
  brandName: string;
  modelName: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  confidence?: number;
  availabilityStatus?: string;
  createdAt?: Date;
}

export async function handleIntelligenceCenterGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'phones:read');
  if (denied) return denied;
  await connectDB();

  const [phoneCount, pendingLaunches, qualityOpenIssues, recentCandidates, pricePhoneIds] = await Promise.all([
    Phone.countDocuments({ deletedAt: null }),
    LaunchCandidate.countDocuments({ status: 'pending' }),
    DataQualityIssue.countDocuments({ status: { $in: ['open', 'needs_review'] } }),
    LaunchCandidate.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(12).lean<LeanLaunchCandidate[]>(),
    PriceHistory.distinct('phoneId'),
  ]);

  const phoneIds = pricePhoneIds.slice(0, 30);
  const [phones, histories] = await Promise.all([
    Phone.find({ _id: { $in: phoneIds }, deletedAt: null }).select('modelName slug pricePKR').lean(),
    PriceHistory.find({ phoneId: { $in: phoneIds } }).sort({ recordedAt: 1 }).lean(),
  ]);
  const phoneMap = new Map(phones.map((phone: any) => [String(phone._id), phone]));
  const grouped = new Map<string, Array<{ price: number; recordedAt: Date }>>();
  for (const point of histories as any[]) {
    const key = String(point.phoneId);
    const list = grouped.get(key) || [];
    list.push({ price: Number(point.price), recordedAt: point.recordedAt });
    grouped.set(key, list);
  }
  const priceSignals = Array.from(grouped.entries()).map(([phoneId, points]) => {
    const phone: any = phoneMap.get(phoneId);
    return phone ? { phoneId, modelName: phone.modelName, slug: phone.slug, ...analyzePriceHistory(points, 6) } : null;
  }).filter(Boolean).filter((item: any) => item.status !== 'insufficient-data').slice(0, 10);

  const launches = recentCandidates.map(candidate => {
    const source = scoreSourceConfidence(candidate.sourceUrl || '', candidate.sourceName || '');
    const extracted = Number(candidate.confidence || 0.5);
    const combined = Math.round(((extracted * 0.6) + (source.score * 0.4)) * 100);
    return {
      ...candidate,
      confidencePercent: combined,
      sourceConfidence: source,
    };
  });

  const completenessSample = await Phone.find({ deletedAt: null }).select('_id').sort({ updatedAt: -1 }).limit(300).lean();
  const sampleIds = completenessSample.map((phone: any) => phone._id);
  const [specIds, imageIds, allPhoneIds, allSpecIds, allImageIds] = await Promise.all([
    PhoneSpecs.distinct('phoneId', { phoneId: { $in: sampleIds } }),
    PhoneImage.distinct('phoneId', { phoneId: { $in: sampleIds } }),
    Phone.distinct('_id', { deletedAt: null }),
    PhoneSpecs.distinct('phoneId'),
    PhoneImage.distinct('phoneId'),
  ]);
  const withSpecs = new Set(specIds.map(String)).size;
  const withImages = new Set(imageIds.map(String)).size;
  const sampleSize = sampleIds.length || 1;
  const allSpecSet = new Set(allSpecIds.map(String));
  const allImageSet = new Set(allImageIds.map(String));
  const missingSpecs = allPhoneIds.reduce((n: number, id: unknown) => n + (allSpecSet.has(String(id)) ? 0 : 1), 0);
  const missingImages = allPhoneIds.reduce((n: number, id: unknown) => n + (allImageSet.has(String(id)) ? 0 : 1), 0);
  const openIssues = Math.max(qualityOpenIssues, missingSpecs + missingImages);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      phones: phoneCount,
      pendingLaunches,
      openIssues,
      missingSpecs,
      missingImages,
      specsCoverage: Math.round((withSpecs / sampleSize) * 100),
      imageCoverage: Math.round((withImages / sampleSize) * 100),
      trackedPricePhones: pricePhoneIds.length,
    },
    launches,
    priceSignals,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
