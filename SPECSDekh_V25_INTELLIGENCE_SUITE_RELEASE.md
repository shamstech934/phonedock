# SpecsDekh v25.0 — Intelligence Suite & Final Production Audit

This release consolidates the remaining production modules into one review-first package.

## Specs Intelligence
- Detects missing display, chipset, RAM, storage, battery, camera and 5G fields.
- Uses only the local DeviceSpecDataset for recommendations.
- Applies a recommendation only after an authorized admin approves it.
- Never overwrites populated data unless an explicit force review is sent.
- Bounded scan: 200 phones by default, hard cap 500.

## Price Intelligence V2
- Detects missing trusted Pakistan retailer coverage.
- Detects stale listing checks, large retailer price spreads and missing price history.
- Recommends the lowest available verified price from enabled trusted sources.
- Preserves manual locks and writes confirmed PriceTrackerHistory on approval.
- Never changes a public price automatically.

## YouTube Intelligence
- Uses the configured YouTube channel sync already present in the project.
- Classifies reviews, unboxings, comparisons, shorts, tutorials and news.
- Suggests phone links only when matching is sufficiently specific.
- Keeps synced videos pending until an admin applies the recommendation.
- No paid AI dependency.

## Final production audit
- Adds `npm run audit:intelligence-suite`.
- Verifies pages, handlers, models, API wiring and admin navigation.
- Confirms bounded scans and review-only behavior.
- Included in both `release:gate` and `ci:release`.

## Required environment variables
YouTube sync remains optional. To enable it, configure:
- `YOUTUBE_API_KEY`
- `YOUTUBE_CHANNEL_ID`

No new paid AI key is required.
