import { Phone } from '@/lib/models';
import { PhoneRetailListing, PriceSource } from '@/lib/models/PriceTracker';
import { discoverCatalogProductUrls, matchProductUrlToPhone, summarizeCatalogDiscoveryDiagnostics } from '@/lib/price-catalog-discovery';
import { extractRetailPrice } from '@/lib/price-extraction';
import { normalizePtaPriceClass } from '@/lib/price-tracker-intelligence';
import { normalizeMarketPriceType, normalizePriceCurrency, normalizePriceMarket } from '@/lib/price-market';
import { inferRetailVariantIdentity } from '@/lib/price-variant';
import { validateRetailListingPage } from '@/lib/retailer-listing-validation';
import { validateUrlForFetch } from '@/lib/ssrf-guard';

const MAX_SOURCES_PER_RUN = 2;
const MAX_PENDING_VERIFICATIONS_PER_RUN = 8;
const MAX_RETAIL_PAGE_BYTES = 3_000_000;
const RETAIL_FETCH_TIMEOUT_MS = 12_000;

type Frequency = 'manual' | 'hourly' | 'daily' | 'weekly';

type SourceRow = {
  _id: { toString(): string };
  discoveryMode?: string;
  catalogUrls?: string[];
  sitemapUrls?: string[];
  feedUrl?: string;
  allowedDomains?: string[];
  syncFrequency?: Frequency;
  lastDiscoveryAt?: Date | null;
  market?: string;
  currency?: string;
  defaultPriceType?: string;
};

type PhoneRow = {
  _id: { toString(): string };
  slug?: string;
  modelName?: string;
  brandName?: string;
  brandId?: { name?: string } | null;
  ptaStatus?: string;
  ptaApproved?: boolean;
};

export function isCatalogDiscoveryDue(
  frequency: Frequency | string | undefined,
  lastDiscoveryAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!frequency || frequency === 'manual') return false;
  if (!lastDiscoveryAt || Number.isNaN(lastDiscoveryAt.getTime())) return true;
  const intervalMs = frequency === 'hourly'
    ? 60 * 60 * 1000
    : frequency === 'weekly'
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
  return now.getTime() - lastDiscoveryAt.getTime() >= intervalMs;
}

export function detectRetailAvailability(html: string): 'available' | 'unavailable' | 'unknown' {
  if (/out\s*of\s*stock|unavailable|sold\s*out/i.test(html)) return 'unavailable';
  if (/add\s*to\s*cart|buy\s*now|in\s*stock|available/i.test(html)) return 'available';
  return 'unknown';
}

export async function discoverDuePriceListings(now = new Date()): Promise<{
  sourcesChecked: number;
  urlsFound: number;
  listingsAdded: number;
  errors: number;
}> {
  const candidates = await PriceSource.find({
    enabled: true,
    trusted: true,
    status: 'active',
    discoveryEnabled: true,
    discoveryMode: { $ne: 'manual' },
    syncFrequency: { $ne: 'manual' },
  })
    .select('_id discoveryMode catalogUrls sitemapUrls feedUrl allowedDomains syncFrequency lastDiscoveryAt priority market currency defaultPriceType')
    .sort({ priority: -1, lastDiscoveryAt: 1, _id: 1 })
    .limit(12)
    .lean() as unknown as SourceRow[];

  const sources = candidates
    .filter(source => isCatalogDiscoveryDue(source.syncFrequency, source.lastDiscoveryAt, now))
    .slice(0, MAX_SOURCES_PER_RUN);
  if (sources.length === 0) return { sourcesChecked: 0, urlsFound: 0, listingsAdded: 0, errors: 0 };

  const phones = await Phone.find({ active: true, status: 'published' })
    .select('_id slug modelName brandId ptaStatus ptaApproved')
    .populate({ path: 'brandId', select: 'name' })
    .lean() as unknown as PhoneRow[];

  let urlsFound = 0;
  let listingsAdded = 0;
  let errorCount = 0;

  for (const source of sources) {
    const result = await discoverCatalogProductUrls({
      mode: source.discoveryMode || 'manual',
      catalogUrls: source.catalogUrls || [],
      sitemapUrls: source.sitemapUrls || [],
      feedUrl: source.feedUrl || '',
      allowedDomains: source.allowedDomains || [],
    });
    urlsFound += result.urls.length;
    errorCount += result.errors.length;

    const operations = result.urls.flatMap(productUrl => {
      const phone = matchProductUrlToPhone(productUrl, phones);
      if (!phone) return [];
      const variant = inferRetailVariantIdentity({ productUrl, existing: { condition: 'new', market: source.market, currency: source.currency, priceType: source.defaultPriceType } });
      return [{
        updateOne: {
          filter: { sourceId: source._id, productUrl },
          update: {
            $setOnInsert: {
              phoneId: phone._id,
              sourceId: source._id,
              productUrl,
              ram: variant.ram,
              storage: variant.storage,
              color: variant.color,
              condition: variant.condition,
              ptaStatus: variant.ptaStatus,
              warrantyType: variant.warrantyType,
              market: variant.market,
              currency: variant.currency,
              priceType: variant.priceType,
              variantKey: variant.variantKey,
              availability: 'unknown',
              enabled: true,
              verificationStatus: 'pending',
              discoveryOrigin: 'catalog',
              matchStrategy: 'url_model',
              matchConfidence: 80,
              lastError: 'Awaiting automatic product-page verification.',
            },
          },
          upsert: true,
        },
      }];
    });

    let addedForSource = 0;
    if (operations.length > 0) {
      try {
        const writeResult = await PhoneRetailListing.bulkWrite(operations, { ordered: false });
        addedForSource = writeResult.upsertedCount;
        listingsAdded += addedForSource;
      } catch (error: unknown) {
        // Duplicate-key races are harmless; another invocation discovered the
        // same canonical product URL first.
        if ((error as { code?: number }).code !== 11000) {
          errorCount++;
          result.errors.push(error instanceof Error ? error.message : 'Catalog listing write failed');
        }
      }
    }

    await PriceSource.findByIdAndUpdate(source._id, {
      $set: {
        lastDiscoveryAt: now,
        lastDiscoveryCount: result.urls.length,
        productsFound: result.urls.length,
        lastError: (result.errors.join('; ') || (result.urls.length === 0 ? summarizeCatalogDiscoveryDiagnostics(result) : '')).slice(0, 1000),
      },
      $inc: { productsAdded: addedForSource },
    });
  }

  return { sourcesChecked: sources.length, urlsFound, listingsAdded, errors: errorCount };
}


export async function demoteObviousNonPhoneListings(now = new Date()): Promise<number> {
  const result = await PhoneRetailListing.updateMany(
    {
      enabled: true,
      verificationStatus: 'verified',
      sourceTitle: { $regex: /\b(laptop|notebook|monitor|desktop|television)\b/i },
    },
    {
      $set: {
        verificationStatus: 'pending',
        lastCheckedAt: now,
        lastError: 'Listing title indicates a non-phone product. Re-link this phone to the correct retailer product page.',
      },
    },
  );
  return Number(result.modifiedCount || 0);
}

export async function verifyPendingCatalogListings(now = new Date()): Promise<{
  checked: number;
  verified: number;
  rejected: number;
}> {
  const rows = await PhoneRetailListing.find({
    enabled: true,
    verificationStatus: 'pending',
    discoveryOrigin: 'catalog',
    matchStrategy: 'url_model',
    matchConfidence: { $gte: 80 },
  })
    .sort({ lastCheckedAt: 1, createdAt: 1, _id: 1 })
    .limit(MAX_PENDING_VERIFICATIONS_PER_RUN)
    .populate({ path: 'sourceId', select: '_id enabled trusted status allowedDomains automaticFetchEnabled accessMode market currency defaultPriceType' })
    .populate({
      path: 'phoneId',
      select: '_id modelName brandId ptaStatus ptaApproved',
      populate: { path: 'brandId', select: 'name' },
    })
    .lean();

  let verified = 0;
  let rejected = 0;

  for (const row of rows) {
    const listing = row as unknown as {
      _id: unknown;
      productUrl: string;
      ram?: string;
      storage?: string;
      color?: string;
      condition?: string;
      warrantyType?: string;
      variantKey?: string;
      ptaStatus?: string;
      market?: string;
      currency?: string;
      priceType?: string;
      sourceId?: { enabled?: boolean; trusted?: boolean; status?: string; allowedDomains?: string[]; automaticFetchEnabled?: boolean; accessMode?: string; market?: string; currency?: string; defaultPriceType?: string } | null;
      phoneId?: PhoneRow | null;
    };
    const source = listing.sourceId;
    const phone = listing.phoneId;
    let failure = '';

    if (!source?.enabled || !source.trusted || source.status !== 'active' || source.automaticFetchEnabled === false || source.accessMode === 'challenge_blocked' || !phone) {
      failure = 'Trusted source or phone reference is unavailable.';
    } else {
      const safety = await validateUrlForFetch(listing.productUrl, source.allowedDomains || []);
      if (!safety.safe) {
        failure = safety.reason || 'Product URL failed safety validation.';
      } else {
        try {
          const response = await fetch(listing.productUrl, {
            redirect: 'follow',
            signal: AbortSignal.timeout(RETAIL_FETCH_TIMEOUT_MS),
            headers: {
              'User-Agent': 'PhoneDock-PriceTracker/1.0 (+https://specsdekh.com)',
              Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            },
          });
          const contentLength = Number(response.headers.get('content-length') || 0);
          if (!response.ok) failure = `Retailer returned HTTP ${response.status}.`;
          else if (contentLength > MAX_RETAIL_PAGE_BYTES) failure = 'Retail product page exceeds 3 MB limit.';
          else {
            const html = await response.text();
            if (html.length > MAX_RETAIL_PAGE_BYTES) failure = 'Retail product page exceeds 3 MB limit.';
            else {
              const preliminary = validateRetailListingPage({
                html,
                phoneModel: phone.modelName || '',
                brandName: phone.brandId?.name || phone.brandName || '',
              });
              const variant = inferRetailVariantIdentity({
                title: preliminary.title,
                productUrl: listing.productUrl,
                existing: {
                  ram: listing.ram,
                  storage: listing.storage,
                  color: listing.color,
                  condition: listing.condition,
                  ptaStatus: listing.ptaStatus,
                  warrantyType: listing.warrantyType,
                  market: listing.market || source.market,
                  currency: listing.currency || source.currency,
                  priceType: listing.priceType || source.defaultPriceType,
                },
              });
              const pageValidation = validateRetailListingPage({
                html,
                phoneModel: phone.modelName || '',
                brandName: phone.brandId?.name || phone.brandName || '',
                expectedRam: variant.ram,
                expectedStorage: variant.storage,
                expectedPtaStatus: variant.ptaStatus,
              });
              const extracted = extractRetailPrice(html, normalizePriceCurrency(variant.currency, variant.market));
              if (!pageValidation.valid) failure = pageValidation.reasons.join('; ');
              else if (normalizePriceMarket(variant.market) === 'PK' && normalizePtaPriceClass(variant.ptaStatus) === 'unknown') {
                failure = 'PTA class is not explicit on this Pakistan listing. Choose PTA Approved or Non-PTA in review before automatic publication.';
              } else if (normalizeMarketPriceType({ market: variant.market, priceType: variant.priceType, ptaStatus: variant.ptaStatus }) === 'unknown') {
                failure = 'Market price type is unknown. Review this listing before automatic publication.';
              } else if (!extracted || extracted.price <= 0 || extracted.confidence < 0.7) {
                failure = `No reliable ${normalizePriceCurrency(variant.currency, variant.market)} price was detected on the product page.`;
              } else {
                await PhoneRetailListing.findByIdAndUpdate(listing._id, {
                  $set: {
                    sourceTitle: pageValidation.title,
                    ram: variant.ram,
                    storage: variant.storage,
                    color: variant.color,
                    condition: variant.condition,
                    ptaStatus: variant.ptaStatus,
                    warrantyType: variant.warrantyType,
                    market: variant.market,
                    currency: variant.currency,
                    priceType: variant.priceType,
                    variantKey: variant.variantKey,
                    // The regular price-sync phase owns canonical price writes
                    // and history. Keeping this at zero makes the same cron
                    // treat the verified page as its first auditable detection.
                    currentSourcePrice: 0,
                    availability: detectRetailAvailability(html),
                    verificationStatus: 'verified',
                    extractionMethod: extracted.method,
                    extractionConfidence: extracted.confidence,
                    lastCheckedAt: now,
                    lastSuccessAt: now,
                    failureCount: 0,
                    nextRetryAt: null,
                    lastError: '',
                  },
                });
                verified++;
                continue;
              }

              // Persist safe inferred identity even when the row stays pending.
              await PhoneRetailListing.findByIdAndUpdate(listing._id, {
                $set: {
                  sourceTitle: pageValidation.title || preliminary.title,
                  ram: variant.ram,
                  storage: variant.storage,
                  color: variant.color,
                  condition: variant.condition,
                  ptaStatus: variant.ptaStatus,
                  warrantyType: variant.warrantyType,
                  market: variant.market,
                  currency: variant.currency,
                  priceType: variant.priceType,
                  variantKey: variant.variantKey,
                },
              });
            }
          }
        } catch (error) {
          failure = error instanceof Error ? error.message : 'Product page verification failed.';
        }
      }
    }

    rejected++;
    await PhoneRetailListing.findByIdAndUpdate(listing._id, {
      $set: { lastCheckedAt: now, lastError: failure.slice(0, 1000) },
      $inc: { failureCount: 1 },
    });
  }

  return { checked: rows.length, verified, rejected };
}
