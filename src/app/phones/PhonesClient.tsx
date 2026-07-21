'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import type { Phone, Brand } from '@/components/shared/types';

function PhoneCardSkeleton() {
  return (
    <div className="card-premium overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="skeleton-shimmer aspect-square rounded-xl mb-3" />
        <div className="skeleton-shimmer h-3 w-16 mb-2 rounded-md" />
        <div className="skeleton-shimmer h-4 w-full mb-1.5 rounded-md" />
        <div className="skeleton-shimmer h-4 w-3/4 mb-2 rounded-md" />
        <div className="skeleton-shimmer h-3 w-20 mb-1 rounded-md" />
        <div className="skeleton-shimmer h-3 w-16 mb-3 rounded-md" />
        <div className="skeleton-shimmer h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

const PER_PAGE = 20;

const PRICE_RANGES: { label: string; min: number; max: number }[] = [
  { label: 'All Prices', min: 0, max: 0 },
  { label: 'Under 20K', min: 0, max: 20000 },
  { label: '20K - 40K', min: 20000, max: 40000 },
  { label: '40K - 60K', min: 40000, max: 60000 },
  { label: '60K - 100K', min: 60000, max: 100000 },
  { label: 'Above 100K', min: 100000, max: 0 },
];

const RAM_OPTIONS = ['All', '2', '3', '4', '6', '8', '12', '16'];
const STORAGE_OPTIONS = ['All', '32', '64', '128', '256', '512', '1024'];
const DISPLAY_OPTIONS = ['all', 'AMOLED', 'OLED', 'IPS LCD'];
const REFRESH_OPTIONS = ['all', '90', '120', '144'];
const CAMERA_OPTIONS = ['all', '50', '108', '200'];
const BATTERY_OPTIONS = ['all', '4500', '5000', '6000'];
const CHIPSET_OPTIONS = ['all', 'Snapdragon', 'Dimensity', 'Exynos', 'Apple', 'Helio', 'Unisoc'];

export default function PhonesClient({ initialPhones, initialBrands, initialTotal, initialQueryKey }: { initialPhones: Phone[]; initialBrands: Brand[]; initialTotal: number; initialQueryKey: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── All hooks BEFORE any early return ──
  const [phones, setPhones] = useState<Phone[]>(initialPhones);
  const [brands] = useState<Brand[]>(initialBrands);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const hydratedQueryKey = useRef(initialQueryKey);

  const q = searchParams.get('q') || '';
  const brandParam = searchParams.get('brand') || 'all';
  const priceParam = searchParams.get('price') || 'all';
  const ramParam = searchParams.get('ram') || 'All';
  const storageParam = searchParams.get('storage') || 'All';
  const sortParam = searchParams.get('sort') || 'newest';
  const fiveGParam = searchParams.get('5g') || 'all';
  const nfcParam = searchParams.get('nfc') || 'all';
  const ptaParam = searchParams.get('pta') || 'all';
  const displayParam = searchParams.get('display') || 'all';
  const refreshParam = searchParams.get('refresh') || 'all';
  const cameraParam = searchParams.get('camera') || 'all';
  const batteryParam = searchParams.get('battery') || 'all';
  const chipsetParam = searchParams.get('chipset') || 'all';
  const priceDropParam = searchParams.get('priceDrop') || '';
  const collectionParam = searchParams.get('collection') || '';
  const pageParam = parseInt(searchParams.get('page') || '1');

  const [search, setSearch] = useState(q);

  useEffect(() => { setSearch(q); }, [q]);

  // Build API query from all filter params
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(pageParam));
    params.set('limit', String(PER_PAGE));

    if (q) params.set('search', q);
    if (brandParam !== 'all') params.set('brand', brandParam);

    // Price range
    const pr = PRICE_RANGES.find(r => r.label.toLowerCase().replace(/\s+/g, '') === priceParam.replace(/\s+/g, ''));
    if (pr && pr.min > 0) params.set('priceMin', String(pr.min));
    if (pr && pr.max > 0) params.set('priceMax', String(pr.max));

    // RAM
    if (ramParam !== 'All') params.set('ramMin', ramParam);

    // Storage
    if (storageParam !== 'All') params.set('storageMin', storageParam);

    // Sort
    const sortMap: Record<string, string> = {
      'newest': 'createdAt',
      'price-low': 'pricePKR',
      'price-high': 'pricePKR',
      'rating': 'overallRating',
      'name': 'modelName',
      'trending': 'trending',
    };
    if (sortMap[sortParam]) {
      params.set('sort', sortMap[sortParam]);
      params.set('order', sortParam === 'price-low' || sortParam === 'name' ? 'asc' : 'desc');
    }

    // PTA filter
    if (ptaParam !== 'all') params.set('pta', ptaParam);

    // 5G filter
    if (fiveGParam !== 'all') params.set('5g', fiveGParam);

    // NFC filter
    if (nfcParam !== 'all') params.set('nfc', nfcParam);
    if (displayParam !== 'all') params.set('displayType', displayParam);
    if (refreshParam !== 'all') params.set('refreshMin', refreshParam);
    if (cameraParam !== 'all') params.set('cameraMin', cameraParam);
    if (batteryParam !== 'all') params.set('batteryMin', batteryParam);
    if (chipsetParam !== 'all') params.set('chipset', chipsetParam);

    // Curated collection filter
    if (collectionParam) params.set('collection', collectionParam);

    // Price drop filter
    if (priceDropParam === 'true') params.set('priceDrop', 'true');

    const queryKey = params.toString();
    if (hydratedQueryKey.current === queryKey) {
      hydratedQueryKey.current = '';
      setLoading(false);
      return () => { cancelled = true; };
    }

    fetch(`/api/phones?${queryKey}`).then(r => r.json()).then(pd => {
      if (!cancelled) {
        setPhones(pd.phones || []);
        setTotal(pd.total || 0);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageParam, q, brandParam, priceParam, ramParam, storageParam, sortParam, fiveGParam, nfcParam, ptaParam, displayParam, refreshParam, cameraParam, batteryParam, chipsetParam, priceDropParam, collectionParam]);

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '' || key === 'page') {
      if (key === 'page') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    } else {
      params.set(key, value);
    }
    if (key !== 'page') params.set('page', '1');
    router.push(`/phones?${params.toString()}`);
  }, [router, searchParams]);

  const clearAll = useCallback(() => {
    router.push('/phones');
    setSearch('');
  }, [router]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const activeFilterCount = [brandParam, priceParam, ramParam, storageParam, fiveGParam, nfcParam, ptaParam, displayParam, refreshParam, cameraParam, batteryParam, chipsetParam, q ? 'search' : '', priceDropParam ? 'priceDrop' : '', collectionParam ? 'collection' : ''].filter(f => f && f !== 'all' && f !== 'All').length;

  const pageTitle = collectionParam === 'latest' ? 'Latest Phones' : collectionParam === 'trending' ? 'Trending Phones' : collectionParam === 'featured' ? 'Featured Phones' : collectionParam === 'upcoming' ? 'Upcoming Phones' : 'All Phones';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{total} phone{total !== 1 ? 's' : ''} found{activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active)` : ''}</p>
          </div>

          {/* Search & Sort Bar */}
          <div className="card-premium p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input placeholder="Search phones..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') updateParam('q', search); }} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={sortParam} onChange={e => updateParam('sort', e.target.value)} className="h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                  <option value="newest">Newest</option>
                  <option value="trending">Trending</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>

            {/* Filter Rows */}
            <div className="flex flex-wrap gap-2">
              <select value={brandParam} onChange={e => updateParam('brand', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="all">All Brands</option>
                {brands.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
              <select value={priceParam} onChange={e => updateParam('price', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {PRICE_RANGES.map(r => <option key={r.label} value={r.label.toLowerCase().replace(/\s+/g, '')}>{r.label}</option>)}
              </select>
              <select value={ramParam} onChange={e => updateParam('ram', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {RAM_OPTIONS.map(r => <option key={r} value={r}>{r === 'All' ? 'All RAM' : `${r}GB`}</option>)}
              </select>
              <select value={storageParam} onChange={e => updateParam('storage', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {STORAGE_OPTIONS.map(r => <option key={r} value={r}>{r === 'All' ? 'All Storage' : r === '1024' ? '1TB' : `${r}GB`}</option>)}
              </select>
              <select value={fiveGParam} onChange={e => updateParam('5g', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="all">5G: All</option>
                <option value="yes">5G: Yes</option>
                <option value="no">5G: No</option>
              </select>
              <select value={nfcParam} onChange={e => updateParam('nfc', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="all">NFC: All</option>
                <option value="yes">NFC: Yes</option>
                <option value="no">NFC: No</option>
              </select>
              <select value={ptaParam} onChange={e => updateParam('pta', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="all">PTA: All</option>
                <option value="approved">PTA: Approved</option>
                <option value="pending">PTA: Not Approved</option>
              </select>
              <select value={displayParam} onChange={e => updateParam('display', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {DISPLAY_OPTIONS.map(value => <option key={value} value={value}>{value === 'all' ? 'Display: All' : `Display: ${value}`}</option>)}
              </select>
              <select value={refreshParam} onChange={e => updateParam('refresh', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {REFRESH_OPTIONS.map(value => <option key={value} value={value}>{value === 'all' ? 'Refresh: All' : `${value}Hz+`}</option>)}
              </select>
              <select value={cameraParam} onChange={e => updateParam('camera', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {CAMERA_OPTIONS.map(value => <option key={value} value={value}>{value === 'all' ? 'Camera: All' : `${value}MP+`}</option>)}
              </select>
              <select value={batteryParam} onChange={e => updateParam('battery', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {BATTERY_OPTIONS.map(value => <option key={value} value={value}>{value === 'all' ? 'Battery: All' : `${value}mAh+`}</option>)}
              </select>
              <select value={chipsetParam} onChange={e => updateParam('chipset', e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                {CHIPSET_OPTIONS.map(value => <option key={value} value={value}>{value === 'all' ? 'Chipset: All' : value}</option>)}
              </select>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Active:</span>
                {search && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => { setSearch(''); updateParam('q', ''); }}><Search className="w-3 h-3" />{search}<span className="ml-1">&times;</span></Badge>}
                {brandParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('brand', 'all')}>Brand: {brands.find(b => b.slug === brandParam)?.name || brandParam}<span className="ml-1">&times;</span></Badge>}
                {priceParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('price', 'all')}>Price: {PRICE_RANGES.find(r => r.label.toLowerCase().replace(/\s+/g, '') === priceParam)?.label || priceParam}<span className="ml-1">&times;</span></Badge>}
                {ramParam !== 'All' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('ram', 'All')}>RAM: {ramParam}GB<span className="ml-1">&times;</span></Badge>}
                {storageParam !== 'All' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('storage', 'All')}>Storage: {storageParam === '1024' ? '1TB' : `${storageParam}GB`}<span className="ml-1">&times;</span></Badge>}
                {fiveGParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('5g', 'all')}>5G: {fiveGParam}<span className="ml-1">&times;</span></Badge>}
                {nfcParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('nfc', 'all')}>NFC: {nfcParam}<span className="ml-1">&times;</span></Badge>}
                {ptaParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('pta', 'all')}>PTA: {ptaParam}<span className="ml-1">&times;</span></Badge>}
                {displayParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('display', 'all')}>Display: {displayParam}<span className="ml-1">&times;</span></Badge>}
                {refreshParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('refresh', 'all')}>{refreshParam}Hz+<span className="ml-1">&times;</span></Badge>}
                {cameraParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('camera', 'all')}>{cameraParam}MP+<span className="ml-1">&times;</span></Badge>}
                {batteryParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('battery', 'all')}>{batteryParam}mAh+<span className="ml-1">&times;</span></Badge>}
                {chipsetParam !== 'all' && <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => updateParam('chipset', 'all')}>Chipset: {chipsetParam}<span className="ml-1">&times;</span></Badge>}
                <button onClick={clearAll} className="text-xs text-blue-500 hover:text-blue-600 font-medium">Clear all</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{Array(8).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div>
          ) : phones.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {phones.map(p => <PhoneCard key={p.id} phone={p} />)}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={pageParam <= 1} onClick={() => updateParam('page', String(pageParam - 1))}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (pageParam <= 4) {
                        pageNum = i + 1;
                      } else if (pageParam >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = pageParam - 3 + i;
                      }
                      return (
                        <button key={pageNum} onClick={() => updateParam('page', String(pageNum))} className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${pageNum === pageParam ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25' : 'text-gray-600 hover:bg-gray-100'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={pageParam >= totalPages} onClick={() => updateParam('page', String(pageParam + 1))}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-3">Page {pageParam} of {totalPages}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Smartphone className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No phones found</h3>
              <p className="text-sm mb-4">Try adjusting your filters or search terms</p>
              <Button variant="outline" className="rounded-xl" onClick={clearAll}>Clear All Filters</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
