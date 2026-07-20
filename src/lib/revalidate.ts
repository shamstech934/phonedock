/**
 * Targeted cache revalidation for price updates.
 * When a phone's price changes, we revalidate the pages that display it.
 */
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Paths that display phone prices and should be revalidated on price change.
 * Kept minimal — only pages that show pricePKR or currentPrice.
 */
const PRICE_AFFECTED_PATHS = [
  '/phones',
  '/',
  '/best-value-phone',
  '/best-budget-phone',
  '/best-gaming-phone',
  '/best-camera-phone',
  '/best-battery-phone',
  '/price-ranges',
  '/upcoming',
];

/**
 * Revalidate all pages that may display a phone's price.
 * Call this AFTER a successful price update to Phone document.
 * Uses 'page' scope (default) which is lightweight — only purges
 * the specific paths, not the full cache.
 */
export function revalidatePricePages(phoneSlug?: string) {
  for (const path of PRICE_AFFECTED_PATHS) {
    try {
      revalidatePath(path);
    } catch (e) {
      // In development or test, revalidatePath may throw — fail silently
      console.warn(`[revalidate] Failed to revalidate ${path}:`, e);
    }
  }

  // If we have the phone slug, also revalidate its detail page
  if (phoneSlug) {
    try {
      revalidatePath(`/phones/${phoneSlug}`);
    } catch (e) {
      console.warn(`[revalidate] Failed to revalidate /phones/${phoneSlug}:`, e);
    }
  }
}

/**
 * Revalidate cached public data after admin content mutations.
 * This keeps the homepage/API cache fresh without waiting for the 5-minute TTL.
 */
export function revalidatePublicContent(options: {
  phoneSlug?: string;
  includeBrands?: boolean;
  includeNews?: boolean;
  includeVideos?: boolean;
  includeSponsors?: boolean;
} = {}) {
  try {
    revalidateTag('home-data', 'max');
  } catch (e) {
    console.warn('[revalidate] Failed to revalidate home-data tag:', e);
  }

  const paths = new Set<string>(['/']);
  if (options.phoneSlug) {
    paths.add('/phones');
    paths.add(`/phones/${options.phoneSlug}`);
    paths.add('/compare');
    paths.add('/search');
    paths.add('/upcoming');
    paths.add('/price-ranges');
  }
  if (options.includeBrands) paths.add('/brands');
  if (options.includeNews) paths.add('/news');
  if (options.includeVideos) paths.add('/videos');
  if (options.includeSponsors) paths.add('/advertise');

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (e) {
      console.warn(`[revalidate] Failed to revalidate ${path}:`, e);
    }
  }
}
