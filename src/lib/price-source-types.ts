export const PRICE_SOURCE_TYPE_OPTIONS = [
  {
    value: 'retailer',
    label: 'Retailer',
    description: 'A store that sells phones directly, such as PriceOye, Mega.pk or Shophive.',
  },
  {
    value: 'marketplace',
    label: 'Marketplace',
    description: 'A multi-seller marketplace such as Daraz. Listings normally require manual review.',
  },
  {
    value: 'official',
    label: 'Official Store',
    description: 'An official brand-owned online store with direct checkout and local pricing.',
  },
  {
    value: 'official_brand',
    label: 'Official Brand',
    description: 'An official manufacturer website used for verified specifications, images and launch information.',
  },
  {
    value: 'reference_site',
    label: 'Reference Site',
    description: 'A trusted information or price-reference website such as WhatMobile or GSMArena.',
  },
  {
    value: 'distributor',
    label: 'Distributor',
    description: 'An authorised distributor or importer that publishes local availability or recommended pricing.',
  },
  {
    value: 'api',
    label: 'API',
    description: 'A structured API or feed endpoint used for automated data collection.',
  },
  {
    value: 'rss_feed',
    label: 'RSS Feed',
    description: 'An RSS or Atom feed used for launches, news and rumour monitoring.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'A source maintained manually by an administrator without automated crawling.',
  },
] as const;

export type PriceSourceType = (typeof PRICE_SOURCE_TYPE_OPTIONS)[number]['value'];

export const PRICE_SOURCE_TYPES = PRICE_SOURCE_TYPE_OPTIONS.map(option => option.value) as readonly PriceSourceType[];

export function getPriceSourceTypeLabel(value: string): string {
  return PRICE_SOURCE_TYPE_OPTIONS.find(option => option.value === value)?.label || value;
}

export function normalizePriceSourceType(value: unknown): PriceSourceType {
  const candidate = String(value || 'retailer') as PriceSourceType;
  return PRICE_SOURCE_TYPES.includes(candidate) ? candidate : 'retailer';
}

export function priceSourceSupportsAutomatedPriceTest(value: PriceSourceType): boolean {
  return value !== 'manual' && value !== 'rss_feed';
}
