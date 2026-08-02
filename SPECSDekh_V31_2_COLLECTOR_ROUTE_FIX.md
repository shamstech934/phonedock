# SpecsDekh v31.2 — Collector Route Compatibility Fix

## Fixed
- Updated stale `/admin/collector-sources` links to `/admin/collector/sources`.
- Updated stale `/admin/collector-jobs` links to `/admin/collector/jobs`.
- Added permanent application redirects for both legacy URLs so old dashboard activity links and bookmarks no longer return 404.
- Preserved the existing Collector Sources and Collector Jobs pages and APIs.

## Expected result
- `https://specsdekh.com/admin/collector-sources` redirects to `https://specsdekh.com/admin/collector/sources`.
- `https://specsdekh.com/admin/collector-jobs` redirects to `https://specsdekh.com/admin/collector/jobs`.
