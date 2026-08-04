import type { Metadata } from 'next';
import { Brand, Phone } from '@/lib/models';
import { getSettings } from '@/lib/models/Settings';
import { applySeoTemplate, buildPageMetadata } from '@/lib/seo';
import { connectDBSafe } from '@/lib/mongodb';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const connection = await connectDBSafe();

  if (!connection) {
    return { title: 'Brand Phones & Prices', robots: { index: false, follow: true } };
  }

  const brand = await Brand.findOne({ slug, active: true })
    .select('name slug description logo')
    .lean();

  if (!brand) return { title: 'Brand Not Found' };

  const [phoneCount, settings] = await Promise.all([
    Phone.countDocuments({ brandId: brand._id, active: true, status: 'published' }),
    getSettings().catch(() => null),
  ]);
  const year = new Date().getFullYear();
  const title = applySeoTemplate(settings?.brandTitleTemplate || '{brand} Phones Price in Pakistan ({year})', { brand: brand.name, year });
  const description = brand.description
    ? String(brand.description).slice(0, 160)
    : `View all ${brand.name} phones with latest Pakistan prices, specifications, comparisons, and reviews.`;

  return buildPageMetadata({
    title,
    description,
    path: `/brands/${brand.slug}`,
    image: brand.logo || undefined,
    noIndex: phoneCount === 0 && !settings?.indexEmptyBrands,
    keywords: [`${brand.name} phones Pakistan`, `${brand.name} mobile price in Pakistan`, `${brand.name} latest phones`, `${brand.name} specs`],
  });
}

export default function BrandSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
