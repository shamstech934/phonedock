# PhoneDock Import History + Data Quality Refresh Fix

## Fixed

- Admin JSON/CSV bulk imports now create `ImportHistory` records for completed, partial, and failed runs.
- The uploaded filename and file type are sent by the import UI and stored with the history record.
- Import duration, inserted, updated, skipped, and failed totals are persisted.
- `/api/import/stats` now aggregates the schema's real `inserted` field instead of the obsolete `imported` field.
- Import history and stats responses are explicitly non-cacheable.
- The import page requests fresh stats/history after every result and displays either `inserted` or legacy `imported` values.
- Data Quality summary responses are explicitly non-cacheable and include a safe database linkage diagnostic.
- The refresh control now provides visible progress/success feedback, reloads live database counts, and triggers a Next.js router refresh.

## Database verification

The repository already includes `npm run db:check`, which validates the URI, DNS, credentials, and performs a read-only MongoDB ping. Live database access was not available in the patch environment, so no claim is made about the private production cluster. Run the command after pulling Vercel environment variables locally.

## Deployment check

After deployment:

1. Run another CSV update import.
2. Confirm `Last Import`, total imports, and history update to the current time.
3. Open Data Quality and press refresh.
4. Confirm the refresh status message appears and `With Specs`/`Missing Specs` reflect the database.
