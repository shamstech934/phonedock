export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { getTopPhones } from '@/lib/get-top-phones';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Best Value Phones in Pakistan 2025 | PhoneDock',
  description: 'Smartphones with the best price-to-performance ratio in Pakistan',
  alternates: { canonical: `${BASE_URL}/best-value-phone` },
  openGraph: {
    title: 'Best Value Phones in Pakistan 2025 | PhoneDock',
    description: 'Smartphones with the best price-to-performance ratio in Pakistan',
    url: `${BASE_URL}/best-value-phone`,
    type: 'website',
  },
};

export default async function BestValuePhonePage() {
  const phones = await getTopPhones('overallRating', 20);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Best Value Phones in Pakistan 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">Smartphones with the best price-to-performance ratio in Pakistan</p>
          </div>
          {phones.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {phones.map((phone) => (
                <PhoneCard key={phone.id} phone={phone} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <TrendingUp className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No value phone data yet</h3>
              <p className="text-sm">Check back later for updated rankings</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}