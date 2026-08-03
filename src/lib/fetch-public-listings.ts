import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { Brand, Phone, PhoneSpecs } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/sanitize';
import { buildSpecsMap, attachSpecsToRawPhones } from '@/app/api/[[...path]]/handlers/helpers';
import type { Brand as BrandType, Phone as PhoneType } from '@/components/shared/types';
import { getPriceCategory } from '@/lib/price-categories';
import { getPublicPhoneFilter } from '@/lib/phone-publication';
import { numericSpecClause } from '@/lib/spec-filter-fallback';

export interface PhoneListParams {
  page?: string;
  limit?: string;
  q?: string;
  brand?: string;
  price?: string;
  priceCategory?: string;
  priceMin?: string;
  priceMax?: string;
  displayType?: string;
  screenMin?: string;
  screenMax?: string;
  refreshMin?: string;
  cameraMin?: string;
  batteryMin?: string;
  chipset?: string;
  ram?: string;
  storage?: string;
  sort?: string;
  '5g'?: string;
  nfc?: string;
  pta?: string;
  priceDrop?: string;
  collection?: string;
  year?: string;
  availability?: string;
}

const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  under20k: { max: 20000 },
  '20k-40k': { min: 20000, max: 40000 },
  '40k-60k': { min: 40000, max: 60000 },
  '60k-100k': { min: 60000, max: 100000 },
  above100k: { min: 100000 },
};

const loadPublicBrands = cache(async (): Promise<BrandType[]> => {
  await connectDB();
  const [brands, counts] = await Promise.all([
    Brand.find({ active: true })
      .select('name slug logo country description sortOrder')
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    Phone.aggregate([
      { $match: { active: true, status: 'published' } },
      { $group: { _id: '$brandId', phones: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(counts.map((item: { _id: { toString(): string }; phones: number }) => [item._id.toString(), item.phones]));
  return brands
    .map(brand => ({
      id: brand._id.toString(),
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo || '',
      country: brand.country || '',
      description: brand.description || '',
      _count: { phones: countMap.get(brand._id.toString()) || 0 },
    }))
    // Public brand directory should grow with real imported/published data.
    // Empty catalogue placeholders remain manageable in Admin → Brands, but
    // are intentionally hidden from visitors until at least one phone exists.
    .filter(brand => (brand._count?.phones || 0) > 0)
    .sort((a, b) => {
      const countDifference = (b._count?.phones || 0) - (a._count?.phones || 0);
      return countDifference || a.name.localeCompare(b.name);
    });
});
export const fetchPublicBrands = unstable_cache(loadPublicBrands, ['public-brands-v2-non-empty'], { revalidate: 900, tags: ['brands', 'phones'] });

async function loadPublicBrandDetail(slug: string): Promise<{ brand: BrandType | null; phones: PhoneType[] }> {
  await connectDB();
  const rawBrand = await Brand.findOne({ slug, active: true })
    .select('name slug logo country description')
    .lean();
  if (!rawBrand) return { brand: null, phones: [] };

  const rawPhones = await Phone.find({
    ...getPublicPhoneFilter(),
    brandId: rawBrand._id,
  })
    .sort({ createdAt: -1 })
    .limit(250)
    .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
    .populate('brand')
    .lean();
  const ids = rawPhones.map(phone => phone._id.toString());
  const specs = ids.length ? await PhoneSpecs.find({ phoneId: { $in: ids } }).lean() : [];

  return {
    brand: {
      id: rawBrand._id.toString(),
      name: rawBrand.name,
      slug: rawBrand.slug,
      logo: rawBrand.logo || '',
      country: rawBrand.country || '',
      description: rawBrand.description || '',
      _count: { phones: rawPhones.length },
    },
    phones: attachSpecsToRawPhones(rawPhones, buildSpecsMap(specs)) as unknown as PhoneType[],
  };
}
export const fetchPublicBrandDetail = unstable_cache(
  loadPublicBrandDetail,
  ['public-brand-detail-v1'],
  { revalidate: 300, tags: ['brands', 'phones'] },
);

async function loadPhoneListing(params: PhoneListParams): Promise<{ phones: PhoneType[]; total: number; queryKey: string }> {
  await connectDB();
  const page = Math.max(1, Number.parseInt(params.page || '1', 10) || 1);
  const requestedLimit = Number.parseInt(params.limit || '20', 10);
  const limit = [12, 20, 32].includes(requestedLimit) ? requestedLimit : 20;
  const collection = params.collection || '';
  const filter: Record<string, unknown> = getPublicPhoneFilter({
    cardReady: ['latest', 'trending', 'featured', 'upcoming'].includes(collection),
    upcoming: collection === 'upcoming',
  });
  const andFilters: Record<string, unknown>[] = [];
  if (collection === 'trending') filter.trending = true;
  if (collection === 'featured') filter.featured = true;
  if (collection === 'upcoming') filter.upcoming = true;
  if (/^\d{4}$/.test(params.year || '')) filter.releaseDate = { $regex: `^${params.year}` };
  if (params.availability === 'available') {
    andFilters.push({ $or: [{ availabilityStatus: 'available' }, { availabilityStatus: { $exists: false }, upcoming: { $ne: true } }] });
  } else if (params.availability === 'coming_soon') {
    andFilters.push({ $or: [{ availabilityStatus: 'coming_soon' }, { availabilityStatus: { $exists: false }, upcoming: true }] });
  } else if (params.availability) {
    filter.availabilityStatus = params.availability;
  }

  if (params.q) {
    const safe = escapeRegex(params.q);
    filter.$or = [
      { modelName: { $regex: safe, $options: 'i' } },
      { slug: { $regex: safe, $options: 'i' } },
    ];
  }
  if (params.brand && params.brand !== 'all') {
    const brand = await Brand.findOne({ slug: params.brand }).select('_id').lean();
    if (brand) filter.brandId = brand._id;
  }
  const range = params.price ? PRICE_RANGES[params.price] : undefined;
  const category = getPriceCategory(params.priceCategory);
  const directPriceMin = Number.parseFloat(params.priceMin || '');
  const directPriceMax = Number.parseFloat(params.priceMax || '');
  if (category?.missing) {
    andFilters.push({ $or: [{ pricePKR: { $exists: false } }, { pricePKR: null }, { pricePKR: { $lte: 0 } }] });
  } else if (Number.isFinite(directPriceMin) || Number.isFinite(directPriceMax)) {
    filter.pricePKR = {
      ...(Number.isFinite(directPriceMin) && directPriceMin > 0 ? { $gte: directPriceMin } : {}),
      ...(Number.isFinite(directPriceMax) && directPriceMax > 0 ? { $lte: directPriceMax } : {}),
    };
  } else if (category) {
    filter.pricePKR = {
      ...(category.min !== undefined ? { $gte: category.min } : {}),
      ...(category.max !== undefined ? { $lte: category.max } : {}),
    };
  } else if (range?.min || range?.max) {
    filter.pricePKR = {
      ...(range.min ? { $gte: range.min } : {}),
      ...(range.max ? { $lte: range.max } : {}),
    };
  }
  if (params.pta === 'approved') filter.ptaApproved = true;
  else if (params.pta === 'pending') filter.ptaApproved = false;
  if (params.priceDrop === 'true') filter.$expr = { $gt: ['$originalPricePKR', '$pricePKR'] };

  const specFilter: Record<string, unknown> = {};
  const numericClauses: Record<string, unknown>[] = [];
  const ram = Number.parseFloat(params.ram || '');
  const storage = Number.parseFloat(params.storage || '');
  const screenMin = Number.parseFloat(params.screenMin || '');
  const screenMax = Number.parseFloat(params.screenMax || '');
  const refreshMin = Number.parseFloat(params.refreshMin || '');
  const cameraMin = Number.parseFloat(params.cameraMin || '');
  const batteryMin = Number.parseFloat(params.batteryMin || '');
  if (Number.isFinite(ram)) numericClauses.push(numericSpecClause({ numericField: 'ramGB', textField: 'ram', kind: 'ram', min: ram, max: ram }));
  if (Number.isFinite(storage)) numericClauses.push(numericSpecClause({ numericField: 'storageGB', textField: 'storage', kind: 'storage', min: storage, max: storage }));
  if (Number.isFinite(screenMin) || Number.isFinite(screenMax)) numericClauses.push(numericSpecClause({ numericField: 'screenSizeInch', textField: 'display', kind: 'screen', min: Number.isFinite(screenMin) ? screenMin : undefined, max: Number.isFinite(screenMax) ? screenMax : undefined }));
  if (Number.isFinite(cameraMin)) numericClauses.push(numericSpecClause({ numericField: 'mainCameraMP', textField: 'mainCamera', kind: 'camera', min: cameraMin }));
  if (Number.isFinite(batteryMin)) numericClauses.push(numericSpecClause({ numericField: 'batteryMAh', textField: 'battery', kind: 'battery', min: batteryMin }));
  if (params.displayType) specFilter.displayType = { $regex: escapeRegex(params.displayType), $options: 'i' };
  if (params.chipset) specFilter.chipset = { $regex: escapeRegex(params.chipset), $options: 'i' };
  if (Number.isFinite(refreshMin)) {
    const refreshPatterns: Record<number, string> = { 90: '(?:90|120|144|165|180|240)\\s*hz', 120: '(?:120|144|165|180|240)\\s*hz', 144: '(?:144|165|180|240)\\s*hz' };
    specFilter.refreshRate = { $regex: refreshPatterns[refreshMin] || `${Math.round(refreshMin)}\\s*hz`, $options: 'i' };
  }
  if (params['5g'] === 'yes') specFilter.fiveG = { $regex: /yes|supported|true/i };
  else if (params['5g'] === 'no') specFilter.fiveG = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };
  if (params.nfc === 'yes') specFilter.nfc = { $regex: /yes|supported|true/i };
  else if (params.nfc === 'no') specFilter.nfc = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };
  if (numericClauses.length) specFilter.$and = numericClauses;
  if (Object.keys(specFilter).length > 0) {
    const ids = await PhoneSpecs.find(specFilter).distinct('phoneId');
    filter._id = { $in: ids };
  }
  if (andFilters.length > 0) filter.$and = andFilters;

  const sortMap: Record<string, { field: string; order: 1 | -1 }> = {
    newest: { field: 'releaseDate', order: -1 },
    trending: { field: 'trending', order: -1 },
    'price-low': { field: 'pricePKR', order: 1 },
    'price-high': { field: 'pricePKR', order: -1 },
    rating: { field: 'overallRating', order: -1 },
    performance: { field: 'performanceScore', order: -1 },
    camera: { field: 'cameraScore', order: -1 },
    battery: { field: 'batteryScore', order: -1 },
    value: { field: 'valueScore', order: -1 },
    name: { field: 'modelName', order: 1 },
  };
  const sorting = sortMap[params.sort || 'newest'] || sortMap.newest;

  const mongoSort = sorting.field === 'releaseDate'
    ? { releaseDate: -1 as const, availableFrom: -1 as const, pakistanLaunchAt: -1 as const, announcedAt: -1 as const, createdAt: -1 as const, modelName: 1 as const }
    : { [sorting.field]: sorting.order, modelName: 1 as const };

  const [rawPhones, rawTotal] = await Promise.all([
    Phone.find(filter)
      .sort(mongoSort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
      .populate('brand')
      .lean(),
    Phone.countDocuments(filter),
  ]);
  // The Latest collection is intentionally capped so its View All page does not
  // become indistinguishable from the complete phone catalogue.
  const total = collection === 'latest' ? Math.min(rawTotal, 40) : rawTotal;
  const ids = rawPhones.map(phone => phone._id.toString());
  const specs = ids.length ? await PhoneSpecs.find({ phoneId: { $in: ids } }).lean() : [];
  const phones = attachSpecsToRawPhones(rawPhones, buildSpecsMap(specs)) as unknown as PhoneType[];

  const apiParams = new URLSearchParams();
  apiParams.set('page', String(page));
  apiParams.set('limit', String(limit));
  if (params.q) apiParams.set('search', params.q);
  if (params.brand && params.brand !== 'all') apiParams.set('brand', params.brand);
  if (Number.isFinite(directPriceMin) && directPriceMin > 0) apiParams.set('priceMin', String(directPriceMin));
  else if (range?.min) apiParams.set('priceMin', String(range.min));
  if (Number.isFinite(directPriceMax) && directPriceMax > 0) apiParams.set('priceMax', String(directPriceMax));
  else if (range?.max) apiParams.set('priceMax', String(range.max));
  if (category?.missing) apiParams.set('priceMissing', 'true');
  else if (category) {
    if (category.min !== undefined) apiParams.set('priceMin', String(category.min));
    if (category.max !== undefined) apiParams.set('priceMax', String(category.max));
  }
  if (Number.isFinite(ram)) { apiParams.set('ramMin', String(ram)); apiParams.set('ramMax', String(ram)); }
  if (Number.isFinite(storage)) { apiParams.set('storageMin', String(storage)); apiParams.set('storageMax', String(storage)); }
  if (Number.isFinite(screenMin)) apiParams.set('screenMin', String(screenMin));
  if (Number.isFinite(screenMax)) apiParams.set('screenMax', String(screenMax));
  if (Number.isFinite(refreshMin)) apiParams.set('refreshMin', String(refreshMin));
  if (Number.isFinite(cameraMin)) apiParams.set('cameraMin', String(cameraMin));
  if (Number.isFinite(batteryMin)) apiParams.set('batteryMin', String(batteryMin));
  if (params.displayType) apiParams.set('displayType', params.displayType);
  if (params.chipset) apiParams.set('chipset', params.chipset);
  apiParams.set('sort', sorting.field);
  apiParams.set('order', sorting.order === 1 ? 'asc' : 'desc');
  if (params.pta && params.pta !== 'all') apiParams.set('pta', params.pta);
  if (params['5g'] && params['5g'] !== 'all') apiParams.set('5g', params['5g']);
  if (params.nfc && params.nfc !== 'all') apiParams.set('nfc', params.nfc);
  if (params.priceDrop === 'true') apiParams.set('priceDrop', 'true');
  if (collection) apiParams.set('collection', collection);
  if (/^\d{4}$/.test(params.year || '')) apiParams.set('year', params.year!);
  if (params.availability) apiParams.set('availability', params.availability);

  return { phones, total, queryKey: apiParams.toString() };
}
export const fetchPhoneListing = unstable_cache(loadPhoneListing, ['public-phone-listing-v2-exact-variant-tokens'], { revalidate: 300, tags: ['phones'] });
