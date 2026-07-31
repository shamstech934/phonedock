# SpecsDekh Phase 9 — Admin Navigation Consolidation & Static Route Audit

## Completed

- Reduced the admin sidebar from a long flat list to seven top-level entries:
  - Dashboard
  - Content
  - Data Operations
  - Intelligence
  - Website
  - Automation & Health
  - System
- Preserved all existing admin destinations inside logical collapsible groups.
- Kept role/permission filtering on every nested destination.
- Automatically opens the group that contains the current page.
- Preserved the pending-video badge inside the Content group.
- Replaced the overflowing mobile tab strip with one compact grouped page selector.
- Kept Collector sub-pages accessible without adding eight separate top-level tabs.
- Removed the duplicate Header & Links sidebar item because it is already available inside Homepage Builder.

## Verification

- TypeScript/TSX parser: PASS
- Admin navigation routes checked: 40
- Missing page routes: 0
- ZIP integrity: verified after packaging

## Build note

A full `npm ci` / production build could not run in this container because the internal package mirror returned HTTP 404 for `zod-validation-error@4.0.2`. This is an environment registry limitation, not a confirmed project compile failure.
