# PhoneDock v9.0 PC8 — Complete AI Research & Publishing Workflow

## Completed in this package
- Persistent bulk AI research jobs for specs, images, and Pakistan prices.
- Progress, pause/continue, cancellation, failed-item retry, and bounded batches.
- AI Research admin tab with job controls and draft review queue.
- Existing-vs-suggested comparison for prices and images.
- Editable specification, image, and price drafts.
- Single and bulk approve/reject actions.
- Explicit approval publishes to PhoneSpecs or Phone records.
- Confidence, source links, conflict warnings, activity logs, and publish results.
- No research draft is auto-published.

## Required environment variables
- OPENAI_API_KEY
- TAVILY_API_KEY
- OPENAI_MODEL (optional)
- AI_RESEARCH_MAX_JOB_PHONES (optional, default 500)

## Safe operating sequence
1. Create a research job for a small batch first.
2. Run batches and inspect provider usage/cost.
3. Review sources, conflicts, and confidence.
4. Edit inaccurate values.
5. Approve only reviewed drafts.
