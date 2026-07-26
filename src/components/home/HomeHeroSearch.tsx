'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Smartphone, TrendingUp, Loader2 } from 'lucide-react';
import { parseSmartSearch, smartSearchToPhonesUrl } from '@/lib/search/parse-smart-search';

interface AutocompleteResult {
  id: string;
  slug: string;
  modelName: string;
  thumbnail: string;
  pricePKR: number;
  brand: { id: string; name: string; slug: string } | null;
}

export function HomeHeroSearch({ placeholder = 'Phone name, brand...', cta1Text = 'Browse Phones', cta1Url = '/phones', cta2Text = 'Compare', cta2Url = '/compare' }: { placeholder?: string; cta1Text?: string; cta1Url?: string; cta2Text?: string; cta2Url?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(true);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/phones/autocomplete?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.phones || []);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  const submit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value) return;
    setShowDropdown(false);
    const smartIntent = parseSmartSearch(value);
    const hasSmartFilters = smartIntent.detected.length > 0 && (
      smartIntent.maxPrice || smartIntent.minPrice || smartIntent.ram || smartIntent.storage ||
      smartIntent.display || smartIntent.refresh || smartIntent.camera || smartIntent.battery ||
      smartIntent.chipset || smartIntent.fiveG || smartIntent.nfc || smartIntent.pta || smartIntent.sort
    );
    router.push(hasSmartFilters ? smartSearchToPhonesUrl(smartIntent) : `/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <>
      <div ref={containerRef} className="relative max-w-xl">
        <form onSubmit={submit} role="search" className="hero-search-slide flex gap-2" style={{ animationDelay: '0.7s' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              placeholder={placeholder}
              value={query}
              onChange={event => handleChange(event.target.value)}
              onFocus={() => { if (query.trim().length >= 2) setShowDropdown(true); }}
              autoComplete="off"
              inputMode="search"
              className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 h-10 sm:h-12 text-xs sm:text-sm rounded-xl bg-white/15 backdrop-blur-xl text-white outline-none focus:ring-2 focus:ring-blue-400/40 focus:bg-white/20 border border-white/10 placeholder:text-gray-400 transition-all"
              aria-label="Search phones"
            />
          </div>
          <button type="submit" disabled={!query.trim()} className="glass-float flex h-10 min-w-11 items-center justify-center gap-1.5 px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:gap-2 sm:px-6 sm:text-sm">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Search
          </button>
        </form>

        {showDropdown && (
          <div className="absolute left-0 right-0 sm:right-auto sm:w-[26rem] top-full mt-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</div>
            ) : results.length > 0 ? (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map(r => (
                  <li key={r.id}>
                    <Link
                      href={`/phones/${r.slug}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                        {r.thumbnail ? <Image src={r.thumbnail} alt={r.modelName} width={36} height={36} className="object-contain w-full h-full" unoptimized /> : <Smartphone className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.brand?.name} {r.modelName}</p>
                        <p className="text-xs text-gray-500">{r.pricePKR ? `PKR ${r.pricePKR.toLocaleString()}` : 'Price unavailable'}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">No phones found</p>
            )}
          </div>
        )}
      </div>

      <div className="hero-animate flex flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6" style={{ animationDelay: '0.9s' }}>
        <Link href={cta1Url || '/phones'} className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border border-white/20 text-xs sm:text-sm rounded-md inline-flex items-center">
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> {cta1Text || 'Browse Phones'}
        </Link>
        <Link href={cta2Url || '/compare'} className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border border-white/20 text-xs sm:text-sm rounded-md inline-flex items-center">
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> {cta2Text || 'Compare'}
        </Link>
      </div>
    </>
  );
}

