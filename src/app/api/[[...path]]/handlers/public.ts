import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, News, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice, PriceHistory, UserReview, PriceAlert, Video, PriceTrackerHistory } from '@/lib/models';
import { connectDB, connectDBSafe, phoneToJSON, Admin, sanitizeInput, isEmailConfigured, serializePhoneSpecs, buildSpecsMap, attachSpecsToRawPhones, attachSpecsToJsonPhones } from './helpers';
import { verifyTurnstile } from '@/lib/turnstile';
import { fetchHomeData, fetchHeroPhones } from '@/lib/fetch-home-data';
import { escapeRegex } from '@/lib/sanitize';
import { getEmailTransporter } from '@/lib/email';

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

// ============ BATCH SPECS ATTACHMENT (reusable) ============

async function attachListSpecs(phones: any[]): Promise<any[]> {
  if (phones.length === 0) return phones;
  const ids = phones.map((p: any) => p._id);
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);
  return attachSpecsToRawPhones(phones, specsMap);
}

// ============ PUBLIC GET HANDLERS ============

export async function handlePublicGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/build-info (deployment verification) ----
  if (segments.length === 1 && segments[0] === 'build-info') {
    return NextResponse.json({
      buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
      environment: process.env.VERCEL_ENV || 'local',
    });
  }

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
    const ALLOWED_SORTS = new Set(['createdAt', 'pricePKR', 'modelName', 'overallRating', 'cameraScore', 'performanceScore', 'batteryScore', 'displayScore', 'views', 'trending']);
    const sort = ALLOWED_SORTS.has(url.searchParams.get('sort') || '') ? (url.searchParams.get('sort')!) : 'createdAt';
    const order = url.searchParams.get('order') === 'asc' ? 1 : -1;

    // Boolean/enum filters
    const ptaFilter = url.searchParams.get('pta') || '';
    const fiveGFilter = url.searchParams.get('5g') || '';
    const nfcFilter = url.searchParams.get('nfc') || '';
    const trendingOnly = url.searchParams.get('trending') === 'true';
    const priceDropOnly = url.searchParams.get('priceDrop') === 'true';

    const filter: any = { active: true, status: 'published' };
    if (trendingOnly) filter.trending = true;
    if (ptaFilter === 'approved') filter.ptaApproved = true;
    else if (ptaFilter === 'pending') filter.ptaApproved = false;
    if (priceDropOnly) filter.$expr = { $gt: ['$originalPricePKR', '$pricePKR'] };
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
      ];
    }
    if (brand) { const b = await Brand.findOne({ slug: brand }); if (b) filter.brandId = b._id; }

    // Numeric spec range filters (Phase 3)
    const ramMin = parseFloat(url.searchParams.get('ramMin') || '');
    const ramMax = parseFloat(url.searchParams.get('ramMax') || '');
    const storageMin = parseFloat(url.searchParams.get('storageMin') || '');
    const storageMax = parseFloat(url.searchParams.get('storageMax') || '');
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
    const hasSpecFilters = !isNaN(ramMin) || !isNaN(ramMax) || !isNaN(storageMin) || !isNaN(storageMax) || !isNaN(screenMin) || !isNaN(screenMax) || !isNaN(cameraMin) || !isNaN(batteryMin) || fiveGFilter !== '' || nfcFilter !== '';

    if (hasSpecFilters) {
      const specFilter: any = {};
      if (!isNaN(ramMin)) specFilter.ramGB = { ...specFilter.ramGB, $gte: ramMin };
      if (!isNaN(ramMax)) specFilter.ramGB = { ...(specFilter.ramGB || {}), $lte: ramMax };
      if (!isNaN(storageMin)) specFilter.storageGB = { ...specFilter.storageGB, $gte: storageMin };
      if (!isNaN(storageMax)) specFilter.storageGB = { ...(specFilter.storageGB || {}), $lte: storageMax };
      if (!isNaN(screenMin)) specFilter.screenSizeInch = { ...specFilter.screenSizeInch, $gte: screenMin };
      if (!isNaN(screenMax)) specFilter.screenSizeInch = { ...(specFilter.screenSizeInch || {}), $lte: screenMax };
      if (!isNaN(cameraMin)) specFilter.mainCameraMP = { $gte: cameraMin };
      if (!isNaN(batteryMin)) specFilter.batteryMAh = { $gte: batteryMin };
      if (fiveGFilter === 'yes') specFilter.fiveG = { $regex: /yes|supported|true/i };
      else if (fiveGFilter === 'no') specFilter.fiveG = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };
      if (nfcFilter === 'yes') specFilter.nfc = { $regex: /yes|supported|true/i };
      else if (nfcFilter === 'no') specFilter.nfc = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };

      const matchingSpecPhoneIds = await PhoneSpecs.find(specFilter).distinct('phoneId');
      filter._id = { ...(filter._id || {}), $in: matchingSpecPhoneIds };
    }

    const [phones, total] = await Promise.all([
      Phone.find(filter).sort({ [sort]: order }).skip((page - 1) * limit).limit(limit)
        .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
        .populate('brand').lean(),
      Phone.countDocuments(filter),
    ]);

    const phonesWithSpecs = await attachListSpecs(phones);
    return cached({ phones: phonesWithSpecs, total, page, limit }, 120, 300);
  }

  // ---- /api/phones/lookup (compare phone lookup by slugs/IDs) ----
  if (segments.length === 2 && segments[0] === 'phones' && segments[1] === 'lookup') {
    await connectDB();
    const url = new URL(req.url);
    const slugs = (url.searchParams.get('slugs') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    if (slugs.length === 0 && ids.length === 0) return NextResponse.json({ phones: [] });
    const filter: any = { active: true, status: 'published' };
    if (slugs.length > 0) filter.slug = { $in: slugs };
    if (ids.length > 0) filter._id = { $in: ids };
    const phones = await Phone.find(filter).populate('brand').lean();
    return cached({ phones: await attachListSpecs(phones) }, 60, 300);
  }

  // ---- /api/phones/autocomplete?q=... ----
  if (segments.length === 2 && segments[0] === 'phones' && segments[1] === 'autocomplete') {
    await connectDB();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return cached({ phones: [] }, 60, 180);
    const safe = escapeRegex(q);
    const phones = await Phone.find({
      active: true, status: 'published',
      $or: [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
      ]
    }).select('slug modelName thumbnail pricePKR brandId').sort({ modelName: 1 }).limit(20).lean();
    // Manual brand lookup — virtual populate + .lean() drops selected fields
    const brandIds = [...new Set(phones.map((p: any) => p.brandId?.toString()).filter(Boolean))];
    const brands = brandIds.length > 0 ? await Brand.find({ _id: { $in: brandIds } }).select('name slug').lean() : [];
    const brandMap = new Map(brands.map((b: any) => [b._id.toString(), b]));
    return cached({ phones: phones.map((p: any) => {
      const b = brandMap.get(p.brandId?.toString());
      return {
        id: p._id?.toString(),
        slug: p.slug,
        modelName: p.modelName,
        thumbnail: p.thumbnail || '',
        pricePKR: p.pricePKR,
        brand: b ? { id: p.brandId?.toString(), name: b.name, slug: b.slug } : null,
      };
    })}, 60, 180);
  }

  // ---- /api/phones/:slug ----
  if (segments.length === 2 && segments[0] === 'phones') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' }).select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl').populate('brand');
    if (!phone) return cachedError('Not found', 404, 60, 300);
    const [specs, benchmarks, images, prices, related, phoneVideos] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).limit(10).lean(),
      Phone.find({ active: true, status: 'published', brandId: phone.brandId, _id: { $ne: phone._id } }).select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl').sort({ createdAt: -1 }).limit(6).populate('brand').lean(),
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
    return cached({ phone: phoneJSON, related: await attachListSpecs(related) }, 300, 600);
  }

  // ---- /api/phones/:slug/price-history ----
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-history') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return cachedError('Not found', 404, 60, 300);
    const history = await PriceHistory.find({ phoneId: phone._id }).sort({ recordedAt: 1 }).limit(365).lean();
    // Group by storeName for chart data
    const storeNames = [...new Set(history.map((h: any) => h.storeName ?? 'Base Price'))];
    return cached({ history, storeNames }, 60, 300);
  }

  // ---- /api/phones/:slug/price-tracker ----
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-tracker') {
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return cachedError('Not found', 404, 60, 300);

    const confirmed = await PriceTrackerHistory.find({ phoneId: phone._id, verificationStatus: 'confirmed' })
      .sort({ capturedAt: -1 })
      .limit(90)
      .lean();

    const currentPrice = phone.pricePKR || 0;
    const previousPrice = confirmed.length >= 2 ? confirmed[1].newPrice : (confirmed.length === 1 ? confirmed[0].oldPrice : 0);
    const allPrices = confirmed.map((h: any) => h.newPrice);
    const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const highestPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    const priceChange = previousPrice > 0 ? currentPrice - previousPrice : 0;
    const percentageChange = previousPrice > 0 ? Math.round((priceChange / previousPrice) * 10000) / 100 : 0;
    const lastPriceChangedAt = confirmed.length > 0 ? confirmed[0].capturedAt : null;

    return cached({
      currentPrice,
      previousPrice,
      lowestPrice,
      highestPrice,
      priceChange,
      percentageChange,
      lastPriceChangedAt,
      priceMode: phone.priceMode || 'manual',
      manualLock: phone.manualLock || false,
      history: confirmed.map((h: any) => ({
        id: h._id?.toString(),
        oldPrice: h.oldPrice,
        newPrice: h.newPrice,
        difference: h.difference,
        percentageChange: h.percentageChange,
        changeType: h.changeType,
        sourceType: h.sourceType,
        capturedAt: h.capturedAt,
      })),
    }, 60, 300);
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
    ]).limit(100);
    return cached({ brands: brands.map((b: any) => ({ ...b, id: b._id?.toString(), _count: { phones: b._count || 0 } })) }, 120, 300);
  }

  // ---- /api/brands/:slug ----
  if (segments.length === 2 && segments[0] === 'brands') {
    await connectDB();
    const brand = await Brand.findOne({ slug: segments[1], active: true }).lean();
    if (!brand) return cachedError('Not found', 404, 60, 300);
    const phones = await Phone.find({ brandId: brand._id, active: true, status: 'published' })
      .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
      .limit(100)
      .populate('brand').lean();
    return cached({ brand, phones: await attachListSpecs(phones) }, 300, 600);
  }

  // ---- /api/news ----
  if (segments.length === 1 && segments[0] === 'news') {
    await connectDB();
    const news = await News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).limit(20).lean();
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
    const safe = escapeRegex(q);
    const [phones, brandAgg] = await Promise.all([
      Phone.find({ active: true, status: 'published', $or: [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ] }).sort({ createdAt: -1 }).limit(20)
        .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
        .populate('brand').lean(),
      Brand.aggregate([
        { $match: { active: true, name: { $regex: safe, $options: 'i' } } },
        { $sort: { sortOrder: 1 } },
        { $lookup: { from: 'phones', let: { brandId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$brandId', '$$brandId'] }, { active: true }, { status: 'published' }] } } }, { $count: 'count' }], as: '_count' } },
        { $addFields: { _count: { $ifNull: [{ $arrayElemAt: ['$_count.count', 0] }, 0] } } },
      ]),
    ]);
    const brands = brandAgg.map((b: any) => ({ ...b, id: b._id?.toString(), _count: { phones: b._count || 0 } }));
    return cached({ phones: await attachListSpecs(phones), brands, query: q }, 60, 180);
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

  // ---- /api/settings (public, read-only) ----
  if (segments.length === 1 && segments[0] === 'settings') {
    const { getSettings } = await import('@/lib/models');
    const settings = await getSettings();
    const { maintenanceMode, ...publicSettings } = settings;
    return cached({ settings: { id: publicSettings._id?.toString(), ...publicSettings, _id: undefined } }, 300, 600);
  }

  // ---- /api/top-phones?sort=cameraScore|batteryScore|performanceScore|valueScore|overallRating&limit=10 ----
  if (segments.length === 1 && segments[0] === 'top-phones') {
    await connectDB();
    const url = new URL(req.url);
    const ALLOWED = new Set(['cameraScore', 'batteryScore', 'performanceScore', 'valueScore', 'displayScore', 'overallRating', 'pricePKR']);
    const sort = ALLOWED.has(url.searchParams.get('sort') || '') ? (url.searchParams.get('sort')!) : 'overallRating';
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const order = url.searchParams.get('order') === 'asc' ? 1 : -1;
    const phones = await Phone.find({ active: true, status: 'published', [sort]: { $gt: 0 } })
      .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
      .sort({ [sort]: order }).limit(limit).populate('brand').lean();
    return cached({ phones: await attachListSpecs(phones), sortBy: sort }, 300, 600);
  }

  // ---- /api/upcoming-phones ----
  if (segments.length === 1 && segments[0] === 'upcoming-phones') {
    await connectDB();
    const phones = await Phone.find({ active: true, upcoming: true })
      .sort({ createdAt: -1 }).limit(20).populate('brand').lean();
    return cached({ phones: await attachListSpecs(phones) }, 300, 600);
  }

  // ---- /api/phones-under/:price (e.g. /api/phones-under/50000) ----
  if (segments.length === 2 && segments[0] === 'phones-under') {
    await connectDB();
    const maxPrice = parseFloat(segments[1]);
    if (isNaN(maxPrice) || maxPrice <= 0) return cachedError('Invalid price', 400, 60, 300);
    const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') || '1'));
    const limit = 20;
    const [phones, total] = await Promise.all([
      Phone.find({ active: true, status: 'published', pricePKR: { $gt: 0, $lte: maxPrice } })
        .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
        .sort({ pricePKR: 1 }).skip((page - 1) * limit).limit(limit).populate('brand').lean(),
      Phone.countDocuments({ active: true, status: 'published', pricePKR: { $gt: 0, $lte: maxPrice } }),
    ]);
    return cached({ phones: await attachListSpecs(phones), total, page, limit, maxPrice, totalPages: Math.ceil(total / limit) }, 120, 300);
  }

  // ---- /api/price-ranges ----
  if (segments.length === 1 && segments[0] === 'price-ranges') {
    await connectDB();
    const ranges = [
      { label: 'Under 20,000 PKR', slug: 'under-20000', min: 0, max: 20000 },
      { label: '20K - 40K PKR', slug: '20000-40000', min: 20000, max: 40000 },
      { label: '40K - 60K PKR', slug: '40000-60000', min: 40000, max: 60000 },
      { label: '60K - 100K PKR', slug: '60000-100000', min: 60000, max: 100000 },
      { label: 'Above 100K PKR', slug: 'above-100000', min: 100000, max: Infinity },
    ];
    const counts = await Promise.all(
      ranges.map(r => Phone.countDocuments({
        active: true, status: 'published',
        pricePKR: r.max === Infinity ? { $gte: r.min, $gt: 0 } : { $gte: r.min, $lte: r.max, $gt: 0 },
      }))
    );
    return cached({ ranges: ranges.map((r, i) => ({ ...r, count: counts[i] })) }, 300, 600);
  }

  // ---- /api/reviews (public user reviews) ----
  if (segments.length === 1 && segments[0] === 'reviews') {
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      UserReview.find({ status: 'approved' }).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'phoneId', select: 'modelName slug thumbnail brandId', populate: { path: 'brand', select: 'name slug' } }).lean(),
      UserReview.countDocuments({ status: 'approved' }),
    ]);
    return cached({ reviews, total, page, limit }, 120, 300);
  }

  return undefined;
}

// ============ PUBLIC POST HANDLERS ============

export async function handlePublicPost(req: NextRequest, segments: string[], ip: string): Promise<NextResponse | undefined> {
  // ---- /api/contact ----
  if (segments.length === 1 && segments[0] === 'contact') {
    const body = await req.json();
    const { name, email, subject, message, turnstileToken } = body;

    // Validate required fields
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!subject || typeof subject !== 'string') return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // Sanitize inputs
    const cleanName = sanitizeInput(name.trim());
    const cleanEmail = sanitizeInput(email.trim().toLowerCase());
    const cleanSubject = sanitizeInput(subject.trim());
    const cleanMessage = sanitizeInput(message.trim());

    // Validate constraints
    if (cleanName.length === 0 || cleanName.length > 200) return NextResponse.json({ error: 'Name must be 1-200 characters' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    if (cleanSubject.length === 0 || cleanSubject.length > 300) return NextResponse.json({ error: 'Subject must be 1-300 characters' }, { status: 400 });
    if (cleanMessage.length < 10 || cleanMessage.length > 5000) return NextResponse.json({ error: 'Message must be 10-5000 characters' }, { status: 400 });

    // Turnstile verification (skip if not configured — graceful degradation)
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) return NextResponse.json({ error: 'Bot verification required' }, { status: 403 });
      const tsValid = await verifyTurnstile(turnstileToken, ip);
      if (!tsValid) return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 });
    }

    // Send email if configured, otherwise just log
    if (isEmailConfigured()) {
      try {
        const transporter = await getEmailTransporter();
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER, // Send to site owner
          replyTo: cleanEmail,
          subject: `[PhoneDock Contact] ${cleanSubject}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <h2 style="color:#1a1a1a;margin-bottom:16px">New Contact Message</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
              <tr><td style="padding:8px 0;color:#666;font-size:14px;width:100px">Name</td><td style="padding:8px 0;font-size:14px;font-weight:500">${cleanName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Subject</td><td style="padding:8px 0;font-size:14px;font-weight:500">${cleanSubject}</td></tr>
            </table>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#333;white-space:pre-wrap">${cleanMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <p style="color:#999;font-size:12px;margin-top:16px">Sent from PhoneDock contact form</p>
          </div>`,
        });
        console.log('[Contact] Email sent successfully');
      } catch (emailErr: any) {
        console.error('[Contact] Email send failed:', emailErr?.message);
        // Still return success — don't expose email failure
      }
    } else {
      console.log('[Contact] Email not configured — logging contact form submission:', { name: cleanName, email: cleanEmail, subject: cleanSubject, message: cleanMessage.slice(0, 100) + '...' });
    }

    // Always return generic success (never reveal if email was actually sent)
    return NextResponse.json({ success: true, message: 'Message sent successfully! We\'ll get back to you soon.' });
  }

  return undefined;
}