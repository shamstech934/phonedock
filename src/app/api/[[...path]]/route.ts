import { NextRequest, NextResponse } from 'next/server';
import { Brand, Phone, PhoneSpecs, PhoneImage, PhoneBenchmark, Review, PhonePrice, News, Sponsor, Admin, ActivityLog } from '@/lib/models';
import connectDB from '@/lib/mongodb';
import { compare } from 'bcryptjs';

// ============ TOKEN STORE ============
const activeTokens = new Set<string>();

function generateToken(): string {
  return Buffer.from(`${Date.now()}_${Math.random().toString(36).slice(2)}`).toString('base64');
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

// ============ AUTH ============
async function handleAuth(req: NextRequest, action: string) {
  if (req.method === 'POST' && action === 'login') {
    try {
      await connectDB();
      const { email, password } = await req.json();
      if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      const admin = await Admin.findOne({ email });
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = { active: true, status: 'published' };
    if (brand) where.brandId = brand;
    if (featured === 'true') where.featured = true;
    if (trending === 'true') where.trending = true;
    if (upcoming === 'true') where.upcoming = true;
    if (search) {
      where.$or = [
        { modelName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePKR = {};
      if (minPrice) where.pricePKR.$gte = parseInt(minPrice);
      if (maxPrice) where.pricePKR.$lte = parseInt(maxPrice);
    }

    const sortObj: any = { createdAt: -1 };
    if (sort === 'price-asc') sortObj.pricePKR = 1;
    else if (sort === 'price-desc') sortObj.pricePKR = -1;
    else if (sort === 'rating') sortObj.overallRating = -1;
    else if (sort === 'name') sortObj.modelName = 1;
    else if (sort === 'views') sortObj.views = -1;

    const [phones, total] = await Promise.all([
      Phone.find(where).populate({ path: 'brand', select: 'name slug logo country' }).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
      Phone.countDocuments(where),
    ]);

    // Attach specs and benchmarks to each phone
    for (const phone of phones) {
      const [specs, benchmarks] = await Promise.all([
        PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
        PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      ]);
      (phone as any).specs = specs || null;
      (phone as any).benchmarks = benchmarks || null;
    }

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
    const phone = await Phone.findOne({ slug }).populate({ path: 'brand', select: 'name slug logo country' }).lean();
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    // Increment views
    await Phone.findOneAndUpdate({ slug }, { $inc: { views: 1 } });
    // Fetch related data
    const [specs, benchmarks, images, reviews, prices] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      Review.find({ phoneId: phone._id, published: true }).lean(),
      PhonePrice.find({ phoneId: phone._id }).sort({ price: 1 }).lean(),
    ]);
    const phoneWithDetails = { ...phone, specs: specs || null, benchmarks: benchmarks || null, images, reviews, prices };
    const related = await Phone.find({ brandId: phone.brandId, _id: { $ne: phone._id }, active: true, status: 'published' })
      .populate({ path: 'brand', select: 'name slug logo country' })
      .sort({ overallRating: -1 }).limit(6).lean();
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
    .populate({ path: 'brand', select: 'name slug logo country' })
    .sort({ overallRating: -1 }).limit(20).lean();
  // Attach specs
  for (const phone of phones) {
    const specs = await PhoneSpecs.findOne({ phoneId: phone._id }).lean();
    (phone as any).specs = specs || null;
  }
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
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
    if (ids.length < 2) return NextResponse.json({ error: 'Provide at least 2 phone IDs' }, { status: 400 });
    if (ids.length > 4) return NextResponse.json({ error: 'Max 4 phones' }, { status: 400 });
    const phones = await Phone.find({ _id: { $in: ids } })
      .populate({ path: 'brand', select: 'name slug logo country' })
      .lean();
    // Attach specs and benchmarks
    for (const phone of phones) {
      const [specs, benchmarks] = await Promise.all([
        PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
        PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      ]);
      (phone as any).specs = specs || null;
      (phone as any).benchmarks = benchmarks || null;
    }
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
  const [phones, brandsRaw] = await Promise.all([
    Phone.find({ active: true, status: 'published', $or: [{ modelName: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }] })
      .populate({ path: 'brand', select: 'name slug logo country' })
      .sort({ overallRating: -1 }).limit(20).lean(),
    Brand.aggregate([
      { $match: { active: true, name: { $regex: q, $options: 'i' } } },
      { $lookup: { from: 'phones', localField: '_id', foreignField: 'brandId', as: '_phones' } },
      { $addFields: { phoneCount: { $size: '$_phones' } } },
      { $unset: '_phones' },
    ]),
  ]);
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

// ============ SEO SITEMAP ============
async function handleSitemap() {
  await connectDB();
  const [phoneDocs, brands, news] = await Promise.all([
    Phone.find({ active: true, status: 'published' }).select('slug updatedAt brandId').populate({ path: 'brand', select: 'slug' }).lean(),
    Brand.find({ active: true }).select('slug').lean(),
    News.find({ published: true, status: 'published' }).select('slug updatedAt').lean(),
  ]);
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
  if (method === 'OPTIONS') {
    return new NextResponse(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

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
    const brand = await Brand.findOne({ slug: pathParts[1] }).lean();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const phones = await Phone.find({ brandId: brand._id, active: true }).populate({ path: 'brand', select: 'name slug logo country' }).sort({ pricePKR: -1 }).lean();
    // Attach specs to each phone
    for (const phone of phones) {
      const specs = await PhoneSpecs.findOne({ phoneId: phone._id }).lean();
      (phone as any).specs = specs || null;
    }
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
      const phones = await Phone.find().populate({ path: 'brand', select: 'name slug logo country' }).sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json({ phones });
    }
    if (pathParts[1] === 'brands' && method === 'GET') {
      const brands = await Brand.aggregate([
        { $lookup: { from: 'phones', localField: '_id', foreignField: 'brandId', as: '_phones' } },
        { $addFields: { phoneCount: { $size: '$_phones' } } },
        { $unset: '_phones' },
        { $sort: { sortOrder: 1 } },
      ]);
      return NextResponse.json({ brands });
    }
    if (pathParts[1] === 'news' && method === 'GET') {
      const news = await News.find().sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json({ news });
    }
    if (pathParts[1] === 'sponsors' && method === 'GET') {
      const sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ sponsors });
    }
    if (pathParts[1] === 'activity-logs' && method === 'GET') {
      const logs = await ActivityLog.find().populate({ path: 'admin', select: 'name email' }).sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json({ logs });
    }
    if (pathParts[1] === 'stats') return handleStats();
  }

  // ============ HOME ============
  if (seg0 === 'home') {
    try {
      await connectDB();
      const allPhones = await Phone.find({ active: true, status: 'published' })
        .populate({ path: 'brand', select: 'name slug logo country' })
        .sort({ overallRating: -1 }).lean();
      const p = (fn: (x: any) => boolean, take: number) => allPhones.filter(fn).slice(0, take);
      const featured = p(x => x.featured, 8);
      const trending = [...allPhones].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter(x => x.trending).slice(0, 8);
      const upcoming = await Phone.find({ upcoming: true, active: true }).populate({ path: 'brand', select: 'name slug logo country' }).sort({ createdAt: -1 }).limit(6).lean();
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
}