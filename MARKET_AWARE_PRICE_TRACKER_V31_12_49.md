# SpecsDekh v31.12.49 — Market-Aware Price Tracker

This release separates Pakistan PTA, Pakistan Non-PTA, and USA Retail prices end-to-end.

## Price buckets
- Pakistan PTA Approved — PK / PKR
- Pakistan Non-PTA — PK / PKR
- USA Retail — US / USD
- RAM, storage, color, condition, and warranty remain part of the physical variant identity.

## Safety
- US/USD prices can never overwrite Pakistan `pricePKR` / `currentPrice`.
- PTA and Non-PTA remain separate Pakistan buckets.
- Unknown Pakistan PTA classification remains review-only.
- Changing a source market/currency resets linked listings to pending verification instead of reinterpreting old values.
- Legacy Pakistan prices remain PK/PKR by default.

## Tracker and admin
- Price sources now carry market and currency.
- Listings and history carry market, currency, price type and market-aware identity keys.
- Phone editor supports Pakistan PTA, Pakistan Non-PTA and USA Retail manual variant rows.
- Pending review and history display the correct PKR or USD currency.
- Pakistan Intelligence explicitly ignores US listings.

## Public experience
- Phone detail can switch Pakistan / USA market.
- Pakistan offers PTA / Non-PTA selection; USA uses US Retail.
- Public display can switch PKR / USD; conversions are marked approximate and never mutate stored source prices.
- The PKR/USD preference is remembered in the browser.
- Exact RAM/storage/color selection never borrows another variant price.

## FX
- USD/PKR is cached server-side and used only for display conversion.
- Actual US Retail USD prices remain distinct from converted Pakistan prices.
