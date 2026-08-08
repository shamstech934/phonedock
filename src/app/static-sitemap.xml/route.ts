import { getBaseUrl } from '@/lib/urls';
import { escapeXml, xmlResponse } from '@/lib/seo-sitemaps/xml';
import { SEO_SPEC_LANDINGS } from '@/lib/seo-growth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATIC_PATHS = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/phones', changefreq: 'daily', priority: '0.9' },
  { path: '/brands', changefreq: 'weekly', priority: '0.8' },
  { path: '/compare', changefreq: 'weekly', priority: '0.8' },
  { path: '/rankings', changefreq: 'weekly', priority: '0.8' },
  { path: '/news', changefreq: 'daily', priority: '0.7' },
  { path: '/videos', changefreq: 'daily', priority: '0.7' },
  { path: '/reviews', changefreq: 'daily', priority: '0.7' },
  { path: '/upcoming', changefreq: 'weekly', priority: '0.8' },
  { path: '/best-camera-phone', changefreq: 'weekly', priority: '0.8' },
  { path: '/best-battery-phone', changefreq: 'weekly', priority: '0.8' },
  { path: '/best-gaming-phone', changefreq: 'weekly', priority: '0.8' },
  { path: '/best-budget-phone', changefreq: 'weekly', priority: '0.8' },
  { path: '/best-value-phone', changefreq: 'weekly', priority: '0.8' },
  { path: '/price-ranges', changefreq: 'weekly', priority: '0.7' },
  { path: '/buying-guides', changefreq: 'weekly', priority: '0.8' },
  { path: '/buying-guides/gaming-phones', changefreq: 'weekly', priority: '0.8' },
  { path: '/buying-guides/camera-phones', changefreq: 'weekly', priority: '0.8' },
  { path: '/buying-guides/battery-phones', changefreq: 'weekly', priority: '0.8' },
  { path: '/buying-guides/value-phones', changefreq: 'weekly', priority: '0.8' },
  { path: '/buying-guides/pta-approved-phones', changefreq: 'weekly', priority: '0.8' },
  { path: '/phone-finder', changefreq: 'weekly', priority: '0.8' },
  { path: '/faq', changefreq: 'monthly', priority: '0.5' },
  { path: '/about', changefreq: 'monthly', priority: '0.4' },
] as const;

export async function GET() {
  const base = getBaseUrl();
  const rows = STATIC_PATHS.map(({ path, changefreq, priority }) => {
    const url = path === '/' ? base : `${base}${path}`;
    return `  <url><loc>${escapeXml(url)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  });

  rows.push(...SEO_SPEC_LANDINGS.map((item) =>
    `  <url><loc>${escapeXml(`${base}/phones-by-spec/${item.type}/${item.value}`)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
  ));

  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
