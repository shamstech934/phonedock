# Combined Audit Cleanup Patch

## Changed

- Consolidated all Markdown documentation inside `/docs`.
- Moved old `/download/*.md` reports to `/docs/archive/legacy-audits`.
- Removed generated `tsconfig.tsbuildinfo`.
- Removed stale `.zscripts/dev.pid`.
- Expanded the release cleanup script to remove stale PID files.
- Added a current audit report and documentation index.

## Deployment

No database migration or environment-variable change is required.

Run:

```bash
npm ci
npm run typecheck
npm test
npm run test:launch
npm run build
```
