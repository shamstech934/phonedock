export type PriceMarket = 'PK' | 'US';
export type PriceCurrency = 'PKR' | 'USD';
export type MarketPriceType = 'pta-approved' | 'non-pta' | 'retail' | 'unknown';

export function normalizePriceMarket(value: unknown): PriceMarket {
  const text = String(value || '').trim().toUpperCase();
  return text === 'US' || text === 'USA' || text === 'UNITED STATES' ? 'US' : 'PK';
}

export function normalizePriceCurrency(value: unknown, market?: unknown): PriceCurrency {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'USD') return 'USD';
  if (text === 'PKR') return 'PKR';
  return normalizePriceMarket(market) === 'US' ? 'USD' : 'PKR';
}

export function normalizeMarketPriceType(value: unknown, market?: unknown, ptaStatus?: unknown): MarketPriceType {
  const text = String(value || ptaStatus || '').trim().toLowerCase();
  const resolvedMarket = normalizePriceMarket(market);
  if (resolvedMarket === 'US') return 'retail';
  if (/non[-\s]?pta|without\s*pta|unapproved|not\s*(?:pta\s*)?approved/.test(text)) return 'non-pta';
  if (/pta[-\s]?approved|official\s*pta|approved/.test(text)) return 'pta-approved';
  return 'unknown';
}

export function isSafeAutomaticMarketPrice(input: { market?: unknown; currency?: unknown; priceType?: unknown; ptaStatus?: unknown }): boolean {
  const market = normalizePriceMarket(input.market);
  const currency = normalizePriceCurrency(input.currency, market);
  const priceType = normalizeMarketPriceType(input.priceType, market, input.ptaStatus);
  if (market === 'US') return currency === 'USD' && priceType === 'retail';
  return currency === 'PKR' && (priceType === 'pta-approved' || priceType === 'non-pta');
}

export function buildMarketPriceIdentity(input: {
  market?: unknown;
  currency?: unknown;
  priceType?: unknown;
  ptaStatus?: unknown;
  variantKey?: unknown;
}): string {
  const market = normalizePriceMarket(input.market);
  const currency = normalizePriceCurrency(input.currency, market);
  const priceType = normalizeMarketPriceType(input.priceType, market, input.ptaStatus);
  const variantKey = String(input.variantKey || '').trim() || 'variant:*';
  return `market:${market}|currency:${currency}|type:${priceType}|${variantKey}`;
}

export function convertPkrUsd(amount: number, from: PriceCurrency, to: PriceCurrency, usdPkrRate: number): number {
  const value = Number(amount || 0);
  const rate = Number(usdPkrRate || 0);
  if (!Number.isFinite(value) || value <= 0 || from === to) return value > 0 ? value : 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return to === 'USD' ? Math.round((value / rate) * 100) / 100 : Math.round(value * rate);
}
