# PhoneDock Phase 2 — Price Tracker Checkpoint 2

## Fixed in this checkpoint

- Corrected the GitHub `verify` regression failure from `runtime-doctor.test.ts`.
- `package.json` and the root package-lock manifest now describe both supported Node LTS lines: Node 22 and Node 24.
- PhoneDock remains deployed and tested on Node 22 by default through `.nvmrc`, `.node-version`, and the GitHub Actions workflow.
- Updated the older enterprise-release assertion so it no longer contradicts the current runtime policy.
- Updated active runtime documentation to match the same policy.

## Runtime policy

- Default runtime: Node.js 22
- Compatible LTS runtime: Node.js 24
- Engine range: `>=22.12.0 <23 || >=24.0.0 <25`

## Validation performed

- Confirmed `package.json` and `package-lock.json` parse successfully.
- Confirmed the runtime regression-test regular expression accepts the new engine range.
- Confirmed `.nvmrc` and `.node-version` both select Node 22.
- Confirmed GitHub Actions continues to use Node 22.

## Environment limitation

A complete `npm ci`/build could not be run in the artifact environment because its internal npm mirror returned HTTP 404 for `zod-validation-error-4.0.2.tgz`. The repository lockfile and application code were not the cause of that registry response. GitHub Actions uses the public npm registry and can run the complete verification there.
