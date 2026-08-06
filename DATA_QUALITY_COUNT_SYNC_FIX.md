# SpecsDekh v31.12.31 — Data Quality Count Synchronization Fix

## Fixed
- Every issue-backed tab now uses a persisted `DataQualityIssue` count that exactly matches its list query.
- Live catalog queues (missing specs/images/prices) remain separate and continue to use source collection diagnostics.
- Removed the fallback that incorrectly mapped multi-type tabs such as Price Issues, Brand Issues and Low Confidence to `missingSpecs`, which caused false `99+` badges.
- Brand Issues now includes `BRAND_MISSING_SLUG` consistently in both count and list filters.
- Issue API failures are shown as errors instead of silently rendering a green “No issues found” state.
- Added a mismatch warning if a summary count is positive but a filtered issue page unexpectedly returns no rows.

## Result
Badge count, Fix All count and displayed list now come from the same persisted issue query for issue-backed tabs.
