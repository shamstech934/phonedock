# Sprint 7 — Import Dashboard Runtime Fix

## Fixed

- Import V2 client now unwraps the API `{ success, data }` response envelope consistently.
- Nested API errors now show their actual `error.message` instead of `[object Object]`.
- Upload preview now reads the real API fields: `firstRecords`, `recognizedFields`, `ignoredFields`, and `missingFields`.
- Validation preview is normalized into the table shape used by the admin UI.
- Job polling now maps backend counters (`createdRecords`, `updatedRecords`, etc.) to frontend counters.
- Backend statuses such as `queued`, `processing`, `completed_with_errors`, and `rolled_back` are handled safely.
- Import history now maps real backend fields (`importId`, `startedAt`, `totalRecords`, counters, and duration).
- Rollback actions now use the correct import ID.
- Initial job progress is persisted without using stale React state.
- History rows now use keyed React fragments.

## Deployment

Copy the included `src` and `docs` folders into the repository root and allow overwrite.

No database migration, package installation, or environment variable change is required.
