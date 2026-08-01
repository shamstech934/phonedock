import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import type { Phone } from '@/components/shared/types';
import { findSeoSpecLanding, SEO_SPEC_LANDINGS } from '@/lib/seo-growth';
import { serializeJsonLd } from '@/lib/json-ld';
import { getBaseUrl } from '@/lib/urls';

export const dynamic = 'force-dynamic';
const BASE_URL = getBaseUrl();

type Props = { params: Promise<{ type: string; value: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, value } = await params;
  const landing = findSeoSpecLanding(type, value);
  if (!landing) return { title: 'Phone Category Not Found', robots: { index: false, follow: false } };
  const path = `/phones-by-spec/${type}/${value}`;
  return {
    title: landing.title,
    description: landing.description,
    alternates: { canonical: `${BASE_URL}${path}` },
    openGraph: { title: landing.title, description: landing.description, url: `${BASE_URL}${path}`, type: 'website' },
    twitter: { card: 'summary_large_image', title: landing.title, description: landing.description },
  };
}

async function loadPhones(query: Record<string, string>) {
  const params = new URLSearchParams({ ...query, limit: '40', sort: 'releaseDate', order: 'desc' });
  try {
    const response = await fetch(`${BASE_URL}/api/phones?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return { phones: [] as Phone[], total: 0 };
    const data = await response.json();
    return { phones: (data.phones || []) as Phone[], total: Number(data.total || 0) };
  } catch {
    return { phones: [] as Phone[], total: 0 };
  }
}

export default async function SeoSpecLandingPage({ params }: Props) {
  const { type, value } = await params;
  const landing = findSeoSpecLanding(type, value);
  if (!landing) notFound();
  const { phones, total } = await loadPhones(landing.query);
  const canonical = `${BASE_URL}/phones-by-spec/${type}/${value}`;
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: landing.label,
    numberOfItems: phones.length,
    itemListElement: phones.map((phone, index) => ({ '@type': 'ListItem', position: index + 1, name: `${phone.brand?.name || ''} ${phone.modelName}`.trim(), url: `${BASE_URL}/phones/${phone.slug}` })),
  };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Phones', item: `${BASE_URL}/phones` },
    { '@type': 'ListItem', position: 3, name: landing.label, item: canonical },
  ] };

  const related = SEO_SPEC_LANDINGS.filter((item) => item.type === landing.type && item.value !== landing.value).slice(0, 6);
  return <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1"><div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div><h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950">{landing.label}</h1><p className="mt-2 max-w-3xl text-sm sm:text-base text-slate-600">{landing.description}</p><p className="mt-2 text-sm text-slate-500">{total} matching phone{total === 1 ? '' : 's'} found.</p></div>
      {related.length > 0 && <nav aria-label="Related phone categories" className="flex flex-wrap gap-2">{related.map((item) => <Link key={`${item.type}-${item.value}`} href={`/phones-by-spec/${item.type}/${item.value}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">{item.label}</Link>)}</nav>}
      {phones.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{phones.map((phone) => <PhoneCard key={phone.id} phone={phone} />)}</div> : <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><h2 className="font-bold text-slate-900">No matching phones yet</h2><p className="mt-2 text-sm text-slate-500">This page will update automatically when matching published phones are added.</p></div>}
      <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-extrabold text-slate-900">About {landing.label}</h2><p className="mt-2 text-sm leading-6 text-slate-600">SpecsDekh lists published phones using verified database fields. Prices and availability can change, so open a phone page for the latest Pakistan price, PTA status and full specifications.</p></section>
    </div></main>
    <Footer />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemList) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />
  </div>;
}
