export interface ExtractedPrice {
  price: number;
  currency: 'PKR' | 'USD';
  method: 'json-ld' | 'meta' | 'data-attribute' | 'visible-text';
  confidence: number;
}

type SupportedCurrency = 'PKR' | 'USD';

const PRICE_BOUNDS: Record<SupportedCurrency, { min: number; max: number }> = {
  PKR: { min: 1_000, max: 5_000_000 },
  USD: { min: 20, max: 20_000 },
};

function normalizeCurrency(value: unknown, fallback: SupportedCurrency): SupportedCurrency | null {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return fallback;
  if (text === 'PKR' || text === 'RS' || text === '₨') return 'PKR';
  if (text === 'USD' || text === 'US$' || text === '$') return 'USD';
  return null;
}

function toPrice(value: unknown, currency: SupportedCurrency): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/[^\d.]/g, '');
  const price = Number(normalized);
  const bounds = PRICE_BOUNDS[currency];
  return Number.isFinite(price) && price >= bounds.min && price <= bounds.max
    ? (currency === 'USD' ? Math.round(price * 100) / 100 : Math.round(price))
    : null;
}

type PriceEvidence = { price: number; currency: SupportedCurrency };

function walkOffers(value: unknown, prices: PriceEvidence[], expectedCurrency: SupportedCurrency, depth = 0): void {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkOffers(item, prices, expectedCurrency, depth + 1));
    return;
  }
  const record = value as Record<string, unknown>;
  const type = String(record['@type'] || '').toLowerCase();
  if (type.includes('offer') || 'price' in record || 'lowPrice' in record) {
    const currency = normalizeCurrency(record.priceCurrency || record.currency, expectedCurrency);
    if (currency === expectedCurrency) {
      for (const field of ['price', 'lowPrice', 'highPrice']) {
        const parsed = toPrice(record[field], currency);
        if (parsed) prices.push({ price: parsed, currency });
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

/**
 * Extract a price only for the requested currency. PK retailer pages default to
 * PKR for backwards compatibility; US sources explicitly request USD.
 */
export function extractRetailPrice(
  html: string,
  options: { currency?: SupportedCurrency } = {},
): ExtractedPrice | null {
  const expectedCurrency: SupportedCurrency = options.currency === 'USD' ? 'USD' : 'PKR';
  const jsonLdPrices: PriceEvidence[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walkOffers(JSON.parse(match[1]), jsonLdPrices, expectedCurrency);
    } catch {
      // Ignore malformed blocks and keep checking stronger structured signals.
    }
  }
  if (jsonLdPrices.length) {
    return { price: Math.min(...jsonLdPrices.map(item => item.price)), currency: expectedCurrency, method: 'json-ld', confidence: 0.98 };
  }

  const metaCurrencyRaw = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["']/i)?.[1]
    || '';
  const metaCurrency = normalizeCurrency(metaCurrencyRaw, expectedCurrency);
  const metaPrice = firstMatch(html, [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
  ], expectedCurrency);
  if (metaPrice && metaCurrency === expectedCurrency) {
    return { price: metaPrice, currency: expectedCurrency, method: 'meta', confidence: metaCurrencyRaw ? 0.97 : 0.92 };
  }

  const dataPrice = firstMatch(html, [
    /data-(?:sale-)?price=["']([\d,.]+)["']/i,
    /itemprop=["']price["'][^>]+(?:content|value)=["']([\d,.]+)["']/i,
  ], expectedCurrency);
  if (dataPrice && (expectedCurrency === 'PKR' || /(?:USD|US\$|\$)/i.test(html))) {
    return { price: dataPrice, currency: expectedCurrency, method: 'data-attribute', confidence: 0.86 };
  }

  const visiblePatterns = expectedCurrency === 'USD'
    ? [
        /(?:USD|US\$|\$)\s*([\d,]+(?:\.\d{1,2})?)/i,
        /(?:sale|current|our)\s*price[^>]{0,80}>\s*(?:USD|US\$|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      ]
    : [
        /(?:PKR|Rs\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/i,
        /(?:sale|current|our)\s*price[^>]{0,80}>\s*(?:PKR|Rs\.?|₨)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      ];
  const visiblePrice = firstMatch(html, visiblePatterns, expectedCurrency);
  return visiblePrice
    ? { price: visiblePrice, currency: expectedCurrency, method: 'visible-text', confidence: 0.72 }
    : null;
}
