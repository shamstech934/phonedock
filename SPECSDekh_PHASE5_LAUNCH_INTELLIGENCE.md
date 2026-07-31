# SpecsDekh Phase 5 — Launch Intelligence

## Implemented
- RSS/Atom rumour sync now stages phone launch candidates automatically.
- Deterministic brand/model/lifecycle extraction works without a paid AI key.
- Non-phone products such as watches, buds, tablets and laptops are filtered.
- Duplicate candidates and existing phones are detected.
- New admin page: `/admin/launch-intelligence`.
- Admin can approve a candidate to create a safe unpublished phone draft, or reject it.
- Every approval/rejection is logged in ActivityLog.
- Automatic publishing is deliberately prohibited; specifications and images require editorial verification.

## Workflow
`RUMOUR_FEED_URLS` → sync pipeline → pending news → launch candidate → admin review → draft phone → verify specs/images/price → publish.
