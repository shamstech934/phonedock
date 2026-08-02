# SpecsDekh v31.8 Collector Runtime Stabilization

- Manual/manufacturer HTML collection is now page-aware and bounded.
- Product detail requests run in small concurrent batches with strict timeouts.
- Default collector work is limited to one provider page per invocation.
- Jobs write heartbeats before network work.
- Stale running jobs are automatically paused after two minutes and can be resumed.
- Collector Jobs auto-refreshes every five seconds while a job is queued/running.
- No AI, guessed data, or automatic publishing was added.
