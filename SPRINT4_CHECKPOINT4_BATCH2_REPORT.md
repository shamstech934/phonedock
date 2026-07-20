# Sprint 4 — Checkpoint 4 — Batch 2

## Authentication & API hardening

- JWT sessions now use an explicit issuer and audience.
- JWT verification is pinned to HS256 and validates all required claims.
- Oversized session cookies are rejected before cryptographic verification.
- Login inputs are bounded before bcrypt and database work.
- Email syntax and maximum length are checked without revealing account existence.
- Password-change inputs have a safe maximum length.
- Authenticated admin mutations now have a dedicated 120 requests/minute IP limit.
- Admin rate-limit responses include `Retry-After` and `Cache-Control: no-store`.

## Deployment note

Existing admin sessions created before this batch do not contain the new issuer/audience claims. Admin users will need to sign in again once after deployment. No database migration or new environment variable is required.
