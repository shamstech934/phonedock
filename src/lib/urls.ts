/**
 * Shared URL helper — use this everywhere instead of hardcoding specsdekh.com
 */

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com';
}