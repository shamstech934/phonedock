export interface ExtractedPrice {
  price: number;
  currency: string;
  method: 'json-ld' | 'meta' | 'data-attribute' | 'visible-text';
  confidence: number;
}

const MIN_PKR_PRICE = 1_000;
const MAX_PKR_PRICE = 5_000_000;

function toPrice(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/[^\d.]/g, '');
  const price = Number(normalized);
  return Number.isFinite(price) && price >= MIN_PKR_PRICE && price <= MAX_PKR_PRICE
    ? Math.round(price)
    : null;
}

function walkOffers(value: unknown, prices: number[], depth = 0): void {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkOffers(item, prices, depth + 1));
    return;
  }
  const record = value as Record<string, unknown>;
  const type = String(record['@type'] || '').toLowerCase();
  const currency = String(record.priceCurrency || record.currency || '').toUpperCase();
  if (type.includes('offer') || 'price' in record || 'lowPrice' in record) {
    if (!currency || currency === 'PKR') {
      for (const field of ['price', 'lowPrice', 'highPrice']) {
        const parsed = toPrice(record[field]);
        if (parsed) prices.push(parsed);
      }
    }
  }
  Object.values(record).forEach((item) => walkOffers(item, prices, depth + 1));
}

function firstMatch(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const parsed = toPrice(match?.[1]);
    if (parsed) return parsed;
  }
  return null;
}

export function extractRetailPrice(html: string): ExtractedPrice | null {
  const jsonLdPrices: number[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walkOffers(JSON.parse(match[1]), jsonLdPrices);
    } catch {
      // Ignore malformed blocks and keep checking stronger structured signals.
    }
  }
  if (jsonLdPrices.length) {
    return { price: Math.min(...jsonLdPrices), currency: 'PKR', method: 'json-ld', confidence: 0.98 };
  }

  const metaCurrency = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:currency|og:price:currency)["']/i)?.[1]
    || '';
  const normalizedMetaCurrency = String(metaCurrency).trim().toUpperCase();
  const metaPrice = firstMatch(html, [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
  ]);
  if (metaPrice && (!normalizedMetaCurrency || normalizedMetaCurrency === 'PKR')) {
    return { price: metaPrice, currency: 'PKR', method: 'meta', confidence: normalizedMetaCurrency === 'PKR' ? 0.97 : 0.92 };
  }

  const dataPrice = firstMatch(html, [
    /data-(?:sale-)?price=["']([\d,.]+)["']/i,
    /itemprop=["']price["'][^>]+(?:content|value)=["']([\d,.]+)["']/i,
  ]);
  if (dataPrice) return { price: dataPrice, currency: 'PKR', method: 'data-attribute', confidence: 0.88 };

  const visiblePrice = firstMatch(html, [
    /(?:PKR|Rs\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:sale|current|our)\s*price[^>]{0,80}>\s*(?:PKR|Rs\.?|₨)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  return visiblePrice
    ? { price: visiblePrice, currency: 'PKR', method: 'visible-text', confidence: 0.72 }
    : null;
}
