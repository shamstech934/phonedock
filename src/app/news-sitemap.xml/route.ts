import { connectDBSafe } from '@/lib/mongodb';
import { News } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getBaseUrl();
  const rows = [`  <url><loc>${escapeXml(`${base}/news`)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const articles = await News.find({ published: true, status: 'published' }).select('slug updatedAt').lean();
      rows.push(...articles.filter((n) => n.slug).map((n) => `  <url><loc>${escapeXml(`${base}/news/${n.slug}`)}</loc><lastmod>${formatDate(n.updatedAt)}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`));
    }
  } catch (error) { console.error('news sitemap fallback:', error); }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
