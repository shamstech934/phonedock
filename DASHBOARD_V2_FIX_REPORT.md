# SpecsDekh Dashboard V2 — Production Data Fix

## Fixed

- Dashboard health score now includes missing gallery records.
- Specs and gallery counts are restricted to published phone IDs, so unrelated/orphan records cannot inflate the dashboard.
- Published, Draft/Review, Upcoming and PTA Approved live counters were added.
- Average price is rounded and calculated only from active published phones with a positive price.
- Price distribution now uses named database buckets and preserves zero-count ranges correctly.
- Recent Activity converts automation JSON logs into readable summaries instead of displaying raw JSON.
- Dashboard API requests use the shared safe response reader and no-store caching.
- Retry uses the same safe dashboard loader.

## Health formula

Overall completeness now measures four checks across published phones:

1. Positive PKR price
2. Thumbnail
3. Linked specs document
4. Linked gallery/image record

A missing gallery therefore reduces the score instead of showing a misleading 100%.

## Verification

- Modified TS/TSX files passed TypeScript syntax/transpile validation.
- Full dependency-aware Next.js build must run in GitHub/Vercel because this archive does not include node_modules.
