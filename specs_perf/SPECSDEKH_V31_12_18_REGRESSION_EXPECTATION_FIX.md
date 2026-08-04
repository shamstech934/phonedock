# SpecsDekh v31.12.18 — Regression Expectation Fix

## Fixed
- Updated the autocomplete reliability regression test to accept both valid timeout forms:
  - `.maxTimeMS(5000)`
  - `maxTimeMS: 5000`
- Preserved the optimized production query.
- Kept direct brand fallback, bounded 12-result limit, model-name matching, and DB-before-rate-limit ordering checks.
- Bumped project version to 31.12.18.

## Result
The regression validates timeout behavior instead of one obsolete source-code spelling.
