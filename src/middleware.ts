/**
 * Next.js Middleware — PhoneDock Production
 *
 * Responsibilities:
 *  1. Block unauthenticated /admin/* requests (redirect to /admin/login)
 *  2. Block unauthenticated /api/admin/* requests (401)
 *  3. Rate-limit login attempts (in-memory, per IP)
 *  4. Redirect /admin to /admin/login when no session
 */

import { NextRequest, NextResponse } from 'next/server';

// ============ CONFIGURATION ============

const LOGIN_PATH = '/admin/login';
const SESSION_COOKIE = 'pd_session';

// Rate limiter: max 15 login-related requests per minute per IP
const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_MAX = 15;
const LOGIN_RATE_WINDOW_MS = 60_000;

// ============ HELPERS ============

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE);
}

function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === '/admin/auth/login';
}

function isPublicApiPath(pathname: string): boolean {
  // Public API routes that don't need auth
  const publicPrefixes = [
    '/api/phones',
    '/api/brands',
    '/api/news',
    '/api/reviews',
    '/api/videos',
    '/api/sitemap',
    '/api/compare',
    '/api/price-alerts',
    '/api/contact',
    '/api/search',
    '/api/cron/',       // cron uses CRON_SECRET, not session
    '/api/first-setup', // setup uses FIRST_ADMIN_SETUP_KEY
    '/api/health',
    '/api/_meta',       // OpenAPI / metadata endpoints
  ];
  return publicPrefixes.some(p => pathname.startsWith(p));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/images/')
  );
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = loginRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + LOGIN_RATE_WINDOW_MS };
    loginRateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= LOGIN_RATE_MAX;
}

// Evict stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginRateLimitMap) {
    if (now > entry.resetAt) loginRateLimitMap.delete(ip);
  }
}, 5 * 60_000);

// ============ MIDDLEWARE ============

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Skip static assets & public pages
  if (isStaticAsset(pathname)) return NextResponse.next();
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // === LOGIN RATE LIMITING ===
  if (isLoginPath(pathname) || pathname === '/api/admin/login' || pathname === '/api/admin/forgot-password' || pathname === '/api/admin/reset-password' || pathname === '/api/admin/auth/login' || pathname === '/api/admin/auth/forgot-password') {
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // === LOGIN PAGE: allow through (no session needed) ===
  if (isLoginPath(pathname)) return NextResponse.next();
  if (pathname === '/admin/auth/forgot-password') return NextResponse.next();

  // === ADMIN API ROUTES: check session cookie existence ===
  if (pathname.startsWith('/api/admin')) {
    // Allow first-setup endpoint
    if (pathname === '/api/admin/first-setup') return NextResponse.next();

    // Public admin authentication endpoints (no existing session required)
    if (
      pathname === '/api/admin/login' ||
      pathname === '/api/admin/forgot-password' ||
      pathname === '/api/admin/reset-password' ||
      pathname.startsWith('/api/admin/auth/')
    ) return NextResponse.next();

    // All other /api/admin/* need session cookie
    if (!hasSessionCookie(req)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // === ADMIN UI PAGES: check session cookie ===
  if (pathname.startsWith('/admin')) {
    if (!hasSessionCookie(req)) {
      const loginUrl = new URL(LOGIN_PATH, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all admin routes and API admin routes
    '/admin/:path*',
    '/api/admin/:path*',
    // Also match login-related paths for rate limiting
    '/admin/login',
  ],
};