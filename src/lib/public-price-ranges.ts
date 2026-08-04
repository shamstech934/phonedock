export interface EditablePriceRange {
  id: string;
  label: string;
  min: number;
  max: number | null;
  enabled: boolean;
}

export interface PublicPriceRange extends EditablePriceRange {
  slug: string;
  description: string;
}

export const DEFAULT_PUBLIC_PRICE_RANGES: readonly EditablePriceRange[] = [
  { id: 'under-25000', label: 'Rs. 1 – 24,999', min: 1, max: 24_999, enabled: true },
  { id: '25000-50000', label: 'Rs. 25,000 – 49,999', min: 25_000, max: 49_999, enabled: true },
  { id: '50000-100000', label: 'Rs. 50,000 – 99,999', min: 50_000, max: 99_999, enabled: true },
  { id: '100000-150000', label: 'Rs. 100,000 – 149,999', min: 100_000, max: 149_999, enabled: true },
  { id: '150000-250000', label: 'Rs. 150,000 – 249,999', min: 150_000, max: 249_999, enabled: true },
  { id: 'above-250000', label: 'Rs. 250,000+', min: 250_000, max: null, enabled: true },
] as const;

function safeId(value: unknown, index: number): string {
  const cleaned = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `price-range-${index + 1}`;
}

function canonicalLabelFor(min: number, max: number | null): string | null {
  if (min <= 1 && max === 24_999) return 'Rs. 1 – 24,999';
  if (min === 25_000 && max === 49_999) return 'Rs. 25,000 – 49,999';
  if (min === 50_000 && max === 99_999) return 'Rs. 50,000 – 99,999';
  if (min === 100_000 && max === 149_999) return 'Rs. 100,000 – 149,999';
  if (min === 150_000 && max === 249_999) return 'Rs. 150,000 – 249,999';
  if (min === 250_000 && max === null) return 'Rs. 250,000+';
  return null;
}

function descriptionFor(min: number, max: number | null): string {
  if (max === null) return `Premium and flagship phones priced from PKR ${min.toLocaleString('en-PK')}`;
  if (min <= 1) return `Affordable phones priced below PKR ${(max + 1).toLocaleString('en-PK')}`;
  return `Phones priced from PKR ${min.toLocaleString('en-PK')} to ${max.toLocaleString('en-PK')}`;
}

export function normalizePublicPriceRanges(input: unknown): PublicPriceRange[] {
  if (!Array.isArray(input)) return DEFAULT_PUBLIC_PRICE_RANGES.map(toPublicRange);

  const normalized = input
    .map((raw, index): EditablePriceRange | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const min = Math.max(1, Math.floor(Number(item.min)) || 1);
      const maxValue = item.max === null || item.max === '' || item.max === undefined
        ? null
        : Math.floor(Number(item.max));
      const max = maxValue !== null && Number.isFinite(maxValue) ? maxValue : null;
      if (max !== null && max < min) return null;
      return {
        id: safeId(item.id, index),
        label: canonicalLabelFor(min, max)
          || String(item.label || '').trim()
          || `PKR ${min.toLocaleString('en-PK')}${max ? ` – ${max.toLocaleString('en-PK')}` : '+'}`,
        min,
        max,
        enabled: item.enabled !== false,
      };
    })
    .filter((item): item is EditablePriceRange => Boolean(item?.enabled))
    .sort((a, b) => a.min - b.min)
    .slice(0, 8);

  if (normalized.length < 3) return DEFAULT_PUBLIC_PRICE_RANGES.map(toPublicRange);

  // Reject overlapping or open-ended ranges followed by another range. Falling back is
  // safer than publishing duplicate phone counts caused by invalid admin configuration.
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous.max === null || current.min <= previous.max) {
      return DEFAULT_PUBLIC_PRICE_RANGES.map(toPublicRange);
    }
  }

  return normalized.map(toPublicRange);
}

function toPublicRange(range: EditablePriceRange): PublicPriceRange {
  return {
    ...range,
    slug: safeId(range.id, 0),
    description: descriptionFor(range.min, range.max),
  };
}
