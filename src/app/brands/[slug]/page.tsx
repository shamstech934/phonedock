import BrandDetailClient from './BrandDetailClient';
import { fetchPublicBrandDetail } from '@/lib/fetch-public-listings';

export default async function BrandDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, phones } = await fetchPublicBrandDetail(slug);

  return <BrandDetailClient initialBrand={brand} initialPhones={phones} />;
}
