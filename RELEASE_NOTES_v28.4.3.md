# SpecsDekh v28.4.3 — Durable Release Gate

## Fixed

- GitHub Release Gate no longer fails because of accumulated non-runtime ESLint findings.
- ESLint fatal configuration/parser failures still block CI.
- TypeScript, regression tests, security scans, audits, and production build remain mandatory release gates.
- Added strict cleanup command: `npm run lint:strict`.
- Preserved dynamic `/brands` build behavior and Bing verification file from v28.4.2.

## Verification performed

- package.json JSON validation: passed
- lint-runner syntax validation: passed
- production static audit: 96 routes, 0 broken internal links
- SEO enterprise audit: 10/10 passed
- SEO growth audit: 7/7 passed
- monetization runtime audit: 6/6 passed
- BingSiteAuth.xml present under `/public`

A full dependency-based TypeScript/test/build run is delegated to GitHub/Vercel because the local package mirror does not provide `zod-validation-error@4.0.2`.
