# PERFORMANCE AUDIT REPORT
**Build:** PHONEDOCK-FIX-PERFORMANCE-15 | **Date:** 2026-07-18

## A. Database Performance

### Indexes (Already Configured)
| Collection | Index | Type |
|-----------|-------|------|
| Phone | `{slug: 1}` | Unique |
| Phone | `{createdAt: -1}` | Standard |
| Phone | `{active: 1, status: 1, createdAt: -1}` | Compound |
| Phone | `{brandId: 1, status: 1}` | Compound |
| Phone | `{active: 1, status: 1, pricePKR: 1}` | Compound |
| Phone | `{pricePKR: 1}` | Standard |
| Phone | `{trending: 1}` | Standard |
| Phone | `{featured: 1}` | Standard |
| Phone | `{modelName: 'text', description: 'text'}` | Text |
| PhoneSpecs | `{phoneId: 1}` | Unique |
| PhoneBenchmark | `{phoneId: 1}` | Unique |
| PhoneImage | `{phoneId: 1, sortOrder: 1}` | Compound |
| PhonePrice | `{phoneId: 1, storeName: 1}` | Compound Unique |
| AdminSession | `{adminId: 1}`, `{tokenJti: 1}`, `{expiresAt: 1}` | Standard |
| Video | `{youtubeId: 1}`, `{phoneId: 1}`, `{brandId: 1}` | Standard |

### Query Patterns
- **Homepage**: `fetchHomeData()` does 13 parallel `Phone.find()` + 1 batch `PhoneSpecs.find($in)` = **14 queries** (good)
- **Phone listing**: `Phone.find(filter).sort().skip().limit().populate('brand').lean()` + batch specs = **3 queries**
- **Phone detail**: 1 Phone.find + 5 parallel lookups (specs, benchmarks, images, prices, related, videos) = **6 queries**
- **Autocomplete**: Single `Phone.find()` with `$or` regex + `.select()` + `.limit(20)` = **1 query**
- All read queries use `.lean()` ✅
- All listing queries use `.select()` to exclude heavy fields ✅
- No N+1 patterns detected ✅

## B. API Performance

### Cache-Control Headers
| Endpoint | s-maxage | swr |
|----------|----------|-----|
| `/api/home` | 60s | 300s |
| `/api/hero-phones` | 60s | 300s |
| `/api/phones` (list) | 120s | 300s |
| `/api/phones/autocomplete` | 60s | 180s |
| `/api/phones/:slug` (detail) | 300s | 600s |
| `/api/phones/lookup` | 60s | 300s |

### Payload Optimization
- Public phone listings exclude: `description`, `pros`, `cons`, `reviewSummary`, `reviewVerdict`, `seoTitle`, `seoDescription`, `keywords`, `sourceName`, `sourceUrl`
- Autocomplete returns only: `id`, `slug`, `modelName`, `thumbnail`, `pricePKR`, `brand`
- Specs are serialized separately and batch-attached (not embedded in Mongoose docs)

### Request Deduplication
- Quick View: Session-level spec cache (5-min TTL) prevents re-fetching same phone
- Autocomplete: AbortController cancels stale requests
- Compare detail fetch: Only runs when `compared` state changes

## C. JavaScript Bundle

### Heavy Dependencies NOT in Public Bundle
| Library | Location | Reason |
|---------|----------|--------|
| xlsx | `src/lib/import/parsers.ts`, `handlers/import.ts` | API route only |
| papaparse | `src/lib/import/parsers.ts`, `handlers/import.ts`, collector providers | API route only |
| recharts | `src/components/ui/chart.tsx` | Not imported by any public page |
| react-syntax-highlighter | Admin/News pages only | Not in public pages |

### Font Loading
- Inter (7 weights: 300-900) + Space Grotesk (4 weights: 400-700) via `next/font/google`
- Uses `font-display: swap` (Next.js default)
- CSS variables `--font-inter` and `--font-heading`

## D. Image Performance

### Configuration
- Formats: `image/avif`, `image/webp` (automatic via Next.js)
- Device sizes: 640, 750, 828, 1080, 1200
- Image sizes: 16, 32, 48, 64, 96, 128, 256
- Remote patterns: gsmarena.com, cloudinary.com, unsplash.com, wikimedia.org, ytimg.com

### Optimizations Applied
- `SafePhoneImage` uses `unoptimized` only for external hosts (no Next.js image optimization server needed)
- Responsive `sizes` attribute auto-computed based on image dimensions
- `priority` defaults to `false` (lazy loading) — only set `true` for true LCP images
- Module-level `failedUrls` Set prevents re-requesting broken URLs
- Object-fit: `object-contain` prevents layout shift

## E. Build Performance Fix

### Before
- `next build` timed out on 9 pages trying SSG with database queries (60s per page × 3 retries)
- Build never completed

### After
- Added `export const dynamic = 'force-dynamic'` to all DB-dependent pages
- Pages render on-demand instead of at build time
- ISR `revalidate` values preserved for Vercel CDN caching
- Build completes in **~16 seconds**

## F. Loading States
| Page | Loading Component |
|------|-----------------|
| Global | `src/app/loading.tsx` ✅ |
| Best Budget Phone | `src/app/best-budget-phone/loading.tsx` ✅ |
| Best Camera Phone | `src/app/best-camera-phone/loading.tsx` ✅ |
| Best Gaming Phone | `src/app/best-gaming-phone/loading.tsx` ✅ |
| Best Battery Phone | `src/app/best-battery-phone/loading.tsx` ✅ |
| Best Value Phone | `src/app/best-value-phone/loading.tsx` ✅ |
| Compare | `src/app/compare/loading.tsx` ✅ **NEW** |
| Search | `src/app/search/loading.tsx` ✅ **NEW** |
| Phone Detail | `src/app/phones/[slug]/loading.tsx` ✅ |
| News Detail | `src/app/news/[slug]/loading.tsx` ✅ |
| Reviews | `src/app/reviews/loading.tsx` ✅ |
| Upcoming | `src/app/upcoming/loading.tsx` ✅ |
| Price Ranges | `src/app/price-ranges/loading.tsx` ✅ |