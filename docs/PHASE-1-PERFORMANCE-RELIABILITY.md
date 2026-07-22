# Phase 1 performance and reliability

## Public caching

| Data/page | TTL | Tags |
| --- | ---: | --- |
| Homepage sections | 300 seconds | `home-data` |
| Phone listings and details | 300 seconds | `phones`, plus `prices`/`reviews` for detail data |
| Rankings and upcoming phones | 300 seconds | `phones`, `rankings` |
| Brands | 900 seconds | `brands`, `phones` |
| News and reviews | 900 seconds | route revalidation; mutation paths invalidate their tags/paths |
| Sitemap | 3600 seconds | bounded crawler refresh |

Admin, account, authentication, setup, collector, import, cron and other private API responses remain dynamic and `private, no-store`. Public cache loaders contain only published/active records. Admin mutations use `revalidatePublicContent` or `revalidatePricePages` to invalidate affected tags and paths.

## Observability

`src/lib/observability/logger.ts` emits one-line JSON and recursively redacts credential-like keys. `error-tracking.ts` provides an optional provider interface and continues to work without Sentry or another vendor. Configure `APP_RELEASE` and `APP_ENV` to attach release context. Register a provider during server instrumentation when one is selected.

Web Vitals (LCP, INP, CLS, FCP and TTFB) are sent only in production. Initial budgets are LCP 2500 ms, INP 200 ms, CLS 0.1, FCP 1800 ms and TTFB 800 ms. These are launch gates, not measured improvements.

## Database pagination

New high-growth endpoints should use `cursor-pagination.ts`, ordering by `{ createdAt: -1, _id: -1 }`. The `_id` tie-breaker makes ordering deterministic. Existing numbered APIs can retain page parameters while exposing `nextCursor` during migration.

## Query/index validation

Before production, run `explain('executionStats')` against realistic staging data for listing filters, ranking score sorts, search, activity logs, import jobs, collector jobs and price history. Record `totalDocsExamined`, `totalKeysExamined`, execution time and winning index. Do not remove an index without this evidence.

## Measurement limitations

Local builds without MongoDB cannot produce representative query plans, Lighthouse numbers, Web Vitals, or data-backed accessibility results. Run those checks against production-like staging and retain the reports as release artifacts.
