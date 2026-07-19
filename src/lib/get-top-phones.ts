/**
 * Shared server-side data fetcher for "best-*" ranking pages.
 * Calls MongoDB directly — NO internal HTTP fetch during build or request.
 * Used by: best-budget, best-camera, best-gaming, best-value, best-battery, upcoming.
 */
import { Phone, PhoneSpecs, Brand } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { serializePhoneSpecs } from '@/app/api/[[...path]]/handlers/helpers';
import type { Phone as PhoneType } from '@/components/shared/types';

// Field allowlist for card-level queries (excludes heavy fields)
const CARD_SELECT = '-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl -manualLock -manualLockReason -sourceUrl -priceMode -preferredPriceSourceId -lastVerifiedAt -dataConfidence -createdBy -updatedBy -publishedBy -publishedAt -deletedAt -currentPrice -previousPrice -lowestPrice -highestPrice -priceChange -percentageChange -lastPriceCheckedAt -lastPriceChangedAt';

const SORT_FIELDS = new Set([
  'cameraScore', 'batteryScore', 'performanceScore',
  'valueScore', 'displayScore', 'overallRating', 'pricePKR',
]);

/**
 * Fetch top phones sorted by a score field, with bulk-attached specs.
 * All queries are optimized: lean, select, limit, indexed filter, bulk $in specs.
 * No N+1 — brands and specs fetched in 2 bulk queries via Promise.all.
 */
export async function getTopPhones(
  sort: string,
  limit = 20,
): Promise<PhoneType[]> {
  const field = SORT_FIELDS.has(sort) ? sort : 'overallRating';
  await connectDB();

  const phones = await Phone.find({
    active: true,
    status: 'published',
    [field]: { $gt: 0 },
  })
    .select(CARD_SELECT)
    .sort({ [field]: -1 })
    .limit(limit)
    .lean();

  if (phones.length === 0) return [];

  // Bulk lookups in parallel (no N+1, no virtual populate + lean bug)
  const phoneIds = phones.map((p: any) => p._id);
  const brandIds = [...new Set(phones.map((p: any) => p.brandId?.toString()).filter(Boolean))];

  const [brands, specsArr] = await Promise.all([
    brandIds.length > 0
      ? Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
      : Promise.resolve([]),
    PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean(),
  ]);

  const brandMap = new Map(brands.map((b: any) => [b._id.toString(), b]));
  const specsMap = new Map(specsArr.map((s: any) => [s.phoneId?.toString(), s]));

  return phones.map((p: any) => {
    const b = brandMap.get(p.brandId?.toString());
    const rawSpec = specsMap.get(p._id?.toString());
    return {
      id: p._id?.toString(),
      slug: p.slug,
      modelName: p.modelName,
      brandId: p.brandId?.toString(),
      brand: b ? { id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '', country: '', description: '' } : undefined,
      thumbnail: p.thumbnail || '',
      pricePKR: p.pricePKR || 0,
      originalPricePKR: p.originalPricePKR || 0,
      description: '',
      overallRating: p.overallRating || 0,
      cameraScore: p.cameraScore || 0,
      performanceScore: p.performanceScore || 0,
      batteryScore: p.batteryScore || 0,
      displayScore: p.displayScore || 0,
      valueScore: p.valueScore || 0,
      ptaStatus: p.ptaStatus || 'Unknown',
      ptaApproved: p.ptaApproved || false,
      releaseDate: p.releaseDate || '',
      trending: p.trending || false,
      upcoming: p.upcoming || false,
      featured: p.featured || false,
      specs: rawSpec ? (serializePhoneSpecs(rawSpec) as any) : undefined,
    };
  });
}

/**
 * Fetch upcoming phones with bulk-attached specs.
 */
export async function getUpcomingPhones(limit = 20): Promise<PhoneType[]> {
  await connectDB();

  const phones = await Phone.find({ active: true, upcoming: true })
    .select(CARD_SELECT)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (phones.length === 0) return [];

  const phoneIds = phones.map((p: any) => p._id);
  const brandIds = [...new Set(phones.map((p: any) => p.brandId?.toString()).filter(Boolean))];

  const [brands, specsArr] = await Promise.all([
    brandIds.length > 0
      ? Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
      : Promise.resolve([]),
    PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean(),
  ]);

  const brandMap = new Map(brands.map((b: any) => [b._id.toString(), b]));
  const specsMap = new Map(specsArr.map((s: any) => [s.phoneId?.toString(), s]));

  return phones.map((p: any) => {
    const b = brandMap.get(p.brandId?.toString());
    const rawSpec = specsMap.get(p._id?.toString());
    return {
      id: p._id?.toString(),
      slug: p.slug,
      modelName: p.modelName,
      brandId: p.brandId?.toString(),
      brand: b ? { id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '', country: '', description: '' } : undefined,
      thumbnail: p.thumbnail || '',
      pricePKR: p.pricePKR || 0,
      originalPricePKR: p.originalPricePKR || 0,
      description: '',
      overallRating: p.overallRating || 0,
      cameraScore: p.cameraScore || 0,
      performanceScore: p.performanceScore || 0,
      batteryScore: p.batteryScore || 0,
      displayScore: p.displayScore || 0,
      valueScore: p.valueScore || 0,
      ptaStatus: p.ptaStatus || 'Unknown',
      ptaApproved: p.ptaApproved || false,
      releaseDate: p.releaseDate || '',
      trending: p.trending || false,
      upcoming: p.upcoming || false,
      featured: p.featured || false,
      specs: rawSpec ? (serializePhoneSpecs(rawSpec) as any) : undefined,
    };
  });
}