import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, News, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice } from '@/lib/models';
import { connectDB, connectDBSafe, phoneToJSON, Admin } from './helpers';

// ============ PUBLIC GET HANDLERS ============

export async function handlePublicGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/health (public, no auth) — no env var status disclosure ----
  if (segments.length === 1 && segments[0] === 'health') {
    try {
      const conn = await connectDBSafe();
      const dbOk = !!conn;
      let adminCount = 'error';
      if (dbOk) {
        try { adminCount = String(await Admin.countDocuments()); } catch { /* */ }
      }
      return NextResponse.json({ status: dbOk ? 'ok' : 'unhealthy', db: dbOk ? 'connected' : 'disconnected' });
    } catch {
      return NextResponse.json({ status: 'unhealthy', db: 'disconnected' }, { status: 503 });
    }
  }

  // ---- /api/home ----
  if (segments.length === 1 && segments[0] === 'home') {
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
    const [pc_above100k, pc_price60to100, pc_price40to60, pc_price20to40, pc_under20k, brandAgg, sponsors] = await Promise.all([
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
      (await import('@/lib/models/Other')).Sponsor.find({ active: true }).lean().catch(() => []),
    ]);
    const priceCategories = {
      above100k: pc_above100k.map((p: any) => phoneToJSON(p)),
      price60to100: pc_price60to100.map((p: any) => phoneToJSON(p)),
      price40to60: pc_price40to60.map((p: any) => phoneToJSON(p)),
      price20to40: pc_price20to40.map((p: any) => phoneToJSON(p)),
      under20k: pc_under20k.map((p: any) => phoneToJSON(p)),
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
    return NextResponse.json({
      featured: featured.map((p: any) => phoneToJSON(p)),
      trending: trending.map((p: any) => phoneToJSON(p)),
      latest: latest.map((p: any) => phoneToJSON(p)),
      bestCamera: bestCamera.map((p: any) => phoneToJSON(p)),
      bestGaming: bestGaming.map((p: any) => phoneToJSON(p)),
      bestBattery: bestBattery.map((p: any) => phoneToJSON(p)),
      upcoming: upcoming.map((p: any) => phoneToJSON(p)),
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
    });
  }

  // ---- /api/phones ----
  if (segments.length === 1 && segments[0] === 'phones') {
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const search = url.searchParams.get('search') || '';
    const brand = url.searchParams.get('brand') || '';
    const ALLOWED_SORTS = new Set(['createdAt', 'pricePKR', 'modelName', 'overallRating', 'cameraScore', 'performanceScore', 'batteryScore', 'displayScore', 'views']);
    const sort = ALLOWED_SORTS.has(url.searchParams.get('sort') || '') ? (url.searchParams.get('sort')!) : 'createdAt';
    const order = url.searchParams.get('order') === 'asc' ? 1 : -1;

    const filter: any = { active: true, status: 'published' };
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
      ];
    }
    if (brand) { const b = await Brand.findOne({ slug: brand }); if (b) filter.brandId = b._id; }

    const [phones, total] = await Promise.all([
      Phone.find(filter).sort({ [sort]: order }).skip((page - 1) * limit).limit(limit).populate('brand').lean(),
      Phone.countDocuments(filter),
    ]);
    return NextResponse.json({ phones: phones.map((p: any) => phoneToJSON(p)), total, page, limit });
  }

  // ---- /api/phones/:slug ----
  if (segments.length === 2 && segments[0] === 'phones') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' }).populate('brand');
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [specs, benchmarks, images, prices, related] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).lean(),
      Phone.find({ active: true, status: 'published', brandId: phone.brandId, _id: { $ne: phone._id } }).sort({ createdAt: -1 }).limit(6).populate('brand').lean(),
    ]);
    await Phone.updateOne({ _id: phone._id }, { $inc: { views: 1 } });
    return NextResponse.json({ phone: phoneToJSON(phone, specs, benchmarks, images, prices), related: related.map((p: any) => phoneToJSON(p)) });
  }

  // ---- /api/brands ----
  if (segments.length === 1 && segments[0] === 'brands') {
    await connectDB();
    const brands = await Brand.aggregate([
      { $match: { active: true } },
      { $sort: { sortOrder: 1 } },
      { $lookup: { from: 'phones', let: { brandId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$brandId', '$$brandId'] }, { active: true }, { status: 'published' }] } } }, { $count: 'count' }], as: '_count' } },
      { $addFields: { _count: { $ifNull: [{ $arrayElemAt: ['$_count.count', 0] }, 0] } } },
    ]);
    return NextResponse.json(brands.map((b: any) => ({ ...b, id: b._id?.toString(), _count: { phones: b._count || 0 } })));
  }

  // ---- /api/brands/:slug ----
  if (segments.length === 2 && segments[0] === 'brands') {
    await connectDB();
    const brand = await Brand.findOne({ slug: segments[1], active: true }).lean();
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const phones = await Phone.find({ brandId: brand._id, active: true, status: 'published' }).populate('brand').lean();
    return NextResponse.json({ brand, phones: phones.map((p: any) => phoneToJSON(p)) });
  }

  // ---- /api/news ----
  if (segments.length === 1 && segments[0] === 'news') {
    await connectDB();
    const news = await News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ news: news.map((n: any) => ({ id: n._id?.toString(), ...n, imageUrl: n.image || '' })) });
  }

  // ---- /api/news/:slug ----
  if (segments.length === 2 && segments[0] === 'news') {
    await connectDB();
    const article = await News.findOne({ slug: segments[1], published: true }).lean();
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await News.updateOne({ _id: article._id }, { $inc: { views: 1 } });
    return NextResponse.json(article);
  }

  // ---- /api/search ----
  if (segments.length === 1 && segments[0] === 'search') {
    await connectDB();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ phones: [], brands: [], query: q });
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [phones, brandAgg] = await Promise.all([
      Phone.find({ active: true, status: 'published', $or: [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ] }).sort({ createdAt: -1 }).limit(20).populate('brand').lean(),
      Brand.aggregate([
        { $match: { active: true, name: { $regex: safe, $options: 'i' } } },
        { $sort: { sortOrder: 1 } },
        { $lookup: { from: 'phones', let: { brandId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$brandId', '$$brandId'] }, { active: true }, { status: 'published' }] } } }, { $count: 'count' }], as: '_count' } },
        { $addFields: { _count: { $ifNull: [{ $arrayElemAt: ['$_count.count', 0] }, 0] } } },
      ]),
    ]);
    const brands = brandAgg.map((b: any) => ({ ...b, id: b._id?.toString(), _count: { phones: b._count || 0 } }));
    return NextResponse.json({ phones: phones.map((p: any) => phoneToJSON(p)), brands, query: q });
  }

  return undefined;
}