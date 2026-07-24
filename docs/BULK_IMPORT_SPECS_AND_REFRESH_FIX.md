# Bulk Import Specs and Data Quality Refresh Fix

## Root cause

The admin bulk-import endpoint only created `PhoneSpecs` when a request row already contained a nested `specs` object. The CSV preview sends flat columns such as `displaySize`, `displayType`, `refreshRate`, `chipset`, `ram`, `storage`, `mainCamera`, `selfieCamera`, `battery`, `charging`, and `os`. Phones were therefore created successfully while almost every row skipped `PhoneSpecs` creation.

## Fix

- Bulk-import now runs every flat row through the shared `normalizePhoneRecord` mapper.
- Normalized flat spec fields are merged with any existing nested `specs` object.
- Empty values are removed before `PhoneSpecs.bulkWrite()`.
- Existing import modes and batched writes remain unchanged.
- `imageUrl` is accepted as a thumbnail fallback for the provided CSV format.

## Data Quality refresh

- The refresh request now uses `cache: 'no-store'` and a cache-busting query value.
- The refresh icon spins while counts are loading.
- API failures are shown in the page instead of being silently ignored.
- The refresh button exposes a last-refreshed timestamp in its tooltip.

## Expected result

Re-importing the rows in `update_existing` mode creates or updates `PhoneSpecs` for the already imported phones. The Data Quality summary then reports the live `PhoneSpecs` collection count after pressing Refresh.
