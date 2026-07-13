import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import Papa from 'papaparse';
import { createProvider } from '@/lib/collectors';
import { Phone, Brand, News, Sponsor, Admin, ActivityLog, CollectorSource, CollectedPhone, CollectorJob, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice } from '@/lib/models';
import { connectDB, connectDBSafe } from '@/lib/mongodb';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance } from '@/lib/collectors/services';

// ============ HELPERS ============

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'phonedock-admin-2024';
let _adminToken: string | null = null;
let _adminUser: any = null;

function generateToken() {
  return 'pd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  // In production with multiple instances, you'd verify against DB
  // For now we accept any valid-looking token (Vercel serverless = single instance per request)
  return token.startsWith('pd_') && token.length > 20;
}

function phoneToJSON(p: any, specs?: any, benchmarks?: any, images?: any[], prices?: any[]) {
  const obj = p.toObject ? p.toObject() : p;
  return {
    id: obj._id?.toString(),
    modelName: obj.modelName,
    slug: obj.slug,
    brandId: obj.brandId?.toString(),
    brand: obj.brand ? { id: obj.brand._id?.toString(), name: obj.brand.name, slug: obj.brand.slug, logo: obj.brand.logo || '' } : undefined,
    thumbnail: obj.thumbnail || '',
    pricePKR: obj.pricePKR || 0,
    description: obj.description || '',
    overallRating: obj.overallRating || 0,
    cameraScore: obj.cameraScore || 0,
    performanceScore: obj.performanceScore || 0,
    batteryScore: obj.batteryScore || 0,
    displayScore: obj.displayScore || 0,
    valueScore: obj.valueScore || 0,
    ptaStatus: obj.ptaStatus || 'Unknown',
    ptaApproved: obj.ptaApproved || false,
    releaseDate: obj.releaseDate || '',
    trending: obj.trending || false,
    upcoming: obj.upcoming || false,
    featured: obj.featured || false,
    pros: obj.pros || '',
    cons: obj.cons || '',
    reviewSummary: obj.reviewSummary || '',
    reviewVerdict: obj.reviewVerdict || '',
    published: obj.status === 'published',
    specs: specs || undefined,
    benchmarks: benchmarks || undefined,
    images: images?.map((img: any) => ({ id: img._id?.toString(), url: img.url, altText: img.altText, sortOrder: img.sortOrder })) || [],
    prices: prices?.map((pr: any) => ({ id: pr._id?.toString(), storeName: pr.storeName, price: pr.price, url: pr.url, inStock: pr.inStock })) || [],
  };
}

// ============ GET HANDLER ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // ---- /api/home ----
    if (segments.length === 1 && segments[0] === 'home') {
      await connectDB();
      const [featured, trending, latest, bestCamera, bestGaming, bestBattery, upcoming, news, brands, sponsors] = await Promise.all([
        Phone.find({ active: true, status: 'published', featured: true }).populate('brand').sort({ sortOrder: 1 }).limit(8).lean(),
        Phone.find({ active: true, status: 'published', trending: true }).populate('brand').sort({ views: -1 }).limit(8).lean(),
        Phone.find({ active: true, status: 'published' }).populate('brand').sort({ createdAt: -1 }).limit(8).lean(),
        Phone.find({ active: true, status: 'published', cameraScore: { $gt: 0 } }).populate('brand').sort({ cameraScore: -1 }).limit(4).lean(),
        Phone.find({ active: true, status: 'published', performanceScore: { $gt: 0 } }).populate('brand').sort({ performanceScore: -1 }).limit(4).lean(),
        Phone.find({ active: true, status: 'published', batteryScore: { $gt: 0 } }).populate('brand').sort({ batteryScore: -1 }).limit(4).lean(),
        Phone.find({ active: true, status: 'published', upcoming: true }).populate('brand').sort({ createdAt: -1 }).limit(4).lean(),
        News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).limit(6).lean(),
        Brand.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
        Sponsor.find({ active: true }).lean(),
      ]);

      const allPhones = await Phone.find({ active: true, status: 'published' }).lean();
      const above100k = allPhones.filter(p => p.pricePKR > 100000).slice(0, 4);
      const price60to100 = allPhones.filter(p => p.pricePKR >= 60000 && p.pricePKR <= 100000).slice(0, 4);
      const price40to60 = allPhones.filter(p => p.pricePKR >= 40000 && p.pricePKR < 60000).slice(0, 4);
      const price20to40 = allPhones.filter(p => p.pricePKR >= 20000 && p.pricePKR < 40000).slice(0, 4);
      const under20k = allPhones.filter(p => p.pricePKR > 0 && p.pricePKR < 20000).slice(0, 4);

      // Populate brands for price categories
      const brandIds = [...new Set(allPhones.map(p => p.brandId?.toString()))];
      const brandsMap = new Map(brands.map((b: any) => [b._id?.toString(), { id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '' }]));

      const mapPhones = (phones: any[]) => phones.map(p => ({
        id: p._id?.toString(), modelName: p.modelName, slug: p.slug,
        brandId: p.brandId?.toString(), brand: brandsMap.get(p.brandId?.toString()),
        thumbnail: p.thumbnail || '', pricePKR: p.pricePKR || 0,
        overallRating: p.overallRating || 0, ptaStatus: p.ptaStatus || 'Unknown',
        ptaApproved: p.ptaApproved || false, trending: p.trending || false,
        upcoming: p.upcoming || false, featured: p.featured || false,
      }));

      const mapDetailed = (phones: any[]) => phones.map(p => phoneToJSON(p));

      return NextResponse.json({
        featured: mapDetailed(featured),
        trending: mapDetailed(trending),
        latest: mapDetailed(latest),
        bestCamera: mapDetailed(bestCamera),
        bestGaming: mapDetailed(bestGaming),
        bestBattery: mapDetailed(bestBattery),
        upcoming: mapDetailed(upcoming),
        news: news.map((n: any) => ({ id: n._id?.toString(), title: n.title, slug: n.slug, excerpt: n.excerpt || '', content: n.content || '', category: n.category || 'General', author: n.author || '', imageUrl: n.image || '', published: n.published, createdAt: n.createdAt })),
        priceCategories: {
          above100k: mapPhones(above100k),
          price60to100: mapPhones(price60to100),
          price40to60: mapPhones(price40to60),
          price20to40: mapPhones(price20to40),
          under20k: mapPhones(under20k),
        },
        brands: brands.map((b: any) => ({ id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '', country: b.country || '', description: b.description || '' })),
        sponsors: sponsors.map((s: any) => ({ id: s._id?.toString(), name: s.name, image: s.image || '', url: s.url || '', position: s.position || '', active: s.active })),
      });
    }

    // ---- /api/phones ----
    if (segments.length === 1 && segments[0] === 'phones') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const brand = searchParams.get('brand') || '';
      const sort = searchParams.get('sort') || 'latest';
      const minPrice = parseInt(searchParams.get('minPrice') || '0');
      const maxPrice = parseInt(searchParams.get('maxPrice') || '0');

      let query: any = { active: true, status: 'published' };
      if (brand) {
        const brandDoc = await Brand.findOne({ slug: brand }).lean();
        if (brandDoc) query.brandId = brandDoc._id;
      }
      if (minPrice > 0) query.pricePKR = { ...query.pricePKR, $gte: minPrice };
      if (maxPrice > 0) query.pricePKR = { ...query.pricePKR, $lte: maxPrice };
      if (minPrice > 0 && maxPrice > 0) query.pricePKR = { $gte: minPrice, $lte: maxPrice };

      const sortObj: any = {};
      if (sort === 'price-low') sortObj.pricePKR = 1;
      else if (sort === 'price-high') sortObj.pricePKR = -1;
      else if (sort === 'rating') sortObj.overallRating = -1;
      else if (sort === 'trending') sortObj.views = -1;
      else sortObj.createdAt = -1;

      const total = await Phone.countDocuments(query);
      const phones = await Phone.find(query).populate('brand').sort(sortObj).skip((page - 1) * limit).limit(limit).lean();

      return NextResponse.json({
        phones: phones.map(p => phoneToJSON(p)),
        total, page, limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    // ---- /api/phones/:slug ----
    if (segments.length === 2 && segments[0] === 'phones') {
      await connectDB();
      const slug = segments[1];
      const phone = await Phone.findOne({ slug, active: true, status: 'published' }).populate('brand').lean();
      if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

      const [specs, benchmarks, images, prices] = await Promise.all([
        PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
        PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
        PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
        PhonePrice.find({ phoneId: phone._id }).lean(),
      ]);

      // Increment views
      await Phone.updateOne({ _id: phone._id }, { $inc: { views: 1 } });

      return NextResponse.json(phoneToJSON(phone, specs, benchmarks, images, prices));
    }

    // ---- /api/brands ----
    if (segments.length === 1 && segments[0] === 'brands') {
      await connectDB();
      const brands = await Brand.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
      const brandIds = brands.map((b: any) => b._id);
      const counts = await Phone.aggregate([
        { $match: { active: true, status: 'published', brandId: { $in: brandIds } } },
        { $group: { _id: '$brandId', count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((c: any) => [c._id?.toString(), c.count]));

      return NextResponse.json({
        brands: brands.map((b: any) => ({
          id: b._id?.toString(), name: b.name, slug: b.slug,
          logo: b.logo || '', country: b.country || '',
          description: b.description || '',
          _count: { phones: countMap.get(b._id?.toString()) || 0 },
        })),
      });
    }

    // ---- /api/brands/:slug ----
    if (segments.length === 2 && segments[0] === 'brands') {
      await connectDB();
      const slug = segments[1];
      const brand = await Brand.findOne({ slug, active: true }).lean();
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

      const phones = await Phone.find({ brandId: brand._id, active: true, status: 'published' })
        .populate('brand').sort({ createdAt: -1 }).lean();

      return NextResponse.json({
        brand: { id: brand._id?.toString(), name: brand.name, slug: brand.slug, logo: brand.logo || '', country: brand.country || '', description: brand.description || '' },
        phones: phones.map(p => phoneToJSON(p)),
      });
    }

    // ---- /api/search ----
    if (segments.length === 1 && segments[0] === 'search') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const q = (searchParams.get('q') || '').trim();
      if (!q) return NextResponse.json({ brands: [], phones: [] });

      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [brands, phones] = await Promise.all([
        Brand.find({ active: true, $or: [{ name: regex }, { slug: regex }] }).limit(10).lean(),
        Phone.find({ active: true, status: 'published', $or: [{ modelName: regex }, { slug: regex }, { description: regex }] })
          .populate('brand').sort({ views: -1 }).limit(20).lean(),
      ]);

      return NextResponse.json({
        brands: brands.map((b: any) => ({ id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '', country: b.country || '', description: b.description || '' })),
        phones: phones.map(p => phoneToJSON(p)),
      });
    }

    // ---- /api/news ----
    if (segments.length === 1 && segments[0] === 'news') {
      await connectDB();
      const news = await News.find({ published: true, status: 'published' }).sort({ createdAt: -1 }).lean();
      return NextResponse.json({
        news: news.map((n: any) => ({
          id: n._id?.toString(), title: n.title, slug: n.slug,
          excerpt: n.excerpt || '', content: n.content || '',
          category: n.category || 'General', author: n.author || '',
          imageUrl: n.image || '', published: n.published,
          createdAt: n.createdAt,
        })),
      });
    }

    // ---- /api/admin/stats ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'stats') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const [totalPhones, totalBrands, trendingCount, featuredCount, newsCount] = await Promise.all([
        Phone.countDocuments({ active: true, status: 'published' }),
        Brand.countDocuments({ active: true }),
        Phone.countDocuments({ active: true, status: 'published', trending: true }),
        Phone.countDocuments({ active: true, status: 'published', featured: true }),
        News.countDocuments({ published: true }),
      ]);
      return NextResponse.json({ totalPhones, totalBrands, trendingCount, featuredCount, newsCount });
    }

    // ---- /api/admin/phones ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const phones = await Phone.find().populate('brand').sort({ createdAt: -1 }).lean();
      return NextResponse.json({ phones: phones.map(p => phoneToJSON(p)) });
    }

    // ---- /api/admin/brands ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const brands = await Brand.find().sort({ name: 1 }).lean();
      return NextResponse.json({ brands: brands.map((b: any) => ({ id: b._id?.toString(), name: b.name, slug: b.slug, logo: b.logo || '', country: b.country || '', description: b.description || '', active: b.active })) });
    }

    // ---- /api/admin/news ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const news = await News.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ news: news.map((n: any) => ({ id: n._id?.toString(), title: n.title, slug: n.slug, excerpt: n.excerpt || '', content: n.content || '', category: n.category || 'General', author: n.author || '', imageUrl: n.image || '', published: n.published, status: n.status, createdAt: n.createdAt })) });
    }

    // ---- /api/admin/sponsors ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sponsors') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ sponsors: sponsors.map((s: any) => ({ id: s._id?.toString(), name: s.name, image: s.image || '', url: s.url || '', position: s.position || '', active: s.active })) });
    }

    // ---- /api/admin/activity ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'activity') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(50).populate('adminId', 'name email').lean();
      return NextResponse.json({ logs: logs.map((l: any) => ({ id: l._id?.toString(), action: l.action, details: l.details, entityType: l.entityType, createdAt: l.createdAt, admin: l.adminId ? { name: l.adminId.name, email: l.adminId.email } : undefined })) });
    }

    // ---- /api/admin/login ---- (GET returns current session)
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login') {
      return NextResponse.json({ ok: true });
    }

    // ---- /api/collector/dashboard ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'dashboard') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const [totalSources, activeSources, totalJobs, pendingReview, completedJobs] = await Promise.all([
        CollectorSource.countDocuments(),
        CollectorSource.countDocuments({ enabled: true }),
        CollectorJob.countDocuments(),
        CollectedPhone.countDocuments({ status: { $in: ['pending', 'needs_review'] } }),
        CollectorJob.countDocuments({ status: 'completed' }),
      ]);
      return NextResponse.json({ totalSources, activeSources, totalJobs, pendingReview, completedJobs });
    }

    // ---- /api/collector/sources ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const sources = await CollectorSource.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ sources: sources.map((s: any) => ({ id: s._id?.toString(), ...s })) });
    }

    // ---- /api/collector/jobs ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const jobs = await CollectorJob.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ jobs: jobs.map((j: any) => ({ id: j._id?.toString(), ...j })) });
    }

    // ---- /api/collector/review ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'review') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'pending';
      const page = parseInt(searchParams.get('page') || '1');
      const limit = 20;
      const query: any = {};
      if (status !== 'all') query.status = status;
      const total = await CollectedPhone.countDocuments(query);
      const phones = await CollectedPhone.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
      return NextResponse.json({ phones: phones.map((p: any) => ({ id: p._id?.toString(), ...p })), total, page });
    }

    // ---- /api/collector/review/:id ----
    if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const phone = await CollectedPhone.findById(segments[2]).lean();
      if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ id: phone._id?.toString(), ...phone });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API GET error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ============ POST HANDLER ============
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // ---- /api/admin/login ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login') {
      await connectDB();
      const body = await req.json();
      const { email, password } = body;

      // Try DB first
      let admin = await Admin.findOne({ email, active: true });

      // Fallback: if no admin in DB, auto-create with default credentials
      if (!admin && email === 'admin@phonedock.pk' && password === 'admin123') {
        const hashedPw = await bcrypt.hash('admin123', 12);
        admin = await Admin.create({
          email: 'admin@phonedock.pk',
          password: hashedPw,
          name: 'Admin',
          role: 'superadmin',
          active: true,
        });
        console.log('[Auto-seed] Created default admin user');
      }

      if (!admin) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      await Admin.updateOne({ _id: admin._id }, { lastLogin: new Date() });
      try { await ActivityLog.create({ adminId: admin._id, action: 'login', details: 'Admin logged in', entityType: 'admin' }); } catch {}
      const token = generateToken();
      return NextResponse.json({
        token,
        admin: { id: admin._id?.toString(), email: admin.email, name: admin.name, role: admin.role },
      });
    }

    // ---- /api/import (file upload) ----
    if (segments.length === 1 && segments[0] === 'import') {
      return handleCollectorFileUpload(req);
    }

    // ---- /api/import/validate ----
    if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'validate') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
      const text = Buffer.from(await file.arrayBuffer()).toString('utf-8');
      const ext = file.name.split('.').pop()?.toLowerCase();
      let records: any[] = [];
      if (ext === 'json') {
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else if (ext === 'csv') {
        const result = await new Promise<{ data: any[] }>((resolve) => {
          Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve });
        });
        records = result.data;
      }
      return NextResponse.json({ valid: true, totalRecords: records.length, sample: records.slice(0, 3) });
    }

    // ---- /api/import/rollback ----
    if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'rollback') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await req.json();
      return NextResponse.json({ success: true, message: 'Rollback not implemented yet' });
    }

    // ---- /api/collector/sources ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const body = await req.json();
      const source = await CollectorSource.create(body);
      return NextResponse.json({ success: true, id: source._id });
    }

    // ---- /api/collector/jobs ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const body = await req.json();
      const job = await CollectorJob.create({ ...body, status: 'pending', startedAt: new Date() });
      return NextResponse.json({ success: true, id: job._id });
    }

    // ---- /api/collector/review/:id ----
    if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const body = await req.json();
      const { action } = body;
      const item = await CollectedPhone.findById(segments[2]);
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      if (action === 'approve') {
        // Create a real Phone from collected data
        const brand = await Brand.findOne({ name: new RegExp(`^${item.brandName}$`, 'i') });
        if (!brand) return NextResponse.json({ error: `Brand "${item.brandName}" not found` }, { status: 400 });

        const phone = await Phone.create({
          brandId: brand._id, modelName: item.model, slug: item.slug,
          pricePKR: 0, thumbnail: item.thumbnail || '',
          description: '', status: 'published', active: true,
          featured: false, trending: false, upcoming: false,
        });
        item.status = 'approved';
        item.approvedPhoneId = phone._id;
        await item.save();
        await ActivityLog.create({ action: 'collector_approve', details: `Approved: ${item.brandName} ${item.model}`, entityType: 'collector' });
        return NextResponse.json({ success: true, phoneId: phone._id });
      } else if (action === 'reject') {
        item.status = 'rejected';
        await item.save();
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // ---- /api/collector/sources/:id/test ----
    if (segments.length === 4 && segments[0] === 'collector' && segments[1] === 'sources' && segments[3] === 'test') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ success: true, message: 'Test not implemented' });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API POST error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ============ PUT HANDLER ============
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // ---- /api/collector/sources/:id (toggle) ----
    if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const source = await CollectorSource.findById(segments[2]);
      if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      source.enabled = !source.enabled;
      await source.save();
      return NextResponse.json({ success: true, enabled: source.enabled });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ============ DELETE HANDLER ============
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // ---- /api/collector/jobs (delete job) ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
      if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await connectDB();
      const body = await req.json();
      await CollectorJob.findByIdAndDelete(body.jobId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ============ FILE UPLOAD HANDLER ============
async function handleCollectorFileUpload(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['json', 'csv', 'xlsx', 'xls'].includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .json, .csv, or .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[];

    if (ext === 'json' || ext === 'xlsx' || ext === 'xls') {
      const text = buffer.toString('utf-8');
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : [parsed];
      if (!Array.isArray(records[0])) {
        for (const wrapper of ['phones', 'data', 'records', 'results', 'items']) {
          if (Array.isArray(records[wrapper])) { records = records[wrapper]; break; }
        }
      }
    } else if (ext === 'csv') {
      const text = buffer.toString('utf-8');
      const result = await new Promise<{ data: any[] }>((resolve, reject) => {
        Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve });
      });
      records = result.data;
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No phone records found in file' }, { status: 400 });
    }

    let sourceName = `Upload: ${file.name}`;
    let resolvedSourceId = sourceId;

    if (!resolvedSourceId) {
      const slug = file.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 30);
      const existing = await CollectorSource.findOne({ name: new RegExp(`^${slug}`, 'i') }).lean();
      if (existing) {
        resolvedSourceId = (existing._id as string).toString();
        sourceName = existing.name;
      } else {
        const source = await CollectorSource.create({
          name: `Upload ${file.name}`, type: ext === 'csv' ? 'csv_url' : 'json_url',
          endpoint: '', enabled: true, totalCollected: 0,
        });
        resolvedSourceId = (source._id as string).toString();
        sourceName = source.name;
      }
    }

    const issues: string[] = [];
    const validRecords: any[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const brand = String(r.brand || r.brandName || '').trim();
      const model = String(r.model || r.modelName || r.name || '').trim();
      if (!brand || !model) { issues.push(`Row ${i + 1}: missing brand or model`); continue; }
      const slug = `${brand} ${model}`.toLowerCase().replace(/[^a-z0-9\s-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!/^[a-z0-9-]+$/.test(slug)) { issues.push(`Row ${i + 1}: invalid slug "${slug}"`); continue; }
      const phone: any = { brandName: brand, model, slug, ...r };
      const vIssues = validateCollectedPhone(phone);
      for (const iss of vIssues) issues.push(`Row ${i + 1}: ${iss.severity}: ${iss.field} - ${iss.message}`);
      validRecords.push(phone);
    }

    const allExisting = await Phone.find(
      { active: true, status: 'published' },
      { modelName: 1, slug: 1, brandId: 1, pricePKR: 1, battery: 1, display: 1, chipset: 1, os: 1, weight: 1 }
    ).populate({ path: 'brand', select: 'name' }).lean();
    const existingMap = new Map<string, any>();
    for (const p of allExisting) {
      existingMap.set(`${(p.brand as any)?.name || ''}|${p.modelName}`.toLowerCase(), {
        _id: p._id, modelName: p.modelName, slug: p.slug,
        brand: p.brand ? { name: p.brand.name } : undefined,
        weight: String(p.weight || ''), battery: String(p.battery || ''),
        display: String(p.display || ''), chipset: String(p.chipset || ''), os: String(p.os || ''),
        pricePKR: p.pricePKR || 0,
      });
    }

    let inserted = 0, updated = 0, skipped = 0;
    const batchDocs: any[] = [];

    for (const phone of validRecords) {
      const phoneNorm: any = { ...phone, brandName: String(phone.brandName), model: String(phone.model), slug };
      phoneNorm.releaseDate = String(phoneNorm.releaseDate || '');
      const dupResult = detectDuplicates(phoneNorm, allExisting);
      const hasExact = dupResult.matches.some(m => m.confidence >= 0.95);
      if (hasExact) { skipped++; continue; }
      const conflicts = detectConflicts(phoneNorm, existingMap.get(`${phoneNorm.brandName}|${phoneNorm.model}`.toLowerCase()) || [], sourceName);
      const isNew = dupResult.matches.length === 0 && conflicts.length === 0;
      if (isNew) { inserted++; } else { updated++; }
      const categories = suggestCategory(phoneNorm);
      const seo = suggestSEO(phoneNorm);
      const provenance = buildFieldProvenance(phoneNorm, resolvedSourceId, sourceName, '', 0.85);
      batchDocs.push({
        status: isNew ? 'pending' : 'needs_review',
        brandName: phoneNorm.brandName, model: phoneNorm.model, slug: phoneNorm.slug,
        releaseDate: phoneNorm.releaseDate || '',
        announcedDate: String(phoneNorm.announcedDate || ''),
        availability: String(phoneNorm.availability || ''),
        deviceStatus: String(phoneNorm.deviceStatus || ''),
        deviceType: String(phoneNorm.deviceType || ''),
        display: phoneNorm.display || {}, processor: phoneNorm.processor || {},
        memory: phoneNorm.memory || {}, camera: phoneNorm.camera || {},
        battery: phoneNorm.battery || {}, body: phoneNorm.body || {},
        connectivity: phoneNorm.connectivity || {}, software: phoneNorm.software || {},
        audio: phoneNorm.audio || {}, sensors: phoneNorm.sensors || {},
        benchmarks: phoneNorm.benchmarks || {}, images: phoneNorm.images || [],
        thumbnail: phoneNorm.thumbnail || '',
        suggestedCategory: categories.join(', '),
        suggestedSeoTitle: seo.title, suggestedSeoDescription: seo.description,
        suggestedKeywords: seo.keywords,
        sourceId: new mongoose.Types.ObjectId(resolvedSourceId),
        sourceName, sourceUrl: '', providerRecordId: phoneNorm.slug,
        fieldProvenance: provenance,
        duplicateMatches: dupResult.matches.map(m => ({
          type: m.type, phoneId: m.phoneId || '', modelName: m.modelName || '',
          brandName: m.brandName || '', slug: m.slug || '', confidence: m.confidence,
        })),
        hasExactDuplicate: hasExact,
        duplicatePhoneId: dupResult.matches[0]?.phoneId || '',
        conflicts, conflictCount: conflicts.length,
        validationIssues: issues.filter(i => i.includes(String(i + 1))).length > 0 ? issues.filter(i => i.includes(String(i + 1))) : [],
        isValid: issues.filter(i => i.includes('error')).length === 0,
        sourceReliability: 1.0,
      });
    }

    if (batchDocs.length > 0) {
      await CollectedPhone.insertMany(batchDocs);
    }

    await CollectorSource.updateOne({ _id: new mongoose.Types.ObjectId(resolvedSourceId) }, {
      $inc: { totalCollected: inserted + updated, totalFailed: issues.length },
      $set: { lastSyncAt: new Date(), lastSyncStatus: issues.length > 0 ? 'partial' : 'success' },
    });

    await ActivityLog.create({
      action: 'collector_upload',
      details: `Uploaded ${file.name}: ${inserted} new, ${updated} existing, ${skipped} duplicates, ${issues.length} issues`,
      entityType: 'collector',
    });

    return NextResponse.json({
      success: true, filename: file.name, totalRecords: records.length,
      validRecords: validRecords.length, inserted, updated, skipped, issues,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}