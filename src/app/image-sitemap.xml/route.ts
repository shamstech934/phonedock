import { connectDBSafe } from '@/lib/mongodb';
import { Phone } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toAbsoluteImageUrl(value: unknown, base: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;

  try {
    const url = new URL(raw, `${base}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export async function GET() {
  const base = getBaseUrl();
  const rows: string[] = [];

  try {
    const conn = await connectDBSafe();
    if (conn) {
      const phones = await Phone.find({
        active: true,
        status: 'published',
        deletedAt: null,
        thumbnail: { $nin: ['', null] },
      })
        .select('slug modelName thumbnail brandId')
        .populate('brandId', 'name')
        .lean();

      for (const phone of phones) {
        if (!isSafeSlug(phone.slug)) continue;
        const imageUrl = toAbsoluteImageUrl(phone.thumbnail, base);
        if (!imageUrl) continue;

        const brand = phone.brandId as unknown as { name?: string } | null;
        const title = `${brand?.name || ''} ${phone.modelName || ''}`.trim();

        rows.push(
          `  <url>\n` +
          `    <loc>${escapeXml(`${base}/phones/${phone.slug}`)}</loc>\n` +
          `    <image:image>\n` +
          `      <image:loc>${escapeXml(imageUrl)}</image:loc>\n` +
          `      <image:title>${escapeXml(title || 'Phone image')}</image:title>\n` +
          `      <image:caption>${escapeXml(`${title || 'Phone'} product image`)}</image:caption>\n` +
          `    </image:image>\n` +
          `  </url>`,
        );
      }
    }
  } catch (error) {
    console.error('image sitemap fallback:', error);
  }

  // Brand logos are intentionally excluded. Search Console previously rejected
  // relative brand-logo paths such as /brands/samsung.png as invalid image URLs.
  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>`,
  );
}
