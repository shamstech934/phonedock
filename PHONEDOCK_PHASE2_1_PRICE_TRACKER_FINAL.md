# PhoneDock Phase 2.1 — Price Tracker consolidated completion

## Implemented
- Source manager with official/retailer/distributor/reference classifications
- Official Pakistan source seed command (`npm run seed:price-sources-pk`)
- Trusted-source and allowed-domain controls
- Product-page identity validation and SSRF protection
- Deterministic PKR extraction from JSON-LD, meta, data attributes and visible text
- Bounded oldest-first scheduled processing
- Distributed job lock and safe manual Run Now path
- Per-listing and per-source exponential retry schedule (15 minutes up to 24 hours)
- Failed listing quarantine after repeated failures
- Automatic health recovery after successful checks
- Price history, pending review thresholds, manual-lock protection and cache revalidation
- Lowest/highest/current/previous price updates
- Activity/admin source testing support

## Official Pakistan source onboarding
Run:

```bash
npm run seed:price-sources-pk
```

Sources are inserted as untrusted by design. Add a real model product URL, test it, then mark the source trusted. A catalogue/homepage URL is not considered a verified product listing.

## Deployment requirements
- Node 22 is the default runtime; manifest also supports Node 24 LTS.
- Configure `MONGO_URL`/database variables and `CRON_SECRET`.
- Install dependencies using the public npm registry.
- Run `npm run release:gate` in GitHub/Vercel CI.

## Verification performed in the repair environment
- Price source manager audit: passed
- Price source type audit: passed
- Price Tracker Phase 3 audit: 8/8 passed
- Automation runtime readiness: 6/6 passed
- Cron configuration audit: passed (5 jobs)
- Phase 2.1 completion static audit: 15/15 passed

A live database and external retailer websites are required for final network extraction checks. The source records intentionally remain untrusted until a real product URL passes the admin Test Source action.
