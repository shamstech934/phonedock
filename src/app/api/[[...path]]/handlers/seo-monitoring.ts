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
    Brand.countDocuments({}),
    Brand.countDocuments({ active: { $ne: false } }),
    Phone.distinct('brandId', { status: 'published', brandId: { $exists: true, $ne: null } }),
    Phone.find({ status: 'published', $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }] })
      .select('brandId modelName slug').populate('brandId', 'name').limit(8).lean(),
    Phone.find({ status: 'published', $or: [{ pricePKR: { $exists: false } }, { pricePKR: { $lte: 0 } }] })
      .select('brandId modelName slug pricePKR').populate('brandId', 'name').limit(8).lean(),
  ]);

  const imagePhoneIds = await PhoneImage.distinct('phoneId', { phoneId: { $in: publishedPhoneIds } });
  const publishedWithImages = new Set(imagePhoneIds.map(String)).size;
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
      detail: `${publishedWithImages}/${publishedPhones} published phones have an image record.`,
    },
    {
      key: 'phone-prices',
      label: 'Published phone prices',
      status: publishedWithPrice === publishedPhones ? 'pass' : 'warning',
      detail: `${publishedWithPrice}/${publishedPhones} published phones have a positive PKR price.`,
    },
    {
      key: 'empty-brands',
      label: 'Empty brand pages',
      status: emptyBrands === 0 ? 'pass' : 'warning',
      detail: `${emptyBrands} active brands currently have no published phone.`,
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
