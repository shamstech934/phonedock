import { connectDBSafe } from '@/lib/mongodb';
import { Phone } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';
import { getIndexReadyPhoneFilter } from '@/lib/phone-publication';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const base = getBaseUrl();
  let rows: string[] = [];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const phones = await Phone.find(getIndexReadyPhoneFilter()).select('slug updatedAt').lean();
      rows = rows.concat(phones.filter((p) => p.slug).map((p) => `  <url><loc>${escapeXml(`${base}/phones/${p.slug}`)}</loc><lastmod>${formatDate(p.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`));
    }
  } catch (error) {
    console.error('phones sitemap fallback:', error);
  }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>`);
}
