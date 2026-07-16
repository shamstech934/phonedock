import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, News, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice, PriceHistory, UserReview, PriceAlert, Video } from '@/lib/models';
import { connectDB, connectDBSafe, phoneToJSON, Admin } from './helpers';
import { fetchHomeData, fetchHeroPhones } from '@/lib/fetch-home-data';

// ============ CACHE-CONTROL HELPERS ============
// Vercel CDN respects these headers — repeat requests are served from edge cache
// without hitting the origin server function or MongoDB.

function cached(json: any, sMaxAge: number, swr: number) {
  return NextResponse.json(json, {
    headers: { 'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` },
  });
}

function cachedError(msg: string, status: number, sMaxAge: number, swr: number) {
  return NextResponse.json({ error: msg }, {
    status,
    headers: { 'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` },
  });
}

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
      return cached({ status: dbOk ? 'ok' : 'unhealthy', db: dbOk ? 'connected' : 'disconnected' }, 30, 120);
    } catch {
      return cachedError('Database connection failed', 503, 10, 60);
    }
  }

  // ---- /api/home ----
  if (segments.length === 1 && segments[0] === 'home') {
    const data = await fetchHomeData();
    return cached(data, 60, 300);
  }

  // ---- /api/hero-phones (featured phones with specs for hero slider) ----
  if (segments.length === 1 && segments[0] === 'hero-phones') {
    const phones = await fetchHeroPhones();
    return cached({ phones }, 60, 300);
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

    // Numeric spec range filters (Phase 3)
    const ramMin = parseFloat(url.searchParams.get('ramMin') || '');
    const ramMax = parseFloat(url.searchParams.get('ramMax') || '');
    const screenMin = parseFloat(url.searchParams.get('screenMin') || '');
    const screenMax = parseFloat(url.searchParams.get('screenMax') || '');
    const priceMin = parseFloat(url.searchParams.get('priceMin') || '');
    const priceMax = parseFloat(url.searchParams.get('priceMax') || '');
    const cameraMin = parseFloat(url.searchParams.get('cameraMin') || '');
    const batteryMin = parseFloat(url.searchParams.get('batteryMin') || '');

    // Price range filter on Phone model
    if (priceMin > 0) filter.pricePKR = { ...filter.pricePKR, $gte: priceMin };
    if (priceMax > 0) filter.pricePKR = { ...(filter.pricePKR || {}), $lte: priceMax };

    // Numeric spec filters require joining with PhoneSpecs
    const hasSpecFilters = !isNaN(ramMin) || !isNaN(ramMax) || !isNaN(screenMin) || !isNaN(screenMax) || !isNaN(cameraMin) || !isNaN(batteryMin);

    if (hasSpecFilters) {
      const specFilter: any = {};
      if (!isNaN(ramMin)) specFilter.ramGB = { ...specFilter.ramGB, $gte: ramMin };
      if (!isNaN(ramMax)) specFilter.ramGB = { ...(specFilter.ramGB || {}), $lte: ramMax };
      if (!isNaN(screenMin)) specFilter.screenSizeInch = { ...specFilter.screenSizeInch, $gte: screenMin };
      if (!isNaN(screenMax)) specFilter.screenSizeInch = { ...(specFilter.screenSizeInch || {}), $lte: screenMax };
      if (!isNaN(cameraMin)) specFilter.mainCameraMP = { $gte: cameraMin };
      if (!isNaN(batteryMin)) specFilter.batteryMAh = { $gte: batteryMin };

      const matchingSpecPhoneIds = await PhoneSpecs.find(specFilter).distinct('phoneId');
      filter._id = { ...(filter._id || {}), $in: matchingSpecPhoneIds };
    }

    const [phones, total] = await Promise.all([
      Phone.find(filter).sort({ [sort]: order }).skip((page - 1) * limit).limit(limit).populate('brand').lean(),
      Phone.countDocuments(filter),
    ]);
    return cached({ phones: phones.map((p: any) => phoneToJSON(p)), total, page, limit }, 120, 300);
  }

  // ---- /api/phones/:slug ----
  if (segments.length === 2 && segments[0] === 'phones') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' }).populate('brand');
    if (!phone) return cachedError('Not found', 404, 60, 300);
    const [specs, benchmarks, images, prices, related, phoneVideos] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).lean(),
      Phone.find({ active: true, status: 'published', brandId: phone.brandId, _id: { $ne: phone._id } }).sort({ createdAt: -1 }).limit(6).populate('brand').lean(),
      Video.find({ phoneId: phone._id, active: true }).sort({ publishedAt: -1 }).lean(),
    ]);
    const phoneJSON: any = phoneToJSON(phone, specs, benchmarks, images, prices);
    phoneJSON.videos = phoneVideos.map((v: any) => ({
      id: v._id?.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt,
    }));
    await Phone.updateOne({ _id: phone._id }, { $inc: { views: 1 } });
    return cached({ phone: phoneJSON, related: related.map((p: any) => phoneToJSON(p)) }, 300, 600);
  }

  // ---- /api/phones/:slug/price-history ----
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-history') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return cachedError('Not found', 404, 60, 300);
    const history = await PriceHistory.find({ phoneId: phone._id }).sort({ recordedAt: 1 }).lean();
    // Group by storeName for chart data
    const storeNames = [...new Set(history.map((h: any) => h.storeName ?? 'Base Price'))];
    return cached({ history, storeNames }, 60, 300);
  }

  // ---- /api/phones/:slug/reviews ----
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'reviews') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return cachedError('Not found', 404, 60, 300);
    const reviews = await UserReview.find({ phoneId: phone._id, status: 'approved' }).sort({ createdAt: -1 }).lean();
    const avg = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';
    return cached({ reviews, total: reviews.length, average: parseFloat(avg) }, 60, 300);
  }

  // ---- /api/phones/:slug/price-alerts (POST subscribe, GET check) ----
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-alerts') {
    return; // handled by POST in route.ts
  }

  // ---- /api/price-alerts/unsubscribe (GET) ----
  if (segments.length === 2 && segments[0] === 'price-alerts' && segments[1] === 'unsubscribe') {
    await connectDB();
    const email = new URL(req.url).searchParams.get('email') || '';
    const phoneId = new URL(req.url).searchParams.get('phoneId') || '';
    if (!email || !phoneId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    await PriceAlert.updateOne({ phoneId, email }, { $set: { unsubscribedAt: new Date(), notified: true } });
    return NextResponse.json({ success: true, message: 'Unsubscribed successfully' });
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
    return cached({ brands: brands.map((b: any) => ({ ...b, id: b._id?.toString(), _count: { phones: b._count || 0 } })) }, 120, 300);
  }

  // ---- /api/brands/:slug ----
  if (segments.length === 2 && segments[0] === 'brands') {
    await connectDB();
    const brand = await Brand.findOne({ slug: segments[1], active: true }).lean();
    if (!brand) return cachedError('Not found', 404, 60, 300);
    const phones = await Phone.find({ brandId: brand._id, active: true, status: 'published' }).populate('brand').lean();
    return cached({ brand, phones: phones.map((p: any) => phoneToJSON(p)) }, 300, 600);
  }

  // ---- /api/news ----
  if (segments.length === 1 && segments[0] === 'news') {
    await connectDB();
    const news = await News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).lean();
    return cached({ news: news.map((n: any) => ({ id: n._id?.toString(), ...n, imageUrl: n.image || '' })) }, 120, 300);
  }

  // ---- /api/news/:slug ----
  if (segments.length === 2 && segments[0] === 'news') {
    await connectDB();
    const article = await News.findOne({ slug: segments[1], published: true }).lean();
    if (!article) return cachedError('Not found', 404, 60, 300);
    await News.updateOne({ _id: article._id }, { $inc: { views: 1 } });
    return cached(article, 300, 600);
  }

  // ---- /api/search ----
  if (segments.length === 1 && segments[0] === 'search') {
    await connectDB();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return cached({ phones: [], brands: [], query: q }, 60, 180);
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
    return cached({ phones: phones.map((p: any) => phoneToJSON(p)), brands, query: q }, 60, 180);
  }

  // ---- /api/videos ----
  if (segments.length === 1 && segments[0] === 'videos') {
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10)));
    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      Video.find({ active: true }).sort({ publishedAt: -1 }).skip(skip).limit(limit).populate('phoneId', 'modelName slug thumbnail brand').lean(),
      Video.countDocuments({ active: true }),
    ]);
    const mapped = videos.map((v: any) => ({
      id: v._id?.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt,
      phone: v.phoneId ? {
        id: v.phoneId._id?.toString(),
        modelName: v.phoneId.modelName,
        slug: v.phoneId.slug,
        thumbnail: v.phoneId.thumbnail || '',
        brand: v.phoneId.brand?.name || '',
      } : null,
    }));
    return cached({ videos: mapped, total, page, limit, totalPages: Math.ceil(total / limit) }, 120, 300);
  }

  return undefined;
}