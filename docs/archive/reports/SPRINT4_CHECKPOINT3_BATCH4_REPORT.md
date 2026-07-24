# Sprint 4 — Checkpoint 3 — Batch 4

## Scope
Final database and public API performance tuning.

## Changes

1. **Two-stage autocomplete search**
   - Runs indexed prefix matching first.
   - Executes the broader contains fallback only when fewer than 12 results are found.
   - Adds a 2.5 second query ceiling to prevent runaway searches.

2. **Ranked public search**
   - Prefix matches appear before contains/keyword matches.
   - Broad regex fallback is skipped when prefix results already fill the page.
   - Phone and brand search queries have a 3 second database ceiling.

3. **Non-blocking view counters**
   - Phone detail responses no longer wait for the analytics view increment.
   - Increment failures are logged without breaking the public request.

4. **PhoneSpecs filter indexes**
   - Added indexes for RAM, storage, screen size, main camera and battery capacity.
   - Migration remains idempotent and does not delete or rewrite phone data.

## Deployment
Run once after deployment:

```bash
npm run migrate
```

The migration only creates missing indexes.
