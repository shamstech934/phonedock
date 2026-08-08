# PhoneDock Price Review Queue Consolidation Fix

This build continues the existing Admin Data Control + Sync + Lifecycle tree.

## Fixed in this pass
- Price sync no longer reports a single ambiguous `awaiting review` number.
- Sync results now separate pending price changes from pending retail-listing verification.
- Price Control Review Queue now loads both pending PriceTrackerHistory changes and pending PhoneRetailListing verification items.
- Overview pending-review count now includes both review domains.
- Retail-listing review cards show source, variant identity, reason and retailer URL.
- Admin can safely edit RAM/storage/color/condition/PTA/warranty then `Save & verify`.
- Admin can `Reject & disable` a bad listing.
- Backend blocks verification of Pakistan listings without explicit PTA Approved / Non-PTA classification and blocks unknown price types.
- Review actions refresh queue, overview, sources and phone state.

## Static verification completed
- price-review-queue-consolidation-audit: 13/13 PASS
- price-control-final-audit: 10/10 PASS
- consolidated-production-audit: PASS

Full Next.js build was not executed in this container because project dependencies are not installed in this extracted tree. Vercel/GitHub CI remains the production compiler/runtime gate.
