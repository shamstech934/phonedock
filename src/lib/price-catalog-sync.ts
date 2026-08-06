import { Phone } from '@/lib/models';
import { PhoneRetailListing, PriceSource } from '@/lib/models/PriceTracker';
import { discoverCatalogProductUrls, matchProductUrlToPhone } from '@/lib/price-catalog-discovery';
import { extractRetailPrice } from '@/lib/price-extraction';
import { isPtaPriceCompatible } from '@/lib/price-tracker-intelligence';
import { validateRetailListingPage } from '@/lib/retailer-listing-validation';
import { validateUrlForFetch } from '@/lib/ssrf-guard';
import { fetchRetailProductPage } from '@/lib/retailer-fetch';

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
    .select('_id discoveryMode catalogUrls sitemapUrls feedUrl allowedDomains syncFrequency lastDiscoveryAt priority')
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
      return [{
        updateOne: {
          filter: { sourceId: source._id, productUrl },
          update: {
            $setOnInsert: {
              phoneId: phone._id,
              sourceId: source._id,
              productUrl,
              ptaStatus: phone.ptaStatus || '',
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
        lastError: result.errors.join('; ').slice(0, 1000),
      },
      $inc: { productsAdded: addedForSource },
    });
  }

  return { sourcesChecked: sources.length, urlsFound, listingsAdded, errors: errorCount };
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
    .populate({ path: 'sourceId', select: '_id enabled trusted status allowedDomains' })
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
      ptaStatus?: string;
      sourceId?: { enabled?: boolean; trusted?: boolean; status?: string; allowedDomains?: string[] } | null;
      phoneId?: PhoneRow | null;
    };
    const source = listing.sourceId;
    const phone = listing.phoneId;
    let failure = '';

    if (!source?.enabled || !source.trusted || source.status !== 'active' || !phone) {
      failure = 'Trusted source or phone reference is unavailable.';
    } else if (!isPtaPriceCompatible({
      phoneStatus: phone.ptaStatus,
      phoneApproved: phone.ptaApproved,
      listingStatus: listing.ptaStatus,
    })) {
      failure = 'PTA and Non-PTA price variants cannot be mixed automatically.';
    } else {
      const safety = await validateUrlForFetch(listing.productUrl, source.allowedDomains || []);
      if (!safety.safe) {
        failure = safety.reason || 'Product URL failed safety validation.';
      } else {
        try {
          const fetched = await fetchRetailProductPage(listing.productUrl, {
            timeoutMs: RETAIL_FETCH_TIMEOUT_MS,
            maxBytes: MAX_RETAIL_PAGE_BYTES,
          });
          if (!fetched.ok) failure = fetched.error;
          else {
            const html = fetched.html;
            {
              const pageValidation = validateRetailListingPage({
                html,
                phoneModel: phone.modelName || '',
                brandName: phone.brandId?.name || phone.brandName || '',
                expectedRam: listing.ram || '',
                expectedStorage: listing.storage || '',
                expectedPtaStatus: listing.ptaStatus || phone.ptaStatus || '',
              });
              const extracted = extractRetailPrice(html);
              if (!pageValidation.valid) failure = pageValidation.reasons.join('; ');
              else if (!extracted || extracted.price <= 0 || extracted.confidence < 0.7) {
                failure = 'No reliable PKR price was detected on the product page.';
              } else {
                await PhoneRetailListing.findByIdAndUpdate(listing._id, {
                  $set: {
                    sourceTitle: pageValidation.title,
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
