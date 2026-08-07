# SpecsDekh v31.12.50 — Critical Price Control Finalization

## Goal
Give the administrator final authority over every exact price identity without disabling automatic tracking for unrelated variants or markets.

## Completed
- Added per-variant admin override persistence on PhonePrice.
- Added per-variant lock state, lock reason, and auto-detected audit fields.
- Manual corrections are upserted by exact market/currency/variant identity; saving again updates the same row instead of creating a duplicate.
- Pakistan PTA, Pakistan Non-PTA and USA Retail remain independent buckets.
- RAM, storage, color, condition and warranty remain part of variant identity.
- Locked admin override wins over retailer price for the same exact public variant.
- Automatic retailer tracking continues in the background for all variants. A per-variant override no longer forces the whole phone into global manual mode.
- Reset to Auto removes only the selected exact admin override, preserves history, and recomputes verified automatic pricing.
- Phone editor saves preserve Price Tracker admin overrides rather than deleting them.
- Phone editor hides Price Tracker override rows so they are not accidentally duplicated as normal manual store rows.
- Price Tracker phone list now shows locked override counts.
- Edit Price action renamed to Price Control.
- Price Control modal lists existing manual and automatic price identities before editing.
- Clicking an existing manual identity loads it for correction.
- Public variant API prioritizes locked admin override over retailer data, retailer over unlocked manual fallback, and history last.
- Canonical phone summary prices honor locked overrides while still tracking automatic retailer offers.

## Safety rules
1. No cross-market overwrite.
2. No PTA/Non-PTA overwrite.
3. No RAM/storage/color cross-variant fallback after a variant is selected.
4. No duplicate admin override for the same exact identity.
5. Reset removes only the exact override; retailer/history data is retained.
6. Automatic sync continues to collect source prices even while an exact manual override is locked.

## Verification
Static audit script: scripts/price-control-final-audit.mjs
Full Next.js build still requires project dependencies (`node_modules`) in the deployment environment.
