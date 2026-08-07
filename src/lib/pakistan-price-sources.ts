export interface PakistanPriceSourceSeed {
  name: string;
  baseUrl: string;
  allowedDomains: string[];
  priority: number;
  sourceType: 'official_brand';
  market: 'PK';
  currency: 'PKR';
  defaultPriceType: 'pta-approved';
  enabled: boolean;
  trusted: boolean;
  status: 'active';
  notes: string;
}

export const PAKISTAN_OFFICIAL_PRICE_SOURCES: PakistanPriceSourceSeed[] = [
  { name: 'Samsung Pakistan Official', baseUrl: 'https://www.samsung.com/pk', allowedDomains: ['samsung.com'], priority: 100, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue/store. Trust only after a real product page passes Test Source.' },
  { name: 'vivo Pakistan Official Store', baseUrl: 'https://shop.vivo.com/pk', allowedDomains: ['shop.vivo.com'], priority: 99, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan online store. Trust only after a real product page passes Test Source.' },
  { name: 'vivo Pakistan Official', baseUrl: 'https://www.vivo.com/pk', allowedDomains: ['vivo.com'], priority: 98, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Some pages may not expose a live price.' },
  { name: 'Xiaomi Pakistan Official Store', baseUrl: 'https://mistore.pk', allowedDomains: ['mistore.pk'], priority: 97, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Xiaomi Pakistan store. Trust only after a product page test.' },
  { name: 'realme Pakistan Official', baseUrl: 'https://www.realme.com/pk', allowedDomains: ['realme.com'], priority: 95, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Price availability varies by model.' },
  { name: 'OPPO Pakistan Official', baseUrl: 'https://www.oppo.com/pk', allowedDomains: ['oppo.com'], priority: 94, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Price availability varies by model.' },
  { name: 'Infinix Pakistan Official', baseUrl: 'https://pk.infinixmobility.com', allowedDomains: ['pk.infinixmobility.com'], priority: 92, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Price availability varies by model.' },
  { name: 'TECNO Pakistan Official', baseUrl: 'https://www.tecno-mobile.com/pak', allowedDomains: ['tecno-mobile.com'], priority: 92, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Price availability varies by model.' },
  { name: 'HONOR Pakistan Official', baseUrl: 'https://www.honor.com/pk', allowedDomains: ['honor.com'], priority: 91, sourceType: 'official_brand', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', enabled: true, trusted: false, status: 'active', notes: 'Official Pakistan catalogue. Price availability varies by model.' },
];
