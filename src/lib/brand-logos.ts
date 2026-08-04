/**
 * Curated, local brand marks used as a dependable visual fallback.
 *
 * Database logos remain editable from Admin → Brands. The resolver prefers a
 * curated local mark for well-known brands so inconsistent legacy square
 * placeholders do not leak onto the public homepage.
 */
export const OFFICIAL_LOGOS: Record<string, string> = {
  samsung: '/brands/samsung.svg',
  apple: '/brands/apple.svg',
  xiaomi: '/brands/xiaomi.svg',
  mi: '/brands/xiaomi.svg',
  redmi: '/brands/xiaomi.svg',
  poco: '/brands/poco.svg',
  realme: '/brands/realme.svg',
  tecno: '/brands/tecno.svg',
  infinix: '/brands/infinix.svg',
  itel: '/brands/itel.svg',
  oneplus: '/brands/oneplus.svg',
  oppo: '/brands/oppo.svg',
  vivo: '/brands/vivo.svg',
  iqoo: '/brands/iqoo.svg',
  huawei: '/brands/huawei.svg',
  motorola: '/brands/motorola.svg',
  moto: '/brands/motorola.svg',
  honor: '/brands/honor.svg',
  nokia: '/brands/nokia.svg',
  hmd: '/brands/hmd.svg',
  google: '/brands/google.svg',
  pixel: '/brands/google.svg',
  'google pixel': '/brands/google.svg',
  nothing: '/brands/nothing.svg',
  cmf: '/brands/cmf.svg',
  sony: '/brands/sony.svg',
  asus: '/brands/asus.svg',
  lenovo: '/brands/lenovo.svg',
  zte: '/brands/zte.svg',
  nubia: '/brands/nubia.svg',
  redmagic: '/brands/redmagic.svg',
  'red magic': '/brands/redmagic.svg',
};

export function normalizeBrandKey(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getRecommendedBrandLogo(name?: string | null, slug?: string | null): string {
  const slugKey = normalizeBrandKey(slug);
  const nameKey = normalizeBrandKey(name);
  return OFFICIAL_LOGOS[slugKey] || OFFICIAL_LOGOS[nameKey] || '';
}

export function hasRecommendedBrandLogo(name?: string | null, slug?: string | null): boolean {
  return Boolean(getRecommendedBrandLogo(name, slug));
}

/**
 * Public pages prefer the normalized local asset. Unknown brands retain their
 * admin-managed logo URL and finally fall back to initials in BrandLogo.
 */
export function resolveBrandLogo(name?: string | null, slug?: string | null, databaseLogo?: string | null): string {
  return getRecommendedBrandLogo(name, slug) || String(databaseLogo || '').trim();
}
