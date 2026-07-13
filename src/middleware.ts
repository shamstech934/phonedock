import { NextRequest, NextResponse } from 'next/server';

// ============ SECURITY HEADERS ============

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
};

// ============ RATE LIMITER (in-memory, per IP) ============

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Periodically clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60_000).unref();

// ============ MIDDLEWARE ============

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers to ALL responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limit login attempts (10 per minute per IP)
  if (request.nextUrl.pathname === '/api/admin/login' && request.method === 'POST') {
    if (!rateLimit(ip, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: Object.fromEntries(
            Object.entries(securityHeaders).map(([k, v]) => [k, v])
          ),
        }
      );
    }
  }

  // Rate limit all non-GET API routes (100 per minute per IP)
  if (request.nextUrl.pathname.startsWith('/api/') && request.method !== 'GET') {
    if (!rateLimit(ip, 100, 60_000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        {
          status: 429,
          headers: Object.fromEntries(
            Object.entries(securityHeaders).map(([k, v]) => [k, v])
          ),
        }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};