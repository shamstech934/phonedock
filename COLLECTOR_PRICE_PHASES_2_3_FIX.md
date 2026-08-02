# SpecsDekh v31.6

## Collector fixes
- Strict primitive-only HTTP header construction using a real `Headers` instance.
- Mongoose source documents are flattened before provider configuration is built.
- Previous job errors are cleared on retry.
- Runtime failures increment the failed counter.
- Raw MongoDB objects are never shown on the dashboard; errors are sanitized.
- Existing deterministic Collector source/test/job/review/import flow remains enabled.

## Price Tracker
- Includes the v31.5 Phase 3 source verification, product-page linking, deterministic PKR extraction, history, review and cron safety changes.
- No AI or guessed prices/URLs are used.

## Deployment test
1. Deploy and open Collector Jobs.
2. Retry the Samsung Pakistan job or create a fresh job.
3. The old raw `Headers.append` object should no longer appear.
4. If Samsung exposes no supported structured products, the job should finish with a clean warning rather than a runtime header crash.
5. Add a trusted price source and exact product URL, then run Price Tracker sync.
