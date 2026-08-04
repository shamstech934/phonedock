# SpecsDekh v31.12.11 — Google Console and Price Range Fix

## Google Search Console

- Removed the duplicate Next.js metadata sitemap owner (`src/app/sitemap.ts`).
- Kept one explicit `/sitemap.xml` route only.
- Canonical URL generation now always normalizes to HTTPS and non-www.
- Moved the www redirect to one Next.js redirect rule and removed the duplicate proxy redirect.
- Sitemap responses no longer send an unnecessary `X-Robots-Tag: noindex` header.
- Robots and every child sitemap use the same canonical origin.
- Image sitemap keeps only absolute HTTP/HTTPS phone image URLs.
- News sitemap skips malformed slugs.

## Price ranges

The public price directory now uses six useful Pakistan-market bands:

1. Under 25,000 PKR
2. 25K–50K PKR
3. 50K–100K PKR
4. 100K–150K PKR
5. 150K–250K PKR
6. Above 250K PKR

Desktop renders six equal columns, and API boundaries no longer double-count phones.

## Deployment note

Vercel must keep `specsdekh.com` as the primary domain. `www.specsdekh.com` should redirect to the primary domain only once. After deployment, remove the old Search Console sitemap entry and resubmit `sitemap.xml`.
