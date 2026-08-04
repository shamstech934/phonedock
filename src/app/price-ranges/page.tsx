export const revalidate = 900;
import Link from 'next/link';
import { Tag, ChevronRight, BadgeDollarSign, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com').replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Phones by Price Range in Pakistan',
  description: 'Browse smartphones by price range in Pakistan',
  alternates: { canonical: `${BASE_URL}/price-ranges` },
  openGraph: {
    title: 'Phones by Price Range in Pakistan',
    description: 'Browse smartphones by price range in Pakistan',
    url: `${BASE_URL}/price-ranges`,
    type: 'website',
  },
};

interface PriceRange {
  label: string;
  slug: string;
  min: number;
  max: number | null;
  count: number;
  description?: string;
}

async function getPriceRanges(): Promise<PriceRange[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/price-ranges`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ranges || data || [];
  } catch {
    return [];
  }
}

export default async function PriceRangesPage() {
  const ranges = await getPriceRanges();

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Phones by Price Range in Pakistan',
    itemListElement: ranges.map((range, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: range.label,
      url: `${BASE_URL}/phones?priceMin=${range.min}${range.max === null ? '' : `&priceMax=${range.max}`}`,
    })),
  };

  const gradientClasses = [
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-cyan-500',
    'from-violet-500 to-purple-500',
    'from-orange-500 to-amber-500',
    'from-rose-500 to-pink-500',
    'from-sky-500 to-blue-500',
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <main className="flex-1">
        <div className="site-shell py-5 sm:py-7 animate-fade-in space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 px-5 py-6 shadow-sm sm:px-7 sm:py-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600"><BadgeDollarSign className="h-4 w-4" /> Pakistan price guide</div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Phones by Price Range</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">Compare current smartphones in practical Pakistan-market price brackets. Counts update automatically from published phone prices.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Published phones only</span><span className="rounded-full bg-white px-3 py-1.5 shadow-sm">No overlapping ranges</span></div>
          </div>

          {ranges.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {ranges.map((range, index) => (
                <Link
                  key={range.slug}
                  href={`/phones?priceMin=${range.min}${range.max === null ? '' : `&priceMax=${range.max}`}`}
                  className="card-premium flex min-h-[156px] flex-col justify-between p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClasses[index % gradientClasses.length]} flex items-center justify-center shadow-sm`}>
                        <Tag className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[15px] leading-snug text-gray-900 group-hover:text-blue-600 transition-colors">
                          {range.label}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{range.count} phone{range.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">{range.description || 'Browse phones in this price bracket'}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Tag className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No price range data yet</h3>
              <p className="text-sm">Check back later for updated price ranges</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
