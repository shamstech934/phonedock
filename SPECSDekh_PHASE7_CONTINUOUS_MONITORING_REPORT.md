# SpecsDekh Phase 7 — Continuous Monitoring

Implemented a safe, review-first monitoring layer that runs manually from Admin or daily through Vercel Cron.

## Added
- Admin → Continuous Monitoring (SpecsDekh Watch Center)
- Daily bounded monitoring cron
- Persistent monitoring run history
- Launch-feed sync summary
- Pending launch-candidate alerts
- Stale draft-phone detection (14 days)
- Missing specs, images and prices counts
- Open Data Quality issue summary
- Warning/critical severity classification
- No automatic publishing and no paid AI dependency

## Environment
- `CRON_SECRET` remains required for the cron endpoint.
- `RUMOUR_FEED_URLS` supplies monitored RSS/Atom feeds.
