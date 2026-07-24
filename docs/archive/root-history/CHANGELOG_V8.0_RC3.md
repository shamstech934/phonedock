# PhoneDock v8.0 RC3 — Admin Operations & Data Health

## Added
- Production Data Health panel on the admin dashboard.
- Overall completeness percentage for published phone records.
- Live counts for missing prices, thumbnails, specs and image galleries.
- Direct links from dashboard health cards to relevant Data Quality queues.
- Expanded `/api/admin/stats` response with production-readiness metrics.

## Preserved
- RC1 Smart Buying Assistant.
- RC2 Accounts and Price Intelligence improvements.
- v7 production display and syntax hotfixes.

## Deployment checks
1. Open `/admin/dashboard` and confirm the health panel loads.
2. Open each issue card and confirm it links to `/admin/data-quality`.
3. Verify `/api/admin/stats` returns a `dataHealth` object for an authenticated admin.
