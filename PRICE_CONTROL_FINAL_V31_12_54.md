# SpecsDekh v31.12.54 — Price Control Final Consolidation

This release turns the former Price Tracker screen into a real admin Price Control workspace while preserving the automatic tracking engine.

## Admin control center
- Renamed the page and tabs around control tasks rather than tracker internals.
- Added a visible Public Price Control Center for Pakistan PTA, Pakistan Non-PTA, USA Retail, conflicts/review, discounts, locked admin overrides and duplicate protection.
- Added quick per-phone control access from the main screen.
- Added phone selection and bulk Unlock Overrides / Reset Selected to Auto actions. Reset removes overrides but keeps history.

## Exact variant identity
Prices remain separated by market, currency, price bucket, RAM, storage, color, condition and warranty. Saving the same identity updates it instead of duplicating it.

## Discount controls
Exact variant price rows now support:
- Sale/current price
- Regular price
- Automatic discount percentage preview
- Optional discount start/end dates

These fields are available both in the Phone Editor Images & Prices section and in the Price Control override modal.

## Authority and safety
- Locked admin override wins for its exact identity.
- Automatic source offers can continue to be collected without overwriting a locked manual correction.
- Reset to Auto removes the exact manual override; bulk reset is also available.
- Pakistan PTA, Pakistan Non-PTA and USA Retail are never merged.
- Public phone detail can display the selected exact variant's regular-price discount when available.

## Database/API
- PhonePrice stores regularPrice and discount validity dates.
- PhoneRetailListing has regularSourcePrice and discount dates for automatic retailer offers.
- Price-control API returns discount metadata and accepts it on manual overrides.
- Phone CRUD preserves exact variant discount metadata.

## QA
Targeted TypeScript transpile/syntax audit passed for all modified TS/TSX files.
