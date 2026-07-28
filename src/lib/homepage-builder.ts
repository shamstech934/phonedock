export const HOMEPAGE_SECTION_ORDER = [
  'latest', 'trending', 'camera', 'gaming', 'battery', 'budget', 'flagship',
  'upcoming', 'reviews', 'videos', 'news',
] as const;

export type OrderedHomepageSection = typeof HOMEPAGE_SECTION_ORDER[number];

export function normalizeHomepageSectionOrder(value: unknown): OrderedHomepageSection[] {
  const supplied = Array.isArray(value)
    ? value.filter((key): key is OrderedHomepageSection =>
        typeof key === 'string' && HOMEPAGE_SECTION_ORDER.includes(key as OrderedHomepageSection))
    : [];
  return [...new Set([...supplied, ...HOMEPAGE_SECTION_ORDER])];
}
