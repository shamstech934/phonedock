import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compare } from 'bcryptjs';

function generateToken(): string {
  return Buffer.from(`${Date.now()}_${Math.random().toString(36).slice(2)}`).toString('base64');
}

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return true;
}

// ============ AUTH ============
async function handleAuth(req: NextRequest, action: string) {
  if (req.method === 'POST' && action === 'login') {
    try {
      const { email, password } = await req.json();
      if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      const admin = await db.admin.findUnique({ where: { email } });
      if (!admin || !admin.active) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      const valid = await compare(password, admin.password);
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      await db.admin.update({ where: { id: admin.id }, data: { lastLogin: new Date() } });
      const token = generateToken();
      return NextResponse.json({ success: true, token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
    } catch {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ============ PHONES ============
async function handlePhones(req: NextRequest, pathParts: string[]) {
  if (req.method === 'GET' && pathParts.length <= 1) {
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

    const where: any = { active: true };
    if (brand) where.brandId = brand;
    if (featured === 'true') where.featured = true;
    if (trending === 'true') where.trending = true;
    if (upcoming === 'true') where.upcoming = true;
    if (search) {
      where.OR = [
        { modelName: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePKR = {};
      if (minPrice) where.pricePKR.gte = parseInt(minPrice);
      if (maxPrice) where.pricePKR.lte = parseInt(maxPrice);
    }

    const orderBy: any = { createdAt: 'desc' };
    if (sort === 'price-asc') orderBy.pricePKR = 'asc';
    if (sort === 'price-desc') orderBy.pricePKR = 'desc';
    if (sort === 'rating') orderBy.overallRating = 'desc';
    if (sort === 'name') orderBy.modelName = 'asc';

    const [phones, total] = await Promise.all([
      db.phone.findMany({
        where,
        include: { brand: true, specs: true, benchmarks: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.phone.count({ where }),
    ]);

    return NextResponse.json({ phones, total, page, pages: Math.ceil(total / limit) });
  }

  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const data = await req.json();
      const phone = await db.phone.create({ data });
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
    const phone = await db.phone.findUnique({
      where: { slug },
      include: {
        brand: true, specs: true, benchmarks: true,
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: { where: { published: true } },
        prices: { orderBy: { price: 'asc' } },
      },
    });
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    const related = await db.phone.findMany({
      where: { brandId: phone.brandId, id: { not: phone.id }, active: true },
      include: { brand: true },
      take: 6,
      orderBy: { overallRating: 'desc' },
    });
    return NextResponse.json({ phone, related });
  }
  if (req.method === 'PUT') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const data = await req.json();
      const phone = await db.phone.update({ where: { slug }, data });
      return NextResponse.json({ phone });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  if (req.method === 'DELETE') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await db.phone.delete({ where: { slug } });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ BRANDS ============
async function handleBrands(req: NextRequest) {
  if (req.method === 'GET') {
    const brands = await db.brand.findMany({ where: { active: true }, include: { _count: { select: { phones: true } } }, orderBy: { sortOrder: 'asc' } });
    return NextResponse.json({ brands });
  }
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const data = await req.json();
      const brand = await db.brand.create({ data });
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
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];
    if (ids.length < 2) return NextResponse.json({ error: 'Provide at least 2 phone IDs' }, { status: 400 });
    if (ids.length > 4) return NextResponse.json({ error: 'Max 4 phones' }, { status: 400 });
    const phones = await db.phone.findMany({
      where: { id: { in: ids } },
      include: { brand: true, specs: true, benchmarks: true },
    });
    return NextResponse.json({ phones });
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ SEARCH ============
async function handleSearch(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ results: [], total: 0 });
  const phones = await db.phone.findMany({
    where: { active: true, OR: [{ modelName: { contains: q } }, { description: { contains: q } }] },
    include: { brand: true, specs: true },
    take: 20,
    orderBy: { overallRating: 'desc' },
  });
  const brands = await db.brand.findMany({
    where: { active: true, OR: [{ name: { contains: q } }] },
    include: { _count: { select: { phones: true } } },
  });
  return NextResponse.json({ phones, brands, total: phones.length + brands.length });
}

// ============ NEWS ============
async function handleNews(req: NextRequest) {
  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    const published = searchParams.get('published') !== 'false';
    const category = searchParams.get('category');
    const where: any = { published };
    if (category) where.category = category;
    const news = await db.news.findMany({ where, orderBy: { createdAt: 'desc' }, take: 20 });
    return NextResponse.json({ news });
  }
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const data = await req.json();
      const news = await db.news.create({ data });
      return NextResponse.json({ news }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============ STATS ============
async function handleStats() {
  const [totalPhones, totalBrands, totalReviews, avgPrice, trending, featured] = await Promise.all([
    db.phone.count({ where: { active: true } }),
    db.brand.count({ where: { active: true } }),
    db.review.count(),
    db.phone.aggregate({ _avg: { pricePKR: true }, where: { active: true } }),
    db.phone.count({ where: { trending: true, active: true } }),
    db.phone.count({ where: { featured: true, active: true } }),
  ]);
  return NextResponse.json({ totalPhones, totalBrands, totalReviews, avgPrice: avgPrice._avg.pricePKR || 0, trending, featured });
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
  if (seg0 === 'phones' && pathParts.length <= 1) return handlePhones(req, pathParts);
  if (seg0 === 'phones' && pathParts.length === 2) return handlePhoneDetail(req, pathParts[1]);
  if (seg0 === 'brands' && pathParts.length <= 1) return handleBrands(req);
  if (seg0 === 'brands' && pathParts.length === 2) {
    const brand = await db.brand.findUnique({ where: { slug: pathParts[1] }, include: { phones: { where: { active: true }, include: { specs: true }, orderBy: { pricePKR: 'desc' } } } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    return NextResponse.json({ brand });
  }
  if (seg0 === 'compare') return handleCompare(req);
  if (seg0 === 'search') return handleSearch(req);
  if (seg0 === 'news') return handleNews(req);
  if (seg0 === 'admin') {
    if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (pathParts[1] === 'phones' && method === 'GET') {
      const phones = await db.phone.findMany({ include: { brand: true }, orderBy: { createdAt: 'desc' }, take: 50 });
      return NextResponse.json({ phones });
    }
  }
  if (seg0 === 'home') {
    const [featured, trending, upcoming, bestCamera, bestGaming, bestBattery, latest, news] = await Promise.all([
      db.phone.findMany({ where: { featured: true, active: true }, include: { brand: true, specs: true }, take: 8, orderBy: { overallRating: 'desc' } }),
      db.phone.findMany({ where: { trending: true, active: true }, include: { brand: true }, take: 8, orderBy: { createdAt: 'desc' } }),
      db.phone.findMany({ where: { upcoming: true, active: true }, include: { brand: true }, take: 6 }),
      db.phone.findMany({ where: { active: true, cameraScore: { gte: 85 } }, include: { brand: true }, take: 6, orderBy: { cameraScore: 'desc' } }),
      db.phone.findMany({ where: { active: true, performanceScore: { gte: 90 } }, include: { brand: true }, take: 6, orderBy: { performanceScore: 'desc' } }),
      db.phone.findMany({ where: { active: true, batteryScore: { gte: 85 } }, include: { brand: true }, take: 6, orderBy: { batteryScore: 'desc' } }),
      db.phone.findMany({ where: { active: true }, include: { brand: true }, take: 10, orderBy: { createdAt: 'desc' } }),
      db.news.findMany({ where: { published: true }, take: 4, orderBy: { createdAt: 'desc' } }),
    ]);
    const [under20k, price20to40, price40to60, price60to100, above100k] = await Promise.all([
      db.phone.findMany({ where: { active: true, pricePKR: { lte: 20000 } }, include: { brand: true }, take: 6, orderBy: { overallRating: 'desc' } }),
      db.phone.findMany({ where: { active: true, pricePKR: { gt: 20000, lte: 40000 } }, include: { brand: true }, take: 6, orderBy: { overallRating: 'desc' } }),
      db.phone.findMany({ where: { active: true, pricePKR: { gt: 40000, lte: 60000 } }, include: { brand: true }, take: 6, orderBy: { overallRating: 'desc' } }),
      db.phone.findMany({ where: { active: true, pricePKR: { gt: 60000, lte: 100000 } }, include: { brand: true }, take: 6, orderBy: { overallRating: 'desc' } }),
      db.phone.findMany({ where: { active: true, pricePKR: { gt: 100000 } }, include: { brand: true }, take: 6, orderBy: { overallRating: 'desc' } }),
    ]);
    return NextResponse.json({ featured, trending, upcoming, bestCamera, bestGaming, bestBattery, latest, news, priceCategories: { under20k, price20to40, price40to60, price60to100, above100k } });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}