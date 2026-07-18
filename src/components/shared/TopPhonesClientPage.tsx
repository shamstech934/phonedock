'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import type { Phone } from '@/components/shared/types';
import type { LucideIcon } from 'lucide-react';

interface TopPhonesClientPageProps {
  title: string;
  subtitle: string;
  sort: string;
  icon: LucideIcon;
  description?: string;
  badgeField?: string;
  badgeLabel?: string;
}

export function TopPhonesClientPage({
  title,
  subtitle,
  sort,
  icon: Icon,
  description,
  badgeField,
  badgeLabel,
}: TopPhonesClientPageProps) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPhones() {
      try {
        const res = await fetch(`/api/top-phones?sort=${encodeURIComponent(sort)}&limit=20`);
        if (cancelled) return;
        if (!res.ok) { setPhones([]); return; }
        const data = await res.json();
        if (!cancelled) setPhones(data.phones || data || []);
      } catch {
        if (!cancelled) setPhones([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPhones();
    return () => { cancelled = true; };
  }, [sort]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>

          {description && (
            <div className="card-premium p-4 sm:p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-16 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-28 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : phones.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {phones.map((phone) => (
                <div key={phone.id} className="relative">
                  <PhoneCard phone={phone} />
                  {badgeField && badgeLabel && (phone as any)[badgeField] > 0 && (
                    <span className="absolute top-3 right-3 z-10 bg-emerald-600 text-white text-[10px] font-semibold shadow-sm px-2 py-0.5 rounded">
                      {badgeLabel}: {(phone as any)[badgeField]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Icon className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No data yet</h3>
              <p className="text-sm">Check back later for updated rankings</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}