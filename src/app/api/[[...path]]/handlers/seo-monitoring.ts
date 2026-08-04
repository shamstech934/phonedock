import { NextRequest, NextResponse } from 'next/server';
import { Brand, Phone, PhoneImage } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';

function normalizeBaseUrl(value: string | undefined): string {
  const fallback = 'https://specsdekh.com';
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export async function handleSeoMonitoringGet(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminFromRequest(req);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth.admin, 'settings:read');
  if (denied) return denied;

  await connectDB();
  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL);

  const [
    totalPhones,
    publishedPhones,
    publishedWithSlug,
    publishedWithPrice,
    publishedPhoneIds,
    publishedThumbnailIds,
    totalBrands,
    activeBrands,
    brandsWithPublishedPhones,
    missingSlugExamples,
    missingPriceExamples,
  ] = await Promise.all([
    Phone.countDocuments({}),
    Phone.countDocuments({ status: 'published' }),
    Phone.countDocuments({ status: 'published', slug: { $type: 'string', $ne: '' } }),
    Phone.countDocuments({ status: 'published', pricePKR: { $gt: 0 } }),
    Phone.distinct('_id', { status: 'published' }),
    Phone.distinct('_id', {
      status: 'published',
      thumbnail: { $type: 'string', $nin: ['', null] },
    }),
    Brand.countDocuments({}),
    Brand.countDocuments({ active: { $ne: false } }),
    Phone.distinct('brandId', { status: 'published', brandId: { $exists: true, $ne: null } }),
    Phone.find({ status: 'published', $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }] })
      .select('brandId modelName slug').populate('brandId', 'name').limit(8).lean(),
    Phone.find({ status: 'published', $or: [{ pricePKR: { $exists: false } }, { pricePKR: { $lte: 0 } }] })
      .select('brandId modelName slug pricePKR').populate('brandId', 'name').limit(8).lean(),
  ]);

  // Public cards and detail pages use Phone.thumbnail as the primary image, while
  // the gallery uses PhoneImage records. Treat either source as a valid image so
  // SEO Monitoring reports the same reality visitors see on the website.
  const imagePhoneIds = await PhoneImage.distinct('phoneId', {
    phoneId: { $in: publishedPhoneIds },
    status: { $ne: 'rejected' },
    url: { $type: 'string', $nin: ['', null] },
  });
  const publishedWithImages = new Set([
    ...publishedThumbnailIds.map(String),
    ...imagePhoneIds.map(String),
  ]).size;
  const eligiblePhones = Math.min(publishedPhones, publishedWithSlug, publishedWithPrice, publishedWithImages);
  const emptyBrands = Math.max(0, activeBrands - new Set(brandsWithPublishedPhones.map(String)).size);

  const checks = [
    {
      key: 'canonical',
      label: 'Canonical domain',
      status: baseUrl === 'https://specsdekh.com' ? 'pass' : 'warning',
      detail: baseUrl,
    },
    {
      key: 'sitemap',
      label: 'XML sitemap',
      status: 'pass',
      detail: `${baseUrl}/sitemap.xml`,
    },
    {
      key: 'robots',
      label: 'Robots rules',
      status: 'pass',
      detail: `${baseUrl}/robots.txt`,
    },
    {
      key: 'phone-slugs',
      label: 'Published phone URLs',
      status: publishedWithSlug === publishedPhones ? 'pass' : 'fail',
      detail: `${publishedWithSlug}/${publishedPhones} published phones have a valid slug.`,
    },
    {
      key: 'phone-images',
      label: 'Published phone images',
      status: publishedWithImages === publishedPhones ? 'pass' : 'warning',
      detail: `${publishedWithImages}/${publishedPhones} published phones have a usable thumbnail or gallery image.`,
    },
    {
      key: 'phone-prices',
      label: 'Published phone prices',
      status: publishedWithPrice === publishedPhones ? 'pass' : 'warning',
      detail: `${publishedWithPrice}/${publishedPhones} published phones have a positive PKR price.`,
    },
    {
      key: 'empty-brands',
      label: 'Hidden empty brand records',
      status: emptyBrands === 0 ? 'pass' : 'info',
      detail: emptyBrands === 0
        ? 'Every active brand has at least one published phone.'
        : `${emptyBrands} catalogue-only brand records have no published phone. They are hidden from the public Brands directory and brands sitemap.`,
    },
    {
      key: 'google-verification',
      label: 'Google verification',
      status: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? 'pass' : 'info',
      detail: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
        ? 'HTML verification token configured.'
        : 'No HTML token configured. DNS verification remains valid.',
    },
    {
      key: 'bing-verification',
      label: 'Bing verification',
      status: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? 'pass' : 'info',
      detail: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? 'Bing verification token configured.'
        : 'Optional token is not configured.',
    },
  ];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      totalPhones,
      publishedPhones,
      eligiblePhones,
      excludedPublishedPhones: Math.max(0, publishedPhones - eligiblePhones),
      totalBrands,
      activeBrands,
      brandsWithPublishedPhones: new Set(brandsWithPublishedPhones.map(String)).size,
      emptyBrands,
    },
    endpoints: {
      sitemap: `${baseUrl}/sitemap.xml`,
      robots: `${baseUrl}/robots.txt`,
      googleSearchConsole: 'https://search.google.com/search-console',
      bingWebmaster: 'https://www.bing.com/webmasters',
    },
    checks,
    examples: {
      missingSlug: missingSlugExamples.map((phone) => ({
        id: String(phone._id),
        label: `${((phone as unknown as { brandId?: { name?: string } }).brandId?.name || '')} ${(phone as unknown as { modelName?: string }).modelName || ''}`.trim() || 'Unnamed phone',
      })),
      missingPrice: missingPriceExamples.map((phone) => ({
        id: String(phone._id),
        label: `${((phone as unknown as { brandId?: { name?: string } }).brandId?.name || '')} ${(phone as unknown as { modelName?: string }).modelName || ''}`.trim() || 'Unnamed phone',
        slug: phone.slug || '',
      })),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
