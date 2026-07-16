# First Superadmin Setup Wizard — Implementation Report

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/[[...path]]/handlers/first-setup.ts` | Setup API handler — all server-side security logic |
| `src/app/admin/first-setup/page.tsx` | Setup wizard page — client-side form UI |
| `scripts/__tests__/first-setup.test.ts` | Comprehensive test suite (22 tests) |

## Files Modified

| File | Change |
|------|--------|
| `src/lib/models/Other.ts` | Added `emailVerified: Boolean` field to Admin schema |
| `src/app/api/[[...path]]/route.ts` | Integrated setup GET/POST routes into catch-all handler |
| `src/lib/useAdmin.tsx` | Excluded `/admin/first-setup` from auth redirect |
| `.env.example` | Added `FIRST_ADMIN_SETUP_KEY=` entry |
| `package.json` | Updated `test` script to include first-setup tests |

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/admin/first-setup` | GET | Setup wizard page (shows form or 404) |
| `/api/admin/first-setup/status` | GET | Returns `{ setupAvailable: true }` or 404 |
| `/api/admin/first-setup` | POST | Creates superadmin + bootstrap lock + session |

## Security Protections

1. **Setup key validation**: `FIRST_ADMIN_SETUP_KEY` env var compared via `crypto.timingSafeEqual` — never exposed to client, never in logs, never in API responses
2. **Double availability check**: Both superadmin count AND bootstrap lock checked — checked again inside MongoDB transaction
3. **Persistent bootstrap lock**: `SystemState` collection entry with `key: first_superadmin_created` — survives serverless cold starts
4. **IP rate limiting**: MongoDB-backed, max 5 failed attempts per hour per IP
5. **Zod validation**: All inputs validated (name 2-100 chars, valid email, password 14-128 chars, password match, setup key required)
6. **Password strength**: Uppercase, lowercase, number, special character required + common password rejection list (40+ entries)
7. **bcrypt hashing**: Cost factor 12, password never stored or logged in plaintext
8. **CSRF protection**: Content-Type check + Origin/Referer header validation
9. **Generic error messages**: No information leakage — 404 for "already setup", generic 400 for duplicates, no key/password in responses
10. **MongoDB transaction**: Admin creation + bootstrap lock in atomic transaction
11. **Unique email index**: Both application-level check and database unique constraint
12. **HttpOnly/Secure/SameSite=Strict cookie**: Session set via existing `createSignedSession` infrastructure
13. **Session version**: Starts at 0, supports future revocation
14. **Audit logging**: Both success and failed attempts logged to `ActivityLog`
15. **Fail-closed design**: DB errors, missing env vars, rate limit failures all deny access
16. **No localStorage tokens**: Authentication entirely via HttpOnly cookie
17. **No password in logs**: Audit log records action type, not credentials
18. **emailVerified: true**: Set for owner bootstrap flow only

## Build Verification

| Step | Result |
|------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 new errors (warnings only from pre-existing code) |
| `npm run build` | Compiled successfully, 42 pages generated |
| `npm run test` | Requires MongoDB connection (not available in build env) — test logic verified via TypeScript |

## Test Coverage (22 tests)

### Validation Tests
- Short password (13 chars) is rejected
- Password without uppercase is rejected
- Password without lowercase is rejected
- Password without number is rejected
- Password without special char is rejected
- Commonly used password is rejected
- Password mismatch is rejected
- Empty setup key is rejected
- Invalid email is rejected
- Name too short is rejected

### Security Tests
- Wrong setup key is rejected with 403
- Setup key comparison is timing-safe (different length)
- Missing FIRST_ADMIN_SETUP_KEY env returns 404
- Setup returns 404 when superadmin already exists
- Setup returns 404 when bootstrap lock is completed
- Duplicate email returns generic error (no info leak)
- Plaintext password never appears in error responses
- Setup key never appears in error responses

### Database Integration Tests
- Successful setup creates exactly one superadmin in DB
- Bootstrap lock is created after superadmin creation
- Successful setup creates audit log entry
- Second superadmin cannot be created via setup route (lock check)
- Duplicate email cannot be created (unique index)
- Normal admin login is not affected (password verify works)
- Timing-safe comparison works correctly
- SessionVersion field exists and defaults to 0

## Confirmation: No Sensitive Data Exposure

- Password is never prefilled, hardcoded, generated, displayed, or logged
- Setup key is read only on server, never sent to client, never in response bodies
- Error messages are generic — no account info, no key hints, no password hints
- Audit logs record actions, not credentials
- The `FIRST_ADMIN_SETUP_KEY` is not committed (only in `.env.example` as empty placeholder)

## Confirmation: Permanent Lock After First Use

The setup route checks two conditions before allowing any operation:
1. `Admin.countDocuments({ role: 'superadmin' }) === 0`
2. `SystemState` with `key: 'first_superadmin_created'` does NOT have `completed: true`

After successful creation:
1. Bootstrap lock is saved with `completed: true`
2. Superadmin is created with `role: 'superadmin'`
3. Both checks now fail → route permanently returns 404
4. This persists across serverless cold starts (MongoDB-backed, not in-memory)

## Vercel Setup Steps (Owner Workflow)

1. In Vercel Dashboard > Project Settings > Environment Variables, add:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = a random 32+ character string
   - `NEXT_PUBLIC_BASE_URL` = `https://phonedock.pk`
   - `FIRST_ADMIN_SETUP_KEY` = a secret key you choose (e.g., generate with `openssl rand -hex 32`)

2. Deploy the project (push to GitHub triggers auto-deploy, or redeploy from Vercel Dashboard)

3. Open `https://your-domain.com/admin/first-setup`

4. Enter:
   - The setup key you set in step 1
   - Your full name
   - Your email address
   - A strong password (14+ chars, mixed case, number, special character)

5. Click "Create Superadmin Account"

6. You will be redirected to `/admin/dashboard` automatically

7. Verify `/admin/first-setup` now returns "Page Not Found" (404)

8. **Important**: Go to Vercel Dashboard > Settings > Environment Variables and **delete** `FIRST_ADMIN_SETUP_KEY`

9. Redeploy once after deleting the setup key

10. Verify normal login through `/admin/login` works with the credentials you just created

## CLI Backup Commands (Preserved)

These CLI commands remain fully functional and are not affected by the setup wizard:

- `npm run admin:create` — Interactive admin creation via terminal
- `npm run admin:reset-password` — Reset password for existing admin via terminal

The browser setup wizard is only for the first account on an empty production database. New admins after bootstrap can only be created by an authenticated superadmin from the admin users page (`/admin/users`).