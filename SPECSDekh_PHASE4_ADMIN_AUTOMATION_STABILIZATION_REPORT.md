# SpecsDekh Phase 4 — Admin & Automation Stabilization

## Completed changes

### Data Quality: Fix All
- Replaced the single request that could attempt up to 2,000 sequential fixes with cursor-based chunks of 25.
- The admin page automatically requests each next chunk until the complete filtered queue is processed.
- Current filters (severity, issue type, entity type, search) remain applied across every chunk.
- Each chunk is idempotent because only open issues are selected.
- Activity logs now record each bounded fix-all chunk.

### Price Tracker
- Each sync invocation now processes an oldest-first bounded slice, capped at 50 listings.
- Later runs continue with listings that have not been checked recently, reducing serverless timeout risk.
- A trusted and verified listing's first successful detected price is now applied immediately unless the phone has a manual price lock.
- First detections now create an auditable PriceTrackerHistory record.
- Sources are reset to active after a successful fetch.
- A source is marked failed after five consecutive extraction/fetch failures.
- Admin feedback now states when more eligible listings remain for the next run.

## Compatibility preserved
- Existing MongoDB collection names, environment variable names, routes, source records, and admin permissions were preserved.
- Manual price locks still prevent automatic public-price changes.
- Large price changes still enter pending review instead of being published automatically.

## Verification
- Source-level static validation was completed for edited handlers and UI calls.
- A complete production build could not be executed because dependencies are not installed in this isolated workspace.
- Run `npm ci && npm run verify` in the connected repository/CI before production deployment.
