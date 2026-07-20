'use client';

import Link from 'next/link';
import { Clock3, Heart, Trash2 } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { Button } from '@/components/ui/button';
import { useRecentlyViewed, useWishlist } from '@/lib/personalization/usePersonalization';

export function PersonalizedPhonesPage({ mode }: { mode: 'wishlist' | 'recent' }) {
  const wishlist = useWishlist();
  const recent = useRecentlyViewed();
  const items = mode === 'wishlist' ? wishlist.items : recent.items;
  const Icon = mode === 'wishlist' ? Heart : Clock3;
  const title = mode === 'wishlist' ? 'Your Wishlist' : 'Recently Viewed';
  const description = mode === 'wishlist'
    ? 'Phones you saved for later comparison and price checking.'
    : 'Quickly return to the phones you explored recently.';

  return (
    <div className="min-h-screen bg-slate-50/70">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </div>
          {items.length > 0 && (
            <Button variant="outline" onClick={() => mode === 'wishlist' ? wishlist.clear() : recent.clear()}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear all
            </Button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(phone => <PhoneCard key={phone.slug} phone={phone} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Icon className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">Nothing here yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {mode === 'wishlist' ? 'Tap the heart on any phone card to save it here.' : 'Open a phone detail page and it will appear here automatically.'}
            </p>
            <Button asChild className="mt-6"><Link href="/phones">Browse phones</Link></Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
