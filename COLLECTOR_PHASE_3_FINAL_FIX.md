# Collector + Price Tracker Phase 3 Final Fix

This release removes the last collector header-construction failure by:

- using plain `Record<string,string>` request headers (no `new Headers(...)` in collector fetches),
- saving no custom headers for manual/HTML/feed sources,
- sanitizing API-source headers to primitive text values only,
- repairing legacy source records before retry, and
- clearing stale job/source errors before re-running a collector job.

Expected behavior after deployment:

1. Open **Collector Jobs**.
2. Retry the failed Samsung job.
3. The old `Invalid HTTP header configuration` message should clear.
4. If Samsung exposes no usable structured records, the run should end with a clean `No structured phone records found` result instead of crashing.

No AI, guessed phones, guessed URLs, or guessed prices were added.
