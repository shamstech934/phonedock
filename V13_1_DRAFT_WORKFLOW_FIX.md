# PhoneDock v13.1 — AI Draft Workflow Fix

- OpenRouter free-router requests no longer force unsupported JSON response_format.
- Research jobs verify that every draft is persisted before incrementing generated count.
- Job cursor advances even when a queued phone was deleted or missing.
- Run API returns generatedThisBatch, draftIds and exact batch failures.
- Admin messages no longer claim drafts are ready when zero drafts were saved.
- Draft list requests bypass browser and edge caches.
- After a successful batch, the review filters switch to the generated draft type and pending-review status.
