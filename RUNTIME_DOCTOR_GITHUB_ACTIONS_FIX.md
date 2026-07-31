# Runtime Doctor GitHub Actions Fix

## Problem
The release workflow completed `npm ci`, but `doctor:runtime` reported ESLint and TSX as missing.

## Root cause
The old doctor resolved private executable subpaths such as `eslint/bin/eslint.js` and `tsx/dist/cli.mjs`. Modern packages can block those private paths through their `exports` field even when the packages and command-line binaries are correctly installed.

## Fix
- Runtime Doctor now reads each package's public `package.json`.
- It checks the executable declared in the package's `bin` field.
- The GitHub workflow explicitly installs development dependencies with `npm ci --include=dev`.
- The check remains strict: genuinely missing tools still fail the release gate.

## Files changed
- `scripts/runtime-doctor.mjs`
- `.github/workflows/release-gate.yml`
