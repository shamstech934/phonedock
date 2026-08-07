import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PhoneDetailClient from './PhoneDetailClient';
import { fetchPhoneDetail, fetchPhoneDetailForMetadata } from '@/lib/fetch-phone-detail';
import { serializeJsonLd } from '@/lib/json-ld';
import { applySeoTemplate, buildPageMetadata, isIndexablePhone } from '@/lib/seo';
import { getSettings } from '@/lib/models/Settings';

// Render on demand and refresh cached phone pages hourly. This avoids a database
// round-trip on every visit while still keeping prices and specifications fresh.
export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const phone = await fetchPhoneDetailForMetadata(slug);

  if (!phone) {
    return {
      title: 'Phone Not Found',
      robots: { index: false, follow: false },
    };
  }

  const brand = (phone.brand as { name?: string } | null)?.name || '';
  const model = phone.modelName || '';
  const price = phone.pricePKR || 0;
  const description = phone.description || `Buy ${brand} ${model} in Pakistan. Latest price, specs, and reviews.`;
  const thumbnail = phone.thumbnail || '';

  const settings = await getSettings().catch(() => null);
  const releaseYear = phone.releaseDate ? new Date(phone.releaseDate).getFullYear() : new Date().getFullYear();
  const rawPhone = phone as unknown as { seoTitle?: string; seoDescription?: string; status?: string; active?: boolean; upcoming?: boolean };
  const template = settings?.phoneTitleTemplate || '{brand} {model} Price in Pakistan {year} | Specs, PTA & Review';
  const generatedTitle = applySeoTemplate(template, { brand, model, year: releaseYear, price: price > 0 ? `PKR ${price.toLocaleString()}` : '' });
  const title = rawPhone.seoTitle?.trim() || generatedTitle;
  const metaDescription = rawPhone.seoDescription?.trim() || description;
  const noIndex = !isIndexablePhone({ status: rawPhone.status || 'published', active: rawPhone.active ?? true, thumbnail, pricePKR: price, upcoming: rawPhone.upcoming });

  return buildPageMetadata({
    title,
    description: metaDescription,
    path: `/phones/${slug}`,
    image: thumbnail || undefined,
    noIndex,
    keywords: [brand, model, `${brand} ${model} price in Pakistan`, `${brand} ${model} specs`, `${brand} ${model} PTA`, `${brand} phones Pakistan`].filter(Boolean),
  });
}

export default async function PhoneDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchPhoneDetail(slug);
  const phone = data?.phone ?? null;
  if (!phone) notFound();

  const brand = (phone?.brand as { name?: string; slug?: string } | null)?.name || '';
  const brandSlug = (phone?.brand as { name?: string; slug?: string } | null)?.slug || '';
  const model = phone?.modelName || '';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com'}/phones/${slug}`;

  const structuredPrice = Number(phone?.currentPrice || phone?.pricePKR || 0);

  const productJsonLd = phone ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand} ${model}`.trim(),
    description: phone.description || `${brand} ${model} specifications and price in Pakistan.`,
    image: [phone.thumbnail, ...(((phone as unknown as { images?: Array<{ url?: string } | string> }).images || []).map((item) => typeof item === 'string' ? item : item?.url))].filter(Boolean),
    sku: phone.slug,
    mpn: phone.slug,
    url: canonicalUrl,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    releaseDate: phone.releaseDate || undefined,
    aggregateRating: Number((phone as unknown as { userReviewCount?: number }).userReviewCount || 0) > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Number((phone as unknown as { userReviewAverage?: number }).userReviewAverage || 0).toFixed(1),
      bestRating: 5,
      worstRating: 1,
      ratingCount: Number((phone as unknown as { userReviewCount?: number }).userReviewCount || 0),
    } : undefined,
    offers: structuredPrice > 0 ? {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'PKR',
      price: structuredPrice,
      availability: phone.ptaApproved ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
      itemCondition: 'https://schema.org/NewCondition',
    } : undefined,
  } : null;

  const phoneSpecs = (phone as unknown as { specs?: { battery?: string; ram?: string; storage?: string; mainCamera?: string; display?: string } }).specs || {};
  const faqJsonLd = phone ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the price of ${brand} ${model} in Pakistan?`,
        acceptedAnswer: { '@type': 'Answer', text: phone.pricePKR > 0 ? `${brand} ${model} price in Pakistan is PKR ${phone.pricePKR.toLocaleString()}. Prices can change by retailer and variant.` : `${brand} ${model} price in Pakistan is not confirmed yet.` },
      },
      {
        '@type': 'Question',
        name: `Is ${brand} ${model} PTA approved?`,
        acceptedAnswer: { '@type': 'Answer', text: phone.ptaApproved ? `Yes, ${brand} ${model} is listed as PTA approved.` : `${brand} ${model} PTA approval is listed as ${phone.ptaStatus || 'unknown'}. Confirm the exact device IMEI before purchase.` },
      },
      ...(phoneSpecs.battery ? [{ '@type': 'Question', name: `What is the battery capacity of ${brand} ${model}?`, acceptedAnswer: { '@type': 'Answer', text: `${brand} ${model} battery specification is ${phoneSpecs.battery}.` } }] : []),
      ...(phoneSpecs.ram || phoneSpecs.storage ? [{ '@type': 'Question', name: `How much RAM and storage does ${brand} ${model} have?`, acceptedAnswer: { '@type': 'Answer', text: `${brand} ${model} is listed with ${phoneSpecs.ram || 'multiple RAM options'} and ${phoneSpecs.storage || 'multiple storage options'}.` } }] : []),
    ],
  } : null;

  const breadcrumbJsonLd = phone ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com' },
      { '@type': 'ListItem', position: 2, name: 'Phones', item: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com'}/phones` },
      ...(brand && brandSlug ? [{ '@type': 'ListItem', position: 3, name: brand, item: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com'}/brands/${brandSlug}` }] : []),
      { '@type': 'ListItem', position: brand && brandSlug ? 4 : 3, name: `${brand} ${model}`.trim(), item: canonicalUrl },
    ],
  } : null;

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }} />}
      {breadcrumbJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />}
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />}
      <PhoneDetailClient slug={slug} initialData={data} />
    </>
  );
}
