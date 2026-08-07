export interface ExtractedPrice {
  price: number;
  currency: 'PKR' | 'USD';
  method: 'json-ld' | 'meta' | 'data-attribute' | 'visible-text';
  confidence: number;
}

const LIMITS = {
  PKR: { min: 1_000, max: 5_000_000 },
  USD: { min: 20, max: 20_000 },
} as const;

type SupportedCurrency = keyof typeof LIMITS;

function normalizeCurrency(value: unknown): SupportedCurrency | '' {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'USD' || text === 'US$' || text === '$') return 'USD';
  if (text === 'PKR' || text === 'RS' || text === '₨') return 'PKR';
  return '';
}

function toPrice(value: unknown, currency: SupportedCurrency): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/[^\d.]/g, '');
  const price = Number(normalized);
  const limits = LIMITS[currency];
  return Number.isFinite(price) && price >= limits.min && price <= limits.max
    ? Math.round(price * (currency === 'USD' ? 100 : 1)) / (currency === 'USD' ? 100 : 1)
    : null;
}

function walkOffers(value: unknown, prices: Array<{ price: number; currency: SupportedCurrency }>, expectedCurrency: SupportedCurrency, depth = 0): void {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkOffers(item, prices, expectedCurrency, depth + 1));
    return;
  }
  const record = value as Record<string, unknown>;
  const type = String(record['@type'] || '').toLowerCase();
  const declared = normalizeCurrency(record.priceCurrency || record.currency) || expectedCurrency;
  if (type.includes('offer') || 'price' in record || 'lowPrice' in record) {
    if (declared === expectedCurrency) {
      for (const field of ['price', 'lowPrice', 'highPrice']) {
        const parsed = toPrice(record[field], expectedCurrency);
        if (parsed) prices.push({ price: parsed, currency: expectedCurrency });
      }
    }
  }
  Object.values(record).forEach((item) => walkOffers(item, prices, expectedCurrency, depth + 1));
}

function firstMatch(html: string, patterns: RegExp[], currency: SupportedCurrency): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const parsed = toPrice(match?.[1], currency);
    if (parsed) return parsed;
  }
  return null;
}

export function extractRetailPrice(html: string, expectedCurrency: SupportedCurrency = 'PKR'): ExtractedPrice | null {
  const jsonLdPrices: Array<{ price: number; currency: SupportedCurrency }> = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walkOffers(JSON.parse(match[1]), jsonLdPrices, expectedCurrency); }
    catch { /* malformed JSON-LD */ }
  }
  if (jsonLdPrices.length) {
    return { price: Math.min(...jsonLdPrices.map(item => item.price)), currency: expectedCurrency, method: 'json-ld', confidence: 0.98 };
  }

  const metaCurrency = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["']/i)?.[1]
    || '';
  const normalizedMetaCurrency = normalizeCurrency(metaCurrency);
  const metaPrice = firstMatch(html, [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
  ], expectedCurrency);
  if (metaPrice && (!normalizedMetaCurrency || normalizedMetaCurrency === expectedCurrency)) {
    return { price: metaPrice, currency: expectedCurrency, method: 'meta', confidence: normalizedMetaCurrency === expectedCurrency ? 0.97 : 0.90 };
  }

  const dataPrice = firstMatch(html, [
    /data-(?:sale-)?price=["']([\d,.]+)["']/i,
    /itemprop=["']price["'][^>]+(?:content|value)=["']([\d,.]+)["']/i,
  ], expectedCurrency);
  if (dataPrice) return { price: dataPrice, currency: expectedCurrency, method: 'data-attribute', confidence: 0.86 };

  const visiblePatterns = expectedCurrency === 'USD'
    ? [/(?:US\$|USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/i, /(?:sale|current|our)\s*price[^>]{0,80}>\s*(?:US\$|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i]
    : [/(?:PKR|Rs\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/i, /(?:sale|current|our)\s*price[^>]{0,80}>\s*(?:PKR|Rs\.?|₨)?\s*([\d,]+(?:\.\d{1,2})?)/i];
  const visiblePrice = firstMatch(html, visiblePatterns, expectedCurrency);
  return visiblePrice ? { price: visiblePrice, currency: expectedCurrency, method: 'visible-text', confidence: 0.72 } : null;
}
