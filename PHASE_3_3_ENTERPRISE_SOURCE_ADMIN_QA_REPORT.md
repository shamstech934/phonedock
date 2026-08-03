# Phase 3.3 — Enterprise Source Foundation & Admin QA

## Fixed

- Restored the exact homepage regression contract required by `homepage-builder-pro.test.ts` without changing the independent sticky sidebar behavior.
- Extended price sources from a single verification URL model to provider-level configuration:
  - discovery enabled/disabled
  - manual, catalog, sitemap, feed, or API discovery mode
  - multiple catalog URLs
  - multiple sitemap URLs
  - feed/API URL
  - manual/hourly/daily/weekly sync frequency
  - discovery and product counters in the data model/API
- Clarified that Verification Product URL is optional and used only for extraction testing.
- Added the provider-level discovery controls to the Edit Price Source modal.
- Extended public phone cards with priority market-status indicators:
  - PTA Approved / Non-PTA
  - Price drop
  - Out of stock
  - Verified price
  - existing upcoming, rumoured, discontinued, trending, and discount states remain available
- Stopped excluding tracker price fields from top-phone card queries so status badges can use real tracker signals.

## Verification

- Homepage targeted regression assertion: PASS
- TypeScript transpile syntax scan for all modified TS/TSX files: PASS (7/7)
- Admin production static audit: PASS
  - 55 admin pages
  - 102 literal admin API endpoints
  - no endpoint evidence missing
  - no findings
- Price source manager audit: PASS
- Price source type audit: PASS (9 source types)
- Production static audit: PASS
  - 98 pages/routes
  - 329 files scanned
  - 0 broken internal links
  - 0 unsafe relative links
  - 0 hardcoded old origins

## Environment limitation

A complete dependency build could not be executed in this sandbox because the configured internal npm mirror returns package 404 errors. The modified files passed TypeScript parser/transpile checks, and repository static audits passed. GitHub/Vercel remains the final dependency-backed build confirmation.

## Important scope note

This release provides the scalable provider-level discovery configuration and persistence foundation. Actual extraction still depends on a compatible source parser/feed/API and must obey each provider's access policy. It does not invent product URLs or bypass blocked websites.
