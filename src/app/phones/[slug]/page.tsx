import { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
    return { title: 'Phone Not Found | PhoneDock' };
  }

  const brand = (phone.brand as any)?.name || '';
  const model = phone.modelName || '';
  const price = phone.pricePKR || 0;
  const description = phone.description || `Buy ${brand} ${model} in Pakistan. Latest price, specs, and reviews.`;
  const thumbnail = phone.thumbnail || '';

  const title = price > 0
    ? `${brand} ${model} Price in Pakistan - ${price.toLocaleString()} PKR | PhoneDock`
    : `${brand} ${model} - Specs, Reviews & Price | PhoneDock`;

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
  return <PhoneDetailClient params={params} />;
}