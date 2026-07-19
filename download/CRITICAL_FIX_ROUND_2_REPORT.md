# CRITICAL FIX ROUND 2 REPORT

## Overview

12 critical production bugs identified during enterprise code audit of the Import Engine V2 system. All fixes applied, verified with TypeScript compilation, ESLint (0 errors), Next.js build, and 39 automated tests.

---

## FIX #1 — ImportBatch Metadata Not Persisted

**Root Cause:** `processBatch()` created/updated `ImportBatch` via `findOneAndUpdate` with `upsert: true` but never set `recordStart`, `recordEnd`, `recordCount`, or `checksum`. The API handler calculated a checksum but never passed it to `processBatch()`.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — `BatchProcessInput` interface extended with `checksum`, `recordStart`, `recordEnd`, `batchSize`. `processBatch()` now calculates and persists all metadata on batch creation.
- `src/app/api/[[...path]]/handlers/import-v2.ts` — `handleImportV2Batch()` calculates `recordStart`, `recordEnd`, and `checksum` before calling `processBatch()`.

**Before:** `ImportBatch.findOneAndUpdate({ importId, batchNumber }, { $set: { status: 'processing' } }, { upsert: true })` — no metadata.

**After:** Full metadata persisted: `recordStart`, `recordEnd`, `recordCount`, `checksum`, `executionMode` all set on initial upsert.

**Test:** `FIX #1a: recordStart/recordEnd calculated from batchNumber+batchSize` — PASSED
**Test:** `FIX #1b: checksum is deterministic` — PASSED

**Remaining Limitation:** Batch payloads (the actual record data) are not persisted in ImportBatch — the client must re-send records on retry (batch metadata tells them which rows).

---

## FIX #2 — Retry Broken for Records After Row 50

**Root Cause:** `ImportJob.previewData` stores only the first 50 records (`normalized.slice(0, 50)`). The retry handler used `job.previewData.slice(batch.recordStart - 1, batch.recordEnd)` which returned undefined for any batch starting after row 50.

**Files Modified:**
- `src/app/api/[[...path]]/handlers/import-v2.ts` — `handleImportV2Retry()` now returns batch metadata (`recordStart`, `recordEnd`, `recordCount`) so the client can re-send the correct records. Failed batches are marked as `retrying` and the job status is reset to `processing`.

**Before:** Retry sliced from `job.previewData` (max 50 rows) — impossible to retry batch 26 (rows 5001-5200).

**After:** Retry returns `{ recordStart, recordEnd, recordCount }` for each failed batch. Client re-submits via the batch endpoint.

**Test:** `FIX #2a: Batch 26 metadata covers rows 5001-5200` — PASSED
**Test:** `FIX #2b: Final batch (42 of 8276) covers correct rows` — PASSED

**Remaining Limitation:** The client must retain the original source data to re-send records. A future enhancement could store batch payloads in a staging collection.

---

## FIX #3 — Dry-Run Batches Block Real Import

**Root Cause:** `completeBatch()` marked `ImportBatch` status as `completed` even for dry-run batches. The idempotency check `ImportBatch.findOne({ importId, batchNumber, status: 'completed' })` would match a dry-run batch and skip the real import.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — Idempotency check now includes `executionMode: 'real'`. `completeBatch()` stores `executionMode: 'dry_run' | 'real'`. Dry-run batches never update job counters.
- `src/lib/models/ImportBatch.ts` — Added `executionMode` field with enum `['dry_run', 'real']`.

**Before:** `findOne({ importId, batchNumber, status: 'completed' })` — dry-run blocks real.

**After:** `findOne({ importId, batchNumber, status: 'completed', executionMode: 'real' })` — dry-run and real are separate.

**Test:** `FIX #3a: executionMode dry_run vs real query is different` — PASSED
**Test:** `FIX #3b: Real batch matches idempotency check` — PASSED
**Test:** `FIX #3c: Dry-run does not persist phone IDs` — PASSED

**Remaining Limitation:** None.

---

## FIX #4 — Duplicate Estimation Invalid

**Root Cause:** Both `estimateDuplicates()` and `updateDuplicateEstimate()` called `checkDuplicate({ brand: '', model: '', slug: '', specs: {} }, index)` with empty objects, making all estimates meaningless.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — Both functions now pass actual normalized record data (brand, model, slug, specs) to `checkDuplicate()`. Added safe division guard for empty samples. Added `estimateType` field ('exact' | 'sampled' | 'pending').

**Before:** `checkDuplicate({ brand: '', model: '', slug: '', specs: {} }, index)` — always empty.

**After:** `checkDuplicate({ brand: d.brand, model: d.model, slug: d.slug, specs: d.specs }, index)` — real data.

**Test:** `FIX #4a: Uses actual brand+model, not empty strings` — PASSED
**Test:** `FIX #4b: Safe division with empty sample` — PASSED
**Test:** `FIX #4c: Extrapolation correct for sampled estimation` — PASSED

**Remaining Limitation:** Estimation is still sample-based for large imports (up to 2000 keys). The `estimateType` field now clearly indicates this.

---

## FIX #5 — Config Batch Calculation Broken

**Root Cause:** `handleImportV2Config()` selected only `totalBatches` but then used `job.totalRecords` (which was not selected, so undefined). `Math.ceil(undefined / batchSize)` = NaN = 0 batches.

**Files Modified:**
- `src/app/api/[[...path]]/handlers/import-v2.ts` — Config handler now selects `totalBatches totalRecords status`. Returns 404 for nonexistent jobs. Validates `batchSize` is integer in [50, 500]. Removed `upsert: true` — uses plain `findOneAndUpdate`. Rejects configuration when job is not in `ready` or `parsing` state.

**Before:** `.select('totalBatches').lean()` then `job.totalRecords` (undefined).

**After:** `.select('totalBatches totalRecords status').lean()` with proper validation.

**Test:** `FIX #5a: totalRecords selected, recalc correct` — PASSED
**Test:** `FIX #5b: Invalid batchSize rejected` — PASSED
**Test:** `FIX #5c: No upsert in config endpoint` — PASSED

**Remaining Limitation:** None.

---

## FIX #6 — Batch Handler Ignores Saved Job Configuration

**Root Cause:** `handleImportV2Batch()` trusted request body values for `duplicateMode`, `dryRun`, `publishMode`, `createMissingBrands`. A client could send different values than what was saved on the ImportJob.

**Files Modified:**
- `src/app/api/[[...path]]/handlers/import-v2.ts` — Batch handler now loads the full job config from DB. Validates job exists (404), is in allowed state (400), `batchNumber` is in `[1..totalBatches]` (400), and records don't exceed `batchSize` (400). Uses only saved job config for all import settings.

**Before:** `duplicateMode: body.duplicateMode || 'skip'` — trusts client.

**After:** Loads job, uses `job.duplicateMode`, `job.dryRun`, etc. — server authoritative.

**Test:** `FIX #6a: batchNumber validated against totalBatches` — PASSED
**Test:** `FIX #6b: Records exceeding batch size rejected` — PASSED
**Test:** `FIX #6c: Job config overrides request body` — PASSED

**Remaining Limitation:** None.

---

## FIX #7 — Incorrect HTTP Error Response

**Root Cause:** The batch catch block returned `{ success: false, error: ..., status: 500 }` in the JSON body but used `NextResponse.json(payload)` without `{ status: 500 }`, resulting in HTTP 200.

**Files Modified:**
- `src/app/api/[[...path]]/handlers/import-v2.ts` — All error responses now use `NextResponse.json(body, { status: N })` with proper HTTP status codes (400, 404, 413, 500). Audited all Import V2 and Data Quality endpoints.

**Before:** `NextResponse.json({ success: false, error: ..., status: 500 })` — HTTP 200.

**After:** `NextResponse.json({ success: false, error: ... }, { status: 500 })` — HTTP 500.

**Test:** `FIX #7a: Error response uses HTTP status option` — PASSED
**Test:** `FIX #7b: Proper 404, 400, 500 mapping` — PASSED

**Remaining Limitation:** None.

---

## FIX #8 — Rollback Does Not Restore PhoneSpecs

**Root Cause:** Update/replace modes modified `PhoneSpecs` but `fieldChanges` only tracked `Phone` document fields. Rollback restored phone fields but left specs modified.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — Added `specsChanges` array to `BatchResult`. Tracks `beforeFields` and `afterFields` for updated specs, and `changeType: 'created'` for upserted specs. Rollback now restores updated specs and deletes created specs.
- `src/lib/models/ImportBatch.ts` — Added `specsChanges` subdocument array with `phoneId`, `collection`, `changeType`, `beforeFields`, `afterFields`, `fields`.

**Before:** `fieldChanges` only had `{ phoneId, field, oldValue, newValue }` for Phone fields.

**After:** `specsChanges` tracks `PhoneSpecs` changes with before/after state. Rollback restores or deletes as appropriate.

**Test:** `FIX #8a: specsChanges tracks before/after state` — PASSED
**Test:** `FIX #8b: Manual edit conflict detected` — PASSED
**Test:** `FIX #8c: No conflict when unchanged` — PASSED
**Test:** `FIX #8d: Created PhoneSpecs tracked for deletion` — PASSED

**Remaining Limitation:** Rollback conflict detection for specs is field-by-field; if a spec was deleted and recreated by the import, conflict detection may not apply.

---

## FIX #9 — Counters Become Incorrect on Partial Write Failures

**Root Cause:** `result.updated++` happened before `Phone.updateOne()`. If the update failed, the counter still reported the phone as updated. Specs failures were only logged to console.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — Phone updates now use a `updateSuccessCount` that only increments after `res.modifiedCount > 0`. Specs failures are pushed to `result.errors` with `errorCode: 'SPECS_UPDATE_FAILED'`. Added `reconcileJobCounters()` that aggregates actual batch results from DB before final completion.

**Before:** `result.updated++` before `await Phone.updateOne()`.

**After:** Count updated after successful write. Specs failures recorded in batch errors.

**Test:** `FIX #9a: Only successful writes increment counter` — PASSED
**Test:** `FIX #9b: Specs failures in batch errors` — PASSED
**Test:** `FIX #9c: Reconciliation from batch totals` — PASSED

**Remaining Limitation:** Reconciliation runs after each batch, which adds one extra aggregation query per batch.

---

## FIX #10 — Batch Completion Must Not Rely Only on Batch Number

**Root Cause:** `completeBatch()` used `batchNumber >= job.totalBatches` to determine completion. This marked the job as complete even when earlier batches were missing/pending/failed.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — `completeBatch()` now aggregates ALL batch statuses for the import. Counts completed, failed, pending, processing, retrying. Checks for missing batch numbers. Only marks complete when every expected batch has a terminal status and no batches are missing.

**Before:** `const isComplete = batchNumber >= job.totalBatches;`

**After:** Checks all batch statuses via aggregation + distinct batch numbers. Missing batches prevent completion.

**Test:** `FIX #10a: Missing batch prevents completion` — PASSED
**Test:** `FIX #10b: Out-of-order execution safe` — PASSED
**Test:** `FIX #10c: completed_with_errors when any batch failed` — PASSED

**Remaining Limitation:** The aggregate query adds overhead for imports with many batches.

---

## FIX #11 — Cancel and Rollback Validation

**Root Cause:** `cancelJob()` blindly called `findOneAndUpdate` without checking if the job exists or if its status allows cancellation. Rollback dry-run accessed `job.fileName` without null check.

**Files Modified:**
- `src/lib/import/import-v2-engine.ts` — `cancelJob()` now returns `{ success, error }`. Returns error for nonexistent jobs (404). Defines `CANCEL_ALLOWED_FROM` states. Marks in-progress batches as failed. `rollbackJob()` validates existence and state (`ROLLBACK_ALLOWED_FROM`). Returns structured result with error field.
- `src/app/api/[[...path]]/handlers/import-v2.ts` — Cancel and rollback handlers now check return values and map to proper HTTP status codes.

**Before:** `await ImportJob.findOneAndUpdate({ importId }, { $set: { status: 'cancelled' } })` — no validation.

**After:** Job existence and state checked. Proper 404/400 responses. Idempotent.

**Test:** `FIX #11a: Cancel 404 for nonexistent job` — PASSED
**Test:** `FIX #11b: Cancel blocked for invalid states` — PASSED
**Test:** `FIX #11c: Rollback blocked for processing/dry-run` — PASSED
**Test:** `FIX #11d: Cancel marks in-progress batches failed` — PASSED

**Remaining Limitation:** None.

---

## FIX #12 — CSV Generation Must Escape Correctly

**Root Cause:** `errors.csv` joined fields using `r.join(',')` without quoting commas, quotes, or newlines per RFC 4180.

**Files Modified:**
- `src/app/api/[[...path]]/handlers/import-v2.ts` — Added `escapeCsvField()` function implementing RFC 4180: doubles quotes, quotes fields containing commas/quotes/newlines, preserves formula-injection protection.

**Before:** `rows.map(r => r.join(',')).join('\n')` — no escaping.

**After:** Each field processed through `escapeCsvField()` before joining.

**Test:** `FIX #12a: Commas quoted` — PASSED
**Test:** `FIX #12b: Quotes doubled` — PASSED
**Test:** `FIX #12c: Newlines quoted` — PASSED
**Test:** `FIX #12d: Formula injection protected` — PASSED
**Test:** `FIX #12e: Simple values not quoted` — PASSED
**Test:** `FIX #12f: Unicode handled` — PASSED
**Test:** `FIX #12g: Empty string handled` — PASSED

**Remaining Limitation:** None.

---

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | 0 errors |
| ESLint (`eslint .`) | 0 errors, 1106 warnings (pre-existing no-explicit-any) |
| Next.js Build (`next build`) | PASSED |
| Tests (`critical-fix-round2.test.ts`) | 39/39 PASSED |

---

## Fix Matrix

| Issue | Fixed | Automated Test | Result |
|-------|-------|----------------|--------|
| #1 ImportBatch metadata | Yes | FIX #1a, #1b | PASSED |
| #2 Retry after row 50 | Yes | FIX #2a, #2b | PASSED |
| #3 Dry-run blocking | Yes | FIX #3a, #3b, #3c | PASSED |
| #4 Duplicate estimation | Yes | FIX #4a, #4b, #4c | PASSED |
| #5 Config batch calc | Yes | FIX #5a, #5b, #5c | PASSED |
| #6 Batch handler config | Yes | FIX #6a, #6b, #6c | PASSED |
| #7 HTTP status codes | Yes | FIX #7a, #7b | PASSED |
| #8 Rollback PhoneSpecs | Yes | FIX #8a, #8b, #8c, #8d | PASSED |
| #9 Counter correctness | Yes | FIX #9a, #9b, #9c | PASSED |
| #10 Job completion | Yes | FIX #10a, #10b, #10c | PASSED |
| #11 Cancel/rollback validation | Yes | FIX #11a, #11b, #11c, #11d | PASSED |
| #12 CSV escaping | Yes | FIX #12a–#12g | PASSED |

---

## Files Modified Summary

1. `src/lib/import/import-v2-engine.ts` — Complete rewrite with all engine fixes
2. `src/lib/models/ImportBatch.ts` — Added `executionMode`, `specsChanges` fields
3. `src/app/api/[[...path]]/handlers/import-v2.ts` — Complete rewrite with all handler fixes
4. `scripts/__tests__/critical-fix-round2.test.ts` — 39 automated tests (new file)