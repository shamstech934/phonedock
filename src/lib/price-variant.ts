import { normalizePtaPriceClass, type PtaPriceClass } from '@/lib/price-tracker-intelligence';

export type PriceVariantIdentity = {
  ram?: unknown;
  storage?: unknown;
  color?: unknown;
  ptaStatus?: unknown;
  condition?: unknown;
  warrantyType?: unknown;
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

export function normalizeCondition(value: unknown): string {
  const text = clean(value).toLowerCase();
  if (!text) return 'new';
  if (/refurb/.test(text)) return 'refurbished';
  if (/open[-\s]?box/.test(text)) return 'open-box';
  if (/used|pre[-\s]?owned/.test(text)) return 'used';
  return 'new';
}

export function buildPriceVariantKey(input: PriceVariantIdentity): string {
  const ptaClass: PtaPriceClass = normalizePtaPriceClass(input.ptaStatus);
  return [
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
