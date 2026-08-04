# SpecsDekh 23.0.0 — Pakistan Intelligence

- Added a low-load Pakistan market review module.
- Detects missing PTA status, missing Pakistan price, missing retailer coverage, stale verification, retailer price conflicts and missing Pakistan launch dates.
- Reuses trusted verified Price Tracker listings instead of paid AI or web scraping.
- Adds safe admin-reviewed price/PTA recommendations with Activity Log and Price History tracking.
- Scans are capped at 500 phones and default to 150 per run.
- Nothing publishes automatically.

# Changelog

## 1.0.0-rc.1 — 2026-07-22

### Added

- Phone database, comparison, rankings, search and editorial surfaces.
- Account wishlist, compare history, recently viewed and price-alert foundations.
- Admin, import, collector, price tracking, quality and provenance workflows.
- Commercial affiliate, sponsor, consent-gated analytics/advertising and double-opt-in newsletter foundations.
- Canonical enterprise operations, security, architecture and API documentation.

### Security

- Rate-limited account flows, session revocation/versioning and security events.
- Shared validation, SSRF controls, affiliate allowlists and environment validation.
- Hashed newsletter verification tokens and consent-gated third-party scripts.

### Changed

- Standardized phone-card layout and rating presentation.
- Set release metadata to semantic version `1.0.0`.

### Known limitations

- Release build requires a valid staging/production `MONGODB_URI` during prerender.
- Commercial reporting/admin workflows are foundations and are not feature-complete.
- Lighthouse targets and full staging browser coverage require a deployed production-like environment.
- External mobile API compatibility is not guaranteed in 1.0.

No intentional breaking API change is declared; integrations with internal catch-all handlers remain unsupported.

## v5.1.0 — AI Phone Finder
- Added reusable Roman Urdu and English natural-language query parser.
- Added `k`, `lakh/lac`, plain PKR budget recognition.
- Added typo/alias-aware brand detection, multi-intent detection, AMOLED, PTA, NFC, 5G and chipset filters.
- Added parser confidence display and local recent-search history.
- Added automated parser regression tests.

## 17.0.1 - Production finalization

- Added warnings for obsolete `NEXT_PUBLIC_SITE_URL` and `COLLECTOR_SECRET` variables.
- Clarified canonical `NEXT_PUBLIC_BASE_URL` requirements in `.env.example`.
- Documented required and grouped production environment variables.
- Removed unused legacy AI enrichment runtime and its direct legacy tests.
- Archived historical root reports without deleting them.

## Phase 9 — Admin Navigation Consolidation
- Grouped the oversized admin sidebar into focused work areas.
- Added permission-aware nested links and active-group expansion.
- Replaced mobile horizontal admin tabs with a grouped selector.
- Statically verified all 40 linked admin routes exist.

## Phase 10 — Final Production Audit & Release Gate
- Added static route/link/branding/origin audit.
- Added consolidated `release:gate` verification command.
- Verified 87 application routes with no broken or unsafe static internal links.
- Added JSON audit artifact and production audit report.

## 20.0.0 — Consolidated Production Candidate

- Consolidated all SpecsDekh rebranding and production audit sprints into one package.
- Added a final aggregate release audit and admin/API contract audit to the release gate.
- Preserved backward-compatible database configuration while standardizing production documentation.
- Included all cumulative import, routing, cron, admin UX, automation, launch intelligence, and Price Tracker safeguards.

## 21.0.0 — AI Research Queue Hardening

- Replaced monolithic AI research requests with queued, cursor-based jobs.
- Added serverless-safe bounded job batches and resumable progress.
- Added per-phone failure tracking without losing completed drafts.
- Added pending-draft deduplication so repeated runs update review drafts instead of multiplying them.
- Added manual job run and cancellation endpoints.
- Updated Admin AI Research to process bounded batches with live progress.
- Added a release-gate audit for the AI research queue contract.

## v27.5 — Global Phone Date Ordering
- Added one canonical chronology sort for public and admin phone lists.
- Newer release years and dates now appear before older phones automatically.
- Brand pages, homepage sections, search results, related phones, price groups, hero fallbacks, and the admin phone list now use the same ordering rules.
- Ranking sections keep their score priority and use release chronology as a deterministic tie-breaker.
- Missing exact dates fall back through availability, Pakistan launch, announcement, expected launch, creation time, and document ID.
- Added a release-gate audit to prevent future regressions.
