'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Smartphone, Layers, ChevronRight, ChevronLeft, Clock3, Archive, Sparkles, BadgeDollarSign, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { PhoneGrid } from '@/components/shared/PhoneGrid';
import { formatPrice } from '@/components/shared/formatPrice';
import { OFFICIAL_LOGOS } from '@/lib/brand-logos';
import type { Brand, Phone } from '@/components/shared/types';

const PER_PAGE = 20;
type LifecycleTab = 'all' | 'latest' | 'rumored' | 'coming_soon' | 'discontinued';
const getLifecycle = (phone: Phone) => phone.availabilityStatus || (phone.upcoming ? 'coming_soon' : 'available');
const isRumouredPhone = (phone: Phone) => getLifecycle(phone) === 'rumored';
const isComingSoonPhone = (phone: Phone) => {
  const lifecycle = getLifecycle(phone);
  return lifecycle !== 'rumored' && (phone.upcoming || ['announced', 'coming_soon'].includes(lifecycle));
};
const isDiscontinuedPhone = (phone: Phone) =>
  ['discontinued', 'cancelled'].includes(getLifecycle(phone)) || Boolean(phone.discontinuedAt);
const isLatestPhone = (phone: Phone) => !isRumouredPhone(phone) && !isComingSoonPhone(phone) && !isDiscontinuedPhone(phone);
const getPhoneSeries = (phone: Phone, brandName: string) => {
  let model = phone.modelName.trim();
  if (model.toLowerCase().startsWith(brandName.toLowerCase())) model = model.slice(brandName.length).trim();
  const knownSeries = model.match(/^(Galaxy\s+(?:S|A|M|F|Z|Note)|iPhone|Redmi\s+Note|Redmi|POCO|Reno|Find|Nord|Camon|Spark|Hot|Note|GT|Phantom|V|Y|X)\b/i);
  return knownSeries ? `${knownSeries[1]} Series` : 'Other Models';
};
const PRICE_OPTIONS = [
  { label: 'All Prices', min: 0, max: 0, key: 'all' },
  { label: 'Under 20K', min: 0, max: 20000, key: 'under20k' },
  { label: '20K - 40K', min: 20000, max: 40000, key: '20k-40k' },
  { label: '40K - 60K', min: 40000, max: 60000, key: '40k-60k' },
  { label: '60K - 100K', min: 60000, max: 100000, key: '60k-100k' },
  { label: 'Above 100K', min: 100000, max: 0, key: 'above100k' },
];
const readQueryValue = (key: string, allowed?: readonly string[]) => {
  if (typeof window === 'undefined') return 'all';
  const value = new URLSearchParams(window.location.search).get(key) || 'all';
  return !allowed || allowed.includes(value) ? value : 'all';
};

export default function BrandDetailClient({ initialBrand, initialPhones }: { initialBrand: Brand | null; initialPhones: Phone[] }) {
  const brand = initialBrand;
  const phones = initialPhones;
  const [priceFilter, setPriceFilter] = useState(() => readQueryValue('price', PRICE_OPTIONS.map(option => option.key)));
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'newest' | 'price-low' | 'price-high' | 'rating'>(() => {
    const value = readQueryValue('sort', ['newest', 'price-low', 'price-high', 'rating']);
    return value === 'all' ? 'newest' : value as 'newest' | 'price-low' | 'price-high' | 'rating';
  });
  const [lifecycleTab, setLifecycleTab] = useState<LifecycleTab>(() => {
    const value = readQueryValue('status', ['all', 'latest', 'upcoming', 'rumored', 'coming_soon', 'discontinued']);
    return (value === 'upcoming' ? 'coming_soon' : value) as LifecycleTab;
  });
  const [yearFilter, setYearFilter] = useState(() => readQueryValue('year'));
  const [seriesFilter, setSeriesFilter] = useState(() => readQueryValue('series'));

  useEffect(() => { setPage(1); }, [priceFilter, sortOrder, lifecycleTab, yearFilter, seriesFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = new URLSearchParams();
    if (lifecycleTab !== 'all') query.set('status', lifecycleTab);
    if (priceFilter !== 'all') query.set('price', priceFilter);
    if (yearFilter !== 'all') query.set('year', yearFilter);
    if (seriesFilter !== 'all') query.set('series', seriesFilter);
    if (sortOrder !== 'newest') query.set('sort', sortOrder);
    const nextUrl = `${window.location.pathname}${query.size ? `?${query.toString()}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [lifecycleTab, priceFilter, yearFilter, seriesFilter, sortOrder]);

  const years = useMemo(() => [...new Set(phones.map(phone => phone.releaseDate?.slice(0, 4)).filter(year => /^\d{4}$/.test(year || '')) as string[])].sort((a, b) => b.localeCompare(a)), [phones]);
  const series = useMemo(() => {
    if (!brand) return [];
    const counts = new Map<string, number>();
    phones.forEach(phone => {
      const name = getPhoneSeries(phone, brand.name);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [brand, phones]);
  const tabCounts = useMemo(() => ({
    all: phones.length,
    latest: phones.filter(isLatestPhone).length,
    rumored: phones.filter(isRumouredPhone).length,
    coming_soon: phones.filter(isComingSoonPhone).length,
    discontinued: phones.filter(isDiscontinuedPhone).length,
  }), [phones]);
  const pricedPhones = useMemo(() => phones.filter(phone => phone.pricePKR > 0), [phones]);
  const priceSummary = useMemo(() => ({
    min: pricedPhones.length ? Math.min(...pricedPhones.map(phone => phone.pricePKR)) : 0,
    max: pricedPhones.length ? Math.max(...pricedPhones.map(phone => phone.pricePKR)) : 0,
  }), [pricedPhones]);

  const filtered = useMemo(() => {
    let result = [...phones];
    if (lifecycleTab === 'latest') result = result.filter(isLatestPhone);
    else if (lifecycleTab === 'rumored') result = result.filter(isRumouredPhone);
    else if (lifecycleTab === 'coming_soon') result = result.filter(isComingSoonPhone);
    else if (lifecycleTab === 'discontinued') result = result.filter(isDiscontinuedPhone);
    if (yearFilter !== 'all') result = result.filter(phone => phone.releaseDate?.startsWith(yearFilter));
    if (seriesFilter !== 'all' && brand) result = result.filter(phone => getPhoneSeries(phone, brand.name) === seriesFilter);
    const priceOpt = PRICE_OPTIONS.find(p => p.key === priceFilter);
    if (priceOpt && (priceOpt.min > 0 || priceOpt.max > 0)) {
      if (priceOpt.max > 0) {
        result = result.filter(p => p.pricePKR >= priceOpt.min && p.pricePKR <= priceOpt.max);
      } else {
        result = result.filter(p => p.pricePKR >= priceOpt.min);
      }
    }
    if (sortOrder === 'price-low') result.sort((a, b) => a.pricePKR - b.pricePKR);
    else if (sortOrder === 'price-high') result.sort((a, b) => b.pricePKR - a.pricePKR);
    else if (sortOrder === 'rating') result.sort((a, b) => b.overallRating - a.overallRating);
    return result;
  }, [phones, lifecycleTab, yearFilter, seriesFilter, priceFilter, sortOrder, brand]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (!brand) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Layers className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Brand not found</h2>
            <p className="text-sm text-muted-foreground mt-2">The brand you&apos;re looking for doesn&apos;t exist.</p>
            <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/brands">Browse All Brands</Link></Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-blue-500 transition-colors">Home</Link><ChevronRight className="w-3.5 h-3.5" />
            <Link href="/brands" className="hover:text-blue-500 transition-colors">Brands</Link><ChevronRight className="w-3.5 h-3.5" />
            <span className="font-medium text-gray-900">{brand.name}</span>
          </div>

          {/* Brand Header */}
          <div className="card-premium p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {(() => { const logo = OFFICIAL_LOGOS[brand.name.toLowerCase()] || OFFICIAL_LOGOS[brand.slug.toLowerCase()] || brand.logo; return logo ? <Image src={logo} alt={`${brand.name} logo`} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-7 h-7 text-gray-400" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-display">{brand.name}</h1>
                <p className="text-sm text-muted-foreground">{brand.country && `${brand.country} · `}{phones.length} phones</p>
                {brand.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{brand.description}</p>}
              </div>
              <Link href="/brands" className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-500 transition-colors shrink-0">
                <ChevronLeft className="w-4 h-4" /> All Brands
              </Link>
            </div>
          </div>

          {/* Brand intelligence summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Available phones', value: tabCounts.latest, icon: Sparkles, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Rumoured', value: tabCounts.rumored, icon: Radio, tone: 'text-amber-600 bg-amber-50' },
              { label: 'Coming soon', value: tabCounts.coming_soon, icon: Clock3, tone: 'text-violet-600 bg-violet-50' },
              { label: 'Discontinued', value: tabCounts.discontinued, icon: Archive, tone: 'text-slate-600 bg-slate-100' },
              { label: 'Price range', value: priceSummary.min ? `PKR ${Math.round(priceSummary.min / 1000)}K–${Math.round(priceSummary.max / 1000)}K` : 'Not available', icon: BadgeDollarSign, tone: 'text-emerald-600 bg-emerald-50' },
            ].map(item => <div key={item.label} className="rounded-2xl border border-white/80 bg-white/55 p-3.5 shadow-sm backdrop-blur-xl sm:p-4">
              <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}><item.icon className="h-4.5 w-4.5" /></div>
              <strong className="block text-lg font-extrabold text-slate-900">{item.value}</strong>
              <span className="text-xs text-slate-500">{item.label}</span>
            </div>)}
          </div>

          {/* Availability navigation */}
          <div className="overflow-x-auto no-scrollbar">
            <div role="tablist" aria-label={`${brand.name} phone availability`} className="flex min-w-max gap-1 rounded-2xl border border-white/80 bg-white/45 p-1.5 shadow-sm backdrop-blur-xl">
              {([
                ['all', 'All Phones'],
                ['latest', 'Available / Latest'],
                ['rumored', 'Rumoured'],
                ['coming_soon', 'Coming Soon'],
                ['discontinued', 'Discontinued'],
              ] as Array<[LifecycleTab, string]>).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={lifecycleTab === key} onClick={() => setLifecycleTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${lifecycleTab === key ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-white/80 hover:text-blue-700'}`}>
                  {label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${lifecycleTab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tabCounts[key]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              {PRICE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select aria-label="Release year" value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="all">All Years</option>
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select aria-label="Phone series" value={seriesFilter} onChange={e => setSeriesFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="all">All Series</option>
              {series.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
            </select>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <span className="text-sm text-muted-foreground ml-auto">{filtered.length} phone{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Phone Grid */}
          {paginated.length > 0 ? (
            <>
              <PhoneGrid page="brands">
                {paginated.map(p => <PhoneCard key={p.id} phone={p} />)}
              </PhoneGrid>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) pageNum = i + 1;
                      else if (page <= 4) pageNum = i + 1;
                      else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                      else pageNum = page - 3 + i;
                      return (
                        <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${pageNum === page ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25' : 'text-gray-600 hover:bg-gray-100'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-3">Page {page} of {totalPages}</span>
                </div>
              )}

              <section aria-labelledby="brand-price-list" className="mt-8 overflow-hidden rounded-2xl border border-white/80 bg-white/55 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-4 sm:px-5">
                  <div>
                    <h2 id="brand-price-list" className="text-lg font-extrabold text-slate-900">{brand.name} Phone Price List</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Compact specifications for the phones currently shown above.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{paginated.length} models</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3">Model</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">RAM</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Year</th><th className="px-4 py-3">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {paginated.map(phone => <tr key={`price-${phone.id}`} className="transition hover:bg-blue-50/40">
                        <td className="px-5 py-3"><Link href={`/phones/${phone.slug}`} className="font-bold text-slate-900 hover:text-blue-700">{phone.modelName}</Link></td>
                        <td className="px-4 py-3 font-semibold text-blue-700">{phone.pricePKR > 0 ? formatPrice(phone.pricePKR) : 'Price not available'}</td>
                        <td className="px-4 py-3 text-slate-600">{phone.specs?.ram || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{phone.specs?.storage || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{phone.releaseDate?.slice(0, 4) || '—'}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-600">{(phone.availabilityStatus || (phone.upcoming ? 'coming soon' : 'available')).replaceAll('_', ' ')}</span></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No phones found matching your filters</p>
              <button onClick={() => { setPriceFilter('all'); setSortOrder('newest'); setYearFilter('all'); setSeriesFilter('all'); setLifecycleTab('all'); }} className="text-sm text-blue-500 hover:text-blue-600 font-medium mt-2">Clear filters</button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
