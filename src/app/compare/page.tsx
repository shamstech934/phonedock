'use client';

import { MAX_COMPARE_PHONES, MIN_COMPARE_PHONES, normalizeCompareValues, canAddComparePhone } from '@/lib/compare';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, X, Check, Trophy, Camera, Cpu, Battery, Tag, GitCompare, Shield, Plus, Share2, Copy, Printer, MonitorSmartphone, Wifi, Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import type { Phone } from '@/components/shared/types';
import { SmartComparisonSummary } from '@/components/compare/SmartComparisonSummary';

const compareAutocompleteCache = new Map<string, { expiresAt: number; phones: Phone[] }>();
const compareLookupCache = new Map<string, { expiresAt: number; phones: Phone[] }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000;

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slugsParam = searchParams.get('p') || searchParams.get('ids') || '';

  // ── All hooks BEFORE any early return ──
  const [selected, setSelected] = useState<Phone[]>([]);
  const selectedRef = useRef<Phone[]>([]);
  const [search, setSearch] = useState('');
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Phone[]>([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acError, setAcError] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [activeSpecCategory, setActiveSpecCategory] = useState('All');
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
  const [slotQueries, setSlotQueries] = useState<Record<number, string>>({ 0: '', 1: '' });
  const slotSectionRef = useRef<HTMLDivElement | null>(null);
  const acAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      setOnlyDifferences(localStorage.getItem('compare-only-differences') === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('compare-only-differences', onlyDifferences ? '1' : '0');
    } catch {}
  }, [onlyDifferences]);

  // Hydrate every URL selection with the full comparison payload. Autocomplete
  // results are intentionally lightweight and must never drive the comparison UI.
  useEffect(() => {
    if (!slugsParam) {
      selectedRef.current = [];
      setSelected([]);
      setCompared(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    const hasVisibleSelection = selectedRef.current.length > 0;
    if (hasVisibleSelection) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const slugs = normalizeCompareValues(slugsParam);
    const lookupKey = slugs.join(',');
    const cachedLookup = compareLookupCache.get(lookupKey);
    if (cachedLookup && cachedLookup.expiresAt > Date.now()) {
      const phones = cachedLookup.phones;
      compareLookupCache.set(lookupKey, { expiresAt: Date.now() + CLIENT_CACHE_TTL, phones });
      selectedRef.current = phones;
      setSelected(phones);
      setCompared(phones.length >= 2);
      setLoading(false);
      setRefreshing(false);
      if (phones.length === 1) setActiveSlotIndex(1);
      return;
    }
    fetch(`/api/phones/lookup?slugs=${encodeURIComponent(lookupKey)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
      if (cancelled) return;
      const phones: Phone[] = (data.phones || []).map((d: Phone & { _id?: string }) => ({
        ...d,
        id: d.id || d._id || d.slug,
      }));
      selectedRef.current = phones;
      setSelected(phones);
      if (phones.length >= 2) {
        setCompared(true);
      } else if (phones.length > 0) {
        setActiveSlotIndex(1);
      }
      setLoading(false);
      setRefreshing(false);
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => { cancelled = true; };
  }, [slugsParam]);

  // Debounced autocomplete search
  useEffect(() => {
    if (acAbortRef.current) acAbortRef.current.abort();
    if (!search || search.length < 2) { setAutocompleteResults([]); setAcError(false); return; }
    const normalizedSearch = search.trim().toLowerCase();
    const cachedSearch = compareAutocompleteCache.get(normalizedSearch);
    if (cachedSearch && cachedSearch.expiresAt > Date.now()) {
      const results = cachedSearch.phones.filter(p => !selected.some(s => s.id === p.id));
      setAutocompleteResults(results);
      setActiveResultIndex(results.length ? 0 : -1);
      setAcLoading(false);
      setAcError(false);
      return;
    }
    setAcLoading(true);
    setAcError(false);
    const timer = setTimeout(() => {
      const controller = new AbortController();
      acAbortRef.current = controller;
      fetch(`/api/phones/autocomplete?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => {
          const allResults: Phone[] = data.phones || [];
          compareAutocompleteCache.set(normalizedSearch, { expiresAt: Date.now() + CLIENT_CACHE_TTL, phones: allResults });
          const results = allResults.filter((p: Phone) => !selected.some(s => s.id === p.id));
          setAutocompleteResults(results);
          setActiveResultIndex(results.length ? 0 : -1);
          setAcLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setAcError(true);
            setAutocompleteResults([]);
            setActiveResultIndex(-1);
            setAcLoading(false);
          }
        });
    }, 140);
    return () => { clearTimeout(timer); if (acAbortRef.current) acAbortRef.current.abort(); };
  }, [search, selected]);

  const updateURL = (phones: Phone[]) => {
    const slugs = phones.map(p => p.slug).join(',');
    if (slugs) {
      router.replace(`/compare?p=${slugs}`, { scroll: false });
    } else {
      router.replace('/compare', { scroll: false });
    }
  };

  const copyComparisonLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy comparison link', url);
    }
  };

  const shareComparison = async () => {
    const url = window.location.href;
    const title = comparePhones.length >= 2
      ? `${comparePhones.map(phone => phone.modelName).join(' vs ')} | SpecsDekh`
      : 'Compare Phones | SpecsDekh';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    await copyComparisonLink();
  };

  const togglePhone = (phone: Phone) => {
    let next: Phone[];
    if (selected.some(p => p.id === phone.id)) {
      next = selected.filter(p => p.id !== phone.id);
    } else if (canAddComparePhone(selected.length)) {
      next = [...selected, phone];
    } else {
      return;
    }
    selectedRef.current = next;
    setSelected(next);
    setCompared(next.length >= MIN_COMPARE_PHONES);
    if (next.length >= 2) {
        updateURL(next);
    } else {
      updateURL(next);
    }
  };

  const removePhone = (id: string) => {
    const next = selected.filter(p => p.id !== id);
    selectedRef.current = next;
    setSelected(next);
    if (next.length < 2) { setCompared(false); }
    updateURL(next);
  };

  const clearAll = () => {
    selectedRef.current = [];
    setSelected([]);
    setCompared(false);
    updateURL([] as Phone[]);
  };

  const openPicker = () => {
    const nextSlot = Math.min(selected.length, MAX_COMPARE_PHONES - 1);
    setActiveSlotIndex(nextSlot);
    setSearch('');
    window.setTimeout(() => slotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const selectPhoneForSlot = (phone: Phone, slotIndex: number) => {
    if (selected.some((item, index) => item.id === phone.id && index !== slotIndex)) return;
    const next = [...selected];
    if (slotIndex < next.length) next[slotIndex] = phone;
    else if (canAddComparePhone(next.length)) next.push(phone);
    else return;
    selectedRef.current = next;
    setSelected(next);
    setCompared(next.length >= MIN_COMPARE_PHONES);
    setActiveSlotIndex(Math.min(slotIndex + 1, MAX_COMPARE_PHONES - 1));
    setSlotQueries(current => ({ ...current, [slotIndex]: '', [Math.min(slotIndex + 1, MAX_COMPARE_PHONES - 1)]: current[Math.min(slotIndex + 1, MAX_COMPARE_PHONES - 1)] || '' }));
    setSearch('');
    setAutocompleteResults([]);
    updateURL(next);
  };

  const closePicker = () => {
    setSearch('');
    setAutocompleteResults([]);
  };

  const comparePhones = selected;

  const getWinner = (key: 'cameraScore' | 'performanceScore' | 'batteryScore' | 'valueScore') => {
    let best: Phone | null = null;
    let max = 0;
    let allZero = true;
    for (const p of comparePhones) {
      const val = (p as unknown as Record<string, unknown>)[key] as number || 0;
      if (val > 0) allZero = false;
      if (val > max) { max = val; best = p; }
    }
    // Don't declare winner if all values are zero/missing
    if (allZero) return null;
    return best;
  };

  const catData = [
    { label: 'Camera', key: 'cameraScore' as const, icon: Camera, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Performance', key: 'performanceScore' as const, icon: Cpu, gradient: 'from-violet-500 to-purple-600' },
    { label: 'Battery', key: 'batteryScore' as const, icon: Battery, gradient: 'from-emerald-500 to-green-600' },
    { label: 'Value', key: 'valueScore' as const, icon: Tag, gradient: 'from-amber-500 to-orange-500' },
  ];

  const safeScore = (value: unknown, multiplier = 1) => {
    const score = Number(value) * multiplier;
    return Number.isFinite(score) && score > 0 ? Math.min(100, score) : 0;
  };

  const metrics = [
    { label: 'Overall', get: (p: Phone) => safeScore(p.overallRating, 10) },
    { label: 'Camera', get: (p: Phone) => safeScore(p.cameraScore) },
    { label: 'Performance', get: (p: Phone) => safeScore(p.performanceScore) },
    { label: 'Battery', get: (p: Phone) => safeScore(p.batteryScore) },
    { label: 'Display', get: (p: Phone) => safeScore(p.displayScore) },
    { label: 'Value', get: (p: Phone) => safeScore(p.valueScore) },
  ];

  const specRows = [
    { label: 'Display', get: (p: Phone) => p.specs?.display },
    { label: 'Display Type', get: (p: Phone) => p.specs?.displayType },
    { label: 'Resolution', get: (p: Phone) => p.specs?.resolution },
    { label: 'Refresh Rate', get: (p: Phone) => p.specs?.refreshRate },
    { label: 'Protection', get: (p: Phone) => p.specs?.protection },
    { label: 'Chipset', get: (p: Phone) => p.specs?.chipset },
    { label: 'CPU', get: (p: Phone) => p.specs?.cpu },
    { label: 'GPU', get: (p: Phone) => p.specs?.gpu },
    { label: 'RAM', get: (p: Phone) => p.specs?.ram },
    { label: 'RAM Type', get: (p: Phone) => p.specs?.ramType },
    { label: 'Storage', get: (p: Phone) => p.specs?.storage },
    { label: 'Card Slot', get: (p: Phone) => p.specs?.cardSlot },
    { label: 'Main Camera', get: (p: Phone) => p.specs?.mainCamera },
    { label: 'Ultrawide', get: (p: Phone) => p.specs?.ultrawide },
    { label: 'Telephoto', get: (p: Phone) => p.specs?.telephoto },
    { label: 'OIS', get: (p: Phone) => p.specs?.ois },
    { label: 'Video Recording', get: (p: Phone) => p.specs?.videoRecording },
    { label: 'Selfie Camera', get: (p: Phone) => p.specs?.selfieCamera },
    { label: 'Selfie Video', get: (p: Phone) => p.specs?.selfieVideo },
    { label: 'Battery', get: (p: Phone) => p.specs?.battery },
    { label: 'Wired Charging', get: (p: Phone) => p.specs?.chargingSpeed },
    { label: 'Wireless Charging', get: (p: Phone) => p.specs?.wirelessCharge },
    { label: 'Reverse Charging', get: (p: Phone) => p.specs?.reverseCharge },
    { label: 'Weight', get: (p: Phone) => p.specs?.weight },
    { label: 'Dimensions', get: (p: Phone) => p.specs?.dimensions },
    { label: 'Build', get: (p: Phone) => p.specs?.build },
    { label: 'IP Rating', get: (p: Phone) => p.specs?.ipRating },
    { label: 'SIM', get: (p: Phone) => p.specs?.sim },
    { label: 'Network', get: (p: Phone) => p.specs?.network },
    { label: '5G', get: (p: Phone) => p.specs?.fiveG },
    { label: 'WiFi', get: (p: Phone) => p.specs?.wifi },
    { label: 'Bluetooth', get: (p: Phone) => p.specs?.bluetooth },
    { label: 'NFC', get: (p: Phone) => p.specs?.nfc },
    { label: 'USB', get: (p: Phone) => p.specs?.usb },
    { label: 'Fingerprint', get: (p: Phone) => p.specs?.fingerprint },
    { label: 'OS', get: (p: Phone) => [p.specs?.os, p.specs?.osVersion].filter(Boolean).join(' ') },
    { label: 'Colors', get: (p: Phone) => p.specs?.colors },
  ];

  const getFilteredSpecRows = (rows: typeof specRows) => {
    const populatedRows = rows.filter(row => comparePhones.some(phone => {
      const value = row.get(phone);
      return value && value !== 'undefined' && value !== 'null' && value !== '[object Object]';
    }));
    if (!onlyDifferences) return populatedRows;
    return populatedRows.filter(row => {
      const values = comparePhones.map(p => row.get(p) || '');
      return new Set(values).size > 1;
    });
  };

  const specCategories = [
    { label: 'All', icon: GitCompare, rows: specRows.map(row => row.label) },
    { label: 'Display', icon: MonitorSmartphone, rows: ['Display', 'Display Type', 'Resolution', 'Refresh Rate', 'Protection'] },
    { label: 'Performance', icon: Cpu, rows: ['Chipset', 'CPU', 'GPU', 'RAM', 'RAM Type', 'Storage', 'Card Slot'] },
    { label: 'Camera', icon: Camera, rows: ['Main Camera', 'Ultrawide', 'Telephoto', 'OIS', 'Video Recording', 'Selfie Camera', 'Selfie Video'] },
    { label: 'Battery', icon: Battery, rows: ['Battery', 'Wired Charging', 'Wireless Charging', 'Reverse Charging'] },
    { label: 'Body', icon: Box, rows: ['Weight', 'Dimensions', 'Build', 'IP Rating', 'SIM'] },
    { label: 'Connectivity', icon: Wifi, rows: ['Network', '5G', 'WiFi', 'Bluetooth', 'NFC', 'USB', 'Fingerprint', 'OS', 'Colors'] },
  ];

  const categoryRows = activeSpecCategory === 'All'
    ? specRows
    : specRows.filter(row => specCategories.find(category => category.label === activeSpecCategory)?.rows.includes(row.label));

  const getFilteredMetrics = (m: typeof metrics) => {
    if (!onlyDifferences) return m;
    return m.filter(metric => {
      const values = comparePhones.map(p => metric.get(p));
      return new Set(values).size > 1;
    });
  };

  const filteredSpecRows = getFilteredSpecRows(categoryRows);
  const filteredMetrics = getFilteredMetrics(metrics);

  if (loading) {
    return (
      <div className="site-shell py-6">
        <div className="skeleton-shimmer h-64 rounded-2xl" />
        <div className="skeleton-shimmer h-96 rounded-2xl mt-4" />
      </div>
    );
  }

  return (
    <div className="site-shell py-4 sm:py-6 animate-fade-in space-y-6">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-5 py-4 text-white shadow-xl sm:px-6 sm:py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100"><GitCompare className="h-3.5 w-3.5" /> Modern side-by-side comparison</div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold">Compare Phones</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100/80">Compare prices, verified specifications and category winners without waiting for repeated page loads.</p>
          </div>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-xs font-medium text-cyan-100">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" aria-hidden="true" />
              Updating comparison…
            </span>
          )}
          {compared && (
            <>
              <button onClick={shareComparison} className="text-sm font-semibold text-white hover:text-white flex items-center gap-1.5 transition-colors bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-lg" aria-label="Share this comparison">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button onClick={copyComparisonLink} className="text-sm font-semibold text-white hover:text-white flex items-center gap-1.5 transition-colors bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-lg" aria-label="Copy comparison link">
                <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}
              </button>
              <button onClick={() => window.print()} className="hidden sm:flex text-sm font-semibold text-white hover:text-white items-center gap-1.5 transition-colors bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-lg" aria-label="Print comparison">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={openPicker} className="text-sm font-semibold text-white hover:text-white flex items-center gap-1.5 transition-colors bg-cyan-500/80 hover:bg-cyan-400 px-3 py-2 rounded-lg">
                Edit phones
              </button>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Inline phone search slots: visible immediately for first-time visitors */}
      <section ref={slotSectionRef} className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Choose phones side by side</h2>
            <p className="mt-0.5 text-xs text-slate-500">Start with two phones. A new search box appears automatically whenever you add another phone.</p>
          </div>
          {selected.length > 0 && <button onClick={clearAll} className="text-xs font-semibold text-red-500 hover:text-red-600">Clear all</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(MAX_COMPARE_PHONES, Math.max(MIN_COMPARE_PHONES, selected.length + (canAddComparePhone(selected.length) ? 1 : 0))) }).map((_, slotIndex) => {
            const phone = selected[slotIndex];
            const isActive = activeSlotIndex === slotIndex;
            return (
              <div key={slotIndex} className="relative min-w-0">
                {phone ? (
                  <div className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/60 p-3">
                    <SafePhoneImage src={phone.thumbnail} alt={phone.modelName} width={58} height={58} className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Phone {slotIndex + 1}</p>
                      <Link href={`/phones/${phone.slug}`} className="block truncate text-sm font-bold text-slate-900 hover:text-blue-600">{phone.modelName}</Link>
                      <p className="mt-1 text-xs font-semibold text-blue-600">{formatPrice(phone.pricePKR)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => { setActiveSlotIndex(slotIndex); const nextQuery = slotQueries[slotIndex] || ''; setSearch(nextQuery); }} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-100">Change</button>
                      <button onClick={() => removePhone(phone.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Remove ${phone.modelName}`}><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-2xl border bg-slate-50/80 p-3 transition ${isActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-dashed border-slate-300 hover:border-blue-300'}`}>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search phone {slotIndex + 1}</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={slotQueries[slotIndex] || ''}
                        onFocus={() => { setActiveSlotIndex(slotIndex); setSearch(slotQueries[slotIndex] || ''); }}
                        onChange={event => { const value = event.target.value; setActiveSlotIndex(slotIndex); setSlotQueries(current => ({ ...current, [slotIndex]: value })); setSearch(value); }}
                        placeholder={slotIndex === 0 ? 'Search first phone...' : slotIndex === 1 ? 'Search second phone...' : `Search phone ${slotIndex + 1}...`}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                )}
                {isActive && search.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl">
                    {acLoading && autocompleteResults.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> Finding phones…</div>
                    ) : autocompleteResults.length ? autocompleteResults.slice(0, 10).map(result => (
                      <button key={result.id} onClick={() => selectPhoneForSlot(result, slotIndex)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-blue-50">
                        <SafePhoneImage src={result.thumbnail} alt={result.modelName} width={38} height={38} className="h-10 w-10 rounded-lg bg-slate-50 object-contain p-1" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{result.modelName}</span><span className="block text-xs text-slate-500">{result.brand?.name} · {formatPrice(result.pricePKR)}</span></span>
                      </button>
                    )) : !acLoading ? <div className="py-4 text-center"><p className="text-xs font-semibold text-slate-600">No exact match found</p><p className="mt-1 text-[11px] text-slate-400">Try fewer words, for example “S26”, “Ultra” or “Samsung”.</p></div> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Compact management bar for selected phones */}
      {false && selected.length > 0 && (
        <div className="card-premium p-3 sm:p-4 sticky top-16 z-30 supports-[backdrop-filter]:bg-white/90 backdrop-blur-xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {selected.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200/60 shrink-0 min-w-0">
                <SafePhoneImage src={p.thumbnail} alt={p.modelName} width={24} height={24} className="w-6 h-6 rounded" />
                <Link href={`/phones/${p.slug}`} className="text-xs font-semibold text-gray-900 hover:text-blue-500 transition-colors truncate max-w-[120px]">{p.modelName}</Link>
                <button onClick={() => removePhone(p.id)} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400" title="Remove phone" aria-label={`Remove ${p.modelName}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {canAddComparePhone(selected.length) && (
              <button onClick={openPicker} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-blue-300 text-sm font-semibold text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-colors shrink-0" aria-label="Add phones to compare">
                <Plus className="w-4 h-4" /> Add Phones
              </button>
            )}
            <button onClick={clearAll} className="ml-auto text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors" aria-label="Clear all selected phones">
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Modal picker removed: every phone now has its own inline search slot. */}

      {/* Empty state — show inline picker when no phones and no dialog */}
      {false && selected.length === 0 && !loading && (
        <div className="text-center py-16">
          <GitCompare className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Select phones to compare</h2>
          <p className="text-sm text-muted-foreground mb-6">Choose {MIN_COMPARE_PHONES} to {MAX_COMPARE_PHONES} phones by searching, or use URL params like ?p=iphone-15,samsung-s24</p>
          <div className="flex gap-3 justify-center">
            <Button className="rounded-xl" onClick={openPicker}>
              <Plus className="w-4 h-4 mr-1" /> Add Phones
            </Button>
            <Button variant="outline" className="rounded-xl" asChild><Link href="/phones">Browse Phones</Link></Button>
          </div>
        </div>
      )}

      {/* Instruction for 1 phone */}
      {false && selected.length === MIN_COMPARE_PHONES - 1 && !compared && (
        <div className="text-center py-10 card-premium p-6">
          <p className="text-sm text-muted-foreground">Add at least one more phone to compare.</p>
          <Button className="rounded-xl mt-3" onClick={openPicker}>
            <Plus className="w-4 h-4 mr-1" /> Add Another Phone
          </Button>
        </div>
      )}

      {compared && selected.length >= MIN_COMPARE_PHONES && (
        false ? (
          <div className="card-premium p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading full specifications...</p>
          </div>
        ) : (
          <>
            {/* Sticky visual phone header for long comparisons */}
            <section className="sticky top-[8.5rem] z-20 rounded-2xl border border-gray-200/70 bg-white/95 p-3 shadow-sm backdrop-blur-xl">
              <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `repeat(${comparePhones.length}, minmax(150px, 1fr))` }}>
                {comparePhones.map(phone => (
                  <Link key={phone.id} href={`/phones/${phone.slug}`} className="group min-w-0 rounded-xl px-2 py-2 text-center hover:bg-blue-50 transition-colors">
                    <SafePhoneImage src={phone.thumbnail} alt={phone.modelName} width={42} height={42} className="mx-auto h-10 w-10 rounded-lg bg-gray-50 object-contain p-1" />
                    <p className="mt-1 truncate text-[11px] sm:text-xs font-semibold text-gray-900 group-hover:text-blue-600">{phone.modelName}</p>
                    <p className="hidden sm:block text-[10px] font-bold text-blue-600">{formatPrice(phone.pricePKR)}</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* Fast category navigation */}
            <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200/70 bg-white p-2 shadow-sm" aria-label="Specification categories">
              {specCategories.map(category => {
                const Icon = category.icon;
                const active = activeSpecCategory === category.label;
                return (
                  <button key={category.label} onClick={() => setActiveSpecCategory(category.label)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>
                    <Icon className="h-4 w-4" /> {category.label}
                  </button>
                );
              })}
            </nav>

            {/* Specifications Table */}
            <section className="card-premium overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900">Specifications Comparison</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Swipe horizontally on mobile to view every phone.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    <input type="checkbox" checked={onlyDifferences} onChange={e => setOnlyDifferences(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                    Differences only
                  </label>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">{comparePhones.length} phones</span>
                </div>
              </div>
              <div className="overflow-x-auto relative after:absolute after:top-0 after:right-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:pointer-events-none">
                <table className="w-full text-sm" style={{ minWidth: `${Math.max(500, (comparePhones.length + 1) * 170)}px` }}>
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="bg-[#F8FAFC]">
                      <th className="sticky left-0 bg-[#F8FAFC] z-10 text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Spec</th>
                      {comparePhones.map(p => (
                        <th key={p.id} className="text-left px-4 py-3 text-xs font-semibold text-gray-900">
                          <Link href={`/phones/${p.slug}`} className="hover:text-blue-500 transition-colors">{p.modelName}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSpecRows.map((row, i) => {
                      const values = comparePhones.map(p => {
                        const v = row.get(p);
                        if (!v || v === 'undefined' || v === 'null' || v === '[object Object]') return '';
                        return String(v).trim();
                      });
                      const nonEmptyValues = values.filter(v => v && v !== '—');
                      const allSame = nonEmptyValues.length > 0 && new Set(nonEmptyValues).size <= 1;
                      return (
                        <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                          <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-inherit">{row.label}</td>
                          {comparePhones.map(p => {
                            const val = values.find((_, idx) => comparePhones[idx].id === p.id) || '';
                            const displayVal = val || <span className="text-muted-foreground italic text-xs">Not available</span>;
                            const isDifferent = !allSame && Boolean(val);
                            return (
                              <td key={p.id} className={`px-4 py-3 text-gray-900 ${isDifferent ? 'bg-sky-50/60' : ''}`}>
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="bg-white border-t border-gray-100">
                      <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-white">Price</td>
                      {(() => {
                        const prices = comparePhones.map(p => p.pricePKR);
                        const validPrices = prices.filter(p => p > 0);
                        const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
                        return comparePhones.map(p => (
                          <td key={p.id} className={`px-4 py-3 font-bold text-blue-600 ${p.pricePKR === minPrice && comparePhones.length > 1 ? 'bg-emerald-50' : ''}`}>
                            {formatPrice(p.pricePKR)}
                            {p.pricePKR === minPrice && comparePhones.length > 1 && minPrice > 0 && <span className="ml-1 text-[10px] font-medium text-emerald-600">Best</span>}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr className="bg-[#F8FAFC]">
                      <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-[#F8FAFC]">PTA</td>
                      {comparePhones.map(p => (
                        <td key={p.id} className="px-4 py-3">
                          {p.ptaApproved ? <span className="text-emerald-600 font-medium flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Approved</span> : <span className="text-muted-foreground">{p.ptaStatus}</span>}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {filteredSpecRows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">All specifications are identical</p>}
            </section>

            {/* Compact scores and verdict come after specifications */}
            {/* Category Winners */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-blue-500" /> Category Winners</h2>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {catData.map(cat => {
                  const winner = getWinner(cat.key);
                  return (
                    <div key={cat.label} className={`bg-gradient-to-br ${cat.gradient} rounded-xl p-3 text-white relative overflow-hidden shadow-sm ring-1 ring-white/20 transition-transform duration-200 hover:-translate-y-0.5`}>
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1.5"><cat.icon className="w-5 h-5" /><span className="text-sm font-semibold">{cat.label}</span></div>
                        {winner ? (
                          <>
                            <Link href={`/phones/${winner.slug}`} className="font-bold text-sm leading-snug hover:underline">{winner.modelName}</Link>
                            <p className="text-xs text-white/70 mt-1">{winner.brand?.name}</p>
                            <p className="text-lg font-extrabold mt-1">{winner[cat.key] || 0}<span className="text-sm font-medium text-white/70">/100</span></p>
                            {winner.compareScoresEstimated && <p className="mt-1 text-[10px] font-medium text-white/70">Estimated from available specs</p>}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-white/80">No data</p>
                            <p className="text-xs text-white/50 mt-1">Scores not available</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <SmartComparisonSummary phones={comparePhones} />

            {/* Score Comparison */}
            <section className="card-premium p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-bold text-gray-900">Score Comparison</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Higher score is better. Winners are marked automatically.</p>
                </div>
              </div>
              {filteredMetrics.map(metric => {
                const scores = comparePhones.map(p => ({ phone: p, score: metric.get(p) }));
                const maxScore = Math.max(...scores.map(s => s.score));
                const hasNonZero = scores.some(s => s.score > 0);
                const winnerIds = hasNonZero
                  ? scores.filter(s => s.score === maxScore && maxScore > 0).map(s => s.phone.id)
                  : [];
                return (
                  <div key={metric.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {scores.map(s => (
                        <div key={s.phone.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-xs font-medium text-gray-600 w-24 truncate shrink-0">{s.phone.modelName}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${winnerIds.includes(s.phone.id) ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`} style={{ width: `${Math.max(hasNonZero ? s.score : 0, 2)}%` }} />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
                            {winnerIds.includes(s.phone.id) && <Trophy className="w-3.5 h-3.5 text-blue-500" />}
                            <span className={`text-xs font-bold ${winnerIds.includes(s.phone.id) ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.score > 0 ? Math.round(s.score) : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredMetrics.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All scores are identical</p>}
            </section>


          </>
        )
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="site-shell py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /></div>}>
          <CompareContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
