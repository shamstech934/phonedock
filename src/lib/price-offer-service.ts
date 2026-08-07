import { Phone, PriceHistory } from '@/lib/models';
import { PhoneRetailListing } from '@/lib/models/PriceTracker';
import { buildPriceVariantKey } from '@/lib/price-variant';
import { normalizeMarketPriceType, normalizePriceCurrency, normalizePriceMarket } from '@/lib/price-market';
import {
  buildVerifiedPriceState,
  normalizePtaPriceClass,
  selectBestVerifiedOffer,
  type VerifiedOfferCandidate,
} from '@/lib/price-tracker-intelligence';

type PopulatedSource = {
  _id?: { toString(): string };
  name?: string;
  sourceType?: string;
  priority?: number;
  market?: string;
  currency?: string;
  trusted?: boolean;
  enabled?: boolean;
  status?: string;
};

type PopulatedRetailListing = {
  _id?: { toString(): string };
  sourceId?: PopulatedSource | null;
  currentSourcePrice?: number;
  ptaStatus?: string;
  ram?: string; storage?: string; color?: string; condition?: string; warrantyType?: string; variantKey?: string;
  market?: string; currency?: string; priceType?: string; priceIdentityKey?: string;
  availability?: string;
  enabled?: boolean;
  verificationStatus?: string;
};

export interface BestPriceRecomputeResult {
  slug: string | null;
  changed: boolean;
  bestPrice: number;
  offerCount: number;
}

export async function recomputeBestPriceForPhone(phoneId: string): Promise<BestPriceRecomputeResult> {
  const phone = await Phone.findById(phoneId);
  if (!phone) return { slug: null, changed: false, bestPrice: 0, offerCount: 0 };

  const rows = await PhoneRetailListing.find({ phoneId, enabled: true })
    .populate('sourceId', 'name sourceType priority trusted enabled status market currency')
    .lean();

  const offers: VerifiedOfferCandidate[] = (rows as unknown as PopulatedRetailListing[]).map((row) => {
    const source = (row.sourceId || {}) as PopulatedSource;
    return {
      listingId: String(row._id || ''),
      sourceId: String(source._id || ''),
      sourceName: source.name || '',
      sourceType: source.sourceType || '',
      sourcePriority: Number(source.priority || 0),
      price: Number(row.currentSourcePrice || 0),
      ptaStatus: row.ptaStatus || '',
      ram: row.ram || '', storage: row.storage || '', color: row.color || '', condition: row.condition || 'new', warrantyType: row.warrantyType || '',
      variantKey: row.variantKey || buildPriceVariantKey(row),
      availability: row.availability || 'unknown',
      enabled: row.enabled !== false,
      trusted: source.trusted === true,
      sourceEnabled: source.enabled !== false,
      sourceStatus: source.status || 'active',
      verificationStatus: row.verificationStatus || 'pending',
      market: normalizePriceMarket(row.market || source.market),
      currency: normalizePriceCurrency(row.currency || source.currency, row.market || source.market),
      priceType: normalizeMarketPriceType(row.priceType, row.market || source.market, row.ptaStatus),
    };
  });

  const phonePriceClass = normalizePtaPriceClass(phone.ptaStatus, phone.ptaApproved);
  const selection = selectBestVerifiedOffer({
    offers,
    phoneStatus: phone.ptaStatus,
    phoneApproved: phone.ptaApproved,
    preferredSourceId: phone.preferredPriceSourceId?.toString(),
  });
  const metadata: Record<string, unknown> = {
    verifiedOfferCount: selection.eligibleCount,
    bestPtaPricePKR: selection.bestPta?.price || 0,
    bestNonPtaPricePKR: selection.bestNonPta?.price || 0,
    bestUsRetailPriceUSD: selection.bestUsRetail?.price || 0,
    bestPriceListingId: selection.best?.listingId || null,
    bestPriceSourceId: selection.best?.sourceId || null,
    bestPriceSelectedAt: selection.best ? new Date() : null,
    lastPriceCheckedAt: new Date(),
  };

  if (!selection.best || phone.manualLock === true || phonePriceClass === 'unknown') {
    await Phone.findByIdAndUpdate(phoneId, { $set: metadata });
    return {
      slug: phone.slug || null,
      changed: false,
      bestPrice: selection.best?.price || 0,
      offerCount: selection.eligibleCount,
    };
  }

  const currentPrice = Number(phone.currentPrice || phone.pricePKR || 0);
  const state = buildVerifiedPriceState({
    currentPrice,
    nextPrice: selection.best.price,
    originalPrice: phone.originalPricePKR,
  });
  const changed = currentPrice !== selection.best.price;
  const updates: Record<string, unknown> = {
    ...metadata,
    currentPrice: state.currentPrice,
    previousPrice: state.previousPrice,
    originalPricePKR: state.originalPrice,
    priceChange: state.difference,
    percentageChange: state.percentageChange,
    priceMode: 'automatic',
    pricePKR: state.currentPrice,
  };

  if (changed) updates.lastPriceChangedAt = new Date();
  if (state.qualifiesForPriceDropTrend) {
    updates.trending = true;
    updates.trendingReason = 'price_drop';
    updates.trendingUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else if (state.direction === 'increase' && phone.trendingReason === 'price_drop') {
    updates.trending = false;
    updates.trendingReason = '';
    updates.trendingUntil = null;
  }

  const lowest = Number(phone.lowestPrice || 0);
  const highest = Number(phone.highestPrice || 0);
  if (state.currentPrice < lowest || lowest === 0) updates.lowestPrice = state.currentPrice;
  if (state.currentPrice > highest) updates.highestPrice = state.currentPrice;

  await Phone.findByIdAndUpdate(phoneId, { $set: updates });
  if (changed) {
    try {
      await PriceHistory.create({
        phoneId,
        storeName: selection.best.sourceName || null,
        price: state.currentPrice,
      });
    } catch (error) {
      console.error('[PriceHistory:best-offer]', error);
    }
  }

  return {
    slug: phone.slug || null,
    changed,
    bestPrice: state.currentPrice,
    offerCount: selection.eligibleCount,
  };
}

export async function resolvePendingRetailOffer(input: {
  phoneId: string;
  sourceId?: string;
  sourceUrl?: string;
  newPrice: number;
  approved: boolean;
}): Promise<BestPriceRecomputeResult> {
  const query: Record<string, unknown> = { phoneId: input.phoneId };
  if (input.sourceId) query.sourceId = input.sourceId;
  if (input.sourceUrl) query.productUrl = input.sourceUrl;
  const listing = await PhoneRetailListing.findOne(query);

  if (listing) {
    const updates: Record<string, unknown> = {
      pendingSourcePrice: 0,
      pendingDetectedAt: null,
    };
    if (input.approved && input.newPrice > 0) {
      updates.previousSourcePrice = Number(listing.currentSourcePrice || 0);
      updates.currentSourcePrice = input.newPrice;
      updates.lastChangedAt = new Date();
      updates.lastSuccessAt = new Date();
    }
    await PhoneRetailListing.findByIdAndUpdate(listing._id, { $set: updates });
  }

  return recomputeBestPriceForPhone(input.phoneId);
}
