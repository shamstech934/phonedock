# PhoneDock v16.0 — Local Specs Production Workflow

- Replaced row-by-row dataset imports with MongoDB bulk writes.
- Added dataset duplicate suppression inside each upload batch.
- Added local dataset status endpoint and visible device count.
- Added live CSV import progress.
- Added inserted/updated/skipped import reporting.
- Added configurable 90–98% confidence threshold for batch auto-match.
- Disabled auto-match until a local dataset exists.
- Added activity logging for dataset imports and batch applies.
- Retained manual candidate review before applying uncertain variants.
- No AI provider, credits, or runtime third-party specs API is required.
