import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Phone, Brand, News, Admin, AdminSession, ActivityLog, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice, PriceHistory, UserReview, Video, Sponsor, PriceAlert, PhoneRetailListing, PriceTrackerHistory, CollectedPhone } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission, phoneToJSON, hashPassword, isStrongPassword, MAX_UPLOAD_RECORDS, revokeAllSessions, getActiveSessions, revokeSession } from './helpers';
import { syncYouTubeVideos } from '@/lib/video-sync';
import { revalidatePricePages } from '@/lib/revalidate';
import { escapeRegex } from '@/lib/sanitize';
import { normalizePhoneSpecs, normalizedToSerialized } from '@/lib/normalize-specs';

// ============ LOCAL TYPES ============

type MongooseSort = Record<string, 1 | -1>;
interface AggBucketResult { _id: string | number; count: number; }
interface AggCountResult { _id: mongoose.Types.ObjectId | null; count: number; }
interface PriceInput { storeName?: string; price?: number; url?: string; inStock?: boolean; }
interface ImageInput { url?: string; altText?: string; sortOrder?: number; }
interface LeanPhoneSlim { _id: mongoose.Types.ObjectId; slug: string; modelName: string; brand?: { name?: string } | null; }
interface LeanSpecsDoc { _id?: mongoose.Types.ObjectId; phoneId?: mongoose.Types.ObjectId; [key: string]: unknown; }
interface PhoneUpdateBody {
  brandId?: string | { id?: string; _id?: { toString(): string } };
  modelName?: string; slug?: string; pricePKR?: number | string; originalPricePKR?: number;
  ptaStatus?: string; ptaApproved?: boolean; releaseDate?: string;
  thumbnail?: string; description?: string; featured?: boolean; trending?: boolean; upcoming?: boolean; status?: string; active?: boolean;
  cameraScore?: number | string; performanceScore?: number | string; batteryScore?: number | string;
  displayScore?: number | string; valueScore?: number | string; overallRating?: number | string;
  pros?: string; cons?: string; reviewSummary?: string; reviewVerdict?: string;
  seoTitle?: string; seoDescription?: string; keywords?: string;
  specs?: Record<string, unknown>; benchmarks?: Record<string, unknown>;
  images?: ImageInput[]; prices?: PriceInput[];
  priceMode?: string; manualLock?: boolean; manualLockReason?: string; sourceUrl?: string;
  [key: string]: unknown;
}

// ============ ADMIN CRUD GET ============

export async function handleAdminCrudGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/stats ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'dashboard:read'); if (permCheck) return permCheck;
    await connectDB();
    const [totalPhones, totalBrands, trendingCount, featuredCount, newsCount, recentActivity, totalVideos, totalReviews, totalAdmins, totalSponsors] = await Promise.all([
      Phone.countDocuments({ active: true }),
      Brand.countDocuments({ active: true }),
      Phone.countDocuments({ active: true, trending: true }),
      Phone.countDocuments({ active: true, featured: true }),
      News.countDocuments({ published: true }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(20).populate('adminId', 'name email').lean(),
      Video.countDocuments({ active: true }),
      UserReview.estimatedDocumentCount(),
      Admin.countDocuments({ active: true }),
      Sponsor.estimatedDocumentCount(),
    ]);
    const priceResult = await Phone.aggregate([
      { $match: { active: true, pricePKR: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$pricePKR' } } },
    ]);
    const priceDistribution = await Phone.aggregate([
      { $match: { active: true, pricePKR: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$pricePKR',
          boundaries: [0, 20000, 40000, 60000, 100000, Infinity],
          default: 'Above 100K',
          output: { count: { $sum: 1 } },
        },
      },
    ]);
    const distLabels = ['Under 20K', '20K - 40K', '40K - 60K', '60K - 100K', 'Above 100K'];
    return NextResponse.json({
      totalPhones, totalBrands, trendingCount, featuredCount, newsCount, totalVideos, totalReviews, totalAdmins, totalSponsors,
      avgPrice: priceResult[0]?.avg || 0,
      priceDistribution: priceDistribution.map((d: AggBucketResult, i: number) => ({ range: distLabels[i] || d._id, count: d.count })),
      recentActivity: recentActivity.map((l: Record<string, unknown>) => ({
        ...l,
        id: (l._id as { toString(): string } | undefined)?.toString(),
        admin: l.adminId ? { name: (l.adminId as Record<string, unknown>).name as string, email: (l.adminId as Record<string, unknown>).email as string } : undefined,
      })),
    });
  }

  // ---- /api/admin/specs-audit ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'specs-audit') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const db = mongoose.connection.db!;

    const totalPhones = await Phone.countDocuments({ active: true, status: 'published' });
    const allPhones = await Phone.find({ active: true, status: 'published' }).select('_id slug modelName').lean();
    const allPhoneIds = new Set(allPhones.map((p: LeanPhoneSlim) => p._id.toString()));
    const specsDocs = await PhoneSpecs.find({}).select('phoneId').lean();
    const specPhoneIds = new Set(specsDocs.map((s: LeanSpecsDoc) => s.phoneId?.toString()));

    // Check for duplicates
    const specCountMap = new Map<string, number>();
    for (const s of specsDocs) {
      const key = s.phoneId?.toString();
      if (key) specCountMap.set(key, (specCountMap.get(key) || 0) + 1);
    }
    const duplicates = [...specCountMap.entries()].filter(([, c]) => c > 1);
    const orphanSpecs = specsDocs.filter((s: LeanSpecsDoc) => { const pid = s.phoneId?.toString(); return pid !== undefined && !allPhoneIds.has(pid); });

    // Backfill candidates
    const missingPhones = allPhones.filter((p: LeanPhoneSlim) => !specPhoneIds.has(p._id.toString()));
    let backfillCandidates: Array<{ slug: string; model: string; collectedSlug: string }> = [];
    if (missingPhones.length > 0) {
      const missingOids = missingPhones.map((p: LeanPhoneSlim) => p._id);
      const collected = await CollectedPhone.find({ approvedPhoneId: { $in: missingOids }, status: { $in: ['approved', 'imported'] } }).lean();
      const specSections = ['display','processor','memory','camera','battery','body','connectivity','software','sensors'];
      for (const c of collected) {
        let hasData = false;
        for (const sec of specSections) {
          const sub = (c as Record<string, unknown>)[sec];
          if (sub && typeof sub === 'object' && Object.values(sub as Record<string, unknown>).some((v: unknown) => typeof v === 'string' && (v as string).trim())) {
            hasData = true; break;
          }
        }
        if (hasData) {
          const ph = missingPhones.find((p: LeanPhoneSlim) => p._id.equals(c.approvedPhoneId));
          if (ph) backfillCandidates.push({ slug: ph.slug, model: ph.modelName, collectedSlug: c.slug });
        }
      }
    }

    return NextResponse.json({
      totalPhones,
      phonesWithSpecs: totalPhones - missingPhones.length,
      phonesWithoutSpecs: missingPhones.length,
      missingSlugs: missingPhones.map((p: LeanPhoneSlim) => p.slug),
      orphanSpecs: orphanSpecs.map((s: LeanSpecsDoc) => ({ id: s._id?.toString(), phoneId: s.phoneId?.toString() })),
      duplicateSpecs: duplicates.map(([phoneId, count]) => ({ phoneId, count })),
      backfillCandidates,
    });
  }

  // ---- /api/admin/phones/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const [total, published, draft, upcoming, trending, featured, ptaApproved, priceResult] = await Promise.all([
      Phone.countDocuments({ active: true }),
      Phone.countDocuments({ active: true, status: 'published' }),
      Phone.countDocuments({ active: true, status: 'draft' }),
      Phone.countDocuments({ active: true, upcoming: true }),
      Phone.countDocuments({ active: true, trending: true }),
      Phone.countDocuments({ active: true, featured: true }),
      Phone.countDocuments({ active: true, ptaApproved: true }),
      Phone.aggregate([{ $match: { active: true, pricePKR: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$pricePKR' } } }]),
    ]);
    return NextResponse.json({ total, published, draft, upcoming, trending, featured, ptaApproved, avgPrice: Math.round(priceResult[0]?.avg || 0) });
  }

  // ---- /api/admin/phones (ENHANCED LIST with search, filter, sort, pagination) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = { active: true };
    // Search
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      const brandMatches = await Brand.find({ name: { $regex: safe, $options: 'i' } }).select('_id').lean();
      const brandIds = brandMatches.map((b: { _id: mongoose.Types.ObjectId }) => b._id);
      const searchOr: Record<string, unknown>[] = [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
      ];
      if (brandIds.length > 0) searchOr.push({ brandId: { $in: brandIds } });
      filter.$or = searchOr;
    }
    // Status filter
    const status = url.searchParams.get('status');
    if (status === 'published') filter.status = 'published';
    else if (status === 'draft') filter.status = 'draft';
    else if (status === 'pending') filter.status = 'pending';
    else if (status === 'archived') filter.status = 'archived';
    else if (status === 'upcoming') filter.upcoming = true;
    else if (status === 'trending') filter.trending = true;
    else if (status === 'featured') filter.featured = true;
    // Brand filter
    const brandId = url.searchParams.get('brandId');
    if (brandId) filter.brandId = brandId;
    // PTA filter
    const ptaFilter = url.searchParams.get('pta');
    if (ptaFilter === 'approved') filter.ptaApproved = true;
    else if (ptaFilter === 'non-pta') filter.ptaApproved = false;
    // Price range filter
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter.$gte = parseInt(minPrice, 10);
      if (maxPrice) priceFilter.$lte = parseInt(maxPrice, 10);
      filter.pricePKR = priceFilter;
    }
    // Featured/Trending toggles
    if (url.searchParams.get('featured') === 'true') filter.featured = true;
    if (url.searchParams.get('trending') === 'true') filter.trending = true;
    // Sort
    let sort: MongooseSort = { createdAt: -1 };
    const sortParam = url.searchParams.get('sort');
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'price-low') sort = { pricePKR: 1 };
    else if (sortParam === 'price-high') sort = { pricePKR: -1 };
    else if (sortParam === 'name-az') sort = { modelName: 1 };
    else if (sortParam === 'name-za') sort = { modelName: -1 };
    else if (sortParam === 'rating') sort = { overallRating: -1 };
    else if (sortParam === 'views') sort = { views: -1 };

    const [phones, total] = await Promise.all([
      Phone.find(filter).sort(sort).skip(skip).limit(limit).populate('brand').lean(),
      Phone.countDocuments(filter),
    ]);
    return NextResponse.json({
      phones: phones.map((p) => phoneToJSON(p)),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/phones/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const phone = await Phone.findById(segments[2]).populate('brand').lean();
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [specs, benchmarks, images, prices] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).limit(50).lean(),
    ]);
    return NextResponse.json(phoneToJSON(phone, specs, benchmarks, images, prices));
  }

  // ---- /api/admin/brands/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'brands' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:read'); if (permCheck) return permCheck;
    await connectDB();
    const [total, active, inactive, withLogos, countries, phonesAgg] = await Promise.all([
      Brand.estimatedDocumentCount(),
      Brand.countDocuments({ active: true }),
      Brand.countDocuments({ active: false }),
      Brand.countDocuments({ logo: { $ne: null, $exists: true } }),
      Brand.distinct('country'),
      Phone.aggregate([{ $group: { _id: null, total: { $sum: 1 } } }]),
    ]);
    return NextResponse.json({
      total,
      active,
      inactive,
      withLogos,
      countries: countries.filter((c: string) => c && c.trim()).length,
      totalPhones: phonesAgg[0]?.total || 0,
    });
  }

  // ---- /api/admin/brands ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:read'); if (permCheck) return permCheck;
    await connectDB();

    const sp = req.nextUrl.searchParams;
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status') || 'all';
    const country = sp.get('country') || '';
    const sort = sp.get('sort') || 'sort-order';
    const page = Math.max(1, parseInt(sp.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '24') || 24));

    // Build filter
    const filter: Record<string, unknown> = {};
    if (search.length >= 2) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.active = true;
    else if (status === 'inactive') filter.active = false;
    if (country) filter.country = country;

    // Build sort
    const sortObj: MongooseSort = {};
    if (sort === 'name') sortObj.name = 1;
    else if (sort === 'sort-order') sortObj.sortOrder = 1;
    else if (sort === 'newest') sortObj.createdAt = -1;
    else if (sort === 'oldest') sortObj.createdAt = 1;

    const [total, brands, phoneCounts] = await Promise.all([
      Brand.countDocuments(filter),
      Brand.find(filter).sort(sortObj).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Phone.aggregate([{ $group: { _id: '$brandId', count: { $sum: 1 } } }]),
    ]);

    const phoneCountMap = new Map(phoneCounts.map((p: AggCountResult) => [p._id?.toString(), p.count]));

    return NextResponse.json({
      brands: brands.map((b: Record<string, unknown> & { _id?: { toString(): string } }) => ({ ...b, id: b._id?.toString(), phonesCount: phoneCountMap.get(b._id?.toString()) || 0 })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  // ---- /api/admin/news/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, published, draft, scheduled, pending, featured, todayPublished, totalViews] = await Promise.all([
      News.estimatedDocumentCount(),
      News.countDocuments({ published: true, status: 'published' }),
      News.countDocuments({ published: false, status: { $ne: 'published' } }),
      News.countDocuments({ status: 'scheduled' }),
      News.countDocuments({ status: 'pending' }),
      News.countDocuments({ featured: true }),
      News.countDocuments({ published: true, createdAt: { $gte: todayStart } }),
      News.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
    ]);
    return NextResponse.json({ total, published, draft, scheduled, pending, featured, todayPublished, totalViews: totalViews[0]?.total || 0 });
  }

  // ---- /api/admin/news (ENHANCED LIST) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      filter.$or = [{ title: { $regex: safe, $options: 'i' } }, { slug: { $regex: safe, $options: 'i' } }, { excerpt: { $regex: safe, $options: 'i' } }];
    }
    const status = url.searchParams.get('status');
    if (status === 'published') filter.published = true;
    else if (status === 'draft') { filter.published = false; filter.status = { $ne: 'published' }; }
    else if (status === 'featured') filter.featured = true;
    else if (status === 'scheduled') filter.status = 'scheduled';
    else if (status === 'archived') filter.status = 'archived';
    const category = url.searchParams.get('category');
    if (category) filter.category = category;
    const sortParam = url.searchParams.get('sort');
    let sort: MongooseSort = { createdAt: -1 };
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'views') sort = { views: -1 };
    else if (sortParam === 'alpha') sort = { title: 1 };
    else if (sortParam === 'updated') sort = { updatedAt: -1 };
    const [news, total] = await Promise.all([
      News.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      News.countDocuments(filter),
    ]);
    return NextResponse.json({
      news: news.map((n: Record<string, unknown> & { _id?: { toString(): string } }) => ({ ...n, id: n._id?.toString() })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/users/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const weekStart = new Date(Date.now() - 7*24*60*60*1000);
    const monthStart = new Date(Date.now() - 30*24*60*60*1000);
    const [total, superAdmins, activeAdmins, disabledAdmins, suspendedAdmins, failedToday, twoFactorEnabled, withCustomPerms] = await Promise.all([
      Admin.estimatedDocumentCount(),
      Admin.countDocuments({ role: 'superadmin' }),
      Admin.countDocuments({ active: true, $or: [{ suspended: { $ne: true } }, { suspended: { $exists: false } }] }),
      Admin.countDocuments({ active: false }),
      Admin.countDocuments({ suspended: true }),
      Admin.countDocuments({ failedAttempts: { $gt: 0 }, lastLogin: { $lt: todayStart } }),
      Admin.countDocuments({ twoFactorEnabled: true }),
      Admin.countDocuments({ customPermissions: { $exists: true, $ne: [] } }),
    ]);
    // Count online admins (active sessions in last 30 min)
    const recentThreshold = new Date(Date.now() - 30*60*1000);
    const onlineAdmins = await AdminSession.countDocuments({ lastUsedAt: { $gte: recentThreshold }, revokedAt: null, expiresAt: { $gt: new Date() } });
    // Count active sessions total
    const activeSessions = await AdminSession.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } });
    // Failed login attempts today
    const failedLoginToday = await Admin.countDocuments({ failedAttempts: { $gt: 0 }, updatedAt: { $gte: todayStart } });
    return NextResponse.json({ total, superAdmins, activeAdmins, disabledAdmins, suspendedAdmins, failedToday: failedLoginToday, onlineAdmins, activeSessions, twoFactorEnabled, withCustomPerms });
  }

  // ---- /api/admin/users/:id (DETAIL) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users' && segments[2] !== 'stats' && segments[2] !== 'bulk' && segments[2] !== 'invite' && segments[2] !== 'export') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const targetUser = await Admin.findById(segments[2]).select('-password -resetTokenHash -resetTokenExpires -invitationTokenHash -invitationExpires -twoFactorSecret').lean();
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Get sessions
    const sessions = await getActiveSessions(targetUser._id.toString());
    // Get recent activity for this user
    const recentActivity = await ActivityLog.find({ adminId: targetUser._id }).sort({ createdAt: -1 }).limit(20).lean();
    // Count sessions
    const sessionCount = sessions.length;
    // Derive status
    let status = 'active';
    if ('suspended' in targetUser && targetUser.suspended) status = 'suspended';
    else if (!targetUser.active) status = 'inactive';
    return NextResponse.json({
      ...targetUser, id: targetUser._id?.toString(), _id: undefined, __v: undefined,
      status,
      sessionCount,
      sessions: sessions.map((s) => ({
        id: s._id?.toString(),
        jti: s.tokenJti,
        ip: s.ip || '',
        userAgent: (s.userAgent || '').slice(0, 200),
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        isCurrent: false,
      })),
      recentActivity: recentActivity.map((l: Record<string, unknown> & { _id?: { toString(): string } }) => ({ ...l, id: l._id?.toString(), _id: undefined })),
    });
  }

  // ---- /api/admin/users/export ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users' && segments[2] === 'export') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const users = await Admin.find().select('-password -resetTokenHash -resetTokenExpires -twoFactorSecret -twoFactorRecoveryCodes -invitationTokenHash -invitationExpires -customPermissions').sort({ createdAt: -1 }).lean();
    const csvHeader = 'Name,Email,Role,Status,2FA,Last Login,Failed Attempts,Created At\n';
    const csvRows = users.map((u: Record<string, unknown>) => {
      let status = 'Active';
      if (u.suspended) status = 'Suspended';
      else if (!u.active) status = 'Inactive';
      return `"${((u.name as string) || '').replace(/"/g, '""')}","${u.email}","${u.role}","${status}","${u.twoFactorEnabled ? 'Yes' : 'No'}","${u.lastLogin ? new Date(u.lastLogin as Date).toISOString() : 'Never'}","${u.failedAttempts || 0}","${new Date(u.createdAt as Date).toISOString()}"`;
    }).join('\n');
    return new NextResponse(csvHeader + csvRows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="admin-users-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  // ---- /api/admin/users (ENHANCED LIST) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    // Search
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { role: { $regex: safe, $options: 'i' } },
      ];
    }
    // Role filter
    const role = url.searchParams.get('role');
    if (role && role !== 'all') filter.role = role;
    // Status filter
    const status = url.searchParams.get('status');
    if (status === 'active') { filter.active = true; filter.$or = filter.$or ? [...(filter.$or as Record<string, unknown>[]), { suspended: { $ne: true } }] : undefined; if (!filter.$or) filter.suspended = { $ne: true }; }
    else if (status === 'inactive') filter.active = false;
    else if (status === 'suspended') filter.suspended = true;
    // 2FA filter
    const tfa = url.searchParams.get('twoFactor');
    if (tfa === 'enabled') filter.twoFactorEnabled = true;
    else if (tfa === 'disabled') { filter.$or = filter.$or ? [...(filter.$or as Record<string, unknown>[]), { twoFactorEnabled: { $ne: true } }] : [{ twoFactorEnabled: { $ne: true } }]; }
    // Last login filter
    const lastLogin = url.searchParams.get('lastLogin');
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    if (lastLogin === 'today') filter.lastLogin = { $gte: todayStart };
    else if (lastLogin === 'week') filter.lastLogin = { $gte: new Date(Date.now() - 7*24*60*60*1000) };
    else if (lastLogin === 'month') filter.lastLogin = { $gte: new Date(Date.now() - 30*24*60*60*1000) };
    // Sort
    let sort: MongooseSort = { createdAt: -1 };
    const sortParam = url.searchParams.get('sort');
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'name') sort = { name: 1 };
    else if (sortParam === 'recent') sort = { lastLogin: -1 };
    else if (sortParam === 'role') sort = { role: 1, name: 1 };
    else if (sortParam === 'status') sort = { active: -1, suspended: 1, name: 1 };

    // Fix $or conflicts between search and other filters
    if (search.length >= 2 && (status || tfa || lastLogin)) {
      // Merge $or conditions properly
      const searchOr = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { role: { $regex: escapeRegex(search), $options: 'i' } },
      ];
      delete filter.$or;
      // Build proper query with $and
      const andConditions: Record<string, unknown>[] = [{ $or: searchOr }];
      if (status === 'active') andConditions.push({ active: true, suspended: { $ne: true } });
      else if (status === 'inactive') andConditions.push({ active: false });
      else if (status === 'suspended') andConditions.push({ suspended: true });
      if (tfa === 'enabled') andConditions.push({ twoFactorEnabled: true });
      else if (tfa === 'disabled') andConditions.push({ $or: [{ twoFactorEnabled: false }, { twoFactorEnabled: { $exists: false } }] });
      if (lastLogin === 'today') andConditions.push({ lastLogin: { $gte: todayStart } });
      else if (lastLogin === 'week') andConditions.push({ lastLogin: { $gte: new Date(Date.now() - 7*24*60*60*1000) } });
      else if (lastLogin === 'month') andConditions.push({ lastLogin: { $gte: new Date(Date.now() - 30*24*60*60*1000) } });

      const [users, total] = await Promise.all([
        Admin.find({ $and: andConditions }).select('-password -resetTokenHash -resetTokenExpires -twoFactorSecret -twoFactorRecoveryCodes -invitationTokenHash -invitationExpires').sort(sort).skip(skip).limit(limit).lean(),
        Admin.countDocuments({ $and: andConditions }),
      ]);
      return NextResponse.json({
        users: users.map((u: Record<string, unknown>) => {
          let userStatus = 'active';
          if (u.suspended) userStatus = 'suspended';
          else if (!u.active) userStatus = 'inactive';
          const sessionCount = 0; // lazy — fetched on detail
          return { ...u, id: (u._id as { toString(): string })?.toString(), _id: undefined, __v: undefined, status: userStatus, sessionCount };
        }),
        total, page, limit, totalPages: Math.ceil(total / limit),
      });
    }

    const [users, total] = await Promise.all([
      Admin.find(filter).select('-password -resetTokenHash -resetTokenExpires -twoFactorSecret -twoFactorRecoveryCodes -invitationTokenHash -invitationExpires').sort(sort).skip(skip).limit(limit).lean(),
      Admin.countDocuments(filter),
    ]);
    return NextResponse.json({
      users: users.map((u: Record<string, unknown>) => {
        let userStatus = 'active';
        if (u.suspended) userStatus = 'suspended';
        else if (!u.active) userStatus = 'inactive';
        return { ...u, id: (u._id as { toString(): string })?.toString(), _id: undefined, __v: undefined, status: userStatus, sessionCount: 0 };
      }),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/sponsors ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sponsors') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'sponsors:read'); if (permCheck) return permCheck;
    await connectDB();
    const { Sponsor } = await import('@/lib/models/Other');
    const sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ sponsors: sponsors.map((s: Record<string, unknown> & { _id?: { toString(): string } }) => ({ ...s, id: s._id?.toString() })) });
  }

  // ---- /api/admin/activity (ENHANCED LIST) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'activity') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'activity:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const filter: Record<string, unknown> = {};
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      filter.$or = [{ action: { $regex: safe, $options: 'i' } }, { details: { $regex: safe, $options: 'i' } }];
    }
    const moduleName = url.searchParams.get('module');
    if (moduleName) filter.entityType = moduleName;
    const actionType = url.searchParams.get('action');
    if (actionType) {
      const safeActionType = escapeRegex(actionType);
      filter.action = { $regex: safeActionType, $options: 'i' };
    }
    const sortParam = url.searchParams.get('sort') || 'newest';
    const sortDir = sortParam === 'oldest' ? 1 : -1;
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: sortDir }).skip((page - 1) * limit).limit(limit).populate('adminId', 'name email role').lean(),
      ActivityLog.countDocuments(filter),
    ]);
    return NextResponse.json({
      logs: logs.map((l: Record<string, unknown>) => ({
        ...l, id: l._id?.toString(),
        admin: l.adminId ? { name: (l.adminId as Record<string, unknown>).name as string, email: (l.adminId as Record<string, unknown>).email as string, role: (l.adminId as Record<string, unknown>).role as string } : undefined,
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/activity/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'activity' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'activity:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, todayActivities, securityEvents] = await Promise.all([
      ActivityLog.estimatedDocumentCount(),
      ActivityLog.countDocuments({ createdAt: { $gte: todayStart } }),
      ActivityLog.countDocuments({ action: { $regex: 'delete|password|login_fail|permission', $options: 'i' } }),
    ]);
    const moduleBreakdown = await ActivityLog.aggregate([{ $group: { _id: '$entityType', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]);
    const recentAdmins = await ActivityLog.distinct('adminId', { createdAt: { $gte: todayStart } });
    return NextResponse.json({ total, todayActivities, securityEvents, moduleBreakdown, activeAdminsToday: recentAdmins.length });
  }

  // ---- /api/admin/videos/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, liveCount, pendingCount, draftCount, hiddenCount, failedCount, featuredCount, todaySynced, totalViews, totalLikes] = await Promise.all([
      Video.estimatedDocumentCount(),
      Video.countDocuments({ status: 'live', active: true }),
      Video.countDocuments({ status: 'pending' }),
      Video.countDocuments({ status: 'draft' }),
      Video.countDocuments({ $or: [{ status: 'hidden' }, { hidden: true }] }),
      Video.countDocuments({ syncStatus: 'failed' }),
      Video.countDocuments({ featured: true }),
      Video.countDocuments({ lastSyncedAt: { $gte: todayStart } }),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$likes' } } }]),
    ]);
    const lastSync = await Video.findOne({ lastSyncedAt: { $ne: null } }).sort({ lastSyncedAt: -1 }).select('lastSyncedAt').lean();
    return NextResponse.json({
      total, liveCount, pendingCount, draftCount, hiddenCount, failedCount, featuredCount, todaySynced,
      totalViews: totalViews[0]?.total || 0,
      totalLikes: totalLikes[0]?.total || 0,
      lastSyncTime: (lastSync ? (lastSync as unknown as Record<string, unknown>)?.lastSyncedAt : null) as Date || null,
      channelName: process.env.YOUTUBE_CHANNEL_NAME || 'YouTube Channel',
    });
  }

  // ---- /api/admin/videos/search?q=... (autocomplete for PhoneForm) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos' && segments[2] === 'search') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:read'); if (permCheck) return permCheck;
    await connectDB();
    const q = new URL(req.url).searchParams.get('q') || '';
    if (q.length < 2) return NextResponse.json({ videos: [] });
    const safe = escapeRegex(q);
    const videos = await Video.find({ title: { $regex: safe, $options: 'i' } }).sort({ publishedAt: -1 }).limit(10).populate('phoneId', 'modelName slug').lean();
    return NextResponse.json({ videos: videos.map((v) => ({
      id: v._id?.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt,
      active: v.active,
      autoLinked: v.autoLinked,
      phoneId: (v.phoneId as unknown as { _id?: { toString(): string } })?._id?.toString() || null,
      phoneName: (v.phoneId as unknown as { modelName?: string })?.modelName || null,
    })) });
  }

  // ---- /api/admin/videos (ENHANCED LIST with search, filter, sort) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'videos') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    // Search
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { youtubeId: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { channelName: { $regex: safe, $options: 'i' } },
      ];
      // Also search by phone model/brand
      const phoneMatches = await Phone.find({ $or: [{ modelName: { $regex: safe, $options: 'i' } }, { slug: { $regex: safe, $options: 'i' } }] }).select('_id').lean();
      if (phoneMatches.length > 0) (filter.$or as Record<string, unknown>[]).push({ phoneId: { $in: phoneMatches.map(p => p._id) } });
    }
    // Status filter (new enhanced status field, backward compat with old active filter)
    const status = url.searchParams.get('status');
    if (status && status !== 'all') {
      if (status === 'active') { filter.active = true; filter.status = 'live'; }
      else if (status === 'pending_old') { filter.active = false; }
      else { filter.status = status; }
    }
    // Sync status filter
    const syncStatus = url.searchParams.get('syncStatus');
    if (syncStatus && syncStatus !== 'all') filter.syncStatus = syncStatus;
    // Featured filter
    if (url.searchParams.get('featured') === 'true') filter.featured = true;
    // Brand filter
    const brandId = url.searchParams.get('brandId');
    if (brandId) filter.brandId = brandId;
    // Phone filter
    const phoneId = url.searchParams.get('phoneId');
    if (phoneId) filter.phoneId = phoneId;
    // Date filter
    const dateFilter = url.searchParams.get('dateFilter');
    if (dateFilter === 'today') {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      filter.createdAt = { $gte: todayStart };
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7*24*60*60*1000);
      filter.createdAt = { $gte: weekAgo };
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(Date.now() - 30*24*60*60*1000);
      filter.createdAt = { $gte: monthAgo };
    } else if (dateFilter === 'custom') {
      const from = url.searchParams.get('dateFrom');
      const to = url.searchParams.get('dateTo');
      if (from || to) {
        const dateFilterObj: Record<string, Date> = {};
        if (from) dateFilterObj.$gte = new Date(from);
        if (to) dateFilterObj.$lte = new Date(to);
        filter.createdAt = dateFilterObj;
      }
    }
    // Sort
    let sort: MongooseSort = { publishedAt: -1 };
    const sortParam = url.searchParams.get('sort');
    if (sortParam === 'oldest') sort = { publishedAt: 1 };
    else if (sortParam === 'views') sort = { views: -1 };
    else if (sortParam === 'likes') sort = { likes: -1 };
    else if (sortParam === 'comments') sort = { commentCount: -1 };
    else if (sortParam === 'synced') sort = { lastSyncedAt: -1 };
    else if (sortParam === 'alpha') sort = { title: 1 };
    else if (sortParam === 'created') sort = { createdAt: -1 };

    const [videos, total, pendingCount] = await Promise.all([
      Video.find(filter).sort(sort).skip(skip).limit(limit).populate('phoneId', 'modelName slug brand').populate('brandId', 'name').populate('createdBy', 'name').lean(),
      Video.countDocuments(filter),
      Video.countDocuments({ status: 'pending' }),
    ]);
    return NextResponse.json({
      videos: videos.map((v) => ({
        id: v._id?.toString(),
        youtubeId: v.youtubeId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        phoneId: (v.phoneId as unknown as { _id?: { toString(): string } })?._id?.toString() || null,
        phone: v.phoneId ? { modelName: (v.phoneId as unknown as { modelName?: string; slug?: string; brand?: { name?: string } }).modelName, slug: (v.phoneId as unknown as { slug?: string }).slug, brand: ((v.phoneId as unknown as { brand?: { name?: string } })?.brand)?.name || '' } : null,
        brand: v.brandId ? { name: (v.brandId as unknown as { name?: string; _id?: { toString(): string } }).name, id: (v.brandId as unknown as { _id?: { toString(): string } })?._id?.toString() } : null,
        active: v.active,
        autoLinked: v.autoLinked,
        status: v.status || (v.active ? 'live' : 'pending'),
        featured: v.featured || false,
        hidden: v.hidden || false,
        syncStatus: v.syncStatus || 'synced',
        views: v.views || 0,
        likes: v.likes || 0,
        commentCount: v.commentCount || 0,
        duration: v.duration || '',
        channelName: v.channelName || '',
        category: v.category || '',
        lastSyncedAt: v.lastSyncedAt || null,
        createdBy: v.createdBy ? { name: (v.createdBy as unknown as { name?: string }).name } : null,
        createdAt: v.createdAt,
      })),
      total, page, limit, pendingCount,
      totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/settings ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'settings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'settings:read'); if (permCheck) return permCheck;
    const settings = await (await import('@/lib/models')).getSettings();
    return NextResponse.json({ settings: { id: settings._id?.toString(), ...settings, _id: undefined } });
  }

  return undefined;
}

// ============ ADMIN CRUD POST ============

export async function handleAdminCrudPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/specs-backfill ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'specs-backfill') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:manage'); if (permCheck) return permCheck;
    await connectDB();

    const { flattenCollectedPhoneSpecs } = await import('@/lib/normalize-specs');
    const allPhones = await Phone.find({ active: true, status: 'published' }).select('_id slug modelName').lean();
    const existingSpecIds = new Set(
      (await PhoneSpecs.find({}, { projection: { phoneId: 1 } }).lean())
        .map((s: LeanSpecsDoc) => s.phoneId?.toString())
    );
    const missingPhones = allPhones.filter((p: LeanPhoneSlim) => !existingSpecIds.has(p._id.toString()));

    if (missingPhones.length === 0) {
      return NextResponse.json({ success: true, message: 'All phones already have specs', created: 0, skipped: 0 });
    }

    // Find CollectedPhone docs for missing phones
    const missingOids = missingPhones.map((p: LeanPhoneSlim) => p._id);
    const collectedDocs = await CollectedPhone.find({
      approvedPhoneId: { $in: missingOids },
      status: { $in: ['approved', 'imported'] },
    }).lean();

    const collectedByPhoneId = new Map<string, Record<string, unknown>>();
    for (const c of collectedDocs) {
      if (c.approvedPhoneId) collectedByPhoneId.set(c.approvedPhoneId.toString(), c);
    }

    let created = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const phone of missingPhones) {
      const collected = collectedByPhoneId.get(phone._id.toString());
      if (!collected) { skipped++; continue; }

      const flatSpecs = flattenCollectedPhoneSpecs(collected);
      if (Object.keys(flatSpecs).length === 0) { skipped++; continue; }

      try {
        await PhoneSpecs.findOneAndUpdate(
          { phoneId: phone._id },
          { $set: { phoneId: phone._id, ...flatSpecs } },
          { upsert: true, strict: false },
        );
        created++;
        details.push(`${phone.slug} — ${Object.keys(flatSpecs).length} fields`);
      } catch (err: unknown) {
        details.push(`${phone.slug} — ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      await ActivityLog.create({ adminId: admin._id, action: 'specs_backfill', details: `Backfilled specs for ${created} phones`, entityType: 'system' });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Created ${created} PhoneSpecs, skipped ${skipped}`,
      created,
      skipped,
      total: missingPhones.length,
      details,
    });
  }

  // ---- /api/admin/users (CREATE — superadmin only) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { email, name, role, password } = body;
    if (!email || !name || !password) return NextResponse.json({ error: 'Email, name, and password required' }, { status: 400 });
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.valid) return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    const validRoles = ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';
    if (assignedRole === 'superadmin' && admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can create superadmin accounts' }, { status: 403 });
    }
    const existing = await Admin.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    const newAdmin = await Admin.create({
      email: email.toLowerCase(), name: (name as string).trim(),
      password: await hashPassword(password),
      role: assignedRole, active: true, sessionVersion: 0,
    });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_user', details: `Created admin: ${email}`, entityType: 'admin', entityId: newAdmin._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: newAdmin._id?.toString() });
  }

  // ---- /api/admin/users/invite ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users' && segments[2] === 'invite') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { email, role, expiresInHours = 48 } = body;
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
    const validRoles = ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';
    if (assignedRole === 'superadmin' && admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can invite superadmins' }, { status: 403 });
    }
    const existing = await Admin.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + (expiresInHours || 48) * 60 * 60 * 1000);
    // Create admin in pending/invited state
    const tempPassword = crypto.randomBytes(24).toString('base64url').slice(0, 24);
    const newAdmin = await Admin.create({
      email: email.toLowerCase(), name: '', role: assignedRole,
      password: await hashPassword(tempPassword),
      active: false, invitationAccepted: false,
      invitedBy: admin._id, invitedAt: new Date(),
      invitationTokenHash: tokenHash, invitationExpires: expiresAt,
      sessionVersion: 0,
    });
    try { await ActivityLog.create({ adminId: admin._id, action: 'invite_user', details: `Invited ${email} as ${assignedRole}`, entityType: 'admin', entityId: newAdmin._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    // Send invite email if configured
    try {
      if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST, port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || '';
        const acceptLink = `${baseUrl}/admin/accept-invite?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;
        await transporter.sendMail({
          from: process.env.EMAIL_USER, to: email.toLowerCase(),
          subject: `Invitation to join PhoneDock Admin`,
          html: `<p>You've been invited to join PhoneDock as <strong>${assignedRole}</strong>.</p><p><a href="${acceptLink}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Accept Invitation</a></p><p>This link expires in ${expiresInHours} hours.</p>`,
        });
      }
    } catch (e) { console.error('[Invite] Email failed:', (e as Error).message); }
    return NextResponse.json({ success: true, id: newAdmin._id?.toString(), message: 'Invitation sent' });
  }

  // ---- /api/admin/users/bulk ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users' && segments[2] === 'bulk') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { ids, action, role } = body;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: 'Max 100 users per bulk action' }, { status: 400 });
    // Prevent acting on self
    if (ids.includes(admin._id.toString()) && (action === 'delete' || action === 'deactivate' || action === 'suspend')) {
      return NextResponse.json({ error: 'Cannot perform this action on your own account' }, { status: 400 });
    }
    const update: Record<string, unknown> = {};
    if (action === 'activate') { update.active = true; update.suspended = false; }
    else if (action === 'deactivate') { update.active = false; }
    else if (action === 'suspend') { update.active = false; update.suspended = true; }
    else if (action === 'assign_role') {
      if (!role) return NextResponse.json({ error: 'Role required for assign_role action' }, { status: 400 });
      const validRoles = ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];
      if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      if (role === 'superadmin' && admin.role !== 'superadmin') return NextResponse.json({ error: 'Only superadmins can assign superadmin role' }, { status: 403 });
      update.role = role;
    }
    else if (action === 'force_password_reset') { update.requirePasswordChange = true; update.$inc = { sessionVersion: 1 }; }
    else if (action === 'delete') {
      // Delete protection: check last superadmin
      if (admin.role !== 'superadmin') return NextResponse.json({ error: 'Only superadmins can delete users' }, { status: 403 });
      const targets = await Admin.find({ _id: { $in: ids } }).select('role').lean();
      const hasSuperAdmin = targets.some((t: { role: string }) => t.role === 'superadmin');
      if (hasSuperAdmin) {
        const superCount = await Admin.countDocuments({ role: 'superadmin' });
        if (superCount <= ids.length) return NextResponse.json({ error: 'Cannot delete all superadmins' }, { status: 400 });
      }
      const result = await Admin.deleteMany({ _id: { $in: ids, $ne: admin._id } });
      // Also revoke their sessions
      for (const id of ids) {
        try { await revokeAllSessions(id); } catch {}
      }
      try { await ActivityLog.create({ adminId: admin._id, action: 'bulk_delete_users', details: `Bulk deleted ${result.deletedCount} users`, entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    }
    else {
      return NextResponse.json({ error: 'Invalid action. Use: activate, deactivate, suspend, assign_role, force_password_reset, delete' }, { status: 400 });
    }
    const result = await Admin.updateMany({ _id: { $in: ids } }, { $set: update });
    // If forcing password reset, also revoke sessions
    if (action === 'force_password_reset') {
      for (const id of ids) {
        try { await revokeAllSessions(id); } catch {}
      }
    }
    try { await ActivityLog.create({ adminId: admin._id, action: `bulk_${action}_users`, details: `Bulk ${action}: ${result.modifiedCount} users`, entityType: 'admin' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  }

  // ---- /api/admin/phones (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { brandId, modelName, slug: inputSlug, pricePKR, originalPricePKR, ptaStatus, ptaApproved, releaseDate,
      thumbnail, description, featured, trending, upcoming, status: phoneStatus,
      cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
      pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
      specs, benchmarks, images, prices } = body;
    if (!brandId || !modelName) return NextResponse.json({ error: 'brandId and modelName required' }, { status: 400 });
    const brand = await Brand.findById(brandId).lean();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 400 });
    const slug = inputSlug || modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Phone.findOne({ slug }).lean();
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    const phone = await Phone.create({ brandId, modelName, slug, pricePKR: pricePKR || 0, originalPricePKR: originalPricePKR || 0, ptaStatus: ptaStatus || 'Unknown', ptaApproved: ptaApproved || false, releaseDate: releaseDate || '', thumbnail: thumbnail || '', description: description || '', featured: featured || false, trending: trending || false, upcoming: upcoming || false, status: phoneStatus || 'published', active: true, cameraScore: cameraScore || 0, performanceScore: performanceScore || 0, batteryScore: batteryScore || 0, displayScore: displayScore || 0, valueScore: valueScore || 0, overallRating: overallRating || 0, pros: pros || '', cons: cons || '', reviewSummary: reviewSummary || '', reviewVerdict: reviewVerdict || '', seoTitle: seoTitle || '', seoDescription: seoDescription || '', keywords: keywords || '' });
    if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
    if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
    if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: ImageInput, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
    if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: PriceInput) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
    // Record base price history
    if (pricePKR && pricePKR > 0) { try { await PriceHistory.create({ phoneId: phone._id, storeName: null, price: pricePKR }); } catch (e) { console.error('[PriceHistory]', e); } }
    // Record store price history
    if (Array.isArray(prices) && prices.length > 0) { try { await PriceHistory.insertMany(prices.filter((pr: PriceInput) => pr.price && pr.price > 0).map((pr: PriceInput) => ({ phoneId: phone._id, storeName: pr.storeName || null, price: pr.price }))); } catch (e) { console.error('[PriceHistory]', e); } }
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_phone', details: `Created: ${brand.name} ${modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: phone._id?.toString(), slug });
  }

  // ---- /api/admin/brands (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { name, slug: inputSlug, logo, country, description, sortOrder } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const slug = inputSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (await Brand.findOne({ slug }).lean()) return NextResponse.json({ error: 'Brand slug exists' }, { status: 409 });
    const brand = await Brand.create({ name, slug, logo: logo || '', country: country || '', description: description || '', sortOrder: sortOrder || 0, active: true });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_brand', details: `Created: ${name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: brand._id?.toString() });
  }

  // ---- /api/admin/news (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { title, slug: inputSlug, content, excerpt, category, image, author, published, featured } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const slug = (inputSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).slice(0, 80);
    if (await News.findOne({ slug }).lean()) return NextResponse.json({ error: 'News slug exists' }, { status: 409 });
    const news = await News.create({ title, slug, content: content || '', excerpt: excerpt || '', category: category || 'General', image: image || '', author: author || '', published: published !== false, featured: featured || false, status: 'published' });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_news', details: `Created: ${title}`, entityType: 'news', entityId: news._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: news._id?.toString() });
  }

  // ---- /api/admin/phones/bulk-import ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones' && segments[2] === 'bulk-import') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:execute'); if (permCheck) return permCheck;
    const body = await req.json();
    const { records, mode = 'skip_duplicates' } = body;
    if (!Array.isArray(records) || records.length === 0) return NextResponse.json({ error: 'No records' }, { status: 400 });
    if (records.length > MAX_UPLOAD_RECORDS) return NextResponse.json({ error: `Too many records (max ${MAX_UPLOAD_RECORDS})` }, { status: 400 });
    const brands = await Brand.find().lean();
    const brandMap = new Map(brands.map((b: { name: string; _id: mongoose.Types.ObjectId }) => [b.name.toLowerCase(), b._id]));
    const allPhones = await Phone.find().populate('brand').lean();
    const existingSlugs = new Set(allPhones.map((p: LeanPhoneSlim) => p.slug));
    const existingBM = new Set(allPhones.map((p: LeanPhoneSlim) => `${p.brand?.name || ''}|${p.modelName}`.toLowerCase()));
    let imported = 0, updated = 0, skipped = 0, failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        const bName = String(r.brand || r.brandName || '').trim();
        const mName = String(r.model || r.modelName || '').trim();
        if (!bName || !mName) { skipped++; errors.push(`Row ${i+1}: Missing brand/model`); continue; }
        let bId = brandMap.get(bName.toLowerCase());
        if (!bId) { const bslug = bName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const nb = await Brand.create({ name: bName, slug: bslug, active: true, description: '', sortOrder: 0, logo: '', country: '' }); brandMap.set(bName.toLowerCase(), nb._id); bId = nb._id; }
        const slug = String(r.slug || '').trim() || `${bName} ${mName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const isDup = existingSlugs.has(slug) || existingBM.has(`${bName}|${mName}`.toLowerCase());
        if (isDup && mode === 'skip_duplicates') { skipped++; continue; }
        if (isDup && mode === 'new_only') { skipped++; continue; }
        const pd: Record<string, unknown> = { brandId: bId, modelName: mName, slug, pricePKR: parseInt(r.pricePKR) || parseInt(r.price) || 0, ptaStatus: r.ptaStatus || 'Unknown', ptaApproved: r.ptaApproved === true, releaseDate: r.releaseDate || '', thumbnail: r.thumbnail || '', description: r.description || '', featured: r.featured === true, trending: r.trending === true, upcoming: r.upcoming === true, status: 'published', active: true, cameraScore: parseInt(r.cameraScore) || 0, performanceScore: parseInt(r.performanceScore) || 0, batteryScore: parseInt(r.batteryScore) || 0, displayScore: parseInt(r.displayScore) || 0, valueScore: parseInt(r.valueScore) || 0, overallRating: parseInt(r.overallRating) || 0, pros: r.pros || '', cons: r.cons || '', reviewSummary: r.reviewSummary || '', reviewVerdict: r.reviewVerdict || '' };
        if (isDup && mode === 'update_existing') { const ex = await Phone.findOne({ slug }); if (ex) { await Phone.updateOne({ _id: ex._id }, { $set: pd }); if (r.specs) { const { _id: _s, __v: _sv, phoneId: _sp, ...safeSpecs } = r.specs as Record<string, unknown>; await PhoneSpecs.findOneAndUpdate({ phoneId: ex._id }, { $set: safeSpecs }, { upsert: true }); } if (r.benchmarks) { const { _id: _b, __v: _bv, phoneId: _bp, ...safeBench } = r.benchmarks as Record<string, unknown>; await PhoneBenchmark.findOneAndUpdate({ phoneId: ex._id }, { $set: safeBench }, { upsert: true }); } updated++; continue; } }
        const phone = await Phone.create(pd); existingSlugs.add(slug); existingBM.add(`${bName}|${mName}`.toLowerCase());
        if (r.specs) { const { _id: _s, __v: _sv, phoneId: _sp, ...safeSpecs } = r.specs as Record<string, unknown>; await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { $set: safeSpecs, phoneId: phone._id }, { upsert: true }); }
        if (r.benchmarks) { const { _id: _b, __v: _bv, phoneId: _bp, ...safeBench } = r.benchmarks as Record<string, unknown>; await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set: safeBench, phoneId: phone._id }, { upsert: true }); }
        if (Array.isArray(r.images)) await PhoneImage.insertMany(r.images.map((img: ImageInput, j: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? j })));
        if (Array.isArray(r.prices)) await PhonePrice.insertMany(r.prices.map((pr: PriceInput) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
        imported++;
      } catch (err: unknown) { failed++; errors.push(`Row ${i+1}: ${err instanceof Error ? err.message : String(err)}`); }
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'bulk_import', details: `Bulk: ${imported} new, ${updated} updated, ${skipped} skipped, ${failed} failed`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, total: records.length, imported, updated, skipped, failed, errors });
  }

  // ---- /api/admin/sponsors (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sponsors') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'sponsors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { name, image, url, position, active, startDate, endDate } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { Sponsor } = await import('@/lib/models/Other');
    const sponsor = await Sponsor.create({ name, image: image || '', url: url || '', position: position || 'sidebar', active: active !== false, startDate: startDate || '', endDate: endDate || '' });
    return NextResponse.json({ success: true, id: sponsor._id?.toString() });
  }

  // ---- /api/admin/seed (REMOVED — use `npm run seed` CLI script instead) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'seed') {
    return NextResponse.json({ error: 'Seed endpoint removed. Use `npm run seed` from the CLI.' }, { status: 410 });
  }

  // ---- /api/admin/videos/sync (MANUAL SYNC) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos' && segments[2] === 'sync') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:manage'); if (permCheck) return permCheck;
    const result = await syncYouTubeVideos();
    try { await ActivityLog.create({ adminId: admin._id, action: 'sync_videos', details: `Sync: ${result.inserted} new, ${result.skipped} skipped, ${result.autoLinked} auto-linked`, entityType: 'video' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json(result);
  }

  // ---- /api/admin/videos/lookup (FETCH SINGLE VIDEO BY URL/ID, CREATE IF NEW) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos' && segments[2] === 'lookup') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const input = (body.youtubeUrl || body.youtubeId || '').trim();
    // Extract video ID from URL or raw ID
    let youtubeId = input;
    const urlMatch = input.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&#?\s]{11})/);
    if (urlMatch) youtubeId = urlMatch[1];
    if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return NextResponse.json({ error: 'Invalid YouTube URL or video ID' }, { status: 400 });
    }
    // Check if already in DB
    const existing = await Video.findOne({ youtubeId }).lean();
    if (existing) {
      return NextResponse.json({
        id: existing._id?.toString(),
        youtubeId: existing.youtubeId,
        title: existing.title,
        thumbnailUrl: existing.thumbnailUrl,
        publishedAt: existing.publishedAt,
        active: existing.active,
        autoLinked: existing.autoLinked,
        phoneId: existing.phoneId?.toString() || null,
        alreadyExisted: true,
      });
    }
    // Fetch from YouTube API (single video lookup, cheap)
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    try {
      const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtubeId}&key=${apiKey}`);
      if (!ytRes.ok) {
        if (ytRes.status === 403) return NextResponse.json({ error: 'YouTube API quota exceeded or key invalid' }, { status: 503 });
        return NextResponse.json({ error: 'YouTube API error' }, { status: 502 });
      }
      const ytData = await ytRes.json();
      const item = ytData.items?.[0];
      if (!item?.snippet) return NextResponse.json({ error: 'Video not found on YouTube' }, { status: 404 });
      const snippet = item.snippet;
      const thumbs = snippet.thumbnails;
      const thumbnailUrl = thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || '';
      const newVideo = await Video.create({
        youtubeId,
        title: snippet.title || '',
        description: (snippet.description || '').slice(0, 2000),
        thumbnailUrl,
        publishedAt: new Date(snippet.publishedAt || Date.now()),
        phoneId: null,
        active: false,
        autoLinked: false,
      });
      try { await ActivityLog.create({ adminId: admin._id, action: 'lookup_video', details: `Looked up & created: ${newVideo.title}`, entityType: 'video', entityId: newVideo._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({
        id: newVideo._id?.toString(),
        youtubeId: newVideo.youtubeId,
        title: newVideo.title,
        thumbnailUrl: newVideo.thumbnailUrl,
        publishedAt: newVideo.publishedAt,
        active: newVideo.active,
        autoLinked: false,
        phoneId: null,
        alreadyExisted: false,
      });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to fetch video from YouTube' }, { status: 502 });
    }
  }

  // ---- /api/admin/videos/bulk (BULK ACTIONS) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos' && segments[2] === 'bulk') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { ids, action, phoneId, brandId } = body;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    if (ids.length > 100) return NextResponse.json({ error: 'Max 100 videos per bulk action' }, { status: 400 });
    const validActions = ['delete', 'approve', 'reject', 'feature', 'unfeature', 'hide', 'show', 'activate', 'deactivate'];
    if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (action === 'approve') { update.active = true; update.status = 'live'; update.autoLinked = false; }
    else if (action === 'reject') { update.status = 'rejected'; update.active = false; }
    else if (action === 'feature') { update.featured = true; }
    else if (action === 'unfeature') { update.featured = false; }
    else if (action === 'hide') { update.hidden = true; update.status = 'hidden'; update.active = false; }
    else if (action === 'show') { update.hidden = false; update.active = true; update.status = 'live'; }
    else if (action === 'activate') { update.active = true; update.status = 'live'; update.autoLinked = false; }
    else if (action === 'deactivate') { update.active = false; update.status = 'pending'; }
    if (action === 'delete') {
      const result = await Video.deleteMany({ _id: { $in: ids } });
      try { await ActivityLog.create({ adminId: admin._id, action: 'bulk_delete_videos', details: `Bulk deleted ${result.deletedCount} videos`, entityType: 'video' }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    }
    if (phoneId) update.phoneId = phoneId;
    if (brandId) update.brandId = brandId;
    const result = await Video.updateMany({ _id: { $in: ids } }, { $set: update });
    try { await ActivityLog.create({ adminId: admin._id, action: `bulk_${action}_videos`, details: `Bulk ${action}: ${result.modifiedCount} videos`, entityType: 'video' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  }

  // ---- /api/admin/news/bulk (BULK ACTIONS) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news' && segments[2] === 'bulk') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:delete'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { ids, action } = body;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (action === 'publish') { update.published = true; update.status = 'published'; }
    else if (action === 'draft') { update.published = false; }
    else if (action === 'feature') { update.featured = true; }
    else if (action === 'archive') { update.status = 'archived'; update.published = false; }
    else if (action === 'delete') {
      const result = await News.deleteMany({ _id: { $in: ids } });
      try { await ActivityLog.create({ adminId: admin._id, action: 'bulk_delete_news', details: `Bulk deleted ${result.deletedCount} articles`, entityType: 'news' }); } catch (e) { console.error('[ActivityLog]', e); }
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    } else { return NextResponse.json({ error: 'Invalid action' }, { status: 400 }); }
    const result = await News.updateMany({ _id: { $in: ids } }, { $set: update });
    try { await ActivityLog.create({ adminId: admin._id, action: `bulk_${action}_news`, details: `Bulk ${action}: ${result.modifiedCount} articles`, entityType: 'news' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  }

  return undefined;
}

// ============ ADMIN CRUD PUT ============

export async function handleAdminCrudPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/phones/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    await connectDB();
    let phone;
    try { phone = await Phone.findById(segments[2]); } catch (e: unknown) { return NextResponse.json({ error: 'Failed to find phone' }, { status: 500 }); }
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let body: PhoneUpdateBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    // Store original price for price history comparison
    const _previousPricePKR = phone.pricePKR;

    const { brandId, modelName, slug: inputSlug, pricePKR, originalPricePKR, ptaStatus, ptaApproved, releaseDate,
      thumbnail, description, featured, trending, upcoming, status: phoneStatus, active,
      cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
      pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
      specs, benchmarks, images, prices, priceMode, manualLock, manualLockReason, sourceUrl } = body;

    // ---- Top-level try-catch: prevent any uncaught error from bubbling up as generic 500 ----
    try {

    // Update phone fields
    if (modelName) phone.modelName = modelName;
    if (inputSlug !== undefined && inputSlug !== phone.slug) {
      try {
        const existing = await Phone.findOne({ slug: inputSlug, _id: { $ne: phone._id } }).lean();
        if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      } catch (e: unknown) {
        console.error('[SavePhone SlugCheck] Failed:', e instanceof Error ? e.message : e);
        return NextResponse.json({ error: 'Slug uniqueness check failed' }, { status: 500 });
      }
      phone.slug = inputSlug;
    }
    // Brand ID — handle both string ID and potential object
    if (brandId) {
      const bid = typeof brandId === 'string' ? brandId : brandId?.id || brandId?._id?.toString();
      if (bid) {
        try {
          const b = await Brand.findById(bid);
          if (b) phone.brandId = new mongoose.Types.ObjectId(bid);
        } catch { /* ignore brand lookup failure */ }
      }
    }
    if (pricePKR !== undefined) phone.pricePKR = Number(pricePKR) || 0;
    if (originalPricePKR !== undefined) phone.originalPricePKR = Number(originalPricePKR) || 0;
    if (ptaStatus !== undefined) phone.ptaStatus = ptaStatus;
    if (ptaApproved !== undefined) phone.ptaApproved = Boolean(ptaApproved);
    if (releaseDate !== undefined) phone.releaseDate = releaseDate;
    if (thumbnail !== undefined) phone.thumbnail = thumbnail;
    if (description !== undefined) phone.description = description;
    if (featured !== undefined) phone.featured = Boolean(featured);
    if (trending !== undefined) phone.trending = Boolean(trending);
    if (upcoming !== undefined) phone.upcoming = Boolean(upcoming);
    if (phoneStatus !== undefined) {
      const validStatuses = ['published', 'draft', 'pending', 'archived'];
      if (!validStatuses.includes(phoneStatus)) return NextResponse.json({ error: `Invalid status: "${phoneStatus}". Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      const pubCheck = requirePermission(admin, 'phones:publish'); if (pubCheck) return pubCheck;
      phone.status = phoneStatus;
    }
    if (active !== undefined) {
      if (active === false) { const delCheck = requirePermission(admin, 'phones:delete'); if (delCheck) return delCheck; }
      phone.active = Boolean(active);
    }
    if (cameraScore !== undefined) phone.cameraScore = Number(cameraScore) || 0;
    if (performanceScore !== undefined) phone.performanceScore = Number(performanceScore) || 0;
    if (batteryScore !== undefined) phone.batteryScore = Number(batteryScore) || 0;
    if (displayScore !== undefined) phone.displayScore = Number(displayScore) || 0;
    if (valueScore !== undefined) phone.valueScore = Number(valueScore) || 0;
    if (overallRating !== undefined) phone.overallRating = Number(overallRating) || 0;
    if (pros !== undefined) phone.pros = pros;
    if (cons !== undefined) phone.cons = cons;
    if (reviewSummary !== undefined) phone.reviewSummary = reviewSummary;
    if (reviewVerdict !== undefined) phone.reviewVerdict = reviewVerdict;
    if (seoTitle !== undefined) phone.seoTitle = seoTitle;
    if (seoDescription !== undefined) phone.seoDescription = seoDescription;
    if (keywords !== undefined) phone.keywords = keywords;
    // priceMode, manualLock, manualLockReason, sourceUrl, sourceName are all proper schema fields
    if (priceMode !== undefined && ['manual', 'automatic'].includes(priceMode)) phone.priceMode = priceMode as 'manual' | 'automatic';
    if (manualLock !== undefined) phone.manualLock = Boolean(manualLock);
    if (manualLockReason !== undefined) phone.manualLockReason = String(manualLockReason).slice(0, 500);
    if (sourceUrl !== undefined) { phone.sourceUrl = String(sourceUrl); phone.sourceName = 'Manual Entry'; }

    // Save phone — with clear error on failure
    try {
      await phone.save();
    } catch (e: unknown) {
      console.error('[SavePhone] phone.save() failed:', e instanceof Error ? e.message : e);
      const msg = e instanceof Error ? e.message : '';
      // Extract useful info from Mongoose validation errors
      if (msg.includes('ValidationError')) {
        const fieldMatch = msg.match(/Path `(\w+)`/);
        const field = fieldMatch ? fieldMatch[1] : 'unknown';
        return NextResponse.json({ error: `Validation failed on field "${field}": ${msg.split(':').pop()?.trim() || msg}` }, { status: 400 });
      }
      if (msg.includes('duplicate key') || msg.includes('E11000')) {
        return NextResponse.json({ error: 'Duplicate key conflict. A phone with this slug may already exist.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to save phone' }, { status: 500 });
    }

    // Save specs (independent of phone save)
    try {
      if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
        // Strip ALL non-schema fields to prevent StrictModeError / CastError
        const { _id, __v, phoneId, id, createdAt, updatedAt, _count, ...rest } = specs as Record<string, unknown>;
        // Further strip any non-schema keys — PhoneSpecs only has known string/number fields
        const allowedSpecKeys = new Set([
          'display','displayType','resolution','refreshRate','protection','brightness',
          'chipset','cpu','gpu','process','ram','ramType','storage','cardSlot',
          'mainCamera','mainCameraSensor','aperture','ois','eis','ultrawide','telephoto','zoom','cameraFeatures','videoRecording',
          'selfieCamera','selfieSensor','selfieVideo',
          'battery','charging','chargingSpeed','wirelessCharge','wirelessSpeed','reverseCharge',
          'weight','dimensions','build','sim','ipRating','network','fiveG','wifi','bluetooth','nfc','usb','infrared',
          'fingerprint','faceUnlock','sensors','colors',
          'os','osVersion','osUI','updatePolicy','specialFeatures',
          'ramGB','storageGB','screenSizeInch','mainCameraMP','batteryMAh',
        ]);
        const safeSpecs: Record<string, string | number | null> = {};
        for (const [key, val] of Object.entries(rest)) {
          if (!allowedSpecKeys.has(key)) continue;
          // Coerce numeric fields
          if (['ramGB','storageGB','screenSizeInch','mainCameraMP','batteryMAh'].includes(key)) {
            safeSpecs[key] = val !== null && val !== undefined && val !== '' ? Number(val) || null : null;
          } else {
            // String fields — ensure string type
            safeSpecs[key] = val !== null && val !== undefined ? String(val) : '';
          }
        }
        await PhoneSpecs.findOneAndUpdate(
          { phoneId: phone._id },
          { $set: safeSpecs },
          { upsert: true, new: true, strict: false }
        );
      }
    } catch (e: unknown) {
      console.error('[SavePhone Specs] Failed:', e instanceof Error ? e.message : e, e instanceof Error ? e.stack : '');
      // Don't fail the entire save — specs failure is non-critical
    }
    // Save benchmarks
    try {
      if (benchmarks && typeof benchmarks === 'object') {
        const { _id, __v, phoneId, id, createdAt, updatedAt, ...rest } = benchmarks as Record<string, unknown>;
        const allowedBenchKeys = new Set([
          'antutu','geekbenchSingle','geekbenchMulti','gamingScore',
          'pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery',
        ]);
        // String-type fields in the benchmark schema
        const benchStringKeys = new Set(['pubgFps','codMobileFps','genshinFps','videoPlayback','gamingBattery','browsingBattery']);
        const safeBench: Record<string, string | number> = {};
        for (const [key, val] of Object.entries(rest)) {
          if (!allowedBenchKeys.has(key)) continue;
          if (benchStringKeys.has(key)) {
            // String fields — preserve string values, don't coerce to number
            safeBench[key] = val !== null && val !== undefined ? String(val) : '';
          } else {
            // Numeric fields
            safeBench[key] = typeof val === 'number' ? val : (Number(val) || 0);
          }
        }
        if (Object.keys(safeBench).length > 0) {
          await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set: safeBench }, { upsert: true, new: true, strict: false });
        }
      }
    } catch (e: unknown) { console.error('[SavePhone Benchmarks] Failed:', e instanceof Error ? e.message : e); }
    // Save images
    try {
      if (images !== undefined) {
        await PhoneImage.deleteMany({ phoneId: phone._id });
        if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: ImageInput, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
      }
    } catch (e: unknown) { console.error('[SavePhone Images]', e instanceof Error ? e.message : e); }
    // Save prices
    try {
      if (prices !== undefined) {
        await PhonePrice.deleteMany({ phoneId: phone._id });
        if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: PriceInput) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
        if (Array.isArray(prices) && prices.length > 0) { try { await PriceHistory.insertMany(prices.filter((pr: PriceInput) => pr.price && pr.price > 0).map((pr: PriceInput) => ({ phoneId: phone._id, storeName: pr.storeName || null, price: pr.price }))); } catch (e) { console.error('[PriceHistory]', e); } }
      }
    } catch (e: unknown) { console.error('[SavePhone Prices]', e instanceof Error ? e.message : e); }
    // Record base price history only if price actually changed
    const newPricePKR = Number(pricePKR) || 0;
    if (pricePKR !== undefined && newPricePKR > 0 && newPricePKR !== _previousPricePKR) {
      try { await PriceHistory.create({ phoneId: phone._id, storeName: null, price: newPricePKR }); } catch (e) { console.error('[PriceHistory]', e); }
    }
    // Targeted cache revalidation when price changes
    try {
      if (pricePKR !== undefined) revalidatePricePages(phone.slug);
    } catch (e: unknown) {
      console.error('[SavePhone revalidatePricePages]', e instanceof Error ? e.message : e);
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_phone', details: `Updated: ${phone.modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: phone._id?.toString() });

    } catch (e: unknown) {
      // Catch-all for any uncaught error in the phone update flow
      console.error('[SavePhone] Uncaught error during phone update:', e instanceof Error ? e.message : e, e instanceof Error ? e.stack : '');
      return NextResponse.json({ error: 'Failed to update phone', details: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
    }
  }

  // ---- /api/admin/brands/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:edit'); if (permCheck) return permCheck;
    const brand = await Brand.findById(segments[2]);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.name) brand.name = body.name;
    if (body.logo !== undefined) brand.logo = body.logo;
    if (body.country !== undefined) brand.country = body.country;
    if (body.description !== undefined) brand.description = body.description;
    if (body.sortOrder !== undefined) brand.sortOrder = body.sortOrder;
    if (body.active === false) {
      const delCheck = requirePermission(admin, 'brands:delete'); if (delCheck) return delCheck;
      brand.active = false;
    } else if (body.active !== undefined) {
      brand.active = body.active;
    }
    await brand.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_brand', details: `Updated: ${brand.name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: brand._id?.toString() });
  }

  // ---- /api/admin/news/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:edit'); if (permCheck) return permCheck;
    const news = await News.findById(segments[2]);
    if (!news) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.title) news.title = body.title;
    if (body.slug !== undefined && body.slug !== news.slug) {
      const existing = await News.findOne({ slug: body.slug, _id: { $ne: news._id } }).lean();
      if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      news.slug = body.slug;
    }
    if (body.content !== undefined) news.content = body.content;
    if (body.excerpt !== undefined) news.excerpt = body.excerpt;
    if (body.category) news.category = body.category;
    if (body.image !== undefined) news.image = body.image;
    if (body.author !== undefined) news.author = body.author;
    if (body.published !== undefined) {
      const pubCheck = requirePermission(admin, 'news:publish'); if (pubCheck) return pubCheck;
      news.published = body.published;
    }
    if (body.featured !== undefined) news.featured = body.featured;
    if (body.status !== undefined) {
      const validStatuses = ['published', 'draft', 'scheduled', 'archived', 'pending'];
      if (!validStatuses.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      news.status = body.status;
    }
    await news.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_news', details: `Updated: ${news.title}`, entityType: 'news', entityId: news._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: news._id?.toString() });
  }

  // ---- /api/admin/phones/:id/toggle-featured ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'phones' && segments[3] === 'toggle-featured') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    phone.featured = !phone.featured; await phone.save();
    return NextResponse.json({ success: true, featured: phone.featured });
  }

  // ---- /api/admin/phones/:id/toggle-trending ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'phones' && segments[3] === 'toggle-trending') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    phone.trending = !phone.trending; await phone.save();
    return NextResponse.json({ success: true, trending: phone.trending });
  }

  // ---- /api/admin/sponsors/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'sponsors') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'sponsors:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { name, image, url, position, active, startDate, endDate } = body;
    const { Sponsor } = await import('@/lib/models/Other');
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    if (url !== undefined) updateData.url = url;
    if (position !== undefined) updateData.position = position;
    if (active !== undefined) updateData.active = active;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    const updated = await Sponsor.findByIdAndUpdate(segments[2], { $set: updateData }, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, sponsor: { ...updated, id: updated._id?.toString() } });
  }

  // ---- /api/admin/videos/:id (UPDATE — enhanced) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:edit'); if (permCheck) return permCheck;
    const video = await Video.findById(segments[2]);
    if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.phoneId !== undefined) video.phoneId = body.phoneId || null;
    if (body.brandId !== undefined) video.brandId = body.brandId || null;
    if (body.active !== undefined) video.active = body.active;
    if (body.autoLinked !== undefined) video.autoLinked = body.autoLinked;
    if (body.title !== undefined) video.title = body.title;
    if (body.status !== undefined) video.status = body.status;
    if (body.featured !== undefined) video.featured = body.featured;
    if (body.hidden !== undefined) video.hidden = body.hidden;
    if (body.syncStatus !== undefined) video.syncStatus = body.syncStatus;
    if (body.category !== undefined) video.category = body.category;
    if (body.duration !== undefined) video.duration = body.duration;
    if (body.channelName !== undefined) video.channelName = body.channelName;
    // Auto-sync status and active based on status changes
    if (body.status === 'live') { video.active = true; video.hidden = false; }
    if (body.status === 'hidden') { video.hidden = true; video.active = false; }
    if (body.status === 'pending') { video.active = false; }
    await video.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_video', details: `Updated: ${video.title}`, entityType: 'video', entityId: video._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: video._id?.toString() });
  }

  // ---- /api/admin/users/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    await connectDB();
    const targetId = segments[2];
    const targetUser = await Admin.findById(targetId);
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Cannot modify own role or delete self
    if (targetId === admin._id.toString()) {
      // Allow limited self-edit: name, phone
      const body = await req.json();
      const allowed: string[] = [];
      for (const key of allowed) {
        if (body[key] !== undefined) (targetUser as Record<string, unknown>)[key] = body[key];
      }
      if (body.name !== undefined) targetUser.name = (body.name as string).trim();
      if (body.phone !== undefined) targetUser.phone = (body.phone as string).trim();
      await targetUser.save();
      return NextResponse.json({ success: true, id: targetUser._id?.toString() });
    }
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    let logDetails = '';
    // Update name
    if (body.name !== undefined) { updates.name = (body.name as string).trim(); logDetails += `name="${body.name}" `; }
    // Update phone
    if (body.phone !== undefined) { updates.phone = (body.phone as string).trim(); logDetails += `phone="${body.phone}" `; }
    // Update role
    if (body.role !== undefined) {
      const validRoles = ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];
      if (!validRoles.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      if (body.role === 'superadmin' && admin.role !== 'superadmin') return NextResponse.json({ error: 'Only superadmins can assign superadmin role' }, { status: 403 });
      updates.role = body.role;
      logDetails += `role=${body.role} `;
    }
    // Update active status
    if (body.active !== undefined) { updates.active = body.active; logDetails += `active=${body.active} `; }
    // Update suspended status
    if (body.suspended !== undefined) {
      updates.suspended = body.suspended;
      if (body.suspended) { updates.active = false; updates.suspendedReason = body.suspendedReason || 'Suspended by admin'; if (body.suspendedUntil) updates.suspendedUntil = new Date(body.suspendedUntil); }
      else { updates.suspendedReason = ''; updates.suspendedUntil = undefined; }
      logDetails += `suspended=${body.suspended} `;
    }
    // Force password reset
    if (body.requirePasswordChange !== undefined) {
      updates.requirePasswordChange = body.requirePasswordChange;
      if (body.requirePasswordChange) { updates.$inc = { sessionVersion: 1 }; }
      logDetails += `requirePasswordChange=${body.requirePasswordChange} `;
    }
    // 2FA toggle
    if (body.twoFactorEnabled !== undefined) {
      updates.twoFactorEnabled = body.twoFactorEnabled;
      if (!body.twoFactorEnabled) { updates.twoFactorSecret = ''; updates.twoFactorRecoveryCodes = []; }
      logDetails += `2FA=${body.twoFactorEnabled} `;
    }
    // Custom permissions
    if (body.customPermissions !== undefined) {
      if (!Array.isArray(body.customPermissions)) return NextResponse.json({ error: 'customPermissions must be an array' }, { status: 400 });
      updates.customPermissions = body.customPermissions;
      logDetails += `customPermissions=[${body.customPermissions.length} perms] `;
    }
    // Reset failed attempts
    if (body.resetFailedAttempts) {
      updates.failedAttempts = 0;
      updates.lockedUntil = undefined;
      logDetails += 'resetFailedAttempts ';
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    const result = await Admin.findByIdAndUpdate(targetId, { $set: updates, ...(updates.$inc ? { $inc: updates.$inc } : {}) }, { new: true }).select('-password -resetTokenHash -resetTokenExpires -twoFactorSecret -twoFactorRecoveryCodes -invitationTokenHash -invitationExpires');
    // If suspending or forcing password reset, revoke all sessions
    if (body.suspended || body.requirePasswordChange) {
      try { await revokeAllSessions(targetId); } catch {}
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_user', details: `Updated user ${targetUser.email}: ${logDetails}`, entityType: 'admin', entityId: targetId }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: targetId });
  }

  // ---- /api/admin/settings ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'settings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'settings:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { Settings } = await import('@/lib/models');
    const allowed = ['siteName','tagline','contactEmail','supportEmail','logo','favicon','facebook','twitter','instagram','youtubeChannel','titleSuffix','metaDescription','ogImage','googleAnalyticsId','maintenanceMode','footerText'];
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    const settings = await Settings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true }).lean();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_settings', details: 'Updated site settings', entityType: 'settings', entityId: 'main' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ settings: { id: settings!._id?.toString(), ...settings, _id: undefined } });
  }

  return undefined;
}

// ============ ADMIN CRUD DELETE ============

export async function handleAdminCrudDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/videos/:id (DELETE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'videos') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'videos:manage'); if (permCheck) return permCheck;
    await connectDB();
    const video = await Video.findById(segments[2]);
    if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const title = video.title;
    await Video.deleteOne({ _id: segments[2] });
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_video', details: `Deleted: ${title}`, entityType: 'video', entityId: segments[2] }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/reviews/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reviews') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:delete'); if (permCheck) return permCheck;
    await connectDB();
    const review = await UserReview.findById(segments[2]);
    if (review) {
      try { await ActivityLog.create({ adminId: admin._id, action: 'delete_review', details: `Deleted review by ${review.name}`, entityType: 'review', entityId: segments[2] }); } catch (e) { console.error('[ActivityLog]', e); }
    }
    await UserReview.findByIdAndDelete(segments[2]);
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/phones/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const phone = await Phone.findById(id);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const name = phone.modelName;
    await Promise.all([
      Phone.deleteOne({ _id: id }),
      PhoneSpecs.deleteMany({ phoneId: id }),
      PhoneBenchmark.deleteMany({ phoneId: id }),
      PhoneImage.deleteMany({ phoneId: id }),
      PhonePrice.deleteMany({ phoneId: id }),
      PriceHistory.deleteMany({ phoneId: id }),
      UserReview.deleteMany({ phoneId: id }),
      PriceAlert.deleteMany({ phoneId: id }),
      PhoneRetailListing.deleteMany({ phoneId: id }),
      PriceTrackerHistory.deleteMany({ phoneId: id }),
    ]);
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_phone', details: `Deleted: ${name}`, entityType: 'phone', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/brands/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const brand = await Brand.findById(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const phoneCount = await Phone.countDocuments({ brandId: id });
    if (phoneCount > 0) return NextResponse.json({ error: `Cannot delete: ${phoneCount} phones use this brand` }, { status: 400 });
    const name = brand.name;
    await Brand.deleteOne({ _id: id });
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_brand', details: `Deleted: ${name}`, entityType: 'brand', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/news/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const news = await News.findById(id);
    if (!news) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const title = news.title;
    await News.deleteOne({ _id: id });
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_news', details: `Deleted: ${title}`, entityType: 'news', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/sponsors/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'sponsors') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'sponsors:manage'); if (permCheck) return permCheck;
    const { Sponsor } = await import('@/lib/models/Other');
    await Sponsor.findByIdAndDelete(segments[2]);
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/users/:id (DELETE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    await connectDB();
    const targetId = segments[2];
    // Cannot delete self
    if (targetId === admin._id.toString()) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }
    const targetUser = await Admin.findById(targetId);
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Delete protection: last superadmin
    if (targetUser.role === 'superadmin') {
      const superCount = await Admin.countDocuments({ role: 'superadmin' });
      if (superCount <= 1) return NextResponse.json({ error: 'Cannot delete the last superadmin' }, { status: 400 });
    }
    // Revoke all sessions for this user
    try { await revokeAllSessions(targetId); } catch {}
    await Admin.findByIdAndDelete(targetId);
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_user', details: `Deleted user: ${targetUser.email}`, entityType: 'admin', entityId: targetId }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/reviews/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reviews' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, pending, approved, rejected, flagged, spam, todayReviews] = await Promise.all([
      UserReview.estimatedDocumentCount(),
      UserReview.countDocuments({ status: 'pending' }),
      UserReview.countDocuments({ status: 'approved' }),
      UserReview.countDocuments({ status: 'rejected' }),
      UserReview.countDocuments({ status: 'flagged' }),
      UserReview.countDocuments({ spamFlags: { $exists: true, $ne: [] } }),
      UserReview.countDocuments({ createdAt: { $gte: todayStart } }),
    ]);
    const avgRating = await UserReview.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
    return NextResponse.json({ total, pending, approved, rejected, flagged, spam, todayReviews, avgRating: avgRating[0]?.avg ? Number(avgRating[0].avg.toFixed(1)) : 0 });
  }

  // ---- /api/admin/reviews (ENHANCED LIST) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'reviews') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const filter: Record<string, unknown> = {};
    const status = url.searchParams.get('status') || 'all';
    if (status !== 'all') filter.status = status;
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = escapeRegex(search);
      filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { comment: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
    }
    const rating = url.searchParams.get('rating');
    if (rating) { const r = parseInt(rating); if (r >= 1 && r <= 5) filter.rating = r; }
    const sortParam = url.searchParams.get('sort');
    let sort: MongooseSort = { createdAt: -1 };
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'highest') sort = { rating: -1 };
    else if (sortParam === 'lowest') sort = { rating: 1 };
    const [reviews, total] = await Promise.all([
      UserReview.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      UserReview.countDocuments(filter),
    ]);
    const phoneIds = [...new Set(reviews.map((r: { phoneId: { toString(): string } }) => r.phoneId.toString()))];
    const phones = await Phone.find({ _id: { $in: phoneIds } }).select('modelName slug thumbnail brand').populate('brand', 'name').lean();
    const phoneMap = Object.fromEntries(phones.map((p: { _id: { toString(): string }; modelName?: string; slug?: string; thumbnail?: string; brand?: { name?: string } }) => [p._id.toString(), { modelName: p.modelName, slug: p.slug, thumbnail: p.thumbnail, brand: p.brand?.name || '' }]));
    return NextResponse.json({
      reviews: reviews.map((r: Record<string, unknown> & { _id?: { toString(): string }; phoneId?: { toString(): string } }) => ({ ...r, id: r._id?.toString(), phone: phoneMap[r.phoneId?.toString() ?? ''], email: undefined })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/reviews/:id (UPDATE status — enhanced) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reviews') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const review = await UserReview.findById(segments[2]);
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const validStatuses = ['approved', 'rejected', 'flagged', 'pending', 'spam'];
    if (body.status && validStatuses.includes(body.status)) {
      review.status = body.status;
      try { await ActivityLog.create({ adminId: admin._id, action: `${body.status}_review`, details: `${body.status}: ${review.name} for ${review.phoneId}`, entityType: 'review', entityId: segments[2] }); } catch (e) { console.error('[ActivityLog]', e); }
    }
    if (body.featured !== undefined) review.featured = body.featured;
    await review.save();
    return NextResponse.json({ success: true });
  }

  return undefined;
}