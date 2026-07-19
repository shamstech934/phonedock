import { Metadata } from 'next';
import PhoneDetailClient from './PhoneDetailClient';
import { fetchPhoneDetailForMetadata } from '@/lib/fetch-phone-detail';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const phone = await fetchPhoneDetailForMetadata(slug);

  if (!phone) {
    return { title: 'Phone Not Found' };
  }

  const brand = (phone.brand as { name?: string } | null)?.name || '';
  const model = phone.modelName || '';
  const price = phone.pricePKR || 0;
  const description = phone.description || `Buy ${brand} ${model} in Pakistan. Latest price, specs, and reviews.`;
  const thumbnail = phone.thumbnail || '';

  const title = price > 0
    ? `${brand} ${model} Price in Pakistan - ${price.toLocaleString()} PKR`
    : `${brand} ${model} - Specs, Reviews & Price`;

  return {
    title,
    description: description.slice(0, 160),
    openGraph: {
      title,
      description: description.slice(0, 160),
      images: thumbnail ? [{ url: thumbnail, width: 400, height: 400, alt: `${brand} ${model}` }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description.slice(0, 160),
      images: thumbnail ? [thumbnail] : [],
    },
    alternates: {
      canonical: `/phones/${slug}`,
    },
  };
}

export default async function PhoneDetailPage({ params }: Props) {
  const { slug } = await params;
  const phone = await fetchPhoneDetailForMetadata(slug);

  const brand = (phone?.brand as { name?: string; slug?: string } | null)?.name || '';
  const brandSlug = (phone?.brand as { name?: string; slug?: string } | null)?.slug || '';
  const model = phone?.modelName || '';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/phones/${slug}`;

  const productJsonLd = phone ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand} ${model}`.trim(),
    description: phone.description || `${brand} ${model} specifications and price in Pakistan.`,
    image: phone.thumbnail ? [phone.thumbnail] : undefined,
    sku: phone.slug,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    releaseDate: phone.releaseDate || undefined,
    aggregateRating: phone.overallRating > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, Math.max(1, phone.overallRating / 2)).toFixed(1),
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
    } : undefined,
    offers: phone.pricePKR > 0 ? {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'PKR',
      price: phone.pricePKR,
      availability: phone.ptaApproved ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
      itemCondition: 'https://schema.org/NewCondition',
    } : undefined,
  } : null;

  const breadcrumbJsonLd = phone ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk' },
      { '@type': 'ListItem', position: 2, name: 'Phones', item: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/phones` },
      ...(brand && brandSlug ? [{ '@type': 'ListItem', position: 3, name: brand, item: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/brands/${brandSlug}` }] : []),
      { '@type': 'ListItem', position: brand && brandSlug ? 4 : 3, name: `${brand} ${model}`.trim(), item: canonicalUrl },
    ],
  } : null;

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />}
      {breadcrumbJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />}
      <PhoneDetailClient params={params} />
    </>
  );
}
