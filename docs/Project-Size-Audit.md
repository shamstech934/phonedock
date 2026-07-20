# PhoneDock Project Size Audit

## Finding

The previous deployment ZIP was approximately **223 MB compressed** and expanded to roughly **715 MB** because it accidentally included generated folders:

- `node_modules/` — about 670 MB
- `.next/` — about 42 MB

These folders are not source code and must never be uploaded to GitHub or included in a handoff ZIP. Vercel installs dependencies from `package-lock.json` and creates `.next/` during the build.

## Fix applied

- Removed `node_modules/` and `.next/` from the release package.
- Confirmed both folders are already covered by `.gitignore`.
- Added `npm run clean` and `npm run release:prepare`.
- Release ZIP now contains source files only.

## Safe deployment workflow

1. Run `npm run release:prepare` before creating a ZIP.
2. Upload source files to GitHub.
3. Do not upload `node_modules`, `.next`, logs, test reports, or local environment files.
4. Vercel should use `npm ci` / automatic install and `npm run build`.

## Verification

- Fresh `npm ci`: passed.
- TypeScript: passed.
- Launch checks: 7/7 passed.
- Dependency audit currently reports 2 moderate and 2 high advisories. They were not force-upgraded because automatic major-version upgrades can break the application; they need a controlled dependency review.
