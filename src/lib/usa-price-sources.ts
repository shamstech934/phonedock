export interface UsaPriceSourceSeed {
  name: string;
  baseUrl: string;
  allowedDomains: string[];
  priority: number;
  sourceType: 'official_brand';
  market: 'US';
  currency: 'USD';
  defaultPriceType: 'us-retail';
  enabled: boolean;
  trusted: boolean;
  status: 'active';
  notes: string;
}

export const USA_OFFICIAL_PRICE_SOURCES: UsaPriceSourceSeed[] = [
  { name: 'Apple US Official', baseUrl: 'https://www.apple.com', allowedDomains: ['apple.com'], priority: 100, sourceType: 'official_brand', market: 'US', currency: 'USD', defaultPriceType: 'us-retail', enabled: true, trusted: false, status: 'active', notes: 'Official US Apple source. Trust only after a real buy/product page passes Test Source.' },
  { name: 'Samsung US Official', baseUrl: 'https://www.samsung.com/us', allowedDomains: ['samsung.com'], priority: 100, sourceType: 'official_brand', market: 'US', currency: 'USD', defaultPriceType: 'us-retail', enabled: true, trusted: false, status: 'active', notes: 'Official Samsung US store. US prices remain isolated from Pakistan PTA/Non-PTA prices.' },
  { name: 'Google Store US', baseUrl: 'https://store.google.com/us', allowedDomains: ['store.google.com'], priority: 99, sourceType: 'official_brand', market: 'US', currency: 'USD', defaultPriceType: 'us-retail', enabled: true, trusted: false, status: 'active', notes: 'Official Google Store US source. Trust only after a real phone product page test.' },
  { name: 'OnePlus US Official', baseUrl: 'https://www.oneplus.com/us', allowedDomains: ['oneplus.com'], priority: 96, sourceType: 'official_brand', market: 'US', currency: 'USD', defaultPriceType: 'us-retail', enabled: true, trusted: false, status: 'active', notes: 'Official OnePlus US source.' },
  { name: 'Motorola US Official', baseUrl: 'https://www.motorola.com/us', allowedDomains: ['motorola.com'], priority: 95, sourceType: 'official_brand', market: 'US', currency: 'USD', defaultPriceType: 'us-retail', enabled: true, trusted: false, status: 'active', notes: 'Official Motorola US source.' },
];
