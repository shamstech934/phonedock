# Deployment and Rollback

## Pre-deployment gate

1. Use Node 22 and run `npm ci`.
2. Configure all production variables from `.env.example`; run `npm run env:check`.
3. Verify MongoDB connectivity, replica-set support, indexes and a recent restore-tested backup.
4. Run typecheck, lint, unit/regression, build and Playwright against staging.
5. Confirm canonical base URL, robots policy, SMTP, Turnstile, Cloudinary, cron and affiliate allowlists.
6. Record the release identifier through `APP_RELEASE`.

## Deploy

Deploy an immutable artifact from the reviewed commit. Run migrations once with an audited operator. Smoke-test `/`, `/brands`, search, a phone detail page, compare, account login and admin login. Verify cron authentication without executing destructive jobs.

## Rollback

Retain the previous artifact and configuration. Stop new background jobs, roll back application code, and only reverse a data migration when its documented reverse operation is safe. Restore a database only after preserving the failed-state backup. Re-run smoke tests and document timestamps, operator and impact.

## Required production services

Application monitoring, centralized structured logs, uptime checks, alert routing, MongoDB alerts, SMTP delivery monitoring and scheduler failure alerts are release requirements. Analytics is consent-gated and is not an operational monitor.
