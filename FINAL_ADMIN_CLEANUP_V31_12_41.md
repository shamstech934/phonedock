# SpecsDekh v31.12.41 — Final Admin Cleanup Pass

This package consolidates the previous v31.12.39 and v31.12.40 work and adds the final navigation and queue-safety fixes from the complete screenshot audit.

## Completed

- Added persistent **Simple / Advanced** admin navigation modes.
  - Simple mode exposes everyday content, data completion, price review, homepage, and settings tools.
  - Advanced mode exposes Collector, Intelligence, Automation, Monitoring, Analytics, SEO, Release and technical pages.
- Kept permission filtering active in both modes.
- Converted legacy duplicate routes into compatibility redirects:
  - `/admin/launch-intelligence` → `/admin/launch-center?view=intelligence`
  - `/admin/ai-research` → `/admin/intelligence-center`
- Added page selection and bounded bulk dismiss to **Price Intelligence V2**.
- Added page selection and bounded bulk dismiss to **Image Intelligence**.
- Bulk queue actions are capped at 50 records and report partial failures.
- Price Intelligence Apply is disabled unless a positive recommended price and verified retailer URL are both available.
- Changed large Image/Pakistan intelligence scans from 150 to 25 phones per invocation to reduce Vercel CPU/timeout risk.
- Preserved the earlier package fixes for:
  - Brands and Sponsors bulk management
  - Specs Intelligence bulk dismiss and safe Apply
  - Phone Editor PTA single source of truth
  - Intelligence counter improvements
  - Collector sidebar consolidation

## Existing bulk-capable workflows preserved

Phones, Brands, News, Videos, Reviews, Sponsors, Users, Collector Review, Data Quality and Specs Intelligence retain their existing select/bulk workflows.

## Safety

- No intelligence recommendation is automatically published.
- Dangerous bulk actions require confirmation.
- Legacy URLs remain usable through redirects instead of returning 404.
- Technical modules are hidden in Simple mode, not deleted.

## Validation

The modified TypeScript/TSX files passed TypeScript syntax transpilation checks. A full dependency-backed Next.js build was not available in this source workspace because dependencies were not installed; GitHub/Vercel must run the production build gate after deployment.
