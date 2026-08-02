# SpecsDekh v31.3.2 — Collector Source Save Fix

## Fixed
- Collector source creation now establishes the MongoDB connection before queries/writes.
- `lastSyncStatus` now uses a valid `never` default instead of an empty string rejected by the Mongoose enum.
- Source creation failures return structured JSON with the actual server-side validation message instead of a generic HTML/500 response.

## Expected result
Samsung Pakistan can be saved as `Manual Structured URL`, then tested from the source list.
