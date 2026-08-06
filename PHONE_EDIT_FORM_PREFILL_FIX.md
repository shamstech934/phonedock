# Phone Edit Form Prefill Fix — v31.12.25

- Fixed admin edit form price mapping (`pricePKR`/`currentPrice` -> Pakistani Price PKR).
- Fixed thumbnail mapping (`thumbnail` -> thumbnail URL), with first image fallback.
- Added missing SEO title, SEO description, and keywords to the admin phone detail API serializer.
- Added compatibility aliases (`pakistaniPricePKR`, `thumbnailUrl`) to prevent future form/API drift.
- Normalized all lifecycle dates to `YYYY-MM-DD` for HTML date inputs.
- Preserved specs, numeric filter fields, benchmarks, image gallery, retailer prices, reviews, scores, and price-tracking mappings.
