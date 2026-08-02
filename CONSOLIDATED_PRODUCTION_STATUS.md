# SpecsDekh 30.0 — Consolidated Production Stabilization

This release consolidates the latest working source and focuses on deployability rather than adding new UI features.

## Runtime hardening
- Shared API response reader accepts typed responses while remaining backward-compatible with older admin pages.
- HTML, plain-text, malformed JSON, authentication and Vercel error responses are converted into readable errors.
- Explicitly typed callers continue to receive strict response shapes.

## Existing production systems retained
- Import V2 identity, variant matching, rollback and reconciliation flows.
- Price Tracker, Collector, Launch, Specs, Image, Pakistan and YouTube review-first automation.
- SEO sitemaps, robots, Bing verification, IndexNow and GA4 runtime.
- Public catalogue sorting, smart filters, brand/logo normalization and mobile layout fixes.

## Release checks executed in this workspace
- Static route/link audit.
- API payload migration audit.
- Intelligence suite audit.
- Import V2 recovery audit.
- SEO, GA4, cron, price-source and source-type audits.

A full Next.js dependency build must still run in GitHub/Vercel because this workspace's internal npm mirror does not contain all public npm tarballs.
