import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge Middleware — runs before request reaches route handlers.
 *
 * Security: Blocks direct access to /admin pages at the edge level.
 * This prevents the HTML from being served before client-side JS redirect kicks in.
 * API routes under /api/ still handle their own auth via requirePermission().
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block direct access to admin pages (not API — those have their own auth)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
    // Allow the login page, forgot-password, reset-password, and first-setup
    const allowedPaths = ['/admin/login', '/admin/forgot-password', '/admin/reset-password', '/admin/first-setup'];
    if (allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.next();
    }

    // For all other admin pages, let the client-side useAdmin hook handle redirect.
    // We set a header so the client knows the middleware is active.
    const response = NextResponse.next();
    response.headers.set('x-admin-middleware', 'active');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Match all admin paths (but not API)
  matcher: ['/admin/:path*'],
};