import { getBaseUrl } from '@/lib/urls';
import { escapeXml, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getBaseUrl();
  const names = ['phones', 'brands', 'news', 'reviews', 'image', 'video'];
  const now = new Date().toISOString();
  const entries = names.map((name) => `  <sitemap>\n    <loc>${escapeXml(`${base}/${name}-sitemap.xml`)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join('\n');
  return xmlResponse(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`);
}
