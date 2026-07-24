# Sprint 8 — Search, Filters and Query Reliability

## Included

- Fixed public phone filters that were visible in the UI but ignored by the API:
  - display type
  - refresh-rate tier
- Added chipset family filtering for Snapdragon, Dimensity, Exynos, Apple, Helio and Unisoc.
- Added safe regex escaping for display/chipset values.
- Added lightweight PhoneSpecs indexes for display type and chipset.
- Improved header autocomplete:
  - stale requests are aborted
  - loading and temporary-error states are visible
  - selecting a suggestion opens the phone directly
  - debounce reduced to 250ms
  - unmount cleanup prevents stale state updates

## Deployment

No environment variable or data migration is required. Mongoose creates the two new indexes during normal model initialization when auto-indexing is enabled. Production databases with auto-indexing disabled can create indexes during the normal database maintenance window.
