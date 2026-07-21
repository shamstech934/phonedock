# PhoneDock Phase 1 — Launch Engineering Implementation

Date: 22 July 2026

## Completed changes

### Performance and caching

- Removed the root-layout `force-dynamic` setting that forced the whole application into request-time rendering.
- Kept database-backed rankings explicitly dynamic at the route boundary.
- Verified that the homepage, marketing/legal pages, account shells, compare, search, auth, wishlist and recently-viewed routes now build as static/ISR output.
- Preserved dynamic rendering for phones, brands, rankings, price ranges and other database-backed routes.

### Consumer authentication security

- Added user `sessionVersion` persistence.
- Added JWT issuer, audience, algorithm, token-size and session-version validation.
- Added database-backed active-user/session-version verification.
- Logout now revokes existing user tokens by incrementing `sessionVersion`.
- Added DB-backed IP and account-key rate limits for login and signup.
- Added security telemetry for successful, failed and rate-limited user auth attempts without storing raw email/IP values.
- Extracted reusable user-security service to avoid duplicating rate-limit logic.
- Removed a deployable placeholder user JWT secret from `.env.example`.

### Reliability and operations

- Applied request-ID middleware to all application requests rather than only admin routes.
- Added a safe bounded-integer parser and replaced malformed pagination paths in public/import APIs.
- Made the price-update cron lock atomic to prevent concurrent serverless invocations.
- Added a price-history compound index for phone/store timeline queries.
- Retained route-level request-size and origin protections.

### SEO

- Added explicit noindex/canonical metadata for account, login, signup, wishlist and recently-viewed pages.
- Preserved existing catalog, compare, search, brand, phone and editorial metadata policies.

### Accessibility

- Added `@axe-core/playwright` and a WCAG A/AA regression suite for homepage, compare, FAQ, login and signup.
- Fixed measured serious contrast failures in the shared header logo and footer text/links/disclaimer.
- Configured accessibility checks to run serially for stable local/CI execution.

### Testing

- Added Phase 1 regression coverage for consumer JWT claims/tampering and bounded pagination.
- Included the new suite in the default `npm test` command.
- Added `npm run test:a11y`.

## Files added

- `src/lib/http.ts`
- `src/lib/user-security.ts`
- `scripts/__tests__/phase1-launch-engineering.test.ts`
- `e2e/accessibility.spec.ts`
- `src/app/account/layout.tsx`
- `src/app/login/layout.tsx`
- `src/app/signup/layout.tsx`
- `src/app/wishlist/layout.tsx`
- `src/app/recently-viewed/layout.tsx`

## Key files modified

- `.env.example`
- `package.json`
- `package-lock.json`
- `src/app/layout.tsx`
- `src/app/rankings/page.tsx`
- `src/proxy.ts`
- `src/lib/models/User.ts`
- `src/lib/models/PhoneSub.ts`
- `src/lib/user-auth.ts`
- account login/signup/logout API routes
- public/import API pagination handlers
- price-update cron handler
- shared Header and Footer

## Verification results

- `npm run lint`: pass with zero errors; legacy warning backlog remains.
- `npm run typecheck`: pass.
- `npm test`: pass, including the new Phase 1 suite.
- `npm run build`: pass.
- `npm audit --omit=dev`: zero vulnerabilities.
- Axe: detected real shared contrast failures, which were fixed. Targeted compare test passed after browser installation. Full local run is affected by Playwright web-server teardown under the host's unsupported Node 24; project CI/runtime target remains Node 22.

## Measured production impact

- Before: root configuration made virtually the entire app dynamic.
- After: build produces 69 static-generation candidates with public static/ISR routes and narrowly scoped dynamic DB routes.
- Authentication now supports immediate global user-session revocation.
- Login/signup abuse is constrained by persistent serverless-safe counters.
- Duplicate price cron invocations are atomically rejected.

## Risks and migration notes

- Existing user tokens issued before `sessionVersion` was introduced will be rejected; users must sign in again. This is intentional security hardening.
- MongoDB will create the new price-history index during deployment. For a large collection, create/monitor it through Atlas before peak traffic.
- Broad proxy matching adds a small middleware invocation cost but provides request IDs consistently.
- Node 22 is required by the declared project engine. Use Node 22 for CI and deployment.

## External launch gates still required

Phase 1 cannot honestly be declared 90/100 complete from an offline source archive alone. The following require the deployment owner/infrastructure:

1. Full Playwright and axe runs on Node 22 against a staging MongoDB dataset.
2. Role-matrix admin E2E with real sessions.
3. SMTP, Turnstile, Cloudinary, YouTube and affiliate integration checks.
4. MongoDB transaction/replica-set behavior and migration verification.
5. Backup creation plus a measured restore drill.
6. Load tests, query explain plans and Web Vitals from a deployed URL.
7. Error tracking/log drain/alert destination configuration.

Until those gates pass, recommended readiness is approximately **84–86/100**, not 90/100.
