import { NextRequest, NextResponse } from 'next/server';
import { Brand, Phone, PhoneSpecs, PhoneImage, PhoneBenchmark, Review, PhonePrice, News, Sponsor, Admin, ActivityLog } from '@/lib/models';
import connectDB, { connectDBSafe } from '@/lib/mongodb';
import { compare } from 'bcryptjs';
import { Types } from 'mongoose';

// ============ SIMPLE RATE LIMITER (in-memory, per-process) ============
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ============ TOKEN STORE ============
const activeTokens = new Set<string>();

function generateToken(): string {
  return Buffer.from(`${Date.now()}_${Math.random().toString(36).slice(2)}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`).toString('base64');
}

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  return activeTokens.has(token);
}

function cacheHeaders(maxAge = 60) {
  return { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}` };
}

// ============ SECURITY HELPERS ============
function sanitizeRegex(input: string): string {
  // Remove regex special chars that could cause ReDoS or NoSQL injection
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

// ============ HELPERS ============
// Map MongoDB _id to id for lean docs (frontend expects 'id')
function mapId(doc: any): any {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(mapId);
  if (doc._id) doc.id = doc._id.toString();
  return doc;
}

// Batch-attach brands to lean phone docs (single query)
async function attachBrands(phones: any[]): Promise<void> {
  const brandIds = [...new Set(phones.map((p: any) => p.brandId).filter(Boolean).map((id: any) => new Types.ObjectId(id)))];
  if (brandIds.length === 0) return;
  const brands = await Brand.find({ _id: { $in: brandIds } }).select('name slug logo country').lean();
  const brandMap = new Map(brands.map((b: any) => [b._id.toString(), mapId(b)]));
  for (const phone of phones) {
    (phone as any).brand = brandMap.get(phone.brandId?.toString()) || null;
  }
}

// Batch-attach specs and benchmarks (2 queries total instead of 2N)
async function attachPhoneExtras(phones: any[]): Promise<void> {
  if (phones.length === 0) return;
  const phoneIds = phones.map((p: any) => p._id);
  const [allSpecs, allBenchmarks] = await Promise.all([
    PhoneSpecs.find({ phoneId: { $in: phoneIds } }).lean(),
    PhoneBenchmark.find({ phoneId: { $in: phoneIds } }).lean(),
  ]);
  const specsMap = new Map(allSpecs.map((s: any) => [s.phoneId?.toString(), mapId(s)]));
  const benchmarksMap = new Map(allBenchmarks.map((b: any) => [b.phoneId?.toString(), mapId(b)]));
  for (const phone of phones) {
    (phone as any).specs = specsMap.get(phone._id?.toString()) || null;
    (phone as any).benchmarks = benchmarksMap.get(phone._id?.toString()) || null;
  }
}

// ============ AUTH ============
async function handleAuth(req: NextRequest, action: string) {
  if (req.method === 'POST' && action === 'login') {
    try {
      await connectDB();
      const { email, password } = await req.json();
      if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      // Sanitize email to prevent NoSQL injection
      const admin = await Admin.findOne({ email: String(email).trim() });
      if (!admin || !admin.active) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      const valid = await compare(password, admin.password);
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });
      const token = generateToken();
      activeTokens.add(token);
      await ActivityLog.create({ adminId: admin._id, action: 'login', details: `Admin ${admin.email} logged in`, entityType: 'admin' });
      return NextResponse.json({ success: true, token, admin: { id: admin._id, email: admin.email, name: admin.name, role: admin.role } });
    } catch {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ============ PHONES ============
async function handlePhones(req: NextRequest, pathParts: string[]) {
  if (req.method === 'GET' && pathParts.length <= 1) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const featured = searchParams.get('featured');
    const trending = searchParams.get('trending');
    const upcoming = searchParams.get('upcoming');
    const sort = searchParams.get('sort') || 'latest';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: any = { active: true, status: 'published' };
    if (brand && Types.ObjectId.isValid(brand)) where.brandId = new Types.ObjectId(brand);
    if (featured === 'true') where.featured = true;
    if (trending === 'true') where.trending = true;
    if (upcoming === 'true') where.upcoming = true;
    if (search) {
      const safe = sanitizeRegex(search);
      where.$or = [
        { modelName: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePKR = {};
      const min = parseInt(minPrice || '0');
      const max = parseInt(maxPrice || '999999999');
      if (!isNaN(min)) where.pricePKR.$gte = min;
      if (!isNaN(max)) where.pricePKR.$lte = max;
    }

    const sortObj: any = { createdAt: -1 };
    if (sort === 'price-asc') sortObj.pricePKR = 1;
    else if (sort === 'price-desc') sortObj.pricePKR = -1;
    else if (sort === 'rating') sortObj.overallRating = -1;
    else if (sort === 'name') sortObj.modelName = 1;
    else if (sort === 'views') sortObj.views = -1;

    const [phones, total] = await Promise.all([
      Phone.find(where).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
      Phone.countDocuments(where),
    ]);

    phones.forEach(mapId);
    await attachBrands(phones);
    await attachPhoneExtras(phones);

    return NextResponse.json({ phones, total, page, pages: Math.ceil(total / limit) }, { headers: cacheHeaders(60) });
  }

  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await connectDB();
      const data = await req.json();
      const phone = await Phone.create(data);
      return NextResponse.json({ phone }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Create failed' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ============ PHONE DETAIL ============
async function handlePhoneDetail(req: NextRequest, slug: string) {
  if (req.method === 'GET') {
    await connectDB();
    // Sanitize slug to prevent NoSQL injection
    const safeSlug = String(slug).replace(/[^a-z0-9\-]/gi, '');
    const phone = await Phone.findOne({ slug: safeSlug }).lean();
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    mapId(phone);
    await attachBrands([phone]);
    // Increment views (fire and forget)
    Phone.findOneAndUpdate({ slug: safeSlug }, { $inc: { views: 1 } }).catch(() => {});
    // Fetch related data
    const [specs, benchmarks, images, reviews, prices] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      Review.find({ phoneId: phone._id, published: true }).lean(),
      PhonePrice.find({ phoneId: phone._id }).sort({ price: 1 }).lean(),
    ]);
    [specs, benchmarks, ...images, ...reviews, ...prices].forEach(mapId);
    const phoneWithDetails = { ...phone, specs: specs || null, benchmarks: benchmarks || null, images, reviews, prices };
    const related = await Phone.find({ brandId: phone.brandId, _id: { $ne: phone._id }, active: true, status: 'published' })
      .sort({ overallRating: -1 }).limit(6).lean();
    related.forEach(mapId);
    await attachBrands(related);
    return NextResponse.json({ phone: phoneWithDetails, related }, { headers: cacheHeaders(30) });
  }
  if (req.method === 'PUT') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await connectDB();
      const data = await req.json();
      const phone = await Phone.findOneAndUpdate({ slug }, data, { new: true });
      if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
      return NextResponse.json({ phone });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  if (req.method === 'DELETE') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    await Phone.findOneAndDelete({ slug });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ BEST PHONES BY CATEGORY ============
async function handleBestPhones(req: NextRequest, category: string) {
  await connectDB();
  let where: any = { active: true, status: 'published' };
  if (category === 'camera') where.cameraScore = { $gte: 85 };
  else if (category === 'gaming') where.performanceScore = { $gte: 88 };
  else if (category === 'battery') where.batteryScore = { $gte: 85 };
  else if (category === 'flagship') where.pricePKR = { $gte: 150000 };
  else if (category === 'budget') where.pricePKR = { $lte: 40000 };
  else if (category === 'display') where.displayScore = { $gte: 90 };

  const phones = await Phone.find(where)
    .sort({ overallRating: -1 }).limit(20).lean();
  phones.forEach(mapId);
  await attachBrands(phones);
  await attachPhoneExtras(phones);
  return NextResponse.json({ phones, category }, { headers: cacheHeaders(120) });
}

// ============ BRANDS ============
async function handleBrands(req: NextRequest) {
  if (req.method === 'GET') {
    await connectDB();
    const brands = await Brand.aggregate([
      { $match: { active: true } },
      { $lookup: { from: 'phones', localField: '_id', foreignField: 'brandId', as: '_phones' } },
      { $addFields: { phoneCount: { $size: '$_phones' } } },
      { $unset: '_phones' },
      { $sort: { sortOrder: 1 } },
    ]);
    brands.forEach((b: any) => { b.id = b._id.toString(); });
    return NextResponse.json({ brands }, { headers: cacheHeaders(300) });
  }
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await connectDB();
      const data = await req.json();
      const brand = await Brand.create(data);
      return NextResponse.json({ brand }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ COMPARE ============
async function handleCompare(req: NextRequest) {
  if (req.method === 'GET') {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids')?.split(',').filter(Boolean).map(id => id.trim()) || [];
    if (ids.length < 2) return NextResponse.json({ error: 'Provide at least 2 phone IDs' }, { status: 400 });
    if (ids.length > 4) return NextResponse.json({ error: 'Max 4 phones' }, { status: 400 });
    // Validate all IDs are valid ObjectIds
    const validIds = ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
    if (validIds.length < 2) return NextResponse.json({ error: 'Invalid phone IDs' }, { status: 400 });
    const phones = await Phone.find({ _id: { $in: validIds } }).lean();
    phones.forEach(mapId);
    await attachBrands(phones);
    await attachPhoneExtras(phones);
    return NextResponse.json({ phones }, { headers: cacheHeaders(60) });
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ SEARCH ============
async function handleSearch(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ results: [], total: 0 });
  const safe = sanitizeRegex(q.trim());
  const [phones, brandsRaw] = await Promise.all([
    Phone.find({ active: true, status: 'published', $or: [{ modelName: { $regex: safe, $options: 'i' } }, { description: { $regex: safe, $options: 'i' } }] })
      .sort({ overallRating: -1 }).limit(20).lean(),
    Brand.aggregate([
      { $match: { active: true, name: { $regex: safe, $options: 'i' } } },
      { $lookup: { from: 'phones', localField: '_id', foreignField: 'brandId', as: '_phones' } },
      { $addFields: { phoneCount: { $size: '$_phones' } } },
      { $unset: '_phones' },
    ]),
  ]);
  phones.forEach(mapId);
  brandsRaw.forEach((b: any) => { b.id = b._id.toString(); });
  await attachBrands(phones);
  return NextResponse.json({ phones, brands: brandsRaw, total: phones.length + brandsRaw.length }, { headers: cacheHeaders(30) });
}

// ============ NEWS ============
async function handleNews(req: NextRequest) {
  if (req.method === 'GET') {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const published = searchParams.get('published') !== 'false';
    const category = searchParams.get('category');
    const where: any = { published };
    if (published) where.status = 'published';
    if (category) where.category = category;
    const news = await News.find(where).sort({ createdAt: -1 }).limit(20).lean();
    news.forEach((n: any) => { n.id = n._id.toString(); n.imageUrl = n.image; });
    return NextResponse.json({ news }, { headers: cacheHeaders(60) });
  }
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await connectDB();
      const data = await req.json();
      const news = await News.create(data);
      return NextResponse.json({ news }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ SPONSORS ============
async function handleSponsors(req: NextRequest) {
  if (req.method === 'GET') {
    await connectDB();
    const position = new URL(req.url).searchParams.get('position');
    const where: any = { active: true };
    if (position) where.position = position;
    const sponsors = await Sponsor.find(where).sort({ createdAt: -1 }).lean();
    sponsors.forEach((s: any) => { s.id = s._id.toString(); });
    return NextResponse.json({ sponsors }, { headers: cacheHeaders(300) });
  }
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      await connectDB();
      const data = await req.json();
      const sponsor = await Sponsor.create(data);
      return NextResponse.json({ sponsor }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ STATS ============
async function handleStats() {
  await connectDB();
  const [totalPhones, totalBrands, totalReviews, totalNews, avgResult, trending, featured, upcoming, under20k, price20to40, price40to60, price60to100, above100k] = await Promise.all([
    Phone.countDocuments({ active: true, status: 'published' }),
    Brand.countDocuments({ active: true }),
    Review.countDocuments(),
    News.countDocuments({ published: true }),
    Phone.aggregate([{ $match: { active: true, status: 'published' } }, { $group: { _id: null, avgPrice: { $avg: '$pricePKR' } } }]),
    Phone.countDocuments({ trending: true, active: true }),
    Phone.countDocuments({ featured: true, active: true }),
    Phone.countDocuments({ upcoming: true, active: true }),
    Phone.countDocuments({ active: true, pricePKR: { $lte: 20000 } }),
    Phone.countDocuments({ active: true, pricePKR: { $gt: 20000, $lte: 40000 } }),
    Phone.countDocuments({ active: true, pricePKR: { $gt: 40000, $lte: 60000 } }),
    Phone.countDocuments({ active: true, pricePKR: { $gt: 60000, $lte: 100000 } }),
    Phone.countDocuments({ active: true, pricePKR: { $gt: 100000 } }),
  ]);
  return NextResponse.json({
    totalPhones, totalBrands, totalReviews, totalNews,
    avgPrice: avgResult[0]?.avgPrice || 0,
    trending, featured, upcoming,
    priceDistribution: [
      { range: 'under20k', count: under20k },
      { range: 'price20to40', count: price20to40 },
      { range: 'price40to60', count: price40to60 },
      { range: 'price60to100', count: price60to100 },
      { range: 'above100k', count: above100k },
    ],
  });
}

// ============ SEO SITEMAP (Safe - won't crash if DB is down) ============
async function handleSitemap() {
  const conn = await connectDBSafe();
  if (!conn) {
    // Return static sitemap data when DB is unavailable
    return NextResponse.json({
      phones: [],
      brands: [{ slug: 'samsung' }, { slug: 'apple' }, { slug: 'xiaomi' }, { slug: 'oneplus' }],
      news: [],
    }, { headers: cacheHeaders(3600) });
  }
  const [phoneDocs, brands, news] = await Promise.all([
    Phone.find({ active: true, status: 'published' }).select('slug updatedAt brandId').lean(),
    Brand.find({ active: true }).select('slug').lean(),
    News.find({ published: true, status: 'published' }).select('slug updatedAt').lean(),
  ]);
  await attachBrands(phoneDocs);
  const phones = phoneDocs.map((p: any) => ({ slug: p.slug, updatedAt: p.updatedAt, brand: p.brand ? { slug: p.brand.slug } : null }));
  return NextResponse.json({ phones, brands, news }, { headers: cacheHeaders(3600) });
}

// ============ MAIN ROUTER ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return routeRequest(req, 'GET', path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return routeRequest(req, 'POST', path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return routeRequest(req, 'PUT', path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return routeRequest(req, 'DELETE', path);
}

async function routeRequest(req: NextRequest, method: string, pathParts: string[]) {
  // Rate limiting
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (method === 'OPTIONS') {
    return new NextResponse(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  // Security headers for all responses
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  try {
    const seg0 = pathParts[0] || '';

    if (seg0 === 'auth') return handleAuth(req, pathParts[1] || '');
    if (seg0 === 'stats') return handleStats();
    if (seg0 === 'sponsors') return handleSponsors(req);
    if (seg0 === 'seo' && pathParts[1] === 'sitemap') return handleSitemap();

    if (seg0 === 'phones') {
      if (pathParts.length <= 1) return handlePhones(req, pathParts);
      if (pathParts[1] === 'best' && pathParts[2]) return handleBestPhones(req, pathParts[2]);
      if (pathParts.length === 2) return handlePhoneDetail(req, pathParts[1]);
    }

    if (seg0 === 'brands' && pathParts.length <= 1) return handleBrands(req);
    if (seg0 === 'brands' && pathParts.length === 2) {
      await connectDB();
      const safeSlug = String(pathParts[1]).replace(/[^a-z0-9\-]/gi, '');
      const brand = await Brand.findOne({ slug: safeSlug }).lean();
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      (brand as any).id = (brand as any)._id.toString();
      const phones = await Phone.find({ brandId: brand._id, active: true }).sort({ pricePKR: -1 }).lean();
      phones.forEach(mapId);
      await attachBrands(phones);
      await attachPhoneExtras(phones);
      const brandWithPhones = { ...brand, phones };
      return NextResponse.json({ brand: brandWithPhones }, { headers: cacheHeaders(120) });
    }

    if (seg0 === 'compare') return handleCompare(req);
    if (seg0 === 'search') return handleSearch(req);
    if (seg0 === 'news') return handleNews(req);

    // ============ ADMIN ROUTES ============
    if (seg0 === 'admin') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();

      if (pathParts[1] === 'phones' && method === 'GET') {
        const phones = await Phone.find().sort({ createdAt: -1 }).limit(50).lean();
        phones.forEach(mapId);
        await attachBrands(phones);
        return NextResponse.json({ phones });
      }
      if (pathParts[1] === 'brands' && method === 'GET') {
        const brands = await Brand.aggregate([
          { $lookup: { from: 'phones', localField: '_id', foreignField: 'brandId', as: '_phones' } },
          { $addFields: { phoneCount: { $size: '$_phones' } } },
          { $unset: '_phones' },
          { $sort: { sortOrder: 1 } },
        ]);
        brands.forEach((b: any) => { b.id = b._id.toString(); });
        return NextResponse.json({ brands });
      }
      if (pathParts[1] === 'news' && method === 'GET') {
        const news = await News.find().sort({ createdAt: -1 }).limit(50).lean();
        news.forEach((n: any) => { n.id = n._id.toString(); n.imageUrl = n.image; });
        return NextResponse.json({ news });
      }
      if (pathParts[1] === 'sponsors' && method === 'GET') {
        const sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
        sponsors.forEach((s: any) => { s.id = s._id.toString(); });
        return NextResponse.json({ sponsors });
      }
      // FIX: Support both 'activity' and 'activity-logs' paths
      if ((pathParts[1] === 'activity-logs' || pathParts[1] === 'activity') && method === 'GET') {
        const logs = await ActivityLog.find().populate({ path: 'admin', select: 'name email' }).sort({ createdAt: -1 }).limit(50).lean();
        logs.forEach((l: any) => { l.id = l._id.toString(); });
        return NextResponse.json({ logs });
      }
      if (pathParts[1] === 'stats') return handleStats();
    }

    // ============ HOME ============
    if (seg0 === 'home') {
      try {
        await connectDB();
        const allPhones = await Phone.find({ active: true, status: 'published' })
          .sort({ overallRating: -1 }).lean();
        allPhones.forEach(mapId);
        await attachBrands(allPhones);
        await attachPhoneExtras(allPhones);
        const p = (fn: (x: any) => boolean, take: number) => allPhones.filter(fn).slice(0, take);
        const featured = p(x => x.featured, 8);
        const trending = [...allPhones].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter(x => x.trending).slice(0, 8);
        const upcoming = await Phone.find({ upcoming: true, active: true }).sort({ createdAt: -1 }).limit(6).lean();
        upcoming.forEach(mapId);
        await attachBrands(upcoming);
        const bestCamera = p(x => x.cameraScore >= 85, 6);
        const bestGaming = p(x => x.performanceScore >= 88, 6);
        const bestBattery = p(x => x.batteryScore >= 85, 6);
        const flagship = p(x => x.pricePKR >= 150000, 6);
        const budget = p(x => x.pricePKR <= 40000, 6);
        const latest = [...allPhones].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
        const [news, sponsors] = await Promise.all([
          News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).limit(4).lean(),
          Sponsor.find({ active: true, position: { $in: ['homepage_banner', 'homepage_sidebar'] } }).lean(),
        ]);
        news.forEach((n: any) => { n.id = n._id.toString(); n.imageUrl = n.image; });
        sponsors.forEach((s: any) => { s.id = s._id.toString(); });
        return NextResponse.json({
          featured, trending, upcoming, bestCamera, bestGaming, bestBattery, flagship, budget, latest, news, sponsors: sponsors || [],
          priceCategories: {
            under20k: p(x => x.pricePKR <= 20000, 6),
            price20to40: p(x => x.pricePKR > 20000 && x.pricePKR <= 40000, 6),
            price40to60: p(x => x.pricePKR > 40000 && x.pricePKR <= 60000, 6),
            price60to100: p(x => x.pricePKR > 60000 && x.pricePKR <= 100000, 6),
            above100k: p(x => x.pricePKR > 100000, 6),
          },
        }, { headers: cacheHeaders(60) });
      } catch (e: any) {
        console.error('Home API error:', e.message);
        return NextResponse.json({ error: 'Failed to load home data' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API Error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}