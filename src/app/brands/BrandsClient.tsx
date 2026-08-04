'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Layers, ChevronRight, Search, Smartphone } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { OFFICIAL_LOGOS } from '@/lib/brand-logos';
import type { Brand } from '@/components/shared/types';

export default function BrandsClient({ initialBrands }: { initialBrands: Brand[] }) {
  const [brands] = useState<Brand[]>(initialBrands);
  const [search, setSearch] = useState('');


  const filtered = useMemo(() => {
    if (!search.trim()) return brands;
    const q = search.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(q) || b.country?.toLowerCase().includes(q));
  }, [brands, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Brand[]> = {};
    filtered.forEach(b => {
      const letter = b.name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(b);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">All Brands</h1>
            <p className="text-sm text-muted-foreground mt-1">{brands.length} brands in our database</p>
          </div>

          {/* Search */}
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Search brands..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Alphabet Quick Jump */}
          {!search && grouped.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {grouped.map(([letter]) => (
                <a key={letter} href={`#letter-${letter}`} className="w-8 h-8 rounded-lg bg-white/60 border border-gray-200/60 flex items-center justify-center text-xs font-semibold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                  {letter}
                </a>
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            search ? (
              /* Flat grid for search results */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(brand => (
                  <Link key={brand.id} href={`/brands/${brand.slug}`} className="phone-card glass-shine p-5 cursor-pointer group block">
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                      {(() => { const src = OFFICIAL_LOGOS[brand.name.toLowerCase()] || OFFICIAL_LOGOS[brand.slug?.toLowerCase()] || brand.logo; return src ? <Image src={src} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />; })()}
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{brand.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{brand._count?.phones || 0} phones</p>
                    {brand.country && <p className="text-[10px] text-muted-foreground mt-0.5">{brand.country}</p>}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-3 transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              /* Alphabetical groups */
              <div className="space-y-8">
                {grouped.map(([letter, items]) => (
                  <div key={letter} id={`letter-${letter}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-500/25">{letter}</span>
                      <span className="text-sm text-muted-foreground">{items.length} brand{items.length !== 1 ? 's' : ''}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map(brand => (
                        <Link key={brand.id} href={`/brands/${brand.slug}`} className="phone-card glass-shine p-5 cursor-pointer group block">
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                            {(() => { const src = OFFICIAL_LOGOS[brand.name.toLowerCase()] || OFFICIAL_LOGOS[brand.slug?.toLowerCase()] || brand.logo; return src ? <Image src={src} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />; })()}
                          </div>
                          <h3 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{brand.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{brand._count?.phones || 0} phones</p>
                          {brand.country && <p className="text-[10px] text-muted-foreground mt-0.5">{brand.country}</p>}
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-3 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Layers className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No brands found</h3>
              <p className="text-sm">Try a different search term</p>
              <button onClick={() => setSearch('')} className="text-sm text-blue-500 hover:text-blue-600 font-medium mt-3">Clear search</button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}