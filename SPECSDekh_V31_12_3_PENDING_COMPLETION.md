# SpecsDekh v31.12.3 — Pending Work Completion

Completed the work left behind after the regression-only hotfix.

- Restored the exact homepage regression contract: `.filter(key => key !== 'latest')`.
- Kept Latest Phones inside the opening catalogue column without duplicate rendering.
- Changed public “Newest” sorting from import time (`createdAt`) to launch chronology.
- Added deterministic fallbacks: release date, available date, Pakistan launch date, announcement date, then creation date.
- Removed the duplicated 80–96px top offset on `/phones`; the sticky header already occupies document space.
- Added stable model-name tie-breaking for consistent pagination.
