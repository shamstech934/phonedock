import { connectDBSafe } from '@/lib/mongodb';
import { Brand, Phone } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getBaseUrl();
  const rows = [`  <url><loc>${escapeXml(`${base}/brands`)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const brandIds = await Phone.distinct('brandId', { active: true, status: 'published', deletedAt: null });
      const brands = await Brand.find({ _id: { $in: brandIds }, active: true }).select('slug updatedAt').lean();
      rows.push(...brands.filter((b) => b.slug).map((b) => `  <url><loc>${escapeXml(`${base}/brands/${b.slug}`)}</loc><lastmod>${formatDate(b.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`));
    }
  } catch (error) {
    console.error('brands sitemap fallback:', error);
  }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
