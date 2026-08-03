# Remaining Issues Report

## Release blockers

There are no confirmed source-code blockers from the completed static audits.

One certification blocker remains external to the repository:

- The sandbox npm mirror returns 404 for `zod-validation-error@4.0.2`, preventing a clean dependency install and therefore preventing full lint/typecheck/test/build certification here.

## Production checks still required after deployment

1. Run `npm ci --include=dev` and `npm run release:gate`.
2. Confirm MongoDB indexes and migrations against the production database.
3. Test one real product URL for every enabled price source.
4. Execute one manual collector run and verify queue recovery, retry, history, and review records.
5. Perform authenticated browser smoke tests for create/edit/delete/save on critical admin pages.
6. Verify email, analytics, cron, image/CDN, and external retailer integrations with production environment variables.

These are environment-dependent acceptance checks, not hidden code-completion claims.
