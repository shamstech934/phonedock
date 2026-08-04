/**
 * Shared canonical URL helper.
 *
 * Production SEO endpoints must always emit one origin so Google does not see
 * different sitemap/canonical variants from environment drift (www, http, or
 * trailing slashes). Local development and Vercel preview URLs remain usable.
 */
export function getBaseUrl(): string {
  const configured = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();

  if (configured) {
    try {
      const url = new URL(configured);
      const hostname = url.hostname.toLowerCase();
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      const isPreview = hostname.endsWith('.vercel.app');

      if (isLocal || isPreview) {
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/+$/, '');
      }
    } catch {
      // Invalid environment values must never leak into canonical SEO output.
    }
  }

  return 'https://specsdekh.com';
}
