# Performance & Code Quality Audit — PhoneDock Pakistan

**Date:** 2025-07-10  
**Scope:** API layer, data layer, key public pages, configuration  
**Auditor:** Automated code audit (read-only)

---

## Executive Summary

| # | Severity | Category | Issue | File(s) | Impact |
|---|----------|----------|-------|---------|--------|
| P1 | **Critical** | Performance | N+1 query in price-alert cron | `route.ts:62-98` | O(N) DB queries per cron run; linear time growth with alerts |
| P2 | **Critical** | Performance | Phone detail page is 100% client-rendered | `phones/[slug]/page.tsx:1` | No SSR/SEO, 3 waterfall fetches, no metadata |
| P3 | **Critical** | Code Quality | God file: `admin-crud.ts` at 1,703 lines | `admin-crud.ts` | Unmaintainable, 59 `any` types, all entities in one file |
| P4 | **High** | Performance | Homepage fires 17+12 = 29 DB round-trips | `fetch-home-data.ts:27-108` | Slowest page load; 12 sequential spec-attachment queries |
| P5 | **High** | Performance | Unbounded queries on 6 public endpoints | `public.ts:289,305,312,406,193,214` | Returns all matching rows — potential OOM with large collections |
| P6 | **High** | Performance | `force-dynamic` on 8 static-capable pages | 8 page files | No CDN caching, every request hits DB |
| P7 | **High** | Performance | All images use `unoptimized` — no `sizes`/`priority` | `phones/[slug]/page.tsx:504,520` | Bloated image payloads, slow LCP |
| P8 | **High** | Code Quality | God file: `phones/[slug]/page.tsx` at 987 lines | `phones/[slug]/page.tsx` | 6 sub-components crammed into one file |
| P9 | **High** | Code Quality | God file: `HomeContent.tsx` at 660 lines | `HomeContent.tsx` | 8 sub-components in one file; no code splitting |
| P10 | **High** | Code Quality | 77 `any` type annotations across 2 API files | `public.ts` (18), `admin-crud.ts` (59) | No compile-time safety; silent runtime errors |
| P11 | **Medium** | Performance | Top-level `nodemailer` import in API router | `route.ts:3` | ~1MB dep loaded on every cold start |
| P12 | **Medium** | Performance | Duplicate homepage queries (featured phones) | `fetch-home-data.ts` + `page.tsx` | `fetchHomeData()` + `fetchHeroPhones()` both query featured |
| P13 | **Medium** | Performance | Missing `.select()` projections on several endpoints | `public.ts:187,194,299,568` | Full documents transferred over DB wire |
| P14 | **Medium** | Code Quality | Duplicated spec-attachment logic | `public.ts:26-31` vs `fetch-home-data.ts:15-23` | Bug-prone; changes must be synced manually |
| P15 | **Medium** | Code Quality | Duplicated nodemailer transporter creation | `route.ts:71,346` + `public.ts:501` | 3 copies of identical config |
| P16 | **Medium** | Code Quality | Duplicated regex-escape pattern (8+ times) | Multiple files | `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` |
| P17 | **Medium** | Code Quality | Inconsistent error handling patterns | `route.ts` vs `admin-crud.ts` vs `public.ts` | Some errors silently swallowed (line 1132) |
| P18 | **Medium** | Performance | Missing error boundaries below root | `/app/error.tsx` is only one | Any child page crash kills the whole app |
| P19 | **Low** | Performance | `specGroups` array recreated every render | `phones/[slug]/page.tsx:448-480` | 6 groups × ~7 items = ~42 objects per render |
| P20 | **Low** | Performance | `clearAll` not wrapped in `useCallback` | `phones/page.tsx:147` | Inconsistent with adjacent `useCallback` usage |
| Q1 | **Low** | Code Quality | Magic numbers scattered throughout | All API files | Cache TTLs, limits, rate limits hardcoded |
| Q2 | **Low** | Code Quality | Dead/unused npm dependencies | `package.json` | `react-markdown`, `react-syntax-highlighter` not imported |

---

## Detailed Findings

### P1 — N+1 Query in Price-Alert Cron

**File:** `/home/z/my-project/src/app/api/[[...path]]/route.ts`  
**Lines:** 62–98  
**Severity:** Critical

```typescript
for (const alert of alerts) {
  const phone = alert.phoneId as any;
  if (!phone || !phone.pricePKR) continue;
  const lastPrice = await PriceHistory.findOne({ phoneId: phone._id, storeName: null })
    .sort({ recordedAt: -1 }).lean();  // ← One query PER alert
  // ... send email per alert
}
```

**Impact:** Each alert triggers a separate `PriceHistory.findOne()` DB query and a `nodemailer.sendMail()` call. With 100 alerts, that's 100 sequential DB queries + 100 email sends inside a single cron invocation.  
**Fix:** Batch-fetch all latest prices in one query:  
```typescript
const phoneIds = alerts.map(a => (a.phoneId as any)._id);
const latestPrices = await PriceHistory.aggregate([
  { $match: { phoneId: { $in: phoneIds }, storeName: null } },
  { $sort: { recordedAt: -1 } },
  { $group: { _id: '$phoneId', price: { $first: '$price' } } },
]);
const priceMap = new Map(latestPrices.map(p => [p._id.toString(), p.price]));
```

---

### P2 — Phone Detail Page is 100% Client-Rendered

**File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`  
**Line:** 1 (`'use client'`)  
**Severity:** Critical

```typescript
'use client';  // ← Entire page is a client component
// ...
export default function PhoneDetailPage({ params }) {
  const [slug, setSlug] = useState<string>('');
  const [data, setData] = useState<...>(null);
  
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/phones/${slug}`).then(...)           // Request 1
    fetch(`/api/phones/${slug}/price-history`).then(...) // Request 2
    fetch(`/api/phones/${slug}/price-tracker`).then(...) // Request 3
  }, [slug]);
}
```

**Impact:**
- **Zero SEO:** No `export const metadata`, no `generateMetadata`. Google sees an empty `<div>` until JS hydrates.
- **Waterfall:** 3 sequential client-side fetches after hydration (actually parallel but blocked on hydration).
- **Flash of loading:** Users see skeleton UI on every navigation, even for cached data.
- **No ISR:** Every visit hits the origin server; cannot leverage Vercel CDN page cache.

**Fix:** Convert to a server component with `generateMetadata` + `generateStaticParams`. Fetch data server-side. Keep only interactive sub-components (reviews form, comparison modal, price alert) as client islands.

---

### P3 — God File: `admin-crud.ts` (1,703 lines)

**File:** `/home/z/my-project/src/app/api/[[...path]]/handlers/admin-crud.ts`  
**Severity:** Critical

This single file contains:
- GET handlers for: admin stats, phone stats, phones list, phone detail, brand stats, brands list, news stats, news list, user stats, user detail, user export, user list, sponsors, activity list, activity stats, video stats, video search, video list, price tracker stats, price tracker list
- POST handlers for: phone create, brand create, news create, user create, bulk actions
- PUT handlers for: phone update, brand update, news update, user update, phone score calc, toggle featured/trending
- DELETE handlers for: phone delete, brand delete, news delete, user delete

**Impact:** Nearly impossible to navigate, test, or review. 59 `any` type annotations. Any change risks breaking unrelated features.  
**Fix:** Split into domain-specific files: `admin-phones.ts`, `admin-brands.ts`, `admin-news.ts`, `admin-users.ts`, `admin-videos.ts`, `admin-activity.ts`, `admin-price-tracker.ts`.

---

### P4 — Homepage Fires 29 DB Round-Trips

**File:** `/home/z/my-project/src/lib/fetch-home-data.ts`  
**Lines:** 27–108  
**Severity:** High

```typescript
// First wave: 8 parallel queries
const [featured, trending, latest, bestCamera, bestGaming, bestBattery, upcoming, news] = 
  await Promise.all([/* 8 Phone.find() / News.find() calls */]);

// Second wave: 9 parallel queries  
const [pc_above100k, pc_price60to100, pc_price40to60, pc_price20to40, pc_under20k, brandAgg, sponsors, totalPhones, totalBrands] = 
  await Promise.all([/* 5 Phone.find() + 1 Brand.aggregate + 3 counts */]);

// Third wave: 12 SEQUENTIAL spec attachments (each is a DB query)
const priceCategories = {
  above100k: await attachBasicSpecs(pc_above100k.map(...)),   // query 1
  price60to100: await attachBasicSpecs(pc_price60to100.map(...)), // query 2
  // ... 10 more sequential queries
};
// Plus 7 more sequential attachBasicSpecs for featured, trending, etc.
```

**Impact:** 17 parallel + 12 sequential = 29 DB round-trips per homepage ISR regeneration. On a cold serverless function, this can take 2–5 seconds.  
**Fix:** 
1. Collect ALL phone IDs from all 12 arrays, do a **single** `PhoneSpecs.find({ phoneId: { $in: allIds } })`, build one map, attach to all arrays.
2. Consider caching brand aggregate results separately.

---

### P5 — Unbounded Queries on 6 Public Endpoints

**File:** `/home/z/my-project/src/app/api/[[...path]]/handlers/public.ts`  
**Severity:** High

| Endpoint | Line | Query | Missing |
|----------|------|-------|---------|
| `/api/brands` | 289–296 | `Brand.aggregate(...)` | No `.limit()` |
| `/api/brands/:slug` | 305–307 | `Phone.find({ brandId })` | No `.limit()` |
| `/api/news` | 312–314 | `News.find({ published: true })` | No `.limit()` |
| `/api/upcoming-phones` | 404–407 | `Phone.find({ upcoming: true })` | No `.limit()` |
| `/api/phones/:slug` (prices) | 193 | `PhonePrice.find({ phoneId })` | No `.limit()` |
| `/api/phones/:slug/price-history` | 214 | `PriceHistory.find({ phoneId })` | No `.limit()` |

**Impact:** As the database grows, these endpoints return unbounded result sets. A brand like Samsung with 200+ phones would transfer all of them. Price history could grow indefinitely.  
**Fix:** Add `.limit()` to all queries:
- Brands list: `.limit(100)`
- Brand phones: `.limit(50)` with pagination support
- News: `.limit(20)`  
- Upcoming: `.limit(20)`
- Prices: `.limit(10)`
- Price history: `.limit(365)`

---

### P6 — Unnecessary `force-dynamic` on 8 Static-Capable Pages

**Files:**
- `/home/z/my-project/src/app/best-camera-phone/page.tsx:1`
- `/home/z/my-project/src/app/best-gaming-phone/page.tsx:1`
- `/home/z/my-project/src/app/best-budget-phone/page.tsx:1`
- `/home/z/my-project/src/app/best-battery-phone/page.tsx:1`
- `/home/z/my-project/src/app/best-value-phone/page.tsx:1`
- `/home/z/my-project/src/app/upcoming/page.tsx:1`
- `/home/z/my-project/src/app/price-ranges/page.tsx:1`
- `/home/z/my-project/src/app/reviews/page.tsx:1`

**Severity:** High

```typescript
export const dynamic = 'force-dynamic';  // ← at line 1 of every file
```

**Impact:** These pages show ranked phone lists (e.g., "Best Camera Phones") that change infrequently. With `force-dynamic`, every single page view triggers a fresh server-side render + DB query. No CDN caching is possible.  
**Fix:** Replace with `export const revalidate = 300;` (5 minutes). This enables ISR — pages are served from CDN and re-generated in the background when stale.

---

### P7 — All Images Use `unoptimized` with Missing `sizes`/`priority`

**File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`  
**Lines:** 504, 520  
**Severity:** High

```typescript
<Image 
  src={images[activeImage]?.url || images[0].url} 
  alt={...} 
  width={300} height={300} 
  className="object-contain" 
  unoptimized  // ← skips Next.js image optimization entirely
/>
```

Also in thumbnail gallery (line 520):
```typescript
<Image src={img.url} alt={...} width={64} height={64} 
  className="object-contain w-full h-full p-1" unoptimized />
```

**Missing from ALL images on the page:**
- `priority` — the main product image is the LCP element and should have `priority`
- `sizes` — responsive images won't generate correct `srcset` values

**Impact:** Images are served at their original size without WebP/AVIF conversion. The main product image (LCP) doesn't get the browser's highest fetch priority.  
**Fix:** Remove `unoptimized` from images hosted on configured domains (gsmarena.com, cloudinary.com). Add `priority` to the main product image. Add `sizes="(max-width: 1024px) 100vw, 33vw"` for responsive loading.

---

### P8 — God File: `phones/[slug]/page.tsx` (987 lines)

**File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`  
**Severity:** High

This file contains **6 separate components** defined inline:

| Component | Approx. Lines | Purpose |
|-----------|--------------|---------|
| `PriceHistoryChart` | 24–97 | SVG price chart |
| `ScoreBar` | 99–120 | Score progress bar |
| `ComparisonModal` | ~122–175 | Phone comparison drawer |
| `PriceAlertButton` | ~177–253 | Email alert subscription |
| `UserReviewsSection` | ~255–352 | Review form + list |
| `PhoneDetailPage` | 354–987 | Main page (634 lines of JSX) |

**Impact:** Any change to the review form requires loading the entire 987-line file in the editor and re-bundling the entire module. No code splitting or lazy loading is possible.  
**Fix:** Extract each component to its own file under `src/components/phone-detail/`.

---

### P9 — God File: `HomeContent.tsx` (660 lines)

**File:** `/home/z/my-project/src/app/HomeContent.tsx`  
**Severity:** High

Contains **8 components**:

| Component | Purpose |
|-----------|---------|
| `QuickCategoryStrip` | Category navigation bar |
| `PakistanTrustBar` | Trust indicators |
| `BrandsGrid` | Brand logo grid |
| `PhoneSection` | Horizontal phone card carousel |
| `CompactTopPhones` | Ranked phone list |
| `HomeReviewsSection` | Latest reviews grid |
| `ComingSoonTeasers` | Feature teaser cards |
| `NewsletterSection` | Email subscription form |
| `HomeContent` (default export) | Main page layout composing above |

**Impact:** All 8 components are bundled into a single client chunk. The newsletter form code loads even if the user never scrolls to it.  
**Fix:** Extract to `src/components/home/` directory. Consider `React.lazy()` for `NewsletterSection` and `HomeVideoSection` (which has its own `useState` + fetch).

---

### P10 — 77 `any` Type Annotations in API Handlers

**Files:**
- `public.ts`: 18 occurrences
- `admin-crud.ts`: 59 occurrences

**Severity:** High

Examples:
```typescript
// admin-crud.ts:83
const filter: any = { active: true };

// admin-crud.ts:125
let sort: any = { createdAt: -1 };

// admin-crud.ts:448
return { ...u, id: u._id?.toString(), status: userStatus, sessionCount: 0 };
// ↑ u is (implicitly or explicitly) any

// admin-crud.ts:1196
const { _id, __v, phoneId, id, createdAt, updatedAt, _count, ...rest } = specs as any;
```

**Impact:** No compile-time safety. Typos in property names, wrong query shapes, and missing fields silently pass TypeScript checks.  
**Fix:** Create proper interfaces for filter objects (`PhoneFilter`, `NewsFilter`), sort objects (`SortOption`), and API response shapes. Use Mongoose's `InferRawDocType<>` or `HydratedDocument<>` for document types.

---

### P11 — Top-Level `nodemailer` Import in API Router

**File:** `/home/z/my-project/src/app/api/[[...path]]/route.ts`  
**Line:** 3  
**Severity:** Medium

```typescript
import nodemailer from 'nodemailer';  // ← imported at top level
```

This import is only used in the `check-price-drops` cron handler (lines 71–76). However, because it's a top-level import, it's loaded into memory on **every** API request to **any** route (phones, brands, search, etc.).

**Impact:** `nodemailer` is a heavy dependency (~1MB with transitive deps). It increases cold-start time and memory usage for all API routes, not just the cron.  
**Fix:** Use dynamic import: `const nodemailer = await import('nodemailer')` inside the cron handler. In fact, `public.ts` already does this correctly at line 501.

---

### P12 — Duplicate Homepage Queries (Featured Phones)

**File:** `/home/z/my-project/src/app/page.tsx` lines 17–20 + `/home/z/my-project/src/lib/fetch-home-data.ts` lines 31, 113–117  
**Severity:** Medium

```typescript
// page.tsx
const [raw, heroRaw] = await Promise.all([
  fetchHomeData(),    // → fetches featured phones (line 31)
  fetchHeroPhones(),  // → fetches featured phones AGAIN (line 116)
]);
```

Both `fetchHomeData()` and `fetchHeroPhones()` query `Phone.find({ active: true, status: 'published', featured: true })` with `.limit(8)` and `.limit(6)` respectively. The same documents are fetched twice.

**Impact:** 2 extra DB queries + spec attachment queries per homepage load.  
**Fix:** Return hero phones as part of `fetchHomeData()` response, or deduplicate by sharing the query result.

---

### P13 — Missing `.select()` Projections on Several Endpoints

**File:** `/home/z/my-project/src/app/api/[[...path]]/handlers/public.ts`  
**Severity:** Medium

| Line | Endpoint | Issue |
|------|----------|-------|
| 187 | `/api/phones/:slug` | `Phone.findOne().populate('brand')` — fetches ALL fields including `description`, `pros`, `cons`, `reviewSummary`, `reviewVerdict` (long text fields) |
| 194 | Related phones | `Phone.find().populate('brand').lean()` — full documents for 6 related phones |
| 299–300 | `/api/top-phones` | `Phone.find().populate('brand').lean()` — full documents |
| 568 | `/api/admin/videos/search` | `Video.find()` with full `description` field |
| 305–307 | `/api/brands/:slug` | Good: uses `.select()` ✓ |

**Impact:** Extra data transferred over MongoDB wire and serialized to JSON. For the phone detail, the `description` field alone can be 2–5KB.  
**Fix:** Add `.select()` to exclude heavy text fields from list/detail responses where they aren't immediately needed:
```typescript
.select('-description -pros -cons -reviewSummary -reviewVerdict -sourceName -sourceUrl')
```

---

### P14 — Duplicated Spec-Attachment Logic

**Files:**
- `/home/z/my-project/src/app/api/[[...path]]/handlers/public.ts` lines 26–31
- `/home/z/my-project/src/lib/fetch-home-data.ts` lines 15–23

**Severity:** Medium

```typescript
// public.ts
async function attachListSpecs(phones: any[]): Promise<any[]> {
  if (phones.length === 0) return phones;
  const ids = phones.map((p: any) => p._id);
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);
  return attachSpecsToRawPhones(phones, specsMap);
}

// fetch-home-data.ts — NEARLY IDENTICAL
async function attachBasicSpecs(phones: any[]): Promise<any[]> {
  if (phones.length === 0) return phones;
  const ids = phones.map((p: any) => p.id).filter(Boolean);
  const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
  const specsMap = buildSpecsMap(specsArr);
  return attachSpecsToJsonPhones(phones, specsMap);
}
```

The only difference is `p._id` vs `p.id` and `attachSpecsToRawPhones` vs `attachSpecsToJsonPhones`.

**Impact:** Bug-prone duplication. A fix in one must be applied to the other.  
**Fix:** Create a single shared `attachSpecs(phones, idField)` utility that handles both raw Mongoose docs and JSON-serialized objects.

---

### P15 — Duplicated Nodemailer Transporter Creation

**Files:**
- `/home/z/my-project/src/app/api/[[...path]]/route.ts` lines 71–76 (price drop cron)
- `/home/z/my-project/src/app/api/[[...path]]/route.ts` lines 346–351 (price alert confirmation)
- `/home/z/my-project/src/app/api/[[...path]]/handlers/public.ts` lines 501–506 (contact form)

**Severity:** Medium

All three locations create identical transporter configs:
```typescript
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',  // varies slightly
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});
```

**Impact:** Every email send creates a new transport connection. The `secure` flag is inconsistent (one uses `EMAIL_SECURE`, another compares port to 465).  
**Fix:** Create a shared `lib/email.ts` with a singleton `getTransporter()` function.

---

### P16 — Duplicated Regex-Escape Pattern

**Files:** `public.ts`, `admin-crud.ts` (8+ occurrences)  
**Severity:** Low

```typescript
const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

This exact line appears at least 8 times across the two handler files.

**Fix:** Extract to `lib/sanitize.ts`:
```typescript
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

---

### P17 — Inconsistent Error Handling Patterns

**Files:** All API handlers  
**Severity:** Medium

| Pattern | File | Example |
|---------|------|---------|
| Top-level try-catch with DB error detection | `route.ts:177-184` | Checks for MONGODB_URI, ECONNREFUSED etc. |
| `cachedError()` with cache headers | `public.ts:17-21` | Consistent for public routes |
| Silent swallow | `admin-crud.ts:1132` | `catch { /* ignore brand lookup failure */ }` |
| Nested try-catch with detail leak | `admin-crud.ts:1176-1189` | Returns `details: msg` in 500 response |
| Generic 500 | `route.ts:183` | `{ error: 'Internal server error' }` |

**Impact:** Some errors expose internal details (`details: msg`), while others are silently swallowed. Inconsistent UX.  
**Fix:** Standardize on a shared error response helper. Never expose internal messages in production.

---

### P18 — Missing Error Boundaries Below Root

**File:** `/home/z/my-project/src/app/error.tsx` (only one)  
**Severity:** Medium

**Present:**
- `/app/error.tsx` ✓
- `/app/loading.tsx` ✓
- `/app/phones/[slug]/loading.tsx` ✓
- `/app/phones-under/[price]/loading.tsx` ✓
- 7 more `loading.tsx` files ✓

**Missing:**
- `/app/phones/error.tsx` ✗
- `/app/phones/[slug]/error.tsx` ✗
- `/app/news/error.tsx` ✗
- `/app/brands/error.tsx` ✗

**Impact:** If the phone detail page crashes (e.g., malformed data), the root error boundary catches it and replaces the **entire** app layout including Header/Footer. A route-level error boundary would contain the error to just the content area.  
**Fix:** Add `error.tsx` files to `/phones/`, `/phones/[slug]/`, `/news/`, and `/brands/` directories.

---

### P19 — `specGroups` Array Recreated Every Render

**File:** `/home/z/my-project/src/app/phones/[slug]/page.tsx`  
**Lines:** 448–480  
**Severity:** Low

```typescript
export default function PhoneDetailPage({ params }) {
  // ... (inside the component body, after early returns)
  const specGroups = [
    { title: 'Display & Design', icon: Monitor, specs: [
      { label: 'Display', value: p.specs?.display },
      // ... 11 more specs
    ]},
    { title: 'Performance', icon: Cpu, specs: [
      // ... 8 more specs
    ]},
    // ... 4 more groups = ~42 objects total
  ];
```

This array is defined inside the component body (not outside, not in a `useMemo`). It's recreated on every render, including re-renders from tab changes, image gallery clicks, etc.

**Fix:** Move outside the component (it only depends on `p` which is destructured from data), or wrap in `useMemo`:
```typescript
const specGroups = useMemo(() => [...], [p.specs]);
```

---

### P20 — `clearAll` Not Wrapped in `useCallback`

**File:** `/home/z/my-project/src/app/phones/page.tsx`  
**Line:** 147  
**Severity:** Low

```typescript
const clearAll = () => {  // ← recreated every render
  router.push('/phones');
  setSearch('');
};
```

The adjacent `updateParam` is correctly wrapped in `useCallback`, but `clearAll` is not. While this doesn't cause performance issues currently (it's only passed to two buttons), it's inconsistent.

---

### Q1 — Magic Numbers

**Severity:** Low  
**Files:** All API handler files

Examples:
- Cache TTLs: `60`, `120`, `300`, `600` (seconds) — what do they represent?
- Limits: `8`, `4`, `6`, `10`, `20`, `50`, `100`
- Rate limits: `10, 60_000`, `5, 60_000`, `3, 60_000`, `400, 60_000`
- Retry config: `retries = 3, delay = 1000` in `mongodb.ts:23`

**Fix:** Extract to a `lib/constants.ts` file:
```typescript
export const CACHE_TTL = { SHORT: 60, MEDIUM: 300, LONG: 600 } as const;
export const PAGE_SIZES = { DEFAULT: 20, MAX: 100 } as const;
export const RATE_LIMITS = { LOGIN: { max: 10, window: 60_000 }, ... } as const;
```

---

### Q2 — Dead/Unused npm Dependencies

**File:** `/home/z/my-project/package.json`  
**Severity:** Low

| Package | Size (approx) | Status |
|---------|--------------|--------|
| `react-markdown` | ~45KB | Not imported anywhere in `src/` |
| `react-syntax-highlighter` | ~400KB | Not imported anywhere in `src/` |
| `recharts` | ~500KB | Only imported in `components/ui/chart.tsx` (shadcn boilerplate) — not used by any app page |

**Impact:** These packages increase `node_modules` size and may slow CI/install times. They do NOT affect client bundle size (tree-shaken out), but they're dead weight in the dependency tree.  
**Fix:** Run `npm uninstall react-markdown react-syntax-highlighter` if confirmed unused. Keep `recharts` if chart components may be used in the future, otherwise remove.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Critical issues** | 3 |
| **High issues** | 7 |
| **Medium issues** | 8 |
| **Low issues** | 5 |
| **Total issues found** | 23 |
| **Files audited** | 10 |
| **Total `any` types in API layer** | 77 |
| **God files (>500 lines)** | 3 |
| **Unbounded queries** | 6 |
| **force-dynamic pages** | 8 |
| **Missing error boundaries** | 4 routes |
| **Loading states present** | 12 loading.tsx files ✓ |

---

## Priority Recommendations (Ordered by Impact)

1. **Convert `phones/[slug]/page.tsx` to server component** — biggest SEO and performance win
2. **Batch the 12 sequential spec-attachment queries in `fetch-home-data.ts`** — single biggest DB optimization
3. **Replace `force-dynamic` with `revalidate = 300` on 8 pages** — enables CDN caching
4. **Split `admin-crud.ts` into domain-specific files** — maintainability
5. **Add `.limit()` to all 6 unbounded public queries** — protection against growth
6. **Fix N+1 in price-alert cron** — use `$group` aggregation
7. **Remove top-level `nodemailer` import in `route.ts`** — use dynamic import
8. **Add route-level error boundaries** — resilience
9. **Extract sub-components from god files** — code splitting
10. **Add proper TypeScript interfaces** — replace `any` types