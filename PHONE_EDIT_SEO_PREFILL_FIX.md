# Phone Edit SEO Prefill Fix — v31.12.29

The edit form previously used nullish-coalescing for SEO fields. Empty strings returned by the API are not null/undefined, so generated SEO defaults were never applied.

The form now trims stored values and falls back to generated title, description, and keywords when the stored values are blank. Existing non-empty custom SEO content is preserved.
