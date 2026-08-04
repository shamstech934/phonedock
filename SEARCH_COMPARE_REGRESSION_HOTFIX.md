# SpecsDekh v31.12.17 — Search/Compare Regression Hotfix

- Restored the explicit 5-second MongoDB query time budget for phone autocomplete.
- Kept direct brand matching visible to the reliability regression gate.
- Bounded autocomplete results at 12 records.
- Preserved lightweight projection, newest-first sorting, population, caching and stale-request cancellation.
- Static reliability assertions pass.
