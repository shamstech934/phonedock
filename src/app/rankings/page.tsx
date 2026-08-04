import type { Metadata } from 'next';
import { ArrowLeft, Award, BatteryCharging, Camera, ChevronRight, Gamepad2, Home, Sparkles, WalletCards } from 'lucide-react';
import { getTopPhones } from '@/lib/get-top-phones';
import { rankPhones, getRankingMethodology, type RankingCategory } from '@/lib/intelligence/rankings';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { PhoneGrid } from '@/components/shared/PhoneGrid';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';
const CURRENT_YEAR = new Date().getFullYear();

// Rankings depend on live MongoDB data. Render this route only at request time so
// a temporary Atlas/TLS outage can never fail the production build.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Best Phones in Pakistan ${CURRENT_YEAR} – Smart Rankings`,
  description: 'SpecsDekh smart rankings for the best overall, gaming, camera, battery, value and budget phones in Pakistan.',
  alternates: { canonical: `${BASE_URL}/rankings` },
};

const categories: Array<{ key: RankingCategory; title: string; icon: typeof Award; sort: string }> = [
  { key: 'overall', title: 'Best Overall', icon: Award, sort: 'overallRating' },
  { key: 'gaming', title: 'Best Gaming', icon: Gamepad2, sort: 'performanceScore' },
  { key: 'camera', title: 'Best Camera', icon: Camera, sort: 'cameraScore' },
  { key: 'battery', title: 'Best Battery', icon: BatteryCharging, sort: 'batteryScore' },
  { key: 'value', title: 'Best Value', icon: Sparkles, sort: 'valueScore' },
  { key: 'budget', title: 'Best Budget', icon: WalletCards, sort: 'valueScore' },
];

export default async function RankingsPage() {
  // Keep each category isolated: one transient database/TLS failure should show an
  // empty state for that category, not crash the entire page or deployment.
  const results = await Promise.allSettled(
    categories.map(category => getTopPhones(category.sort, 120)),
  );

  const sections = categories.map((category, index) => {
    const result = results[index];
    const pool = result?.status === 'fulfilled' ? result.value : [];

    if (result?.status === 'rejected') {
      console.error(`Rankings data unavailable for ${category.key}:`, result.reason);
    }

    return {
      ...category,
      phones: rankPhones(pool, category.key, 5),
    };
  });

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Best phones in Pakistan ${CURRENT_YEAR}`,
    itemListElement: sections.flatMap(section => section.phones.map(item => ({
      '@type': 'ListItem',
      position: item.rank,
      name: `${section.title}: ${item.phone.brand?.name || ''} ${item.phone.modelName}`.trim(),
      url: `${BASE_URL}/phones/${item.phone.slug}`,
    }))),
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
        <section className="border-b bg-white">
          <div className="site-shell py-6 sm:py-9">
            <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-slate-500">
              <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-700">
                <Home className="h-4 w-4" aria-hidden="true" />
                Home
              </Link>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
              <span aria-current="page" className="font-semibold text-slate-800">Rankings</span>
            </nav>

            <Link href="/phones" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to phones
            </Link>

            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">SpecsDekh Intelligence</span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Smart phone rankings for Pakistan</h1>
              <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Rankings combine verified scores, Pakistan pricing and data-confidence checks. Missing specifications are never silently treated as zero.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/phones" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">Browse all phones</Link>
                <Link href="/compare" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Compare phones</Link>
              </div>
            </div>
          </div>
        </section>

        <div className="site-shell space-y-8 py-8 sm:py-10">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <section key={section.key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">{section.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{getRankingMethodology(section.key)}</p>
                </div>
              </div>

              {section.phones.length ? (
                <PhoneGrid page="rankings" className="ranking-top-five">
                  {section.phones.map(item => (
                    <div key={item.phone.id} className="relative">
                      <span className="absolute left-2 top-2 z-20 rounded-full bg-slate-950/90 px-2.5 py-1 text-[11px] font-extrabold text-white shadow">#{item.rank}</span>
                      <span className="absolute right-2 top-2 z-20 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm" title={`${item.confidence}% verified data confidence`}>{item.score}/100</span>
                      <PhoneCard phone={item.phone} />
                    </div>
                  ))}
                </PhoneGrid>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Ranking data will appear after phones have published scores.</div>
              )}
            </section>
          );
        })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
