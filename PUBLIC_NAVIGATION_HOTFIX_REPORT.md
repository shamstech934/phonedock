# Phase 2.9.1 — Public Navigation Hotfix

## Fixed
- Restored the shared SpecsDekh header on `/rankings`.
- Restored the shared footer on `/rankings`.
- Added an accessible `Home > Rankings` breadcrumb.
- Added a mobile-visible `Back to phones` action.
- Added clear `Browse all phones` and `Compare phones` next actions in the hero.
- Reduced excessive hero top/bottom spacing while preserving the ranking introduction.
- Header active-state logic now marks Rankings automatically through the existing shared Header.

## Regression review
- `/reviews` already uses the shared Header and Footer.
- `/phones`, phone detail, compare, home, search and other previously audited public routes retain their own shared navigation integration.
