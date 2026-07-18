export const dynamic = 'force-dynamic';
export const revalidate = 300;
import Link from 'next/link';
import { Tag, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Phones by Price Range in Pakistan | PhoneDock',
  description: 'Browse smartphones by price range in Pakistan',
  alternates: { canonical: `${BASE_URL}/price-ranges` },
  openGraph: {
    title: 'Phones by Price Range in Pakistan | PhoneDock',
    description: 'Browse smartphones by price range in Pakistan',
    url: `${BASE_URL}/price-ranges`,
    type: 'website',
  },
};

interface PriceRange {
  label: string;
  slug: string;
  min?: number;
  max?: number;
  count: number;
}

async function getPriceRanges(): Promise<PriceRange[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/price-ranges`, {
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
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Phones by Price Range</h1>
            <p className="text-sm text-muted-foreground mt-1">Browse smartphones by price range in Pakistan</p>
          </div>

          {ranges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ranges.map((range, index) => (
                <Link
                  key={range.slug}
                  href={`/phones?price=${range.slug}`}
                  className="card-premium p-5 sm:p-6 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClasses[index % gradientClasses.length]} flex items-center justify-center shadow-sm`}>
                        <Tag className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                          {range.label}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {range.count} phone{range.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
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