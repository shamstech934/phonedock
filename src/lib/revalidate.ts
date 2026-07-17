/**
 * Targeted cache revalidation for price updates.
 * When a phone's price changes, we revalidate the pages that display it.
 */
import { revalidatePath } from 'next/cache';

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