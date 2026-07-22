/**
 * Shared data-fetching functions for public pages.
 * Used by both the API route handlers AND server components (ISR).
 * This avoids duplicating query logic between /api/home and the homepage server component.
 */

import { Types } from 'mongoose';
import { unstable_cache } from 'next/cache';
import { Phone, Brand, News, PhoneSpecs, Sponsor, Video } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { phoneToJSON, buildSpecsMap, attachSpecsToJsonPhones, attachSpecsToRawPhones, type PhoneDocOrJson } from '@/app/api/[[...path]]/handlers/helpers';

// ============ LOCAL TYPES ============

/** Brand aggregation pipeline result (homepage sidebar). */
interface BrandAggResult {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo?: string;
  country?: string;
  description?: string;
  _count: number;
}

/** Lean News document fields used on the homepage. */
interface NewsLeanDoc {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  category?: string;
  author?: string;
  image?: string;
  published?: boolean;
  createdAt: Date;
}

/** Lean Sponsor document fields. */
interface SponsorLeanDoc {
  _id: Types.ObjectId;
  name: string;
  image?: string;
  url?: string;
  position?: string;
  active?: boolean;
}

interface HomeVideoLeanDoc {
  _id: Types.ObjectId;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: Date;
  phoneId?: {
    _id?: Types.ObjectId;
    modelName?: string;
    slug?: string;
    thumbnail?: string;
    brand?: { name?: string };
  } | null;
}

/** Bridge Mongoose lean phone types to phoneToJSON's PhoneDocOrJson parameter. */
const toPhoneRecord = (doc: unknown): Record<string, unknown> =>
  phoneToJSON(doc as PhoneDocOrJson) as Record<string, unknown>;

// Keep homepage card queries small. Long review/SEO/source fields are not rendered here.
const HOME_PHONE_PROJECTION =
  '-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl -manualLockReason';

// ============ BATCH SPECS ATTACHMENT ============
// (attachBasicSpecs removed — fetchHomeData now uses a single batch query below)

// ============ HOMEPAGE DATA ============

async function fetchHomeDataUncached() {
  await connectDB();

  const [featured, trending, latest, bestCamera, bestGaming, bestBattery, upcoming, news, videos] = await Promise.all([
    Phone.find({ active: true, status: 'published', featured: true }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', trending: true }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published' }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', cameraScore: { $gt: 0 } }).sort({ cameraScore: -1 }).limit(4).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', performanceScore: { $gt: 0 } }).sort({ performanceScore: -1 }).limit(4).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', batteryScore: { $gt: 0 } }).sort({ batteryScore: -1 }).limit(4).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', upcoming: true }).sort({ createdAt: -1 }).limit(4).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    News.find({ published: true, status: 'published' }).select('title slug excerpt category author image published createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    Video.find({ active: true }).select('youtubeId title thumbnailUrl publishedAt phoneId').sort({ publishedAt: -1 }).limit(4).populate('phoneId', 'modelName slug thumbnail brandId').lean(),
  ]);

  const [pc_above100k, pc_price60to100, pc_price40to60, pc_price20to40, pc_under20k, brandAgg, sponsors, totalPhones, totalBrands] = await Promise.all([
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 100000 } }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 60000, $lte: 100000 } }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 40000, $lte: 60000 } }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 20000, $lte: 40000 } }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 0, $lte: 20000 } }).sort({ createdAt: -1 }).limit(8).select(HOME_PHONE_PROJECTION).populate('brand').lean(),
    Brand.aggregate([
      { $match: { active: true } },
      { $sort: { sortOrder: 1 } },
      { $lookup: { from: 'phones', let: { brandId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$brandId', '$$brandId'] }, { active: true }, { status: 'published' }] } } }, { $count: 'count' }], as: '_count' } },
      { $addFields: { _count: { $ifNull: [{ $arrayElemAt: ['$_count.count', 0] }, 0] } } },
    ]),
    Sponsor.find({ active: true, $and: [{ $or: [{ startDate: '' }, { startDate: { $lte: new Date().toISOString().slice(0, 10) } }] }, { $or: [{ endDate: '' }, { endDate: { $gte: new Date().toISOString().slice(0, 10) } }] }] }).select('name image url position active campaign utmCampaign priority').sort({ priority: -1 }).lean().catch(() => []),
    Phone.countDocuments({ active: true, status: 'published' }),
    Brand.countDocuments({ active: true }),
  ]);

  // Convert all raw phone arrays to JSON (needed for spec attachment)
  const featuredJson = featured.map(toPhoneRecord);
  const trendingJson = trending.map(toPhoneRecord);
  const latestJson = latest.map(toPhoneRecord);
  const bestCameraJson = bestCamera.map(toPhoneRecord);
  const bestGamingJson = bestGaming.map(toPhoneRecord);
  const bestBatteryJson = bestBattery.map(toPhoneRecord);
  const upcomingJson = upcoming.map(toPhoneRecord);
  const pc_above100kJson = pc_above100k.map(toPhoneRecord);
  const pc_price60to100Json = pc_price60to100.map(toPhoneRecord);
  const pc_price40to60Json = pc_price40to60.map(toPhoneRecord);
  const pc_price20to40Json = pc_price20to40.map(toPhoneRecord);
  const pc_under20kJson = pc_under20k.map(toPhoneRecord);

  // Batch all phone IDs and fetch specs in ONE query
  const allPhoneIds = [
    ...featuredJson.map(p => p.id),
    ...trendingJson.map(p => p.id),
    ...latestJson.map(p => p.id),
    ...bestCameraJson.map(p => p.id),
    ...bestGamingJson.map(p => p.id),
    ...bestBatteryJson.map(p => p.id),
    ...upcomingJson.map(p => p.id),
    ...pc_above100kJson.map(p => p.id),
    ...pc_price60to100Json.map(p => p.id),
    ...pc_price40to60Json.map(p => p.id),
    ...pc_price20to40Json.map(p => p.id),
    ...pc_under20kJson.map(p => p.id),
  ].filter((v): v is string => typeof v === 'string');

  let globalSpecsMap: Map<string, Record<string, unknown>> = new Map();
  if (allPhoneIds.length > 0) {
    const uniquePhoneIds = [...new Set(allPhoneIds)];
    const allSpecs = await PhoneSpecs.find({ phoneId: { $in: uniquePhoneIds } })
      .select('phoneId displaySize displayType refreshRate resolution chipset processor ramGB storageGB mainCamera selfieCamera batteryCapacity chargingSpeed fiveG nfc')
      .lean();
    globalSpecsMap = buildSpecsMap(allSpecs);
  }

  // Helper to attach from pre-built map (synchronous)
  // Cast needed: phoneToJSON produces Record<string,unknown> but consumers expect Phone
  const attachFromMap = (phones: Record<string, unknown>[]) =>
    phones.length > 0 ? attachSpecsToJsonPhones(phones, globalSpecsMap) : phones;

  const priceCategories = {
    above100k: attachFromMap(pc_above100kJson),
    price60to100: attachFromMap(pc_price60to100Json),
    price40to60: attachFromMap(pc_price40to60Json),
    price20to40: attachFromMap(pc_price20to40Json),
    under20k: attachFromMap(pc_under20kJson),
  };

  const brands = brandAgg.map((b: BrandAggResult) => ({
    id: b._id?.toString(),
    name: b.name,
    slug: b.slug,
    logo: b.logo || '',
    country: b.country || '',
    description: b.description || '',
    _count: { phones: b._count || 0 },
  }));

  return {
    featured: attachFromMap(featuredJson),
    trending: attachFromMap(trendingJson),
    latest: attachFromMap(latestJson),
    bestCamera: attachFromMap(bestCameraJson),
    bestGaming: attachFromMap(bestGamingJson),
    bestBattery: attachFromMap(bestBatteryJson),
    upcoming: attachFromMap(upcomingJson),
    news: news.map((n: NewsLeanDoc) => ({
      id: n._id?.toString(),
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt || '',
      content: n.content || '',
      category: n.category || 'General',
      author: n.author || '',
      imageUrl: n.image || '',
      published: n.published || false,
      createdAt: n.createdAt?.toISOString?.() || n.createdAt || '',
    })),
    videos: (videos as unknown as HomeVideoLeanDoc[]).map(v => ({
      id: v._id?.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt?.toISOString?.() || String(v.publishedAt || ''),
      phone: v.phoneId ? {
        id: v.phoneId._id?.toString(),
        modelName: v.phoneId.modelName || '',
        slug: v.phoneId.slug || '',
        thumbnail: v.phoneId.thumbnail || '',
        brand: v.phoneId.brand?.name || '',
      } : null,
    })),
    priceCategories,
    brands,
    sponsors: sponsors.map((s: SponsorLeanDoc) => ({
      id: s._id?.toString(),
      name: s.name,
      image: s.image || '',
      url: s.url || '',
      position: s.position || 'sidebar',
      active: s.active ?? true,
    })),
    totalPhones: totalPhones as number,
    totalBrands: totalBrands as number,
  };
}

/**
 * Cache the expensive homepage aggregation so most requests do not hit MongoDB.
 * Admin mutations can later call revalidateTag('home-data') for immediate refresh.
 */
export const fetchHomeData = unstable_cache(
  fetchHomeDataUncached,
  ['home-data-v2'],
  { revalidate: 300, tags: ['home-data'] },
);

// ============ HERO PHONES (with specs) ============

export async function fetchHeroPhones(selectedSlugs: string[] = []) {
  await connectDB();

  const slugs = [...new Set(selectedSlugs.map(slug => slug.trim()).filter(Boolean))].slice(0, 6);
  let phones = slugs.length
    ? await Phone.find({ active: true, status: 'published', slug: { $in: slugs } }).select(HOME_PHONE_PROJECTION).populate('brand').lean()
    : await Phone.find({ active: true, status: 'published', featured: true })
      .sort({ createdAt: -1 }).limit(6).select(HOME_PHONE_PROJECTION).populate('brand').lean();

  if (slugs.length) {
    const order = new Map(slugs.map((slug, index) => [slug, index]));
    phones.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));
  }

  if (phones.length === 0) {
    phones = await Phone.find({ active: true, status: 'published', pricePKR: { $gt: 150000 } })
      .sort({ createdAt: -1 }).limit(6).select(HOME_PHONE_PROJECTION).populate('brand').lean();
  }

  const ids = phones.map(p => p._id);
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);

  return attachSpecsToRawPhones(phones as unknown as PhoneDocOrJson[], specsMap);
}
