/**
 * Shared server-side data fetcher for "best-*" ranking pages.
 * Calls MongoDB directly — NO internal HTTP fetch during build or request.
 * Used by: best-budget, best-camera, best-gaming, best-value, best-battery, upcoming.
 */
import { Phone, PhoneSpecs, Brand } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { serializePhoneSpecs } from '@/app/api/[[...path]]/handlers/helpers';
import type { Phone as PhoneType, PhoneSpecs as PhoneSpecsType } from '@/components/shared/types';
import { unstable_cache } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeanDoc = any;

// Field allowlist for card-level queries (excludes heavy fields)
const CARD_SELECT = '-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl -manualLock -manualLockReason -sourceUrl -priceMode -preferredPriceSourceId -lastVerifiedAt -dataConfidence -createdBy -updatedBy -publishedBy -publishedAt -deletedAt -currentPrice -previousPrice -lowestPrice -highestPrice -priceChange -percentageChange -lastPriceCheckedAt -lastPriceChangedAt';

const SORT_FIELDS = new Set([
  'cameraScore', 'batteryScore', 'performanceScore',
  'valueScore', 'displayScore', 'overallRating', 'pricePKR',
]);

function mapPhone(p: LeanDoc, brandMap: Map<string, LeanDoc>, specsMap: Map<string | undefined, LeanDoc>): PhoneType {
  const b = brandMap.get(p.brandId?.toString() || '');
  const rawSpec = specsMap.get(p._id?.toString());
  return {
    id: p._id?.toString(),
    slug: p.slug as string,
    modelName: p.modelName as string,
    brandId: p.brandId?.toString() || '',
    brand: b ? { id: b._id?.toString(), name: b.name as string, slug: b.slug as string, logo: (b.logo as string) || '', country: '', description: '' } : undefined,
    thumbnail: (p.thumbnail as string) || '',
    pricePKR: (p.pricePKR as number) || 0,
    originalPricePKR: (p.originalPricePKR as number) || 0,
    description: '',
    overallRating: (p.overallRating as number) || 0,
    cameraScore: (p.cameraScore as number) || 0,
    performanceScore: (p.performanceScore as number) || 0,
    batteryScore: (p.batteryScore as number) || 0,
    displayScore: (p.displayScore as number) || 0,
    valueScore: (p.valueScore as number) || 0,
    ptaStatus: (p.ptaStatus as string) || 'Unknown',
    ptaApproved: (p.ptaApproved as boolean) || false,
    releaseDate: (p.releaseDate as string) || '',
    trending: (p.trending as boolean) || false,
    upcoming: (p.upcoming as boolean) || false,
    featured: (p.featured as boolean) || false,
    specs: rawSpec ? (serializePhoneSpecs(rawSpec as Record<string, unknown>) as unknown as PhoneSpecsType) : undefined,
  };
}

/**
 * Fetch top phones sorted by a score field, with bulk-attached specs.
 * All queries are optimized: lean, select, limit, indexed filter, bulk $in specs.
 * No N+1 — brands and specs fetched in 2 bulk queries via Promise.all.
 */
async function loadTopPhones(
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
  const phoneIds = phones.map((p: LeanDoc) => p._id.toString());
  const brandIds = [...new Set(phones.map((p: LeanDoc) => (p.brandId as { toString(): string } | undefined)?.toString()).filter(Boolean))];

  const [brands, specsArr] = await Promise.all([
    brandIds.length > 0
      ? Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
      : Promise.resolve([] as LeanDoc[]),
    PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean(),
  ]);

  const brandMap = new Map(brands.map((b: LeanDoc) => [b._id.toString(), b]));
  const specsMap = new Map(specsArr.map((s: LeanDoc) => [(s.phoneId as { toString(): string } | undefined)?.toString(), s]));

  return phones.map((p: LeanDoc) => mapPhone(p, brandMap, specsMap));
}

export const getTopPhones = unstable_cache(loadTopPhones, ['top-phones-v1'], { revalidate: 300, tags: ['phones', 'rankings'] });
export const getUpcomingPhones = unstable_cache(loadUpcomingPhones, ['upcoming-phones-v1'], { revalidate: 300, tags: ['phones', 'rankings'] });
/**
 * Fetch upcoming phones with bulk-attached specs.
 */
async function loadUpcomingPhones(limit = 20): Promise<PhoneType[]> {
  await connectDB();

  const phones = await Phone.find({ active: true, upcoming: true })
    .select(CARD_SELECT)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (phones.length === 0) return [];

  const phoneIds = phones.map((p: LeanDoc) => p._id.toString());
  const brandIds = [...new Set(phones.map((p: LeanDoc) => (p.brandId as { toString(): string } | undefined)?.toString()).filter(Boolean))];

  const [brands, specsArr] = await Promise.all([
    brandIds.length > 0
      ? Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
      : Promise.resolve([] as LeanDoc[]),
    PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean(),
  ]);

  const brandMap = new Map(brands.map((b: LeanDoc) => [b._id.toString(), b]));
  const specsMap = new Map(specsArr.map((s: LeanDoc) => [(s.phoneId as { toString(): string } | undefined)?.toString(), s]));

  return phones.map((p: LeanDoc) => mapPhone(p, brandMap, specsMap));
}
