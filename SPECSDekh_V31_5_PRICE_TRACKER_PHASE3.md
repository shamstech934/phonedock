# SpecsDekh v31.5 — Price Tracker Phase 3

This release hardens the deterministic, review-first price tracking runtime. No AI-generated or guessed prices are used.

## Implemented

- Product listings now retain per-listing failure count, last error, last successful check, extraction method and confidence.
- Adding an exact product URL to a trusted source performs a bounded verification immediately.
- A matching page with a reliable PKR price is marked verified and becomes eligible for scheduled sync.
- Untrusted sources remain pending until the source itself is tested and trusted.
- Source testing now persists source health timestamps and failure counts.
- Manual source testing and scheduled sync use the same deterministic price extractor.
- Sync results distinguish updated, unchanged, unavailable, pending-review and failed listings.
- Fixed a counter defect that counted a first detected price twice.
- Failed product pages retain a readable diagnostic instead of only increasing a source-level counter.
- Existing manual-lock and review-threshold safeguards remain in force.

## Required live configuration

A retailer homepage cannot identify a phone. Each monitored phone still requires an exact HTTPS product-page URL from an allowed trusted domain.
