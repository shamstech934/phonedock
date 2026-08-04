import { connectDBSafe } from '@/lib/mongodb';
import { News } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export async function GET() {
  const base = getBaseUrl();
  const rows = [
    `  <url><loc>${escapeXml(`${base}/news`)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
  ];

  try {
    const conn = await connectDBSafe();
    if (conn) {
      const articles = await News.find({
        published: true,
        status: 'published',
        slug: { $type: 'string', $ne: '' },
      })
        .select('slug updatedAt publishedAt')
        .lean();

      for (const article of articles) {
        if (!isSafeSlug(article.slug)) continue;
        const date = article.updatedAt || article.publishedAt;
        rows.push(
          `  <url><loc>${escapeXml(`${base}/news/${article.slug}`)}</loc>` +
          `<lastmod>${formatDate(date)}</lastmod>` +
          `<changefreq>monthly</changefreq><priority>0.6</priority></url>`,
        );
      }
    }
  } catch (error) {
    console.error('news sitemap fallback:', error);
  }

  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`,
  );
}
