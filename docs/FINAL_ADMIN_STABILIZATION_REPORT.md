# PhoneDock v17.0.3 — Final Admin Stabilization

## Fixed in this package

### Bulk import persistence
- Keeps the 12 MB app-level limit scoped to import routes and `/api/admin/phones/bulk-import`.
- Uses batched `bulkWrite` operations.
- Verifies that every expected `PhoneSpecs` upsert exists after the bulk operation.
- Re-runs only missing specs upserts instead of silently reporting success.
- Returns `specsRequested`, `specsVerified`, and warnings in the import result.
- Continues to save import history, duration, imported/updated/skipped/failed totals and activity logs.

### Data Quality refresh
- The refresh button now starts a real incremental data-quality scan.
- It immediately reloads live MongoDB-backed summary counts with `no-store` caching.
- It shows an explicit success or failure status and uses the existing scan-status polling flow.
- Repeat clicks are blocked while a scan or summary refresh is running.

### Admin analytics
- Added `/admin/analytics` to the admin navigation.
- Added authenticated `/api/admin/analytics` endpoint.
- Shows internal metrics: phone views, affiliate clicks, sponsor impressions/clicks, recent reviews, contact requests, top phones and store click totals.
- Shows whether Google Analytics and Microsoft Clarity environment integrations are configured.
- Detailed visitor/session reports remain in GA4 or Clarity because PhoneDock does not store those third-party datasets locally.

## Database verification behavior
This build verifies specs writes during import against MongoDB before returning success. The Data Quality summary continues to calculate live counts from `Phone`, `PhoneSpecs`, `PhoneImage`, and price fields rather than relying only on stale issue records.

## Important platform constraint
Vercel request bodies still have a platform ceiling of roughly 4.5 MB for serverless functions. Large imports must be split into smaller files even though the application limit is 12 MB.

## Verification limitation
The source package was patched and ZIP integrity was checked. A private live MongoDB cluster and authenticated production admin session were not available in this environment, so live database mutation and every authenticated browser click could not be truthfully executed here. The included changes add runtime verification and visible error reporting so failures are no longer silent.
