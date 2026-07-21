# Staging validation

Use a production-like MongoDB database and separate staging integrations. Never copy production credentials into source control.

## Required environment

Configure the variables documented in `.env.example`, then run `npm run env:check`. Use `TEST_BASE_URL=https://staging.example.com` to test an already deployed staging site. Optional authenticated tests use dedicated, low-privilege staging credentials:

- `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`
- `E2E_ADMIN_COOKIE`: a short-lived cookie for a staging test admin

Tests skip credential-dependent cases when these are absent. Never use a production administrator or customer account.

## Gate commands

```bash
npm ci
npm run env:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright runs both desktop Chromium and a Pixel 7 viewport. The suite covers public navigation, comparison, invalid-login safety, accessibility, and optional authenticated user/admin checks. Existing import and authorization regression tests run under `npm test`; staging import testing must use a disposable test record and verify cleanup manually.

Before approval, manually verify signup, email delivery/verification if enabled, logout/revocation, each admin role, one import with rollback, one price-alert notification, Turnstile, Cloudinary upload, affiliate redirects, sitemap/robots, and application logs containing request/job IDs.
