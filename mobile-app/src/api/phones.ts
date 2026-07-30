import { z } from 'zod';
import { apiRequest } from './client';
import type { Brand, PageResult, Phone } from './types';

const rawBrandSchema = z.object({
  id: z.string().optional(),
  _id: z.union([z.string(), z.object({}).passthrough()]).optional(),
  name: z.string().default('Unknown brand'),
  slug: z.string().default(''),
  logo: z.string().nullish(),
  phoneCount: z.number().nullish(),
  _count: z.number().nullish(),
}).passthrough();

const rawPhoneSchema = z.object({
  id: z.string().optional(),
  _id: z.union([z.string(), z.object({}).passthrough()]).optional(),
  slug: z.string().default(''),
  modelName: z.string().default('Unknown phone'),
  brand: rawBrandSchema.nullish(),
  thumbnail: z.string().nullish(),
  heroImage: z.string().nullish(),
  pricePKR: z.number().nullish(),
  originalPricePKR: z.number().nullish(),
  overallRating: z.number().nullish(),
  ptaApproved: z.boolean().nullish(),
  releaseDate: z.string().nullish(),
  specs: z.record(z.unknown()).nullish(),
  description: z.string().nullish(),
}).passthrough();

const phonesResponseSchema = z.object({
  phones: z.array(rawPhoneSchema),
  total: z.number().default(0),
  page: z.number().default(1),
  limit: z.number().default(20),
});

function objectId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) return String(value);
  return '';
}

function normalizeBrand(raw: z.infer<typeof rawBrandSchema>): Brand {
  return {
    id: raw.id || objectId(raw._id) || raw.slug,
    name: raw.name,
    slug: raw.slug,
    logo: raw.logo || undefined,
    phoneCount: raw.phoneCount ?? raw._count ?? undefined,
  };
}

function normalizePhone(raw: z.infer<typeof rawPhoneSchema>): Phone {
  return {
    id: raw.id || objectId(raw._id) || raw.slug,
    slug: raw.slug,
    modelName: raw.modelName,
    brand: raw.brand ? normalizeBrand(raw.brand) : undefined,
    thumbnail: raw.thumbnail || undefined,
    heroImage: raw.heroImage || undefined,
    pricePKR: raw.pricePKR ?? undefined,
    originalPricePKR: raw.originalPricePKR ?? undefined,
    overallRating: raw.overallRating ?? undefined,
    ptaApproved: raw.ptaApproved ?? undefined,
    releaseDate: raw.releaseDate || undefined,
    specs: raw.specs || undefined,
    description: raw.description || undefined,
  };
}

export type PhoneQuery = {
  page?: number;
  limit?: number;
  search?: string;
  brand?: string;
  collection?: 'latest' | 'trending' | 'featured' | 'upcoming';
  year?: string;
  priceMin?: number;
  priceMax?: number;
  pta?: 'approved' | 'pending';
  fiveG?: 'yes' | 'no';
};

export async function getPhones(query: PhoneQuery = {}): Promise<PageResult<Phone>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key === 'fiveG' ? '5g' : key, String(value));
  });
  const raw = await apiRequest(`/api/phones?${params.toString()}`, phonesResponseSchema);
  return { items: raw.phones.map(normalizePhone), total: raw.total, page: raw.page, limit: raw.limit };
}

const brandsResponseSchema = z.object({ brands: z.array(rawBrandSchema) });
export async function getBrands(): Promise<Brand[]> {
  const raw = await apiRequest('/api/brands', brandsResponseSchema);
  return raw.brands.map(normalizeBrand);
}

const phoneDetailSchema = z.object({ phone: rawPhoneSchema }).passthrough();
export async function getPhone(slug: string): Promise<Phone> {
  const raw = await apiRequest(`/api/phones/${encodeURIComponent(slug)}`, phoneDetailSchema);
  return normalizePhone(raw.phone);
}

const autocompleteSchema = z.object({ phones: z.array(rawPhoneSchema) });
export async function searchPhones(query: string): Promise<Phone[]> {
  if (query.trim().length < 2) return [];
  const raw = await apiRequest(`/api/phones/autocomplete?q=${encodeURIComponent(query.trim())}`, autocompleteSchema);
  return raw.phones.map(normalizePhone);
}
