# Sprint 4 – Checkpoint 1: SEO Engineering

## Implemented fixes

1. Removed `/search` from the XML sitemap because the page is intentionally `noindex`.
2. Replaced request-time `new Date()` values for static sitemap routes with a stable checkpoint date.
3. Review URLs are now included in the sitemap only when a phone has editorial review content or at least one approved user review.
4. Added Product JSON-LD to phone detail pages.
5. Added BreadcrumbList JSON-LD to phone detail, review, and news detail pages.
6. Corrected review structured data: the main entity is now Product, with AggregateRating and individual Review entries when approved reviews exist.
7. Added dynamic brand metadata, canonical URLs, Open Graph data, and Twitter metadata.
8. Removed duplicated `PhoneDock` suffixes from titles that already inherit the global title template.
9. NewsArticle `dateModified` now uses `updatedAt` rather than copying `createdAt`.
10. Expanded the metadata phone query with fields required by Product structured data.

## Validation

- `npm install --ignore-scripts`: passed.
- Next.js production compilation: passed (`Compiled successfully`).
- TypeScript validation: passed (`npx tsc --noEmit`).
- The complete `next build` process did not finish inside the execution window after compilation and TypeScript began, so deployment should still be verified on the user's local machine/Vercel.

## Files changed

- `src/app/sitemap.ts`
- `src/lib/fetch-phone-detail.ts`
- `src/app/phones/[slug]/page.tsx`
- `src/app/brands/[slug]/layout.tsx`
- `src/app/reviews/[slug]/page.tsx`
- `src/app/news/[slug]/page.tsx`
- SEO title cleanup across ranking, price range, upcoming, and reviews pages
