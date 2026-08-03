# PhoneDock Phase 2.4 — Price Tracking Engine

## Fixed
- Price Tracker Phones API now returns every active published phone, including phones with zero price or no retailer listing.
- API response now matches the admin UI contract (`phoneId`, `phoneName`, `mode`, `source`, `lastUpdated`, status).
- Retail listing/source state is joined into the catalog so linked, unlinked, pending and verified phones are distinguishable.
- Overview now reports unlinked published phones instead of showing a misleading zero source-gap count.
- Run Sync refreshes Overview, Phones, Sources, Changes and Pending Review together.
- Auto-link refreshes Overview, Phones, Sources and Source Gaps together.
- Empty phone state now means filters returned no published phones; it no longer incorrectly says the database has no tracker records.

## Existing production engine verified
- Trusted-source allowlist and product URL safety validation.
- Bounded batches (maximum 50 per serverless invocation).
- Distributed cron lock.
- Exponential retry queue and failed listing/source recovery.
- Price history, lowest/highest/current/previous price updates.
- Automatic review threshold and manual-lock protection.
- Shared engine for Vercel cron and Admin Run Sync.

## Important operational rule
Auto-link cannot invent retailer product URLs. All published phones are now visible, but automatic monitoring becomes active only after a genuine product URL from a tested/trusted source is attached through imported PhonePrice/sourceUrl data or the Add Listing workflow.

## Verification
Run: `npm run audit:price-tracker-2.4`
Result in this package: 12/12 checks passed.
