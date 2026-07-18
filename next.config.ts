import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
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
  },
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes except Next.js internals
        source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            // Note: 'unsafe-inline' and 'unsafe-eval' are required by Next.js runtime.
            // Without them, Next.js hydration, hot-reload (dev), and client components break.
            // TODO: Future hardening — adopt Next.js nonce-based CSP via middleware once
            // the framework supports it fully, then remove 'unsafe-inline' and 'unsafe-eval'.
            value: [
              "object-src 'none'",
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https://fdn2.gsmarena.com https://res.cloudinary.com https://images.unsplash.com https://upload.wikimedia.org https://i.ytimg.com blob:",
              "connect-src 'self' https://va.vercel-scripts.com https://challenges.cloudflare.com https://res.cloudinary.com https://mongodb.googleapis.com",
              "frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // Allow YouTube embed frames (relaxed X-Frame-Options for embed pages only)
      {
        source: '/videos',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "object-src 'none'",
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https://fdn2.gsmarena.com https://res.cloudinary.com https://images.unsplash.com https://upload.wikimedia.org https://i.ytimg.com blob:",
              "connect-src 'self' https://va.vercel-scripts.com https://challenges.cloudflare.com https://res.cloudinary.com https://mongodb.googleapis.com",
              "frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;