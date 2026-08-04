# Google Search Console Sitemap Hardening — v31.12.13

This release changes only the sitemap/canonical routing layer.

## Fixed

- Removed the duplicate Next.js metadata sitemap route (`src/app/sitemap.ts`).
- Kept `src/app/sitemap.xml/route.ts` as the single owner of `/sitemap.xml`.
- Production sitemap, robots, and canonical URLs now always use `https://specsdekh.com`.
- Removed the duplicate application-level `www` redirect; Vercel domain settings should be the only host redirect authority.
- Removed unnecessary `X-Robots-Tag: noindex` headers from sitemap responses.
- Preserved direct `HTTP 200` XML responses and sitemap proxy exclusions.
- Added `npm run audit:gsc-sitemaps` to prevent regressions.

## Required Vercel domain configuration

- `specsdekh.com` → Production / primary canonical domain.
- `www.specsdekh.com` → either Production or one direct redirect to `specsdekh.com`, but not both Vercel and application code.

## Search Console submission

Submit only:

`https://specsdekh.com/sitemap.xml`

Old 308 and relative-image errors are historical crawl records and update only after Google fetches the new deployment.
