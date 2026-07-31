# SpecsDekh Production Audit Fix Sprint 4

## Completed

- Implemented the legacy `POST /api/import/rollback` endpoint instead of returning HTTP 501.
- Reused the existing tracked-ID rollback engine so only phones created by the selected legacy import are removed.
- Added request validation, permission enforcement, correct 400/404/409 responses, and Activity Log recording.
- Fixed the Import V2 CSV parser condition that could never reject heavily malformed CSV files.
- Added non-fatal CSV parse warnings for partially recoverable files.
- Added a regression test covering both fixes.

## Verification

- Sprint 4 regression test: passed.
- Static production audit: 87 routes, 0 broken links, 0 unsafe relative links, 0 old origins, 0 visible legacy branding references.
- Cron configuration audit: all 5 jobs passed.

## Files changed

- `src/app/api/[[...path]]/handlers/import.ts`
- `src/lib/import/v2-parsers.ts`
- `scripts/__tests__/production-audit-sprint4.test.mjs`
