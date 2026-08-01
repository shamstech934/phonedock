# SpecsDekh v27.6 — Import Identity & Create Logic Fix

## Fixed

- Import V2 no longer uses fuzzy model similarity for write decisions.
- A CSV row updates an existing phone only when brand + normalized model match exactly.
- Exact slug matches are additionally verified against brand and model before update/replace.
- Legacy records with an old slug can still be matched by exact brandId + normalized model.
- Different brands or similar model names can no longer be silently treated as the same phone.
- Exact legacy/draft matches are reactivated during import.
- When publish mode is `immediate`, a complete exact match is published; incomplete records remain draft with a clear import warning.
- New identities are created normally and receive their own specs, benchmark and image records.

## Expected import behaviour

- First genuinely new Infinix/Tecno import: `Created` increases.
- Re-import of the same exact brand/model: `Updated` (or `Skipped`, depending on duplicate mode).
- Similar model from another brand/year: created separately.
- Existing hidden draft with the exact same identity: updated/reactivated rather than duplicated.
