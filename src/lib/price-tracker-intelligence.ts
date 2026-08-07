import { normalizeMarketPriceType, normalizePriceCurrency, normalizePriceMarket } from '@/lib/price-market';

export type PtaPriceClass = 'pta-approved' | 'non-pta' | 'unknown';

export interface PriceStateInput {
  currentPrice: number;
  nextPrice: number;
  originalPrice?: number;
}

export interface PriceState {
  previousPrice: number;
  currentPrice: number;
  originalPrice: number;
  difference: number;
  percentageChange: number;
  discountPercent: number;
  direction: 'increase' | 'decrease' | 'unchanged' | 'initial';
  qualifiesForPriceDropTrend: boolean;
}

export interface VerifiedOfferCandidate {
  listingId: string;
  sourceId: string;
  sourceName?: string;
  sourceType?: string;
  sourcePriority?: number;
  price: number;
  ptaStatus?: string;
  ram?: string;
  storage?: string;
  color?: string;
  condition?: string;
  warrantyType?: string;
  variantKey?: string;
  market?: string;
  currency?: string;
  priceType?: string;
  availability?: string;
  enabled?: boolean;
  trusted?: boolean;
  sourceEnabled?: boolean;
  sourceStatus?: string;
  verificationStatus?: string;
}

export interface BestOfferSelection {
  best: VerifiedOfferCandidate | null;
  bestPta: VerifiedOfferCandidate | null;
  bestNonPta: VerifiedOfferCandidate | null;
  bestUs: VerifiedOfferCandidate | null;
  eligibleCount: number;
  rejectedCount: number;
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizePtaPriceClass(value: unknown, approved?: boolean): PtaPriceClass {
  const text = String(value || '').trim().toLowerCase();
  if (/non[-\s]?pta|not\s*(?:pta\s*)?approved|unapproved|without\s*pta/.test(text)) return 'non-pta';
  if (approved === true || /pta[-\s]?approved|official\s*pta|approved/.test(text)) return 'pta-approved';
  return 'unknown';
}

/**
 * Unknown evidence is allowed for backward compatibility, but an explicitly
 * Non-PTA listing can never overwrite an explicitly PTA-approved phone (or
 * vice versa). Known conflicting variants must be reviewed by an admin.
 */
export function isPtaPriceCompatible(input: {
  phoneStatus?: unknown;
  phoneApproved?: boolean;
  listingStatus?: unknown;
}): boolean {
  const phoneClass = normalizePtaPriceClass(input.phoneStatus, input.phoneApproved);
  const listingClass = normalizePtaPriceClass(input.listingStatus);
  // Unknown evidence is never safe for automatic publication. It may be stored
  // and reviewed, but it must not overwrite either PTA or Non-PTA public price.
  if (phoneClass === 'unknown' || listingClass === 'unknown') return false;
  return phoneClass === listingClass;
}

/**
 * Produces the single canonical state used by automatic sync and approvals.
 * A discount is based only on a previously verified higher price. It never
 * invents an MSRP/original price.
 */
export function buildVerifiedPriceState(input: PriceStateInput): PriceState {
  const currentPrice = positiveNumber(input.currentPrice);
  const nextPrice = positiveNumber(input.nextPrice);
  const existingOriginal = positiveNumber(input.originalPrice);

  if (!nextPrice) throw new Error('A positive verified price is required');

  const difference = currentPrice > 0 ? nextPrice - currentPrice : 0;
  const percentageChange = currentPrice > 0
    ? Math.round((difference / currentPrice) * 10_000) / 100
    : 0;

  let originalPrice = existingOriginal > nextPrice ? existingOriginal : 0;
  if (currentPrice > nextPrice) originalPrice = Math.max(originalPrice, currentPrice);
  if (nextPrice >= originalPrice) originalPrice = 0;

  const discountPercent = originalPrice > nextPrice
    ? Math.round(((originalPrice - nextPrice) / originalPrice) * 100)
    : 0;
  const direction = currentPrice <= 0
    ? 'initial'
    : difference < 0
      ? 'decrease'
      : difference > 0
        ? 'increase'
        : 'unchanged';

  return {
    previousPrice: currentPrice,
    currentPrice: nextPrice,
    originalPrice,
    difference,
    percentageChange,
    discountPercent,
    direction,
    qualifiesForPriceDropTrend: direction === 'decrease' && Math.abs(percentageChange) >= 5,
  };
}

const SOURCE_TYPE_RANK: Record<string, number> = {
  official: 8,
  official_brand: 7,
  api: 6,
  distributor: 5,
  retailer: 4,
  marketplace: 3,
  reference_site: 2,
  manual: 1,
};

function sortOffers(a: VerifiedOfferCandidate, b: VerifiedOfferCandidate): number {
  if (a.price !== b.price) return a.price - b.price;
  const priorityDifference = Number(b.sourcePriority || 0) - Number(a.sourcePriority || 0);
  if (priorityDifference !== 0) return priorityDifference;
  return (SOURCE_TYPE_RANK[b.sourceType || ''] || 0) - (SOURCE_TYPE_RANK[a.sourceType || ''] || 0);
}

function pickLowest(offers: VerifiedOfferCandidate[]): VerifiedOfferCandidate | null {
  return offers.length > 0 ? [...offers].sort(sortOffers)[0] : null;
}

/**
 * Selects a deterministic public offer from trusted, verified listing data.
 * Explicit PTA and Non-PTA offers are kept in separate buckets. A configured
 * preferred source wins within the compatible set; otherwise the lowest safe
 * verified price wins with source priority used as a deterministic tie-break.
 */
export function selectBestVerifiedOffer(input: {
  offers: VerifiedOfferCandidate[];
  phoneStatus?: unknown;
  phoneApproved?: boolean;
  preferredSourceId?: string;
}): BestOfferSelection {
  const eligible = input.offers.filter((offer) => (
    offer.enabled !== false
    && offer.trusted === true
    && offer.sourceEnabled !== false
    && (offer.sourceStatus || 'active') === 'active'
    && (offer.verificationStatus || 'pending') === 'verified'
    && (offer.availability || 'unknown') !== 'unavailable'
    && !/(?:used|refurb|open[-\s]?box|pre[-\s]?owned)/i.test(String(offer.condition || 'new'))
    && positiveNumber(offer.price) > 0
  ));

  // Canonical phone-level prices must never be borrowed from a specific
  // RAM/storage/color variant. Variant-specific offers remain eligible for
  // the public variant selector, but only generic NEW offers may become the
  // phone-level PTA/Non-PTA fallback or overwrite pricePKR/currentPrice.
  const canonical = eligible.filter((offer) => (
    !String(offer.ram || '').trim()
    && !String(offer.storage || '').trim()
    && !String(offer.color || '').trim()
  ));
  const pakistanCanonical = canonical.filter((offer) => normalizePriceMarket(offer.market) === 'PK' && normalizePriceCurrency(offer.currency, offer.market) === 'PKR');
  const usCanonical = canonical.filter((offer) => normalizePriceMarket(offer.market) === 'US' && normalizePriceCurrency(offer.currency, offer.market) === 'USD');
  const bestPta = pickLowest(pakistanCanonical.filter((offer) => normalizeMarketPriceType({ market: offer.market, priceType: offer.priceType, ptaStatus: offer.ptaStatus }) === 'pta-approved'));
  const bestNonPta = pickLowest(pakistanCanonical.filter((offer) => normalizeMarketPriceType({ market: offer.market, priceType: offer.priceType, ptaStatus: offer.ptaStatus }) === 'non-pta'));
  const bestUs = pickLowest(usCanonical.filter((offer) => normalizeMarketPriceType({ market: offer.market, priceType: offer.priceType, ptaStatus: offer.ptaStatus }) === 'us-retail'));
  const compatible = pakistanCanonical.filter((offer) => isPtaPriceCompatible({
    phoneStatus: input.phoneStatus,
    phoneApproved: input.phoneApproved,
    listingStatus: offer.ptaStatus,
  }));
  const preferred = String(input.preferredSourceId || '');
  const preferredOffers = preferred
    ? compatible.filter((offer) => offer.sourceId === preferred)
    : [];
  const pool = preferredOffers.length > 0 ? preferredOffers : compatible;

  return {
    best: pickLowest(pool),
    bestPta,
    bestNonPta,
    bestUs,
    eligibleCount: eligible.length,
    rejectedCount: Math.max(0, input.offers.length - eligible.length),
  };
}
