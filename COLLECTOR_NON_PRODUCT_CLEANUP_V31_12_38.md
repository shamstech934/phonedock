# Collector Non-Product Import Guard — v31.12.38

## Implemented
- Strict page classifier: `product | catalog | brand_listing | price_range | article | navigation | unknown`.
- Dedicated WhatMobile parser accepts only one-segment `Brand_Model-Variant` product URLs and rejects catalog, price-range and article pages.
- Samsung collector rejects Compare, All about Galaxy, campaigns, support, offers and other navigation pages.
- Catalog pages are discovery-only and can no longer be parsed/imported as a Phone fallback.
- Product fetches are reclassified using final HTML before a draft is created.
- Approval/import has a second safety gate, preventing legacy bad drafts from becoming Phone records.
- Genuine model titles are normalized to remove WhatMobile / Price in Pakistan boilerplate and duplicate brand prefixes.

## Existing data cleanup
No database records are auto-deleted.

1. `npm run data:report-non-products -- --output=non-product-phone-review.csv`
2. Review the report.
3. Put confirmed IDs in `reports/confirmed-non-product-phone-ids.txt`, one per line.
4. Dry run: `npm run data:delete-confirmed-non-products -- --confirm-file=reports/confirmed-non-product-phone-ids.txt`
5. Execute only after confirmation: append `--execute`.

Deletion is guarded by the classifier and cascades related specs, images, prices, benchmarks, reviews, histories, retail listings, tracker records and data-quality issues.

## Export-derived review list
`reports/non-product-phone-review-from-exports.csv` contains 30 obvious suspects from the three supplied exports. All are marked `Confirmed For Deletion = NO`; this is a review list, not a deletion instruction.
