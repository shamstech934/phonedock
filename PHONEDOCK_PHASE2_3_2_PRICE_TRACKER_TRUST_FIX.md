# PhoneDock Phase 2.3.2 — Price Source Trust Validation Fix

## Fixed
- Confidence values stored on a 0–1 scale are displayed as percentages (0.98 -> 98%).
- JSON-LD, meta, data-attribute and visible PKR prices use an explicit minimum trust threshold of 70%.
- A valid JSON-LD PKR price no longer returns the contradictory "No reliable PKR price" result.
- Source verification enforces the configured allowed domain.
- Wrong-domain tests return the exact expected source domain instead of a generic extraction error.
- Failed validation remains inside the result panel instead of creating a duplicate generic page error.
- Successful validation shows a green trusted/ready confirmation and persists the verification URL.

## Expected behavior
- Testing Samsung Pakistan with a specsdekh.com URL fails with a wrong-domain message.
- Testing Samsung Pakistan with a valid samsung.com product page and detected PKR price can pass.
- Confidence 0.98 is rendered as 98%.

## Validation
- Added `scripts/__tests__/price-source-trust-v2.3.2.test.ts`.
- Static focused assertions passed in the build environment.
- Full dependency-backed build was not available because node_modules were not included in the uploaded project.
