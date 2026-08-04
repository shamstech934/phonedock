'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Layers, Search, X } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { BrandLogo } from '@/components/shared/BrandLogo';
import type { Brand } from '@/components/shared/types';

const ALL = 'ALL';

export default function BrandsClient({ initialBrands }: { initialBrands: Brand[] }) {
  const [brands] = useState<Brand[]>(initialBrands);
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState(ALL);

  const letters = useMemo(
    () => Array.from(new Set(brands.map((brand) => brand.name.charAt(0).toUpperCase()))).sort(),
    [brands],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return brands
      .filter((brand) => {
        const matchesSearch = !query
          || brand.name.toLowerCase().includes(query)
          || brand.country?.toLowerCase().includes(query);
        const matchesLetter = activeLetter === ALL
          || brand.name.charAt(0).toUpperCase() === activeLetter;
        return matchesSearch && matchesLetter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeLetter, brands, search]);

  const clearFilters = () => {
    setSearch('');
    setActiveLetter(ALL);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/40 dark:bg-slate-950">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1760px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8 2xl:px-10">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Phone directory</p>
              <h1 className="font-display text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">All Brands</h1>
              <p className="mt-2 text-sm text-slate-500 sm:text-base dark:text-slate-400">
                Explore {brands.length} smartphone brands and {brands.reduce((sum, brand) => sum + (brand._count?.phones || 0), 0)} listed phones.
              </p>
            </div>

            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search brands"
                placeholder="Search brands or country..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/80 bg-white/85 pl-12 pr-12 text-sm text-slate-900 shadow-[0_12px_35px_rgba(15,23,42,.07)] outline-none ring-blue-500/20 backdrop-blur-xl transition focus:border-blue-300 focus:ring-4 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear brand search"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {letters.length > 0 && (
            <div className="sticky top-[72px] z-20 mb-7 overflow-x-auto rounded-2xl border border-white/80 bg-white/85 p-2 shadow-[0_10px_30px_rgba(15,23,42,.06)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
              <div className="flex min-w-max items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveLetter(ALL)}
                  className={`h-10 rounded-xl px-4 text-sm font-bold transition ${activeLetter === ALL ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  All
                </button>
                {letters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setActiveLetter(letter)}
                    className={`h-10 min-w-10 rounded-xl px-3 text-sm font-bold transition ${activeLetter === letter ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    {letter}
                  </button>
                ))}
                <span className="ml-2 border-l border-slate-200 pl-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {filtered.length} result{filtered.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.slug}`}
                  className="group flex min-h-[230px] flex-col rounded-3xl border border-white/90 bg-white/82 p-5 shadow-[0_14px_40px_rgba(15,23,42,.07)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_50px_rgba(37,99,235,.13)] sm:min-h-[250px] sm:p-6 dark:border-slate-700 dark:bg-slate-900/85"
                >
                  <BrandLogo
                    name={brand.name}
                    slug={brand.slug}
                    logo={brand.logo}
                    size={104}
                    className="mb-6 transition-transform duration-200 group-hover:scale-105"
                    imageClassName="!h-[78%] !w-[82%]"
                  />

                  <div className="mt-auto">
                    <h2 className="text-base font-extrabold text-slate-950 transition-colors group-hover:text-blue-600 sm:text-lg dark:text-white">
                      {brand.name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {brand._count?.phones || 0} phone{(brand._count?.phones || 0) === 1 ? '' : 's'}
                    </p>
                    {brand.country && (
                      <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{brand.country}</p>
                    )}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-blue-600 dark:border-slate-800 dark:text-sky-400">
                      <span>View phones</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 transition group-hover:translate-x-1 group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-800">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-20 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <Layers className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
              <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">No brands found</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try another name, country, or alphabet filter.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                Show all brands
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
