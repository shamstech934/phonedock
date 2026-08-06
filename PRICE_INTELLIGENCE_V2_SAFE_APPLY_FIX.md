# SpecsDekh v31.12.23 — Price Intelligence V2 Safe Apply Fix

## Completed

- Review-only signals no longer display an Apply button.
- Missing product links now direct the admin to link a retailer product.
- Unverified coverage directs the admin to verify listings.
- Missing trusted coverage directs the admin to match/configure a trusted source.
- Apply is shown only for a positive `recommended_market_price` with a source and retailer URL.
- The API revalidates the exact listing at apply time:
  - source is enabled, trusted and active;
  - listing is enabled, verified and available;
  - listing has a positive price;
  - listing URL and source still match the signal;
  - retailer price has not changed since the signal was created.
- Price changes above 35% and manually locked prices require an explicit admin confirmation.
- Price Intelligence scans now default to 25 phones and have a hard maximum of 50 per request.
- Per-phone signal writes were consolidated into a single unordered `bulkWrite` call.
- Existing public prices are never changed by a scan; only an approved verified recommendation can update them.

## Verification

`node scripts/price-intelligence-safe-apply-audit.mjs` passes all checks.

Full Next.js build was not run in this extracted workspace because `node_modules` was not included in the uploaded ZIP.
