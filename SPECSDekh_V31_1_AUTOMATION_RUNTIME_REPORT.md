# SpecsDekh v31.1 — Price Tracker & Collector Runtime Hardening

## Scope
This release does not add AI or placeholder automation. It hardens the existing deterministic Price Tracker and Collector workflows.

## Price Tracker
- Auto-link now scans the complete published catalogue and reports why each phone cannot be linked.
- Domain homepages and generic catalogue URLs are rejected instead of being marked as verified product listings.
- Response includes missing product URLs, rejected homepage URLs, eligible product URLs, unmatched domains, existing links and newly linked records.
- Source testing now uses the same shared JSON-LD/meta/visible-price parser as scheduled price sync.
- Exact retailer product-page URLs are still required; the system does not invent URLs.

## Collector
- AI/web-search discovery is disabled.
- Collector dashboard explicitly reports deterministic-only mode.
- Run All starts jobs only for enabled, configured sources.
- Enabled sources without an endpoint are returned as unconfigured instead of creating empty jobs.
- Collection continues to support approved JSON, CSV, XML, RSS, API, manual URL and file-upload sources.

## Verification
- `npm run audit:automation-runtime` added.
- Focused audit: 6/6 checks passed.
- Full production build must run in GitHub/Vercel where project dependencies are installed.
