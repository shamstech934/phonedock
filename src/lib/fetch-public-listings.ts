import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { Brand, Phone, PhoneSpecs } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/sanitize';
import { buildSpecsMap, attachSpecsToRawPhones } from '@/app/api/[[...path]]/handlers/helpers';
import type { Brand as BrandType, Phone as PhoneType } from '@/components/shared/types';
import { getPriceCategory } from '@/lib/price-categories';

export interface PhoneListParams {
  page?: string;
  q?: string;
  brand?: string;
  price?: string;
  priceCategory?: string;
  ram?: string;
  storage?: string;
  sort?: string;
  '5g'?: string;
  nfc?: string;
  pta?: string;
  priceDrop?: string;
  collection?: string;
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
  return brands.map(brand => ({
    id: brand._id.toString(),
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo || '',
    country: brand.country || '',
    description: brand.description || '',
    _count: { phones: countMap.get(brand._id.toString()) || 0 },
  }));
});
export const fetchPublicBrands = unstable_cache(loadPublicBrands, ['public-brands-v1'], { revalidate: 900, tags: ['brands', 'phones'] });

async function loadPhoneListing(params: PhoneListParams): Promise<{ phones: PhoneType[]; total: number; queryKey: string }> {
  await connectDB();
  const page = Math.max(1, Number.parseInt(params.page || '1', 10) || 1);
  const limit = 20;
  const filter: Record<string, unknown> = { active: true, status: 'published' };
  const collection = params.collection || '';
  if (collection === 'trending') filter.trending = true;
  if (collection === 'featured') filter.featured = true;
  if (collection === 'upcoming') filter.upcoming = true;

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
  if (category?.missing) {
    filter.$and = [{ $or: [{ pricePKR: { $exists: false } }, { pricePKR: null }, { pricePKR: { $lte: 0 } }] }];
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
  const ram = Number.parseFloat(params.ram || '');
  const storage = Number.parseFloat(params.storage || '');
  if (Number.isFinite(ram)) specFilter.ramGB = { $gte: ram };
  if (Number.isFinite(storage)) specFilter.storageGB = { $gte: storage };
  if (params['5g'] === 'yes') specFilter.fiveG = { $regex: /yes|supported|true/i };
  else if (params['5g'] === 'no') specFilter.fiveG = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };
  if (params.nfc === 'yes') specFilter.nfc = { $regex: /yes|supported|true/i };
  else if (params.nfc === 'no') specFilter.nfc = { $in: [null, '', 'No', 'no', 'Not Supported', 'None'] };
  if (Object.keys(specFilter).length > 0) {
    const ids = await PhoneSpecs.find(specFilter).distinct('phoneId');
    filter._id = { $in: ids };
  }

  const sortMap: Record<string, { field: string; order: 1 | -1 }> = {
    newest: { field: 'createdAt', order: -1 },
    trending: { field: 'trending', order: -1 },
    'price-low': { field: 'pricePKR', order: 1 },
    'price-high': { field: 'pricePKR', order: -1 },
    rating: { field: 'overallRating', order: -1 },
    name: { field: 'modelName', order: 1 },
  };
  const sorting = sortMap[params.sort || 'newest'] || sortMap.newest;

  const [rawPhones, rawTotal] = await Promise.all([
    Phone.find(filter)
      .sort({ [sorting.field]: sorting.order })
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
  if (range?.min) apiParams.set('priceMin', String(range.min));
  if (range?.max) apiParams.set('priceMax', String(range.max));
  if (category?.missing) apiParams.set('priceMissing', 'true');
  else if (category) {
    if (category.min !== undefined) apiParams.set('priceMin', String(category.min));
    if (category.max !== undefined) apiParams.set('priceMax', String(category.max));
  }
  if (Number.isFinite(ram)) apiParams.set('ramMin', String(ram));
  if (Number.isFinite(storage)) apiParams.set('storageMin', String(storage));
  apiParams.set('sort', sorting.field);
  apiParams.set('order', sorting.order === 1 ? 'asc' : 'desc');
  if (params.pta && params.pta !== 'all') apiParams.set('pta', params.pta);
  if (params['5g'] && params['5g'] !== 'all') apiParams.set('5g', params['5g']);
  if (params.nfc && params.nfc !== 'all') apiParams.set('nfc', params.nfc);
  if (params.priceDrop === 'true') apiParams.set('priceDrop', 'true');
  if (collection) apiParams.set('collection', collection);

  return { phones, total, queryKey: apiParams.toString() };
}
export const fetchPhoneListing = unstable_cache(loadPhoneListing, ['public-phone-listing-v1'], { revalidate: 300, tags: ['phones'] });
