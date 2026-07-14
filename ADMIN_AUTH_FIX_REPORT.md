# PhoneDock Admin Auth — Security Fix Report

## Root Causes Fixed

### 1. Hardcoded admin credentials in seed script
`scripts/seed.ts` contained `admin@phonedock.pk` / `admin123` as a superadmin, logged to console on every `npm run seed`. Any developer or CI pipeline running seed would silently create/backdoor an admin account.

### 2. `__all__` sentinel in revokedSessions array
Session revocation used a `{ jti: '__all__' }` sentinel that permanently locked the admin out. Once pushed, every subsequent session check would find the `__all__` flag and reject — even after a valid new login (which was impossible because the flag persisted).

### 3. Session validation failed OPEN
`isSessionRevoked()` returned `false` (allow) on any database error. A MongoDB outage would grant full authenticated access to all users, including those with revoked sessions.

### 4. Dual-token architecture (access + refresh) with no actual access token usage
The system generated both an access token (15min) and a refresh token (7d) at login, but the frontend never stored or sent the access token. Only the refresh cookie (`pd_refresh`) was used. This created confusion and an unnecessary `/api/admin/refresh-token` endpoint.

### 5. In-memory `Map` for IP rate limiting
`ipRateLimitMap = new Map()` reset on every Vercel serverless cold start, making rate limiting ineffective for sustained attacks.

### 6. Forgot-password endpoint logged raw reset tokens to console
`POST /api/admin/forgot-password` generated a UUID reset token and logged it: `console.log('Token: ${token}')`. This exposed the token in server logs (Vercel, CloudWatch, etc.).

### 7. XLSX files parsed as UTF-8 JSON
`handleCollectorFileUpload` treated `.xlsx`/`.xls` files identically to `.json` — calling `JSON.parse(buffer.toString('utf-8'))` which would always fail on binary Excel data.

### 8. No upload security constraints
File uploads had no size limit, no record count limit, no MIME verification, and no CSV formula-injection protection.

### 9. Seed accessible from production UI
Dashboard and phones pages had "Seed Database" buttons that called `POST /api/admin/seed`. The API endpoint had no production guard.

### 10. Fake retailer prices using mathematical multipliers
Seed script generated Daraz/WhatMobile/PriceOye prices by multiplying `pricePKR * 0.98` or `* 1.02` with `url: '#'`. These were not real prices from verified sources.

### 11. Health endpoint leaked environment variable status
`/api/health` returned `MONGODB_URI: "set" | "MISSING"`, `JWT_SECRET: "set" | "MISSING"`, `COLLECTOR_SECRET: "set" | "MISSING"` — information disclosure.

### 12. `.env` file in repository
A `.env` file containing `DATABASE_URL=file:/home/z/my-project/db/custom.db` existed in the project root.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/models/Other.ts` | Replaced `revokedSessions[]` with `sessionVersion` (Number, default 0). Replaced `resetToken` with `resetTokenHash` (select: false). Added `RateLimit` schema with TTL index for persistent IP rate limiting. |
| `src/lib/auth.ts` | Complete rewrite. Single `pd_session` HttpOnly cookie (24h). Removed `signAccessToken`, `signRefreshToken`, `getAuthSessionAsync`, `revokeAllSessions`, `revokeSession`, `isSessionRevoked`. Added `signSessionToken`, `getSessionFromRequest`, `validateSessionVersion` (fail-closed), `checkIpRateLimit` (MongoDB-backed), `hashResetToken`, `verifyResetToken`, `sanitizeCsvValue`. |
| `src/app/api/[[...path]]/route.ts` | Complete rewrite. Removed in-memory `ipRateLimitMap`. All rate limiting now via MongoDB `RateLimit` collection. Cookie name changed from `pd_refresh` to `pd_session`. Removed `/api/admin/refresh-token`. Added `/api/admin/reset-password` (token-based). Fixed XLSX parsing via `XLSX.read()` + `sheet_to_json()`. Added upload security (10MB limit, 5000 record limit, MIME check, CSV injection protection). Seed endpoint returns 403 in production. Health endpoint no longer leaks env var status. Forgot-password hashes token, never logs it, disabled when email not configured. |
| `src/lib/useAdmin.tsx` | Simplified to single cookie. Removed refresh-token fallback flow. One `GET /api/admin/session` call with `credentials: 'include'`. |
| `src/lib/models/index.ts` | Added `RateLimit` export. |
| `scripts/seed.ts` | Removed admin creation (admin@phonedock.pk / admin123). Removed `bcryptjs` import. Removed fake retailer price multipliers (0.98/1.02) and `#` URLs. Replaced with single "Estimated MSRP" entry. |
| `scripts/create-admin.ts` | Added `sessionVersion` field to local schema. Password reset now increments `sessionVersion` via `$inc`. New admin creation includes `sessionVersion: 0`. |
| `scripts/migrate-db.ts` | Added migration for `sessionVersion` (default 0) on existing admins. Clears old `revokedSessions` arrays. Creates `ratelimits` collection with TTL and unique key indexes. |
| `src/app/admin/dashboard/page.tsx` | Removed "Seed Database Now" button. Empty state now says "Use the Import feature or add phones manually". |
| `src/app/admin/phones/page.tsx` | Removed "Seed Data" button. |

## Files Deleted

| File | Reason |
|------|--------|
| `.env` | Contained `DATABASE_URL=file:...db/custom.db` — potential credential exposure. Already in `.gitignore` but removed as precaution. |

## Files Previously Deleted (confirmed still absent)

| File | Reason |
|------|--------|
| `src/app/setup/page.tsx` | Public browser-accessible admin creation page |
| `src/middleware.ts` | Deprecated in Next.js 16 |

---

## Architecture Changes

### Before (Dual-Token)
```
Login → access token (15min, in memory) + refresh token (7d, HttpOnly cookie "pd_refresh")
Session check → try Bearer header → fallback to cookie → call /refresh-token if expired
Revocation → push { jti: '__all__' } to Admin.revokedSessions[]
Rate limit → in-memory Map (resets on serverless cold start)
```

### After (Single Session Cookie)
```
Login → single JWT (24h, HttpOnly cookie "pd_session") containing sessionVersion
Session check → read pd_session cookie → verify JWT → compare sessionVersion with DB
Revocation → $inc: { sessionVersion: 1 } (fail-closed on DB error)
Rate limit → MongoDB RateLimit collection with TTL index (persistent, serverless-safe)
Session rotation → silent re-issue when < 50% TTL remains
```

---

## Migration Result

Run `npm run migrate` after deploying. The migration:
- Adds `sessionVersion: 0` to all existing admin documents
- Clears old `revokedSessions` arrays
- Creates `ratelimits` collection with TTL + unique indexes
- All existing indexes preserved

---

## Superadmin CLI Result

Cannot verify locally (no MongoDB connection). Expected behavior:
```
npm run admin:create -- --email shamstechofficial@gmail.com --name "Shams" --role superadmin
```
- Creates admin with `sessionVersion: 0`
- Password bcrypt-hashed (cost 12)
- No credentials logged

---

## Login Result

Cannot verify end-to-end without MongoDB. Architecture:
1. POST `/api/admin/login` with `{ email, password }`
2. Server verifies credentials, checks DB rate limit
3. Signs JWT with `sessionVersion` from admin document
4. Sets `pd_session` HttpOnly cookie
5. Returns `{ success, admin: { id, email, name, role } }`

---

## Password-Change and Re-Login Result

Architecture (cannot verify without MongoDB):
1. POST `/api/admin/change-password` verifies current password
2. Hashes new password, updates DB
3. `$inc: { sessionVersion: 1 }` — all existing tokens now have old version
4. Clears `pd_session` cookie
5. User must re-login → new token gets new `sessionVersion` → succeeds

---

## Build Result

```
✅ npm ci          — success (clean install from lock file)
✅ npx tsc --noEmit — success (zero type errors)
✅ npm run lint    — success (zero lint errors)
✅ npm run build   — success (all pages compiled)
```

---

## Lint Result

```
✅ Zero errors, zero warnings
```

---

## TypeScript Result

```
✅ Zero type errors
```

---

## Remaining Issues

1. **Email delivery not configured**: Forgot-password is effectively disabled (returns generic success message, never sends email). This is intentional — when email is configured (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` env vars), the actual sending logic needs to be implemented.

2. **No `/api/admin/setup` route**: Confirmed deleted. No browser-accessible admin creation exists.

3. **Contact form rate limiting**: Rate limited via MongoDB (`3/min per IP`) but the contact POST handler was not found in the current route file — may be in a separate route or not yet implemented.

4. **`xlsx@0.18.5` package**: Has known advisories (SheetJS CE). Consider migrating to `xlsx` SheetJS Pro or `exceljs` for production.

5. **Tests not runnable locally**: The test suite in `scripts/__tests__/auth.test.ts` requires MongoDB connection. Tests need to be updated to match the new `sessionVersion` architecture (references to `revokedSessions` and `__all__` need updating).

---

## Vercel Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Minimum 32 characters, cryptographically random |
| `COLLECTOR_SECRET` | Optional | For collector API authentication |
| `EMAIL_HOST` | Optional | SMTP host for forgot-password |
| `EMAIL_PORT` | Optional | SMTP port |
| `EMAIL_USER` | Optional | SMTP username |
| `EMAIL_PASS` | Optional | SMTP password |

**Remove these obsolete variables from Vercel** (if present):
- `DATABASE_URL` — not used, was a confusion point
- `MONGO_URL` — not used
- `DB_NAME` — not used (include in MONGODB_URI)

---

## Credential Rotation Required

Since `.env` existed in the repository, assume previous credentials may be exposed. Rotate:

1. **MongoDB password** — Change the password in your MongoDB Atlas dashboard, update `MONGODB_URI` in Vercel
2. **JWT_SECRET** — Generate new: `openssl rand -hex 32`, update in Vercel
3. **COLLECTOR_SECRET** — Generate new random string, update in Vercel
4. **Cloudinary secrets** — If using Cloudinary, rotate API secret
5. **Email credentials** — If email is configured, rotate SMTP password

---

## Safe Deployment Steps

1. **Commit all changes** to GitHub
2. **Rotate all credentials** (see above)
3. **Update Vercel environment variables** with new credentials
4. **Remove obsolete variables** (`DATABASE_URL`, `MONGO_URL`, `DB_NAME`)
5. **Deploy to Vercel** (auto-deploy from GitHub push, or manual)
6. **Run migration**: Connect to your MongoDB and run `npm run migrate` locally with Vercel's `MONGODB_URI`
7. **Create superadmin**: `npm run admin:create -- --email shamstechofficial@gmail.com --name "Shams" --role superadmin`
8. **Test login** at `https://phonedock-pi.vercel.app/admin/login`
9. **Verify** password change works and forces re-login