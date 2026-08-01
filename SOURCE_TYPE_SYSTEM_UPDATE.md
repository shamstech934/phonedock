# SpecsDekh v27.4.0 — Extended Source Type System

## Added source types

- Retailer
- Marketplace
- Official Store
- Official Brand
- Reference Site
- Distributor
- API
- RSS Feed
- Manual

## Safety and compatibility

- Existing `official` database values remain valid and display as **Official Store**.
- The Mongoose model, API validation and admin dropdown use one shared source-type definition.
- Manual sources may be saved without a base URL.
- Manual and RSS sources are not sent through the retailer price-page test action.
- Unknown legacy values safely fall back to Retailer in the admin UI.
- Source badges and helper descriptions are normalized.

## Verification

- Price-source manager audit: passed.
- Source-type consistency audit: passed (9 types).
- Production static audit: passed (92 routes, 0 broken links).
- Full TypeScript/build validation requires installed npm dependencies and will run in GitHub Release Gate/Vercel.
