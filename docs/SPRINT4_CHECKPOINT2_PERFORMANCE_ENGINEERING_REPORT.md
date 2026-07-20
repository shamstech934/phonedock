# Sprint 4 – Checkpoint 2: Performance Engineering

## Implemented in this checkpoint

### 1. Homepage ISR enabled
- Removed `dynamic = 'force-dynamic'` from the homepage.
- Added a five-minute `revalidate` window.
- The homepage can now be served from the Next.js cache instead of waiting for MongoDB on every request.

### 2. Expensive homepage payload cached
- Wrapped the homepage aggregation in `unstable_cache`.
- Cache duration: 300 seconds.
- Added the `home-data` cache tag so admin mutations can later trigger immediate invalidation.
- This reduces repeated MongoDB queries, populates, counts, aggregation, and specs loading.

### 3. Quick-view code deferred
- `PhoneQuickViewDialog` is now dynamically imported.
- The dialog component is only mounted when the user opens Quick View.
- Normal page visitors no longer execute/render a dialog instance for every phone card.

## Verification
- `npm run typecheck`: passed.
- `next build` compilation: passed (`Compiled successfully`).
- The build process reached the final TypeScript stage; the remote execution session timed out while Next.js continued its post-compilation checks. The standalone TypeScript check had already passed.

## Deferred to the next performance checkpoint
- Split the large homepage client component into server-rendered sections and small client islands.
- Server-render complete phone detail data and remove its duplicate browser fetch.
- Lazy-load price history, price tracker, and reviews based on visibility/tab activation.
- Convert public listing routes to server-first rendering.
- Add route bundle analysis and production Lighthouse measurements.
