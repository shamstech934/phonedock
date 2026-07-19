'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Smartphone } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import type { Phone } from '@/components/shared/types';

interface TopPhonesClientPageProps {
  title: string;
  subtitle: string;
  sort?: string;
  /** Pre-rendered icon element for empty state (pass as JSX from server) */
  icon?: ReactNode;
  description?: string;
  badgeField?: string;
  badgeLabel?: string;
  /** Custom API endpoint (default: /api/top-phones?sort=...&limit=20) */
  apiEndpoint?: string;
  /** Empty state heading when no data */
  emptyHeading?: string;
  /** Empty state description */
  emptyDescription?: string;
}

export function TopPhonesClientPage({
  title,
  subtitle,
  sort,
  icon,
  description,
  badgeField,
  badgeLabel,
  apiEndpoint,
  emptyHeading,
  emptyDescription,
}: TopPhonesClientPageProps) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPhones() {
      try {
        setLoading(true);
        setError(false);
        const url = apiEndpoint
          || `/api/top-phones?sort=${encodeURIComponent(sort || 'overallRating')}&limit=20`;
        const res = await fetch(url);
        if (cancelled) return;
        if (!res.ok) {
          setPhones([]);
          setError(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          const list = data.phones || data || [];
          setPhones(list);
        }
      } catch {
        if (!cancelled) {
          setPhones([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPhones();
    return () => { cancelled = true; };
  }, [sort, apiEndpoint]);

  const EmptyIcon = icon || <Smartphone className="w-14 h-14" />;

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
                  {badgeField && badgeLabel && (phone as unknown as Record<string, unknown>)[badgeField] as number > 0 && (
                    <span className="absolute top-3 right-3 z-10 bg-emerald-600 text-white text-[10px] font-semibold shadow-sm px-2 py-0.5 rounded">
                      {badgeLabel}: {(phone as unknown as Record<string, unknown>)[badgeField] as number}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <div className="opacity-15 flex justify-center mb-4">{EmptyIcon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {error ? 'Failed to load data' : (emptyHeading || 'No data yet')}
              </h3>
              <p className="text-sm">
                {error ? 'Please try refreshing the page' : (emptyDescription || 'Check back later for updated rankings')}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}