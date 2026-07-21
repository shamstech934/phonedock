# PhoneDock Phase 0 launch-gate implementation

Date: 2026-07-22  
Branch: `codex/phase0-launch-gate`

## Result

The code, regression tests, production build, environment validator, staging harness, and recovery documentation are implemented. Phase 0 is **implementation-complete but launch-gate pending**: authenticated staging tests still require a deployed staging URL/database and staging-only credentials. The local Playwright cases executed on desktop/mobile, but the runner did not exit after its dev server shut down under Node 24 and was terminated by timeout. Re-run the gate on the supported Node 22 runtime.

## Changes

- Consumer sessions now expire after seven days, retain database-backed session-version revocation, and support opt-in email-verification enforcement without weakening admin auth.
- Existing database-backed login/signup throttles and security events are preserved; unverified login attempts receive a safe 403 event. No consumer password-reset route exists, so reset throttling is not applicable yet.
- Shared bounded pagination parsing now protects admin CRUD, data-quality, price-tracker, public API, and import endpoints from invalid, negative, decimal, zero, missing, unsafe, and excessive values.
- High-impact swallowed admin CRUD, phone form, collector, bulk phone, and security-event failures now produce safe UI feedback and/or structured request-aware logs.
- Production startup validates MongoDB, secrets, HTTPS base URL, email, Turnstile, Cloudinary, verification dependencies, and bootstrap-key risk. Affiliate redirects enforce a hostname allowlist and prefer server-only environment variables.
- Playwright has desktop and Pixel 7 projects plus public comparison, login-safety, account, and admin-role staging cases. Credential-dependent tests remain skipped until staging secrets are supplied.
- Added staging and MongoDB backup/restore runbooks.

## Verification performed

- `npm ci`: passed on retry with workspace-local cache; 596 packages added. Node engine warning because this workstation uses 24.18.0 while the repository requires Node 22.
- `npm run typecheck`: passed (exit 0, 67.6s) before browser execution. A later retry encountered Playwright/Next dev-generated `.next/dev` corruption after timeout; generated files were excluded/restored and no source type failure was present.
- `npm run lint`: passed with 0 errors and 186 pre-existing warnings.
- `npm test`: passed; all existing suites and the new Phase 0 suite passed.
- `npm run build`: passed; optimized production build generated all 69 static pages.
- `npm run env:check`: passed with a complete synthetic staging environment.
- targeted ESLint for new tests/validator: passed.
- Playwright discovery: passed, 8 desktop/mobile cases found.
- Playwright execution: cases ran, but command timed out during runner/dev-server cleanup. The initial attempt also exposed missing local MongoDB and browser binaries; browser provisioning was completed and DB-dependent tests were correctly changed to staging-only skips.

## Remaining launch risks

1. Run the full Playwright and accessibility suites against production-like staging on Node 22 with MongoDB and dedicated user/admin credentials.
2. Exercise actual email verification, SMTP, Turnstile, Cloudinary, affiliate allowlists, imports, and price alerts using staging integrations.
3. Existing lint debt remains at 186 warnings, including lower-impact empty catches outside the Phase 0 critical paths.
4. Email verification enforcement architecture is ready, but token issuance/delivery/verification endpoints must be implemented before enabling `REQUIRE_USER_EMAIL_VERIFICATION=true`.
5. Password reset rate limiting must be added when a consumer password-reset workflow is introduced.
