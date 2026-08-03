# SpecsDekh v31.9.1 — Consolidated Admin Fix Report

Base: user-uploaded `phonedock-main(4).zip`.

## Manage Phones
- Inventory statistic cards are actionable.
- Draft / Review opens both `draft` and `pending` records.
- Published, Upcoming, Trending, Featured, PTA Approved, and Total cards apply working filters.
- Unknown PTA filter is implemented in the API.
- Complete filtered inventory CSV export is available.
- Fixed an accidental duplicated `fetch()` statement in bulk updates.

## Data Quality Center
- Summary and live repair queues cover published plus draft/review inventory.
- Missing specs, images, and prices no longer hide unpublished records.
- Health score uses the full working inventory and separates deductions by publication, specs, images, prices, and verification.
- Queue rows show Published or Draft / Review state.
- CSV repair exports cover the same full working inventory.

## Existing Production Modules Verified
- Collector Phase 2 audit: 7/7 passed.
- Price Tracker Phase 3 audit: 8/8 passed.
- Admin endpoint audit: 55 pages, 101 API endpoints, no missing endpoint evidence.
- Static audit: 98 routes, 0 broken internal links.

## Environment limitation
A complete local `npm install` / Next.js build could not run because the provided internal npm mirror returns 404 for `zod-validation-error@4.0.2`. GitHub Actions or Vercel remains the authoritative full build check.
