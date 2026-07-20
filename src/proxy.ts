/**
 * Next.js Proxy — PhoneDock Production
 *
 * Responsibilities:
 *  1. Block unauthenticated /admin/* requests (redirect to /admin/login)
 *  2. Block unauthenticated /api/admin/* requests (401)
 *  3. Redirect /admin to /admin/login when no session
 *
 * Request rate limiting is enforced in the API handler with MongoDB-backed
 * counters. The proxy must remain stateless because Edge/serverless instances
 * do not share memory and can be recycled at any time.
 */

import { NextRequest, NextResponse } from 'next/server';

// ============ CONFIGURATION ============

const LOGIN_PATH = '/admin/login';
const SESSION_COOKIE = 'pd_session';


// ============ HELPERS ============

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIE);
}

function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === '/admin/auth/login';
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

// ============ PROXY ============

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  const nextWithSecurityHeaders = () => {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-request-id', requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('X-Request-Id', requestId);
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('Pragma', 'no-cache');
    }
    return response;
  };
  // Skip static assets & public pages
  if (isStaticAsset(pathname)) return nextWithSecurityHeaders();
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return nextWithSecurityHeaders();
  }

  // === LOGIN PAGE: allow through (no session needed) ===
  if (isLoginPath(pathname)) return nextWithSecurityHeaders();
  if (pathname === '/admin/forgot-password' || pathname === '/admin/reset-password' || pathname === '/admin/auth/forgot-password') return nextWithSecurityHeaders();

  // === ADMIN API ROUTES: check session cookie existence ===
  if (pathname.startsWith('/api/admin')) {
    // Allow first-setup endpoint
    if (pathname === '/api/admin/first-setup') return nextWithSecurityHeaders();

    // Public admin authentication endpoints (no existing session required)
    if (
      pathname === '/api/admin/login' ||
      pathname === '/api/admin/forgot-password' ||
      pathname === '/api/admin/reset-password' ||
      pathname.startsWith('/api/admin/auth/')
    ) return nextWithSecurityHeaders();

    // All other /api/admin/* need session cookie
    if (!hasSessionCookie(req)) {
      const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    return nextWithSecurityHeaders();
  }

  // === ADMIN UI PAGES: check session cookie ===
  if (pathname.startsWith('/admin')) {
    if (!hasSessionCookie(req)) {
      const loginUrl = new URL(LOGIN_PATH, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    return nextWithSecurityHeaders();
  }

  return nextWithSecurityHeaders();
}

export const config = {
  matcher: [
    // Match all admin routes and API admin routes
    '/admin/:path*',
    '/api/admin/:path*',
    // Login path is included so public-route handling stays explicit
    '/admin/login',
  ],
};