import { MetadataRoute } from 'next';
import { connectDBSafe } from '@/lib/mongodb';
import { Phone, Brand, News } from '@/lib/models';

const BASE_URL = 'https://phonedock.pk';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/#/brands`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/#/compare`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/#/news`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];

  try {
    const conn = await connectDBSafe();
    if (!conn) return staticPages;

    const [phones, brands, news] = await Promise.all([
      Phone.find({ active: true, status: 'published' }).select('slug updatedAt').lean(),
      Brand.find({ active: true }).select('slug updatedAt').lean(),
      News.find({ published: true, status: 'published' }).select('slug updatedAt').lean(),
    ]);

    // Get brand slug map for phone URLs
    const brandIds = [...new Set(phones.map((p: any) => p.brandId).filter(Boolean))];
    const brandDocs = await conn.connection.db.collection('brands').find({ _id: { $in: brandIds } }).project({ _id: 1, slug: 1 }).toArray();
    const brandMap = new Map(brandDocs.map((b: any) => [b._id.toString(), b.slug]));

    const phonePages: MetadataRoute.Sitemap = phones.map((p: any) => ({
      url: `${BASE_URL}/#/phone/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const brandPages: MetadataRoute.Sitemap = brands.map((b: any) => ({
      url: `${BASE_URL}/#/brand/${b.slug}`,
      lastModified: b.updatedAt ? new Date(b.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    const newsPages: MetadataRoute.Sitemap = news.map((n: any) => ({
      url: `${BASE_URL}/#/news`,
      lastModified: n.updatedAt ? new Date(n.updatedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...phonePages, ...brandPages, ...newsPages];
  } catch {
    // If DB fails, return static pages only
    return staticPages;
  }
}