# Sprint 4 — Checkpoint 6 — Batch 2

## Production hardening completed

- Removed `unsafe-eval` from the production Content Security Policy while retaining it for local development only.
- Added `upgrade-insecure-requests` in production.
- Added Cross-Origin-Resource-Policy and expanded Permissions-Policy restrictions.
- Added explicit no-store headers for all admin and API routes.
- Added a standards-compliant web app manifest and connected it to root metadata.
- Converted the root content wrapper to a semantic, keyboard-focusable `<main>` landmark.
- Stabilized sitemap fallback timestamps to avoid false crawl churn.
- Reused the central base URL helper in metadata and sitemap generation.
- Rebuilt the global error screen so it remains readable even when application CSS fails and does not expose sensitive exception details.

## Deployment notes

- No database migration required.
- No new environment variables required.
- Existing `NEXT_PUBLIC_BASE_URL` continues to control canonical production URLs.
