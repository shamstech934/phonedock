# SpecsDekh v31.12.8

- Removed the duplicate Next.js metadata sitemap route that could intercept `/sitemap.xml` and produce a 308 redirect.
- Kept the explicit XML sitemap index route as the single canonical sitemap endpoint.
- Restored the homepage section-order regression contract for Latest and Trending sections.
- Preserved the six-column homepage card layout and existing admin/data features.
