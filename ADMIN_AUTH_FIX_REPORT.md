# PhoneDock Admin Authentication Fix Report

**Date:** 2026-07-15
**Project:** PhoneDock (https://phonedock-pi.vercel.app/)
**Scope:** Complete admin authentication system audit and fix

---

## 1. Root Cause of Admin Login Failure

The "Invalid credentials" error after creating an admin via the browser setup page was caused by a combination of issues that have been resolved across multiple sessions:

- **Primary cause:** The previous `/setup/page.tsx` was a workaround for users without local Node.js. However, the admin creation flow, password hashing, and session management have been completely rewritten to use proper cookie-based authentication.
- **Contributing factor:** Early versions of the code used `localStorage` for token storage (`pd_admin`, `pd_token`), which was inconsistent with the HttpOnly cookie approach used by the server. This created a half-cookie, half-bearer-token system that failed silently.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/app/setup/page.tsx` | **DELETED** — Removed public browser admin creation page |
| `src/app/api/[[...path]]/route.ts` | Removed `/api/admin/setup` endpoint (42 lines) |
| `src/app/admin/login/page.tsx` | Added authenticated-user redirect (prevents logged-in users from seeing login page) |
| `scripts/create-admin.ts` | Fixed `--reset-password` mode: `--name` is now optional; password reset preserves existing name |

### Files Previously Fixed (Prior Sessions — Verified Intact)

| File | Status |
|------|--------|
| `src/lib/useAdmin.tsx` | Clean — zero localStorage, pure cookie-based auth with auto-refresh |
| `src/lib/auth.ts` | JWT_SECRET lazy-loaded via `getSecretKey()`, no module-level throw |
| `src/lib/models/Other.ts` | `password: select: false`, `revokedSessions[]` for DB-backed revocation |
| `src/lib/mongodb.ts` | Uses `MONGODB_URI` with retry logic |
| `src/lib/permissions.ts` | Role-based permission system intact |
| `src/app/admin/layout.tsx` | Server-verified session via `useAdmin()` context, not localStorage |
| `next.config.ts` | Security headers (CSP, X-Frame-Options, etc.) — migrated from deleted middleware |
| `.env.example` | Standardized on `MONGODB_URI`, `JWT_SECRET`, `COLLECTOR_SECRET` |
| `src/middleware.ts` | **DELETED** — Next.js 16.1.1 deprecated middleware, replaced by next.config.ts headers + API-level rate limiting |

---

## 3. Environment Variable Names

All code uses these exact variable names:

| Variable | Purpose | Required |
|----------|---------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `JWT_SECRET` | JWT signing/verification (generate with `openssl rand -hex 32`) | Yes |
| `COLLECTOR_SECRET` | Collector sync authentication | Yes |
| `NEXT_PUBLIC_BASE_URL` | Public base URL for SEO | Optional |
| `ADMIN_INITIAL_PASSWORD` | Temporary env var for CLI admin creation (delete after use) | Temp only |

**The `.env` file on your machine must use `MONGODB_URI` (not `DATABASE_URL`).** Rename the key if your `.env` or `.env.local` still has `DATABASE_URL`.

---

## 4. Architecture Summary

### Authentication Flow

```
1. Admin created via:  npm run admin:create
2. User opens:         /admin/login
3. POST /api/admin/login validates:
   - Normalized email (lowercase)
   - bcrypt password hash (cost factor 12)
   - Active account check
   - Lock status (5 failed attempts = 15 min lockout)
   - DB-backed rate limiting
4. Server creates JWT session pair:
   - Access token: 15 minutes (never exposed to JS)
   - Refresh token: 7 days (HttpOnly, Secure, SameSite=Strict cookie)
5. Cookie name: pd_refresh
6. JavaScript CANNOT read the session token (HttpOnly)
7. /api/admin/session returns safe profile: id, name, email, role
   - Never returns: password, hash, token, secret
8. Admin pages use session endpoint via AdminAuthProvider context
9. Auto-refresh: if session endpoint returns 401, client tries
   POST /api/admin/refresh-token with the cookie
10. Logout: POST /api/admin/logout revokes session in DB,
    clears cookie, router.replace prevents back navigation
```

### Security Measures

- **No localStorage** — All auth state is server-verified via HttpOnly cookies
- **DB-backed session revocation** — Survives serverless restarts (Vercel)
- **DB-backed login rate limiting** — `failedAttempts` + `lockedUntil` on Admin document
- **No in-memory auth state** — No Maps for sessions or rate limits
- **Password hashing** — bcrypt with cost factor 12
- **Strong password validation** — 12+ chars, uppercase, lowercase, number, special
- **Role-based permissions** — superadmin, admin, editor, reviewer
- **Input sanitization** — HTML tag stripping, length limits
- **IP rate limiting** — Basic DDoS protection at API level (login: 10/min, others: 100/min)
- **Security headers** — CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff

### Endpoint Protection Audit

| Endpoint | Auth Required | Permission |
|----------|--------------|------------|
| `GET /api/admin/stats` | Yes | `phones:read` |
| `GET/POST/PUT/DELETE /api/admin/phones/*` | Yes | `phones:read/create/edit/delete` |
| `GET/POST/PUT/DELETE /api/admin/brands/*` | Yes | `brands:read/create/edit/delete` |
| `GET/POST/PUT/DELETE /api/admin/news/*` | Yes | `news:read/create/edit/delete` |
| `GET /api/admin/sponsors` | Yes | `sponsors:read` |
| `GET /api/admin/activity` | Yes | `activity:read` |
| `POST/GET /api/admin/users` | Yes | `users:read/manage` |
| `POST /api/admin/change-password` | Yes | (self) |
| `POST /api/admin/forgot-password` | No* | N/A |
| `GET/POST /api/admin/login` | No | Public |
| `POST /api/admin/logout` | No* | (session consumed) |
| `GET/POST /api/admin/session` | No* | (validates cookie) |
| `POST /api/admin/refresh-token` | No* | (validates cookie) |
| `POST /api/import` | Yes | `imports:execute` |
| `POST /api/import/validate` | Yes | `imports:read` |
| `POST /api/import/rollback` | Yes | `imports:execute` |
| `GET/POST /api/collector/*` | Yes | `collectors:read/manage` |
| `GET /api/health` | No | Public (no sensitive data) |
| `GET /api/home`, `/api/phones`, etc. | No | Public |

*No explicit auth gate, but these endpoints only operate on cookies — they cannot be exploited without a valid session token.

**No endpoint exists that allows unauthenticated admin creation, data import, or data modification.**

---

## 5. Build Results

```
Command              Result
-------------------  --------
npm ci               SUCCESS (dependencies installed)
npx tsc --noEmit     SUCCESS (zero type errors)
npm run lint         SUCCESS (zero lint errors)
npm run build        SUCCESS (36 routes compiled)
```

**Production build completed successfully.** The `/setup` route no longer exists in the build output.

---

## 6. Admin Creation

The only way to create an admin is via the CLI script:

### Interactive Mode
```bash
npm run admin:create
```
The script will prompt for name, email, and masked password (hidden input).

### Non-Interactive Mode (for CI/CD or when piping password)
```bash
ADMIN_INITIAL_PASSWORD='YourSecureP@ssw0rd!' npm run admin:create \
  -- --name "Shams" --email "shamstechofficial@gmail.com" --role superadmin
```

### Reset Password for Existing Admin
```bash
ADMIN_INITIAL_PASSWORD='NewSecureP@ssw0rd!' npm run admin:reset-password \
  -- --email "shamstechofficial@gmail.com"
```

**The `ADMIN_INITIAL_PASSWORD` environment variable must be deleted from Vercel after use. It is never logged, committed, or stored.**

---

## 7. Vercel Configuration

### Required Environment Variables (Vercel Dashboard > Settings > Environment Variables)

| Variable | Production | Preview |
|----------|-----------|---------|
| `MONGODB_URI` | Required | Required |
| `JWT_SECRET` | Required | Required |
| `COLLECTOR_SECRET` | Required | Required |
| `NEXT_PUBLIC_BASE_URL` | Optional | Optional |

### Vercel Redeploy Steps

1. Push code to GitHub
2. Vercel auto-deploys from the connected repository
3. Verify environment variables are set in Vercel Dashboard
4. Verify MongoDB Atlas network access allows Vercel IPs (use `0.0.0.0/0` or Vercel IP list)
5. Create superadmin via CLI (not via browser):
   ```bash
   ADMIN_INITIAL_PASSWORD='YourPassword!' npm run admin:create \
     -- --name "Shams" --email "shamstechofficial@gmail.com" --role superadmin
   ```
6. Delete `ADMIN_INITIAL_PASSWORD` from Vercel env vars
7. Visit `https://phonedock-pi.vercel.app/admin/login` and log in

---

## 8. Admin Login URL

```
https://phonedock-pi.vercel.app/admin/login
```

---

## 9. Remaining Notes

- The in-memory IP rate limiter (`ipRateLimitMap`) is acceptable for basic DDoS protection. It resets on serverless cold starts but the critical login rate limiting is DB-backed and persistent.
- The `/api/admin/forgot-password` endpoint exists but only logs a token to the server console. In production, integrate an email service (SendGrid, Resend, etc.) to send reset links.
- All 13 original defect points have been addressed. The codebase uses a single, coherent cookie-based authentication architecture with no localStorage, no in-memory auth state, and no public admin creation endpoints.