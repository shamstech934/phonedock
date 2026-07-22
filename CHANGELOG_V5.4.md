# PhoneDock v5.4.0 — Smart Review & Scoring Engine

## Added
- Deterministic review engine based on existing PhoneDock specifications and scores.
- Performance, camera, battery, display, software, value, repairability and overall scores.
- Auto-generated pros, cons, best-for, avoid-if, summary, verdict and buy/consider/skip recommendation.
- Award rules for camera, gaming, battery, value, display, performance and Editor's Choice.
- Confidence score that drops when source data is incomplete.
- Admin batch page at `/admin/review-engine`.
- Authenticated batch API at `/api/admin/review-engine`, capped at 100 phones per request.
- Existing editorial content protection unless overwrite is explicitly enabled.
- Automated v5.4 engine tests.

## Safety
- No external AI provider is called.
- No specification is invented or fetched from an unverified source.
- Generated reviews clearly depend on available PhoneDock data.
