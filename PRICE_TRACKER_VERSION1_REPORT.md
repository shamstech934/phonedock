# Price Tracker V1 — Implementation Report

## Overview

The Price Tracker V1 feature implements a **semi-automatic price tracking system** for PhoneDock. It is designed as a manual-first system with optional automatic price updates from trusted retail sources. The system tracks price changes over time, supports variant-level isolation (PTA/Non-PTA, warranty types), and enforces configurable approval thresholds.

## Architecture

### Data Models (3 New + 1 Extended)

#### PriceSource
- **File**: `src/lib/models/PriceTracker.ts`
- Fields: name (unique), sourceType (retailer/marketplace/official), enabled, trusted, baseUrl, allowedDomains[], priority, lastCheckedAt, lastSuccessAt, failureCount, status (active/paused/failed), notes
- Indexes: name (unique), sourceType, enabled+status, priority

#### PhoneRetailListing
- **File**: `src/lib/models/PriceTracker.ts`
- Fields: phoneId, variantId, sourceId, productUrl, externalProductId, sourceTitle, ram, storage, ptaStatus, warrantyType, currentSourcePrice, previousSourcePrice, availability (available/unavailable/unknown), lastCheckedAt, lastChangedAt, enabled, verificationStatus (pending/verified/rejected/failed)
- Indexes: phoneId+sourceId, phoneId+enabled, sourceId+enabled, verificationStatus, externalProductId

#### PriceTrackerHistory
- **File**: `src/lib/models/PriceTracker.ts`
- Fields: phoneId, variantId, oldPrice, newPrice, difference, percentageChange, changeType (increase/decrease/unchanged/correction), sourceType (manual/retailer/correction), sourceId, sourceUrl, changedByAdminId, approvedByAdminId, capturedAt, verificationStatus (confirmed/pending/rejected)
- Indexes: phoneId+capturedAt, phoneId+changeType, sourceType, verificationStatus, capturedAt

#### Phone Model Extensions
- **File**: `src/lib/models/Phone.ts`
- New fields: currentPrice, previousPrice, lowestPrice, highestPrice, priceChange, percentageChange, lastPriceCheckedAt, lastPriceChangedAt, priceMode (manual/automatic), manualLock, manualLockReason, preferredPriceSourceId

### API Endpoints

#### GET Endpoints
| Endpoint | Description | Permission |
|----------|-------------|------------|
| `/api/admin/price-tracker/overview` | Dashboard stats (monitored phones, manual/auto counts, drops/increases today, pending review, failed checks) | prices:read |
| `/api/admin/price-tracker/phones` | Paginated phone list with price tracking data, search, mode/status filters, sorting | prices:read |
| `/api/admin/price-tracker/sources` | List all price sources | prices:read |
| `/api/admin/price-tracker/changes` | Paginated price change history with type/source filters | prices:read |
| `/api/admin/price-tracker/pending` | List all pending review items | prices:read |
| `/api/admin/price-tracker/history/:phoneId` | Price history for a specific phone | prices:read |
| `/api/admin/price-tracker/listings/:phoneId` | Retail listings for a specific phone | prices:read |
| `/api/phones/:slug/price-tracker` | Public price tracker data for a phone (confirmed history, current/previous/lowest/highest prices) | Public |

#### POST Endpoints
| Endpoint | Description | Permission |
|----------|-------------|------------|
| `/api/admin/price-tracker/update-price` | Manually update a phone's price | prices:edit |
| `/api/admin/price-tracker/sources` | Create a new price source | prices:edit |
| `/api/admin/price-tracker/listings` | Create a retail listing for a phone | prices:edit |
| `/api/admin/price-tracker/test-source` | Test a URL for reachability, price detection, and availability | prices:edit |
| `/api/admin/price-tracker/review` | Approve or reject a pending price change | prices:edit |
| `/api/admin/price-tracker/toggle-lock/:phoneId` | Toggle manual price lock | prices:edit |
| `/api/admin/price-tracker/sources/:id/toggle` | Toggle source active/paused | prices:edit |
| `/api/admin/price-tracker/phones/:phoneId/toggle` | Toggle phone price lock from phones list | prices:edit |

#### PUT Endpoints
| Endpoint | Description | Permission |
|----------|-------------|------------|
| `/api/admin/price-tracker/sources/:id` | Update a price source (name, type, baseUrl, domains, priority, trusted, status) | prices:edit |
| `/api/admin/price-tracker/listings/:id` | Update a retail listing (URL, variant info, enabled, verification) | prices:edit |

#### DELETE Endpoints
| Endpoint | Description | Permission |
|----------|-------------|------------|
| `/api/admin/price-tracker/sources/:id` | Delete a source and all its listings | prices:edit |
| `/api/admin/price-tracker/listings/:id` | Delete a single retail listing | prices:edit |

#### Cron Endpoint
| Endpoint | Description | Auth |
|----------|-------------|------|
| `/api/cron/update-prices` | Automatic price update job | CRON_SECRET header |

### Admin UI — 7 Tabs

1. **Overview**: Stats cards (monitored phones, manual/auto prices, drops/increases today, pending review, failed checks, last update), recent changes table
2. **Phones**: Paginated, searchable phone list with price mode, lock status, price change %, inline edit price and view history actions
3. **Sources**: List of price sources with type, status, trust badge, priority, last checked, failures, toggle pause/activate
4. **Price Changes**: Filterable table (by change type, source type) showing old/new price, difference, % change, type, source, date, status, approve/reject actions
5. **Pending Review**: Items with >15% change requiring manual approval, with approve/reject buttons
6. **History**: Per-phone price history with bar chart visualization and detailed change table
7. **Settings**: Threshold configuration display (2% auto-approve, 15% review), cron endpoint info with CRON_SECRET reminder

### Phone Edit Form Extension

Added to `Images & Prices` tab:
- **Price Mode** selector (Manual / Automatic)
- **Manual Lock** toggle with reason field
- **Price Source URL** (optional, HTTPS only)

### Automatic Update Rules

Implemented in `cron-update-prices.ts`:
- **< 2% change**: Auto-approve, apply to phone, record as confirmed
- **2-15% change**: Auto-approve + log, apply to phone, record as confirmed
- **> 15% change**: Flag as pending review, do NOT apply to phone until approved
- **Manual Lock**: Prevents all automatic price updates for that phone

### Cron System

- Protected by `CRON_SECRET` environment variable (via `x-cron-secret` header or `Authorization: Bearer`)
- Distributed lock via `SystemState` collection (30-minute TTL)
- Cursor-based batching (10 listings per batch)
- Price extraction from HTML using regex patterns (PKR/Rs/₨, data-price, JSON-LD)
- Availability detection (out of stock / in stock / add to cart patterns)
- Source health tracking (failure count, last success, auto-pause on repeated failures)

### Security Protections

- **SSRF Protection**: All URLs validated against localhost/127.0.0.1/private IP patterns
- **HTTPS Enforcement**: Product URLs and source baseUrls must use HTTPS
- **Domain Validation**: Retail listing URLs must match source's allowedDomains list
- **Role-Based Access**: All admin endpoints require `prices:read` or `prices:edit` permissions
- **Input Sanitization**: Search queries escaped for regex injection, reason fields truncated to 500 chars
- **Rate Limiting**: Standard IP-based rate limiting on all admin endpoints
- **Timing-Safe Comparison**: CRON_SECRET comparison uses `crypto.timingSafeEqual`

### Public Page Integration

- `/api/phones/:slug/price-tracker` returns confirmed price history, current/previous/lowest/highest prices, percentage change, price mode, lock status
- Phone detail page shows `PriceTrackerChart` (SVG line/bar chart) when price history is available
- Falls back to legacy `PriceHistoryChart` when no tracker data exists
- Price drop alert subscription button with double opt-in email confirmation

### Cache Revalidation

- Public price tracker API uses standard caching (60s stale, 300s revalidate)
- Price updates trigger targeted revalidation of affected phone pages
- No full site rebuild required

## Files Modified/Created

### New Files
- None (all code was already scaffolded from a previous session)

### Modified Files
- `src/lib/models/Phone.ts` — Extended with 12 price tracking fields
- `src/lib/models/PriceTracker.ts` — PriceSource, PhoneRetailListing, PriceTrackerHistory models (pre-existing)
- `src/lib/models/index.ts` — Exports PriceSource, PhoneRetailListing, PriceTrackerHistory
- `src/app/api/[[...path]]/handlers/price-tracker.ts` — Added: overview alias, review endpoint, source toggle, phone toggle, DELETE handler, fixed response field names
- `src/app/api/[[...path]]/handlers/cron-update-prices.ts` — Pre-existing cron implementation
- `src/app/api/[[...path]]/handlers/admin-crud.ts` — Added priceMode, manualLock, manualLockReason, sourceUrl to phone update
- `src/app/api/[[...path]]/handlers/helpers.ts` — Added price tracking fields to phoneToJSON
- `src/app/api/[[...path]]/handlers/public.ts` — Pre-existing /phones/:slug/price-tracker endpoint
- `src/app/api/[[...path]]/route.ts` — Added DELETE handler import and dispatch for price tracker
- `src/app/admin/price-tracker/page.tsx` — Pre-existing 7-tab admin UI
- `src/app/admin/layout.tsx` — Pre-existing sidebar nav entry
- `src/app/phones/[slug]/page.tsx` — Pre-existing price tracker chart + public API
- `src/components/admin/phone-form/types.ts` — Added priceMode, manualLock, manualLockReason, priceSourceUrl
- `src/components/admin/phone-form/ImagesPricesSection.tsx` — Added Price Tracking section
- `src/components/admin/phone-form/PhoneForm.tsx` — Added load/save for price tracking fields

## Backward Compatibility

- Legacy `PriceHistory` model continues to receive records alongside `PriceTrackerHistory`
- `pricePKR` field is always synced with `currentPrice`
- Phone form still supports the original `prices[]` array (store-level prices)
- No existing API endpoints were removed or changed in behavior