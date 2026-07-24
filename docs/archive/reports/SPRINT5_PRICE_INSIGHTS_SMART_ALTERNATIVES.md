# Sprint 5 — Price Insights and Smart Alternatives

## Included

- Public price-tracker API now returns average price, confirmed data-point count, trend direction, and savings from the tracked high.
- Phone detail pages show lowest, highest, average, savings, trend, and confirmed-history count.
- Related phones are ranked into useful alternatives: better camera, better performance, better battery, better value, similar price, or more from the same brand.
- Buying insight no longer treats missing category scores as zero. When scoring data is insufficient, the page shows a neutral comparison message instead of a misleading verdict.

## Install

Copy the `src` folder into the repository root and allow overwrite. No dependency, database migration, or environment-variable change is required.

## Verification

- TypeScript: passed
- Changed-file ESLint: zero errors; existing warnings only
- Launch checks: 7/7 passed
