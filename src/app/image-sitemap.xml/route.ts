import { connectDBSafe } from '@/lib/mongodb';
import { Phone, Brand } from '@/lib/models';
import { getBaseUrl } from '@/lib/urls';
import { escapeXml, xmlResponse } from '@/lib/seo-sitemaps/xml';

export const dynamic = 'force-dynamic';

function toAbsoluteImageUrl(value: unknown, base: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;
  try {
    const url = new URL(raw, `${base}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const base = getBaseUrl();
  const rows: string[] = [];
  try {
    const conn = await connectDBSafe();
    if (conn) {
      const [phones, brands] = await Promise.all([
        Phone.find({ active: true, status: 'published', deletedAt: null, thumbnail: { $nin: ['', null] } }).select('slug modelName thumbnail brandId').populate('brandId', 'name').lean(),
        Brand.find({ active: true, logo: { $nin: ['', null] } }).select('slug name logo').lean(),
      ]);
      for (const phone of phones) {
        const imageUrl = toAbsoluteImageUrl(phone.thumbnail, base);
        if (!imageUrl) continue;
        const brand = phone.brandId as unknown as { name?: string } | null;
        rows.push(`  <url>\n    <loc>${escapeXml(`${base}/phones/${phone.slug}`)}</loc>\n    <image:image><image:loc>${escapeXml(imageUrl)}</image:loc><image:title>${escapeXml(`${brand?.name || ''} ${phone.modelName}`.trim())}</image:title><image:caption>${escapeXml(`${phone.modelName} official phone image`)}</image:caption></image:image>\n  </url>`);
      }
      for (const brand of brands) {
        const imageUrl = toAbsoluteImageUrl(brand.logo, base);
        if (!imageUrl) continue;
        rows.push(`  <url>\n    <loc>${escapeXml(`${base}/brands/${brand.slug}`)}</loc>\n    <image:image><image:loc>${escapeXml(imageUrl)}</image:loc><image:title>${escapeXml(`${brand.name} logo`)}</image:title></image:image>\n  </url>`);
      }
    }
  } catch (error) { console.error('image sitemap fallback:', error); }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>`);
}
