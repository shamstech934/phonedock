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
  return phoneClass === 'unknown' || listingClass === 'unknown' || phoneClass === listingClass;
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

