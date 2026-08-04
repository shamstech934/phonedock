# SpecsDekh v31.12.16 — Search, Compare and CPU Optimization

## Search
- Added 320 ms debounce, AbortController cancellation and stale-response protection.
- Added five-minute client autocomplete cache.
- Replaced aggregation + full brand lookup on each autocomplete request with bounded Brand + Phone queries.
- Limited autocomplete payload to 10 lightweight results.
- Increased CDN cache to 5 minutes with 30-minute stale-while-revalidate.
- Full search now uses bounded queries and only aggregates counts for matched brands.

## Compare
- Added client caches for phone lookup and autocomplete.
- Increased compare API edge caching.
- Added modern gradient header and cleaner actions.
- Added Display, Performance, Camera, Battery, Body and Connectivity tabs.
- Preserved 2–4 phone selection, only-differences, winners, sharing and mobile horizontal table.

## Vercel CPU
- Removed expensive autocomplete aggregation pipeline from the hot typing path.
- Reduced query result sizes and repeated database work.
- Repeated searches and comparisons are served from browser/CDN cache where possible.

## Validation
- `npm run audit:search-compare-performance` passes.
- TypeScript parser reports no JSX/syntax errors in modified files.
- Full typecheck/build could not be completed in this runtime because `node_modules` is not present.
