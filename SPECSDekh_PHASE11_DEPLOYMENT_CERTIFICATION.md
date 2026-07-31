# SpecsDekh Phase 11 — Deployment Certification

This phase adds a repeatable release gate rather than another admin page.

## Added

- GitHub Actions release workflow for every push and pull request to `main`.
- Exact dependency installation with `npm ci` on Node.js 22.
- Runtime, secret, static-route, lint, TypeScript, regression-test, and production-build checks.
- Production smoke test for the public website, admin login, and core JSON APIs.
- `npm run ci:release` for the complete local/CI verification sequence.
- `npm run smoke:production` for post-deployment checks against `NEXT_PUBLIC_BASE_URL` or `SMOKE_BASE_URL`.
- Remaining runtime-doctor branding updated from PhoneDock to SpecsDekh.

## Commands

```bash
npm ci
npm run ci:release
SMOKE_BASE_URL=https://specsdekh.com npm run smoke:production
```

## Deployment rule

A release should be promoted only after the GitHub release gate passes and the smoke test succeeds against the deployed production URL.
