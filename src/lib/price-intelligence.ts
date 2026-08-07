import { Phone, PhoneRetailListing, PriceIntelligenceSignal, PriceSource, PriceTrackerHistory } from '@/lib/models';
import { isPtaPriceCompatible, normalizePtaPriceClass } from '@/lib/price-tracker-intelligence';

type PlainListing = {
  _id: unknown;
  phoneId: unknown;
  sourceId?: {
    _id?: unknown;
    name?: string;
    trusted?: boolean;
    enabled?: boolean;
    status?: string;
  } | null;
  productUrl?: string;
  currentSourcePrice?: number;
  availability?: string;
  lastCheckedAt?: Date | string | null;
  enabled?: boolean;
  verificationStatus?: string;
  ptaStatus?: string;
  market?: string;
  currency?: string;
  priceType?: string;
  ram?: string; storage?: string; color?: string; condition?: string; warrantyType?: string; variantKey?: string;
};

type SignalInput = {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  details: string;
  recommendedPrice?: number;
  sourceId?: unknown;
  sourceUrl?: string;
  evidence?: unknown;
};

export async function scanPriceIntelligence({ limit = 500 }: { limit?: number } = {}) {
  const safeLimit = Math.min(1000, Math.max(1, Number.isFinite(limit) ? limit : 500));
  const phones = await Phone.find({ deletedAt: null, active: { $ne: false }, status: 'published' })
    .select('_id modelName slug pricePKR currentPrice manualLock ptaStatus ptaApproved bestPtaPricePKR bestNonPtaPricePKR')
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();

  const phoneIds = phones.map((phone) => phone._id);
  const [listings, historyRows, sourceSummary] = await Promise.all([
    PhoneRetailListing.find({ phoneId: { $in: phoneIds }, enabled: true, market: 'PK', currency: 'PKR' })
      .populate('sourceId', 'name trusted enabled status priority')
      .lean() as Promise<PlainListing[]>,
    PriceTrackerHistory.aggregate([
      { $match: { phoneId: { $in: phoneIds } } },
      { $group: { _id: '$phoneId', count: { $sum: 1 } } },
    ]),
    PriceSource.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const listingsByPhone = new Map<string, PlainListing[]>();
  for (const listing of listings) {
    const key = String(listing.phoneId);
    const bucket = listingsByPhone.get(key) || [];
    bucket.push(listing);
    listingsByPhone.set(key, bucket);
  }
  const historyCountByPhone = new Map(historyRows.map((row) => [String(row._id), Number(row.count || 0)]));

  let opened = 0;
  let recommendations = 0;
  let coveredPhones = 0;
  let verifiedListings = 0;
  let trustedListings = 0;
  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const operations: Array<ReturnType<typeof PriceIntelligenceSignal.findOneAndUpdate>> = [];

  for (const phone of phones) {
    const phoneListings = listingsByPhone.get(String(phone._id)) || [];
    const verified = phoneListings.filter((listing) => listing.verificationStatus === 'verified');
    verifiedListings += verified.length;
    const trusted = verified.filter((listing) =>
      listing.sourceId?.trusted
      && listing.sourceId?.enabled
      && listing.sourceId?.status === 'active'
      && listing.availability === 'available'
      && Number(listing.currentSourcePrice) > 0,
    );
    trustedListings += trusted.length;
    if (trusted.length) coveredPhones++;

    const compatibleTrusted = trusted.filter((listing) => isPtaPriceCompatible({ phoneStatus: phone.ptaStatus, phoneApproved: phone.ptaApproved, listingStatus: listing.ptaStatus }));
    const sorted = [...compatibleTrusted].sort((a, b) => Number(a.currentSourcePrice) - Number(b.currentSourcePrice));
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const signals: SignalInput[] = [];

    if (!phoneListings.length) {
      signals.push({
        type: 'missing_product_links',
        severity: 'critical',
        title: 'No retailer product URL linked',
        details: 'Automation cannot detect a price until at least one exact retailer product URL is linked to this phone.',
      });
    } else if (!verified.length) {
      signals.push({
        type: 'unverified_retailer_coverage',
        severity: 'warning',
        title: 'Retailer links need verification',
        details: `${phoneListings.length} linked listing(s) exist, but none are verified yet.`,
      });
    } else if (!trusted.length) {
      signals.push({
        type: 'missing_retailer_coverage',
        severity: 'critical',
        title: 'No trusted Pakistan retailer price',
        details: 'Verified listings exist, but none currently provide an available positive price from an enabled trusted source.',
      });
    }

    const currentPrice = Number(phone.pricePKR || phone.currentPrice || 0);
    if (lowest && (!currentPrice || Math.abs(currentPrice - Number(lowest.currentSourcePrice)) / Math.max(1, currentPrice) >= 0.02)) {
      signals.push({
        type: 'recommended_market_price',
        severity: 'warning',
        title: 'Market price recommendation available',
        details: `Lowest trusted listing is PKR ${Number(lowest.currentSourcePrice).toLocaleString()}.`,
        recommendedPrice: Number(lowest.currentSourcePrice),
        sourceId: lowest.sourceId?._id,
        sourceUrl: lowest.productUrl,
        evidence: { listingId: lowest._id, sourceName: lowest.sourceId?.name, market: 'PK', currency: 'PKR', priceType: lowest.priceType || normalizePtaPriceClass(lowest.ptaStatus), priceClass: normalizePtaPriceClass(lowest.ptaStatus), ram: lowest.ram || '', storage: lowest.storage || '', color: lowest.color || '', condition: lowest.condition || 'new', warrantyType: lowest.warrantyType || '', variantKey: lowest.variantKey || '' },
      });
      recommendations++;
    }

    if (lowest && highest && Number(highest.currentSourcePrice) > Number(lowest.currentSourcePrice) * 1.25) {
      signals.push({
        type: 'large_price_spread',
        severity: 'warning',
        title: 'Large retailer price spread',
        details: 'Trusted retailer prices differ by more than 25%.',
        evidence: { lowest: Number(lowest.currentSourcePrice), highest: Number(highest.currentSourcePrice) },
      });
    }

    if (phoneListings.some((listing) => !listing.lastCheckedAt || new Date(listing.lastCheckedAt) < staleBefore)) {
      signals.push({
        type: 'stale_price_check',
        severity: 'warning',
        title: 'Retailer listing is stale',
        details: 'At least one enabled listing has not been checked in the last 7 days.',
      });
    }

    if (!historyCountByPhone.get(String(phone._id)) && currentPrice > 0) {
      signals.push({
        type: 'missing_price_history',
        severity: 'info',
        title: 'No price history yet',
        details: 'Current public price has no historical snapshot.',
      });
    }

    const activeTypes = signals.map((signal) => signal.type);
    await PriceIntelligenceSignal.updateMany(
      { phoneId: phone._id, status: 'open', type: { $nin: activeTypes } },
      { $set: { status: 'resolved', resolvedAt: new Date(), resolutionNotes: 'Condition no longer detected.' } },
    );

    for (const signal of signals) {
      operations.push(PriceIntelligenceSignal.findOneAndUpdate(
        { phoneId: phone._id, type: signal.type },
        { $set: { ...signal, status: 'open', lastSeenAt: new Date() }, $setOnInsert: { detectedAt: new Date() } },
        { upsert: true, new: true },
      ));
      opened++;
    }
  }

  await Promise.all(operations);

  return {
    scanned: phones.length,
    opened,
    recommendations,
    coveredPhones,
    phonesWithoutCoverage: Math.max(0, phones.length - coveredPhones),
    linkedListings: listings.length,
    verifiedListings,
    trustedListings,
    sourceSummary,
    limit: safeLimit,
  };
}
