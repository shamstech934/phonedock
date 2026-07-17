import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ price: string }> }): Promise<Metadata> {
  const { price } = await params;
  const numericPrice = parseInt(price, 10);
  const displayPrice = isNaN(numericPrice) ? price : formatPrice(numericPrice);

  return {
    title: `Phones Under ${displayPrice} in Pakistan | PhoneDock`,
    description: `Best smartphones under ${displayPrice} in Pakistan with specs and prices`,
    alternates: { canonical: `${BASE_URL}/phones-under/${price}` },
    openGraph: {
      title: `Phones Under ${displayPrice} in Pakistan | PhoneDock`,
      description: `Best smartphones under ${displayPrice} in Pakistan with specs and prices`,
      url: `${BASE_URL}/phones-under/${price}`,
      type: 'website',
    },
  };
}

async function getPhonesUnderPrice(price: string): Promise<{ phones: Phone[]; total: number }> {
  try {
    const res = await fetch(`/api/phones-under/${price}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { phones: [], total: 0 };
    const data = await res.json();
    return {
      phones: data.phones || data || [],
      total: data.total || (data.phones || data || []).length,
    };
  } catch {
    return { phones: [], total: 0 };
  }
}

export default async function PhonesUnderPricePage({ params }: { params: Promise<{ price: string }> }) {
  const { price } = await params;
  const numericPrice = parseInt(price, 10);
  const displayPrice = isNaN(numericPrice) ? price : formatPrice(numericPrice);
  const { phones, total } = await getPhonesUnderPrice(price);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Phones Under {displayPrice}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {total} smartphone{total !== 1 ? 's' : ''} under {displayPrice} in Pakistan
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Browse:</span>
            {['20000', '30000', '50000', '80000', '100000', '150000'].map((p) => (
              <Link
                key={p}
                href={`/phones-under/${p}`}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  price === p
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                    : 'bg-white/60 border border-gray-200/60 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                }`}
              >
                {formatPrice(Number(p))}
              </Link>
            ))}
          </div>

          {phones.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {phones.map((phone) => (
                <PhoneCard key={phone.id} phone={phone} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Smartphone className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No phones found under {displayPrice}</h3>
              <p className="text-sm mb-4">Try a higher price range or check back later</p>
              <Link href="/price-ranges" className="text-sm text-blue-500 hover:text-blue-600 font-medium">
                Browse all price ranges
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}