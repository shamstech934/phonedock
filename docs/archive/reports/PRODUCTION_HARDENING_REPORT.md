# PhoneDock v5.1 Production Hardening Report

## Implemented fixes

- Compare flow now uses a shared 2–6 phone contract for URL parsing, duplicate removal, picker limits, API lookup and UI counters.
- Compare tests validate behavior through `MAX_COMPARE_PHONES`, `normalizeCompareValues` and `canAddComparePhone` rather than source-text matching.
- Import archive parsing uses JSZip and spreadsheet parsing uses ExcelJS; vulnerable `adm-zip` and `xlsx` packages are absent.
- HTML rendering uses an allowlist sanitizer and stored-XSS tests cover scripts, handlers, encoded JavaScript URLs, data URLs, SVG and MathML payloads.
- SSRF validation accepts an injectable DNS resolver. Tests now use controlled public/private DNS results and no external DNS.
- `tsx` is pinned as a development dependency and all test scripts run locally without package downloads.
- MongoDB-backed pages are dynamically rendered or safely tolerate an absent database during CI/build collection.
- ImportBatch nested schemas keep existing `errors` and `collection` stored keys for backward compatibility while suppressing Mongoose reserved-key warnings explicitly on the affected schemas.
- Manufacturer collector is explicitly unsupported until a vendor-approved adapter is installed; it no longer appears to be a working generic scraper.
- Public compare page client directive ordering was fixed for production compilation.
- Next output tracing is constrained to the project root.
- Project version is 5.1.0.

## Verification completed

- `npm ci --ignore-scripts`: 603 packages installed, 0 vulnerabilities.
- `npm run typecheck`: passed with 0 TypeScript errors.
- `npm test`: all configured suites passed, including 40 import hardening checks, 43 SSRF checks, 9 sanitizer checks and 6 compare checks.
- `npm run lint`: exited 0 with 0 errors and 201 legacy warnings. Duplicate base TypeScript reports and generated UI/test noise were removed through scoped lint policy; warnings were not globally disabled.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- Production compilation reached successful compilation and static generation. In this constrained container, the Next.js build worker did not terminate after page-data/build-trace collection, so a clean exit could not be recorded.
- Playwright Chromium could not be installed because the environment could not resolve `cdn.playwright.dev`; E2E was therefore not falsely marked as passed.

## Environment-dependent verification still required

1. Run `npm run build` in Vercel or a normal CI runner and require exit code 0.
2. Run `npx playwright install chromium` and `npm run test:e2e` where browser downloads are allowed.
3. Test authenticated admin workflows with a real MongoDB instance and a seeded admin account.
4. Test SMTP, Cloudinary, AdSense, GA4, Clarity and affiliate tracking only after real account IDs are configured.

## Deployment variables

Required for production:

- `MONGODB_URI`
- `JWT_SECRET`
- `USER_JWT_SECRET`
- `NEXT_PUBLIC_BASE_URL`

Optional integrations are documented in `.env.example` and the setup guides under `docs/`.

## Deployment steps

1. Extract the project and push the project root to GitHub.
2. Import the repository into Vercel.
3. Add required environment variables for Production, Preview and Development as appropriate.
4. Use `npm ci` as install command and `npm run build` as build command.
5. Leave Output Directory empty for Next.js.
6. Run database migrations/index setup according to the existing deployment documentation.
7. After deploy, run Playwright against the deployed URL by setting `TEST_BASE_URL`.
