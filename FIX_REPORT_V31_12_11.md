# SpecsDekh v31.12.11 — Sitemap routing hardening

## Fixed
- Excluded `robots.txt`, `sitemap.xml`, and every `*-sitemap.xml` route from the application proxy matcher.
- Added all child sitemap routes to the static-route bypass guard.
- Set every sitemap route to the Node.js runtime consistently.
- Normalized `NEXT_PUBLIC_BASE_URL` to prevent double slashes in generated absolute URLs.
- Made sitemap XML responses explicitly return HTTP 200.

## Why
The previous proxy matcher processed child sitemap requests even though only `/sitemap.xml` was treated as a static route. That allowed canonical-host, maintenance-mode, and database-dependent proxy logic to affect child sitemap fetches. Search engines should receive XML routes directly.

## Validation completed here
- Source-level regression assertions passed for all seven sitemap routes.
- XML URL generation and image URL normalization were inspected.

## Environment limitation
A full `npm ci`/production build could not be executed in this workspace because the package mirror returned 404 for required packages (`zod-validation-error` and `@axe-core/playwright`). Run `npm ci && npm run verify` in GitHub Actions/Vercel after upload.
