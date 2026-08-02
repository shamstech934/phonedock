import { connectDBSafe } from '@/lib/mongodb';
import { Video } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, formatDate, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getBaseUrl();
  const rows: string[] = [];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const videos = await Video.find({ active: true, hidden: { $ne: true }, status: 'live' }).select('youtubeId title description thumbnailUrl publishedAt duration').lean();
      for (const video of videos) {
        const description = video.description || `${video.title} smartphone video review`;
        rows.push(`  <url>\n    <loc>${escapeXml(`${base}/videos`)}</loc>\n    <video:video><video:thumbnail_loc>${escapeXml(video.thumbnailUrl)}</video:thumbnail_loc><video:title>${escapeXml(video.title)}</video:title><video:description>${escapeXml(description.slice(0, 2000))}</video:description><video:player_loc>${escapeXml(`https://www.youtube.com/watch?v=${video.youtubeId}`)}</video:player_loc><video:publication_date>${formatDate(video.publishedAt)}</video:publication_date></video:video>\n  </url>`);
      }
    }
  } catch (error) { console.error('video sitemap fallback:', error); }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${rows.join('\n')}\n</urlset>`);
}
