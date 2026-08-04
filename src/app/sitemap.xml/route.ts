import { getBaseUrl } from '@/lib/urls';
import { escapeXml, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const base = getBaseUrl();
  const names = ['phones', 'brands', 'news', 'reviews', 'image', 'video'];
  const entries = names
    .map((name) => `  <sitemap>\n    <loc>${escapeXml(`${base}/${name}-sitemap.xml`)}</loc>\n  </sitemap>`)
    .join('\n');

  return xmlResponse(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`,
  );
}
