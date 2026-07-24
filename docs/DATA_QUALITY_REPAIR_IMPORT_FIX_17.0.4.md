# PhoneDock 17.0.4 — Data Quality Repair Import Fix

## Fixed

- Repair CSV accepts MongoDB Phone ID, slug, or brand + model.
- Standard `phonedock-specs-import-ready` CSV files no longer fail with `Invalid Phone ID`.
- Flat specification columns are mapped to `PhoneSpecs`.
- Preview and apply automatically process the complete file in 500-row requests.
- Specification writes use MongoDB `bulkWrite`.
- Data Quality refresh reloads live MongoDB summary counts and remounts the active missing-data queue.
- Refresh no longer depends on an unreliable fire-and-forget serverless scan.

## Deployment test

1. Open Data Quality > Missing Specs.
2. Choose `phonedock-specs-import-ready-part1.csv`.
3. Preview should resolve rows by slug instead of reporting Invalid Phone ID.
4. Apply repairs.
5. Press Refresh; the queue and With Specs count should decrease/increase respectively.
