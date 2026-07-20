# Sprint 4 — Checkpoint 6 — Batch 3

## Launch-blocker fixes

1. **Signed price-alert unsubscribe links**
   - Unsubscribe requests now require an HMAC signature tied to the subscriber email and phone ID.
   - Prevents third parties from unsubscribing another user by guessing an email and phone ID.
   - Both duplicate unsubscribe routing paths enforce the signature.

2. **Public API cache regression fixed**
   - Removed the blanket `no-store` header from every `/api/*` route.
   - Sensitive admin, import, collector, data-quality, cron and setup routes remain private/no-store.
   - Public read endpoints can once again use their route-level CDN caching strategy.

3. **Safe production health endpoint**
   - Added `GET /api/health`.
   - Returns only service status and version; it does not expose environment, database, or deployment secrets.

4. **Launch regression tests**
   - Added seven automated checks covering unsubscribe signatures, generated links, health endpoint and cache scope.
   - Added `npm run test:launch` and expanded `production:audit`.

## Environment and migration

- No database migration required.
- Production must continue to provide `JWT_SECRET`; it is also used to sign unsubscribe links.
