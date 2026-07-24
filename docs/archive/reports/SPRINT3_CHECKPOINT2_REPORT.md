# Sprint 3 — Production Hardening Checkpoint 2

## Scope
Database/API input hardening and import boundary validation. This checkpoint does not declare PhoneDock production-ready.

## Verified fixes

1. **Import capacity mismatch fixed**
   - Shared import record limit increased from 5,000 to 20,000 so the documented 8,276-row dataset is accepted.
   - V2 rejects files above the configured maximum before durable job creation.

2. **Import file validation hardened**
   - V2 now validates extensions and non-empty MIME types.
   - Unsupported formats return HTTP 415; oversized record sets return HTTP 413.

3. **Admin phone query validation hardened**
   - Invalid `brandId` values now return HTTP 400 instead of reaching Mongoose casting.
   - Non-finite or negative price filters are rejected.
   - `minPrice > maxPrice` is rejected.

4. **Session TTL corrected**
   - Expired AdminSession documents are now eligible for deletion at `expiresAt`, rather than one hour later.

## Verification
- `npm run typecheck`: passed
- `npm run lint`: passed with 0 errors (495 pre-existing warnings remain)
- Existing tests: 61 passed
- Checkpoint 2 static regression checks: 8 passed
- Total scripted checks: 69 passed

## Remaining blockers
- Database-backed integration testing against isolated MongoDB
- Import rollback/retry/resume runtime validation
- Data Quality Center deep audit
- Dependency vulnerability remediation
- Full production build and E2E execution in an unrestricted environment
