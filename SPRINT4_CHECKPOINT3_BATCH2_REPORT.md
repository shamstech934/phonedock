# Sprint 4 — Checkpoint 3 — Batch 2

## Cache invalidation and content freshness

- Added centralized `revalidatePublicContent()` helper.
- Homepage `home-data` tag is invalidated immediately after admin content changes.
- Relevant public pages are revalidated after phone, brand, news, video, and sponsor mutations.
- Featured/trending toggles now refresh homepage cards immediately.
- Phone deletion refreshes listings, compare/search surfaces, and the deleted phone route.
- Existing price-specific revalidation remains intact.

## Why this matters

Before this batch, the homepage/API could continue serving stale content for up to the cache TTL after an admin edit. This batch preserves caching performance while making admin updates visible immediately.
