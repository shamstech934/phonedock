import { connectDBSafe } from '@/lib/mongodb';
import { Phone, UserReview } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const base = getBaseUrl();
  const rows = [`  <url><loc>${escapeXml(`${base}/reviews`)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const reviewedIds = await UserReview.distinct('phoneId', { status: 'approved' });
      const phones = await Phone.find({ _id: { $in: reviewedIds }, active: true, status: 'published', deletedAt: null }).select('slug updatedAt').lean();
      rows.push(...phones.filter((p) => p.slug).map((p) => `  <url><loc>${escapeXml(`${base}/reviews/${p.slug}`)}</loc><lastmod>${formatDate(p.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`));
    }
  } catch (error) { console.error('reviews sitemap fallback:', error); }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
