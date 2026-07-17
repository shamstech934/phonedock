---
Task ID: 1
Agent: main
Task: Price Tracker V1 — gap analysis, permissions fix, cache revalidation, build verification

Work Log:
- Inspected entire existing Price Tracker codebase: 3 models (PriceSource, PhoneRetailListing, PriceTrackerHistory), Phone model extensions, admin 7-tab UI, full API handler (18 endpoints), cron handler, public price history graph
- Identified 3 critical gaps: (1) `prices:read`/`prices:edit` permissions missing from permission system, (2) no targeted cache revalidation, (3) phone-form already had price tracking fields
- Added `prices:read` and `prices:edit` to Permission type, ALL_PERMISSIONS array, and role assignments (superadmin+admin: both, editor+reviewer: read only)
- Created `src/lib/revalidate.ts` with `revalidatePricePages(slug?)` for targeted revalidation of 9 global paths + phone-specific path
- Integrated revalidation into: cron handler (batch slug collection + dedup), manual price update, review approval, direct approval, phone edit form
- Verified phone-form component exists at `src/components/admin/phone-form/` with Price Tracking section (priceMode, manualLock, manualLockReason, priceSourceUrl)
- TypeScript typecheck: 0 errors
- Next.js build: compiled successfully, 43/43 static pages generated
- Created PRICE_TRACKER_VERSION1_REPORT.md with full architecture documentation

Stage Summary:
- Price Tracker V1 was ~90% pre-implemented. This session fixed the critical permission gap, added targeted cache revalidation (the main missing feature), and verified the build.
- Files created: src/lib/revalidate.ts, PRICE_TRACKER_VERSION1_REPORT.md
- Files modified: src/lib/permissions.ts, src/app/api/[[...path]]/handlers/price-tracker.ts, src/app/api/[[...path]]/handlers/cron-update-prices.ts, src/app/api/[[...path]]/handlers/admin-crud.ts