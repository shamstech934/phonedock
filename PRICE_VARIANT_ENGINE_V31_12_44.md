# SpecsDekh v31.12.44 — Variant Price Engine

This release extends the PTA / Non-PTA separation with RAM, storage, color, condition and warranty-aware retailer price identity.

## Safety rules
- PTA, Non-PTA and unknown remain isolated. Unknown never auto-overwrites a public PTA/Non-PTA price.
- Verified retailer listings store normalized RAM/storage plus color, condition and a deterministic variantKey.
- Public phone price API accepts `priceClass`, `ram`, `storage`, and `color` and selects the lowest trusted verified **new-condition** offer matching that exact selection.
- If no exact variant offer exists, the page falls back to the phone-level PTA/Non-PTA price rather than silently writing another variant's price into the selected variant.
- Public phone page exposes RAM, storage, color and PTA/Non-PTA selectors when variant listing data exists.
- Admin Add Listing now captures color and condition in addition to RAM/storage/PTA/warranty.
- Manual tracker history stores variant dimensions so histories can be separated later by exact configuration.

## Important data rule
Retailer listings should identify RAM/storage/PTA before automatic use. Color may be blank for a generic color price. Used/refurbished/open-box listings are not selected as public new-phone prices.
