import type { Metadata } from 'next';
import { Brand } from '@/lib/models';
import { connectDBSafe } from '@/lib/mongodb';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

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

  const title = `${brand.name} Phones Price in Pakistan`;
  const description = brand.description
    ? String(brand.description).slice(0, 160)
    : `View all ${brand.name} phones with latest Pakistan prices, specifications, comparisons, and reviews.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/brands/${brand.slug}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/brands/${brand.slug}`,
      type: 'website',
      images: brand.logo ? [{ url: brand.logo, alt: `${brand.name} logo` }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: brand.logo ? [brand.logo] : undefined },
  };
}

export default function BrandSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
