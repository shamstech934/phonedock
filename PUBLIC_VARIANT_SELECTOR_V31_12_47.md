# SpecsDekh v31.12.47 — Public Variant Selector Completion

## Fixed

- Public phone price card now exposes RAM, storage and color selectors from the phone catalog specs even when retailer listing metadata has not yet been populated.
- Retailer-derived verified variant options are merged with catalog-spec options instead of replacing them.
- Selecting a catalog-only variant never falls back to another variant price; the exact verified variant must exist or the UI shows `Price unavailable`.
- Price verification badges are no longer shown on an unavailable selected variant. The UI shows `No verified price` instead.
- PTA Approved / Non-PTA isolation from v31.12.43-v31.12.46 remains unchanged.

## Expected public behavior

1. Choose PTA Approved or Non-PTA.
2. Choose RAM/storage/color when available in saved specs or verified retailer listings.
3. The exact matching verified price is displayed.
4. If that combination has no verified price, another capacity/color/PTA price is never substituted.
