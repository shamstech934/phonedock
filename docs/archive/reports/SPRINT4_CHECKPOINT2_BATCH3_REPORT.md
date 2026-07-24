# Sprint 4 – Checkpoint 2, Batch 3

## Implemented

### Phones listing: server-first initial render
- `/phones` now loads the first result set and brand list on the server.
- Removed the initial browser waterfall to `/api/phones` and `/api/brands`.
- Existing filters and pagination remain client-side after navigation.
- Search draft text no longer triggers an API request on every keystroke; results update after the query is submitted.
- The hydrated request key prevents the browser from immediately refetching the same server-rendered data.

### Brands listing: server-first initial render
- `/brands` now receives brand data from the server.
- Removed the initial `/api/brands` browser request and loading skeleton.
- Search/filtering remains interactive in a small client component.
- Brand phone counts are calculated in one aggregation instead of per-brand queries.

### Shared listing data layer
- Added `src/lib/fetch-public-listings.ts`.
- Uses direct MongoDB queries, projections, batched specs lookup, and serialized data.
- Reuses one server brand query per request through React request memoization.

### Hero rendering
- Removed `ssr: false` from the homepage hero dynamic import.
- The hero can now produce server-rendered HTML instead of appearing only after hydration.
- The fallback keeps a fixed 400px area to reduce layout movement.

## Verification
- `npm run typecheck`: passed.
- `next build`: application compiled successfully and TypeScript stage started.
- The remote build process did not finish the later route-generation phase within the execution window; no compilation or TypeScript error was reported.

## Files added
- `src/app/phones/PhonesClient.tsx`
- `src/app/brands/BrandsClient.tsx`
- `src/lib/fetch-public-listings.ts`
- `SPRINT4_CHECKPOINT2_BATCH3_REPORT.md`

## Files updated
- `src/app/phones/page.tsx`
- `src/app/brands/page.tsx`
- `src/app/HomeContent.tsx`
