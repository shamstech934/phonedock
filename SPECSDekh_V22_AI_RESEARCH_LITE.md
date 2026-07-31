# SpecsDekh v22.0 — AI Research Lite

This release completes the AI Research module with production load protection.

## What changed

- `AI_RESEARCH_MODE=lite` is now the safe default.
- Maximum phones per job, batch size, provider calls, cooldown, and draft freshness are environment-controlled.
- Lite mode defaults to one phone per serverless batch and five provider calls per job.
- Atomic job locking prevents two requests from processing the same job concurrently.
- Cooldown timestamps prevent repeated rapid provider calls.
- Fresh pending drafts are reused instead of researching the same phone again.
- Provider-call, skipped-phone, and bounded failure counters are persisted.
- Admin UI displays the active policy and live AI-call budget.
- Nothing is auto-published; every result remains review-only.
- `AI_RESEARCH_AUTO_RUN=false` remains the default.

## Recommended Vercel values

```env
AI_RESEARCH_MODE=lite
AI_RESEARCH_MAX_PHONES_PER_JOB=5
AI_RESEARCH_BATCH_SIZE=1
AI_RESEARCH_MAX_PROVIDER_CALLS_PER_JOB=5
AI_RESEARCH_COOLDOWN_SECONDS=20
AI_RESEARCH_DRAFT_FRESH_HOURS=168
AI_RESEARCH_MAX_FAILURES_STORED=100
AI_RESEARCH_AUTO_RUN=false
```

## Validation completed

- AI research queue static audit passed.
- Production static audit passed: 87 routes, 0 broken internal links, 0 old-domain references, 0 visible legacy branding references.
- A regression test was added for Lite Mode policy, locking, cooldown, caching, and UI disclosure.

A full dependency-backed TypeScript/build run still needs CI/Vercel because this workspace does not contain installed node modules.
