# Price Tracker V1 — Implementation Report

## Overview
Semi-automatic price tracking system for PhoneDock. Manual price updates always work; automatic monitoring is optional and only activates for explicitly configured retailer listings.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/models/PriceTracker.ts` | 3 new Mongoose models: PriceSource, PhoneRetailListing, PriceTrackerHistory |
| `src/app/api/[[...path]]/handlers/price-tracker.ts` | Admin API handlers (15 endpoints) |
| `src/app/api/[[...path]]/handlers/cron-update-prices.ts` | Cron job handler for automatic price checking |
| `src/app/admin/price-tracker/page.tsx` | Admin UI with 7 tabs (Overview, Phones, Sources, Changes, Pending, History, Settings) |
| `scripts/migrate-price-tracker.ts` | Migration script to add fields + seed data |

## Files Modified

| File | Change |
|------|--------|
| `src/lib/models/Phone.ts` | Added 12 price tracking fields to schema + interface |
| `src/lib/models/index.ts` | Added exports for 3 new models |
| `src/app/admin/layout.tsx` | Added "Price Tracker" to admin sidebar navigation |
| `src/app/api/[[...path]]/route.ts` | Wired price-tracker + cron handlers into dispatch chain |
| `src/app/api/[[...path]]/handlers/public.ts` | Added `/api/phones/:slug/price-tracker` public endpoint |
| `src/app/phones/[slug]/page.tsx` | Enhanced price display + SVG price history graph |

## Database Changes

### New Collections
1. **pricesources** — Retail price sources (Daraz, PriceOye, WhatMobile, etc.)
2. **phoneretaillistings** — Links phones to retailer product pages
3. **pricetrackerhistories** — Detailed price change audit trail

### Extended Phone Collection
New fields on every Phone document:
- `currentPrice` (Number, default: 0)
- `previousPrice` (Number, default: 0)
- `lowestPrice` (Number, default: 0)
- `highestPrice` (Number, default: 0)
- `priceChange` (Number, default: 0)
- `percentageChange` (Number, default: 0)
- `lastPriceCheckedAt` (Date)
- `lastPriceChangedAt` (Date)
- `priceMode` (enum: 'manual' | 'automatic', default: 'manual')
- `manualLock` (Boolean, default: false)
- `manualLockReason` (String)
- `preferredPriceSourceId` (ObjectId ref PriceSource)

### Indexes
- PriceSource: name (unique), enabled, status
- PhoneRetailListing: phoneId, sourceId, (phoneId+sourceId), verificationStatus
- PriceTrackerHistory: phoneId, capturedAt, verificationStatus, sourceType, (phoneId+capturedAt)

## Migration

Run: `npx tsx scripts/migrate-price-tracker.ts`

The migration is idempotent and:
1. Adds all 12 new fields to existing Phone documents
2. Backfills `currentPrice` from `pricePKR`
3. Backfills `lowestPrice`/`highestPrice` from existing PriceHistory
4. Seeds 7 default PriceSource records (Daraz, PriceOye, WhatMobile, MyShop, Telemart, iShopping, Yadah)

## Manual Workflow

1. Add or edit a phone → enter current Pakistani price → Save
2. Price history record is created automatically
3. Optionally open Admin → Price Tracker
4. The system works perfectly even if steps 3+ are never used

## Optional Automatic Workflow

1. Open Price Tracker → Sources tab → add a retailer
2. Open Phones tab → click "Add Source" on a phone
3. Enter the retailer's product URL
4. Click "Test Source" to verify the match
5. Confirm variant, PTA status, warranty match
6. Enable automatic tracking
7. Set up cron: `curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/update-prices`
8. Daily cron checks only configured, verified listings

## API Endpoints

### Admin (require auth + `prices:read` or `prices:edit`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/price-tracker/stats` | Overview statistics |
| GET | `/api/admin/price-tracker/phones` | Paginated phone price list |
| GET | `/api/admin/price-tracker/sources` | All price sources |
| GET | `/api/admin/price-tracker/changes` | Recent price changes |
| GET | `/api/admin/price-tracker/pending` | Pending review items |
| GET | `/api/admin/price-tracker/history/:phoneId` | Phone price history |
| GET | `/api/admin/price-tracker/listings/:phoneId` | Retail listings for phone |
| POST | `/api/admin/price-tracker/update-price` | Manual price update |
| POST | `/api/admin/price-tracker/sources` | Create price source |
| POST | `/api/admin/price-tracker/listings` | Add retail listing |
| POST | `/api/admin/price-tracker/test-source` | Test source URL |
| POST | `/api/admin/price-tracker/approve/:id` | Approve pending change |
| POST | `/api/admin/price-tracker/reject/:id` | Reject pending change |
| POST | `/api/admin/price-tracker/toggle-lock/:phoneId` | Toggle manual lock |
| PUT | `/api/admin/price-tracker/sources/:id` | Update source |
| PUT | `/api/admin/price-tracker/listings/:id` | Update listing |

### Public
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/phones/:slug/price-tracker` | Public price data (confirmed only) |

### Cron
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cron/update-prices` | Automatic price checking job |

## Validation Rules

- All prices must be positive numbers (> 0)
- Source URLs must be HTTPS, no localhost, no private IPs
- Product URL domain must be in source's allowedDomains list
- SSRF protection on all URL fetching
- Admin authentication required for all mutating operations
- Role-based permissions: `prices:read` for viewing, `prices:edit` for modifying
- Cron requires `CRON_SECRET` header match

## Automatic Update Rules

| Change | Action |
|--------|--------|
| Below 2% | Auto-approve |
| 2% – 15% | Auto-approve + log |
| Above 15% | Send to Pending Review |
| Unavailable/out of stock | Keep old price |
| Failed extraction | Keep old price |
| Variant mismatch | Reject |
| Manual lock active | Save in history but don't change displayed price |
| Suspicious result | Reject or send to review |

## Security Protections

- **SSRF**: URL validation blocks localhost, private IPs, non-HTTPS
- **Mongo Injection**: Mongoose ODM used throughout (no raw queries)
- **XSS**: No user HTML rendered without sanitization
- **Unauthorized access**: `getAdminFromRequest` + `requirePermission` on every admin endpoint
- **Cron abuse**: CRON_SECRET header required; distributed lock prevents concurrent runs
- **Source credential exposure**: No API keys stored in listing docs
- **Audit trail**: Every price change logged in PriceTrackerHistory + ActivityLog
- **CSV injection**: Not applicable (no CSV export of price data)

## Cron Setup

Add to Vercel Cron or any scheduler:
```
GET https://your-domain.com/api/cron/update-prices
Header: x-cron-secret: YOUR_SECRET_VALUE
```

Environment variable required:
```
CRON_SECRET=your-random-secret-string
```

Recommended frequency: Once daily (V1).

The cron:
- Only processes listings with enabled + verified + trusted source
- Uses cursor-based batch processing (batch size: 10)
- Implements distributed lock (30-minute TTL) to prevent concurrent runs
- Respects source rate limiting with delays between checks
- Updates source health tracking on each run

## Performance Impact

- **Minimal on read**: New fields on Phone are simple numbers, no additional queries needed
- **Public phone page**: One additional API call for price tracker data (cached 60s)
- **SVG graph**: Pure CSS/SVG, no external JS libraries
- **Admin page**: Server-side pagination, no heavy client-side processing
- **Cache revalidation**: Only the specific phone page is revalidated on price change (not the entire site)
- **Cron**: Processes only configured listings, not all phones

## Test Results

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ 2 pre-existing errors only (not from this change) |
| `npx tsc --noEmit` | ✅ Clean (0 errors) |
| `npm run build` | ✅ Clean build, all pages compiled |

## Required Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `CRON_SECRET` | Authenticates cron endpoint | Yes (for auto-tracking) |
| `MONGODB_URI` | Database connection | Already required |

## Vercel Deployment Steps

1. Commit all changes
2. Push to main branch
3. Set `CRON_SECRET` environment variable in Vercel dashboard
4. Run migration: `npx tsx scripts/migrate-price-tracker.ts`
5. Set up Vercel Cron Job (optional, for auto-tracking):
   - In `vercel.json`, add:
   ```json
   {
     "crons": [{
       "path": "/api/cron/update-prices",
       "schedule": "0 6 * * *"
     }]
   }
   ```
   - Set header `x-cron-secret` via cron configuration

## Remaining Limitations

1. **No actual price extraction from retailer pages** — The "Test Source" endpoint fetches pages but uses basic regex extraction. A proper extractor per retailer would need custom connectors (not in V1 scope).
2. **No phone variant support** — `variantId` field exists in models but variant management is not implemented. All prices are phone-level.
3. **No price alert email integration** — The `PriceAlert` model exists but V1 does not trigger email notifications on price changes.
4. **Settings are display-only** — Threshold configuration shown in Settings tab is read-only. To change thresholds, edit `cron-update-prices.ts` constants.
5. **Graph is basic SVG** — Functional but minimal. A proper charting library could be added later.
6. **Phone edit form** — Price tracker fields are accessible via the Price Tracker admin module rather than being embedded in the existing phone form. This keeps the phone form clean.