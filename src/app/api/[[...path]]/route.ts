import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { createProvider } from '@/lib/collectors';
import { Phone, Brand, News, Sponsor, Admin, ActivityLog, RateLimit, CollectorSource, CollectedPhone, CollectorJob, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice } from '@/lib/models';
import { connectDB, connectDBSafe } from '@/lib/mongodb';
import mongoose from 'mongoose';
import { verifyPassword, hashPassword, verifyToken, createSignedSession, getSessionFromRequest, validateSessionVersion, checkLoginRateLimitFromDB, recordFailedLoginDB, resetFailedAttempts, isStrongPassword, sanitizeInput, checkIpRateLimit, hashResetToken, verifyResetToken, sanitizeCsvValue, getCookieOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { validateCollectedPhone, detectDuplicates, detectConflicts, suggestCategory, suggestSEO, buildFieldProvenance } from '@/lib/collectors/services';

// ============ CONSTANTS ============

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_UPLOAD_RECORDS = 5000;
const ALLOWED_EXTENSIONS = ['json', 'csv', 'xlsx', 'xls'];
const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

// ============ IP HELPER ============

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// ============ AUTH HELPERS ============

async function getAdminFromRequest(req: NextRequest): Promise<{ admin?: any; error?: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  await connectDB();
  // Fail-closed session version check
  const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
  if (!versionCheck.valid) {
    const response = NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
    return { error: response };
  }
  const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
  if (!admin || !admin.active) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { admin };
}

/** Check if email is configured — used to gate forgot-password */
function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function requirePermission(admin: any, permission: string): NextResponse | null {
  if (!hasPermission(admin.role as any, permission as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
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
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
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
      const [featured, trending, brands] = await Promise.all([
        Phone.find({ active: true, status: 'published', featured: true }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
        Phone.find({ active: true, status: 'published', trending: true }).sort({ createdAt: -1 }).limit(8).populate('brand').lean(),
        Brand.find({ active: true }).sort({ sortOrder: 1 }).lean(),
      ]);
      return NextResponse.json({ featured, trending, brands });
    }

    // ---- /api/phones ----
    if (segments.length === 1 && segments[0] === 'phones') {
      await connectDB();
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
      const search = url.searchParams.get('search') || '';
      const brand = url.searchParams.get('brand') || '';
      const sort = url.searchParams.get('sort') || 'createdAt';
      const order = url.searchParams.get('order') === 'asc' ? 1 : -1;

      const filter: any = { active: true, status: 'published' };
      if (search) filter.$or = [
        { modelName: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
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
      const [specs, benchmarks, images, prices] = await Promise.all([
        PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
        PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
        PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
        PhonePrice.find({ phoneId: phone._id }).lean(),
      ]);
      await Phone.updateOne({ _id: phone._id }, { $inc: { views: 1 } });
      return NextResponse.json(phoneToJSON(phone, specs, benchmarks, images, prices));
    }

    // ---- /api/brands ----
    if (segments.length === 1 && segments[0] === 'brands') {
      await connectDB();
      const brands = await Brand.find({ active: true }).sort({ sortOrder: 1 }).lean();
      return NextResponse.json(brands);
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
      const news = await News.find({ published: true }).sort({ createdAt: -1 }).lean();
      return NextResponse.json(news);
    }

    // ---- /api/news/:slug ----
    if (segments.length === 2 && segments[0] === 'news') {
      await connectDB();
      const article = await News.findOne({ slug: segments[1], published: true }).lean();
      if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await News.updateOne({ _id: article._id }, { $inc: { views: 1 } });
      return NextResponse.json(article);
    }

    // ---- /api/admin/session ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'session') {
      await connectDB();
      const session = await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
      if (!versionCheck.valid) {
        const response = NextResponse.json({ authenticated: false }, { status: 401 });
        response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
        return response;
      }
      const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
      if (!admin || !admin.active) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      // Session rotation: if less than 50% TTL remains, issue new token
      const response = NextResponse.json({
        authenticated: true,
        admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
      });

      if (session.exp) {
        const remaining = session.exp - Math.floor(Date.now() / 1000);
        const halfTtl = 12 * 3600; // 12 hours (50% of 24h)
        if (remaining < halfTtl && remaining > 0) {
          const newSession = await createSignedSession({
            sub: admin._id.toString(),
            email: admin.email,
            role: admin.role,
            sessionVersion: (admin as any).sessionVersion ?? 0,
          });
          response.cookies.set('pd_session', newSession.token, newSession.cookieOptions);
        }
      }

      return response;
    }

    // ---- /api/admin/stats ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'stats') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
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
        recentActivity,
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
      return NextResponse.json(brands);
    }

    // ---- /api/admin/news ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'news:read'); if (permCheck) return permCheck;
      await connectDB();
      const news = await News.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json(news);
    }

    // ---- /api/admin/users ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
      await connectDB();
      const users = await Admin.find().select('-password -resetTokenHash -resetTokenExpires').sort({ createdAt: -1 }).lean();
      return NextResponse.json(users);
    }

    // ---- /api/admin/activity ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'activity') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      await connectDB();
      const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100).populate('adminId', 'name email').lean();
      return NextResponse.json(logs);
    }

    // ---- /api/import/history ----
    if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'history') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
      await connectDB();
      const { ImportHistory } = await import('@/lib/models/ImportHistory');
      const history = await ImportHistory.find().sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json(history);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API GET error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ POST HANDLER ============
export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  const isLogin = segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login';
  const isForgotPassword = segments.length === 3 && segments[0] === 'admin' && segments[1] === 'forgot-password';
  const isResetPassword = segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reset-password';
  const isContact = segments.length === 1 && segments[0] === 'contact';
  const isCollector = segments.length >= 2 && segments[0] === 'collector';
  const isImport = segments.length >= 1 && segments[0] === 'import';

  try {
    await connectDB();

    if (isLogin) {
      if (!await checkIpRateLimit(`login:${ip}`, 10, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
      }
    } else if (isForgotPassword || isResetPassword) {
      if (!await checkIpRateLimit(`pwreset:${ip}`, 5, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many password reset attempts.' }, { status: 429 });
      }
    } else if (isContact) {
      if (!await checkIpRateLimit(`contact:${ip}`, 3, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many contact submissions.' }, { status: 429 });
      }
    } else if (isCollector || isImport) {
      if (!await checkIpRateLimit(`api:${ip}`, 100, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
      }
    } else {
      if (!await checkIpRateLimit(`api:${ip}`, 100, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
      }
    }
  } catch {
    // If rate limit DB check fails, fail closed
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
    // ---- /api/admin/session (cookie-based session check) ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'session') {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      const versionCheck = await validateSessionVersion(session.sub, session.sessionVersion ?? 0, Admin);
      if (!versionCheck.valid) {
        const response = NextResponse.json({ authenticated: false }, { status: 401 });
        response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
        return response;
      }
      const admin = await Admin.findById(session.sub).select('-password -resetTokenHash -resetTokenExpires');
      if (!admin || !admin.active) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      return NextResponse.json({
        authenticated: true,
        admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
      });
    }

    // ---- /api/admin/login ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login') {
      const body = await req.json();
      const email = sanitizeInput(String(body.email || '')).toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }

      const admin = await Admin.findOne({ email }).select('+password +failedAttempts +lockedUntil +sessionVersion');
      if (!admin) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // DB-backed rate limiting
      const rateCheck = checkLoginRateLimitFromDB(admin);
      if (!rateCheck.allowed) {
        const minsLeft = rateCheck.lockedUntil
          ? Math.ceil((rateCheck.lockedUntil.getTime() - Date.now()) / 60000)
          : 15;
        return NextResponse.json({ error: `Too many login attempts. Try again in ${minsLeft} minutes.` }, { status: 429 });
      }

      if (!admin.active) {
        return NextResponse.json({ error: 'Account is disabled' }, { status: 403 });
      }

      const valid = await verifyPassword(password, admin.password);
      if (!valid) {
        recordFailedLoginDB(admin);
        await admin.save();
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Successful login
      resetFailedAttempts(admin);
      admin.lastLogin = new Date();
      admin.lastLoginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
      admin.lastLoginUA = req.headers.get('user-agent')?.slice(0, 200) || '';
      await admin.save();

      const session = await createSignedSession({
        sub: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        sessionVersion: (admin as any).sessionVersion ?? 0,
      });

      // Single cookie — no token in response body
      const response = NextResponse.json({
        success: true,
        admin: { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role },
      });
      response.cookies.set('pd_session', session.token, session.cookieOptions);

      try { await ActivityLog.create({ adminId: admin._id, action: 'login', details: 'Admin logged in', entityType: 'admin' }); } catch {}
      return response;
    }

    // ---- /api/admin/logout ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'logout') {
      const session = await getSessionFromRequest(req);
      if (session?.sub) {
        // Increment sessionVersion to invalidate this and all other sessions
        await Admin.findByIdAndUpdate(session.sub, { $inc: { sessionVersion: 1 } }).catch(() => {});
      }
      const response = NextResponse.json({ success: true });
      response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
      return response;
    }

    // ---- /api/admin/change-password ----
    if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'change-password') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const body = await req.json();
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
      }
      const pwCheck = isStrongPassword(newPassword);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
      }
      const adminFull = await Admin.findById(admin._id).select('+password');
      if (!adminFull) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
      const valid = await verifyPassword(currentPassword, adminFull.password);
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      adminFull.password = await hashPassword(newPassword);
      adminFull.passwordChangedAt = new Date();
      // Increment sessionVersion to invalidate ALL existing sessions
      await Admin.findByIdAndUpdate(admin._id, {
        $set: { password: adminFull.password, passwordChangedAt: new Date() },
        $inc: { sessionVersion: 1 },
      });
      // Clear the cookie so user must re-login
      const response = NextResponse.json({ success: true, message: 'Password changed. Please log in again.' });
      response.cookies.set('pd_session', '', { maxAge: 0, path: '/' });
      try { await ActivityLog.create({ adminId: admin._id, action: 'change_password', details: 'Password changed', entityType: 'admin' }); } catch {}
      return response;
    }

    // ---- /api/admin/forgot-password ----
    if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'forgot-password') {
      // If email is not configured, return a generic message
      if (!isEmailConfigured()) {
        return NextResponse.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
      }

      const body = await req.json();
      const email = sanitizeInput(String(body.email || '')).toLowerCase();
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

      // Always return success to prevent email enumeration
      const admin = await Admin.findOne({ email }).select('+resetTokenHash +resetTokenExpires');
      if (admin) {
        const rawToken = crypto.randomUUID();
        const tokenHash = hashResetToken(rawToken);
        admin.resetTokenHash = tokenHash;
        admin.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        await admin.save();
        // TODO: Send email with reset link containing raw token
        // For now, forgot-password is effectively disabled because no email is sent
        // and the raw token is NEVER logged or returned
      }
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
    }

    // ---- /api/admin/reset-password (token-based) ----
    if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reset-password') {
      const body = await req.json();
      const { token, newPassword } = body;
      if (!token || !newPassword) {
        return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
      }
      const pwCheck = isStrongPassword(newPassword);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
      }

      const tokenHash = hashResetToken(token);
      const admin = await Admin.findOne({
        resetTokenHash: tokenHash,
        resetTokenExpires: { $gt: new Date() },
      }).select('+password +resetTokenHash +resetTokenExpires +sessionVersion');

      if (!admin) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
      }

      // One-time usage: clear token, hash new password, increment sessionVersion
      const hashedPassword = await hashPassword(newPassword);
      await Admin.findByIdAndUpdate(admin._id, {
        $set: { password: hashedPassword, passwordChangedAt: new Date(), resetTokenHash: undefined, resetTokenExpires: undefined },
        $inc: { sessionVersion: 1 },
      });

      try { await ActivityLog.create({ adminId: admin._id, action: 'reset_password', details: 'Password reset via token', entityType: 'admin' }); } catch {}
      return NextResponse.json({ success: true, message: 'Password reset. Please log in.' });
    }

    // ---- /api/import (file upload) ----
    if (segments.length === 1 && segments[0] === 'import') {
      return handleCollectorFileUpload(req);
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
      const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
      const assignedRole = validRoles.includes(role) ? role : 'admin';
      if (assignedRole === 'superadmin' && admin.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmins can create superadmin accounts' }, { status: 403 });
      }
      const existing = await Admin.findOne({ email: email.toLowerCase() });
      if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      const newAdmin = await Admin.create({
        email: email.toLowerCase(), name,
        password: await hashPassword(password),
        role: assignedRole, active: true, sessionVersion: 0,
      });
      try { await ActivityLog.create({ adminId: admin._id, action: 'create_user', details: `Created admin: ${email}`, entityType: 'admin', entityId: newAdmin._id?.toString() }); } catch {}
      return NextResponse.json({ success: true, id: newAdmin._id?.toString() });
    }

    // ---- /api/import/validate ----
    if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'validate') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'imports:read'); if (permCheck) return permCheck;
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      let records: any[] = [];
      try {
        if (ext === 'json') {
          records = JSON.parse(buffer.toString('utf-8'));
          if (!Array.isArray(records)) records = [records];
        } else if (ext === 'csv') {
          const result = await new Promise<{ data: any[] }>((resolve) => {
            Papa.parse(buffer.toString('utf-8'), { header: true, skipEmptyLines: true, complete: resolve });
          });
          records = result.data;
        } else if (ext === 'xlsx' || ext === 'xls') {
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (sheetName) {
            records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
          }
        }
      } catch (e: any) {
        return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 400 });
      }
      return NextResponse.json({ valid: true, totalRecords: records.length, sample: records.slice(0, 3) });
    }

    // ---- /api/import/rollback ----
    if (segments.length === 2 && segments[0] === 'import' && segments[1] === 'rollback') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'imports:execute'); if (permCheck) return permCheck;
      const body = await req.json();
      return NextResponse.json({ success: true, message: 'Rollback not implemented yet' });
    }

    // ---- /api/admin/phones (CREATE) ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'phones:create'); if (permCheck) return permCheck;
      const body = await req.json();
      const { brandId, modelName, slug: inputSlug, pricePKR, ptaStatus, ptaApproved, releaseDate,
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
      const phone = await Phone.create({ brandId, modelName, slug, pricePKR: pricePKR || 0, ptaStatus: ptaStatus || 'Unknown', ptaApproved: ptaApproved || false, releaseDate: releaseDate || '', thumbnail: thumbnail || '', description: description || '', featured: featured || false, trending: trending || false, upcoming: upcoming || false, status: phoneStatus || 'published', active: true, cameraScore: cameraScore || 0, performanceScore: performanceScore || 0, batteryScore: batteryScore || 0, displayScore: displayScore || 0, valueScore: valueScore || 0, overallRating: overallRating || 0, pros: pros || '', cons: cons || '', reviewSummary: reviewSummary || '', reviewVerdict: reviewVerdict || '', seoTitle: seoTitle || '', seoDescription: seoDescription || '', keywords: keywords || '' });
      if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
      if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
      if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
      if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
      try { await ActivityLog.create({ action: 'create_phone', details: `Created: ${brand.name} ${modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch {}
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
      try { await ActivityLog.create({ action: 'create_brand', details: `Created: ${name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch {}
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
      try { await ActivityLog.create({ action: 'create_news', details: `Created: ${title}`, entityType: 'news', entityId: news._id?.toString() }); } catch {}
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
          if (!bId) { const nb = await Brand.create({ name: bName, active: true }); brandMap.set(bName.toLowerCase(), nb._id); bId = nb._id; }
          const slug = String(r.slug || '').trim() || `${bName} ${mName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          const isDup = existingSlugs.has(slug) || existingBM.has(`${bName}|${mName}`.toLowerCase());
          if (isDup && mode === 'skip_duplicates') { skipped++; continue; }
          const pd: any = { brandId: bId, modelName: mName, slug, pricePKR: parseInt(r.pricePKR) || parseInt(r.price) || 0, ptaStatus: r.ptaStatus || 'Unknown', ptaApproved: r.ptaApproved === true, releaseDate: r.releaseDate || '', thumbnail: r.thumbnail || '', description: r.description || '', featured: r.featured === true, trending: r.trending === true, upcoming: r.upcoming === true, status: 'published', active: true, cameraScore: parseInt(r.cameraScore) || 0, performanceScore: parseInt(r.performanceScore) || 0, batteryScore: parseInt(r.batteryScore) || 0, displayScore: parseInt(r.displayScore) || 0, valueScore: parseInt(r.valueScore) || 0, overallRating: parseInt(r.overallRating) || 0, pros: r.pros || '', cons: r.cons || '', reviewSummary: r.reviewSummary || '', reviewVerdict: r.reviewVerdict || '' };
          if (isDup && mode === 'update_existing') { const ex = await Phone.findOne({ slug }); if (ex) { await Phone.updateOne({ _id: ex._id }, { $set: pd }); if (r.specs) await PhoneSpecs.findOneAndUpdate({ phoneId: ex._id }, { $set: r.specs }, { upsert: true }); if (r.benchmarks) await PhoneBenchmark.findOneAndUpdate({ phoneId: ex._id }, { $set: r.benchmarks }, { upsert: true }); updated++; continue; } }
          const phone = await Phone.create(pd); existingSlugs.add(slug); existingBM.add(`${bName}|${mName}`.toLowerCase());
          if (r.specs) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...r.specs, phoneId: phone._id }, { upsert: true });
          if (r.benchmarks) await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...r.benchmarks, phoneId: phone._id }, { upsert: true });
          if (Array.isArray(r.images)) await PhoneImage.insertMany(r.images.map((img: any, j: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? j })));
          if (Array.isArray(r.prices)) await PhonePrice.insertMany(r.prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
          imported++;
        } catch (err: any) { failed++; errors.push(`Row ${i+1}: ${err.message}`); }
      }
      try { await ActivityLog.create({ action: 'bulk_import', details: `Bulk: ${imported} new, ${updated} updated, ${skipped} skipped, ${failed} failed`, entityType: 'phone' }); } catch {}
      return NextResponse.json({ success: true, total: records.length, imported, updated, skipped, failed, errors });
    }

    // ---- /api/admin/seed (DISABLED IN PRODUCTION) ----
    if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'seed') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Seed endpoint is disabled in production' }, { status: 403 });
      }
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'phones:seed'); if (permCheck) return permCheck;
      const { seedPhones } = await import('@/lib/seed-data');
      const result = await seedPhones();
      try { await ActivityLog.create({ action: 'seed', details: `Seeded: ${result.phones} phones`, entityType: 'phone' }); } catch {}
      return NextResponse.json({ success: true, ...result });
    }

    // ---- /api/collector/sources ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'sources') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      const body = await req.json();
      const source = await CollectorSource.create(body);
      return NextResponse.json({ success: true, id: source._id });
    }

    // ---- /api/collector/jobs ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      const body = await req.json();
      const job = await CollectorJob.create({ ...body, status: 'pending', startedAt: new Date() });
      return NextResponse.json({ success: true, id: job._id });
    }

    // ---- /api/collector/review/:id ----
    if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'review') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      const body = await req.json();
      const { action } = body;
      const item = await CollectedPhone.findById(segments[2]);
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      if (action === 'approve') {
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
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      return NextResponse.json({ success: true, message: 'Test not implemented' });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API POST error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ PUT HANDLER ============
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  try {
    await connectDB();
    if (!await checkIpRateLimit(`api:${ip}`, 100, 60_000, RateLimit)) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
    // ---- /api/admin/phones/:id (UPDATE) ----
    if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
      const phone = await Phone.findById(segments[2]);
      if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const body = await req.json();
      const { brandId, modelName, slug: inputSlug, pricePKR, ptaStatus, ptaApproved, releaseDate,
        thumbnail, description, featured, trending, upcoming, status: phoneStatus, active,
        cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
        pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
        specs, benchmarks, images, prices } = body;
      if (modelName) phone.modelName = modelName;
      if (inputSlug !== undefined) phone.slug = inputSlug;
      if (brandId) { const b = await Brand.findById(brandId); if (b) phone.brandId = brandId; }
      if (pricePKR !== undefined) phone.pricePKR = pricePKR;
      if (ptaStatus !== undefined) phone.ptaStatus = ptaStatus;
      if (ptaApproved !== undefined) phone.ptaApproved = ptaApproved;
      if (releaseDate !== undefined) phone.releaseDate = releaseDate;
      if (thumbnail !== undefined) phone.thumbnail = thumbnail;
      if (description !== undefined) phone.description = description;
      if (featured !== undefined) phone.featured = featured;
      if (trending !== undefined) phone.trending = trending;
      if (upcoming !== undefined) phone.upcoming = upcoming;
      if (phoneStatus !== undefined) phone.status = phoneStatus;
      if (active !== undefined) phone.active = active;
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
      if (specs && typeof specs === 'object') await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
      if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
      if (images !== undefined) {
        await PhoneImage.deleteMany({ phoneId: phone._id });
        if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
      }
      if (prices !== undefined) {
        await PhonePrice.deleteMany({ phoneId: phone._id });
        if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
      }
      try { await ActivityLog.create({ action: 'update_phone', details: `Updated: ${phone.modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch {}
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
      if (body.active !== undefined) brand.active = body.active;
      await brand.save();
      try { await ActivityLog.create({ action: 'update_brand', details: `Updated: ${brand.name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch {}
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
      if (body.slug !== undefined) news.slug = body.slug;
      if (body.content !== undefined) news.content = body.content;
      if (body.excerpt !== undefined) news.excerpt = body.excerpt;
      if (body.category) news.category = body.category;
      if (body.image !== undefined) news.image = body.image;
      if (body.author !== undefined) news.author = body.author;
      if (body.published !== undefined) news.published = body.published;
      if (body.featured !== undefined) news.featured = body.featured;
      if (body.status !== undefined) news.status = body.status;
      await news.save();
      try { await ActivityLog.create({ action: 'update_news', details: `Updated: ${news.title}`, entityType: 'news', entityId: news._id?.toString() }); } catch {}
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

    // ---- /api/collector/sources/:id (toggle) ----
    if (segments.length === 3 && segments[0] === 'collector' && segments[1] === 'sources') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      const source = await CollectorSource.findById(segments[2]);
      if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      source.enabled = !source.enabled;
      await source.save();
      return NextResponse.json({ success: true, enabled: source.enabled });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API PUT error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ DELETE HANDLER ============
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  try {
    await connectDB();
    if (!await checkIpRateLimit(`api:${ip}`, 100, 60_000, RateLimit)) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
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
      try { await ActivityLog.create({ action: 'delete_phone', details: `Deleted: ${name}`, entityType: 'phone', entityId: id }); } catch {}
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
      try { await ActivityLog.create({ action: 'delete_brand', details: `Deleted: ${name}`, entityType: 'brand', entityId: id }); } catch {}
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
      try { await ActivityLog.create({ action: 'delete_news', details: `Deleted: ${title}`, entityType: 'news', entityId: id }); } catch {}
      return NextResponse.json({ success: true });
    }

    // ---- /api/collector/jobs (delete job) ----
    if (segments.length === 2 && segments[0] === 'collector' && segments[1] === 'jobs') {
      const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
      const permCheck = requirePermission(admin, 'collectors:manage'); if (permCheck) return permCheck;
      const body = await req.json();
      await CollectorJob.findByIdAndDelete(body.jobId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API DELETE error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ FILE UPLOAD HANDLER (SECURED) ============
async function handleCollectorFileUpload(req: NextRequest) {
  const authResult = await getAdminFromRequest(req);
  if (authResult.error) return authResult.error;
  const admin = authResult.admin;
  const permCheck = requirePermission(admin, 'imports:execute');
  if (permCheck) return permCheck;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceId = formData.get('sourceId') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // File size check
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` }, { status: 400 });
    }

    // Extension check
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .json, .csv, or .xlsx' }, { status: 400 });
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.has(file.type) && ext !== 'xls') {
      return NextResponse.json({ error: 'Invalid file MIME type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[] = [];

    // Parse based on file type
    if (ext === 'json') {
      try {
        const text = buffer.toString('utf-8');
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : [parsed];
        if (!Array.isArray(records[0])) {
          for (const wrapper of ['phones', 'data', 'records', 'results', 'items'] as const) {
            const candidate = (records as unknown as Record<string, unknown>)[wrapper];
            if (Array.isArray(candidate)) { records = candidate as any[]; break; }
          }
        }
      } catch (e: any) {
        return NextResponse.json({ error: `Invalid JSON: ${e.message}` }, { status: 400 });
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Use xlsx package correctly — NOT JSON.parse
      try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400 });
        }
        const sheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } catch (e: any) {
        return NextResponse.json({ error: `Excel parsing error: ${e.message}` }, { status: 400 });
      }
    } else if (ext === 'csv') {
      try {
        const text = buffer.toString('utf-8');
        const result = await new Promise<{ data: any[] }>((resolve, reject) => {
          Papa.parse(text, { header: true, skipEmptyLines: true, complete: resolve, error: (err: Error) => reject(err) });
        });
        records = result.data;
        // CSV formula injection protection
        records = records.map((row: any) => {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(row)) {
            sanitized[key] = typeof value === 'string' ? sanitizeCsvValue(value) : value;
          }
          return sanitized;
        });
      } catch (e: any) {
        return NextResponse.json({ error: `CSV parsing error: ${e.message}` }, { status: 400 });
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No phone records found in file' }, { status: 400 });
    }

    // Record count check
    if (records.length > MAX_UPLOAD_RECORDS) {
      return NextResponse.json({ error: `Too many records (max ${MAX_UPLOAD_RECORDS})` }, { status: 400 });
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

    const allExisting: any[] = await Phone.find(
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
      const phoneNorm: any = { ...phone, brandName: String(phone.brandName), model: String(phone.model), slug: phone.slug };
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}