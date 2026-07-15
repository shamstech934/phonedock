import { NextRequest, NextResponse } from 'next/server';
import { RateLimit } from '@/lib/models';
import { connectDB, checkIpRateLimit, getClientIp } from './handlers/helpers';
import { handlePublicGet } from './handlers/public';
import { handleAdminAuthGet, handleAdminAuthPost } from './handlers/admin-auth';
import { handleAdminCrudGet, handleAdminCrudPost, handleAdminCrudPut, handleAdminCrudDelete } from './handlers/admin-crud';
import { handleCollectorGet, handleCollectorPost, handleCollectorPut, handleCollectorDelete } from './handlers/collector';
import { handleImportGet, handleImportPost } from './handlers/import';

// ============ GET HANDLER ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // Public routes
    const publicResult = await handlePublicGet(req, segments);
    if (publicResult) return publicResult;

    // Admin auth routes (session check)
    const authResult = await handleAdminAuthGet(req, segments);
    if (authResult) return authResult;

    // Admin CRUD routes (stats, phones, brands, news, users, activity)
    const crudResult = await handleAdminCrudGet(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (dashboard, sources, jobs)
    const collectorResult = await handleCollectorGet(req, segments);
    if (collectorResult) return collectorResult;

    // Import routes (history)
    const importResult = await handleImportGet(req, segments);
    if (importResult) return importResult;

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

  // ---- Bootstrap-admin: handle BEFORE rate limiting ----
  // This endpoint has its own security (ADMIN_BOOTSTRAP_SECRET header + one-time check).
  // Rate limiting is unnecessary and could block the very first request on a fresh deployment.
  if (segments.length === 1 && segments[0] === 'bootstrap-admin') {
    try {
      const bootstrapResult = await handleAdminAuthPost(req, segments);
      if (bootstrapResult) return bootstrapResult;
    } catch (e: any) {
      console.error('Bootstrap-admin error:', e.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

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
    // Admin auth routes (bootstrap, session, login, logout, change-password, forgot-password, reset-password)
    const authResult = await handleAdminAuthPost(req, segments);
    if (authResult) return authResult;

    // Import routes (file upload, validate, rollback)
    const importResult = await handleImportPost(req, segments);
    if (importResult) return importResult;

    // Admin CRUD routes (users create, phones create, brands create, news create, bulk-import, seed)
    const crudResult = await handleAdminCrudPost(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (sources, jobs, review, test)
    const collectorResult = await handleCollectorPost(req, segments);
    if (collectorResult) return collectorResult;

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
    // Admin CRUD routes (phones, brands, news update, toggle-featured, toggle-trending)
    const crudResult = await handleAdminCrudPut(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (sources toggle)
    const collectorResult = await handleCollectorPut(req, segments);
    if (collectorResult) return collectorResult;

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
    // Admin CRUD routes (phones, brands, news delete)
    const crudResult = await handleAdminCrudDelete(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (jobs delete)
    const collectorResult = await handleCollectorDelete(req, segments);
    if (collectorResult) return collectorResult;

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API DELETE error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}