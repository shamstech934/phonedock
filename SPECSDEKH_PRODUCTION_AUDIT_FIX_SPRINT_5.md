# SpecsDekh Production Audit — Fix Sprint 5

## Price Tracker variant-safety hardening

Implemented conservative retailer-page verification before any detected price can update a phone:

- Extracts `og:title`, Twitter title, or HTML `<title>` from the retailer page.
- Verifies that the retailer title matches the linked phone model.
- Verifies configured RAM and storage variants when those values are present on the listing.
- Detects PTA-approved vs non-PTA mismatches.
- Moves mismatched listings back to `pending` review instead of applying a potentially wrong price.
- Saves the latest retailer page title to `sourceTitle` for admin review.
- Keeps pages without a usable title compatible with the existing trusted/manual verification workflow.
- Adds regression coverage for correct model, wrong model, wrong storage, and PTA mismatch cases.

## Verification

- `npm run audit:static`: passed (87 routes, 0 broken links, 0 old-domain references).
- `npm run audit:cron`: passed (5 cron jobs verified).
- The isolated TypeScript test could not be executed because the sandbox npm mirror returned 404 for `tsx`; the test file is included for CI/Vercel/GitHub execution.
