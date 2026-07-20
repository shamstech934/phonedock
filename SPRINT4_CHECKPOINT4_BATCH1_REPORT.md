# Sprint 4 — Checkpoint 4 — Batch 1

## Security foundation

- Added same-origin protection for privileged state-changing API requests.
- Blocks browser requests explicitly marked `Sec-Fetch-Site: cross-site`.
- Validates the `Origin` header against the current deployment origin and configured app URL.
- Added request body limits: 1 MB normally and 12 MB for import/upload endpoints.
- Added production-safe security error responses with `Cache-Control: no-store` and `nosniff`.
- Protection is centralized across POST, PUT, and DELETE handlers so new privileged routes inherit it automatically.

## Compatibility

- Public contact, reviews, newsletter, and price-alert submissions remain supported.
- Non-browser/server clients that legitimately omit `Origin` remain supported.
- Import routes retain a larger upload allowance.
- No database migration or environment-variable change is required.
