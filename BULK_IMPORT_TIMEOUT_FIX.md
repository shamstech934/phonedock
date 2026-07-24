# Bulk Import Timeout Fix

## Changed

- `src/app/api/[[...path]]/route.ts`
  - Added `export const maxDuration = 60`.
  - Allowed `/api/admin/phones/bulk-import` to use the existing large request-body limit without widening all admin routes.

- `src/app/api/[[...path]]/handlers/admin-crud.ts`
  - Replaced per-record sequential database writes with batched `bulkWrite()` operations.
  - Missing brands are upserted in batches.
  - Existing phones are loaded once for duplicate matching.
  - New phone IDs are allocated before writing so specs, benchmarks, images, and prices can be written in bulk.
  - Database operations run in chunks of 500 with `ordered: false`.
  - Preserved existing import modes and preserved the previous rule that images/prices are inserted only for new phones.
  - Added structured JSON error responses for bulk database failures.

- `src/app/admin/import/page.tsx`
  - Replaced blind `response.json()` parsing with safe text parsing and a readable fallback when Vercel returns a non-JSON timeout/platform response.

## Verification

- Source changes were applied successfully.
- Node.js version available in the patch environment: v22.16.0.
- A complete dependency install did not finish within the execution time limit, so full `npm run typecheck` and `npm run lint` could not be truthfully certified here. Vercel should run the final build verification.

## Platform constraint

`maxDuration` only helps when the active Vercel plan permits that duration. Very large request bodies are still subject to Vercel's platform request-size limits. The optimized handler dramatically reduces database round trips, but extremely large imports should still be split into smaller files when necessary.
