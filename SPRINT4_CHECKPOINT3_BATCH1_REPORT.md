# Sprint 4 — Checkpoint 3 — Batch 1

## Database & API performance changes

- Added compound MongoDB indexes matching homepage and public listing filters/sorts.
- Added the same indexes to the idempotent `npm run migrate` script because production disables Mongoose auto-index creation.
- Reduced homepage phone payloads by excluding long review, SEO, source, and lock-reason fields.
- Added projections for homepage news, videos, sponsors, and batched specs.
- De-duplicated phone IDs before the homepage specs batch query.

## Deployment note

After deployment, run `npm run migrate` once against the production MongoDB environment so the new indexes are created. The migration is additive and idempotent.
