# API Response Shape Audit — PhoneDock

**Date:** 2025-07-10  
**Scope:** All handler files under `src/app/api/[[...path]]/handlers/`  
**Target Shape:** `{ success: true, data: ... }` / `{ success: false, error: { code, message } }`

---

## Executive Summary

| Metric | Count |
|---|---|
| **Total endpoints audited** | **~105** |
| Endpoints returning raw data (no `success` wrapper) | **70** |
| Endpoints returning `{ success: true, ... }` | **25** |
| Endpoints returning non-standard shapes | **~10** |
| Error responses using `{ error: "string" }` | **~80** |
| Error responses using `{ success: false, error: {...} }` | **0** |
| Frontend files consuming APIs | **37 files, ~108 fetch calls** |

**Verdict:** The codebase does NOT follow the proposed `{ success, data }` / `{ success, false, error: { code, message } }` pattern. Almost all endpoints return domain-specific raw shapes. This is a massive, breaking normalization that would affect every frontend component.

---

## 1. PUBLIC GET Endpoints (`public.ts`)

All use `cached()` or `cachedError()` helpers.

| Endpoint | Success Shape | Error Shape | Cache |
|---|---|---|---|
| `GET /api/health` | `{ status, db }` | `{ error: "msg" }` 503 | 30s/120s |
| `GET /api/home` | `{ brands, phones, trending, ... }` (from `fetchHomeData`) | — | 60s/300s |
| `GET /api/hero-phones` | `{ phones: [...] }` | — | 60s/300s |
| `GET /api/phones` | `{ phones: [...], total, page, limit }` | `{ error: "msg" }` 404 | 120s/300s |
| `GET /api/phones/lookup` | `{ phones: [...] }` | — | 60s/300s |
| `GET /api/phones/autocomplete` | `{ phones: [...] }` | — | 60s/180s |
| `GET /api/phones/:slug` | `{ phone: {...}, related: [...] }` | `{ error: "msg" }` 404 | 300s/600s |
| `GET /api/phones/:slug/price-history` | `{ history: [...], storeNames: [...] }` | `{ error: "msg" }` 404 | 60s/300s |
| `GET /api/phones/:slug/price-tracker` | `{ currentPrice, previousPrice, ... history }` | `{ error: "msg" }` 404 | 60s/300s |
| `GET /api/phones/:slug/reviews` | `{ reviews: [...], total, average }` | `{ error: "msg" }` 404 | 60s/300s |
| `GET /api/brands` | `{ brands: [...] }` | — | 120s/300s |
| `GET /api/brands/:slug` | `{ brand: {...}, phones: [...] }` | `{ error: "msg" }` 404 | 300s/600s |
| `GET /api/news` | `{ news: [...] }` | — | 120s/300s |
| `GET /api/news/:slug` | `{ ...article }` (raw document) | `{ error: "msg" }` 404 | 300s/600s |
| `GET /api/search` | `{ phones: [...], brands: [...], query }` | — | 60s/180s |
| `GET /api/videos` | `{ videos: [...], total, page, limit, totalPages }` | — | 120s/300s |
| `GET /api/settings` | `{ settings: {...} }` | — | 300s/600s |
| `GET /api/top-phones` | `{ phones: [...], sortBy }` | — | 300s/600s |
| `GET /api/upcoming-phones` | `{ phones: [...] }` | — | 300s/600s |
| `GET /api/phones-under/:price` | `{ phones: [...], total, page, limit, maxPrice, totalPages }` | `{ error: "msg" }` 400 | 120s/300s |
| `GET /api/price-ranges` | `{ ranges: [...] }` | — | 300s/600s |
| `GET /api/reviews` | `{ reviews: [...], total, page, limit }` | — | 120s/300s |
| `GET /api/price-alerts/unsubscribe` | `{ success: true, message }` | `{ error: "msg" }` 400 | None |
| `GET /api/price-alerts/confirm` | Redirect (not JSON) | Redirect | N/A |

**Pattern:** All public GET endpoints return **raw domain data** — no `success` wrapper. Errors use `{ error: "string" }`.

---

## 2. PUBLIC POST Endpoints

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `POST /api/contact` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400/403 |
| `POST /api/phones/:slug/reviews` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400/403/404 |
| `POST /api/phones/:slug/price-alerts` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400/404/429 |

**Pattern:** Public POST endpoints DO include `{ success: true, message }`. Errors still use `{ error: "string" }`.

---

## 3. ADMIN AUTH Endpoints (`admin-auth.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/admin/session` | `{ authenticated: true, admin: {...} }` | `{ authenticated: false }` 401 |
| `GET /api/admin/sessions` | `{ sessions: [...] }` | (auth error from helper) |
| `POST /api/admin/session` | `{ authenticated: true, admin: {...} }` | `{ authenticated: false }` 401 |
| `POST /api/admin/login` | `{ success: true, admin: {...} }` + Set-Cookie | `{ error: "msg" }` 400/401/429 |
| `POST /api/admin/logout` | `{ success: true }` + clear cookie | — |
| `POST /api/admin/change-password` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400/401/404 |
| `POST /api/admin/forgot-password` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400 |
| `POST /api/admin/reset-password` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400 |
| `DELETE /api/admin/sessions/:jti` | `{ success: true, message: "..." }` | `{ error: "msg" }` 400/404 |
| `DELETE /api/admin/sessions` | `{ success: true, message: "...", revokedCount }` | `{ error: "msg" }` 401 |

**Pattern:** Auth endpoints are the most "mixed" — some use `{ success: true }`, some use `{ authenticated: true/false }`. Session check uses a non-standard shape. Errors remain `{ error: "string" }`.

---

## 4. ADMIN CRUD GET Endpoints (`admin-crud.ts`)

| Endpoint | Success Shape | Auth |
|---|---|---|
| `GET /api/admin/stats` | `{ totalPhones, totalBrands, ... recentActivity }` (raw fields) | `dashboard:read` |
| `GET /api/admin/phones/stats` | `{ total, published, draft, ... avgPrice }` | `phones:read` |
| `GET /api/admin/phones` | `{ phones: [...], total, page, limit, totalPages }` | `phones:read` |
| `GET /api/admin/phones/:id` | Raw phone JSON (from `phoneToJSON`) | `phones:read` |
| `GET /api/admin/brands/stats` | `{ total, active, inactive, ... }` | `brands:read` |
| `GET /api/admin/brands` | `{ brands: [...], pagination: {...} }` | `brands:read` |
| `GET /api/admin/news/stats` | `{ total, published, draft, ... }` | `news:read` |
| `GET /api/admin/news` | `{ news: [...], total, page, limit, totalPages }` | `news:read` |
| `GET /api/admin/users/stats` | `{ total, superAdmins, activeAdmins, ... }` | `users:read` |
| `GET /api/admin/users/:id` | `{ ...user, id, status, sessionCount, sessions, recentActivity }` | `users:read` |
| `GET /api/admin/users/export` | CSV file (non-JSON) | `users:read` |
| `GET /api/admin/users` | `{ users: [...], total, page, limit, totalPages }` | `users:read` |
| `GET /api/admin/sponsors` | `{ sponsors: [...] }` | `sponsors:read` |
| `GET /api/admin/activity` | `{ logs: [...], total, page, limit, totalPages }` | `activity:read` |
| `GET /api/admin/activity/stats` | `{ total, todayActivities, securityEvents, ... }` | `activity:read` |
| `GET /api/admin/videos/stats` | `{ total, liveCount, ... channelName }` | `videos:read` |
| `GET /api/admin/videos/search` | `{ videos: [...] }` | `videos:read` |
| `GET /api/admin/videos` | `{ videos: [...], total, page, limit, pendingCount, totalPages }` | `videos:read` |
| `GET /api/admin/settings` | `{ settings: {...} }` | `settings:read` |
| `GET /api/admin/reviews/stats` | `{ total, pending, approved, ... avgRating }` | `phones:read` |
| `GET /api/admin/reviews` | `{ reviews: [...], total, page, limit, totalPages }` | `phones:read` |

**Pattern:** ALL admin CRUD GET endpoints return **raw domain data** — no `success` wrapper. No caching headers.

---

## 5. ADMIN CRUD POST Endpoints

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `POST /api/admin/users` | `{ success: true, id }` | `{ error: "msg" }` 400/403/409 |
| `POST /api/admin/users/invite` | `{ success: true, id, message }` | `{ error: "msg" }` 400/403/409 |
| `POST /api/admin/users/bulk` | `{ success: true, deleted/modified }` | `{ error: "msg" }` 400/403 |
| `POST /api/admin/phones` | `{ success: true, id, slug }` | `{ error: "msg" }` 400/409 |
| `POST /api/admin/brands` | `{ success: true, id }` | `{ error: "msg" }` 400/409 |
| `POST /api/admin/news` | `{ success: true, id }` | `{ error: "msg" }` 400/409 |
| `POST /api/admin/phones/bulk-import` | `{ success: true, total, imported, ... }` | `{ error: "msg" }` 400 |
| `POST /api/admin/sponsors` | `{ success: true, id }` | `{ error: "msg" }` 400 |
| `POST /api/admin/seed` | — (removed) | `{ error: "msg" }` 410 |
| `POST /api/admin/videos/sync` | `{ inserted, skipped, autoLinked, ... }` (raw sync result) | — |
| `POST /api/admin/videos/lookup` | `{ id, youtubeId, title, ... alreadyExisted }` | `{ error: "msg" }` 400/404/500/502 |
| `POST /api/admin/videos/bulk` | `{ success: true, deleted/modified }` | `{ error: "msg" }` 400 |
| `POST /api/admin/news/bulk` | `{ success: true, deleted/modified }` | `{ error: "msg" }` 400 |

**Pattern:** Admin POST mutation endpoints DO use `{ success: true, ... }` for most creates/updates. BUT `videos/sync` and `videos/lookup` return raw data without `success`.

---

## 6. ADMIN CRUD PUT Endpoints

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `PUT /api/admin/phones/:id` | `{ success: true, id }` | `{ error: "msg", details }` 400/404/500/502 |
| `PUT /api/admin/brands/:id` | `{ success: true, id }` | `{ error: "msg" }` 404 |
| `PUT /api/admin/news/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/404/409 |
| `PUT /api/admin/phones/:id/toggle-featured` | `{ success: true, featured }` | `{ error: "msg" }` 404 |
| `PUT /api/admin/phones/:id/toggle-trending` | `{ success: true, trending }` | `{ error: "msg" }` 404 |
| `PUT /api/admin/sponsors/:id` | `{ success: true, sponsor: {...} }` | `{ error: "msg" }` 404 |
| `PUT /api/admin/videos/:id` | `{ success: true, id }` | `{ error: "msg" }` 404 |
| `PUT /api/admin/users/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/403/404 |
| `PUT /api/admin/settings` | `{ settings: {...} }` (NO `success`) | (auth error) |
| `PUT /api/admin/reviews/:id` | `{ success: true }` | `{ error: "msg" }` 404 |

**Pattern:** Most PUT endpoints use `{ success: true }`. Exception: `PUT /api/admin/settings` returns `{ settings: {...} }` without `success`.

---

## 7. ADMIN CRUD DELETE Endpoints

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `DELETE /api/admin/videos/:id` | `{ success: true }` | `{ error: "msg" }` 404 |
| `DELETE /api/admin/reviews/:id` | `{ success: true }` | — |
| `DELETE /api/admin/phones/:id` | `{ success: true }` | `{ error: "msg" }` 404 |
| `DELETE /api/admin/brands/:id` | `{ success: true }` | `{ error: "msg" }` 400/404 |
| `DELETE /api/admin/news/:id` | `{ success: true }` | `{ error: "msg" }` 404 |
| `DELETE /api/admin/sponsors/:id` | `{ success: true }` | — |
| `DELETE /api/admin/users/:id` | `{ success: true }` | `{ error: "msg" }` 400/404 |

**Pattern:** DELETE endpoints consistently return `{ success: true }`. Good.

---

## 8. COLLECTOR Endpoints (`collector.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/collector/dashboard` | `{ totalSources, activeSources, totalJobs, ... }` | (auth error) |
| `GET /api/collector/sources` | `{ sources: [...] }` | (auth error) |
| `GET /api/collector/jobs` | `{ jobs: [...] }` | (auth error) |
| `POST /api/collector/sources` | `{ success: true, id }` | `{ error: "msg" }` 400 |
| `POST /api/collector/jobs` | `{ success: true, id }` | `{ error: "msg" }` 400 |
| `POST /api/collector/review/:id` | `{ success: true, phoneId }` / `{ success: true }` | `{ error: "msg" }` 400/404 |
| `POST /api/collector/sources/:id/test` | `{ success: false, error: "msg" }` 501 | — |
| `PUT /api/collector/sources/:id` | `{ success: true, enabled }` | `{ error: "msg" }` 404 |
| `DELETE /api/collector/jobs` | `{ success: true }` | — |

**Note:** `POST /api/collector/sources/:id/test` is the only endpoint that uses `{ success: false, error: "string" }` — but with `error` as a string, not `{ code, message }`.

---

## 9. PRICE TRACKER Endpoints (`price-tracker.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/admin/price-tracker/stats` | `{ monitoredPhones, manualPrices, ... }` | (auth error) |
| `GET /api/admin/price-tracker/phones` | `{ phones: [...], total, page, limit, totalPages }` | (auth error) |
| `GET /api/admin/price-tracker/sources` | `{ sources: [...] }` | (auth error) |
| `GET /api/admin/price-tracker/changes` | `{ changes: [...], total, page, limit, totalPages }` | (auth error) |
| `GET /api/admin/price-tracker/pending` | `{ pending: [...] }` | (auth error) |
| `GET /api/admin/price-tracker/history/:phoneId` | `{ history: [...] }` | `{ error: "msg" }` 400 |
| `GET /api/admin/price-tracker/listings/:phoneId` | `{ listings: [...] }` | `{ error: "msg" }` 400 |
| `GET /api/admin/price-tracker/settings` | Raw settings object `{ autoApproveThreshold, ... }` | (auth error) |
| `POST /api/admin/price-tracker/update-price` | `{ success: true, id, currentPrice, ... }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/sources` | `{ success: true, id, name, sourceType, ... }` | `{ error: "msg" }` 400/409 |
| `POST /api/admin/price-tracker/listings` | `{ success: true, id, verificationStatus }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/test-source` | `{ reachable, title, detectedPrice, ... }` (NO `success`) | `{ error: "msg" }` 400 |
| `POST /api/admin/price-tracker/review` | `{ success: true, id, verificationStatus }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/approve/:id` | `{ success: true, id, verificationStatus }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/reject/:id` | `{ success: true, id, verificationStatus }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/toggle-lock/:id` | `{ success: true, manualLock }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/sources/:id/toggle` | `{ success: true, status, enabled }` | `{ error: "msg" }` 400/404 |
| `POST /api/admin/price-tracker/phones/:id/toggle` | `{ success: true, manualLock }` | `{ error: "msg" }` 400/404 |
| `PUT /api/admin/price-tracker/sources/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/404/409 |
| `PUT /api/admin/price-tracker/listings/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/404 |
| `PUT /api/admin/price-tracker/settings` | `{ success: true, settings: {...} }` | `{ error: "msg" }` 400 |
| `DELETE /api/admin/price-tracker/sources/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/404 |
| `DELETE /api/admin/price-tracker/listings/:id` | `{ success: true, id }` | `{ error: "msg" }` 400/404 |

---

## 10. IMPORT Endpoints (`import.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/import/history` | Raw array `[...]` (NOT wrapped in object) | (auth error) |
| `GET /api/import/stats` | `{ totalImports, successfulImports, ... }` | (auth error) |
| `POST /api/import` | `{ success: true, filename, totalRecords, ... }` | `{ error: "msg" }` 400/500 |
| `POST /api/import/validate` | `{ valid: true, totalRecords, sample }` | `{ error: "msg" }` 400 |
| `POST /api/import/rollback` | `{ success: false, error: "msg" }` 501 | — |

**Note:** `GET /api/import/history` returns a **bare array** — the most non-standard response in the entire API.

---

## 11. FIRST-SETUP Endpoints (`first-setup.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/admin/first-setup/status` | `{ setupAvailable: true }` | `{ error: "Not found" }` 404 |
| `POST /api/admin/first-setup` | `{ success: true, message, admin: {...} }` | `{ error: "msg" }` 400/403/404/500 |

---

## 12. CRON Endpoints (`route.ts` inline + `cron-update-prices.ts`)

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/cron/update-prices` | `{ processed, updated, failed, pending }` | `{ error: "msg" }` 403/409 |
| `GET /api/cron/sync-youtube` | Raw result from `syncYouTubeVideos()` | `{ error: "Unauthorized" }` 401 |
| `GET /api/cron/check-price-drops` | `{ checked, sent }` | `{ error: "Unauthorized" }` 401 |

---

## 13. DOWNLOAD Endpoint

| Endpoint | Success Shape | Error Shape |
|---|---|---|
| `GET /api/download-sample` | File download (non-JSON) | `{ error: "msg" }` 404 |

---

## 14. ROUTE-LEVEL Error Handling (`route.ts`)

The top-level catch blocks in `route.ts` use:

```ts
// GET/POST/DELETE catch:
{ error: 'Internal server error' }  // status 500
{ error: 'Database connection failed...' }  // status 503

// PUT catch (LEAKS DETAILS):
{ error: 'Internal server error', details: msg }  // status 500

// Not found fallback:
{ error: 'Not found' }  // status 404

// Rate limit:
{ error: 'Too many...' }  // status 429
{ error: 'Service temporarily unavailable' }  // status 503
```

---

## 15. AUTH HELPER Error Shape (`helpers.ts`)

`getAdminFromRequest()` returns:
- `{ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }`
- `requirePermission()` returns: `NextResponse.json({ error: 'Forbidden' }, { status: 403 })`

---

## 16. Cross-Cutting Issues Found

### 16.1 Inconsistent Error Shape

| Pattern | Count | Example |
|---|---|---|
| `{ error: "string" }` | ~80 | Most validation/not-found errors |
| `{ error: "string", details: "string" }` | ~3 | `PUT /admin/phones/:id` save errors, top-level PUT catch |
| `{ success: false, error: "string" }` | ~3 | `POST /import/rollback`, `POST /collector/sources/:id/test` |
| `{ authenticated: false }` | ~4 | Session check endpoints |
| `{ valid: true, ... }` | 1 | `POST /import/validate` |

**Zero** endpoints use the proposed `{ success: false, error: { code, message } }` pattern.

### 16.2 Internal Error Details Leaked to Client

| Location | Issue |
|---|---|
| `PUT` top-level catch in `route.ts` | Returns `{ error, details: e.message }` — leaks stack trace info |
| `PUT /api/admin/phones/:id` | Returns `{ error, details: e.message }` on save failure |
| `POST /api/admin/videos/lookup` | Returns `{ error: e.message }` on YouTube fetch failure |
| `POST /import/validate` | Returns `{ error: "Parse error: ${e.message}" }` — leaks parser internals |
| `POST /api/import` | Returns `{ error: "Parse error: ${e.message}" }` |
| `POST /admin/change-password` | Returns `{ error: "Weak password: ${pwCheck.errors.join(...)}" }` — reveals password policy |
| `POST /admin/forgot-password` | Returns `{ error: 'Email required' }` on missing email — reveals endpoint behavior |

### 16.3 Inconsistent Caching Headers

| Category | Cache | Endpoints |
|---|---|---|
| Public GET (via `cached()`) | ✅ `s-maxage` + `swr` | All 22 public GET endpoints |
| Admin GET | ❌ None | All 20+ admin GET endpoints |
| Admin POST/PUT/DELETE | ❌ None | All mutation endpoints |
| Cron GET | ❌ None | 3 cron endpoints |
| `GET /api/download-sample` | ✅ `max-age=3600` | 1 endpoint |

**Assessment:** Public caching is well-implemented. Admin endpoints correctly have no cache headers. No issues here.

### 16.4 Missing Error Handling (Uncaught Exceptions)

All handler files are wrapped in top-level try/catch in `route.ts`, so unhandled promise rejections are caught. However:

| Risk | Details |
|---|---|
| `POST /api/admin/login` | `req.json()` called before auth check — malformed JSON will throw before rate limiting |
| `POST /api/admin/first-setup` | Protected by Zod + outer try/catch — good |
| `GET /api/phones` | Brand filter `Brand.findOne()` failure not caught (but outer catch handles it) |
| `GET /api/admin/stats` | Multiple parallel `Promise.all` — any failure caught by outer handler |
| `PUT /api/admin/phones/:id` | Has its own nested try/catch — good |
| `POST /api/admin/phones/bulk-import` | Inner loop errors caught per-row — good |

**Overall:** Error handling is solid. The top-level catch blocks in route.ts serve as a safety net.

### 16.5 Authentication Coverage

| Handler | Auth Required | Coverage |
|---|---|---|
| `public.ts` GET | None | ✅ Correct |
| `public.ts` POST | None (contact, reviews, price-alerts) | ✅ Correct |
| `admin-auth.ts` GET | Session-based | ✅ Correct |
| `admin-auth.ts` POST | Session or none (login/forgot/reset) | ✅ Correct |
| `admin-auth.ts` DELETE | Session-based | ✅ Correct |
| `admin-crud.ts` GET | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `admin-crud.ts` POST | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `admin-crud.ts` PUT | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `admin-crud.ts` DELETE | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `collector.ts` | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `price-tracker.ts` | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `import.ts` GET | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `import.ts` POST | `getAdminFromRequest` + `requirePermission` | ✅ All endpoints covered |
| `first-setup.ts` | Setup key + CSRF + rate limit | ✅ Correct |
| `cron-update-prices.ts` | CRON_SECRET (timing-safe) | ✅ Correct |
| `cron/sync-youtube` | CRON_SECRET (timing-safe) | ✅ Correct |
| `cron/check-price-drops` | CRON_SECRET (timing-safe) | ✅ Correct |

**Assessment:** Authentication coverage is excellent. All admin endpoints require both authentication and specific permissions. Cron endpoints use timing-safe secret comparison.

### 16.6 Non-JSON Responses

| Endpoint | Returns |
|---|---|
| `GET /api/price-alerts/confirm` | HTTP 302 redirect |
| `GET /api/price-alerts/unsubscribe` | HTTP 302 redirect |
| `GET /api/admin/users/export` | CSV file download |
| `GET /api/download-sample` | JSON file download |

These are special-purpose endpoints that should NOT be wrapped in the standard JSON envelope.

---

## 17. Risk Assessment — Migration to Standard Shape

### 17.1 Frontend Impact

**37 frontend files** with **~108 fetch calls** would need updating. Key consumers:

| File | Approx. Fetches | Impact |
|---|---|---|
| `app/admin/price-tracker/page.tsx` | 16 | HIGH |
| `app/admin/videos/page.tsx` | 10 | HIGH |
| `app/admin/phones/page.tsx` | 6 | HIGH |
| `app/admin/news/page.tsx` | 6 | HIGH |
| `app/phones/[slug]/page.tsx` | 6 | HIGH |
| `app/admin/phones/[id]/page.tsx` | 1 | HIGH (phone form) |
| `app/admin/collector/sources/page.tsx` | 4 | MEDIUM |
| `app/admin/import/page.tsx` | 4 | MEDIUM |
| `app/admin/reviews/page.tsx` | 5 | MEDIUM |
| `app/admin/brands/page.tsx` | 3 | MEDIUM |
| `app/admin/sponsors/page.tsx` | 3 | MEDIUM |
| `app/admin/users/page.tsx` | (uses useAdmin) | MEDIUM |
| `app/HomeContent.tsx` | 1 | MEDIUM |
| `app/compare/page.tsx` | 3 | MEDIUM |
| `app/search/page.tsx` | 1 | LOW |
| `app/phones/page.tsx` | 2 | LOW |
| `app/brands/page.tsx` | 1 | LOW |
| `app/brands/[slug]/page.tsx` | 1 | LOW |
| `app/news/page.tsx` | 1 | LOW |
| `app/videos/page.tsx` | 1 | LOW |
| `app/contact/page.tsx` | 1 | LOW |
| `lib/useAdmin.tsx` | 2 (session + auth) | HIGH |

### 17.2 Breaking Changes Required

If normalized to `{ success: true, data }`:

1. **Every public GET response** needs to be wrapped: `res.data.phones` instead of `res.phones`
2. **Every admin GET list response** needs wrapping: `res.data.logs` instead of `res.logs`
3. **Auth session check** changes shape: `{ authenticated, admin }` → `{ success: true, data: { authenticated, admin } }`
4. **Error handling** in every frontend fetch would need: check `res.success` instead of checking `res.ok` + `res.error`
5. **Settings endpoint** is unique — returns `{ settings: {...} }` without `success`, and `PUT /admin/settings` returns same
6. **Import history** returns a bare array — would need to become `{ success: true, data: [...] }`
7. **Test-source and videos/lookup** return raw diagnostic data without `success` wrapper

### 17.3 Recommended Migration Strategy

**Phase 1 — Error normalization (LOW risk):**
- Add `{ success: false, error: { code: status, message } }` to all error responses
- Create a shared `apiError(code, message, status)` helper
- Update frontend error handling to check `res.success === false`

**Phase 2 — Success wrapping for mutations (MEDIUM risk):**
- Wrap all POST/PUT/DELETE success responses: `{ success: true, data: { id, ... } }`
- Update admin frontend mutation handlers to unwrap `res.data`

**Phase 3 — Success wrapping for reads (HIGH risk):**
- Wrap all GET success responses: `{ success: true, data: { ... } }`
- Update ALL 37+ frontend files to unwrap `res.data`
- Consider a client-side wrapper/fetch utility that auto-unwraps to minimize changes

**Phase 4 — Non-JSON exceptions:**
- Leave redirects and file downloads as-is
- Document these as out-of-scope for the standard envelope

### 17.4 Estimated Effort

| Phase | Backend Changes | Frontend Changes | Risk |
|---|---|---|---|
| Phase 1 (errors) | ~80 endpoints | ~30 components | LOW |
| Phase 2 (mutations) | ~35 endpoints | ~20 components | MEDIUM |
| Phase 3 (reads) | ~40 endpoints | ~37 components | HIGH |
| **Total** | **~105 endpoints** | **~37 files** | **HIGH** |

---

## 18. Summary of Findings

### What Works Well
- ✅ Authentication is comprehensive and consistent
- ✅ Permission-based access control on all admin endpoints
- ✅ Rate limiting on public-facing mutation endpoints
- ✅ Public GET endpoints have proper cache-control headers
- ✅ Top-level error catching prevents unhandled rejections
- ✅ Activity logging on all admin mutations
- ✅ SSRF protection on price tracker URL fetching
- ✅ Timing-safe secret comparison for cron and setup

### What Needs Attention
- ⚠️ **No endpoint** follows the proposed `{ success: true, data }` envelope for reads
- ⚠️ **Zero** error responses use `{ success: false, error: { code, message } }` pattern
- ⚠️ PUT route catch leaks `details: e.message` to client (information disclosure)
- ⚠️ `PUT /admin/phones/:id` leaks `details: e.message` on save failures
- ⚠️ Import validate/upload leaks parser error messages
- ⚠️ `GET /api/import/history` returns a bare array (most non-standard)
- ⚠️ `GET /api/admin/settings` returns `{ settings }` without `success`, but `PUT /admin/settings` also returns `{ settings }` without `success` (inconsistent with other PUTs)
- ⚠️ `POST /admin/videos/sync` returns raw sync result without `success`
- ⚠️ `POST /admin/videos/lookup` returns raw video data without `success`
- ⚠️ `POST /admin/price-tracker/test-source` returns raw diagnostic data without `success`
- ⚠️ Session check endpoints use `{ authenticated: true/false }` — unique non-standard shape