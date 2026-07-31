# SpecsDekh Phase 21 — AI Research Queue Hardening

## Implemented

- Queued research jobs for specs, images, and Pakistan prices.
- Up to 50 phones per job, with 1–5 phones per serverless batch.
- Cursor-based resume support.
- Per-phone error capture and partial-success completion.
- Pending draft upsert/deduplication.
- Admin progress feedback while batches run.
- Job cancel endpoint.
- Static regression audit included in `release:gate`.

## Endpoints

- `POST /api/admin/ai-research/jobs`
- `POST /api/admin/ai-research/jobs/:id/run`
- `POST /api/admin/ai-research/jobs/:id/cancel`
- `GET /api/admin/ai-research/jobs`
- `GET /api/admin/ai-research/drafts`

## Safety

Nothing is published automatically. Generated data remains in `pending_review` until an authorized admin approves it.

## Verification

Passed:

- `node scripts/ai-research-queue-audit.mjs`
- `node scripts/production-static-audit.mjs`

Full TypeScript/build certification requires dependencies in GitHub Actions or Vercel.
