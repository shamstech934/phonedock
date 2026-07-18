/**
 * Shared data-fetching functions for public pages.
 * Used by both the API route handlers AND server components (ISR).
 * This avoids duplicating query logic between /api/home and the homepage server component.
 */

import { Phone, Brand, News, PhoneSpecs, Sponsor } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { phoneToJSON, buildSpecsMap, attachSpecsToJsonPhones, attachSpecsToRawPhones } from '@/app/api/[[...path]]/handlers/helpers';

// ============ BATCH SPECS ATTACHMENT ============
// (attachBasicSpecs removed — fetchHomeData now uses a single batch query below)

// ============ HOMEPAGE DATA ============

export async function fetchHomeData() {
  await connectDB();

  const [featured, trending, latest, bestCamera, bestGaming, bestBattery, upcoming, news] = await Promise.all([
    Phone.find({ active: true, status: 'published', featured: true }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', trending: true }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published' }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', cameraScore: { $gt: 0 } }).sort({ cameraScore: -1 }).limit(4).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', performanceScore: { $gt: 0 } }).sort({ performanceScore: -1 }).limit(4).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', batteryScore: { $gt: 0 } }).sort({ batteryScore: -1 }).limit(4).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', upcoming: true }).sort({ createdAt: -1 }).limit(4).populate('brand').lean(),
    News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  const [pc_above100k, pc_price60to100, pc_price40to60, pc_price20to40, pc_under20k, brandAgg, sponsors, totalPhones, totalBrands] = await Promise.all([
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 100000 } }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 60000, $lte: 100000 } }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 40000, $lte: 60000 } }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 20000, $lte: 40000 } }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Phone.find({ active: true, status: 'published', pricePKR: { $gt: 0, $lte: 20000 } }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
    Brand.aggregate([
      { $match: { active: true } },
      { $sort: { sortOrder: 1 } },
      { $lookup: { from: 'phones', let: { brandId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$brandId', '$$brandId'] }, { active: true }, { status: 'published' }] } } }, { $count: 'count' }], as: '_count' } },
      { $addFields: { _count: { $ifNull: [{ $arrayElemAt: ['$_count.count', 0] }, 0] } } },
    ]),
    Sponsor.find({ active: true }).lean().catch(() => []),
    Phone.countDocuments({ active: true, status: 'published' }),
    Brand.countDocuments({ active: true }),
  ]);

  // Convert all raw phone arrays to JSON (needed for spec attachment)
  const featuredJson = featured.map((p: any) => phoneToJSON(p));
  const trendingJson = trending.map((p: any) => phoneToJSON(p));
  const latestJson = latest.map((p: any) => phoneToJSON(p));
  const bestCameraJson = bestCamera.map((p: any) => phoneToJSON(p));
  const bestGamingJson = bestGaming.map((p: any) => phoneToJSON(p));
  const bestBatteryJson = bestBattery.map((p: any) => phoneToJSON(p));
  const upcomingJson = upcoming.map((p: any) => phoneToJSON(p));
  const pc_above100kJson = pc_above100k.map((p: any) => phoneToJSON(p));
  const pc_price60to100Json = pc_price60to100.map((p: any) => phoneToJSON(p));
  const pc_price40to60Json = pc_price40to60.map((p: any) => phoneToJSON(p));
  const pc_price20to40Json = pc_price20to40.map((p: any) => phoneToJSON(p));
  const pc_under20kJson = pc_under20k.map((p: any) => phoneToJSON(p));

  // Batch all phone IDs and fetch specs in ONE query
  const allPhoneIds = [
    ...featuredJson.map((p: any) => p.id),
    ...trendingJson.map((p: any) => p.id),
    ...latestJson.map((p: any) => p.id),
    ...bestCameraJson.map((p: any) => p.id),
    ...bestGamingJson.map((p: any) => p.id),
    ...bestBatteryJson.map((p: any) => p.id),
    ...upcomingJson.map((p: any) => p.id),
    ...pc_above100kJson.map((p: any) => p.id),
    ...pc_price60to100Json.map((p: any) => p.id),
    ...pc_price40to60Json.map((p: any) => p.id),
    ...pc_price20to40Json.map((p: any) => p.id),
    ...pc_under20kJson.map((p: any) => p.id),
  ].filter(Boolean);

  let globalSpecsMap: Map<string, any> = new Map();
  if (allPhoneIds.length > 0) {
    const allSpecs = await PhoneSpecs.find({ phoneId: { $in: allPhoneIds } }).lean();
    globalSpecsMap = buildSpecsMap(allSpecs);
  }

  // Helper to attach from pre-built map (synchronous)
  const attachFromMap = (phones: any[]) =>
    phones.length > 0 ? attachSpecsToJsonPhones(phones, globalSpecsMap) : phones;

  const priceCategories = {
    above100k: attachFromMap(pc_above100kJson),
    price60to100: attachFromMap(pc_price60to100Json),
    price40to60: attachFromMap(pc_price40to60Json),
    price20to40: attachFromMap(pc_price20to40Json),
    under20k: attachFromMap(pc_under20kJson),
  };

  const brands = brandAgg.map((b: any) => ({
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
    news: news.map((n: any) => ({
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
    priceCategories,
    brands,
    sponsors: (sponsors as any[]).map((s: any) => ({
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

// ============ HERO PHONES (with specs) ============

export async function fetchHeroPhones() {
  await connectDB();

  let phones = await Phone.find({ active: true, status: 'published', featured: true })
    .sort({ createdAt: -1 }).limit(6).populate('brand').lean();

  if (phones.length === 0) {
    phones = await Phone.find({ active: true, status: 'published', pricePKR: { $gt: 150000 } })
      .sort({ createdAt: -1 }).limit(6).populate('brand').lean();
  }

  const ids = phones.map((p: any) => p._id);
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);

  return attachSpecsToRawPhones(phones, specsMap);
}