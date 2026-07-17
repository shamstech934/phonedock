import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, News, Admin, ActivityLog, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice, PriceHistory, UserReview, Video } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission, phoneToJSON, hashPassword, isStrongPassword, MAX_UPLOAD_RECORDS } from './helpers';
import { syncYouTubeVideos } from '@/lib/video-sync';

// ============ ADMIN CRUD GET ============

export async function handleAdminCrudGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/stats ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'dashboard:read'); if (permCheck) return permCheck;
    await connectDB();
    const [totalPhones, totalBrands, trendingCount, featuredCount, newsCount, recentActivity] = await Promise.all([
      Phone.countDocuments({ active: true }),
      Brand.countDocuments({ active: true }),
      Phone.countDocuments({ active: true, trending: true }),
      Phone.countDocuments({ active: true, featured: true }),
      News.countDocuments({ published: true }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(20).populate('adminId', 'name email').lean(),
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
      totalPhones, totalBrands, trendingCount, featuredCount, newsCount,
      avgPrice: priceResult[0]?.avg || 0,
      priceDistribution: priceDistribution.map((d: any, i: number) => ({ range: distLabels[i] || d._id, count: d.count })),
      recentActivity: recentActivity.map((l: any) => ({
        ...l,
        id: l._id?.toString(),
        admin: l.adminId ? { name: l.adminId.name, email: l.adminId.email } : undefined,
      })),
    });
  }

  // ---- /api/admin/phones ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const phones = await Phone.find({ active: true }).sort({ createdAt: -1 }).populate('brand').lean();
    return NextResponse.json({ phones: phones.map((p: any) => phoneToJSON(p)) });
  }

  // ---- /api/admin/phones/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const phone = await Phone.findById(segments[2]).populate('brand');
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [specs, benchmarks, images, prices] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).lean(),
    ]);
    return NextResponse.json(phoneToJSON(phone, specs, benchmarks, images, prices));
  }

  // ---- /api/admin/brands ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:read'); if (permCheck) return permCheck;
    await connectDB();
    const brands = await Brand.find().sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ brands: brands.map((b: any) => ({ ...b, id: b._id?.toString() })) });
  }

  // ---- /api/admin/news/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, published, draft, scheduled, pending, featured, todayPublished, totalViews] = await Promise.all([
      News.countDocuments({}),
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
    const filter: any = {};
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    let sort: any = { createdAt: -1 };
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'views') sort = { views: -1 };
    else if (sortParam === 'alpha') sort = { title: 1 };
    else if (sortParam === 'updated') sort = { updatedAt: -1 };
    const [news, total] = await Promise.all([
      News.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      News.countDocuments(filter),
    ]);
    return NextResponse.json({
      news: news.map((n: any) => ({ ...n, id: n._id?.toString() })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/users ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const users = await Admin.find().select('-password -resetTokenHash -resetTokenExpires').sort({ createdAt: -1 }).lean();
    return NextResponse.json({ users: users.map((u: any) => ({ ...u, id: u._id?.toString() })) });
  }

  // ---- /api/admin/sponsors ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'sponsors') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'sponsors:read'); if (permCheck) return permCheck;
    await connectDB();
    const { Sponsor } = await import('@/lib/models/Other');
    const sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ sponsors: sponsors.map((s: any) => ({ ...s, id: s._id?.toString() })) });
  }

  // ---- /api/admin/activity (ENHANCED LIST) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'activity') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'activity:read'); if (permCheck) return permCheck;
    await connectDB();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const filter: any = {};
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ action: { $regex: safe, $options: 'i' } }, { details: { $regex: safe, $options: 'i' } }];
    }
    const module = url.searchParams.get('module');
    if (module) filter.entityType = module;
    const actionType = url.searchParams.get('action');
    if (actionType) filter.action = { $regex: actionType, $options: 'i' };
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('adminId', 'name email role').lean(),
      ActivityLog.countDocuments(filter),
    ]);
    return NextResponse.json({
      logs: logs.map((l: any) => ({
        ...l, id: l._id?.toString(),
        admin: l.adminId ? { name: l.adminId.name, email: l.adminId.email, role: l.adminId.role } : undefined,
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
      ActivityLog.countDocuments({}),
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
      Video.countDocuments({}),
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
      lastSyncTime: (lastSync as any)?.lastSyncedAt || null,
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
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const videos = await Video.find({ title: { $regex: safe, $options: 'i' } }).sort({ publishedAt: -1 }).limit(10).populate('phoneId', 'modelName slug').lean();
    return NextResponse.json({ videos: videos.map((v: any) => ({
      id: v._id?.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt,
      active: v.active,
      autoLinked: v.autoLinked,
      phoneId: v.phoneId?._id?.toString() || null,
      phoneName: v.phoneId?.modelName || null,
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
    const filter: any = {};
    // Search
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { youtubeId: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { channelName: { $regex: safe, $options: 'i' } },
      ];
      // Also search by phone model/brand
      const phoneMatches = await Phone.find({ $or: [{ modelName: { $regex: safe, $options: 'i' } }, { slug: { $regex: safe, $options: 'i' } }] }).select('_id').lean();
      if (phoneMatches.length > 0) filter.$or.push({ phoneId: { $in: phoneMatches.map(p => p._id) } });
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
        filter.createdAt = {} as any;
        if (from) (filter.createdAt as any).$gte = new Date(from);
        if (to) (filter.createdAt as any).$lte = new Date(to);
      }
    }
    // Sort
    let sort: any = { publishedAt: -1 };
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
      videos: videos.map((v: any) => ({
        id: v._id?.toString(),
        youtubeId: v.youtubeId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        phoneId: v.phoneId?._id?.toString() || null,
        phone: v.phoneId ? { modelName: v.phoneId.modelName, slug: v.phoneId.slug, brand: v.phoneId.brand?.name || '' } : null,
        brand: v.brandId ? { name: v.brandId.name, id: v.brandId._id?.toString() } : null,
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
        createdBy: v.createdBy ? { name: v.createdBy.name } : null,
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
  // ---- /api/admin/users (CREATE — superadmin only) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { email, name, role, password } = body;
    if (!email || !name || !password) return NextResponse.json({ error: 'Email, name, and password required' }, { status: 400 });
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.valid) return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';
    if (assignedRole === 'superadmin' && admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can create superadmin accounts' }, { status: 403 });
    }
    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    const newAdmin = await Admin.create({
      email: email.toLowerCase(), name: (name as string).trim(),
      password: await hashPassword(password),
      role: assignedRole, active: true, sessionVersion: 0,
    });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_user', details: `Created admin: ${email}`, entityType: 'admin', entityId: newAdmin._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: newAdmin._id?.toString() });
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
    const brand = await Brand.findById(brandId);
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 400 });
    const slug = inputSlug || modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Phone.findOne({ slug });
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    const phone = await Phone.create({ brandId, modelName, slug, pricePKR: pricePKR || 0, originalPricePKR: originalPricePKR || 0, ptaStatus: ptaStatus || 'Unknown', ptaApproved: ptaApproved || false, releaseDate: releaseDate || '', thumbnail: thumbnail || '', description: description || '', featured: featured || false, trending: trending || false, upcoming: upcoming || false, status: phoneStatus || 'published', active: true, cameraScore: cameraScore || 0, performanceScore: performanceScore || 0, batteryScore: batteryScore || 0, displayScore: displayScore || 0, valueScore: valueScore || 0, overallRating: overallRating || 0, pros: pros || '', cons: cons || '', reviewSummary: reviewSummary || '', reviewVerdict: reviewVerdict || '', seoTitle: seoTitle || '', seoDescription: seoDescription || '', keywords: keywords || '' });
    if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
    if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
    if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
    if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
    // Record base price history
    if (pricePKR && pricePKR > 0) { try { await PriceHistory.create({ phoneId: phone._id, storeName: null, price: pricePKR }); } catch (e) { console.error('[PriceHistory]', e); } }
    // Record store price history
    if (Array.isArray(prices) && prices.length > 0) { try { await PriceHistory.insertMany(prices.filter((pr: any) => pr.price > 0).map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || null, price: pr.price }))); } catch (e) { console.error('[PriceHistory]', e); } }
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
    if (await Brand.findOne({ slug })) return NextResponse.json({ error: 'Brand slug exists' }, { status: 409 });
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
    if (await News.findOne({ slug })) return NextResponse.json({ error: 'News slug exists' }, { status: 409 });
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
    const brandMap = new Map(brands.map((b: any) => [b.name.toLowerCase(), b._id]));
    const allPhones = await Phone.find().populate('brand').lean();
    const existingSlugs = new Set(allPhones.map((p: any) => p.slug));
    const existingBM = new Set(allPhones.map((p: any) => `${(p.brand as any)?.name || ''}|${p.modelName}`.toLowerCase()));
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
        const pd: any = { brandId: bId, modelName: mName, slug, pricePKR: parseInt(r.pricePKR) || parseInt(r.price) || 0, ptaStatus: r.ptaStatus || 'Unknown', ptaApproved: r.ptaApproved === true, releaseDate: r.releaseDate || '', thumbnail: r.thumbnail || '', description: r.description || '', featured: r.featured === true, trending: r.trending === true, upcoming: r.upcoming === true, status: 'published', active: true, cameraScore: parseInt(r.cameraScore) || 0, performanceScore: parseInt(r.performanceScore) || 0, batteryScore: parseInt(r.batteryScore) || 0, displayScore: parseInt(r.displayScore) || 0, valueScore: parseInt(r.valueScore) || 0, overallRating: parseInt(r.overallRating) || 0, pros: r.pros || '', cons: r.cons || '', reviewSummary: r.reviewSummary || '', reviewVerdict: r.reviewVerdict || '' };
        if (isDup && mode === 'update_existing') { const ex = await Phone.findOne({ slug }); if (ex) { await Phone.updateOne({ _id: ex._id }, { $set: pd }); if (r.specs) { const { _id: _s, __v: _sv, phoneId: _sp, ...safeSpecs } = r.specs as any; await PhoneSpecs.findOneAndUpdate({ phoneId: ex._id }, { $set: safeSpecs }, { upsert: true }); } if (r.benchmarks) { const { _id: _b, __v: _bv, phoneId: _bp, ...safeBench } = r.benchmarks as any; await PhoneBenchmark.findOneAndUpdate({ phoneId: ex._id }, { $set: safeBench }, { upsert: true }); } updated++; continue; } }
        const phone = await Phone.create(pd); existingSlugs.add(slug); existingBM.add(`${bName}|${mName}`.toLowerCase());
        if (r.specs) { const { _id: _s, __v: _sv, phoneId: _sp, ...safeSpecs } = r.specs as any; await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { $set: safeSpecs, phoneId: phone._id }, { upsert: true }); }
        if (r.benchmarks) { const { _id: _b, __v: _bv, phoneId: _bp, ...safeBench } = r.benchmarks as any; await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set: safeBench, phoneId: phone._id }, { upsert: true }); }
        if (Array.isArray(r.images)) await PhoneImage.insertMany(r.images.map((img: any, j: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? j })));
        if (Array.isArray(r.prices)) await PhonePrice.insertMany(r.prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
        imported++;
      } catch (err: any) { failed++; errors.push(`Row ${i+1}: ${err.message}`); }
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
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Failed to fetch video from YouTube' }, { status: 502 });
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
    const update: Record<string, any> = {};
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
    const update: Record<string, any> = {};
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
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const { brandId, modelName, slug: inputSlug, pricePKR, originalPricePKR, ptaStatus, ptaApproved, releaseDate,
      thumbnail, description, featured, trending, upcoming, status: phoneStatus, active,
      cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
      pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
      specs, benchmarks, images, prices } = body;
    if (modelName) phone.modelName = modelName;
    if (inputSlug !== undefined && inputSlug !== phone.slug) {
      const existing = await Phone.findOne({ slug: inputSlug, _id: { $ne: phone._id } });
      if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      phone.slug = inputSlug;
    }
    if (brandId) { const b = await Brand.findById(brandId); if (b) phone.brandId = brandId; }
    if (pricePKR !== undefined) phone.pricePKR = pricePKR;
    if (originalPricePKR !== undefined) phone.originalPricePKR = originalPricePKR;
    if (ptaStatus !== undefined) phone.ptaStatus = ptaStatus;
    if (ptaApproved !== undefined) phone.ptaApproved = ptaApproved;
    if (releaseDate !== undefined) phone.releaseDate = releaseDate;
    if (thumbnail !== undefined) phone.thumbnail = thumbnail;
    if (description !== undefined) phone.description = description;
    if (featured !== undefined) phone.featured = featured;
    if (trending !== undefined) phone.trending = trending;
    if (upcoming !== undefined) phone.upcoming = upcoming;
    if (phoneStatus !== undefined) {
      const pubCheck = requirePermission(admin, 'phones:publish'); if (pubCheck) return pubCheck;
      phone.status = phoneStatus;
    }
    if (active !== undefined && active === false) {
      const delCheck = requirePermission(admin, 'phones:delete'); if (delCheck) return delCheck;
      phone.active = active;
    } else if (active !== undefined) {
      phone.active = active;
    }
    if (cameraScore !== undefined) phone.cameraScore = cameraScore;
    if (performanceScore !== undefined) phone.performanceScore = performanceScore;
    if (batteryScore !== undefined) phone.batteryScore = batteryScore;
    if (displayScore !== undefined) phone.displayScore = displayScore;
    if (valueScore !== undefined) phone.valueScore = valueScore;
    if (overallRating !== undefined) phone.overallRating = overallRating;
    if (pros !== undefined) phone.pros = pros;
    if (cons !== undefined) phone.cons = cons;
    if (reviewSummary !== undefined) phone.reviewSummary = reviewSummary;
    if (reviewVerdict !== undefined) phone.reviewVerdict = reviewVerdict;
    if (seoTitle !== undefined) phone.seoTitle = seoTitle;
    if (seoDescription !== undefined) phone.seoDescription = seoDescription;
    if (keywords !== undefined) phone.keywords = keywords;
    await phone.save();
    if (specs && typeof specs === 'object') { const { _id: _s, __v: _sv, phoneId: _sp, ...safeSpecs } = specs as any; await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { $set: safeSpecs, phoneId: phone._id }, { upsert: true }); }
    if (benchmarks && typeof benchmarks === 'object') { const { _id: _b, __v: _bv, phoneId: _bp, ...safeBench } = benchmarks as any; await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { $set: safeBench, phoneId: phone._id }, { upsert: true }); }
    if (images !== undefined) {
      await PhoneImage.deleteMany({ phoneId: phone._id });
      if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
    }
    if (prices !== undefined) {
      await PhonePrice.deleteMany({ phoneId: phone._id });
      if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
      // Record store price history for changed prices
      if (Array.isArray(prices) && prices.length > 0) { try { await PriceHistory.insertMany(prices.filter((pr: any) => pr.price > 0).map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || null, price: pr.price }))); } catch (e) { console.error('[PriceHistory]', e); } }
    }
    // Record base price history if changed
    if (pricePKR !== undefined && pricePKR > 0 && pricePKR !== (phone as any)._previousPricePKR) { try { await PriceHistory.create({ phoneId: phone._id, storeName: null, price: pricePKR }); } catch (e) { console.error('[PriceHistory]', e); } }
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_phone', details: `Updated: ${phone.modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: phone._id?.toString() });
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
      const existing = await News.findOne({ slug: body.slug, _id: { $ne: news._id } });
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
    if (body.status !== undefined) news.status = body.status;
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
    const updateData: Record<string, any> = {};
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

  // ---- /api/admin/settings ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'settings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'settings:manage'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { Settings } = await import('@/lib/models');
    const allowed = ['siteName','tagline','contactEmail','supportEmail','logo','favicon','facebook','twitter','instagram','youtubeChannel','titleSuffix','metaDescription','ogImage','googleAnalyticsId','maintenanceMode','footerText'];
    const update: Record<string, any> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    const settings = await Settings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true }).lean();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_settings', details: 'Updated site settings', entityType: 'settings' }); } catch (e) { console.error('[ActivityLog]', e); }
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

  // ---- /api/admin/reviews/stats ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reviews' && segments[2] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [total, pending, approved, rejected, flagged, spam, todayReviews] = await Promise.all([
      UserReview.countDocuments({}),
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
    const filter: any = {};
    const status = url.searchParams.get('status') || 'all';
    if (status !== 'all') filter.status = status;
    const search = (url.searchParams.get('search') || '').trim();
    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { comment: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
    }
    const rating = url.searchParams.get('rating');
    if (rating) { const r = parseInt(rating); if (r >= 1 && r <= 5) filter.rating = r; }
    const sortParam = url.searchParams.get('sort');
    let sort: any = { createdAt: -1 };
    if (sortParam === 'oldest') sort = { createdAt: 1 };
    else if (sortParam === 'highest') sort = { rating: -1 };
    else if (sortParam === 'lowest') sort = { rating: 1 };
    const [reviews, total] = await Promise.all([
      UserReview.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      UserReview.countDocuments(filter),
    ]);
    const phoneIds = [...new Set(reviews.map((r: any) => r.phoneId.toString()))];
    const phones = await Phone.find({ _id: { $in: phoneIds } }).select('modelName slug thumbnail brand').populate('brand', 'name').lean();
    const phoneMap = Object.fromEntries(phones.map((p: any) => [p._id.toString(), { modelName: p.modelName, slug: p.slug, thumbnail: p.thumbnail, brand: p.brand?.name || '' }]));
    return NextResponse.json({
      reviews: reviews.map((r: any) => ({ ...r, id: r._id?.toString(), phone: phoneMap[r.phoneId?.toString()], email: undefined })),
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