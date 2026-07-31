# SpecsDekh Phase 6 — Intelligence Center

Implemented a safe, review-first Intelligence Center that combines:

- Launch candidate confidence using extraction confidence plus curated source trust.
- Official, trusted-publication, certification, community, and unknown source bands.
- Price trend estimates from historical price points using the existing linear-trend engine.
- Specs and image readiness coverage from a bounded recent-phone sample.
- Open data-quality issue counts and pending launch totals.
- A new `/admin/intelligence-center` dashboard and `/api/admin/intelligence-center` endpoint.
- No automatic publishing, destructive updates, paid AI dependency, or background loops.

The feature is decision support only. Admin review remains mandatory.
