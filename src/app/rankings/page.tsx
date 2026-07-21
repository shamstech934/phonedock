import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, BatteryCharging, Camera, Gamepad2, Sparkles, WalletCards } from 'lucide-react';
import { getTopPhones } from '@/lib/get-top-phones';
import { rankPhones, getRankingMethodology, type RankingCategory } from '@/lib/intelligence/rankings';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import { formatPrice } from '@/components/shared/formatPrice';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Best Phones in Pakistan 2026 – Smart Rankings | PhoneDock',
  description: 'PhoneDock smart rankings for the best overall, gaming, camera, battery, value and budget phones in Pakistan.',
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
  const pools = await Promise.all(categories.map(category => getTopPhones(category.sort, 40)));
  const sections = categories.map((category, index) => ({
    ...category,
    phones: rankPhones(pools[index], category.key, 5),
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">PhoneDock Intelligence</span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Smart phone rankings for Pakistan</h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Rankings combine verified scores, Pakistan pricing and data-confidence checks. Missing specifications are never silently treated as zero.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <section key={section.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">{section.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{getRankingMethodology(section.key)}</p>
                </div>
              </div>

              {section.phones.length ? (
                <div className="grid gap-4 lg:grid-cols-5">
                  {section.phones.map(item => (
                    <Link key={item.phone.id} href={`/phone/${item.phone.slug}`} className="group rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-2xl font-black text-slate-300">#{item.rank}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{item.score}/100</span>
                      </div>
                      <div className="relative mx-auto mb-3 h-32 w-full">
                        <SafePhoneImage src={item.phone.thumbnail} alt={item.phone.modelName} fill className="object-contain transition group-hover:scale-105" sizes="(max-width: 1024px) 50vw, 20vw" />
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-slate-900">{item.phone.modelName}</h3>
                      <p className="mt-1 text-sm font-bold text-blue-600">{formatPrice(item.phone.pricePKR)}</p>
                      <p className="mt-2 text-xs text-slate-500">Data confidence: {item.confidence}%</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Ranking data will appear after phones have published scores.</div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
