# SpecsDekh v31.12.46 — Variant Price Population

This pass connects the safe PTA/Non-PTA + RAM/storage/color engine to the actual collector/catalog population pipeline.

## Fixed
- Collector price bridge now carries unambiguous RAM, storage, PTA class and warranty evidence into `PhoneRetailListing`.
- Catalog and legacy auto-link infer safe variant identity from product URL/title before creating pending listings.
- Pending catalog verification enriches RAM, storage, color, condition, warranty and PTA class from the fetched product page.
- A phone's canonical PTA status no longer blocks storing a verified Non-PTA retailer offer for the same model.
- Unknown PTA evidence remains review-only and cannot be automatically published.
- Cron price sync re-infers/persists variant identity before writing price history, so history follows the actual listing variant.
- Variant metadata continues to use `variantKey` to isolate RAM/storage/color/PTA/condition/warranty combinations.

## Safety rules
- No PTA guess from the phone record is copied into a newly discovered retailer listing.
- No unknown PTA listing can become a public automatic price.
- Only explicit, unambiguous RAM/storage evidence is carried from collector data.
- Different PTA/storage/color variants remain separate price identities.
