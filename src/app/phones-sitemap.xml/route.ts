import { connectDBSafe } from '@/lib/mongodb';
import { Phone } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';
import { SEO_SPEC_LANDINGS } from '@/lib/seo-growth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getBaseUrl();
  const staticUrls = [base, `${base}/phones`, `${base}/compare`, `${base}/rankings`, `${base}/price-ranges`, `${base}/phone-finder`];
  let rows = staticUrls.map((url, index) => `  <url><loc>${escapeXml(url)}</loc><changefreq>${index < 2 ? 'daily' : 'weekly'}</changefreq><priority>${index === 0 ? '1.0' : '0.8'}</priority></url>`);
  rows = rows.concat(SEO_SPEC_LANDINGS.map((item) => `  <url><loc>${escapeXml(`${base}/phones-by-spec/${item.type}/${item.value}`)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`));
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const phones = await Phone.find({ active: true, status: 'published', deletedAt: null }).select('slug updatedAt').lean();
      rows = rows.concat(phones.filter((p) => p.slug).map((p) => `  <url><loc>${escapeXml(`${base}/phones/${p.slug}`)}</loc><lastmod>${formatDate(p.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`));
    }
  } catch (error) {
    console.error('phones sitemap fallback:', error);
  }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
