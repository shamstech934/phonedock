# PhoneDock Sprint 2 — Import Engine Stabilization Report

## Scope completed

This checkpoint focused on the Import Engine execution path, retry/resume persistence, browser refresh recovery, and API/UI contract mismatches.

## Verified production blockers fixed

### 1. Source rows were not persisted
The upload endpoint previously kept only preview rows. Batch execution and retry therefore had no durable server-side source after a browser refresh.

**Fix:** Added `ImportRecord`, storing each source row as a separate MongoDB document with a unique `(importId, rowNumber)` index and SHA-256 checksum. Separate documents avoid MongoDB's 16 MB document limit for large files.

### 2. Import UI sent empty batches
The UI submitted `{ records: [] }`, while the API rejected empty batches. No real import could start from the V2 page.

**Fix:** The API now loads each batch from persisted `ImportRecord` rows. The browser no longer needs to retain or resend the original file.

### 3. Batch numbering mismatch
The UI used zero-based batch numbers; the API required 1..N.

**Fix:** The UI now uses one-based batch numbers consistently.

### 4. Retry was not autonomous
The retry endpoint only returned instructions asking the browser to resend rows. This did not meet retry or refresh-recovery requirements.

**Fix:** Retry now loads persisted source rows and executes failed batches server-side.

### 5. Upload response contract mismatch
The API returned `importId`, but the UI looked for `jobId` or `id`, preventing job state initialization.

**Fix:** Upload now returns `jobId: importId` while preserving `importId` for backward compatibility.

### 6. Publish mode mismatch
The UI sent `review_queue`; the API accepted `review`.

**Fix:** Both now use `review`.

### 7. createMissingBrands was not persisted
The UI submitted this setting, but the config endpoint ignored it.

**Fix:** The config endpoint now validates and persists the boolean.

### 8. Idempotency did not verify source integrity
A completed batch replay could return the previous result without comparing the new source checksum.

**Fix:** Completed-batch replay now rejects checksum mismatches.

### 9. Total batch count excluded invalid source rows
The upload endpoint calculated batches from `validCount`, while processing counters included invalid rows.

**Fix:** Every source row now belongs to exactly one batch; total batches are calculated from total normalized rows.

## Files added

- `src/lib/models/ImportRecord.ts`
- `scripts/__tests__/sprint2-import-persistence.test.ts`

## Files modified

- `src/lib/models/index.ts`
- `src/app/api/[[...path]]/handlers/import-v2.ts`
- `src/lib/import/import-v2-engine.ts`
- `src/app/admin/import-v2/page.tsx`
- `package.json`

## Verification performed

- `npm run typecheck` — PASS
- `npm run lint` — PASS with existing warnings, zero errors
- `npm test` — PASS
  - Existing stabilization checks: 40/40
  - New Sprint 2 persistence/contract checks: 10/10

## Important limitation

These checks verify compilation, static contracts, and project test logic. A real MongoDB-backed import of 100, 1000, and 8276+ rows is still required before declaring the Import Engine production-ready. That validation needs an isolated MongoDB test database and runtime environment.

## Remaining Sprint 2 work

- MongoDB-backed integration tests for create/update/replace/skip
- Transaction and partial-write failure tests
- Rollback verification against real Phone/PhoneSpecs documents
- Resume after process termination
- Data Quality scanner persistence and memory audit
- Cleanup policy for old `ImportRecord` source documents
