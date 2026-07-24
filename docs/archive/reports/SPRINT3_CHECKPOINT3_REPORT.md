# Sprint 3 — Checkpoint 3

## Scope
Data Quality Center correctness, resumability, relationship scanning scope, duplicate detection, and health-score accuracy.

## Verified fixes

1. **Failed scan resume was unreachable**
   - `executeScan()` previously rejected jobs in `failed` state even though failure handling intentionally preserved `lastProcessedId` for resume.
   - Failed scans can now resume; completed/cancelled jobs remain blocked.

2. **Resume progress reset**
   - `scanAllPhones()` restarted `processed` at zero after a retry.
   - It now resumes from the persisted `ScanJob.processed` value.

3. **Scoped scans triggered global scans**
   - Entity/import scans also scanned all orphan and price-tracker records.
   - Global orphan and price checks now run only for full, incremental, and manual global scans.

4. **Duplicate PhoneSpecs could be missed across batches**
   - Duplicate counting was batch-local, so duplicates split between cursor batches were not detected.
   - Duplicate PhoneSpecs are now detected with a collection-wide aggregation grouped by `phoneId`.

5. **Specifications health score used unrelated records**
   - Draft/deleted/unrelated specs could reduce or even make the missing count negative.
   - Specs health calculations now use only published, non-deleted phone IDs and clamp missing counts to zero.

6. **Images health score used unrelated image rows**
   - Images belonging to draft/deleted phones could inflate coverage.
   - Image coverage now uses only published, non-deleted phone IDs.

7. **PTA status was displayed but not deducted**
   - Missing PTA status appeared in details but did not affect the score.
   - It now contributes to Core Identity deduction while preserving the category maximum.

## Verification performed

- `npm ci`: completed
- `npm run typecheck`: passed
- `npm run lint`: passed with 0 errors and 491 existing warnings
- `npm test`: passed
  - Existing checks: 69
  - New Checkpoint 3 checks: 8
  - Total scripted checks: 77
- `npm run build`: compilation and TypeScript stages passed; the local runner timed out while collecting page data with 55 workers. Full build completion is therefore not claimed.

## Remaining risks

- Data Quality findings are accumulated in memory until persistence; very large datasets may still need streaming/batch persistence.
- Rule exceptions are logged and swallowed, so the scan job does not yet persist a precise failed-rule count.
- Real MongoDB-backed integration tests are still required for resume, duplicate aggregation, auto-fix, and orphan cleanup.
- 491 lint warnings remain, mostly legacy test/script typing and unused-code warnings.
