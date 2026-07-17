/**
 * Shared URL helper — use this everywhere instead of hardcoding phonedock.pk
 */

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';
}