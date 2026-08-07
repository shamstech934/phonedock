export type PriceMarket = 'PK' | 'US';
export type PriceCurrency = 'PKR' | 'USD';
export type MarketPriceType = 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';

export function normalizePriceMarket(value: unknown): PriceMarket {
  const text = String(value || '').trim().toUpperCase();
  return text === 'US' || text === 'USA' || text === 'UNITED STATES' ? 'US' : 'PK';
}

export function normalizePriceCurrency(value: unknown, market?: unknown): PriceCurrency {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'USD' || text === 'US$' || text === '$') return 'USD';
  if (text === 'PKR' || text === 'RS' || text === '₨') return 'PKR';
  return normalizePriceMarket(market) === 'US' ? 'USD' : 'PKR';
}

export function normalizeMarketPriceType(input: { market?: unknown; priceType?: unknown; ptaStatus?: unknown }): MarketPriceType {
  const market = normalizePriceMarket(input.market);
  const explicit = String(input.priceType || '').trim().toLowerCase();
  if (market === 'US') return 'us-retail';
  if (explicit === 'pta-approved' || explicit === 'non-pta') return explicit;
  const pta = String(input.ptaStatus || '').trim().toLowerCase();
  if (/non[-\s]?pta|without\s*pta|unapproved|not\s*(?:pta\s*)?approved/.test(pta)) return 'non-pta';
  if (/pta[-\s]?approved|official\s*pta|approved/.test(pta)) return 'pta-approved';
  return 'unknown';
}

export function marketPriceLabel(input: { market?: unknown; priceType?: unknown }): string {
  const market = normalizePriceMarket(input.market);
  const type = String(input.priceType || '').trim().toLowerCase();
  if (market === 'US' || type === 'us-retail') return 'USA Retail';
  if (type === 'non-pta') return 'Pakistan Non-PTA';
  return 'Pakistan PTA';
}
