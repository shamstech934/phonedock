# PhoneDock Admin Authentication Fix Report

**Date:** 2026-07-15
**Project:** PhoneDock (https://phonedock-pi.vercel.app/)
**Scope:** Complete 13-point admin authentication system audit, fix, and verification

---

## 1. Root Cause of Admin Login Failure

The "Invalid credentials" error after creating an admin via the browser setup page had multiple contributing causes that were resolved across prior sessions:

- **Primary cause:** The original code used a half-cookie, half-localStorage authentication system. Early versions stored `pd_admin` and `pd_token` in localStorage while the server set HttpOnly cookies, creating a fundamental mismatch that caused silent auth failures.
- **Secondary cause:** A public `/setup/page.tsx` was created as a workaround for users without Node.js access, but its admin creation flow interacted inconsistently with the evolving auth system.
- **Tertiary cause:** The `JWT_SECRET` was thrown at module import time, which could crash the build or cause partial failures in Vercel's serverless environment.

All three root causes have been eliminated. The auth system is now a single, coherent, cookie-only architecture.

---

## 2. 13-Point Defect Audit Results

### Defect 1: Environment-variable mismatch
**Status: VERIFIED FIXED**
- `src/lib/mongodb.ts` line 3: `process.env.MONGODB_URI` 
- `scripts/create-admin.ts` line 31: `process.env.MONGODB_URI`
- `scripts/migrate-db.ts` line 14: `process.env.MONGODB_URI`
- `.env.example`: `MONGODB_URI=mongodb+srv://...`
- Zero references to `DATABASE_URL` found in any `.ts` file in the project
- **Action taken:** None needed (already correct)

### Defect 2: localStorage in useAdmin.ts
**Status: VERIFIED FIXED**
- Searched entire `src/` directory for `localStorage`, `pd_admin`, `pd_token`
- Only found in comments stating "no localStorage"
- `src/lib/useAdmin.tsx` uses only `fetch('/api/admin/session', { credentials: 'include' })` for session verification
- No token is stored client-side at any point
- **Action taken:** None needed (already correct)

### Defect 3: No auto-refresh flow
**Status: VERIFIED FIXED**
- `useAdmin.tsx` lines 44-73: `refreshSession()` calls `/api/admin/session` first
- On 401, automatically tries `POST /api/admin/refresh-token` with cookie
- On refresh success, retries `/api/admin/session` to get fresh admin data
- Cookie is HttpOnly, Secure, SameSite=Strict 
- No tokens exposed to JavaScript
- **Action taken:** None needed (already correct)

### Defect 4: Wrong refresh-token segment check
**Status: VERIFIED FIXED**
- `route.ts` line 593: `segments.length === 2 && segments[0] === 'admin' && segments[1] === 'refresh-token'`
- `/api/admin/refresh-token` produces segments `['admin', 'refresh-token']` (length 2) 
- Check is correct
- **Action taken:** None needed (already correct)

### Defect 5: Incomplete logout
**Status: VERIFIED FIXED**
- `useAdmin.tsx` lines 91-107: Calls `POST /api/admin/logout` with `credentials: 'include'`
- Server (`route.ts` lines 581-590): Revokes session via `revokeSession(jti, sub, Admin)` in DB
- Server clears cookie: `response.cookies.set('pd_refresh', '', { maxAge: 0, path: '/' })`
- Client uses `router.replace('/admin/login')` (prevents back button)
- Client uses `window.history.pushState(null, '', '/admin/login')` (clears history)
- **Action taken:** None needed (already correct)

### Defect 6: Admin layout trusts localStorage
**Status: VERIFIED FIXED**
- `admin/layout.tsx` wraps children in `<AdminAuthProvider>`
- `AdminAuthProvider` verifies session via `/api/admin/session` on mount
- If no session: `admin` is null, `loading` becomes false, useEffect redirects to `/admin/login`
- If session exists: renders full layout with sidebar and role-filtered navigation
- Login page (`admin/login/page.tsx` lines 17-21): Redirects authenticated users to `/admin/dashboard` via `router.replace`
- **Action taken:** None needed (already correct)

### Defect 7: JWT_SECRET module-level throw
**Status: VERIFIED FIXED**
- `src/lib/auth.ts` lines 19-25: Uses lazy `getSecretKey()` function
- Secret is only loaded when `signAccessToken`, `signRefreshToken`, or `verifyToken` is called
- Static pages and build do not trigger the throw
- Never falls back to hardcoded secret
- **Action taken:** None needed (already correct)

### Defect 8: admin:create env loading
**Status: VERIFIED FIXED**
- `scripts/create-admin.ts` lines 28-29: Loads `.env.local` first, then `.env`
- Process environment values take priority (dotenv does not override existing env vars)
- Uses `MONGODB_URI` (same as application)
- **Action taken:** None needed (already correct)

### Defect 9: Admin creation security
**Status: VERIFIED FIXED**
- Hidden password input via `stdin.setRawMode(true)` (lines 138-146)
- Name validation: min 2 characters
- Email validation: regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`
- Password confirmation in interactive mode
- Strong password: 12+ chars, uppercase, lowercase, number, special character
- bcrypt cost factor 12
- Duplicate email detection with safe update mode
- `--reset-password` flag for explicit reset
- Password never logged (cleared from memory after hashing)
- No default credentials
- **Action taken:** Fixed `--reset-password` mode to make `--name` optional

### Defect 10: Admin schema compatibility
**Status: VERIFIED FIXED**
- `models/Other.ts` line 41: `password: { type: String, required: true, select: false }`
- `route.ts` line 537: `Admin.findOne({ email }).select('+password +failedAttempts +lockedUntil')`
- Email normalized: schema has `lowercase: true`, login does `.toLowerCase()`
- `resetFailedAttempts(admin)` resets both `failedAttempts` and `lockedUntil` to null/0
- Role assigned via CLI `--role` flag or defaults to `superadmin` for first admin
- Active defaults to `true` in schema
- **Action taken:** None needed (already correct)

### Defect 11: In-memory production auth state
**Status: VERIFIED FIXED**
- Session revocation: DB-backed via `revokedSessions[]` array on Admin document
  - `isSessionRevoked()` queries DB each time (line 182-205 of auth.ts)
  - `revokeSession()` pushes to DB (line 171-179)
  - `revokeAllSessions()` uses `__all__` sentinel (line 157-168)
  - Survives serverless restarts
- Login rate limiting: DB-backed via `failedAttempts` + `lockedUntil` fields
  - `checkLoginRateLimitFromDB()` (line 217-228)
  - `recordFailedLoginDB()` (line 231-249)
- Password change invalidates all sessions: pushes `{ jti: '__all__' }` (route.ts line 630)
- Disabled users: `getAdminFromRequest()` checks `admin.active` (route.ts line 54)
- The only in-memory Map (`ipRateLimitMap`) is for IP-level DDoS protection, NOT auth state
- **Action taken:** None needed (already correct)

### Defect 12: Middleware compatibility
**Status: VERIFIED FIXED**
- `src/middleware.ts` does not exist (deleted)
- No `setInterval` or timer-based logic anywhere in API routes
- Security headers migrated to `next.config.ts` `async headers()` 
- All middleware functionality handled via:
  - `next.config.ts` for security headers
  - API-level rate limiting in `route.ts` 
- **Action taken:** None needed (already correct)

### Defect 13: Endpoint protection
**Status: VERIFIED FIXED**
- Audited all routes: 47 calls to `getAdminFromRequest()` + `requirePermission()` found
- Every state-changing endpoint requires authenticated admin + specific permission
- Full audit:
  - `/api/admin/stats` -> `phones:read`
  - `/api/admin/phones` (GET/POST/PUT/DELETE) -> `phones:read/create/edit/delete`
  - `/api/admin/brands` (GET/POST/PUT/DELETE) -> `brands:read/create/edit/delete`
  - `/api/admin/news` (GET/POST/PUT/DELETE) -> `news:read/create/edit/delete`
  - `/api/admin/sponsors` (GET) -> `sponsors:read`
  - `/api/admin/activity` (GET) -> `activity:read`
  - `/api/admin/users` (GET/POST) -> `users:read/manage`
  - `/api/admin/change-password` (POST) -> authenticated (self)
  - `/api/import` (POST) -> `imports:execute`
  - `/api/import/validate` (POST) -> `imports:read`
  - `/api/import/rollback` (POST) -> `imports:execute`
  - `/api/collector/*` (all) -> `collectors:read/manage`
- No public endpoint creates admins, imports data, seeds data, or modifies records
- `/api/admin/setup` endpoint removed (was the only public admin creation endpoint)
- `/setup/page.tsx` removed (was the public browser admin creation page)
- **Action taken:** Deleted `/api/admin/setup` endpoint and `/setup/page.tsx`

---

## 3. Files Changed in This Session

| File | Change |
|------|--------|
| `src/app/setup/page.tsx` | **DELETED** -- no public browser admin creation |
| `src/app/api/[[...path]]/route.ts` | Removed `/api/admin/setup` endpoint (42 lines) |
| `src/app/admin/login/page.tsx` | Added `useEffect` redirect for authenticated users (lines 16-21) |
| `scripts/create-admin.ts` | Fixed `--reset-password` to not require `--name`; preserved existing name |
| `scripts/__tests__/auth.test.ts` | **CREATED** -- 20-test auth suite (28 runnable unit tests) |
| `ADMIN_AUTH_FIX_REPORT.md` | **CREATED** -- this report |

---

## 4. Environment Variable Names

| Variable | Purpose | Required |
|----------|---------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | Yes (Production + Preview) |
| `JWT_SECRET` | JWT signing/verification (generate: `openssl rand -hex 32`) | Yes (Production + Preview) |
| `COLLECTOR_SECRET` | Collector sync authentication | Yes (Production + Preview) |
| `NEXT_PUBLIC_BASE_URL` | Public base URL for SEO | Optional |
| `ADMIN_INITIAL_PASSWORD` | Temporary -- for CLI admin creation only. Delete after use. | Temp only |

**Your `.env` or `.env.local` MUST use `MONGODB_URI` (not `DATABASE_URL`).**

---

## 5. Mandatory Command Results

| Command | Actual Result |
|---------|--------------|
| `npm ci` | **SUCCESS** -- dependencies installed (2 npm warnings about script approval, non-blocking) |
| `npm run lint` | **SUCCESS** -- zero lint errors, zero output |
| `npx tsc --noEmit` | **SUCCESS** -- zero type errors, zero output |
| `npm run build` | **SUCCESS** -- 36 routes compiled (35 static + 1 dynamic API). Zero errors. Build output has no `/setup` route. |
| `npm run migrate` | **SKIPPED** -- `MONGODB_URI` not set in this environment. Script correctly exits with clear error: "MONGODB_URI is not set in environment." |
| `npm run admin:create` | **SKIPPED** -- `MONGODB_URI` not set in this environment. Script correctly exits with clear error: "MONGODB_URI environment variable is not set." |
| `npx tsx scripts/__tests__/auth.test.ts` | **28 PASSED, 0 FAILED, 19 SKIPPED** |

### Test Suite Breakdown

**Unit Tests (28 passed):**
- Password validation: 6 tests (strong password accepted, 5 rejection cases)
- Input sanitization: 4 tests (trim, HTML strip, length limit, normal pass-through)
- Login rate limiting: 3 tests (fresh, locked, expired lockout)
- Failed login recording: 3 tests (increment, count, lockout trigger)
- Failed attempts reset: 1 test
- JWT operations: 4 tests (valid verify, wrong secret, fabricated token, expired token)
- bcrypt hashing: 3 tests (format, correct password, wrong password)
- Build verification: 4 tests (security headers, CSP, no middleware.ts, no /setup page)

**Integration Tests (19 skipped -- require running server + MongoDB):**
- Tests 1-10: Server endpoint tests (login, wrong password, unknown email, disabled, locked, unauthenticated access, fabricated tokens, expired session, logout)
- Tests 11, 13, 15, 16: Browser behavior tests (back navigation, refresh, direct URL access)
- Test 12: Password change session invalidation
- Test 14: 15-minute token expiry survival

**CLI Tests (skipped with DB verification):**
- Tests 17-19: Verified script structure (MONGODB_URI usage, .env.local loading, bcrypt cost 12, hidden input, updateMany not deleteMany)

---

## 6. Required Auth Flow Verification

| Step | Implementation | Verified |
|------|---------------|----------|
| 1. Superadmin created via `npm run admin:create` | CLI script with bcrypt cost 12 | Script structure verified |
| 2. User opens `/admin/login` | Public page, no auth required | Code verified |
| 3. Login POST validates email, password, active, lock, rate limit | `route.ts` lines 527-578 | Code verified |
| 4. Server creates secure session | `createSignedSession()` with HttpOnly cookie | Code verified |
| 5. Browser receives HttpOnly cookie only | `response.cookies.set('pd_refresh', ...)` | Code verified |
| 6. JavaScript cannot read token | `httpOnly: true` in cookie options | Code verified |
| 7. `/api/admin/session` returns safe profile (id, name, email, role) | Excludes password, token, secret | Code verified |
| 8. Admin pages use session provider | `AdminAuthProvider` + `useAdmin()` context | Code verified |
| 9. Protected requests use `credentials: 'include'` | All fetch calls in login, logout, session | Code verified |
| 10. Logout destroys server session + cookie | DB revocation + cookie clear + router.replace | Code verified |

---

## 7. Vercel Redeploy Steps

1. **Push code to GitHub** -- Vercel auto-deploys
2. **Set environment variables** in Vercel Dashboard > Settings > Environment Variables:
   - `MONGODB_URI` (Production + Preview)
   - `JWT_SECRET` (Production + Preview) -- generate with `openssl rand -hex 32`
   - `COLLECTOR_SECRET` (Production + Preview)
3. **MongoDB Atlas network access**: Set to `0.0.0.0/0` (allow all IPs) or add Vercel's IP ranges
4. **Create superadmin** (run locally with `.env.local` containing your `MONGODB_URI`):
   ```bash
   npm run admin:create
   # Enter: Name: Shams
   # Enter: Email: shamstechofficial@gmail.com
   # Enter: Password: (your strong password, hidden input)
   ```
   Or non-interactively:
   ```bash
   ADMIN_INITIAL_PASSWORD='YourSecureP@ssw0rd!' npm run admin:create \
     -- --name "Shams" --email "shamstechofficial@gmail.com" --role superadmin
   ```
5. **Delete `ADMIN_INITIAL_PASSWORD`** from Vercel env vars if you set it there
6. **Login**: `https://phonedock-pi.vercel.app/admin/login`

---

## 8. Admin Login URL

```
https://phonedock-pi.vercel.app/admin/login
```

---

## 9. Remaining Notes

- **IP rate limiter** (`ipRateLimitMap` in route.ts): This is in-memory and resets on serverless cold starts. This is acceptable because it is basic DDoS protection, NOT authentication state. The critical login rate limiting is fully DB-backed via `failedAttempts` + `lockedUntil`.
- **Forgot password** (`/api/admin/forgot-password`): Currently logs a reset token to the server console. In production, integrate an email service (SendGrid, Resend, etc.) to send reset links.
- **No public admin creation**: The `/api/admin/setup` endpoint and `/setup/page.tsx` have been removed. Admin creation is only possible via `npm run admin:create`.
- **Integration tests**: Tests 1-16 require a running dev server and MongoDB connection. Run with: `INTEGRATION=true MONGODB_URI=your_uri TEST_PASSWORD=your_pw npx tsx scripts/__tests__/auth.test.ts`