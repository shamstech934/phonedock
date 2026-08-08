import { NextRequest, NextResponse } from 'next/server';
import type { Types } from 'mongoose';
import { Phone, Brand, ActivityLog, PriceHistory, PhonePrice, SystemState } from '@/lib/models';
import { PriceSource, PhoneRetailListing, PriceTrackerHistory, PriceMatchCandidate } from '@/lib/models/PriceTracker';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { revalidatePricePages } from '@/lib/revalidate';
import { parseBoundedInt } from '@/lib/http';
import { PRICE_SOURCE_TYPES as PRICE_SOURCE_TYPE_VALUES } from '@/lib/price-source-types';
import { extractRetailPrice } from '@/lib/price-extraction';
import { validateRetailListingPage } from '@/lib/retailer-listing-validation';
import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { PAKISTAN_OFFICIAL_PRICE_SOURCES } from '@/lib/pakistan-price-sources';
import { USA_OFFICIAL_PRICE_SOURCES } from '@/lib/usa-price-sources';
import { discoverCatalogProductUrls, isProbableProductUrl, matchProductUrlToPhone, summarizeCatalogDiscoveryDiagnostics } from '@/lib/price-catalog-discovery';
import { recomputeBestPriceForPhone, resolvePendingRetailOffer } from '@/lib/price-offer-service';
import { bridgeCollectedPricesToTracker } from '@/lib/collector-price-bridge';
import { fetchRetailerPage } from '@/lib/retailer-fetch';
import { buildPriceVariantKey, inferRetailVariantIdentity, normalizeMemoryLabel } from '@/lib/price-variant';
import { normalizePtaPriceClass } from '@/lib/price-tracker-intelligence';
import { normalizeMarketPriceType, normalizePriceCurrency, normalizePriceMarket } from '@/lib/price-market';

// ── Lean document types for price-tracker ──
interface LeanBrand { _id: Types.ObjectId; name: string }

interface LeanPhoneDoc {
  _id: Types.ObjectId; modelName: string; slug: string; thumbnail: string;
  currentPrice: number; previousPrice: number; lowestPrice: number; highestPrice: number;
  priceChange: number; percentageChange: number;
  lastPriceCheckedAt: Date | null; lastPriceChangedAt: Date | null;
  priceMode: string; manualLock: boolean; manualLockReason: string;
  brand?: LeanBrand | null;
}

interface LeanSourceDoc {
  _id: Types.ObjectId; name: string; sourceType: string;
  enabled: boolean; trusted: boolean; baseUrl: string; verificationUrl: string; allowedDomains: string[];
  discoveryEnabled?: boolean; discoveryMode?: string; catalogUrls?: string[]; sitemapUrls?: string[]; feedUrl?: string; syncFrequency?: string;
  lastDiscoveryAt?: Date | null; productsFound?: number; productsAdded?: number; productsUpdated?: number; productsRemoved?: number;
  priority: number; lastCheckedAt: Date | null; lastSuccessAt: Date | null;
  failureCount: number; nextRetryAt: Date | null; lastError: string; status: string; notes: string;
  accessMode?: string; automaticFetchEnabled?: boolean; lastHttpStatus?: number | null; lastFailureType?: string; lastFetchDurationMs?: number; lastFinalUrl?: string; lastResponsePreview?: string;
  market?: string; currency?: string; defaultPriceType?: string;
}

interface LeanPopulatedPhone {
  _id: Types.ObjectId; modelName: string; slug: string; thumbnail: string;
  currentPrice?: number; brand?: { _id: Types.ObjectId; name: string } | null;
}

interface LeanPopulatedSource { _id: Types.ObjectId; name: string; sourceType: string }
interface LeanPopulatedAdmin { _id: Types.ObjectId; name: string; email: string }

interface LeanHistoryDoc {
  _id: Types.ObjectId;
  phoneId?: LeanPopulatedPhone | null;
  sourceId?: LeanPopulatedSource | null;
  changedByAdminId?: LeanPopulatedAdmin | null;
  oldPrice: number; newPrice: number; difference: number; percentageChange: number;
  changeType: string; sourceType: string; sourceUrl: string;
  priceClass?: string; market?: string; currency?: string; priceType?: string; ram?: string; storage?: string; color?: string; condition?: string; warrantyType?: string; variantKey?: string;
  verificationStatus: string; capturedAt: Date | null; createdAt?: Date;
}

interface LeanListingDoc {
  _id: Types.ObjectId;
  sourceId?: { _id: Types.ObjectId; name: string; sourceType: string; baseUrl: string; allowedDomains: string[]; market?: string; currency?: string; defaultPriceType?: string } | null;
  productUrl: string; ram: string; storage: string; color: string; condition: string; variantKey: string; ptaStatus: string; warrantyType: string; market?: string; currency?: string; priceType?: string;
  currentSourcePrice: number; previousSourcePrice: number; pendingSourcePrice: number; pendingDetectedAt: Date | null; availability: string;
  lastCheckedAt: Date | null; lastChangedAt: Date | null; enabled: boolean; verificationStatus: string;
}

interface LeanPhoneMini { currentPrice?: number; previousPrice?: number; modelName?: string; slug?: string }
interface LeanMatchCandidate {
  _id: Types.ObjectId;
  phoneId?: LeanPopulatedPhone | null;
  sourceUrl: string;
  hostname: string;
  status: 'pending' | 'resolved' | 'ignored';
  reason: string;
  createdAt?: Date;
}

interface LeanUnlinkedPhone {
  _id: Types.ObjectId;
  modelName: string;
  slug: string;
  thumbnail?: string;
  currentPrice?: number;
  brand?: LeanBrand | null;
}

// ── Price Tracker Settings (stored in SystemState) ──
const PT_SETTINGS_KEY = 'price_tracker_settings';
const PT_LAST_RUN_KEY = 'price_tracker_last_run';

export const DEFAULT_PT_SETTINGS = {
  autoApproveThreshold: 2,   // % — changes below this are auto-approved silently
  reviewThreshold: 15,       // % — changes above this are flagged for review
  batchSize: 10,             // phones per batch run
  checkFrequency: 'daily',   // daily | twice-daily | hourly
};

const PRICE_SOURCE_TYPES = new Set<string>(PRICE_SOURCE_TYPE_VALUES);

function normalizeSourceBaseUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') throw new Error('baseUrl must use HTTPS');
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return parsed.toString().replace(/\/$/, '');
}

function normalizeAllowedDomains(value: unknown, baseUrl = ''): string[] {
  const values = Array.isArray(value) ? value : [];
  const domains = values
    .map(item => String(item || '').trim().toLowerCase())
    .map(item => item.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/^\./, ''))
    .filter(Boolean);
  if (domains.length === 0 && baseUrl) {
    try { domains.push(new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, '')); } catch { /* validated elsewhere */ }
  }
  return [...new Set(domains)];
}

function isLikelyProductPageUrl(value: string): boolean {
  // Keep source creation, Test & Trust, catalog discovery and auto-link on the
  // same provider-aware URL rules. This accepts verified WhatMobile product
  // paths such as /Samsung_Galaxy-A37 while still rejecting
  // /Samsung_Mobiles_Prices and generic catalogue/homepage URLs.
  return isProbableProductUrl(value);
}


export async function getPriceTrackerSettings() {
  const doc = await SystemState.findOne({ key: PT_SETTINGS_KEY }).lean();
  if (!doc?.metadata) return { ...DEFAULT_PT_SETTINGS };
  return { ...DEFAULT_PT_SETTINGS, ...doc.metadata };
}

// ============ PRICE TRACKER GET ============

export async function handlePriceTrackerGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/stats (aliased as 'overview' by admin UI) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && (segments[2] === 'stats' || segments[2] === 'overview')) {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      phonesWithPrices,
      manualCount,
      automaticCount,
      priceDropsToday,
      priceIncreasesToday,
      pendingPriceChanges,
      pendingListingReviews,
      failedListings,
      failedSources,
      lastRunState,
      totalSources,
      enabledSources,
      readySources,
      totalPublishedPhones,
      trackedPhoneIds,
      pendingSourceGaps,
    ] = await Promise.all([
      Phone.countDocuments({ active: true, status: 'published', currentPrice: { $gt: 0 } }),
      Phone.countDocuments({ active: true, status: 'published', priceMode: 'manual', currentPrice: { $gt: 0 } }),
      Phone.countDocuments({ active: true, status: 'published', priceMode: 'automatic', currentPrice: { $gt: 0 } }),
      PriceTrackerHistory.countDocuments({ changeType: 'decrease', capturedAt: { $gte: todayStart } }),
      PriceTrackerHistory.countDocuments({ changeType: 'increase', capturedAt: { $gte: todayStart } }),
      PriceTrackerHistory.countDocuments({ verificationStatus: 'pending' }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'pending' }),
      PhoneRetailListing.countDocuments({ enabled: true, verificationStatus: 'failed' }),
      PriceSource.countDocuments({ status: 'failed' }),
      SystemState.findOne({ key: PT_LAST_RUN_KEY }).lean(),
      PriceSource.countDocuments({}),
      PriceSource.countDocuments({ enabled: true, status: 'active' }),
      PriceSource.countDocuments({
        enabled: true,
        status: 'active',
        trusted: true,
        allowedDomains: { $exists: true, $ne: [] },
      }),
      Phone.countDocuments({ active: true, status: 'published' }),
      PhoneRetailListing.distinct('phoneId', { enabled: true, verificationStatus: { $in: ['verified', 'pending'] } }),
      PriceMatchCandidate.countDocuments({ status: 'pending' }),
    ]);

    return NextResponse.json({
      monitoredPhones: trackedPhoneIds.length,
      phonesWithPrices,
      manualPrices: manualCount,
      automaticPrices: automaticCount,
      dropsToday: priceDropsToday,
      increasesToday: priceIncreasesToday,
      pendingReview: pendingPriceChanges + pendingListingReviews,
      pendingPriceChanges,
      pendingListingReviews,
      failedChecks: failedListings + failedSources,
      lastSuccessfulUpdate: (lastRunState?.metadata as { lastSuccessAt?: string } | undefined)?.lastSuccessAt || null,
      lastRunSummary: (lastRunState?.metadata as Record<string, unknown> | undefined) || null,
      totalSources,
      enabledSources,
      readySources,
      totalPublishedPhones,
      trackingReadyPhones: trackedPhoneIds.length,
      pendingSourceGaps: Math.max(pendingSourceGaps, Math.max(0, totalPublishedPhones - trackedPhoneIds.length)),
      unlinkedPhones: Math.max(0, totalPublishedPhones - trackedPhoneIds.length),
      trackingCoveragePct: totalPublishedPhones > 0
        ? Math.round((trackedPhoneIds.length / totalPublishedPhones) * 100)
        : 0,
    });
  }

  // ---- /api/admin/price-tracker/phones ----
  // The catalog view must include every published phone, not only phones that
  // already have a price. Listing state is joined separately so unlinked phones
  // remain visible and actionable instead of disappearing from the tracker.
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const url = new URL(req.url);
    const page = parseBoundedInt(url.searchParams.get('page'), 1);
    const limit = parseBoundedInt(url.searchParams.get('limit'), 20, { max: 200 });
    const skip = (page - 1) * limit;
    const search = (url.searchParams.get('search') || '').trim();
    const mode = url.searchParams.get('mode') || 'all';
    const priceType = url.searchParams.get('priceType') || 'all';
    const sort = url.searchParams.get('sort') || 'name-az';

    const basePhoneFilter: Record<string, unknown> = { active: true, status: 'published' };
    const filter: Record<string, unknown> = { ...basePhoneFilter };
    if (mode === 'manual') filter.priceMode = { $ne: 'automatic' };
    else if (mode === 'automatic') filter.priceMode = 'automatic';

    const validPriceTypes = new Set(['pta-approved', 'non-pta', 'us-retail']);
    const classifiedPriceFilter = { price: { $gt: 0 }, priceType: { $in: Array.from(validPriceTypes) } };
    const [classifiedPhoneIdsRaw, explicitUnclassifiedPhoneIdsRaw] = await Promise.all([
      PhonePrice.find(classifiedPriceFilter).distinct('phoneId').then(ids => ids as Types.ObjectId[]),
      PhonePrice.find({
        price: { $gt: 0 },
        $or: [
          { priceType: { $exists: false } },
          { priceType: null },
          { priceType: '' },
          { priceType: 'unknown' },
          { priceType: { $nin: Array.from(validPriceTypes) } },
        ],
      }).distinct('phoneId').then(ids => ids as Types.ObjectId[]),
    ]);
    const legacyUnclassifiedIds = await Phone.find({
      ...basePhoneFilter,
      currentPrice: { $gt: 0 },
      _id: { $nin: classifiedPhoneIdsRaw },
    }).distinct('_id') as Types.ObjectId[];
    // A phone still needs review when even one priced variant is unclassified,
    // even if another variant for the same phone is already PTA/Non-PTA/US.
    const unclassifiedPhoneIds = Array.from(new Map(
      [...explicitUnclassifiedPhoneIdsRaw, ...legacyUnclassifiedIds]
        .map(id => [String(id), id]),
    ).values());

    let bucketPhoneIds: Types.ObjectId[] | null = null;
    if (validPriceTypes.has(priceType)) {
      const bucketMarket = priceType === 'us-retail' ? 'US' : 'PK';
      bucketPhoneIds = await PhonePrice.find({
        price: { $gt: 0 },
        market: bucketMarket,
        priceType,
      }).distinct('phoneId') as Types.ObjectId[];
      filter._id = { $in: bucketPhoneIds };
    } else if (priceType === 'unclassified') {
      bucketPhoneIds = unclassifiedPhoneIds;
      filter._id = { $in: bucketPhoneIds };
    }

    if (search.length >= 2) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const brandMatches = await Brand.find({ name: { $regex: safe, $options: 'i' } }).select('_id').lean();
      const brandIds = brandMatches.map((b: { _id: Types.ObjectId }) => b._id);
      const searchOr: Record<string, unknown>[] = [
        { modelName: { $regex: safe, $options: 'i' } },
        { slug: { $regex: safe, $options: 'i' } },
      ];
      if (brandIds.length > 0) searchOr.push({ brandId: { $in: brandIds } });
      filter.$or = searchOr;
    }

    let sortObj: Record<string, 1 | -1> = { modelName: 1 };
    if (sort === 'name-za') sortObj = { modelName: -1 };
    else if (sort === 'price-low') sortObj = { currentPrice: 1, modelName: 1 };
    else if (sort === 'price-high') sortObj = { currentPrice: -1, modelName: 1 };
    else if (sort === 'change-desc') sortObj = { percentageChange: 1 };
    else if (sort === 'change-asc') sortObj = { percentageChange: -1 };
    else if (sort === 'updated') sortObj = { lastPriceCheckedAt: -1, modelName: 1 };

    const [phones, total, allPublishedTotal, automaticTotal, manualTotal, ptaPhoneIds, nonPtaPhoneIds, usRetailPhoneIds] = await Promise.all([
      Phone.find(filter).sort(sortObj).skip(skip).limit(limit).populate('brand').lean(),
      Phone.countDocuments(filter),
      Phone.countDocuments(basePhoneFilter),
      Phone.countDocuments({ ...basePhoneFilter, priceMode: 'automatic', manualLock: { $ne: true } }),
      Phone.countDocuments({
        ...basePhoneFilter,
        $or: [
          { priceMode: { $ne: 'automatic' } },
          { manualLock: true },
        ],
      }),
      PhonePrice.find({ price: { $gt: 0 }, market: 'PK', priceType: 'pta-approved' }).distinct('phoneId').then(ids => ids as Types.ObjectId[]),
      PhonePrice.find({ price: { $gt: 0 }, market: 'PK', priceType: 'non-pta' }).distinct('phoneId').then(ids => ids as Types.ObjectId[]),
      PhonePrice.find({ price: { $gt: 0 }, market: 'US', priceType: 'us-retail' }).distinct('phoneId').then(ids => ids as Types.ObjectId[]),
    ]);

    const phoneIds = phones.map((phone: LeanPhoneDoc) => phone._id);
    const bucketPriceFilter: Record<string, unknown> = { phoneId: { $in: phoneIds }, price: { $gt: 0 } };
    if (validPriceTypes.has(priceType)) {
      bucketPriceFilter.market = priceType === 'us-retail' ? 'US' : 'PK';
      bucketPriceFilter.priceType = priceType;
    } else if (priceType === 'unclassified') {
      bucketPriceFilter.$or = [
        { priceType: { $exists: false } },
        { priceType: null },
        { priceType: '' },
        { priceType: 'unknown' },
        { priceType: { $nin: Array.from(validPriceTypes) } },
      ];
    }
    const [listingRows, overrideRows, bucketPriceRows] = await Promise.all([
      PhoneRetailListing.find({ phoneId: { $in: phoneIds }, enabled: true })
        .sort({ verificationStatus: 1, lastSuccessAt: -1, createdAt: 1 })
        .populate('sourceId', 'name sourceType')
        .lean(),
      PhonePrice.find({ phoneId: { $in: phoneIds }, manualOverride: true, price: { $gt: 0 } })
        .select('phoneId overrideLocked market priceType variantKey')
        .lean(),
      PhonePrice.find(bucketPriceFilter)
        .sort({ overrideLocked: -1, updatedAt: -1, createdAt: -1 })
        .select('phoneId price regularPrice market currency priceType manualOverride overrideLocked updatedAt createdAt')
        .lean(),
    ]);
    const bucketPriceByPhone = new Map<string, typeof bucketPriceRows[number]>();
    for (const row of bucketPriceRows) {
      const key = String(row.phoneId);
      if (!bucketPriceByPhone.has(key)) bucketPriceByPhone.set(key, row);
    }
    const overrideStats = new Map<string, { total: number; locked: number }>();
    for (const row of overrideRows as Array<{ phoneId: Types.ObjectId; overrideLocked?: boolean }>) {
      const key = String(row.phoneId); const current = overrideStats.get(key) || { total: 0, locked: 0 };
      current.total += 1; if (row.overrideLocked) current.locked += 1; overrideStats.set(key, current);
    }
    const listingByPhone = new Map<string, typeof listingRows[number]>();
    const verificationRank: Record<string, number> = { verified: 4, pending: 3, failed: 2, rejected: 1 };
    for (const listing of listingRows) {
      const key = String(listing.phoneId);
      const current = listingByPhone.get(key);
      if (!current || (verificationRank[String(listing.verificationStatus)] || 0) > (verificationRank[String(current.verificationStatus)] || 0)) {
        listingByPhone.set(key, listing);
      }
    }

    return NextResponse.json({
      phones: phones.map((p: LeanPhoneDoc) => {
        const listing = listingByPhone.get(p._id.toString()) as unknown as {
          sourceId?: LeanPopulatedSource | null; verificationStatus?: string; availability?: string;
          lastCheckedAt?: Date | null; lastSuccessAt?: Date | null; enabled?: boolean;
        } | undefined;
        // A linked retailer row alone must not silently change the mode shown
        // in the admin. priceMode is the operator's explicit choice; the
        // listing only makes that choice executable by the sync worker.
        const automatic = p.priceMode === 'automatic' && listing?.verificationStatus === 'verified' && p.manualLock !== true;
        const brandName = String(p.brand?.name || '').trim();
        const modelName = String(p.modelName || '').trim();
        const displayName = brandName && !modelName.toLowerCase().startsWith(brandName.toLowerCase())
          ? `${brandName} ${modelName}`.trim()
          : modelName;
        return {
          id: p._id.toString(),
          phoneId: p._id.toString(),
          phoneName: displayName,
          name: displayName,
          slug: p.slug,
          brand: brandName,
          currentPrice: Number(bucketPriceByPhone.get(p._id.toString())?.price || p.currentPrice || 0),
          previousPrice: Number(p.previousPrice || 0),
          difference: Number(p.priceChange || 0),
          percentChange: Number(p.percentageChange || 0),
          mode: automatic ? 'automatic' : 'manual',
          source: listing?.sourceId?.name || '',
          sourceType: listing?.sourceId?.sourceType || '',
          linked: Boolean(listing),
          verificationStatus: listing?.verificationStatus || 'unlinked',
          availability: listing?.availability || 'unknown',
          lastUpdated: (bucketPriceByPhone.get(p._id.toString())?.updatedAt || listing?.lastSuccessAt || listing?.lastCheckedAt || p.lastPriceCheckedAt || p.lastPriceChangedAt || '').toString(),
          status: listing?.enabled === false ? 'inactive' : 'active',
          manualLock: Boolean(p.manualLock),
          manualOverrideCount: overrideStats.get(p._id.toString())?.total || 0,
          lockedOverrideCount: overrideStats.get(p._id.toString())?.locked || 0,
        };
      }),
      total,
      modeTotals: { manual: manualTotal, automatic: automaticTotal },
      catalogStats: {
        allPublished: allPublishedTotal,
        matching: total,
        ptaApproved: ptaPhoneIds.length,
        nonPta: nonPtaPhoneIds.length,
        usRetail: usRetailPhoneIds.length,
        unclassified: unclassifiedPhoneIds.length,
      },
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/price-tracker/price-control/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'price-control') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();
    const phoneId = segments[3];
    const phone = await Phone.findById(phoneId).select('_id modelName slug priceMode manualLock manualLockReason bestPtaPricePKR bestNonPtaPricePKR bestUsPriceUSD').lean();
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    const [manualRows, autoRows] = await Promise.all([
      PhonePrice.find({ phoneId, manualOverride: true }).sort({ updatedAt: -1 }).lean(),
      PhoneRetailListing.find({ phoneId, enabled: true, currentSourcePrice: { $gt: 0 } })
        .populate('sourceId', 'name trusted enabled status market currency defaultPriceType')
        .sort({ lastSuccessAt: -1, updatedAt: -1 }).lean(),
    ]);
    const manual = (manualRows as Array<Record<string, unknown>>).map(row => ({
      id: String(row._id || ''), price: Number(row.price || 0), regularPrice: Number(row.regularPrice || 0), discountStartAt: row.discountStartAt || null, discountEndAt: row.discountEndAt || null, market: normalizePriceMarket(row.market),
      currency: normalizePriceCurrency(row.currency, row.market), priceType: normalizeMarketPriceType({ market: row.market, priceType: row.priceType, ptaStatus: row.ptaStatus }),
      ptaStatus: String(row.ptaStatus || ''), ram: String(row.ram || ''), storage: String(row.storage || ''), color: String(row.color || ''), condition: String(row.condition || 'new'), warrantyType: String(row.warrantyType || ''),
      variantKey: String(row.variantKey || ''), locked: row.overrideLocked === true, reason: String(row.overrideReason || ''), autoDetectedPrice: Number(row.autoDetectedPrice || 0), lastAutoDetectedAt: row.lastAutoDetectedAt || null, updatedAt: row.updatedAt || null,
    }));
    const automatic = (autoRows as Array<Record<string, any>>).map(row => { const source = row.sourceId || {}; return ({
      id: String(row._id || ''), source: String(source.name || ''), trusted: source.trusted === true, verificationStatus: String(row.verificationStatus || ''), price: Number(row.currentSourcePrice || 0), regularPrice: Number(row.regularSourcePrice || 0), discountStartAt: row.discountStartAt || null, discountEndAt: row.discountEndAt || null,
      market: normalizePriceMarket(row.market || source.market), currency: normalizePriceCurrency(row.currency || source.currency, row.market || source.market),
      priceType: normalizeMarketPriceType({ market: row.market || source.market, priceType: row.priceType || source.defaultPriceType, ptaStatus: row.ptaStatus }), ptaStatus: String(row.ptaStatus || ''),
      ram: String(row.ram || ''), storage: String(row.storage || ''), color: String(row.color || ''), condition: String(row.condition || 'new'), warrantyType: String(row.warrantyType || ''), variantKey: String(row.variantKey || ''),
      lastSuccessAt: row.lastSuccessAt || null, productUrl: String(row.productUrl || ''),
    }); });
    return NextResponse.json({ phone: { id: phone._id.toString(), name: phone.modelName, slug: phone.slug, priceMode: phone.priceMode, manualLock: phone.manualLock, manualLockReason: phone.manualLockReason, bestPtaPricePKR: phone.bestPtaPricePKR || 0, bestNonPtaPricePKR: phone.bestNonPtaPricePKR || 0, bestUsPriceUSD: phone.bestUsPriceUSD || 0 }, manual, automatic });
  }

  // ---- /api/admin/price-tracker/sources ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const [sources, listingStats] = await Promise.all([
      PriceSource.find().sort({ priority: -1, createdAt: 1 }).lean(),
      PhoneRetailListing.aggregate<{
        _id: Types.ObjectId;
        total: number;
        verified: number;
        pending: number;
        enabled: number;
      }>([
        {
          $group: {
            _id: '$sourceId',
            total: { $sum: 1 },
            verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } },
            enabled: { $sum: { $cond: ['$enabled', 1, 0] } },
          },
        },
      ]),
    ]);
    const statsBySource = new Map(listingStats.map((item) => [item._id.toString(), item]));
    return NextResponse.json({
      sources: sources.map((s: LeanSourceDoc) => {
        const id = s._id?.toString();
        const coverage = statsBySource.get(id);
        const health = !s.enabled || s.status === 'paused'
          ? 'paused'
          : s.accessMode === 'challenge_blocked' || s.automaticFetchEnabled === false
            ? 'blocked'
            : !s.trusted
              ? 'setup'
              : s.failureCount >= 3 || s.status === 'failed'
                ? 'attention'
                : (coverage?.verified || 0) === 0
                  ? 'no-listings'
                  : 'healthy';
        return {
        id,
        name: s.name,
        sourceType: s.sourceType,
        market: normalizePriceMarket(s.market),
        currency: normalizePriceCurrency(s.currency, s.market),
        defaultPriceType: normalizeMarketPriceType({ market: s.market, priceType: s.defaultPriceType }),
        enabled: s.enabled,
        trusted: s.trusted,
        baseUrl: s.baseUrl || '',
        verificationUrl: s.verificationUrl || '',
        discoveryEnabled: Boolean(s.discoveryEnabled),
        discoveryMode: s.discoveryMode || 'manual',
        catalogUrls: s.catalogUrls || [],
        sitemapUrls: s.sitemapUrls || [],
        feedUrl: s.feedUrl || '',
        syncFrequency: s.syncFrequency || 'daily',
        lastDiscoveryAt: s.lastDiscoveryAt || null,
        productsFound: s.productsFound || 0,
        productsAdded: s.productsAdded || 0,
        productsUpdated: s.productsUpdated || 0,
        productsRemoved: s.productsRemoved || 0,
        allowedDomains: s.allowedDomains || [],
        priority: s.priority || 0,
        lastCheckedAt: s.lastCheckedAt || null,
        lastSuccessAt: s.lastSuccessAt || null,
        failureCount: s.failureCount || 0,
        nextRetryAt: s.nextRetryAt || null,
        lastError: s.lastError || '',
        status: s.status || 'active',
        notes: s.notes || '',
        accessMode: s.accessMode || 'direct',
        automaticFetchEnabled: s.automaticFetchEnabled !== false,
        lastHttpStatus: s.lastHttpStatus ?? null,
        lastFailureType: s.lastFailureType || '',
        lastFetchDurationMs: s.lastFetchDurationMs || 0,
        lastFinalUrl: s.lastFinalUrl || '',
        lastResponsePreview: s.lastResponsePreview || '',
        listingCount: coverage?.total || 0,
        enabledListings: coverage?.enabled || 0,
        verifiedListings: coverage?.verified || 0,
        pendingListings: coverage?.pending || 0,
        health,
      };
      }),
    });
  }

  // ---- /api/admin/price-tracker/changes ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'changes') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const url = new URL(req.url);
    const page = parseBoundedInt(url.searchParams.get('page'), 1);
    const limit = parseBoundedInt(url.searchParams.get('limit'), 20, { max: 100 });
    const skip = (page - 1) * limit;
    const changeType = url.searchParams.get('changeType');
    const sourceType = url.searchParams.get('sourceType');

    const filter: Record<string, unknown> = {};
    if (changeType && ['increase', 'decrease', 'unchanged', 'correction'].includes(changeType)) {
      filter.changeType = changeType;
    } else {
      // A first successful source detection is a baseline/correction (0 -> price),
      // not a market movement. Keep it in per-phone history for auditing, but do
      // not present it as a Recent Price Change or distort increase/drop reports.
      filter.changeType = { $in: ['increase', 'decrease'] };
      filter.oldPrice = { $gt: 0 };
      filter.newPrice = { $gt: 0 };
    }
    if (sourceType && ['manual', 'retailer', 'correction'].includes(sourceType)) {
      filter.sourceType = sourceType;
    }

    const [changes, total] = await Promise.all([
      PriceTrackerHistory.find(filter).sort({ capturedAt: -1 }).skip(skip).limit(limit).populate('phoneId', 'modelName slug thumbnail brand').populate('sourceId', 'name sourceType').populate('changedByAdminId', 'name email').lean(),
      PriceTrackerHistory.countDocuments(filter),
    ]);

    return NextResponse.json({
      changes: changes.map((c: LeanHistoryDoc) => ({
        id: c._id?.toString(),
        phoneId: c.phoneId?._id?.toString(),
        phoneName: c.phoneId?.modelName || '',
        phoneSlug: c.phoneId?.slug || '',
        phoneThumbnail: c.phoneId?.thumbnail || '',
        brandName: c.phoneId?.brand?.name || '',
        oldPrice: c.oldPrice || 0,
        newPrice: c.newPrice || 0,
        difference: c.difference || 0,
        percentageChange: c.percentageChange || 0,
        percentChange: c.percentageChange || 0,
        changeType: c.changeType || 'unchanged',
        sourceType: c.sourceType || 'manual',
        sourceName: c.sourceId?.name || '',
        source: c.sourceId?.name || '',
        sourceUrl: c.sourceUrl || '',
        priceClass: c.priceClass || 'unknown',
        market: normalizePriceMarket(c.market),
        currency: normalizePriceCurrency(c.currency, c.market),
        priceType: normalizeMarketPriceType({ market: c.market, priceType: c.priceType, ptaStatus: c.priceClass }),
        ram: c.ram || '',
        storage: c.storage || '',
        color: c.color || '',
        condition: c.condition || 'new',
        warrantyType: c.warrantyType || '',
        variantKey: c.variantKey || '',
        verificationStatus: c.verificationStatus || 'confirmed',
        status: c.verificationStatus || 'confirmed',
        capturedAt: c.capturedAt || c.createdAt || null,
        date: c.capturedAt || c.createdAt || null,
        changedBy: c.changedByAdminId ? { name: c.changedByAdminId?.name, email: c.changedByAdminId?.email } : undefined,
      })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  }

  // ---- /api/admin/price-tracker/pending ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'pending') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const [pendingChanges, pendingListings] = await Promise.all([
      PriceTrackerHistory.find({ verificationStatus: 'pending' })
        .sort({ capturedAt: -1 })
        .populate('phoneId', 'modelName slug thumbnail currentPrice brand')
        .populate('sourceId', 'name sourceType')
        .lean(),
      PhoneRetailListing.find({ enabled: true, verificationStatus: 'pending' })
        .sort({ pendingDetectedAt: -1, lastCheckedAt: -1, updatedAt: -1 })
        .populate('phoneId', 'modelName slug thumbnail currentPrice brand')
        .populate('sourceId', 'name sourceType')
        .lean(),
    ]);

    const historyItems = pendingChanges.map((c: LeanHistoryDoc) => ({
        id: c._id?.toString(),
        reviewType: 'price-change' as const,
        phoneId: c.phoneId?._id?.toString(),
        phoneName: c.phoneId?.modelName || '',
        phoneSlug: c.phoneId?.slug || '',
        phoneThumbnail: c.phoneId?.thumbnail || '',
        phoneCurrentPrice: c.phoneId?.currentPrice || 0,
        brandName: c.phoneId?.brand?.name || '',
        oldPrice: c.oldPrice || 0,
        newPrice: c.newPrice || 0,
        difference: c.difference || 0,
        percentageChange: c.percentageChange || 0,
        percentChange: c.percentageChange || 0,
        changeType: c.changeType || 'unchanged',
        sourceType: c.sourceType || 'manual',
        sourceName: c.sourceId?.name || '',
        source: c.sourceId?.name || '',
        sourceUrl: c.sourceUrl || '',
        priceClass: c.priceClass || 'unknown',
        market: normalizePriceMarket(c.market),
        currency: normalizePriceCurrency(c.currency, c.market),
        priceType: normalizeMarketPriceType({ market: c.market, priceType: c.priceType, ptaStatus: c.priceClass }),
        ram: c.ram || '',
        storage: c.storage || '',
        color: c.color || '',
        condition: c.condition || 'new',
        warrantyType: c.warrantyType || '',
        variantKey: c.variantKey || '',
        capturedAt: c.capturedAt || c.createdAt || null,
        date: c.capturedAt || c.createdAt || null,
      }));

    const listingItems = pendingListings.map((listing: any) => ({
      id: `listing:${listing._id?.toString()}`,
      listingId: listing._id?.toString(),
      reviewType: 'listing-verification' as const,
      phoneId: listing.phoneId?._id?.toString() || '',
      phoneName: listing.phoneId?.modelName || 'Unknown phone',
      phoneSlug: listing.phoneId?.slug || '',
      phoneThumbnail: listing.phoneId?.thumbnail || '',
      phoneCurrentPrice: Number(listing.phoneId?.currentPrice || 0),
      brandName: listing.phoneId?.brand?.name || '',
      oldPrice: Number(listing.currentSourcePrice || 0),
      newPrice: Number(listing.pendingSourcePrice || listing.currentSourcePrice || 0),
      difference: Number(listing.pendingSourcePrice || 0) > 0
        ? Number(listing.pendingSourcePrice || 0) - Number(listing.currentSourcePrice || 0)
        : 0,
      percentageChange: 0,
      percentChange: 0,
      changeType: 'correction' as const,
      sourceType: listing.sourceId?.sourceType || 'retailer',
      sourceName: listing.sourceId?.name || '',
      source: listing.sourceId?.name || '',
      sourceUrl: listing.productUrl || '',
      priceClass: listing.priceType || 'unknown',
      market: normalizePriceMarket(listing.market),
      currency: normalizePriceCurrency(listing.currency, listing.market),
      priceType: normalizeMarketPriceType({ market: listing.market, priceType: listing.priceType, ptaStatus: listing.ptaStatus }),
      ptaStatus: listing.ptaStatus || '',
      ram: listing.ram || '',
      storage: listing.storage || '',
      color: listing.color || '',
      condition: listing.condition || 'new',
      warrantyType: listing.warrantyType || '',
      variantKey: listing.variantKey || '',
      verificationStatus: listing.verificationStatus || 'pending',
      status: 'pending' as const,
      reason: listing.lastError || 'Retail listing requires administrator verification before automatic price updates can continue.',
      capturedAt: listing.pendingDetectedAt || listing.lastCheckedAt || listing.updatedAt || listing.createdAt || null,
      date: listing.pendingDetectedAt || listing.lastCheckedAt || listing.updatedAt || listing.createdAt || null,
    }));

    return NextResponse.json({
      pending: [...historyItems, ...listingItems].sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime()),
      counts: { priceChanges: historyItems.length, listingVerification: listingItems.length, total: historyItems.length + listingItems.length },
    });
  }

  // ---- /api/admin/price-tracker/history/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'history') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.find({ phoneId })
      .sort({ capturedAt: -1 })
      .populate('sourceId', 'name sourceType')
      .populate('changedByAdminId', 'name email')
      .lean();

    return NextResponse.json({
      history: history.map((h: LeanHistoryDoc) => ({
        id: h._id?.toString(),
        oldPrice: h.oldPrice || 0,
        newPrice: h.newPrice || 0,
        difference: h.difference || 0,
        percentageChange: h.percentageChange || 0,
        percentChange: h.percentageChange || 0,
        changeType: h.changeType || 'unchanged',
        sourceType: h.sourceType || 'manual',
        sourceName: h.sourceId?.name || '',
        source: h.sourceId?.name || '',
        sourceUrl: h.sourceUrl || '',
        priceClass: h.priceClass || 'unknown',
        market: normalizePriceMarket(h.market),
        currency: normalizePriceCurrency(h.currency, h.market),
        priceType: normalizeMarketPriceType({ market: h.market, priceType: h.priceType, ptaStatus: h.priceClass }),
        ram: h.ram || '',
        storage: h.storage || '',
        color: h.color || '',
        condition: h.condition || 'new',
        warrantyType: h.warrantyType || '',
        variantKey: h.variantKey || '',
        verificationStatus: h.verificationStatus || 'confirmed',
        status: h.verificationStatus || 'confirmed',
        capturedAt: h.capturedAt || h.createdAt || null,
        date: h.capturedAt || h.createdAt || null,
        changedBy: h.changedByAdminId ? { name: h.changedByAdminId?.name, email: h.changedByAdminId?.email } : undefined,
      })),
    });
  }

  // ---- /api/admin/price-tracker/listings/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const listings = await PhoneRetailListing.find({ phoneId })
      .sort({ createdAt: -1 })
      .populate('sourceId', 'name sourceType baseUrl allowedDomains market currency defaultPriceType')
      .lean();

    return NextResponse.json({
      listings: listings.map((listing) => {
        // Mongoose's lean()+populate() inference only exposes the base PriceSource
        // shape here. Cast the populated projection explicitly so market-aware
        // fields added to PriceSource remain type-safe during production builds.
        const l = listing as unknown as LeanListingDoc;
        const source = l.sourceId as LeanListingDoc['sourceId'];
        return ({
        id: l._id?.toString(),
        sourceId: source?._id?.toString(),
        sourceName: source?.name || '',
        sourceType: source?.sourceType || '',
        productUrl: l.productUrl || '',
        ram: l.ram || '',
        storage: l.storage || '',
        color: l.color || '',
        condition: l.condition || 'new',
        variantKey: l.variantKey || buildPriceVariantKey(l),
        ptaStatus: l.ptaStatus || '',
        warrantyType: l.warrantyType || '',
        market: normalizePriceMarket(l.market || source?.market),
        currency: normalizePriceCurrency(l.currency || source?.currency, l.market || source?.market),
        priceType: normalizeMarketPriceType({ market: l.market || source?.market, priceType: l.priceType || source?.defaultPriceType, ptaStatus: l.ptaStatus }),
        currentSourcePrice: l.currentSourcePrice || 0,
        previousSourcePrice: l.previousSourcePrice || 0,
        pendingSourcePrice: l.pendingSourcePrice || 0,
        pendingDetectedAt: l.pendingDetectedAt || null,
        availability: l.availability || 'unknown',
        lastCheckedAt: l.lastCheckedAt || null,
        lastChangedAt: l.lastChangedAt || null,
        enabled: l.enabled ?? true,
        verificationStatus: l.verificationStatus || 'pending',
        });
      }),
    });
  }

  // ---- /api/admin/price-tracker/match-queue ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'match-queue') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();

    const searchParams = new URL(req.url).searchParams;
    const requestedStatus = searchParams.get('status') || 'pending';
    const status = ['pending', 'resolved', 'ignored'].includes(requestedStatus) ? requestedStatus : 'pending';
    const includeUnlinked = searchParams.get('includeUnlinked') === '1';
    const page = parseBoundedInt(searchParams.get('page'), 1, { min: 1, max: 10000 });
    const limit = parseBoundedInt(searchParams.get('limit'), 25, { min: 1, max: 100 });

    const candidateQuery = PriceMatchCandidate.find({ status })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('phoneId', 'modelName slug thumbnail currentPrice')
      .lean();

    let unlinkedPhones: LeanUnlinkedPhone[] = [];
    let unlinkedTotal = 0;
    if (includeUnlinked && status === 'pending') {
      const linkedPhoneIds = await PhoneRetailListing.distinct('phoneId', {
        enabled: true,
        verificationStatus: { $in: ['verified', 'pending'] },
      });
      const unlinkedFilter = {
        active: true,
        status: 'published',
        _id: { $nin: linkedPhoneIds.filter(Boolean) },
      };
      const [rows, count] = await Promise.all([
        Phone.find(unlinkedFilter)
          .select('_id modelName slug thumbnail currentPrice brandId')
          .sort({ modelName: 1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('brand', 'name')
          .lean(),
        Phone.countDocuments(unlinkedFilter),
      ]);
      unlinkedPhones = rows as unknown as LeanUnlinkedPhone[];
      unlinkedTotal = count;
    }

    const candidates = await candidateQuery;

    return NextResponse.json({
      candidates: candidates.map((candidate: LeanMatchCandidate) => ({
        id: candidate._id.toString(),
        phoneId: candidate.phoneId?._id?.toString() || '',
        phoneName: candidate.phoneId?.modelName || 'Unknown phone',
        phoneSlug: candidate.phoneId?.slug || '',
        sourceUrl: candidate.sourceUrl,
        hostname: candidate.hostname,
        status: candidate.status,
        reason: candidate.reason,
        createdAt: candidate.createdAt || null,
      })),
      unlinkedPhones: unlinkedPhones.map(phone => ({
        id: phone._id.toString(),
        phoneName: phone.modelName,
        phoneSlug: phone.slug,
        brand: phone.brand?.name || 'Unknown brand',
        thumbnail: phone.thumbnail || '',
        currentPrice: Number(phone.currentPrice || 0),
      })),
      unlinkedTotal,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(unlinkedTotal / limit)),
    });
  }

  // ---- /api/admin/price-tracker/settings ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'settings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'prices:read'); if (permCheck) return permCheck;
    await connectDB();
    const settings = await getPriceTrackerSettings();
    return NextResponse.json({
      ...settings,
      cronConfigured: Boolean(process.env.CRON_SECRET),
      cronSchedule: process.env.PRICE_SYNC_CRON || '0 1 * * *',
    });
  }

  return undefined;
}

// ============ PRICE TRACKER POST ============

export async function handlePriceTrackerPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/bootstrap ----
  // Idempotently creates/refreshes Pakistan official source definitions so a
  // production deployment does not depend on running a one-off CLI command.
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'bootstrap') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    let created = 0;
    let refreshed = 0;
    const bootstrapSources = [...PAKISTAN_OFFICIAL_PRICE_SOURCES, ...USA_OFFICIAL_PRICE_SOURCES];
    for (const source of bootstrapSources) {
      const result = await PriceSource.updateOne(
        { name: source.name },
        {
          $set: { baseUrl: source.baseUrl, allowedDomains: source.allowedDomains, priority: source.priority, sourceType: source.sourceType, market: source.market, currency: source.currency, defaultPriceType: source.defaultPriceType, notes: source.notes },
          $setOnInsert: { enabled: source.enabled, trusted: source.trusted, status: source.status },
        },
        { upsert: true },
      );
      if (result.upsertedCount) created++; else refreshed++;
    }

    await ActivityLog.create({ adminId: admin._id, action: 'bootstrap_price_sources', details: `Created ${created} and refreshed ${refreshed} Pakistan official price sources.`, entityType: 'price_source' }).catch(() => undefined);
    return NextResponse.json({ success: true, created, refreshed, total: bootstrapSources.length, pakistanSources: PAKISTAN_OFFICIAL_PRICE_SOURCES.length, usaSources: USA_OFFICIAL_PRICE_SOURCES.length });
  }

  // ---- /api/admin/price-tracker/auto-link ----
  // Converts source-backed records into pending tracker listings. A URL is
  // linked only when its hostname belongs to an enabled, trusted allowlist;
  // the scheduled checker must verify the page before its price can go live.
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'auto-link') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const sources = await PriceSource.find({
      enabled: true,
      trusted: true,
      status: 'active',
      allowedDomains: { $exists: true, $ne: [] },
    }).select('_id name allowedDomains discoveryEnabled discoveryMode catalogUrls sitemapUrls feedUrl').lean() as unknown as LeanSourceDoc[];

    if (!sources.length) {
      return NextResponse.json(
        { error: 'No enabled trusted source with allowed domains exists. Configure and test a source first.' },
        { status: 400 },
      );
    }

    // Older auto-link versions could mark a listing verified before a page was
    // ever checked. Repair only clearly untested rows; genuine checked rows are
    // left untouched.
    const repairResult = await PhoneRetailListing.updateMany(
      {
        enabled: true,
        verificationStatus: 'verified',
        lastCheckedAt: null,
        extractionMethod: '',
      },
      { $set: { verificationStatus: 'pending', currentSourcePrice: 0 } },
    );

    const phones = await Phone.find({ active: true, status: 'published' })
      .select('_id modelName slug sourceUrl brandId')
      .populate({ path: 'brandId', select: 'name' })
      .lean();
    const collectorBridge = await bridgeCollectedPricesToTracker();

    let discovered = 0;
    let discoveryLinked = 0;
    let discoveryUnmatched = 0;
    const discoveryErrors: string[] = [];
    for (const source of sources.filter(item => item.discoveryEnabled && item.discoveryMode !== 'manual')) {
      const result = await discoverCatalogProductUrls({
        mode: source.discoveryMode || 'manual',
        catalogUrls: source.catalogUrls,
        sitemapUrls: source.sitemapUrls,
        feedUrl: source.feedUrl,
        allowedDomains: source.allowedDomains || [],
      });
      discovered += result.urls.length;
      discoveryErrors.push(...result.errors.map(error => `${source.name}: ${error}`));
      if (result.urls.length === 0 && result.errors.length === 0) {
        const diagnostic = summarizeCatalogDiscoveryDiagnostics(result);
        if (diagnostic) discoveryErrors.push(`${source.name}: no product URLs accepted | ${diagnostic}`);
      }
      let sourceAdded = 0;
      for (const productUrl of result.urls) {
        const phone = matchProductUrlToPhone(productUrl, phones);
        if (!phone) { discoveryUnmatched++; continue; }
        const variant = inferRetailVariantIdentity({ productUrl, existing: { condition: 'new' } });
        const update = await PhoneRetailListing.updateOne(
          { sourceId: source._id, productUrl },
          { $setOnInsert: {
            phoneId: phone._id,
            sourceTitle: phone.modelName,
            ram: variant.ram,
            storage: variant.storage,
            color: variant.color,
            condition: variant.condition,
            ptaStatus: variant.ptaStatus,
            warrantyType: variant.warrantyType,
            variantKey: variant.variantKey,
            enabled: true,
            verificationStatus: 'pending',
            discoveryOrigin: 'catalog',
            matchStrategy: 'url_model',
            matchConfidence: 80,
          } },
          { upsert: true },
        );
        if (update.upsertedCount) { discoveryLinked++; sourceAdded++; }
      }
      await PriceSource.updateOne({ _id: source._id }, {
        $set: {
          lastDiscoveryAt: new Date(), lastDiscoveryCount: result.urls.length,
          productsFound: result.urls.length, productsAdded: sourceAdded,
          lastError: (result.errors.join('; ') || (result.urls.length === 0 ? summarizeCatalogDiscoveryDiagnostics(result) : '')).slice(0, 1000),
        },
      });
    }
    const legacyPriceRows = await PhonePrice.find({
      phoneId: { $in: phones.map(phone => phone._id) },
      $or: [{ url: { $type: 'string', $ne: '' } }, { sourceUrl: { $type: 'string', $ne: '' } }],
    }).select('phoneId url sourceUrl storeName price ptaStatus warrantyType').lean();
    const legacyUrlsByPhone = new Map<string, Array<{ url: string; storeName: string; price: number; ptaStatus: string; warrantyType: string }>>();
    for (const row of legacyPriceRows) {
      const url = String(row.url || row.sourceUrl || '').trim();
      if (!url) continue;
      const key = row.phoneId.toString();
      const values = legacyUrlsByPhone.get(key) || [];
      values.push({ url, storeName: String(row.storeName || ''), price: Number(row.price || 0), ptaStatus: String(row.ptaStatus || ''), warrantyType: String(row.warrantyType || '') });
      legacyUrlsByPhone.set(key, values);
    }

    let linked = 0;
    let alreadyLinked = 0;
    let unmatched = 0;
    let rejectedHomepageUrls = 0;
    let missingProductUrls = 0;
    const examples: string[] = [];

    for (const phone of phones) {
      const candidates = [
        ...(String(phone.sourceUrl || '').trim() ? [{ url: String(phone.sourceUrl).trim(), storeName: '', price: 0, ptaStatus: '', warrantyType: '' }] : []),
        ...(legacyUrlsByPhone.get(phone._id.toString()) || []),
      ].filter((candidate, index, all) => all.findIndex(other => other.url === candidate.url) === index);

      if (candidates.length === 0) {
        missingProductUrls++;
        continue;
      }

      let phoneLinked = false;
      for (const candidate of candidates) {
        const sourceUrl = candidate.url;
        if (!isLikelyProductPageUrl(sourceUrl)) { rejectedHomepageUrls++; continue; }
        // Never auto-link a legacy/source URL merely because it already belongs
        // to this phone record. The URL itself must safely encode the same phone
        // identity. This blocks stale data such as model "14" pointing to a
        // 14-inch laptop category. Opaque/manual URLs can still be reviewed and
        // linked explicitly by an admin; automatic linking stays conservative.
        if (!matchProductUrlToPhone(sourceUrl, [phone])) {
          unmatched++;
          let unsafeHost = '';
          try { unsafeHost = new URL(sourceUrl).hostname.toLowerCase(); } catch { /* handled below */ }
          await PriceMatchCandidate.findOneAndUpdate(
            { phoneId: phone._id, sourceUrl },
            { $set: { hostname: unsafeHost, status: 'pending', reason: 'Retailer URL does not safely match this phone brand/model identity.', resolvedSourceId: null, resolvedAt: null } },
            { upsert: true, setDefaultsOnInsert: true },
          );
          if (examples.length < 5) examples.push(`${phone.modelName}: unsafe identity ${sourceUrl}`);
          continue;
        }
        let hostname = '';
        try { hostname = new URL(sourceUrl).hostname.toLowerCase(); } catch { unmatched++; continue; }
        const source = sources.find(item => (item.allowedDomains || []).some((domain: string) => {
          const clean = domain.trim().toLowerCase().replace(/^\./, '');
          return clean && (hostname === clean || hostname.endsWith(`.${clean}`));
        }));
        if (!source) {
          unmatched++;
          if (examples.length < 5) examples.push(`${phone.modelName}: ${hostname}`);
          await PriceMatchCandidate.findOneAndUpdate(
            { phoneId: phone._id, sourceUrl },
            { $set: { hostname, status: 'pending', reason: `No enabled trusted source covers ${hostname}.`, resolvedSourceId: null, resolvedAt: null } },
            { upsert: true, setDefaultsOnInsert: true },
          );
          continue;
        }
        const existing = await PhoneRetailListing.findOne({ phoneId: phone._id, sourceId: source._id, productUrl: sourceUrl }).select('_id').lean();
        if (existing) {
          alreadyLinked++; phoneLinked = true;
        } else {
          const variant = inferRetailVariantIdentity({
            title: candidate.storeName || phone.modelName,
            productUrl: sourceUrl,
            existing: { ptaStatus: candidate.ptaStatus, warrantyType: candidate.warrantyType, condition: 'new' },
          });
          await PhoneRetailListing.create({
            phoneId: phone._id, sourceId: source._id, productUrl: sourceUrl, sourceTitle: candidate.storeName || phone.modelName,
            currentSourcePrice: 0,
            pendingSourcePrice: candidate.price > 0 ? candidate.price : 0,
            pendingDetectedAt: candidate.price > 0 ? new Date() : null,
            ram: variant.ram,
            storage: variant.storage,
            color: variant.color,
            condition: variant.condition,
            ptaStatus: variant.ptaStatus,
            warrantyType: variant.warrantyType,
            variantKey: variant.variantKey,
            enabled: true,
            verificationStatus: 'pending',
            discoveryOrigin: candidate.storeName ? 'legacy' : 'phone',
            matchStrategy: 'manual',
            matchConfidence: candidate.storeName ? 90 : 85,
          });
          linked++; phoneLinked = true;
        }
        await PriceMatchCandidate.updateOne(
          { phoneId: phone._id, sourceUrl },
          { $set: { status: 'resolved', resolvedSourceId: source._id, resolvedAt: new Date() } },
        );
      }
      if (!phoneLinked && candidates.length > 0 && examples.length < 5) examples.push(`${phone.modelName}: no trusted product URL matched`);
    }

    await ActivityLog.create({
      adminId: admin._id,
      action: 'auto_link_price_listings',
      details: `Auto-linked ${linked} price listings; ${alreadyLinked} already linked; ${unmatched} unmatched.`,
      entityType: 'price_source',
    }).catch((error: unknown) => console.error('[ActivityLog:auto-link]', error));

    return NextResponse.json({
      success: true,
      scanned: phones.length,
      linked,
      alreadyLinked,
      unmatched,
      missingProductUrls,
      rejectedHomepageUrls,
      eligibleProductUrls: Math.max(0, phones.length - missingProductUrls - rejectedHomepageUrls),
      unmatchedExamples: examples,
      discovered,
      discoveryLinked,
      discoveryUnmatched,
      discoveryErrors: discoveryErrors.slice(0, 10),
      repairedUntestedListings: repairResult.modifiedCount,
      collectorBridge,
    });
  }

  // ---- /api/admin/price-tracker/match-queue/:id/ignore ----
  if (segments.length === 5 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'match-queue' && segments[4] === 'ignore') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const candidate = await PriceMatchCandidate.findByIdAndUpdate(
      segments[3],
      { $set: { status: 'ignored', resolvedAt: new Date() } },
      { new: true },
    );
    if (!candidate) return NextResponse.json({ error: 'Match candidate not found' }, { status: 404 });

    await ActivityLog.create({
      adminId: admin._id,
      action: 'ignore_price_match_candidate',
      details: `Ignored price source gap for ${candidate.hostname}.`,
      entityType: 'price_source',
      entityId: candidate._id.toString(),
    }).catch((error: unknown) => console.error('[ActivityLog:match-queue]', error));

    return NextResponse.json({ success: true, id: candidate._id.toString() });
  }

  // ---- /api/admin/price-tracker/bulk-overrides ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'bulk-overrides') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const phoneIds: string[] = Array.isArray(body.phoneIds)
      ? Array.from(
          new Set<string>(
            body.phoneIds
              .map((v: unknown) => String(v ?? '').trim())
              .filter((v: string) => v.length > 0),
          ),
        ).slice(0, 500)
      : [];
    const action = String(body.action || '');
    if (phoneIds.length === 0) return NextResponse.json({ error: 'Select at least one phone' }, { status: 400 });
    if (!['unlock', 'reset-to-auto'].includes(action)) return NextResponse.json({ error: 'Invalid bulk action' }, { status: 400 });
    let modified = 0;
    if (action === 'unlock') {
      const result = await PhonePrice.updateMany({ phoneId: { $in: phoneIds }, manualOverride: true, overrideLocked: true }, { $set: { overrideLocked: false } });
      modified = result.modifiedCount || 0;
    } else {
      const result = await PhonePrice.deleteMany({ phoneId: { $in: phoneIds }, manualOverride: true });
      modified = result.deletedCount || 0;
      for (const phoneId of phoneIds) await recomputeBestPriceForPhone(phoneId).catch(() => null);
    }
    await ActivityLog.create({ adminId: admin._id, action: `bulk_price_${action.replace(/-/g, '_')}`, details: `${action} on ${phoneIds.length} selected phones; ${modified} override records affected.`, entityType: 'phone', entityId: phoneIds[0] || '' }).catch(() => null);
    return NextResponse.json({ success: true, phones: phoneIds.length, modified });
  }

  // ---- /api/admin/price-tracker/update-price ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'update-price') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { phoneId, newPrice, regularPrice = 0, discountStartAt = '', discountEndAt = '', reason, ptaStatus, warrantyType, ram, storage, color, condition, market, currency, priceType, lockOverride = true } = body;

    if (!phoneId) return NextResponse.json({ error: 'phoneId is required' }, { status: 400 });
    if (!newPrice || newPrice <= 0 || typeof newPrice !== 'number') {
      return NextResponse.json({ error: 'newPrice must be a positive number' }, { status: 400 });
    }

    const phone = await Phone.findById(phoneId).populate('brandId', 'name');
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    const normalizedMarket = normalizePriceMarket(market);
    const normalizedCurrency = normalizePriceCurrency(currency, normalizedMarket);
    const normalizedPriceType = normalizeMarketPriceType({ market: normalizedMarket, priceType, ptaStatus: ptaStatus || phone.ptaStatus });
    if (normalizedMarket === 'PK' && normalizedPriceType === 'unknown') return NextResponse.json({ error: 'Choose PTA Approved or Non-PTA before saving a Pakistan price' }, { status: 400 });
    if (normalizedMarket === 'US' && normalizedCurrency !== 'USD') return NextResponse.json({ error: 'USA retail prices must be stored in USD' }, { status: 400 });
    if (normalizedMarket === 'PK' && normalizedCurrency !== 'PKR') return NextResponse.json({ error: 'Pakistan market prices must be stored in PKR' }, { status: 400 });
    const priceClass = normalizedPriceType;
    const normalizedRam = normalizeMemoryLabel(ram);
    const normalizedStorage = normalizeMemoryLabel(storage);
    const normalizedColor = String(color || '').trim();
    const normalizedCondition = String(condition || 'new').trim().toLowerCase();
    const normalizedWarranty = String(warrantyType || '').trim();
    const overrideVariantKey = buildPriceVariantKey({
      ram: normalizedRam, storage: normalizedStorage, color: normalizedColor,
      ptaStatus: priceClass, condition: normalizedCondition, warrantyType: normalizedWarranty,
      market: normalizedMarket, currency: normalizedCurrency, priceType: normalizedPriceType,
    });
    const existingOverride = await PhonePrice.findOne({
      phoneId: phone._id, storeName: 'Admin Override', market: normalizedMarket,
      currency: normalizedCurrency, variantKey: overrideVariantKey,
    }).lean();
    const oldPrice = Number(existingOverride?.price || (normalizedPriceType === 'us-retail'
      ? Number(phone.bestUsPriceUSD || 0)
      : normalizedPriceType === 'non-pta'
        ? Number(phone.bestNonPtaPricePKR || 0)
        : Number(phone.bestPtaPricePKR || phone.currentPrice || phone.pricePKR || 0)));
    const difference = newPrice - oldPrice;
    const percentageChange = oldPrice > 0 ? Math.round((difference / oldPrice) * 10000) / 100 : 0;

    let changeType: 'increase' | 'decrease' | 'unchanged' | 'correction' = 'unchanged';
    if (difference > 0) changeType = 'increase';
    else if (difference < 0) changeType = 'decrease';
    else if (oldPrice === 0 && newPrice > 0) changeType = 'correction';

    // Persist one authoritative admin override per exact market/variant identity.
    // Upsert prevents duplicate rows when an admin corrects the same variant again.
    await PhonePrice.findOneAndUpdate(
      { phoneId: phone._id, storeName: 'Admin Override', market: normalizedMarket, currency: normalizedCurrency, variantKey: overrideVariantKey },
      { $set: {
        price: newPrice, regularPrice: Number(regularPrice || 0), discountStartAt: discountStartAt || null, discountEndAt: discountEndAt || null, url: '', sourceUrl: '', inStock: true,
        market: normalizedMarket, currency: normalizedCurrency, priceType: normalizedPriceType,
        ptaStatus: normalizedPriceType === 'pta-approved' ? 'PTA Approved' : normalizedPriceType === 'non-pta' ? 'Non-PTA' : '',
        ram: normalizedRam, storage: normalizedStorage, color: normalizedColor, condition: normalizedCondition, warrantyType: normalizedWarranty,
        variantKey: overrideVariantKey, validityStatus: 'valid', manualOverride: true, overrideLocked: Boolean(lockOverride),
        overrideReason: String(reason || '').trim().slice(0, 500),
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Update Phone document
    const updates: Record<string, unknown> = {
      lastPriceChangedAt: new Date(),
      lastPriceCheckedAt: new Date(),
      ...(normalizedPriceType === 'us-retail' ? { bestUsPriceUSD: newPrice } : normalizedPriceType === 'pta-approved' ? { bestPtaPricePKR: newPrice } : { bestNonPtaPricePKR: newPrice }),
    };
    const phoneClass = normalizePtaPriceClass(phone.ptaStatus, phone.ptaApproved);
    if (normalizedMarket === 'PK' && priceClass === phoneClass) {
      updates.currentPrice = newPrice;
      updates.previousPrice = oldPrice;
      updates.priceChange = difference;
      updates.percentageChange = percentageChange;
      updates.pricePKR = newPrice;
    }

    // Track lowest/highest
    if (normalizedMarket === 'PK' && priceClass === phoneClass) {
      const lowest = phone.lowestPrice || 0;
      const highest = phone.highestPrice || 0;
      if (newPrice < lowest || lowest === 0) updates.lowestPrice = newPrice;
      if (newPrice > highest) updates.highestPrice = newPrice;
    }

    // `ptaStatus` here classifies this price variant; it must not mutate the phone's canonical PTA status.
    if (warrantyType) updates.warrantyType = warrantyType;

    await Phone.findByIdAndUpdate(phoneId, { $set: updates });

    // Create PriceTrackerHistory record
    try {
      await PriceTrackerHistory.create({
        phoneId: phone._id,
        oldPrice,
        newPrice,
        difference,
        percentageChange,
        changeType,
        sourceType: 'manual',
        changedByAdminId: admin._id,
        verificationStatus: 'confirmed',
        priceClass,
        market: normalizedMarket,
        currency: normalizedCurrency,
        priceType: normalizedPriceType,
        ram: normalizedRam,
        storage: normalizedStorage,
        color: normalizedColor,
        condition: normalizedCondition,
        warrantyType: normalizedWarranty,
        variantKey: overrideVariantKey,
        capturedAt: new Date(),
      });
    } catch (e) { console.error('[PriceTrackerHistory]', e); }

    // Create legacy PriceHistory record for backward compat
    if (normalizedMarket === 'PK') {
      try { await PriceHistory.create({ phoneId: phone._id, storeName: null, price: newPrice }); }
      catch (e) { console.error('[PriceHistory]', e); }
    }

    // Create ActivityLog
    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_price',
        details: `${changeType === 'unchanged' ? 'Set' : changeType === 'increase' ? 'Increased' : changeType === 'decrease' ? 'Decreased' : 'Corrected'} ${normalizedMarket}/${normalizedPriceType} price for ${phone.modelName}: ${normalizedCurrency} ${oldPrice.toLocaleString()} → ${normalizedCurrency} ${newPrice.toLocaleString()}${reason ? ` (${reason})` : ''}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    // Targeted cache revalidation
    revalidatePricePages(phone.slug);

    const updated = await Phone.findById(phoneId).lean() as LeanPhoneMini | null;
    return NextResponse.json({
      success: true,
      id: phone._id?.toString(),
      currentPrice: updated?.currentPrice || newPrice,
      previousPrice: updated?.previousPrice || oldPrice,
      difference,
      percentageChange,
      changeType,
      overrideLocked: Boolean(lockOverride),
      variantKey: overrideVariantKey,
    });
  }

  // ---- /api/admin/price-tracker/reset-override ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'reset-override') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();
    const body = await req.json();
    const { phoneId, market, currency, priceType, ptaStatus, ram, storage, color, condition, warrantyType } = body;
    if (!phoneId) return NextResponse.json({ error: 'phoneId is required' }, { status: 400 });
    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    const normalizedMarket = normalizePriceMarket(market);
    const normalizedCurrency = normalizePriceCurrency(currency, normalizedMarket);
    const normalizedPriceType = normalizeMarketPriceType({ market: normalizedMarket, priceType, ptaStatus });
    const variantKey = buildPriceVariantKey({ ram, storage, color, ptaStatus: normalizedPriceType, condition, warrantyType, market: normalizedMarket, currency: normalizedCurrency, priceType: normalizedPriceType });
    const removed = await PhonePrice.findOneAndDelete({ phoneId: phone._id, storeName: 'Admin Override', market: normalizedMarket, currency: normalizedCurrency, variantKey, manualOverride: true });
    const recomputed = await recomputeBestPriceForPhone(phoneId);
    try { await ActivityLog.create({ adminId: admin._id, action: 'reset_price_override', details: `Reset ${normalizedMarket}/${normalizedPriceType} manual override for ${phone.modelName}${removed ? '' : ' (no override existed)'}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    revalidatePricePages(phone.slug);
    return NextResponse.json({ success: true, removed: Boolean(removed), variantKey, recomputed });
  }

  // ---- /api/admin/price-tracker/sources ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { name, sourceType, baseUrl, verificationUrl, allowedDomains, priority, discoveryEnabled, discoveryMode, catalogUrls, sitemapUrls, feedUrl, syncFrequency, market, currency, defaultPriceType } = body;

    if (!name || !name.trim()) return NextResponse.json({ error: 'Source name is required' }, { status: 400 });
    if (sourceType !== undefined && !PRICE_SOURCE_TYPES.has(sourceType)) {
      return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await PriceSource.findOne({ name: name.trim() });
    if (existing) return NextResponse.json({ error: 'Source name already exists' }, { status: 409 });

    let normalizedBaseUrl = '';
    try { normalizedBaseUrl = normalizeSourceBaseUrl(baseUrl); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid base URL' }, { status: 400 }); }
    const normalizedDomains = normalizeAllowedDomains(allowedDomains, normalizedBaseUrl);
    const normalizedPriority = Number(priority ?? 0);
    if (!Number.isFinite(normalizedPriority) || normalizedPriority < 0 || normalizedPriority > 100) {
      return NextResponse.json({ error: 'Priority must be between 0 and 100' }, { status: 400 });
    }

    const source = await PriceSource.create({
      name: name.trim(),
      sourceType: sourceType || 'retailer',
      market: normalizePriceMarket(market),
      currency: normalizePriceCurrency(currency, market),
      defaultPriceType: normalizeMarketPriceType({ market, priceType: defaultPriceType }),
      baseUrl: normalizedBaseUrl,
      verificationUrl: typeof verificationUrl === 'string' ? verificationUrl.trim() : '',
      discoveryEnabled: Boolean(discoveryEnabled),
      discoveryMode: ['manual', 'sitemap', 'catalog', 'feed', 'api'].includes(String(discoveryMode)) ? discoveryMode : 'manual',
      catalogUrls: Array.isArray(catalogUrls) ? catalogUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 20) : [],
      sitemapUrls: Array.isArray(sitemapUrls) ? sitemapUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 20) : [],
      feedUrl: typeof feedUrl === 'string' ? feedUrl.trim() : '',
      syncFrequency: ['manual', 'hourly', 'daily', 'weekly'].includes(String(syncFrequency)) ? syncFrequency : 'daily',
      allowedDomains: normalizedDomains,
      priority: normalizedPriority,
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'create_price_source',
        details: `Created price source: ${name.trim()}`,
        entityType: 'price_source',
        entityId: source._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({
      success: true,
      id: source._id?.toString(),
      name: source.name,
      sourceType: source.sourceType,
      market: source.market,
      currency: source.currency,
      defaultPriceType: source.defaultPriceType,
      enabled: source.enabled,
      trusted: source.trusted,
    });
  }

  // ---- /api/admin/price-tracker/listings ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { phoneId, sourceId, productUrl, ram, storage, color, condition, ptaStatus, warrantyType, priceType } = body;

    if (!phoneId) return NextResponse.json({ error: 'phoneId is required' }, { status: 400 });
    if (!sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    if (!productUrl) return NextResponse.json({ error: 'productUrl is required' }, { status: 400 });

    // Validate URL: must be HTTPS
    if (!productUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'productUrl must use HTTPS' }, { status: 400 });
    }
    // No localhost
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(productUrl)) {
      return NextResponse.json({ error: 'productUrl must not point to localhost' }, { status: 400 });
    }
    // No private IPs
    if (/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/.test(productUrl)) {
      return NextResponse.json({ error: 'productUrl must not use private IP addresses' }, { status: 400 });
    }

    // Verify phone exists
    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    // Verify source exists and get allowed domains
    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    // Validate domain is in source's allowedDomains
    let urlDomain = '';
    try {
      urlDomain = new URL(productUrl).hostname;
    } catch {
      return NextResponse.json({ error: 'Invalid productUrl' }, { status: 400 });
    }

    if (source.allowedDomains && source.allowedDomains.length > 0) {
      const domainAllowed = source.allowedDomains.some((d: string) => {
        const clean = d.replace(/^\./, '');
        return urlDomain === clean || urlDomain.endsWith('.' + clean);
      });
      if (!domainAllowed) {
        return NextResponse.json({ error: `Domain "${urlDomain}" is not in the source's allowed domains` }, { status: 400 });
      }
    }

    const listingMarket = normalizePriceMarket(source.market);
    const listingCurrency = normalizePriceCurrency(source.currency, listingMarket);
    const listingPriceType = normalizeMarketPriceType({ market: listingMarket, priceType: priceType || source.defaultPriceType, ptaStatus });
    if (listingMarket === 'PK' && listingPriceType === 'unknown') {
      return NextResponse.json({ error: 'Choose PTA Approved or Non-PTA for a Pakistan listing' }, { status: 400 });
    }
    const initialVariant = inferRetailVariantIdentity({
      productUrl,
      existing: { ram, storage, color, condition, ptaStatus, warrantyType, market: listingMarket, currency: listingCurrency, priceType: listingPriceType },
    });

    const duplicate = await PhoneRetailListing.findOne({
      sourceId,
      $or: [
        { productUrl },
        { phoneId, productUrl },
      ],
    }).select('_id phoneId').lean();
    if (duplicate) {
      return NextResponse.json(
        { error: 'This retailer URL is already linked to a phone for this source.' },
        { status: 409 },
      );
    }

    let verificationStatus: 'pending' | 'verified' = 'pending';
    let detectedPrice = 0;
    let sourceTitle = '';
    let availability: 'available' | 'unavailable' | 'unknown' = 'unknown';
    let extractionMethod = '';
    let extractionConfidence = 0;
    let verificationMessage = source.trusted
      ? 'The product page could not be verified automatically. Review it before enabling automatic checks.'
      : 'Source is not trusted yet. Test and trust the source before automatic checks.';

    if (source.trusted && source.enabled && source.status === 'active') {
      const safety = await validateUrlForFetch(productUrl, source.allowedDomains || []);
      if (safety.safe) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12_000);
          const response = await fetch(productUrl, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent': 'SpecsDekh-PriceChecker/1.0 (compatible; bot)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          clearTimeout(timeout);
          if (response.ok) {
            const html = await response.text();
            const phoneIdentity = phone as unknown as { modelName?: string; brandName?: string; brandId?: { name?: string } | null; ptaStatus?: string };
            const validation = validateRetailListingPage({
              html,
              phoneModel: phoneIdentity.modelName || '',
              brandName: phoneIdentity.brandId?.name || phoneIdentity.brandName || '',
              expectedRam: ram || '',
              expectedStorage: storage || '',
              expectedPtaStatus: listingMarket === 'PK' ? (ptaStatus || phoneIdentity.ptaStatus || '') : '',
            });
            const extracted = extractRetailPrice(html, listingCurrency);
            sourceTitle = validation.title;
            detectedPrice = extracted?.price || 0;
            extractionMethod = extracted?.method || '';
            extractionConfidence = extracted?.confidence || 0;
            availability = /out\s*of\s*stock|unavailable|sold\s*out/i.test(html)
              ? 'unavailable'
              : /add\s*to\s*cart|buy\s*now|in\s*stock|available/i.test(html)
                ? 'available'
                : 'unknown';
            if (validation.valid && detectedPrice > 0) {
              verificationStatus = 'verified';
              verificationMessage = 'Product page verified and ready for automatic price checks.';
            } else {
              verificationMessage = validation.reasons.join('; ') || `No reliable ${listingCurrency} price was detected.`;
            }
          } else {
            verificationMessage = `Retailer returned HTTP ${response.status}.`;
          }
        } catch (error) {
          verificationMessage = error instanceof Error ? error.message : 'Product page verification failed.';
        }
      } else {
        verificationMessage = safety.reason || 'Product URL failed safety validation.';
      }
    }

    const listing = await PhoneRetailListing.create({
      phoneId,
      sourceId,
      productUrl,
      ram: initialVariant.ram,
      storage: initialVariant.storage,
      color: initialVariant.color,
      condition: initialVariant.condition,
      variantKey: initialVariant.variantKey,
      ptaStatus: initialVariant.ptaStatus,
      warrantyType: initialVariant.warrantyType,
      market: initialVariant.market,
      currency: initialVariant.currency,
      priceType: initialVariant.priceType,
      sourceTitle,
      currentSourcePrice: detectedPrice,
      availability,
      verificationStatus,
      lastCheckedAt: source.trusted ? new Date() : null,
      lastSuccessAt: verificationStatus === 'verified' ? new Date() : null,
      extractionMethod,
      extractionConfidence,
      lastError: verificationStatus === 'verified' ? '' : verificationMessage,
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'create_retail_listing',
        details: `Added retail listing for ${phone.modelName} from ${source.name}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({
      success: true,
      id: listing._id?.toString(),
      verificationStatus: listing.verificationStatus,
      detectedPrice,
      market: listingMarket,
      currency: listingCurrency,
      priceType: listingPriceType,
      availability,
      message: verificationMessage,
    });
  }

  // ---- /api/admin/price-tracker/test-source ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'test-source') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const url = String(body.url || '').trim();
    const sourceId = String(body.sourceId || '').trim();
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    const source = sourceId ? await PriceSource.findById(sourceId).lean() as unknown as LeanSourceDoc | null : null;
    const testMarket = normalizePriceMarket(source?.market);
    const testCurrency = normalizePriceCurrency(source?.currency, testMarket);
    const expectedDomains = Array.isArray(source?.allowedDomains)
      ? source.allowedDomains.map((domain: string) => domain.replace(/^\./, '').toLowerCase()).filter(Boolean)
      : [];

    let domainAllowed = true;
    try {
      const urlDomain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (expectedDomains.length > 0) {
        domainAllowed = expectedDomains.some((domain: string) => {
          const clean = domain.replace(/^www\./, '');
          return urlDomain === clean || urlDomain.endsWith('.' + clean);
        });
      }
    } catch {
      domainAllowed = false;
    }
    if (!domainAllowed) {
      return NextResponse.json({
        reachable: false, title: null, detectedPrice: null, availability: 'unknown', matched: false,
        safeToEnable: false, extractionMethod: null, extractionConfidence: 0,
        error: `Wrong domain. Use a real product page from ${expectedDomains.join(' or ') || 'this source domain'}.`,
        httpStatus: null, finalUrl: url, contentType: '', fetchDurationMs: 0, failureType: 'unsafe_url', responsePreview: '',
      });
    }

    const fetchResult = await fetchRetailerPage(url, expectedDomains, { timeoutMs: 25_000 });
    let title = '';
    let detectedPrice: number | null = null;
    let availability = 'unknown';
    let extractionMethod: string | null = null;
    let extractionConfidence = 0;

    if (fetchResult.ok) {
      const titleMatch = fetchResult.html.match(/<title[^>]*>([^<]+)<\/title>/i)
        || fetchResult.html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      title = titleMatch?.[1]?.trim().slice(0, 200) || '';
      const extracted = extractRetailPrice(fetchResult.html, testCurrency);
      detectedPrice = extracted?.price ?? null;
      extractionMethod = extracted?.method ?? null;
      extractionConfidence = extracted?.confidence ?? 0;
      availability = /out\s*of\s*stock|unavailable|sold\s*out/i.test(fetchResult.html)
        ? 'unavailable'
        : /add\s*to\s*cart|buy\s*now|in\s*stock|available/i.test(fetchResult.html)
          ? 'available'
          : 'unknown';
    }

    const MIN_TRUST_CONFIDENCE = 0.70;
    const matched = detectedPrice !== null && extractionConfidence >= MIN_TRUST_CONFIDENCE;
    const safeToEnable = fetchResult.ok && matched && availability !== 'unavailable';
    const challengeBlocked = fetchResult.failureType === 'challenge' || fetchResult.failureType === 'rate_limit';
    const validationError = safeToEnable
      ? ''
      : fetchResult.error
        || (detectedPrice === null
          ? `No ${testCurrency} price was detected on this product page.`
          : extractionConfidence < MIN_TRUST_CONFIDENCE
            ? `Price confidence is too low (${Math.round(extractionConfidence * 100)}%).`
            : availability === 'unavailable'
              ? 'Product is currently unavailable.'
              : 'Source validation failed.');

    if (sourceId && source) {
      const diagnostics = {
        lastCheckedAt: new Date(),
        lastHttpStatus: fetchResult.status,
        lastFailureType: fetchResult.failureType === 'none' ? '' : fetchResult.failureType,
        lastFetchDurationMs: fetchResult.durationMs,
        lastFinalUrl: fetchResult.finalUrl,
        lastResponsePreview: fetchResult.preview,
      };
      if (safeToEnable) {
        await PriceSource.findByIdAndUpdate(sourceId, {
          $set: {
            ...diagnostics,
            verificationUrl: url,
            trusted: true,
            enabled: true,
            automaticFetchEnabled: true,
            accessMode: 'direct',
            lastSuccessAt: new Date(),
            failureCount: 0,
            nextRetryAt: null,
            lastError: '',
            status: 'active',
          },
        });
      } else if (challengeBlocked) {
        // An anti-bot block is a source capability, not a dead URL. Keep the
        // source visible and trusted state unchanged, but disable automatic
        // server-side fetching so cron does not waste CPU retrying it.
        await PriceSource.findByIdAndUpdate(sourceId, {
          $set: {
            ...diagnostics,
            accessMode: 'challenge_blocked',
            automaticFetchEnabled: false,
            nextRetryAt: new Date(Date.now() + 24 * 60 * 60_000),
            lastError: validationError,
            status: 'active',
          },
        });
      } else {
        const nextFailureCount = Number(source.failureCount || 0) + 1;
        const retryDelayMinutes = Math.min(24 * 60, 15 * (2 ** Math.min(nextFailureCount - 1, 6)));
        await PriceSource.findByIdAndUpdate(sourceId, {
          $set: {
            ...diagnostics,
            accessMode: 'direct',
            automaticFetchEnabled: true,
            nextRetryAt: new Date(Date.now() + retryDelayMinutes * 60_000),
            lastError: validationError,
            status: nextFailureCount >= 3 ? 'failed' : 'active',
          },
          $inc: { failureCount: 1 },
        });
      }
    }

    return NextResponse.json({
      reachable: fetchResult.reachable,
      title: title || null,
      detectedPrice,
      availability,
      matched,
      safeToEnable,
      extractionMethod,
      extractionConfidence,
      error: safeToEnable ? null : validationError,
      httpStatus: fetchResult.status,
      finalUrl: fetchResult.finalUrl,
      contentType: fetchResult.contentType,
      fetchDurationMs: fetchResult.durationMs,
      failureType: fetchResult.failureType,
      responsePreview: fetchResult.preview,
      accessMode: challengeBlocked ? 'challenge_blocked' : safeToEnable ? 'direct' : source?.accessMode || 'direct',
      automaticFetchEnabled: challengeBlocked ? false : safeToEnable ? true : source?.automaticFetchEnabled !== false,
    });
  }

  // ---- /api/admin/price-tracker/review (unified approve/reject from admin UI) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'review') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { changeId, action } = body;
    if (!changeId || !action) return NextResponse.json({ error: 'changeId and action are required' }, { status: 400 });
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

    const history = await PriceTrackerHistory.findById(changeId);
    if (!history) return NextResponse.json({ error: 'History record not found' }, { status: 404 });
    if (history.verificationStatus !== 'pending') {
      return NextResponse.json({ error: `History record is already ${history.verificationStatus}` }, { status: 400 });
    }

    history.verificationStatus = action === 'approve' ? 'confirmed' : 'rejected';
    history.approvedByAdminId = admin._id;
    await history.save();

    if (action === 'approve') {
      await resolvePendingRetailOffer({
        phoneId: history.phoneId.toString(),
        sourceId: history.sourceId?.toString(),
        sourceUrl: history.sourceUrl,
        newPrice: history.newPrice,
        approved: true,
      });
    } else {
      await resolvePendingRetailOffer({
        phoneId: history.phoneId.toString(),
        sourceId: history.sourceId?.toString(),
        sourceUrl: history.sourceUrl,
        newPrice: history.newPrice,
        approved: false,
      });
    }

    try {
      const phoneDoc = await Phone.findById(history.phoneId).select('modelName').lean() as LeanPhoneMini | null;
      await ActivityLog.create({
        adminId: admin._id,
        action: action === 'approve' ? 'approve_price_change' : 'reject_price_change',
        details: `${action === 'approve' ? 'Approved' : 'Rejected'} price change for ${phoneDoc?.modelName || 'unknown'}: PKR ${history.oldPrice} → PKR ${history.newPrice}`,
        entityType: 'phone', entityId: history.phoneId?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    // Targeted cache revalidation on approve
    if (action === 'approve') {
      const phoneForReval = await Phone.findById(history.phoneId).select('slug').lean() as { slug?: string } | null;
      revalidatePricePages(phoneForReval?.slug);
    }

    return NextResponse.json({ success: true, id: history._id?.toString(), verificationStatus: history.verificationStatus });
  }

  // ---- /api/admin/price-tracker/approve/:historyId (direct approve) ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'approve') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const historyId = segments[3];
    if (!historyId) return NextResponse.json({ error: 'History ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.findById(historyId);
    if (!history) return NextResponse.json({ error: 'History record not found' }, { status: 404 });
    if (history.verificationStatus !== 'pending') {
      return NextResponse.json({ error: `History record is already ${history.verificationStatus}` }, { status: 400 });
    }

    history.verificationStatus = 'confirmed';
    history.approvedByAdminId = admin._id;
    await history.save();

    await resolvePendingRetailOffer({
      phoneId: history.phoneId.toString(),
      sourceId: history.sourceId?.toString(),
      sourceUrl: history.sourceUrl,
      newPrice: history.newPrice,
      approved: true,
    });
    const phone = await Phone.findById(history.phoneId);

    try {
      const phoneDoc = (phone || await Phone.findById(history.phoneId).select('modelName').lean()) as { modelName?: string } | null;
      await ActivityLog.create({
        adminId: admin._id,
        action: 'approve_price_change',
        details: `Approved price change for ${phoneDoc?.modelName || 'unknown'}: PKR ${history.oldPrice} → PKR ${history.newPrice}`,
        entityType: 'phone',
        entityId: history.phoneId?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    // Targeted cache revalidation
    revalidatePricePages(phone?.slug);

    return NextResponse.json({ success: true, id: history._id?.toString(), verificationStatus: 'confirmed' });
  }

  // ---- /api/admin/price-tracker/reject/:historyId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'reject') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const historyId = segments[3];
    if (!historyId) return NextResponse.json({ error: 'History ID required' }, { status: 400 });

    const history = await PriceTrackerHistory.findById(historyId);
    if (!history) return NextResponse.json({ error: 'History record not found' }, { status: 404 });
    if (history.verificationStatus !== 'pending') {
      return NextResponse.json({ error: `History record is already ${history.verificationStatus}` }, { status: 400 });
    }

    history.verificationStatus = 'rejected';
    history.approvedByAdminId = admin._id;
    await history.save();
    await resolvePendingRetailOffer({
      phoneId: history.phoneId.toString(),
      sourceId: history.sourceId?.toString(),
      sourceUrl: history.sourceUrl,
      newPrice: history.newPrice,
      approved: false,
    });

    try {
      const phoneDoc = await Phone.findById(history.phoneId).select('modelName').lean() as LeanPhoneMini | null;
      await ActivityLog.create({
        adminId: admin._id,
        action: 'reject_price_change',
        details: `Rejected price change for ${phoneDoc?.modelName || 'unknown'}: PKR ${history.oldPrice} → PKR ${history.newPrice}`,
        entityType: 'phone',
        entityId: history.phoneId?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: history._id?.toString(), verificationStatus: 'rejected' });
  }

  // ---- /api/admin/price-tracker/toggle-lock/:phoneId ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'toggle-lock') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const body = await req.json();
    const { lock, reason } = body;

    if (typeof lock !== 'boolean') return NextResponse.json({ error: 'lock must be a boolean' }, { status: 400 });

    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    await Phone.findByIdAndUpdate(phoneId, {
      $set: {
        manualLock: lock,
        manualLockReason: lock ? (reason || '').trim().slice(0, 500) : '',
      },
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: lock ? 'lock_price' : 'unlock_price',
        details: `${lock ? 'Locked' : 'Unlocked'} price for ${phone.modelName}${lock && reason ? `: ${reason}` : ''}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, manualLock: lock });
  }

  // ---- /api/admin/price-tracker/sources/:id/toggle ----
  if (segments.length === 5 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources' && segments[4] === 'toggle') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const sourceId = segments[3];
    if (!sourceId) return NextResponse.json({ error: 'Source ID required' }, { status: 400 });

    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const newStatus = source.status === 'active' ? 'paused' : 'active';
    const newEnabled = newStatus === 'active';

    await PriceSource.findByIdAndUpdate(sourceId, {
      $set: { status: newStatus, enabled: newEnabled },
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: newStatus === 'active' ? 'activate_price_source' : 'pause_price_source',
        details: `${newStatus === 'active' ? 'Activated' : 'Paused'} price source: ${source.name}`,
        entityType: 'price_source',
        entityId: sourceId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, status: newStatus, enabled: newEnabled });
  }

  // ---- /api/admin/price-tracker/phones/:phoneId/toggle (5 segments) ----
  if (segments.length === 5 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'phones' && segments[4] === 'toggle') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const phoneId = segments[3];
    if (!phoneId) return NextResponse.json({ error: 'Phone ID required' }, { status: 400 });

    const phone = await Phone.findById(phoneId);
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });

    const currentlyAutomatic = phone.priceMode === 'automatic' && phone.manualLock !== true;

    if (!currentlyAutomatic) {
      const trustedSourceIds = await PriceSource.distinct('_id', {
        trusted: true,
        enabled: true,
        status: 'active',
      });
      const eligibleListing = await PhoneRetailListing.exists({
        phoneId,
        enabled: true,
        verificationStatus: 'verified',
        sourceId: { $in: trustedSourceIds },
      });
      if (!eligibleListing) {
        return NextResponse.json({
          error: 'Auto-tracking needs a verified product page from an enabled trusted source. Run Auto-link catalog, then Run sync now to verify it, and try again.',
        }, { status: 409 });
      }
    }

    const nextMode = currentlyAutomatic ? 'manual' : 'automatic';
    const newLock = nextMode === 'manual';
    await Phone.findByIdAndUpdate(phoneId, {
      $set: {
        priceMode: nextMode,
        manualLock: newLock,
        manualLockReason: newLock ? 'Switched to manual from Price Tracker' : '',
      },
    });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: newLock ? 'disable_automatic_price' : 'enable_automatic_price',
        details: `${newLock ? 'Disabled' : 'Enabled'} automatic price tracking for ${phone.modelName}`,
        entityType: 'phone',
        entityId: phone._id?.toString(),
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, manualLock: newLock, mode: nextMode });
  }

  // ---- /api/admin/price-tracker/phones/enable-eligible ----
  // Bulk-enables only phones that already have an enabled listing backed by a
  // trusted active source. Explicit manual locks are respected.
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'phones' && segments[3] === 'enable-eligible') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const trustedSourceIds = await PriceSource.distinct('_id', {
      trusted: true,
      enabled: true,
      status: 'active',
    });
    const eligiblePhoneIds = trustedSourceIds.length > 0
      ? await PhoneRetailListing.distinct('phoneId', {
          sourceId: { $in: trustedSourceIds },
          enabled: true,
          verificationStatus: 'verified',
        })
      : [];
    const eligiblePublished = await Phone.countDocuments({
      _id: { $in: eligiblePhoneIds },
      active: true,
      status: 'published',
    });
    const skippedLocked = await Phone.countDocuments({
      _id: { $in: eligiblePhoneIds },
      active: true,
      status: 'published',
      manualLock: true,
    });
    const alreadyEnabled = await Phone.countDocuments({
      _id: { $in: eligiblePhoneIds },
      active: true,
      status: 'published',
      manualLock: { $ne: true },
      priceMode: 'automatic',
    });
    const result = await Phone.updateMany({
      _id: { $in: eligiblePhoneIds },
      active: true,
      status: 'published',
      manualLock: { $ne: true },
      priceMode: { $ne: 'automatic' },
    }, {
      $set: { priceMode: 'automatic', manualLock: false, manualLockReason: '' },
    });

    await ActivityLog.create({
      adminId: admin._id,
      action: 'bulk_enable_automatic_prices',
      details: `Enabled automatic tracking for ${result.modifiedCount} linked phones; ${skippedLocked} manual locks preserved.`,
      entityType: 'phone',
    }).catch((error) => console.error('[ActivityLog]', error));

    return NextResponse.json({
      success: true,
      eligible: eligiblePublished,
      enabled: result.modifiedCount,
      alreadyEnabled,
      skippedLocked,
    });
  }

  return undefined;
}

// ============ PRICE TRACKER PUT ============

export async function handlePriceTrackerPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/sources/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const sourceId = segments[3];
    if (!sourceId) return NextResponse.json({ error: 'Source ID required' }, { status: 400 });

    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    const body = await req.json();
    const { name, sourceType, baseUrl, verificationUrl, allowedDomains, priority, enabled, trusted, status, notes, discoveryEnabled, discoveryMode, catalogUrls, sitemapUrls, feedUrl, syncFrequency, market, currency, defaultPriceType } = body;

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'Source name cannot be empty' }, { status: 400 });
      // Check uniqueness if name is changing
      if (name.trim() !== source.name) {
        const existing = await PriceSource.findOne({ name: name.trim(), _id: { $ne: sourceId } });
        if (existing) return NextResponse.json({ error: 'Source name already exists' }, { status: 409 });
      }
      updates.name = name.trim();
    }
    if (sourceType !== undefined) {
      if (!PRICE_SOURCE_TYPES.has(sourceType)) return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
      updates.sourceType = sourceType;
    }
    let normalizedBaseUrl = source.baseUrl || '';
    if (baseUrl !== undefined) {
      try { normalizedBaseUrl = normalizeSourceBaseUrl(baseUrl); }
      catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid base URL' }, { status: 400 }); }
      updates.baseUrl = normalizedBaseUrl;
    }
    if (allowedDomains !== undefined || baseUrl !== undefined) {
      updates.allowedDomains = normalizeAllowedDomains(allowedDomains !== undefined ? allowedDomains : source.allowedDomains, normalizedBaseUrl);
    }
    if (verificationUrl !== undefined) {
      const candidate = String(verificationUrl || '').trim();
      if (candidate) {
        let parsed: URL;
        try { parsed = new URL(candidate); }
        catch { return NextResponse.json({ error: 'Verification product URL is invalid', field: 'verificationUrl', code: 'INVALID_VERIFICATION_URL' }, { status: 400 }); }
        if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'Verification product URL must use HTTPS', field: 'verificationUrl', code: 'VERIFICATION_URL_REQUIRES_HTTPS' }, { status: 400 });
        const cleanHost = parsed.hostname.replace(/^www\./, '');
        const allowed = normalizeAllowedDomains(allowedDomains !== undefined ? allowedDomains : source.allowedDomains, normalizedBaseUrl);
        if (allowed.length > 0 && !allowed.some((domain: string) => cleanHost === domain || cleanHost.endsWith(`.${domain}`))) {
          return NextResponse.json({
            error: `Verification URL must belong to ${allowed.join(' or ')}. Current URL belongs to ${cleanHost}.`,
            field: 'verificationUrl',
            code: 'VERIFICATION_DOMAIN_NOT_ALLOWED',
            currentDomain: cleanHost,
            allowedDomains: allowed,
          }, { status: 400 });
        }
      }
      const normalizedVerificationUrl = candidate ? new URL(candidate).toString() : '';
      updates.verificationUrl = normalizedVerificationUrl;
      // A changed verification target must be tested again before the source remains trusted.
      if (normalizedVerificationUrl !== String(source.verificationUrl || '')) {
        updates.trusted = false;
        updates.lastError = normalizedVerificationUrl ? 'Verification URL changed; run Test & trust again.' : '';
      }
    }
    if (priority !== undefined) {
      const normalizedPriority = Number(priority);
      if (!Number.isFinite(normalizedPriority) || normalizedPriority < 0 || normalizedPriority > 100) {
        return NextResponse.json({ error: 'Priority must be between 0 and 100' }, { status: 400 });
      }
      updates.priority = normalizedPriority;
    }
    if (market !== undefined) updates.market = normalizePriceMarket(market);
    if (currency !== undefined || market !== undefined) updates.currency = normalizePriceCurrency(currency !== undefined ? currency : source.currency, market !== undefined ? market : source.market);
    if (defaultPriceType !== undefined || market !== undefined) updates.defaultPriceType = normalizeMarketPriceType({ market: market !== undefined ? market : source.market, priceType: defaultPriceType !== undefined ? defaultPriceType : source.defaultPriceType });
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof trusted === 'boolean') updates.trusted = trusted;
    if (status !== undefined && ['active', 'paused', 'failed'].includes(status)) {
      updates.status = status;
      updates.enabled = status === 'active';
    }
    if (typeof discoveryEnabled === 'boolean') updates.discoveryEnabled = discoveryEnabled;
    if (discoveryMode !== undefined && ['manual', 'sitemap', 'catalog', 'feed', 'api'].includes(String(discoveryMode))) updates.discoveryMode = discoveryMode;
    if (catalogUrls !== undefined) updates.catalogUrls = Array.isArray(catalogUrls) ? catalogUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 20) : [];
    if (sitemapUrls !== undefined) updates.sitemapUrls = Array.isArray(sitemapUrls) ? sitemapUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 20) : [];
    if (feedUrl !== undefined) updates.feedUrl = String(feedUrl || '').trim().slice(0, 2000);
    if (syncFrequency !== undefined && ['manual', 'hourly', 'daily', 'weekly'].includes(String(syncFrequency))) updates.syncFrequency = syncFrequency;
    if (notes !== undefined) updates.notes = (notes || '').trim().slice(0, 1000);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updatedSource = await PriceSource.findByIdAndUpdate(sourceId, { $set: updates }, { new: true });
    if (market !== undefined || currency !== undefined || defaultPriceType !== undefined) {
      await PhoneRetailListing.updateMany({ sourceId }, { $set: { market: updatedSource?.market || 'PK', currency: updatedSource?.currency || 'PKR', priceType: updatedSource?.defaultPriceType || 'unknown', verificationStatus: 'pending', variantKey: '', lastError: 'Source market/currency changed; listing must be re-verified.' } });
    }

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_price_source',
        details: `Updated price source: ${source.name}`,
        entityType: 'price_source',
        entityId: sourceId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: sourceId, message: 'Price source updated successfully', source: updatedSource });
  }

  // ---- /api/admin/price-tracker/listings/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const listingId = segments[3];
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const listing = await PhoneRetailListing.findById(listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    const body = await req.json();
    const { productUrl, ram, storage, color, condition, ptaStatus, warrantyType, enabled, verificationStatus } = body;

    const updates: Record<string, unknown> = {};

    if (productUrl !== undefined) {
      if (!productUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'productUrl must use HTTPS' }, { status: 400 });
      }
      if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(productUrl)) {
        return NextResponse.json({ error: 'productUrl must not point to localhost' }, { status: 400 });
      }
      if (/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/.test(productUrl)) {
        return NextResponse.json({ error: 'productUrl must not use private IP addresses' }, { status: 400 });
      }
      updates.productUrl = productUrl;
    }
    if (ram !== undefined) updates.ram = ram;
    if (storage !== undefined) updates.storage = storage;
    if (ptaStatus !== undefined) updates.ptaStatus = ptaStatus;
    if (color !== undefined) updates.color = color;
    if (condition !== undefined) updates.condition = condition;
    if (warrantyType !== undefined) updates.warrantyType = warrantyType;
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (verificationStatus !== undefined && ['pending', 'verified', 'rejected', 'failed'].includes(verificationStatus)) {
      updates.verificationStatus = verificationStatus;
    }

    if (ram !== undefined || storage !== undefined || color !== undefined || condition !== undefined || ptaStatus !== undefined || warrantyType !== undefined) {
      const sourceForListing = await PriceSource.findById(listing.sourceId).select('market currency defaultPriceType').lean();
      const resolved = inferRetailVariantIdentity({
        productUrl: String(updates.productUrl || listing.productUrl || ''),
        existing: {
          ram: updates.ram !== undefined ? updates.ram : listing.ram, storage: updates.storage !== undefined ? updates.storage : listing.storage,
          color: updates.color !== undefined ? updates.color : listing.color, condition: updates.condition !== undefined ? updates.condition : listing.condition,
          ptaStatus: updates.ptaStatus !== undefined ? updates.ptaStatus : listing.ptaStatus, warrantyType: updates.warrantyType !== undefined ? updates.warrantyType : listing.warrantyType,
          market: listing.market || sourceForListing?.market, currency: listing.currency || sourceForListing?.currency, priceType: listing.priceType || sourceForListing?.defaultPriceType,
        },
      });
      Object.assign(updates, { ram: resolved.ram, storage: resolved.storage, color: resolved.color, condition: resolved.condition, ptaStatus: resolved.ptaStatus, warrantyType: resolved.warrantyType, market: resolved.market, currency: resolved.currency, priceType: resolved.priceType, variantKey: resolved.variantKey });
    }

    if (updates.verificationStatus === 'verified') {
      const finalProductUrl = String(updates.productUrl || listing.productUrl || '');
      let finalProductPath = finalProductUrl;
      try { finalProductPath = decodeURIComponent(new URL(finalProductUrl).pathname.replace(/[-_]+/g, ' ')); } catch { /* invalid URL handled above when edited */ }
      if (/\b(laptop|laptops|notebook|notebooks|monitor|monitors|desktop|desktops|television|televisions|tv|tablet|tablets)\b/i.test(finalProductPath)) {
        return NextResponse.json({ error: 'This URL is clearly a non-phone product page and cannot be verified for a phone.' }, { status: 400 });
      }
      if (/\b(laptop|notebook|monitor|desktop|television|tablet)\b/i.test(String(listing.sourceTitle || ''))) {
        return NextResponse.json({ error: 'The fetched retailer title is a non-phone product. Replace the retailer URL before verification.' }, { status: 400 });
      }
      const sourceForValidation = await PriceSource.findById(listing.sourceId).select('market currency defaultPriceType').lean();
      const finalMarket = normalizePriceMarket(String(updates.market || listing.market || sourceForValidation?.market || 'PK'));
      const finalPtaStatus = String(updates.ptaStatus !== undefined ? updates.ptaStatus : listing.ptaStatus || '');
      const finalPriceType = normalizeMarketPriceType({
        market: finalMarket,
        priceType: String(updates.priceType || listing.priceType || sourceForValidation?.defaultPriceType || 'unknown'),
        ptaStatus: finalPtaStatus,
      });
      if (finalMarket === 'PK' && normalizePtaPriceClass(finalPtaStatus) === 'unknown') {
        return NextResponse.json({ error: 'Pakistan listings require an explicit PTA Approved or Non-PTA classification before verification.' }, { status: 400 });
      }
      if (finalPriceType === 'unknown') {
        return NextResponse.json({ error: 'Listing price type is still unknown. Correct its market/PTA identity before verification.' }, { status: 400 });
      }
      updates.market = finalMarket;
      updates.priceType = finalPriceType;
      updates.lastError = '';
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await PhoneRetailListing.findByIdAndUpdate(listingId, { $set: updates });

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'update_retail_listing',
        details: `Updated retail listing ${listingId}`,
        entityType: 'retail_listing',
        entityId: listingId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: listingId });
  }

  // ---- /api/admin/price-tracker/settings ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'settings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error;
    const permCheck = requirePermission(authResult.admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const body = await req.json();
    const { autoApproveThreshold, reviewThreshold, batchSize, checkFrequency } = body;

    const updates: Record<string, unknown> = {};

    if (autoApproveThreshold !== undefined) {
      const v = Number(autoApproveThreshold);
      if (isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: 'autoApproveThreshold must be 0-100' }, { status: 400 });
      updates.autoApproveThreshold = v;
    }
    if (reviewThreshold !== undefined) {
      const v = Number(reviewThreshold);
      if (isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: 'reviewThreshold must be 0-100' }, { status: 400 });
      updates.reviewThreshold = v;
    }
    if (batchSize !== undefined) {
      const v = Number(batchSize);
      if (isNaN(v) || v < 1 || v > 100) return NextResponse.json({ error: 'batchSize must be 1-100' }, { status: 400 });
      updates.batchSize = v;
    }
    if (checkFrequency !== undefined) {
      if (!['hourly', 'twice-daily', 'daily'].includes(checkFrequency)) {
        return NextResponse.json({ error: 'checkFrequency must be hourly, twice-daily, or daily' }, { status: 400 });
      }
      updates.checkFrequency = checkFrequency;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate: autoApproveThreshold must be < reviewThreshold
    const current = await getPriceTrackerSettings();
    const merged = { ...current, ...updates };
    if (merged.autoApproveThreshold >= merged.reviewThreshold) {
      return NextResponse.json({ error: 'autoApproveThreshold must be less than reviewThreshold' }, { status: 400 });
    }

    await SystemState.findOneAndUpdate(
      { key: PT_SETTINGS_KEY },
      { $set: { metadata: merged } },
      { upsert: true },
    );

    try {
      await ActivityLog.create({
        adminId: authResult.admin._id,
        action: 'update_price_tracker_settings',
        details: `Updated price tracker settings: ${JSON.stringify(updates)}`,
        entityType: 'price_source',
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, settings: merged });
  }

  return undefined;
}

// ============ PRICE TRACKER DELETE ============

export async function handlePriceTrackerDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/price-tracker/sources/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'sources') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const sourceId = segments[3];
    if (!sourceId) return NextResponse.json({ error: 'Source ID required' }, { status: 400 });

    const source = await PriceSource.findById(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

    // Delete all listings under this source
    await PhoneRetailListing.deleteMany({ sourceId });
    await PriceSource.findByIdAndDelete(sourceId);

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'delete_price_source',
        details: `Deleted price source: ${source.name} and all its listings`,
        entityType: 'price_source',
        entityId: sourceId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: sourceId });
  }

  // ---- /api/admin/price-tracker/listings/:id ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'price-tracker' && segments[2] === 'listings') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'prices:edit'); if (permCheck) return permCheck;
    await connectDB();

    const listingId = segments[3];
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const listing = await PhoneRetailListing.findById(listingId);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    await PhoneRetailListing.findByIdAndDelete(listingId);

    try {
      await ActivityLog.create({
        adminId: admin._id,
        action: 'delete_retail_listing',
        details: `Deleted retail listing ${listingId}`,
        entityType: 'retail_listing',
        entityId: listingId,
      });
    } catch (e) { console.error('[ActivityLog]', e); }

    return NextResponse.json({ success: true, id: listingId });
  }

  return undefined;
}
