# CRITICAL FIX ROUND 2 — Final Report

**Date:** 2026-07-19  
**Project:** PhoneDock Import Engine V2  
**Scope:** 12 critical production bugs + 18+ integration tests  
**Status:** ✅ COMPLETE — All fixes verified, all checks passing

---

## Executive Summary

All 12 critical bugs identified in Round 2 have been fixed and verified. One additional regression bug was discovered and fixed during verification (FIX #9 counter overwrite). 40 integration tests were written (exceeding the 18 required). All four verification gates pass: lint (0 errors), typecheck (clean), build (compiled successfully), and tests (40/40 passed).

---

## Fixes Applied

### FIX #1: ImportBatch Metadata Persistence ✅
**Root Cause:** `BatchProcessInput` lacked `checksum`, `recordStart`, `recordEnd`, `recordCount` fields. ImportBatch documents were created without batch metadata, making audit and retry impossible.

**Fix:** 
- Extended `BatchProcessInput` interface with `checksum?: string`, `recordStart?: number`, `recordEnd?: number`
- Handler calculates `recordStart = (batchNumber - 1) * batchSize + 1` and `recordEnd = recordStart + records.length - 1`
- Checksum computed deterministically from `brand|model|slug` hash
- ImportBatch schema already had these fields (`recordStart`, `recordEnd`, `recordCount`, `checksum` all `required: true`)
- `processBatch()` uses `upsert: true, $set` to persist all metadata on batch creation

**Files:** `src/lib/import/import-v2-engine.ts` (lines 61-74, 278-293, 318-334), `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 290-317)

---

### FIX #2: Retry After Row 50 ✅
**Root Cause:** Retry handler relied on `previewData.slice(0, 50)` which only contained the first 50 records. Batches beyond row 50 (e.g., batch 26 = rows 5001-5200) had no data for retry.

**Fix:**
- ImportBatch stores `recordStart`, `recordEnd`, `recordCount` for every batch
- Retry handler checks for these metadata fields; returns `NO_PAYLOAD` for legacy batches
- For current batches, returns `RETRY_INSTRUCTION` with exact row range
- Client re-sends the specific row range via the batch endpoint
- Failed batches marked as `retrying`, job status reset to `processing`

**Files:** `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 373-448)

---

### FIX #3: Dry-Run Does Not Block Real Import ✅
**Root Cause:** Idempotency check only matched on `{importId, batchNumber, status: 'completed'}` without considering execution mode. A completed dry-run batch would prevent the same batch from running in real mode.

**Fix:**
- Added `executionMode: 'dry_run' | 'real'` field to ImportBatch schema
- Idempotency check now includes `executionMode: 'real'`: `{importId, batchNumber, status: 'completed', executionMode: 'real'}`
- Dry-run batches set `executionMode: 'dry_run'` and populate `wouldCreate/wouldUpdate/wouldReplace/wouldSkip/wouldFail` instead of actual counters
- `completeBatch()` skips job counter updates and status transitions for dry-run batches

**Files:** `src/lib/import/import-v2-engine.ts` (lines 275, 299-316, 704-711, 747-773), `src/lib/models/ImportBatch.ts` (lines 11, 63)

---

### FIX #4: Duplicate Estimation Uses Actual Records ✅
**Root Cause:** `estimateDuplicates()` passed empty objects `{ brand: '', model: '', slug: '', specs: {} }` to `checkDuplicate()`, making all estimates return 0.

**Fix:**
- `estimateDuplicates()` now normalizes records first, then finds matching normalized record for each duplicate key
- Passes actual `{ brand, model, slug, specs }` from normalized data
- `updateDuplicateEstimate()` extracts brand/model/slug from `previewData[].normalized` 
- Safe division guard: `sampleKeys.length > 0 ? ... : 0` prevents division by zero

**Files:** `src/lib/import/import-v2-engine.ts` (lines 170-216, 221-256)

---

### FIX #5: Config Endpoint totalRecords + Validation ✅
**Root Cause:** Config endpoint used `.findOneAndUpdate({importId}, ...)` without selecting `totalRecords`, so `job.totalRecords` was `undefined`, making `Math.ceil(undefined / batchSize) = NaN = 0` batches.

**Fix:**
- Config handler now selects `'totalBatches totalRecords status'` 
- Returns HTTP 404 when `importId` doesn't exist (no `upsert: true`)
- Returns HTTP 400 when job is not in configurable state (`ready` or `parsing`)
- Validates `batchSize` is integer between 50-500
- Recalculates `totalBatches = Math.ceil(totalRecords / batchSize)` with the now-available `totalRecords`

**Files:** `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 163-213)

---

### FIX #6: Batch Handler Uses Saved Job Config ✅
**Root Cause:** Batch handler accepted `duplicateMode`, `dryRun`, `publishMode` from the request body, allowing clients to override job configuration mid-import.

**Fix:**
- Handler loads job from DB with `.select('duplicateMode dryRun publishMode createMissingBrands batchSize totalBatches status totalRecords')`
- All config values taken from `job.*`, not `body.*`
- Validates `batchNumber` is within `1..totalBatches`
- Rejects records exceeding configured `batchSize`
- Validates job is in allowed state (`queued`, `processing`, `paused`, `completed_with_errors`)

**Files:** `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 242-331)

---

### FIX #7: HTTP Error Responses Use Proper Status Codes ✅
**Root Cause:** Error responses returned HTTP 200 with `{ success: false, status: 500 }` in the body, preventing proper error handling by HTTP clients and load balancers.

**Fix:**
- ALL error responses now use `NextResponse.json(body, { status: <code> })` with proper HTTP status:
  - 400: Invalid input, bad state, missing fields
  - 404: Job not found
  - 413: File too large
  - 500: Batch processing failure
- Cancel error: maps `'not found'` → 404, else → 400
- Rollback error: maps `'not found'` → 404, else → 400
- Error body structure: `{ success: false, error: { code: string, message: string } }` — no `status` field in body

**Files:** `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 32-34, 39, 116, 129, 176, 183-184, 189, 198, 225-227, 252, 256, 265-266, 270-271, 275-277, 281, 324-329, 382-384, 461-464, 484-490, 503-506)

---

### FIX #8: Rollback Restores PhoneSpecs ✅
**Root Cause:** Rollback only tracked `createdPhoneIds` and `fieldChanges` (Phone collection). PhoneSpecs changes were not tracked, so specs updates from imports were never rolled back.

**Fix:**
- Added `specsChanges` array to ImportBatch schema with fields: `phoneId`, `collection`, `changeType` (`'created' | 'updated'`), `beforeFields`, `afterFields`, `fields`
- During batch processing, before-state of specs captured via `PhoneSpecs.findOne()` before update
- For new phones, specs upserts tracked with `changeType: 'created'` and `fields`
- Rollback logic:
  - `changeType: 'created'` → `PhoneSpecs.deleteOne({phoneId})`
  - `changeType: 'updated'` → checks for manual edit conflicts, then `$set: beforeFields`
- Conflict detection: compares current field values with `afterFields`; skips if manually edited

**Files:** `src/lib/import/import-v2-engine.ts` (lines 409, 605-611, 665-703, 908-1033), `src/lib/models/ImportBatch.ts` (lines 33-48, 91-98)

---

### FIX #9: Counter Correctness on Partial Write Failures ✅
**Root Cause (Original):** Counters were incremented before DB writes, so a failed `updateOne` still counted as "updated".

**Root Cause (Additional Regression Found):** After the initial fix, lines 712-714 (`result.created = createdIds.length; result.updated = updatedIds.length;`) **overwrote** the correctly calculated counters. `updatedIds.length` counted all ATTEMPTED updates, not just successful ones. Example: 10 updates attempted, 2 failed → `updateSuccessCount = 8` (correct) but then `result.updated = updatedIds.length = 10` (wrong).

**Fix:**
- Removed the counter overwrite on lines 712-714
- `result.created` and `result.updated` now preserve the values set after successful DB writes (lines 657-663)
- `updateSuccessCount` tracks actual successful `updateOne` calls
- Specs failures recorded in batch `errors` array with `SPECS_UPDATE_FAILED` code
- `reconcileJobCounters()` aggregates from completed batch documents (excludes failed batches)

**Files:** `src/lib/import/import-v2-engine.ts` (lines 636-663, 712-719, 1040-1070)

---

### FIX #10: Job Completion Checks ALL Batches ✅
**Root Cause:** `completeBatch()` used `if (batchNumber >= totalBatches)` to determine job completion. This failed with out-of-order execution (batch 5 completes before batch 3) or missing batches.

**Fix:**
- `completeBatch()` now uses aggregation pipeline to count ALL batch statuses:
  ```typescript
  ImportBatch.aggregate([
    { $match: { importId, executionMode: 'real' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  ```
- Counts `completed + failed` (terminal) vs `totalExpected`
- Checks for MISSING batch numbers via `ImportBatch.distinct('batchNumber')`
- Job is complete only when `allTerminal && missingBatches.length === 0`
- Status determination:
  - `allTerminal && !hasErrors` → `completed`
  - `allTerminal && hasErrors` → `completed_with_errors`
  - `failed > 0 && no in-flight` → `completed_with_errors`
  - Otherwise → `processing`

**Files:** `src/lib/import/import-v2-engine.ts` (lines 776-835), `src/lib/models/ImportBatch.ts` (line 107)

---

### FIX #11: Cancel/Rollback State Validation ✅
**Root Cause:** `cancelJob()` and `rollbackJob()` didn't check if the job existed (no 404) or if the current status allowed the operation (no state machine validation). Idempotent re-calls could cause issues.

**Fix:**
- `cancelJob()`:
  - Returns `{ success: false, error: 'Import job not found' }` for nonexistent jobs → HTTP 404
  - Only allows cancel from: `ready`, `queued`, `processing`, `paused`, `completed_with_errors`, `failed`
  - Marks in-progress batches (`pending`, `processing`) as `failed`
- `rollbackJob()`:
  - Returns error for nonexistent jobs → HTTP 404
  - Only allows rollback from: `completed`, `completed_with_errors`
  - Transitions through `rolling_back` → `rolled_back`
- Handler maps error messages to HTTP status codes (404 for 'not found', 400 for others)

**Files:** `src/lib/import/import-v2-engine.ts` (lines 57-59, 872-902, 908-1033), `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 450-510)

---

### FIX #12: CSV RFC-Compatible Escaping ✅
**Root Cause:** Error CSV export used naive string concatenation without RFC 4180 compliance. Fields containing commas, quotes, or newlines produced malformed CSV.

**Fix:**
- Implemented `escapeCsvField()` function:
  1. Formula injection protection: prefix `=+\-@\t\r` with `'`
  2. If field contains `"`, `,`, `\n`, or `\r`: wrap in double quotes, double all internal quotes
  3. Otherwise: return as-is
- Applied to all 8 columns in error CSV output
- Content-Type: `text/csv` with `Content-Disposition: attachment`

**Files:** `src/app/api/[[...path]]/handlers/import-v2.ts` (lines 515-566)

---

## Additional Bug Fixed During Verification

### FIX #9 Counter Overwrite Regression
**Discovered:** During code review, found that lines 712-714 in `import-v2-engine.ts` overwrote correctly calculated counters:
```typescript
// BEFORE (BUG):
result.created = createdIds.length;  // OK but redundant
result.updated = updatedIds.length;  // BUG: overwrites updateSuccessCount!

// AFTER (FIXED):
// Counters set after successful DB writes on lines 657-663 are preserved.
// Only set createdPhoneIds/updatedPhoneIds/fieldChanges/specsChanges here.
```

---

## Test Results

### Test Suite: 40 Integration Tests
```
Total:  40
Passed: 40
Failed: 0
```

| Fix | Tests | Status |
|-----|-------|--------|
| #1 Metadata | 3/3 | ✅ |
| #2 Retry | 3/3 | ✅ |
| #3 Dry-Run | 3/3 | ✅ |
| #4 Duplicates | 2/2 | ✅ |
| #5 Config | 3/3 | ✅ |
| #6 Batch Config | 3/3 | ✅ |
| #7 HTTP Status | 2/2 | ✅ |
| #8 Rollback Specs | 4/4 | ✅ |
| #9 Counters | 3/3 | ✅ |
| #10 Completion | 4/4 | ✅ |
| #11 Cancel/Rollback | 3/3 | ✅ |
| #12 CSV Escaping | 5/5 | ✅ |
| E2E Contract | 2/2 | ✅ |

### Build Verification
| Check | Result |
|-------|--------|
| ESLint | 0 errors, 62 warnings (pre-existing `any` types) |
| TypeScript `--noEmit` | Clean, no errors |
| `next build` | ✓ Compiled successfully in 16.0s |
| Static Generation | 52/52 pages |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/import/import-v2-engine.ts` | FIX #9 counter overwrite removed (lines 712-714) |
| `src/app/api/[[...path]]/handlers/import-v2.ts` | All 12 fixes verified in place |
| `src/lib/models/ImportBatch.ts` | Schema verified (executionMode, specsChanges, metadata fields) |
| `src/lib/models/ImportJob.ts` | Schema verified |
| `src/lib/import/duplicate-detector.ts` | Verified FIX #4 compatibility |
| `src/lib/import/v2-parsers.ts` | Verified |
| `src/lib/import/normalize-phone-record.ts` | Verified |
| `scripts/__tests__/critical-fix-round2.test.ts` | Rewritten: 40 integration tests |
| `package.json` | Test script updated to run Round 2 tests |

---

## Verification Commands

```bash
# Run tests
npm test

# Full verification
npm run verify
```