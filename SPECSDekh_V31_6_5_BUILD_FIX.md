# SpecsDekh v31.6.5 Build Fix

- Buying guides no longer statically query MongoDB during CI builds.
- Buying guide data loading is failure-safe and returns an empty state when Atlas is temporarily unavailable.
- News detail pages no longer generate static params from MongoDB during the build.
- News and review detail pages render dynamically at request time.
- Existing Collector and Price Tracker Phase 2/3 changes are preserved.
