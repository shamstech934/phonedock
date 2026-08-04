/**
 * Next.js Proxy — SpecsDekh Production
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
import { getSettings } from '@/lib/models/Settings';

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
    pathname.endsWith('-sitemap.xml') ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/images/')
  );
}

// ============ PROXY ============

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  // Canonical host redirect: keep one public URL for SEO, cookies, and sharing.
  if (req.nextUrl.hostname.toLowerCase() === 'www.specsdekh.com') {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.hostname = 'specsdekh.com';
    canonicalUrl.protocol = 'https:';
    canonicalUrl.port = '';
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // Recover malformed nested admin authentication URLs from stale bookmarks
  // or historical relative links, e.g. /compare/admin/login.
  const nestedAdminAuthRoutes = [
    '/admin/login',
    '/admin/forgot-password',
    '/admin/reset-password',
    '/admin/first-setup',
  ];
  const recoveredAdminRoute = nestedAdminAuthRoutes.find(
    (route) => pathname !== route && pathname.endsWith(route),
  );
  if (recoveredAdminRoute) {
    const recoveredUrl = req.nextUrl.clone();
    recoveredUrl.pathname = recoveredAdminRoute;
    return NextResponse.redirect(recoveredUrl, 308);
  }

  // Maintenance mode: block public pages (never admin, API, or static assets)
  // so an admin can still log in and turn it back off.
  if (!isStaticAsset(pathname) && !pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    try {
      const settings = await getSettings();
      if (settings.maintenanceMode) {
        return new NextResponse(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Down for maintenance</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0F172A;color:#fff;text-align:center;padding:20px"><div><h1 style="font-size:1.5rem">We\'ll be right back</h1><p style="color:#94A3B8">The site is temporarily down for maintenance. Please check back soon.</p></div></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300', 'Cache-Control': 'no-store' } },
        );
      }
    } catch {
      // If the settings lookup fails, fail open (don't block the site over a DB hiccup).
    }
  }

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
    // Apply request IDs and security routing consistently to all application
    // requests while excluding immutable Next.js assets.
    '/((?!_next/static|_next/image|favicon.ico|robots\.txt|sitemap\.xml|.*-sitemap\.xml).*)',
  ],
};
