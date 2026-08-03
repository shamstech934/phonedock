# PhoneDock Phase 2 — Data Quality Live Counts Fix

## Root cause
The overview total included the complete phone inventory, but Missing Specs, Missing Images and Missing Prices only inspected published phones. Draft/pending imports therefore disappeared from the queues and the cards incorrectly returned zero.

## Fixes
- Unified Data Quality scope: published + draft + pending.
- Excluded archived and soft-deleted records.
- Missing Specs now reads live PhoneSpecs relationships across the complete working catalog.
- Missing Images now flags either a missing thumbnail or a missing PhoneImage gallery record.
- Missing Prices now checks every working-catalog phone for a valid positive PKR price.
- Stale Prices now reads live `lastPriceCheckedAt` values instead of depending only on previously generated issue rows.
- Health score now uses the same scope as the overview cards.
- Missing-data queue tabs and CSV exports now use the same scope.
- Full Scan and Dry Run now display API errors instead of silently doing nothing.
- Added a visible scope explanation to the overview.
- Added `scripts/data-quality-live-counts-audit.mjs`.

## Verification
- Data Quality live-count regression audit: 6/6 passed.
- Full dependency build could not run in this sandbox because dependencies are not installed. `runtime-doctor` correctly reported missing packages rather than a source-code assertion failure.

## Expected result for the screenshot dataset
With 589 working phones, 480 linked PhoneSpecs records and 109 Draft/Review records, Missing Specs should no longer incorrectly display zero. The exact result remains database-driven and may differ if some draft records already have linked specs.
