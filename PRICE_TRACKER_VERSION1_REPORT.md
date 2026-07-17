# Price Tracker V1 — Implementation Report

## Overview

Semi-automatic price tracking system for PhoneDock. Manual-first approach with optional automatic updates from retail sources. Variant-level price isolation (PTA vs Non-PTA, warranty type, RAM/storage). Three-tier auto-update rules with configurable thresholds.

---

## Architecture

### Data Models (3 New + 1 Extended)

| Model | File | Purpose |
|-------|------|---------|
| **PriceSource** | `src/lib/models/PriceTracker.ts` | Retail source config (name, type, domains, priority, health) |
| **PhoneRetailListing** | `src/lib/models/PriceTracker.ts` | Per-phone, per-source listing with variant fields |
| **PriceTrackerHistory** | `src/lib/models/PriceTracker.ts` | Every price change recorded with verification status |
| **Phone (extended)** | `src/lib/models/Phone.ts` | Added 12 price tracking fields |

**Compound Indexes:**
- `PhoneRetailListing`: `(phoneId, sourceId)`, `(phoneId, enabled)`, `(sourceId, enabled)`, `(verificationStatus)`, `(externalProductId)`
- `PriceTrackerHistory`: `(phoneId, capturedAt -1)`, `(phoneId, changeType)`, `(sourceType)`, `(verificationStatus)`, `(capturedAt -1)`
- `PriceSource`: `(name) unique`, `(sourceType)`, `(enabled, status)`, `(priority -1)`

### Phone Model Extensions

```
currentPrice, previousPrice, lowestPrice, highestPrice,
priceChange, percentageChange, lastPriceCheckedAt, lastPriceChangedAt,
priceMode ('manual' | 'automatic'), manualLock, manualLockReason,
preferredPriceSourceId
```

---

## API Endpoints

### Admin Price Tracker (Authenticated, Role: `prices:read` / `prices:edit`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/price-tracker/overview` | Dashboard stats |
| GET | `/api/admin/price-tracker/phones` | All phones with price data |
| GET | `/api/admin/price-tracker/sources` | All price sources |
| GET | `/api/admin/price-tracker/listings` | All retail listings |
| GET | `/api/admin/price-tracker/changes` | Price changes log |
| GET | `/api/admin/price-tracker/pending` | Pending review items |
| GET | `/api/admin/price-tracker/history` | Full price history (per-phone) |
| GET | `/api/admin/price-tracker/settings` | Configurable thresholds |
| POST | `/api/admin/price-tracker/update-price` | Manual price update |
| POST | `/api/admin/price-tracker/sources` | Create price source |
| POST | `/api/admin/price-tracker/listings` | Create retail listing |
| POST | `/api/admin/price-tracker/test-source` | Test URL reachability + price detection |
| POST | `/api/admin/price-tracker/review` | Approve/reject pending change |
| PUT | `/api/admin/price-tracker/sources/:id` | Update source |
| PUT | `/api/admin/price-tracker/listings/:id` | Update listing |
| PUT | `/api/admin/price-tracker/settings` | Update thresholds |
| DELETE | `/api/admin/price-tracker/sources/:id` | Delete source + its listings |
| DELETE | `/api/admin/price-tracker/listings/:id` | Delete listing |
| POST | `/api/admin/price-tracker/toggle-lock/:phoneId` | Lock/unlock phone price |
| POST | `/api/admin/price-tracker/sources/:id/toggle` | Pause/activate source |
| POST | `/api/admin/price-tracker/phones/:phoneId/toggle` | Toggle phone lock from list |

### Cron Endpoint (Protected)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/cron/update-prices` | `x-cron-secret` header or `Authorization: Bearer` |

---

## Admin UI — 7 Tabs

| Tab | Features |
|-----|----------|
| **Overview** | Stats cards (monitored phones, drops/increases today, pending review), recent changes list |
| **Phones** | Paginated, searchable, sortable list with price mode badges, manual lock toggles, inline price editing |
| **Sources** | Add/edit/delete retail sources, trust toggles, pause/activate, allowed-domain config |
| **Price Changes** | Filtered by type (increase/decrease) and source type (manual/retailer/correction) |
| **Pending Review** | Items >15% change requiring admin approval, approve/reject actions |
| **History** | Per-phone price history with change type and verification status |
| **Settings** | **Editable** threshold config, cron setup guide with example crontab |

### Phone Edit Form Extension (`Images & Prices` tab)
- Price Mode selector (Manual / Automatic)
- Manual Lock toggle with reason field
- Optional Price Source URL field (URLs NOT mandatory per spec)

---

## Auto-Update Rules

Configurable via Settings tab (stored in `SystemState`):

| Change % | Action |
|----------|--------|
| `< autoApproveThreshold` (default 2%) | Auto-apply silently, record history as `confirmed` |
| `autoApproveThreshold` to `reviewThreshold` (default 2-15%) | Auto-apply, record history as `confirmed` (still logged) |
| `> reviewThreshold` (default >15%) | Create `pending` history entry, do NOT apply — wait for admin review |

**Manual Lock**: When `manualLock=true`, auto-updates are skipped entirely (price stays frozen).

---

## Cron Job (`/api/cron/update-prices`)

- **Auth**: `CRON_SECRET` env var via `x-cron-secret` header or `Authorization: Bearer`
- **Distributed Lock**: MongoDB `SystemState` document, 30-minute TTL
- **Batching**: Configurable batch size (default 10), processes sequentially per batch
- **SSRF Protection**: Full URL validation before fetch (see Security section)
- **Price Extraction**: Regex-based PKR price patterns (Rs., PKR, ₨, data-price, JSON-LD)
- **Availability Detection**: "out of stock" / "add to cart" patterns
- **Cache Revalidation**: Targeted `revalidatePath()` for affected phone slugs only

---

## Security Protections

### SSRF Guard (`src/lib/ssrf-guard.ts`)
- **Protocol**: Only HTTP(S) allowed
- **Private IP blocking**: Loopback (127.x), RFC 1918 (10.x, 172.16-31.x, 192.168.x), link-local (169.254.x), CGNAT (100.64-127.x), multicast (224.x), reserved (0.0.0.0)
- **IPv6**: Loopback (::1), link-local (fe80::), unique-local (fc00::), multicast (ff00::), IPv4-mapped (::ffff:x.x.x)
- **DNS resolution check**: Hostnames resolved to IPs, each IP checked against private ranges
- **Domain whitelist**: Per-source `allowedDomains` array with subdomain matching
- **Cron integration**: Every listing URL validated via `validateUrlForFetch()` before fetch

### Additional Security
- **URL validation in listing APIs**: HTTPS required, localhost/private IP regex checks
- **Role permissions**: `prices:read` and `prices:edit` enforced on all admin endpoints
- **Activity logging**: All create/update/delete/approve/reject actions logged
- **Input validation**: Numeric range checks, enum validation, string length limits
- **No arbitrary scraping**: Only fetches URLs explicitly added by admins as listings

---

## Public-Facing Features

### Phone Detail Page (`/phones/[slug]`)
- Current price with previous price strikethrough
- Price change indicator (dropped ▼ / increased ▲) with PKR amount and percentage
- Lowest price badge when applicable
- Last updated date
- Price mode badge ("Manually Verified" / "Auto Tracked")
- Manual lock indicator
- **Price History Chart** (inline, rendered when 2+ data points available)

### Price History API
- `GET /api/phones/:slug/price-history` — Returns price history array for chart rendering

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `src/lib/ssrf-guard.ts` | SSRF protection utility (143 lines) |
| `scripts/__tests__/ssrf-guard.test.ts` | 43 unit tests for SSRF guard |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/api/[[...path]]/handlers/cron-update-prices.ts` | SSRF guard integration, configurable thresholds from settings, dynamic batch size |
| `src/app/api/[[...path]]/handlers/price-tracker.ts` | Added settings GET/PUT endpoints, imported SystemState |
| `src/app/admin/price-tracker/page.tsx` | Editable Settings tab with form, fetch/save logic, fixed CRON_SECRET docs |

### Pre-existing (Already Implemented)
| File | Content |
|------|---------|
| `src/lib/models/PriceTracker.ts` | 3 models: PriceSource, PhoneRetailListing, PriceTrackerHistory |
| `src/lib/models/Phone.ts` | 12 price tracking fields |
| `src/lib/revalidate.ts` | Targeted cache revalidation |
| `src/components/admin/phone-form/ImagesPricesSection.tsx` | Price tracking fields in phone form |
| `src/components/admin/phone-form/types.ts` | Price tracking form data types |
| `src/app/phones/[slug]/page.tsx` | Price display, change indicators, history chart |

---

## Verification

| Check | Status |
|-------|--------|
| TypeScript typecheck (`tsc --noEmit`) | ✅ Pass |
| ESLint | ✅ Pass (only pre-existing `any` warnings) |
| Next.js build (`next build`) | ✅ Pass |
| SSRF guard tests (43 tests) | ✅ All pass |

---

## Design Decisions

1. **Manual-first**: `priceMode` defaults to `manual`. Automatic mode is opt-in per phone.
2. **URLs not mandatory**: Source URLs in phone form are optional. No URL = no auto-tracking for that phone.
3. **No existing UI changes**: All changes are additive. No existing components were redesigned.
4. **Settings stored in SystemState**: Reuses existing key-value store. No new collection needed.
5. **Thresholds configurable**: Admins can change auto-approve/review thresholds without code changes.
6. **SSRF guard is standalone**: `ssrf-guard.ts` is a pure utility with no dependencies, easily testable.