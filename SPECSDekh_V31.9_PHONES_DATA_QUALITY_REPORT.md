# SpecsDekh v31.9.0 — Phones & Data Quality Production Pass

## Fixed in this release

### Manage Phones
- Dashboard statistic cards now open their matching live list.
- **Draft / Review** includes both `draft` and `pending` records, matching the displayed total.
- Published, Upcoming, Trending, Featured and PTA Approved cards apply their correct filters.
- Unknown PTA filtering is implemented in the backend.
- Current filtered phone inventory can be downloaded as CSV, across all result pages.
- All existing search, sorting, pagination, bulk actions, editing and deletion flows are preserved.

### Data Quality Center
- Quality counts now cover the full working inventory: Published plus Draft / Review.
- Published-only gaps remain visible separately so live-site health is not confused with draft readiness.
- Missing Specs, Missing Images and Missing Prices live queues now include Draft / Review records.
- Complete key-spec and linked-spec counts are calculated from unique phone relationships.
- Health scoring now accounts for the working inventory rather than hiding incomplete drafts.
- Queue rows display whether a phone is Published or Draft / Review.
- Existing scan, dry run, cleanup, CSV work-pack, repair and auto-match workflows are preserved.

## Verification completed
- Production static audit: 98 routes, 0 broken internal links.
- Collector Phase 2 audit: 7/7 passed.
- Price Tracker Phase 3 audit: 8/8 passed.
- Admin API evidence audit: 55 pages, 101 literal endpoints, 0 missing endpoint evidence.
- Phones & Data Quality focused audit: 9/9 passed.

## Environment limitation
A complete dependency install/build could not run in this workspace because the internal npm mirror returns 404 for `zod-validation-error@4.0.2`. GitHub Actions/Vercel remains the authoritative full TypeScript and production-build verification.
