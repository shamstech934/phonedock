# PhoneDock Vercel Install Recovery

Date: 2026-07-20

## Fix applied

This recovery package is based on the last stable `phonedock-main (28)` release.

- Restored the known-good dependency manifest and lockfile.
- Removed the final-release dependency migration that caused Vercel's `npm install` stage to fail.
- No new package dependency, override, database migration, or environment variable was added.
- Application code remains at the deployed Checkpoint 6 Batch 3 state.

## Local verification

- `npm install --no-audit --no-fund`: passed (494 packages installed)
- TypeScript: passed
- ESLint: 0 errors (existing non-blocking warnings remain)
- Existing automated test suite: passed through all executed suites
- Launch security tests: 7/7 passed
- Next.js production build: compiled successfully in 27.4 seconds; the runner timed out during Next.js's final TypeScript phase, while the independent TypeScript check had already passed.

## Vercel deployment

Deploy this package, then use **Redeploy** with **Use existing Build Cache disabled** once, so Vercel does not reuse the failed dependency cache.
