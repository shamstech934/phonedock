# Collector + Price Tracker Phase 3 completion

This release hardens the remaining production blocker observed after v31.6.

## Collector
- Legacy raw `Headers.append` errors are sanitized in API responses and UI.
- Resume/retry clears stale errors and failure counters before executing current code.
- Request headers remain restricted to primitive text values through the shared provider request builder.
- No MongoDB source document is sent as an HTTP header.

## Price Tracker
- Deterministic source testing, exact product URL linking, PKR extraction, history, review safety and cron behavior from v31.5/v31.6 are preserved.
- Prices are never guessed. A source requires a genuine product page or approved feed.

## Live configuration requirement
Retailer price tracking cannot produce records until at least one exact product-page URL or approved feed is linked to a phone.
