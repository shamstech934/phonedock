import { decodeHtml, metaContent, titleText } from './parsers/html-utils';

export type CollectorPageKind = 'product' | 'catalog' | 'brand_listing' | 'price_range' | 'article' | 'navigation' | 'unknown';

export interface CollectorPageClassification {
  kind: CollectorPageKind;
  confidence: number;
  reasons: string[];
}

const WHATMOBILE_PRODUCT_PATH = /^[a-z0-9]+_[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const WHATMOBILE_CATALOG_PATH = /(?:_Mobiles?_Prices|Mobile-Phones-Prices|Mobiles?-Prices|(?:^|[-_])(?:4G|5G)(?:[-_]|$)|Coming[-_ ]Soon|less[-_ ]than|\d+[-_ ]to[-_ ]\d+)/i;
const NON_PRODUCT_TITLE = /(?:\bMobile Phones Prices\b|\bMobiles?\s*(?:&8211;|&#8211;|–|—|-)\s*|\bAll about\b|^Compare$|\bHow to\b|\bhelp\b|\bsupport\b|\bnews\b|\bblog\b|\bcategory\b|\bcatalog\b)/i;
const SAMSUNG_NON_PRODUCT = /(?:^|\/)(?:compare|all-about|discover|offers?|support|news|campaign|business|accessories?|tablets?|watches?)(?:\/|$)/i;
const PHONE_SPEC_SIGNAL = /(?:specifications?|display|processor|chipset|battery|camera|memory|storage|ram|dimensions|weight)/i;

function normalizedTitle(html: string, fallback = ''): string {
  return decodeHtml(metaContent(html, ['og:title', 'twitter:title']) || titleText(html) || fallback);
}

function productStructuredDataPresent(html: string): boolean {
  return /["']@type["']\s*:\s*["']Product["']/i.test(html)
    || /(?:product:price:amount|itemprop=["'](?:price|model|sku)["'])/i.test(html);
}

function hasPhoneSpecStructure(html: string): boolean {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const matches = stripped.match(new RegExp(PHONE_SPEC_SIGNAL.source, 'gi')) || [];
  return matches.length >= 3;
}

export function classifyCollectorPage(input: { url?: string; title?: string; html?: string; sourceName?: string }): CollectorPageClassification {
  const reasons: string[] = [];
  const html = input.html || '';
  const title = normalizedTitle(html, input.title || '');
  let parsed: URL | null = null;
  try { parsed = input.url ? new URL(input.url) : null; } catch { parsed = null; }
  const host = parsed?.hostname.toLowerCase().replace(/^www\./, '') || '';
  const path = parsed?.pathname || '';
  const tail = path.split('/').filter(Boolean).at(-1) || '';

  if (host === 'whatmobile.com.pk' || /whatmobile/i.test(input.sourceName || '')) {
    if (WHATMOBILE_CATALOG_PATH.test(tail) || WHATMOBILE_CATALOG_PATH.test(title)) {
      reasons.push('WhatMobile catalog/category/price-range pattern');
      return { kind: /(?:less|\d+.*to.*\d+)/i.test(`${tail} ${title}`) ? 'price_range' : 'catalog', confidence: 0.99, reasons };
    }
    if (/how[-_ ]to|stolen|lost[-_ ]mobile|article|news/i.test(`${tail} ${title}`)) {
      reasons.push('WhatMobile help/article pattern');
      return { kind: 'article', confidence: 0.99, reasons };
    }
    if (path.split('/').filter(Boolean).length === 1 && WHATMOBILE_PRODUCT_PATH.test(tail)) {
      if (html && !productStructuredDataPresent(html) && !hasPhoneSpecStructure(html)) {
        reasons.push('Product-like URL but no product/spec structure');
        return { kind: 'unknown', confidence: 0.55, reasons };
      }
      reasons.push('WhatMobile Brand_Model-Variant product URL');
      return { kind: 'product', confidence: html ? 0.98 : 0.92, reasons };
    }
    reasons.push('Does not match strict WhatMobile product pattern');
    return { kind: 'unknown', confidence: 0.7, reasons };
  }

  if (host === 'samsung.com' || host.endsWith('.samsung.com') || /samsung/i.test(input.sourceName || '')) {
    if (SAMSUNG_NON_PRODUCT.test(path) || /^(?:All about Galaxy|Compare)$/i.test(title.trim())) {
      reasons.push('Samsung navigation/marketing page pattern');
      return { kind: 'navigation', confidence: 0.99, reasons };
    }
    if (/\/smartphones\/?$/i.test(path)) {
      reasons.push('Samsung smartphones catalog root');
      return { kind: 'catalog', confidence: 0.98, reasons };
    }
    if (/\/smartphones\//i.test(path) && (productStructuredDataPresent(html) || hasPhoneSpecStructure(html) || /galaxy/i.test(title))) {
      reasons.push('Samsung device-specific smartphone page');
      return { kind: 'product', confidence: html ? 0.94 : 0.82, reasons };
    }
  }

  if (NON_PRODUCT_TITLE.test(title)) {
    reasons.push('Non-product title pattern');
    return { kind: /how to|help|news|blog/i.test(title) ? 'article' : 'navigation', confidence: 0.9, reasons };
  }
  if (productStructuredDataPresent(html) && hasPhoneSpecStructure(html)) {
    reasons.push('Product structured data and phone specification signals');
    return { kind: 'product', confidence: 0.9, reasons };
  }
  if (productStructuredDataPresent(html)) {
    reasons.push('Product structured data');
    return { kind: 'product', confidence: 0.8, reasons };
  }
  return { kind: 'unknown', confidence: 0.4, reasons: ['No reliable product or non-product signal'] };
}

export function normalizeCollectedModelName(brandName: string, value: string): string {
  let clean = decodeHtml(String(value || ''))
    .replace(/\s+Price in Pakistan\s*&\s*Specifications\s*-?\s*WhatMobile.*$/i, '')
    .replace(/\s+Price in Pakistan(?:\s+20\d{2})?.*$/i, '')
    .replace(/\s*-\s*WhatMobile\s*:*$|\s*\|\s*Samsung.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const brand = String(brandName || '').trim();
  if (brand && !/^whatmobile$/i.test(brand)) clean = clean.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '').trim();
  return clean;
}
