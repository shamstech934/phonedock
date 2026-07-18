# Database Schema Integrity & Image Audit Report

**Project:** PhoneDock (Next.js)  
**Date:** 2025-01-24  
**Scope:** All Mongoose models, image rendering components, cross-reference validation  
**Status:** READ-ONLY audit — no code was modified

---

## Part 1: Database Schema Integrity

### 1.1 Index Coverage Analysis

| Model | Indexes | Assessment |
|-------|---------|------------|
| **Phone** | slug (unique), createdAt, active+status+createdAt, brandId+status, active+status+pricePKR, pricePKR, trending, featured, text index on modelName+description | ✅ Well-indexed for all query patterns |
| **PhoneSpecs** | phoneId (unique) | ✅ Adequate (1:1 with Phone) |
| **PhoneBenchmark** | phoneId (unique) | ✅ Adequate |
| **PhoneImage** | phoneId (inline) | ⚠️ **MEDIUM** — Missing `sortOrder` index. Gallery images are fetched sorted by `sortOrder` but no compound index `(phoneId, sortOrder)` exists. Low impact since most phones have few images. |
| **PhonePrice** | phoneId (inline), phoneId+storeName (unique) | ✅ Good |
| **PriceHistory** | phoneId (inline), phoneId+storeName, phoneId+recordedAt | ✅ Good |
| **Brand** | slug (unique), active, sortOrder | ✅ Good |
| **News** | slug (unique), status, published+status, published+status+createdAt | ✅ Good |
| **Admin** | email (unique), role, active, customPermissions | ✅ Good |
| **AdminSession** | adminId, tokenJti (unique), expiresAt (TTL 3600s), adminId+revokedAt | ✅ Good |
| **RateLimit** | expiresAt (TTL 0), key (unique) | ✅ Good |
| **ActivityLog** | createdAt (TTL 90d), adminId+createdAt | ✅ Good |
| **UserReview** | phoneId, phoneId+status, status+createdAt | ✅ Good |
| **PriceAlert** | phoneId, phoneId+email, notified+createdAt, confirmTokenHash (sparse) | ✅ Good |
| **Video** | youtubeId (unique), status, featured, syncStatus, createdAt, active+publishedAt, phoneId, brandId | ✅ Good |
| **PriceSource** | name (unique), sourceType, enabled+status, priority | ✅ Good |
| **PhoneRetailListing** | phoneId, sourceId, phoneId+sourceId, phoneId+enabled, sourceId+enabled, verificationStatus, externalProductId | ✅ Well-indexed |
| **PriceTrackerHistory** | phoneId, phoneId+capturedAt, phoneId+changeType, sourceType, verificationStatus, capturedAt | ✅ Good |
| **CollectedPhone** | status, slug, brandName+model, sourceId, jobId, createdAt, duplicateMatches.confidence | ✅ Good |
| **CollectorSource** | enabled, type | ⚠️ **LOW** — No unique index on `name`; duplicate source names are possible |
| **CollectorJob** | status, createdAt, sourceId | ✅ Good |
| **SyncJob** | createdAt, status | ✅ Good |
| **ImportHistory** | createdAt, status | ✅ Good |
| **SystemState** | key (unique) | ✅ Good |
| **Settings** | No indexes (singleton) | ✅ Acceptable — single-document collection |
| **Sponsor** | No indexes | ⚠️ **LOW** — Missing index on `active` or `position` for filtered queries |
| **Review** | phoneId (inline) | ⚠️ **LOW** — Missing `phoneId + published` compound index; listing published reviews for a phone requires in-memory filtering |

### 1.2 Missing Required Fields

| Model | Finding | Severity |
|-------|---------|----------|
| **Phone** | `brandId` is `required: true` ✅. `modelName` and `slug` are `required: true` ✅. All critical fields present. | — |
| **PhoneSpecs** | `phoneId` is `required: true` ✅. | — |
| **PhoneBenchmark** | `phoneId` is `required: true` ✅. | — |
| **PhoneImage** | `phoneId` is `required: true` ✅, `url` is `required: true` ✅. | — |
| **CollectorSource** | `name` is `required: true` ✅, `type` is `required: true` ✅. | — |
| **CollectedPhone** | `brandName` and `model` and `slug` are `required: true` ✅. | — |
| **ImportHistory** | `filename` and `fileType` and `totalRecords` are `required: true` ✅. | — |
| **SystemState** | `key` is `required: true` ✅. | — |
| **Settings** | No `required` fields — all have defaults ✅. Singleton pattern is safe. | — |

**No missing required fields that could cause runtime errors.**

### 1.3 Schema vs Code Field Mismatches

| # | Finding | Severity |
|---|---------|----------|
| 1 | **`Phone` type in `types.ts` missing `priceMode`, `manualLock`, `manualLockReason`, `sourceUrl`** — `phoneToJSON()` returns these fields but the shared `Phone` TypeScript interface does not declare them. TypeScript consumers of `phoneToJSON` output won't see these fields in autocomplete/type-checking. | **MEDIUM** |
| 2 | **`News` model field is `image`** but **`fetchHomeData()` and `public.ts` API rename it to `imageUrl`** (`imageUrl: n.image \|\| ''`). The `NewsItem` interface correctly uses `imageUrl`. The `news/[slug]/page.tsx` server component accesses `article.image` directly. This is internally consistent but the field rename at the API boundary could confuse developers. | **LOW** (documented pattern) |
| 3 | **`IBrand` interface in `Phone.ts`** (5 fields: name, slug, logo, country, description) is a subset of **`IBrand` in `Brand.ts`** (11 fields + dates). The Phone virtual `brand` will return the full Brand document, but the TypeScript type only exposes 5 fields. Not a runtime issue but a type narrowing issue. | **LOW** |
| 4 | **`Phone.releaseDate` is `String` type**, not `Date`. This is intentional (allows flexible formats like "Q4 2024" or "December 2024") but means date-based range queries on `releaseDate` would require string comparison. | **LOW** (intentional design) |
| 5 | **`Settings` model lacks `timestamps: true`** — `updatedAt` is manually defined with `default: Date.now` but is **not auto-updated on save** (Mongoose `timestamps` option handles this automatically; manual field does not). The `updatedAt` will only be set at creation time, not on subsequent updates. | **MEDIUM** |

### 1.4 Relationships & Refs

| Relationship | Ref Definition | Populated In | Assessment |
|-------------|----------------|-------------|------------|
| Phone → Brand | `brandId: { ref: 'Brand' }` + virtual `brand` | Yes (`.populate('brand')`) | ✅ Correct |
| Phone → Admin (createdBy, updatedBy, publishedBy) | `{ ref: 'Admin' }` | No (select: false on password) | ✅ Correct |
| Phone → PriceSource (preferredPriceSourceId) | `{ ref: 'PriceSource' }` | Not observed | ✅ Correct |
| PhoneSpecs → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PhoneBenchmark → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PhoneImage → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PhonePrice → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PriceHistory → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| Video → Phone, Brand, Admin | `{ ref: 'Phone' }`, `{ ref: 'Brand' }`, `{ ref: 'Admin' }` | `.populate('phone')` etc. | ✅ Correct |
| AdminSession → Admin | `{ ref: 'Admin', required: true }` | Via application lookup | ✅ Correct |
| CollectedPhone → CollectorSource, Admin, CollectorJob | `{ ref: 'CollectorSource' }`, `{ ref: 'Admin' }`, `{ ref: 'CollectorJob' }` | Via application lookup | ✅ Correct |
| UserReview → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PriceAlert → Phone | `{ ref: 'Phone', required: true }` | Via application lookup | ✅ Correct |
| PhoneRetailListing → Phone, PriceSource | `{ ref: 'Phone' }`, `{ ref: 'PriceSource' }` | Via application lookup | ✅ Correct |
| PriceTrackerHistory → Phone, PriceSource, Admin | `{ ref: 'Phone' }`, `{ ref: 'PriceSource' }`, `{ ref: 'Admin' }` | Via application lookup | ✅ Correct |
| ActivityLog → Admin | `{ ref: 'Admin' }` | `.populate('adminId', 'name email')` | ✅ Correct |

**All relationships are properly defined. No dangling refs detected.**

### 1.5 Orphan Prevention (Cascading Deletes)

**Phone deletion** (`admin-crud.ts` line 1552-1558) cascades to:
- ✅ `PhoneSpecs.deleteMany({ phoneId: id })`
- ✅ `PhoneBenchmark.deleteMany({ phoneId: id })`
- ✅ `PhoneImage.deleteMany({ phoneId: id })`
- ✅ `PhonePrice.deleteMany({ phoneId: id })`

**Missing cascading deletes — ORPHAN RISK:**

| Orphaned Collection | phoneId Ref | Severity |
|---------------------|-------------|----------|
| **`PriceHistory`** | Yes | **HIGH** — Price history records will remain after phone deletion, accumulating orphan data over time |
| **`Review`** (PhoneSub) | Yes | **MEDIUM** — Old internal review records become orphaned |
| **`UserReview`** | Yes | **MEDIUM** — User-submitted reviews remain without a parent phone |
| **`PriceAlert`** | Yes | **MEDIUM** — Active price alerts for deleted phones will never trigger and can't be fulfilled |
| **`PriceTrackerHistory`** | Yes | **MEDIUM** — Price tracker history records become orphaned |
| **`PhoneRetailListing`** | Yes | **MEDIUM** — Retail listings reference non-existent phones |
| **`CollectedPhone.approvedPhoneId`** | Reverse ref (CollectedPhone → Phone) | **LOW** — Approved collected phones still reference deleted phone |
| **`Video.phoneId`** | Yes (nullable) | **LOW** — Videos can exist independently; null ref is acceptable |

**Brand deletion** (`admin-crud.ts` line 1570-1571): Blocked if any phones reference the brand. ✅ Good guard.

**No Mongoose `pre('deleteOne')` or `pre('remove')` middleware exists for automatic cascading.** All cascading is handled manually in the API handler. If a phone is deleted outside the admin API (e.g., directly in MongoDB shell, import engine, or test scripts), orphan records will be left behind.

### 1.6 Schema Field Type Issues

| # | Finding | Severity |
|---|---------|----------|
| 1 | **`Phone.dataConfidence`** — Schema enum `['verified', 'unverified', 'auto-imported', 'user-submitted']` ✅ matches `IPhone` interface type `'verified' \| 'unverified' \| 'auto-imported' \| 'user-submitted'` ✅ | — |
| 2 | **`Phone.priceMode`** — Schema enum `['manual', 'automatic']` ✅ | — |
| 3 | **`Phone.status`** — Schema enum `['published', 'draft', 'pending', 'archived']` ✅ | — |
| 4 | **`Video.status`** — Schema enum `['live', 'pending', 'draft', 'hidden', 'rejected', 'failed']` ✅ matches `IVideo` interface ✅ | — |
| 5 | **`Settings.updatedAt`** — `{ type: Date, default: Date.now }` without Mongoose `timestamps: true` means **`updatedAt` is NOT auto-updated on `.save()` or `.findOneAndUpdate()`**. The field will only be set at document creation. This is a functional bug if `updatedAt` is displayed or used for cache invalidation. | **MEDIUM** |

---

## Part 2: Image Audit

### 2.1 Next.js Image Domain Configuration (`next.config.ts`)

**Configured remote patterns:**
```ts
{ protocol: 'https', hostname: 'fdn2.gsmarena.com' },
{ protocol: 'https', hostname: 'res.cloudinary.com' },
{ protocol: 'https', hostname: 'images.unsplash.com' },
{ protocol: 'https', hostname: 'upload.wikimedia.org' },
{ protocol: 'https', hostname: 'i.ytimg.com' },
```

| Check | Status |
|-------|--------|
| gsmarena.com (phone images) | ✅ Configured |
| cloudinary.com (uploaded images) | ✅ Configured |
| unsplash.com (placeholder images) | ✅ Configured |
| wikimedia.org (brand logos) | ✅ Configured |
| ytimg.com (video thumbnails) | ✅ Configured |

**CSP `img-src` directive** matches: `fdn2.gsmarena.com`, `res.cloudinary.com`, `images.unsplash.com`, `upload.wikimedia.org`, `i.ytimg.com`, plus `data:` and `blob:`. ✅ Aligned with remote patterns.

**`formats: ['image/avif', 'image/webp']`** ✅ Modern format support enabled.

### 2.2 Image Alt Text Audit

| Component | Location | Alt Text | Assessment |
|-----------|----------|----------|------------|
| **PhoneCard** (card) | `PhoneCard.tsx:277` | `alt={phone.modelName}` | ✅ Descriptive |
| **PhoneCard** (Quick View) | `PhoneCard.tsx:158` | `alt={phone.modelName}` | ✅ Descriptive |
| **Header** (autocomplete) | `Header.tsx:219` | `alt={p.modelName}` | ✅ Descriptive |
| **HeroPhoneShowcase** | `HeroPhoneShowcase.tsx:133` | `alt={phone.modelName}` | ✅ Descriptive |
| **Phone Detail** (main image) | `phones/[slug]/page.tsx:497` | `alt={images[activeImage]?.altText \|\| p.modelName}` | ✅ Good fallback |
| **Phone Detail** (gallery thumbnails) | `phones/[slug]/page.tsx:513` | `alt={img.altText \|\| ''}` | ⚠️ **MEDIUM** — Falls back to empty string instead of `phone.modelName`. Screen readers will skip these images. |
| **Brands Page** | `brands/page.tsx:110,133` | `alt={brand.name}` | ✅ Descriptive |
| **Brand Detail** | `brands/[slug]/page.tsx:118` | `alt={brand.name}` | ✅ Descriptive |
| **News Page** (featured) | `news/page.tsx:97` | `alt={paginated[0].title}` | ✅ Descriptive |
| **News Page** (grid) | `news/page.tsx:119` | `alt={n.title}` | ✅ Descriptive |
| **News Detail** (article) | `news/[slug]/page.tsx:264` | `alt={article.title}` | ✅ Descriptive |
| **News Detail** (related) | `news/[slug]/page.tsx:309` | `alt={item.title}` | ✅ Descriptive |
| **Videos Page** (card) | `videos/page.tsx:77` | `alt={v.title}` | ✅ Descriptive |
| **Videos Page** (linked phone) | `videos/page.tsx:88` | `alt={v.phone.modelName}` | ✅ Descriptive |
| **Videos Page** (modal phone) | `videos/page.tsx:146` | `alt={activeVideo.phone.modelName}` | ✅ Descriptive |
| **Compare Page** (selected) | `compare/page.tsx:293,339,394` | `alt={p.modelName}` | ✅ Descriptive |
| **Review Page** | `reviews/[slug]/page.tsx:354` | `alt={phone.modelName}` | ✅ Descriptive |
| **HomeContent** (brand logos) | `HomeContent.tsx:193` | `alt={brand.name}` | ✅ Descriptive |
| **HomeContent** (sponsor) | `HomeContent.tsx:606` | `alt={data.sponsors[0].name}` | ✅ Descriptive |
| **Admin Phones** | `admin/phones/page.tsx:415,453` | `alt={p.modelName}` | ✅ Descriptive |
| **Admin Videos** | `admin/videos/page.tsx:439,566,301,336` | `alt={v.title}` | ✅ Descriptive |

### 2.3 Image Fallback Handling

| Component | Fallback Strategy | Assessment |
|-----------|-------------------|------------|
| **PhoneCard** | `phone.thumbnail ? <Image ...> : <Smartphone icon>` | ✅ Icon fallback |
| **Header** (autocomplete) | `p.thumbnail ? <Image ...> : <Smartphone icon>` | ✅ Icon fallback |
| **HeroPhoneShowcase** | `phone.thumbnail ? <Image ...> : <div>No Image</div>` | ✅ Text fallback |
| **Phone Detail** (main) | `images.length > 0 ? <Image ...> : <Smartphone icon>` | ✅ Icon fallback |
| **Phone Detail** (gallery) | Conditional render only when `images.length > 0` | ✅ No broken images |
| **Brands Page** | `src ? <Image ...> : <Layers icon>` | ✅ Icon fallback |
| **Brand Detail** | `brand.logo ? <Image ...> : <Layers icon>` | ✅ Icon fallback |
| **Videos Page** | `v.thumbnailUrl ? <Image ...> : <Play icon>` | ✅ Icon fallback |
| **Compare Page** | `p.thumbnail ? <Image ...> : <Smartphone icon/div>` | ✅ Icon fallback |
| **Review Page** | `phone.thumbnail ? <Image ...> : (no fallback rendered — missing else branch for null thumbnail)` | ⚠️ **LOW** — If thumbnail is empty, nothing renders in that area |
| **News Pages** | `imageUrl ? <Image ...> : (not rendered)` | ✅ Conditional render |
| **Admin Videos** | `v.thumbnailUrl && <Image ...>` (conditional) | ✅ Safe |

**No raw `<img>` tags found** — all images use Next.js `<Image>` component. ✅

### 2.4 Hardcoded Image URLs

**Found in two files** — both contain an identical `OFFICIAL_LOGOS` map:

| File | Count | Domain |
|------|-------|--------|
| `src/app/brands/page.tsx:12-27` | 15 URLs | `upload.wikimedia.org` |
| `src/app/HomeContent.tsx:144-159` | 15 URLs | `upload.wikimedia.org` (exact duplicate) |

| # | Finding | Severity |
|---|---------|----------|
| 1 | **Duplicated `OFFICIAL_LOGOS` constant** across two files. If a logo URL changes, both files must be updated. Should be extracted to a shared module. | **MEDIUM** (maintainability) |
| 2 | All URLs point to `upload.wikimedia.org` which **is configured** in `next.config.ts` ✅ | — |
| 3 | Wikipedia URLs can break if files are moved/deleted on Wikimedia. No error boundary or fallback for individual logo failures. | **LOW** |

---

## Part 3: Cross-Reference Check

### 3.1 Model Exports vs Imports

**`models/index.ts` exports:**
- `Brand`, `Phone`, `PhoneSpecs`, `PhoneImage`, `PhoneBenchmark`, `Review`, `PhonePrice`, `PriceHistory`
- `News`, `Sponsor`, `Admin`, `ActivityLog`, `RateLimit`, `UserReview`, `PriceAlert`
- `AdminSession`, `ImportHistory`, `CollectorSource`, `CollectedPhone`, `CollectorJob`, `SyncJob`
- `Video`, `Settings`, `getSettings`, `SystemState`
- `PriceSource`, `PhoneRetailListing`, `PriceTrackerHistory`

**Handler file imports — all verified:**

| Handler File | Imports | Status |
|-------------|---------|--------|
| `admin-crud.ts` | Phone, Brand, News, Admin, AdminSession, ActivityLog, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice, PriceHistory, UserReview, Video, Sponsor | ✅ All exported |
| `public.ts` | Phone, Brand, News, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice, PriceHistory, UserReview, PriceAlert, Video, PriceTrackerHistory | ✅ All exported |
| `helpers.ts` | Admin, AdminSession (direct import + re-export of Admin) | ✅ All exported |
| `admin-auth.ts` | Admin, ActivityLog | ✅ All exported |
| `collector.ts` | CollectorSource, CollectorJob, CollectedPhone, Brand, Phone, ActivityLog | ✅ All exported |
| `first-setup.ts` | Admin, ActivityLog, RateLimit, SystemState | ✅ All exported |
| `import.ts` | ActivityLog (direct); ImportHistory via dynamic import | ✅ All exported |
| `price-tracker.ts` | Phone, Brand, ActivityLog, PriceHistory, SystemState | ✅ All exported |
| `cron-update-prices.ts` | Phone, PriceHistory, SystemState | ✅ All exported |
| `route.ts` | RateLimit, UserReview, Phone, PriceAlert, PriceHistory, Video | ✅ All exported |

### 3.2 Redundant Import

| # | Finding | Severity |
|---|---------|----------|
| 1 | **`admin-crud.ts:3`** imports `Sponsor` at top level from `@/lib/models`, but **line 1595** does a redundant dynamic import: `const { Sponsor } = await import('@/lib/models/Other')`. The top-level import is already available. | **LOW** (no functional issue, dead code path) |

### 3.3 `serializePhoneSpecs()` Field Alignment

**`SPECS_FIELDS` array** (51 string fields) in `helpers.ts:178-187` vs **`PhoneSpecs` schema** (`specNames` array, 51 fields):

| Check | Result |
|-------|--------|
| All schema spec fields present in `SPECS_FIELDS`? | ✅ Yes — exact 1:1 match |
| All `NUMERIC_SPECS_FIELDS` present in schema? | ✅ `ramGB`, `storageGB`, `screenSizeInch`, `mainCameraMP`, `batteryMAh` all present |
| Any extra fields in schema not serialized? | ✅ No — `phoneId`, `_id`, `__v`, `createdAt`, `updatedAt` are intentionally excluded |
| Frontend `PhoneSpecs` type alignment? | ✅ `types.ts` PhoneSpecs interface matches all 51 string + 5 numeric fields |

### 3.4 `phoneToJSON()` Field Alignment

**Fields output by `phoneToJSON()`** vs **Phone schema fields**:

| Field in phoneToJSON | Schema Source | Status |
|---------------------|---------------|--------|
| `id`, `modelName`, `slug`, `brandId`, `brand` (virtual) | ✅ Present | ✅ |
| `thumbnail`, `pricePKR`, `originalPricePKR`, `description` | ✅ Present | ✅ |
| `overallRating`, `cameraScore`, `performanceScore`, `batteryScore`, `displayScore`, `valueScore` | ✅ Present | ✅ |
| `ptaStatus`, `ptaApproved`, `releaseDate` | ✅ Present | ✅ |
| `trending`, `upcoming`, `featured` | ✅ Present | ✅ |
| `pros`, `cons`, `reviewSummary`, `reviewVerdict` | ✅ Present | ✅ |
| `published` (computed: `status === 'published'`) | ✅ Derived from schema | ✅ |
| `specs` (via `serializePhoneSpecs`) | ✅ From PhoneSpecs | ✅ |
| `benchmarks` (passthrough) | ✅ From PhoneBenchmark | ✅ |
| `images` (mapped: id, url, altText, sortOrder) | ✅ From PhoneImage | ✅ |
| `prices` (mapped: id, storeName, price, url, inStock) | ✅ From PhonePrice | ✅ |
| `priceMode`, `manualLock`, `manualLockReason` | ✅ In schema | ✅ |
| `sourceUrl` | ✅ In schema | ✅ |

**Phone type in `types.ts`** is missing: `priceMode`, `manualLock`, `manualLockReason`, `sourceUrl` (see finding 1.3-1).

### 3.5 Admin CRUD Handler Cross-Reference

| CRUD Operation | Models Used | Status |
|----------------|-------------|--------|
| Phone create/update | Phone, Brand, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice | ✅ |
| Phone delete | Phone, PhoneSpecs, PhoneBenchmark, PhoneImage, PhonePrice | ⚠️ Missing cascades (see 1.5) |
| Brand create/update | Brand | ✅ |
| Brand delete | Brand, Phone (count check) | ✅ |
| News CRUD | News | ✅ |
| Video CRUD | Video | ✅ |
| Sponsor CRUD | Sponsor (redundant dynamic import) | ✅ |
| Admin CRUD | Admin, AdminSession (revoke sessions) | ✅ |
| UserReview delete | UserReview | ✅ |

---

## Summary of All Findings by Severity

### HIGH (1)
| # | Finding | Location |
|---|---------|----------|
| H-1 | **Phone delete does not cascade to `PriceHistory`** — orphaned price history records will accumulate | `admin-crud.ts:1552-1558` |

### MEDIUM (5)
| # | Finding | Location |
|---|---------|----------|
| M-1 | **`PhoneImage` missing `(phoneId, sortOrder)` compound index** | `PhoneSub.ts:3-8` |
| M-2 | **`Phone` TypeScript type missing `priceMode`, `manualLock`, `manualLockReason`, `sourceUrl`** fields that `phoneToJSON()` returns | `shared/types.ts:101-137` |
| M-3 | **`Settings.updatedAt` not auto-updated** — missing `timestamps: true` and manual field doesn't update on save | `Settings.ts:40` |
| M-4 | **Phone delete misses cascade to `UserReview`, `Review`, `PriceAlert`, `PriceTrackerHistory`, `PhoneRetailListing`** | `admin-crud.ts:1552-1558` |
| M-5 | **Duplicated `OFFICIAL_LOGOS` constant** in two files (maintenance risk) | `brands/page.tsx`, `HomeContent.tsx` |
| M-6 | **Phone detail gallery thumbnails use empty-string alt text fallback** (`alt={img.altText \|\| ''}`) | `phones/[slug]/page.tsx:513` |

### LOW (7)
| # | Finding | Location |
|---|---------|----------|
| L-1 | `CollectorSource` has no unique constraint on `name` — duplicates possible | `CollectorSource.ts` |
| L-2 | `Sponsor` model missing `active`/`position` indexes | `Other.ts:26-38` |
| L-3 | `Review` model missing `phoneId + published` compound index | `PhoneSub.ts:30-40` |
| L-4 | `IBrand` interface in `Phone.ts` is a subset of `IBrand` in `Brand.ts` (type narrowing) | `Phone.ts:3-10` |
| L-5 | Redundant dynamic import of `Sponsor` in `admin-crud.ts` (already imported at top) | `admin-crud.ts:1595` |
| L-6 | Wikipedia logo URLs could break if files are moved on Wikimedia | `brands/page.tsx:12-27` |
| L-7 | Review page has no fallback rendering for missing phone thumbnail | `reviews/[slug]/page.tsx:352` |

---

## Recommendations

1. **Add missing cascading deletes** for `PriceHistory`, `UserReview`, `Review`, `PriceAlert`, `PriceTrackerHistory`, and `PhoneRetailListing` in the phone delete handler, or implement Mongoose `pre('deleteOne')` middleware.

2. **Fix `Settings` model** by adding `timestamps: true` to the schema options (the manual `updatedAt` field can be removed as Mongoose will auto-manage it).

3. **Update `Phone` TypeScript interface** in `types.ts` to include `priceMode`, `manualLock`, `manualLockReason`, and `sourceUrl`.

4. **Extract `OFFICIAL_LOGOS` to a shared constant** (e.g., `src/lib/brand-logos.ts`) to eliminate duplication.

5. **Fix empty alt text** in phone detail gallery: change `alt={img.altText || ''}` to `alt={img.altText || phone.modelName}`.

6. **Add `(phoneId, sortOrder)` compound index** to `PhoneImage` schema for optimized gallery queries.

7. **Add missing indexes** for `Sponsor` (`active`, `position`) and `Review` (`phoneId + published`).