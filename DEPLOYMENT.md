# Deployment and Rollback

## Pre-deployment gate

1. Use Node 22 and run `npm ci`.
2. Configure all production variables from `.env.example`; run `npm run env:check`.
3. Verify MongoDB connectivity, replica-set support, indexes and a recent restore-tested backup.
4. Run typecheck, lint, unit/regression, build and Playwright against staging.
5. Confirm canonical base URL, robots policy, SMTP, Turnstile, Cloudinary, protected maintenance endpoints and affiliate allowlists.
6. Record the release identifier through `APP_RELEASE`.

## Deploy

Deploy an immutable artifact from the reviewed commit. Run migrations once with an audited operator. Smoke-test `/`, `/brands`, search, a phone detail page, compare, account login and admin login. Verify protected maintenance endpoint authentication without executing destructive jobs.

## Rollback

Retain the previous artifact and configuration. Stop new background jobs, roll back application code, and only reverse a data migration when its documented reverse operation is safe. Restore a database only after preserving the failed-state backup. Re-run smoke tests and document timestamps, operator and impact.

## Required production services

Application monitoring, centralized structured logs, uptime checks, alert routing, MongoDB alerts, SMTP delivery monitoring and scheduler failure alerts are release requirements. Analytics is consent-gated and is not an operational monitor.

## Vercel Hobby / free-plan profile

`vercel.json` intentionally contains no scheduled cron jobs. Heavy Collector, Price Sync, Data Quality and monitoring work is admin-triggered so background compute cannot continuously consume the Hobby Active CPU allowance. Public API traffic is routed through smaller dedicated route bundles where possible instead of forcing common phone/search requests through the large admin catch-all bundle.

If the Vercel account has already exceeded its Active CPU allowance, a code deployment does not erase previously consumed usage. Deploy this cleaned profile when Vercel allows deployments/functions again, then review Usage by project/function before re-enabling any scheduled automation.
