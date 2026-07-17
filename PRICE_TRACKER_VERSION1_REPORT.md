# Price Tracker V1 — Implementation Report

## Overview

Price Tracker V1 implements a **semi-automatic price tracking system** (manual-first, optional auto) for PhoneDock. The system tracks mobile phone prices across multiple retail sources, supports variant-level price isolation (PTA vs Non-PTA, warranty type, RAM/storage), and provides an admin dashboard with 7 functional tabs for complete price lifecycle management.

---

## Architecture

### Data Layer (3 New Mongoose Models)

| Model | File | Purpose |
|-------|------|---------|
| **PriceSource** | `src/lib/models/PriceTracker.ts` | Retail source configuration (name, type, allowed domains, trust level, health tracking) |
| **PhoneRetailListing** | `src/lib/models/PriceTracker.ts` | Per-phone per-source listings with variant isolation (RAM, storage, PTA, warranty) |
| **PriceTrackerHistory** | `src/lib/models/PriceTracker.ts` | Full audit trail of every price change (old, new, %, type, source, verification status) |

**Compound Indexes:**
- `PhoneRetailListing`: `(phoneId, sourceId)`, `(phoneId, enabled)`, `(sourceId, enabled)`, `(verificationStatus)`, `(externalProductId)`
- `PriceTrackerHistory`: `(phoneId, capturedAt -1)`, `(phoneId, changeType)`, `(sourceType)`, `(verificationStatus)`, `(capturedAt -1)`
- `PriceSource`: `(name)` unique, `(sourceType)`, `(enabled, status)`, `(priority -1)`

### Phone Model Extensions

The existing `Phone` model was extended with these fields:

| Field | Type | Purpose |
|-------|------|---------|
| `currentPrice` | Number | Current active price |
| `previousPrice` | Number | Price before last change |
| `lowestPrice` | Number | All-time lowest recorded |
| `highestPrice` | Number | All-time highest recorded |
| `priceChange` | Number | Absolute difference (current - previous) |
| `percentageChange` | Number | Percentage difference |
| `lastPriceCheckedAt` | Date | Last time price was checked |
| `lastPriceChangedAt` | Date | Last time price actually changed |
| `priceMode` | `'manual' \| 'automatic'` | How the price is managed |
| `manualLock` | Boolean | Prevents auto-overwrites when true |
| `manualLockReason` | String | Why the price is locked |
| `preferredPriceSourceId` | ObjectId (ref PriceSource) | Preferred source for this phone |

### Legacy Compatibility

The `pricePKR` field is kept in sync with `currentPrice` on every update. The legacy `PriceHistory` model (`PhoneSub.ts`) receives a record alongside every `PriceTrackerHistory` entry to maintain backward compatibility with the existing price history graph on public phone pages.

---

## Admin Price Tracker Module

**Route:** `/admin/price-tracker`
**Component:** `src/app/admin/price-tracker/page.tsx` (~1650 lines)

### 7 Tabs

| # | Tab | Features |
|---|-----|----------|
| 1 | **Overview** | Stats cards (monitored phones, manual/auto counts, drops/increases today, pending review, failed checks, last update time, total/enabled sources) |
| 2 | **Phones** | Paginated list of phones with prices, search, filter by mode/status/sort, manual lock toggle, inline price update |
| 3 | **Sources** | CRUD for price sources, trust toggle, enable/pause, domain whitelist, health indicators (failure count, last checked/success) |
| 4 | **Price Changes** | Paginated log of all price changes with phone info, % badges, source details, change type filtering |
| 5 | **Pending Review** | Queue of >15% changes awaiting admin approval/rejection with one-click actions |
| 6 | **History** | Per-phone price history timeline with source tracking and verification status |
| 7 | **Settings** | Display of threshold configuration, cron endpoint documentation, CRON_SECRET setup guide |

---

## API Endpoints

### Price Tracker Routes (`price-tracker.ts`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/admin/price-tracker/stats` | `prices:read` | Overview statistics |
| GET | `/api/admin/price-tracker/phones` | `prices:read` | Paginated phone list with price data |
| GET | `/api/admin/price-tracker/sources` | `prices:read` | All price sources |
| GET | `/api/admin/price-tracker/changes` | `prices:read` | Price change log with filters |
| GET | `/api/admin/price-tracker/pending` | `prices:read` | Pending review queue |
| GET | `/api/admin/price-tracker/history/:phoneId` | `prices:read` | Per-phone price history |
| GET | `/api/admin/price-tracker/listings/:phoneId` | `prices:read` | Per-phone retail listings |
| POST | `/api/admin/price-tracker/update-price` | `prices:edit` | Manual price update |
| POST | `/api/admin/price-tracker/sources` | `prices:edit` | Create price source |
| POST | `/api/admin/price-tracker/listings` | `prices:edit` | Create retail listing |
| POST | `/api/admin/price-tracker/test-source` | `prices:edit` | Test a source URL |
| POST | `/api/admin/price-tracker/review` | `prices:edit` | Approve/reject pending change |
| POST | `/api/admin/price-tracker/toggle-lock/:phoneId` | `prices:edit` | Toggle manual lock |
| POST | `/api/admin/price-tracker/phones/:phoneId/toggle` | `prices:edit` | Toggle lock from phones list |
| PUT | `/api/admin/price-tracker/sources/:id` | `prices:edit` | Update source config |
| PUT | `/api/admin/price-tracker/listings/:id` | `prices:edit` | Update listing details |
| DELETE | `/api/admin/price-tracker/sources/:id` | `prices:edit` | Delete source + its listings |
| DELETE | `/api/admin/price-tracker/listings/:id` | `prices:edit` | Delete a listing |

### Cron Endpoint (`cron-update-prices.ts`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cron/update-prices` | `CRON_SECRET` (x-cron-secret header or Bearer token) | Batch price update job |

### Public Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/phones/:slug/price-history` | Public | Legacy price history for graph |
| GET | `/api/phones/:slug/price-tracker` | Public | PriceTrackerHistory (confirmed only) for graph |

---

## Automatic Update Rules

| Change % | Action | Logged? | Review Required? |
|-----------|--------|---------|-----------------|
| < 2% | Auto-approve silently | Yes (confirmed) | No |
| 2-15% | Auto-approve + log | Yes (confirmed) | No |
| > 15% | Pending review | Yes (pending) | Yes — admin must approve |

**Manual Lock Override:** If `manualLock === true` on a phone, auto-approve changes are NOT applied to the phone document (only logged in history). The admin must remove the lock or manually update.

---

## Cron Job Design

### `/api/cron/update-prices`

**Authentication:** Requests must include `CRON_SECRET` via:
- `x-cron-secret` header (primary)
- `Authorization: Bearer <secret>` (fallback)

**Distributed Lock:** Uses `SystemState` collection with a 30-minute TTL. Prevents concurrent execution across multiple server instances.

**Processing Flow:**
1. Validate CRON_SECRET
2. Acquire distributed lock via SystemState
3. Fetch all enabled + trusted + active sources
4. Fetch all eligible listings (enabled, verified, from trusted sources)
5. Process in batches of 10 (sequential within batch to avoid overwhelming targets)
6. For each listing: fetch product URL, extract PKR price, check availability
7. Apply update rules (<2%, 2-15%, >15%)
8. Revalidate cache for updated phones
9. Release lock in `finally` block

**Price Extraction:** Regex-based patterns for PKR prices:
- `PKR/Rs./₨` followed by comma-separated numbers
- `price` HTML attribute patterns
- `data-price` attribute
- JSON-LD `"price"` field

**Suggested Cron Schedule:**
```
0 6 * * *  # Daily at 6 AM PKT
```

---

## Security Protections

### SSRF Protection
- All URLs validated for HTTPS (listings require HTTPS; test-source allows HTTP)
- `localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]` blocked
- Private IP ranges blocked (10.x, 172.16-31.x, 192.168.x)
- Source domain whitelist: if a source has `allowedDomains`, product URLs must match

### Role-Based Permissions
- `prices:read` and `prices:edit` added to the permission system
- **superadmin**: full access
- **admin**: read + edit
- **editor**: read only
- **reviewer**: read only
- **moderator**: no price access
- **viewer**: no price access

### Input Validation
- All numeric fields validated as positive numbers
- URLs validated for protocol and format
- Source names checked for uniqueness
- Listing domain validated against source's allowedDomains
- 15-second timeout on all external fetches (10s for test-source)
- User-Agent set to identifiable bot string

### Injection Prevention
- Mongoose ODM used throughout (no raw queries)
- Search strings sanitized with regex escaping
- Price values parsed through `parseFloat` + `replace(/,/g, '')`
- No string interpolation in queries

---

## Cache Revalidation

Created `src/lib/revalidate.ts` with a `revalidatePricePages(slug?)` function that performs targeted `revalidatePath` calls for:

**Global paths:** `/`, `/phones`, `/best-value-phone`, `/best-budget-phone`, `/best-gaming-phone`, `/best-camera-phone`, `/best-battery-phone`, `/price-ranges`, `/upcoming`

**Phone-specific:** `/phones/:slug`

**Integration points:**
1. **Cron handler** — after batch processing, revalidates each uniquely updated phone slug
2. **Manual price update** (`POST /api/admin/price-tracker/update-price`) — immediately after update
3. **Pending review approval** (`POST /api/admin/price-tracker/review` with `action: approve`) — after applying to phone
4. **Direct approval** (`POST /api/admin/price-tracker/approve/:historyId`) — after applying to phone
5. **Phone edit form** (`PUT /api/admin/phones/:id`) — when `pricePKR` is changed

---

## Phone Edit Form Integration

The phone form (`src/components/admin/phone-form/`) includes a **Price Tracking** section in the "Images & Prices" tab with:

- **Price Mode** selector (Manual / Automatic)
- **Manual Lock** toggle with reason field
- **Price Source URL** (optional, HTTPS, not mandatory)
- Store-level price entries (Daraz, PriceOye, Whatmobile, Telemart, iShopping, Yayvo)

---

## Public Price History Graph

The phone detail page (`/phones/[slug]`) includes:
- **Legacy `PriceHistoryChart`** — inline SVG chart for `PriceHistory` records (base prices)
- **`PriceTrackerChart`** — inline SVG chart for `PriceTrackerHistory` records (confirmed only)
- Both charts use pure SVG with manual coordinate math (no external charting library)
- Data fetched from `/api/phones/:slug/price-history` and `/api/phones/:slug/price-tracker`

---

## Files Created/Modified

### Created
| File | Purpose |
|------|---------|
| `src/lib/revalidate.ts` | Targeted cache revalidation utility |
| `PRICE_TRACKER_VERSION1_REPORT.md` | This report |

### Modified
| File | Change |
|------|--------|
| `src/lib/permissions.ts` | Added `prices:read`, `prices:edit` permissions + role assignments |
| `src/app/api/[[...path]]/handlers/price-tracker.ts` | Added `revalidatePricePages` import + calls at manual update, review approval, direct approval |
| `src/app/api/[[...path]]/handlers/cron-update-prices.ts` | Added revalidation import, slug tracking, batch revalidation after processing |
| `src/app/api/[[...path]]/handlers/admin-crud.ts` | Added revalidation import + call when `pricePKR` changes in phone edit |

### Pre-existing (unchanged, already complete)
| File | Description |
|------|-------------|
| `src/lib/models/PriceTracker.ts` | PriceSource, PhoneRetailListing, PriceTrackerHistory models |
| `src/lib/models/Phone.ts` | Phone model with price tracking fields |
| `src/app/admin/price-tracker/page.tsx` | Full 7-tab admin UI |
| `src/components/admin/phone-form/ImagesPricesSection.tsx` | Price tracking form fields |
| `src/app/api/[[...path]]/route.ts` | Router wiring for all endpoints |
| `src/app/phones/[slug]/page.tsx` | Public price history charts |

---

## Constraints Honored

| Constraint | Status |
|------------|--------|
| Must NOT redesign existing UI | Honored — all existing admin/phone pages untouched |
| Must NOT remove manual editing | Honored — manual price updates remain first-class |
| URLs must NOT be mandatory | Honored — `priceSourceUrl` is optional, productUrl is optional for listings |
| Must NOT scrape arbitrarily | Honored — only processes listings from explicitly added trusted sources |

---

## Build Verification

- TypeScript: `tsc --noEmit` — passed (0 errors)
- Next.js Build: `next build` — compiled successfully, all 43 static pages generated
- No linting errors

---

## Future Enhancements (V2 Candidates)

- Editable threshold configuration in Settings tab (currently display-only)
- Cursor-based pagination for large listing sets
- Headless browser (Playwright) for more reliable price extraction
- Price drop email notifications via existing PriceAlert system
- Variant-level price isolation UI (PTA/Non-PTA, warranty type, RAM/storage combos)
- Automated source health monitoring and self-pausing
- Bulk price import from CSV/JSON
- Price comparison widget on public phone pages