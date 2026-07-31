# SpecsDekh Phase 10 — Final Production Audit & Release Gate

## Delivered

- Added `npm run audit:static` for deterministic static release checks.
- Added `npm run release:gate` to run runtime doctor, secret scan, static audit, lint, TypeScript, tests, and production build in one command.
- Audited all App Router pages and internal static links.
- Detects unsafe relative links that can create URLs such as `/compare/admin/login`.
- Detects links to missing pages.
- Detects hardcoded legacy Vercel origins.
- Detects likely user-facing `PhoneDock` branding left behind while allowing intentional compatibility identifiers.
- Validates required production files and verification scripts.
- Writes machine-readable results to `reports/production-static-audit.json`.

## Static audit result

- App pages/routes: 87
- Source files scanned: 300
- Broken internal links: 0
- Unsafe relative links: 0
- Hardcoded old production origins: 0
- Likely user-facing legacy brand references: 0
- Missing required production files: 0
- Missing required scripts: 0

## Verification limitation

`npm ci` could not complete in this workspace because its internal npm mirror returned 404 for `zod-validation-error@4.0.2`. Therefore lint, TypeScript, test, and Next.js build must be executed by GitHub/Vercel using:

```bash
npm run release:gate
```
