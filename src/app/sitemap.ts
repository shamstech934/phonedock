import { MetadataRoute } from 'next';
import { connectDBSafe } from '@/lib/mongodb';
import { Phone, Brand, News, UserReview } from '@/lib/models';

import { getBaseUrl } from '@/lib/urls';

const BASE_URL = getBaseUrl();

// Avoid rebuilding the full database-backed sitemap on every crawler request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  // Keep static entries stable so search engines do not see a false change on every request.
  const STATIC_LAST_MODIFIED = new Date('2026-07-20T00:00:00.000Z');
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/phones`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/brands`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/compare`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/news`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/videos`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/reviews`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/upcoming`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/best-camera-phone`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/best-battery-phone`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/best-gaming-phone`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/best-budget-phone`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/best-value-phone`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/price-ranges`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/buying-guides`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    ...['gaming-phones','camera-phones','battery-phones','value-phones','pta-approved-phones'].map((slug) => ({ url: `${BASE_URL}/buying-guides/${slug}`, lastModified: STATIC_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];

  try {
    const conn = await connectDBSafe();
    if (!conn) return staticPages;

    const [phones, brands, newsArticles, reviewedPhoneIds] = await Promise.all([
      Phone.find({ active: true, status: 'published' }).select('_id slug updatedAt reviewSummary reviewVerdict pros cons').lean(),
      Brand.find({ active: true }).select('slug updatedAt').lean(),
      News.find({ published: true, status: 'published' }).select('slug updatedAt').lean(),
      UserReview.distinct('phoneId', { status: 'approved' }),
    ]);

    const reviewedPhoneIdSet = new Set(reviewedPhoneIds.map((id) => String(id)));
    const phonesWithEditorialReviews = phones.filter((p) =>
      Boolean((p as { reviewSummary?: string; reviewVerdict?: string; pros?: string; cons?: string }).reviewSummary ||
        (p as { reviewSummary?: string; reviewVerdict?: string; pros?: string; cons?: string }).reviewVerdict ||
        (p as { reviewSummary?: string; reviewVerdict?: string; pros?: string; cons?: string }).pros ||
        (p as { reviewSummary?: string; reviewVerdict?: string; pros?: string; cons?: string }).cons ||
        reviewedPhoneIdSet.has(String(p._id)))
    );

    const phonePages: MetadataRoute.Sitemap = phones.map((p) => ({
      url: `${BASE_URL}/phones/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : STATIC_LAST_MODIFIED,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const brandPages: MetadataRoute.Sitemap = brands.map((b) => ({
      url: `${BASE_URL}/brands/${b.slug}`,
      lastModified: b.updatedAt ? new Date(b.updatedAt) : STATIC_LAST_MODIFIED,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    const newsPages: MetadataRoute.Sitemap = newsArticles.map((n) => ({
      url: `${BASE_URL}/news/${n.slug}`,
      lastModified: n.updatedAt ? new Date(n.updatedAt) : STATIC_LAST_MODIFIED,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

    const reviewPages: MetadataRoute.Sitemap = phonesWithEditorialReviews.map((p) => ({
      url: `${BASE_URL}/reviews/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : STATIC_LAST_MODIFIED,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticPages, ...phonePages, ...brandPages, ...newsPages, ...reviewPages];
  } catch {
    return staticPages;
  }
}