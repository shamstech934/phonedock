/**
 * Shared canonical URL helper.
 *
 * Search-facing URLs must always use the single HTTPS, non-www origin even
 * when an environment variable was entered with www, http, or a trailing slash.
 */
export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com';

  try {
    const url = new URL(configured);
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./i, '');
    url.port = '';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return 'https://specsdekh.com';
  }
}
