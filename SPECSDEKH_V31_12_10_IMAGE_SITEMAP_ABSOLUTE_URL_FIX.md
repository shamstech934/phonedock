# SpecsDekh v31.12.10 — Image Sitemap Absolute URL Fix

- Converts every relative phone and brand image path into a fully-qualified URL using the production base URL.
- Rejects empty, data:, blob:, malformed, and non-HTTP(S) image values.
- Prevents Google Search Console "Invalid URL" errors such as `/brands/samsung.png`.
- Keeps page `<loc>` and image `<image:loc>` canonical and XML-escaped.
