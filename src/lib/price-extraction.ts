export interface ExtractedPrice {
  price: number;
  currency: string;
  method: 'json-ld' | 'meta' | 'data-attribute' | 'visible-text';
  confidence: number;
}

export interface RetailPageSignals {
  title: string;
  price: ExtractedPrice | null;
  availability: 'available' | 'unavailable' | 'unknown';
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

  const metaPrice = firstMatch(html, [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
  ]);
  if (metaPrice) return { price: metaPrice, currency: 'PKR', method: 'meta', confidence: 0.94 };

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

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractRetailPageSignals(html: string): RetailPageSignals {
  const productNames: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const visit = (value: unknown, depth = 0): void => {
        if (depth > 8 || value == null || typeof value !== 'object') return;
        if (Array.isArray(value)) return value.forEach(item => visit(item, depth + 1));
        const record = value as Record<string, unknown>;
        if (String(record['@type'] || '').toLowerCase().includes('product') && typeof record.name === 'string') {
          productNames.push(record.name);
        }
        Object.values(record).forEach(item => visit(item, depth + 1));
      };
      visit(JSON.parse(match[1]));
    } catch {
      // Malformed JSON-LD must not stop safer HTML fallbacks.
    }
  }
  const ogTitle = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i)?.[1];
  const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decodeBasicEntities(productNames[0] || ogTitle || htmlTitle || '').slice(0, 240);
  const unavailable = /out\s*of\s*stock|currently\s*unavailable|sold\s*out|itemprop=["']availability["'][^>]+OutOfStock/i.test(html);
  const available = /add\s*to\s*cart|buy\s*now|in\s*stock|itemprop=["']availability["'][^>]+InStock/i.test(html);
  return {
    title,
    price: extractRetailPrice(html),
    availability: unavailable ? 'unavailable' : available ? 'available' : 'unknown',
  };
}

function comparableTokens(value: string): string[] {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(token => token.length >= 2 && !['mobile', 'phone', 'smartphone', 'official', 'price', 'pakistan', 'with', 'and'].includes(token));
}

/** Prevent a stale/redirected listing from updating the wrong phone. */
export function isLikelySameRetailProduct(expectedName: string, observedTitle: string): boolean {
  const expected = comparableTokens(expectedName);
  const observed = new Set(comparableTokens(observedTitle));
  if (!expected.length || !observed.size) return false;
  const distinctive = expected.filter(token => /\d/.test(token));
  if (distinctive.length && !distinctive.every(token => observed.has(token))) return false;
  const matched = expected.filter(token => observed.has(token)).length;
  return matched >= Math.min(2, expected.length) && matched / expected.length >= 0.6;
}
