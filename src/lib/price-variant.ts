import { normalizePtaPriceClass, type PtaPriceClass } from '@/lib/price-tracker-intelligence';
import { normalizeMarketPriceType, normalizePriceCurrency, normalizePriceMarket } from '@/lib/price-market';

export type PriceVariantIdentity = {
  ram?: unknown;
  storage?: unknown;
  color?: unknown;
  ptaStatus?: unknown;
  condition?: unknown;
  warrantyType?: unknown;
  market?: unknown;
  currency?: unknown;
  priceType?: unknown;
};

export type RetailVariantInference = {
  ram: string;
  storage: string;
  color: string;
  ptaStatus: '' | 'PTA Approved' | 'Non-PTA';
  condition: 'new' | 'used' | 'refurbished' | 'open-box';
  warrantyType: string;
  market: 'PK' | 'US';
  currency: 'PKR' | 'USD';
  priceType: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  variantKey: string;
};

function clean(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeMemoryLabel(value: unknown): string {
  const raw = clean(value).toUpperCase().replace(/\s+/g, '');
  if (!raw) return '';
  const m = raw.match(/^(\d+(?:\.\d+)?)(TB|GB|MB)$/i);
  if (!m) return raw;
  const n = Number(m[1]);
  return `${Number.isInteger(n) ? n : m[1]}${m[2].toUpperCase()}`;
}

export function normalizeColorLabel(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeCondition(value: unknown): 'new' | 'used' | 'refurbished' | 'open-box' {
  const text = clean(value).toLowerCase();
  if (!text) return 'new';
  if (/refurb/.test(text)) return 'refurbished';
  if (/open[-\s]?box/.test(text)) return 'open-box';
  if (/used|pre[-\s]?owned/.test(text)) return 'used';
  return 'new';
}

export function buildPriceVariantKey(input: PriceVariantIdentity): string {
  const market = normalizePriceMarket(input.market);
  const currency = normalizePriceCurrency(input.currency, market);
  const priceType = normalizeMarketPriceType({ market, priceType: input.priceType, ptaStatus: input.ptaStatus });
  const ptaClass: PtaPriceClass = normalizePtaPriceClass(input.ptaStatus);
  return [
    `market:${market}`,
    `currency:${currency}`,
    `type:${priceType}`, 
    `ram:${normalizeMemoryLabel(input.ram) || '*'}`,
    `storage:${normalizeMemoryLabel(input.storage) || '*'}`,
    `color:${normalizeColorLabel(input.color) || '*'}`,
    `pta:${ptaClass}`,
    `condition:${normalizeCondition(input.condition)}`,
    `warranty:${clean(input.warrantyType).toLowerCase() || '*'}`,
  ].join('|');
}

export function variantMatchesSelection(
  row: PriceVariantIdentity,
  selection: { ram?: string; storage?: string; color?: string; priceClass?: PtaPriceClass },
): boolean {
  if (selection.priceClass && normalizePtaPriceClass(row.ptaStatus) !== selection.priceClass) return false;
  if (selection.ram && normalizeMemoryLabel(row.ram) !== normalizeMemoryLabel(selection.ram)) return false;
  if (selection.storage && normalizeMemoryLabel(row.storage) !== normalizeMemoryLabel(selection.storage)) return false;
  if (selection.color && normalizeColorLabel(row.color) !== normalizeColorLabel(selection.color)) return false;
  return true;
}

function capacityToGb(label: string): number {
  const match = normalizeMemoryLabel(label).match(/^(\d+(?:\.\d+)?)(TB|GB)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return match[2].toUpperCase() === 'TB' ? amount * 1024 : amount;
}

/** Returns a capacity only when the source field contains one unambiguous value. */
export function inferUniqueMemoryLabel(value: unknown): string {
  const matches = clean(value).match(/\b\d+(?:\.\d+)?\s*(?:TB|GB)\b/gi) || [];
  const unique = [...new Set(matches.map(normalizeMemoryLabel).filter(Boolean))];
  return unique.length === 1 ? unique[0] : '';
}

function inferMemory(text: string): { ram: string; storage: string } {
  const normalized = text.replace(/%20/gi, ' ').replace(/[_-]+/g, ' ');
  const tokenMatches = normalized.match(/\b\d+(?:\.\d+)?\s*(?:TB|GB)\b/gi) || [];
  const tokens = [...new Set(tokenMatches.map(normalizeMemoryLabel).filter(Boolean))];
  let ram = '';
  let storage = '';

  for (const token of tokens) {
    const gb = capacityToGb(token);
    const escaped = token.replace(/([.*+?^${}()|[\]\\])/g, '\\$1').replace(/GB|TB/i, '\\s*(?:GB|TB)');
    if (new RegExp(`${escaped}\\s*(?:RAM|LPDDR)`, 'i').test(normalized) || new RegExp(`(?:RAM|LPDDR[^\\s]*)\\s*${escaped}`, 'i').test(normalized)) {
      if (gb > 0 && gb <= 32) ram = token;
    }
    if (new RegExp(`${escaped}\\s*(?:ROM|STORAGE|UFS)`, 'i').test(normalized) || new RegExp(`(?:ROM|STORAGE|UFS[^\\s]*)\\s*${escaped}`, 'i').test(normalized)) {
      storage = token;
    }
  }

  if (!ram || !storage) {
    const ordered = tokens
      .map(token => ({ token, gb: capacityToGb(token) }))
      .filter(item => item.gb > 0)
      .sort((a, b) => a.gb - b.gb);
    if (!ram) {
      const likelyRam = ordered.find(item => item.gb <= 32);
      if (likelyRam && ordered.some(item => item.gb >= 64 && item.gb > likelyRam.gb)) ram = likelyRam.token;
    }
    if (!storage) {
      const likelyStorage = [...ordered].reverse().find(item => item.gb >= 32 && item.token !== ram);
      if (likelyStorage) storage = likelyStorage.token;
    }
  }

  return { ram, storage };
}

const COLOR_CANDIDATES = [
  'natural titanium', 'desert titanium', 'black titanium', 'white titanium', 'blue titanium',
  'titanium black', 'titanium blue', 'titanium gray', 'titanium grey', 'titanium silver',
  'silver shadow', 'cobalt violet', 'sky blue', 'light green', 'light pink', 'cosmic orange',
  'midnight black', 'phantom black', 'graphite black', 'obsidian black', 'pearl white',
  'midnight', 'starlight', 'graphite', 'obsidian', 'cream', 'beige', 'violet', 'purple',
  'silver', 'black', 'white', 'blue', 'green', 'pink', 'red', 'gold', 'gray', 'grey',
  'orange', 'yellow', 'brown',
];

function inferColor(text: string): string {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const color of COLOR_CANDIDATES) {
    if (lower.includes(` ${color} `)) return color.replace(/\b\w/g, char => char.toUpperCase());
  }
  return '';
}

function inferPtaStatus(text: string): '' | 'PTA Approved' | 'Non-PTA' {
  const normalized = text.toLowerCase().replace(/[_]+/g, ' ');
  if (/\bnon[-\s]?pta\b|\bwithout\s+pta\b|\bnot\s+pta\s+approved\b|\bunapproved\b/.test(normalized)) return 'Non-PTA';
  if (/\bpta[-\s]?approved\b|\bofficial\s+pta\b/.test(normalized)) return 'PTA Approved';
  return '';
}

function inferWarranty(text: string): string {
  const lower = text.toLowerCase();
  if (/without\s+warranty|no\s+warranty/.test(lower)) return 'No Warranty';
  if (/official\s+warranty|brand\s+warranty/.test(lower)) return 'Official Warranty';
  if (/international\s+warranty/.test(lower)) return 'International Warranty';
  if (/shop\s+warranty|seller\s+warranty|store\s+warranty/.test(lower)) return 'Shop Warranty';
  return '';
}

/**
 * Conservative retailer inference. Only explicit title/URL evidence is used;
 * unknown PTA remains unknown and cannot be auto-published.
 */
export function inferRetailVariantIdentity(input: {
  title?: unknown;
  productUrl?: unknown;
  existing?: PriceVariantIdentity;
}): RetailVariantInference {
  const title = clean(input.title);
  const productUrl = clean(input.productUrl);
  let urlText = '';
  try { urlText = decodeURIComponent(new URL(productUrl).pathname); } catch { urlText = productUrl; }
  const evidence = `${title} ${urlText}`.trim();
  const existing = input.existing || {};
  const memory = inferMemory(evidence);
  const market = normalizePriceMarket(existing.market);
  const currency = normalizePriceCurrency(existing.currency, market);

  const ram = normalizeMemoryLabel(existing.ram) || memory.ram;
  const storage = normalizeMemoryLabel(existing.storage) || memory.storage;
  const color = clean(existing.color) || inferColor(evidence);
  const existingPtaClass = normalizePtaPriceClass(existing.ptaStatus);
  const inferredPtaStatus = inferPtaStatus(evidence);
  const ptaStatus: '' | 'PTA Approved' | 'Non-PTA' = existingPtaClass === 'pta-approved'
    ? 'PTA Approved'
    : existingPtaClass === 'non-pta'
      ? 'Non-PTA'
      : inferredPtaStatus;
  const condition = clean(existing.condition) ? normalizeCondition(existing.condition) : normalizeCondition(evidence);
  const warrantyType = clean(existing.warrantyType) || inferWarranty(evidence);
  const priceType = normalizeMarketPriceType({ market, priceType: existing.priceType, ptaStatus });

  return {
    ram,
    storage,
    color,
    ptaStatus,
    condition,
    warrantyType,
    market,
    currency,
    priceType,
    variantKey: buildPriceVariantKey({ ram, storage, color, ptaStatus, condition, warrantyType, market, currency, priceType }),
  };
}
