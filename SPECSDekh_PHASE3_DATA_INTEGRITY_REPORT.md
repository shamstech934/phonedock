# SpecsDekh Phase 3 — Import Data Integrity & Recovery

## Completed

- Added durable rollback snapshots for benchmark updates.
- Added durable rollback snapshots for image replacements.
- Image replacement now restores the previous image set automatically when the new insert fails.
- Rollback now restores benchmark fields when they have not been manually edited after import.
- Rollback now restores the previous image set when the imported image set is still current.
- Import-created and import-updated PKR prices now write to `PriceHistory`, preserving the public price chart and audit trail.
- Extended `ImportBatch` persistence schema with `benchmarkChanges` and `imageChanges`.
- Existing import batch idempotency now returns the new rollback metadata as well.

## Compatibility

- No database name, collection name, environment variable, route, or public URL was renamed.
- Existing Import V2 jobs remain readable because all new fields default to empty arrays.
- Conflict checks prevent rollback from overwriting benchmark/image edits made after the import.

## Verification note

A complete dependency-backed build could not be run in this container because project dependencies are not installed. The global TypeScript check was attempted, but it cannot resolve Next.js, React, Mongoose, or Node type packages without `node_modules`. The modified files were inspected and the new schema fields and engine references were cross-checked.
