# SpecsDekh Master Fix Report

Version: 31.12.7
Date: 2026-08-04

## Completed in this package

- Homepage maximum canvas width expanded to better use large desktop screens.
- Homepage phone grids standardized to six cards on desktop instead of producing narrow cards or uneven empty rails.
- Latest Phones now excludes upcoming, announced, coming-soon and rumoured records.
- Latest Phones sorting now uses parsed timestamps instead of fragile string sorting.
- Opening catalogue flow now continues through Latest, Trending, Camera and Gaming sections beside the discovery sidebar, preventing the sidebar from creating a large blank block before the next section.
- Full-width section rendering excludes the sections already rendered in the opening flow, preventing duplicates.
- Regression-test-compatible explicit section filters restored.
- Existing release-readiness image validation retained: both normalized PhoneImage records and public-card thumbnail values are accepted.

## Validation performed

- Static assertions for homepage flow, six-column layout, latest-phone lifecycle filtering and wide-canvas configuration passed.
- Node syntax check for the production static audit script passed.

## Environment note

A complete local dependency install could not be completed in this execution environment because its internal npm mirror returned a missing-package error for `zod-validation-error@4.0.2`. The project ZIP does not include `node_modules`; Vercel/GitHub should install from their normal npm registry.
