'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Smartphone, Layers, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard, PhoneCardSkeleton } from '@/components/shared/PhoneCard';
import type { Brand, Phone } from '@/components/shared/types';
import { parseSmartSearch, smartSearchToPhonesUrl } from '@/lib/search/parse-smart-search';

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200/70 text-yellow-900 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const smartIntent = useMemo(() => parseSmartSearch(query), [query]);
  const smartUrl = useMemo(() => smartSearchToPhonesUrl(smartIntent), [smartIntent]);
  const hasSmartIntent = smartIntent.detected.length > 0;

  const [results, setResults] = useState<{ brands: Brand[]; phones: Phone[] }>({ brands: [], phones: [] });
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!query) { setLoading(false); setSearchError(false); return; }
    let cancelled = false;
    setLoading(true);
    setSearchError(false);
    const requestUrl = (() => {
      if (!hasSmartIntent) return `/api/search?q=${encodeURIComponent(query)}`;
      const [, rawQuery = ''] = smartUrl.split('?');
      const params = new URLSearchParams(rawQuery);
      // Public phone API uses explicit numeric range names.
      if (params.has('ram')) { params.set('ramMin', params.get('ram') || ''); params.delete('ram'); }
      if (params.has('storage')) { params.set('storageMin', params.get('storage') || ''); params.delete('storage'); }
      params.set('limit', '24');
      return `/api/phones?${params.toString()}`;
    })();

    fetch(requestUrl).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then(d => {
      if (!cancelled) {
        setResults({ brands: hasSmartIntent ? [] : (d.brands || []), phones: d.phones || [] });
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) { setLoading(false); setSearchError(true); } });
    return () => { cancelled = true; };
  }, [query, retryNonce, hasSmartIntent, smartUrl]);

  const total = results.brands.length + results.phones.length;

  const suggestions = ['Samsung', 'iPhone', 'Xiaomi', 'Oppo', 'Vivo', 'OnePlus', 'Tecno', 'Infinix', 'Realme', '5G', 'Camera', 'Budget'];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="skeleton-shimmer h-8 w-64 rounded-lg mb-2" />
        <div className="skeleton-shimmer h-5 w-32 rounded-md mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(6).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
        <div className="text-center mb-10">
          <Search className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Search Phones</h1>
          <p className="text-sm text-muted-foreground">Type in the search bar above to find phones, brands, and more</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Popular Searches</h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="px-4 py-2 rounded-xl bg-white/60 border border-gray-200/60 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">
          {hasSmartIntent ? 'Smart recommendations for ' : 'Search Results for '}&ldquo;<span className="text-blue-500">{query}</span>&rdquo;
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{total} matching option{total !== 1 ? 's' : ''} found{hasSmartIntent ? ' using your detected preferences' : ''}</p>
      </div>

      {smartIntent.detected.length > 0 && (
        <section className="rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 sm:p-5 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-cyan-500/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300"><Sparkles className="h-4 w-4" /> Preferences understood</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {smartIntent.detected.map(item => <span key={item} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">{item}</span>)}
              </div>
            </div>
            <Button asChild className="rounded-xl shrink-0"><Link href={smartUrl}>View all filtered phones <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>
      )}

      {results.brands.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-500" /> Brands ({results.brands.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.brands.map(b => (
              <Link key={b.id} href={`/brands/${b.slug}`} className="phone-card glass-shine p-4 cursor-pointer group flex items-center gap-3 block">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                  {b.logo ? <Image src={b.logo} alt={b.name} width={28} height={28} className="object-contain" unoptimized /> : <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate"><HighlightText text={b.name} query={query} /></p>
                  <p className="text-[10px] text-muted-foreground">{b._count?.phones || 0} phones</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.phones.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> {hasSmartIntent ? 'Top matches' : 'Phones'} ({results.phones.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.phones.map(p => (
              <PhoneCard key={p.id} phone={p} />
            ))}
          </div>
        </section>
      )}

      {searchError && (
        <div className="text-center py-20 text-muted-foreground">
          <AlertCircle className="w-14 h-14 mx-auto mb-4 text-amber-400" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Something went wrong</h3>
          <p className="text-sm mb-4">Unable to load search results. Please try again.</p>
          <Button variant="outline" className="rounded-xl" onClick={() => setRetryNonce(value => value + 1)}>Try Again</Button>
        </div>
      )}

      {!searchError && total === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No results found for &ldquo;{query}&rdquo;</h3>
          <p className="text-sm mb-4">{hasSmartIntent ? 'No phone matches every selected preference. Remove one filter or browse the closest available options.' : 'Try a different search term or browse our database'}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.slice(0, 6).map(s => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="px-3 py-1.5 rounded-lg bg-white/60 border border-gray-200/60 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                {s}
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="outline" className="rounded-xl" asChild><Link href="/phones">Browse All Phones</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /></div>}>
          <SearchContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
