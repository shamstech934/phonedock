import BrandDetailClient from './BrandDetailClient';
import { fetchPublicBrandDetail } from '@/lib/fetch-public-listings';
import { getBaseUrl } from '@/lib/urls';
import { serializeJsonLd } from '@/lib/json-ld';

export default async function BrandDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, phones } = await fetchPublicBrandDetail(slug);

  const baseUrl = getBaseUrl();
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `${brand?.name || ''} phones in Pakistan`,
    numberOfItems: phones.length,
    itemListElement: phones.slice(0, 100).map((phone, index) => ({ '@type': 'ListItem', position: index + 1, name: `${brand?.name || ''} ${phone.modelName}`.trim(), url: `${baseUrl}/phones/${phone.slug}` })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Brands', item: `${baseUrl}/brands` },
      { '@type': 'ListItem', position: 3, name: brand?.name || slug, item: `${baseUrl}/brands/${slug}` },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemList) }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}/><BrandDetailClient initialBrand={brand} initialPhones={phones} /></>;
}
