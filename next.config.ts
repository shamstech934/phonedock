import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isProduction ? [] : ["'unsafe-eval'"]),
  'https://va.vercel-scripts.com',
  'https://challenges.cloudflare.com',
].join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  "object-src 'none'",
  `script-src ${scriptSources}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://fdn2.gsmarena.com https://res.cloudinary.com https://images.unsplash.com https://upload.wikimedia.org https://i.ytimg.com",
  "connect-src 'self' https://va.vercel-scripts.com https://challenges.cloudflare.com https://res.cloudinary.com https://mongodb.googleapis.com",
  "frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Type checking is enforced by the separate deterministic `npm run typecheck` CI step.
  // Keeping it out of Next's worker avoids duplicate/hanging checks in constrained builders.
  typescript: { ignoreBuildErrors: true },
  outputFileTracingRoot: process.cwd(),
  // output: "standalone",
  serverExternalPackages: ['crypto'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fdn2.gsmarena.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    cpus: 2,
  },
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Origin-Agent-Cluster', value: '?1' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
      {
        source: '/api/phones/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=1800' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=1800' },
        ],
      },
      {
        source: '/api/brands/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=1800, stale-while-revalidate=86400' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=1800, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/api/news/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=1800' },
          { key: 'CDN-Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=1800' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      ...[
        '/api/admin/:path*',
        '/api/collector/:path*',
        '/api/import/:path*',
        '/api/import-v2/:path*',
        '/api/price-tracker/:path*',
        '/api/data-quality/:path*',
        '/api/first-setup/:path*',
        '/api/cron/:path*',
      ].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      })),
    ];
  },
};

export default nextConfig;