# SpecsDekh 20.0 — Consolidated Production Status

This package consolidates the rebrand, data-integrity, admin/automation, launch-intelligence, monitoring, deployment-audit, import rollback, routing, database compatibility, cron, and retailer-listing validation work into one release candidate.

## Completed and statically verified

- SpecsDekh branding and `https://specsdekh.com` canonical origin
- Public, admin, PWA, SEO, manifest, structured-data, and social metadata branding
- Admin navigation grouping and route coverage
- Import V2 persistence, batching, resume/retry, rollback tracking, image recovery, benchmark restoration, and imported price history
- Legacy import rollback implementation
- CSV malformed-file validation correction
- Data Quality refresh/full-scan/fix workflows and admin notification cleanup
- Automation pipeline, launch intelligence, intelligence center, continuous monitoring, and release-readiness screens
- MongoDB variable compatibility (`MONGODB_URI` preferred, `MONGO_URL` supported)
- Vercel cron route/schedule contract audit
- Nested admin-login URL recovery and canonical-host redirects
- Price Tracker retailer title/model/RAM/storage/PTA mismatch safeguards
- Static internal-route, legacy-domain, and visible legacy-brand checks
- Admin/API literal contract audit
- Secret and runtime configuration audit scripts

## Mandatory deployment certification

Run in GitHub Actions or a normal npm registry environment:

```bash
npm ci
npm run release:gate
```

The release gate runs runtime checks, secret scanning, route/branding audit, cron audit, admin/API audit, lint, TypeScript, regression tests, and the Next.js production build.

## Production smoke test

After deployment:

```bash
BASE_URL=https://specsdekh.com npm run smoke:production
```

No feature should be considered runtime-certified until the complete release gate and production smoke test pass in the deployment environment.
