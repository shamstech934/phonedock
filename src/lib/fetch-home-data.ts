/**
 * Shared data-fetching functions for public pages.
 * Used by both the API route handlers AND server components (ISR).
 * This avoids duplicating query logic between /api/home and the homepage server component.
 */

import { Phone, Brand, News, PhoneSpecs, Sponsor } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { phoneToJSON, buildSpecsMap, attachSpecsToJsonPhones, attachSpecsToRawPhones } from '@/app/api/[[...path]]/handlers/helpers';

// ============ BATCH SPECS ATTACHMENT (shared with public.ts) ============

/** Attach specs to an array of phone JSON objects.
 *  Phones must already be run through phoneToJSON (they have `id` as string). */
async function attachBasicSpecs(phones: any[]): Promise<any[]> {
  if (phones.length === 0) return phones;
  // Collect both string ids and original ObjectIds for the lookup
  const ids = phones.map((p: any) => p.id).filter(Boolean);
  if (ids.length === 0) return phones;
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);
  return attachSpecsToJsonPhones(phones, specsMap);
}

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

  const priceCategories = {
    above100k: await attachBasicSpecs(pc_above100k.map((p: any) => phoneToJSON(p))),
    price60to100: await attachBasicSpecs(pc_price60to100.map((p: any) => phoneToJSON(p))),
    price40to60: await attachBasicSpecs(pc_price40to60.map((p: any) => phoneToJSON(p))),
    price20to40: await attachBasicSpecs(pc_price20to40.map((p: any) => phoneToJSON(p))),
    under20k: await attachBasicSpecs(pc_under20k.map((p: any) => phoneToJSON(p))),
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
    featured: await attachBasicSpecs(featured.map((p: any) => phoneToJSON(p))),
    trending: await attachBasicSpecs(trending.map((p: any) => phoneToJSON(p))),
    latest: await attachBasicSpecs(latest.map((p: any) => phoneToJSON(p))),
    bestCamera: await attachBasicSpecs(bestCamera.map((p: any) => phoneToJSON(p))),
    bestGaming: await attachBasicSpecs(bestGaming.map((p: any) => phoneToJSON(p))),
    bestBattery: await attachBasicSpecs(bestBattery.map((p: any) => phoneToJSON(p))),
    upcoming: await attachBasicSpecs(upcoming.map((p: any) => phoneToJSON(p))),
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