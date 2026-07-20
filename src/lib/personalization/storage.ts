import type { Phone } from '@/components/shared/types';

const WISHLIST_KEY = 'pd_wishlist_v1';
const RECENT_KEY = 'pd_recently_viewed_v1';
const MAX_RECENT = 18;
const EVENT_NAME = 'phonedock:personalization';

export type StoredPhone = Pick<Phone,
  'id' | 'slug' | 'modelName' | 'thumbnail' | 'pricePKR' | 'originalPricePKR' |
  'overallRating' | 'ptaApproved' | 'trending' | 'upcoming' | 'featured' |
  'brandId' | 'description' | 'cameraScore' | 'performanceScore' | 'batteryScore' |
  'displayScore' | 'valueScore' | 'ptaStatus' | 'releaseDate'
> & {
  brand?: Phone['brand'];
  specs?: Phone['specs'];
  viewedAt?: string;
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function read(key: string): StoredPhone[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function write(key: string, items: StoredPhone[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
}

export function compactPhone(phone: Phone): StoredPhone {
  return {
    id: phone.id,
    slug: phone.slug,
    modelName: phone.modelName,
    thumbnail: phone.thumbnail,
    pricePKR: phone.pricePKR,
    originalPricePKR: phone.originalPricePKR,
    overallRating: phone.overallRating,
    ptaApproved: phone.ptaApproved,
    trending: phone.trending,
    upcoming: phone.upcoming,
    featured: phone.featured,
    brandId: phone.brandId,
    brand: phone.brand,
    description: phone.description,
    cameraScore: phone.cameraScore,
    performanceScore: phone.performanceScore,
    batteryScore: phone.batteryScore,
    displayScore: phone.displayScore,
    valueScore: phone.valueScore,
    ptaStatus: phone.ptaStatus,
    releaseDate: phone.releaseDate,
    specs: phone.specs,
  };
}

export function getWishlist() { return read(WISHLIST_KEY); }
export function isWishlisted(slug: string) { return getWishlist().some(item => item.slug === slug); }
export function toggleWishlist(phone: Phone) {
  const current = getWishlist();
  const exists = current.some(item => item.slug === phone.slug);
  const next = exists
    ? current.filter(item => item.slug !== phone.slug)
    : [compactPhone(phone), ...current].slice(0, 60);
  write(WISHLIST_KEY, next);
  return !exists;
}
export function clearWishlist() { write(WISHLIST_KEY, []); }

export function getRecentlyViewed() { return read(RECENT_KEY); }
export function addRecentlyViewed(phone: Phone) {
  const item = { ...compactPhone(phone), viewedAt: new Date().toISOString() };
  const next = [item, ...getRecentlyViewed().filter(existing => existing.slug !== phone.slug)].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
}
export function clearRecentlyViewed() { write(RECENT_KEY, []); }

export function subscribePersonalization(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}
