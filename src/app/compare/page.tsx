'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search, Star, ChevronLeft, ChevronRight, X, Check, Trophy, Camera, Cpu, Battery, Tag, Smartphone, GitCompare, Wifi, Monitor, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';

function Plus(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slugsParam = searchParams.get('p') || searchParams.get('ids') || '';

  // ── All hooks BEFORE any early return ──
  const [selected, setSelected] = useState<Phone[]>([]);
  const [search, setSearch] = useState('');
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [detailedSelected, setDetailedSelected] = useState<Phone[]>([]);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Phone[]>([]);

  // Load pre-selected phones from URL on mount
  useEffect(() => {
    if (!slugsParam) { setLoading(false); return; }
    let cancelled = false;
    const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    Promise.all(
      slugs.map(slug => fetch(`/api/phones/${encodeURIComponent(slug)}`).then(r => r.json()).catch(() => null))
    ).then(results => {
      if (cancelled) return;
      const phones: Phone[] = results
        .filter(d => d?.phone)
        .map(d => ({ id: d.phone._id || d.phone.id, ...d.phone }));
      setSelected(phones);
      if (phones.length >= 2) { setCompared(true); setShowPicker(false); }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autocomplete search
  useEffect(() => {
    if (!search || search.length < 2) { setAutocompleteResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/phones/autocomplete?q=${encodeURIComponent(search)}`)
        .then(r => r.json())
        .then(data => {
          const results: Phone[] = (data.phones || []).filter(
            (p: Phone) => !selected.some(s => s.id === p.id)
          );
          setAutocompleteResults(results);
        })
        .catch(() => setAutocompleteResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selected]);

  // Fetch full details for comparison
  useEffect(() => {
    if (!compared || selected.length < 2) {
      setDetailedSelected([]);
      return;
    }
    let cancelled = false;
    setFetchingDetails(true);
    Promise.all(
      selected.map(p => fetch(`/api/phones/${p.slug}`).then(r => r.json()))
    ).then(results => {
      if (cancelled) return;
      const detailed: Phone[] = results.map((d, i) => {
        if (d.phone) return { ...selected[i], ...d.phone };
        return selected[i];
      });
      setDetailedSelected(detailed);
      setFetchingDetails(false);
    }).catch(() => {
      if (!cancelled) setFetchingDetails(false);
    });
    return () => { cancelled = true; };
  }, [compared, selected]);

  const updateURL = (phones: Phone[]) => {
    const slugs = phones.map(p => p.slug).join(',');
    if (slugs) {
      router.replace(`/compare?p=${slugs}`, { scroll: false });
    } else {
      router.replace('/compare', { scroll: false });
    }
  };

  const togglePhone = (phone: Phone) => {
    let next: Phone[];
    if (selected.some(p => p.id === phone.id)) {
      next = selected.filter(p => p.id !== phone.id);
    } else if (selected.length < 4) {
      next = [...selected, phone];
    } else {
      return;
    }
    setSelected(next);
    setCompared(false);
    if (next.length >= 2) {
      setTimeout(() => { setCompared(true); setShowPicker(false); updateURL(next); }, 100);
    } else {
      updateURL(next);
    }
  };

  const removePhone = (id: string) => {
    const next = selected.filter(p => p.id !== id);
    setSelected(next);
    if (next.length < 2) { setCompared(false); setShowPicker(true); }
    updateURL(next);
  };

  const comparePhones = detailedSelected.length === selected.length ? detailedSelected : selected;

  const getWinner = (key: 'cameraScore' | 'performanceScore' | 'batteryScore' | 'valueScore') => {
    let best = comparePhones[0]; let max = 0;
    comparePhones.forEach(p => { if ((p as any)[key] > max) { max = (p as any)[key]; best = p; } });
    return best;
  };

  const catData = [
    { label: 'Camera', key: 'cameraScore' as const, icon: Camera, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Performance', key: 'performanceScore' as const, icon: Cpu, gradient: 'from-violet-500 to-purple-600' },
    { label: 'Battery', key: 'batteryScore' as const, icon: Battery, gradient: 'from-emerald-500 to-green-600' },
    { label: 'Value', key: 'valueScore' as const, icon: Tag, gradient: 'from-amber-500 to-orange-500' },
  ];

  const metrics = [
    { label: 'Overall', get: (p: Phone) => p.overallRating * 10 },
    { label: 'Camera', get: (p: Phone) => p.cameraScore },
    { label: 'Performance', get: (p: Phone) => p.performanceScore },
    { label: 'Battery', get: (p: Phone) => p.batteryScore },
    { label: 'Display', get: (p: Phone) => p.displayScore },
    { label: 'Value', get: (p: Phone) => p.valueScore },
  ];

  const specRows = [
    { label: 'Display', get: (p: Phone) => p.specs?.display },
    { label: 'Processor', get: (p: Phone) => p.specs?.chipset },
    { label: 'RAM', get: (p: Phone) => p.specs?.ram },
    { label: 'Storage', get: (p: Phone) => p.specs?.storage },
    { label: 'Main Camera', get: (p: Phone) => p.specs?.mainCamera },
    { label: 'Selfie Camera', get: (p: Phone) => p.specs?.selfieCamera },
    { label: 'Battery', get: (p: Phone) => p.specs?.battery },
    { label: 'Charging', get: (p: Phone) => p.specs?.chargingSpeed },
    { label: 'Display Type', get: (p: Phone) => p.specs?.displayType },
    { label: 'Resolution', get: (p: Phone) => p.specs?.resolution },
    { label: 'Refresh Rate', get: (p: Phone) => p.specs?.refreshRate },
    { label: 'Protection', get: (p: Phone) => p.specs?.protection },
    { label: 'OS', get: (p: Phone) => [p.specs?.os, p.specs?.osVersion].filter(Boolean).join(' ') },
    { label: '5G', get: (p: Phone) => p.specs?.fiveG },
    { label: 'WiFi', get: (p: Phone) => p.specs?.wifi },
    { label: 'Bluetooth', get: (p: Phone) => p.specs?.bluetooth },
    { label: 'NFC', get: (p: Phone) => p.specs?.nfc },
    { label: 'USB', get: (p: Phone) => p.specs?.usb },
    { label: 'Fingerprint', get: (p: Phone) => p.specs?.fingerprint },
    { label: 'Weight', get: (p: Phone) => p.specs?.weight },
    { label: 'Dimensions', get: (p: Phone) => p.specs?.dimensions },
    { label: 'Colors', get: (p: Phone) => p.specs?.colors },
    { label: 'IP Rating', get: (p: Phone) => p.specs?.ipRating },
  ];

  const getFilteredSpecRows = (rows: typeof specRows) => {
    if (!onlyDifferences) return rows;
    return rows.filter(row => {
      const values = comparePhones.map(p => row.get(p) || '—');
      return new Set(values).size > 1;
    });
  };

  const getFilteredMetrics = (m: typeof metrics) => {
    if (!onlyDifferences) return m;
    return m.filter(metric => {
      const values = comparePhones.map(p => metric.get(p));
      return new Set(values).size > 1;
    });
  };

  const filteredSpecRows = getFilteredSpecRows(specRows);
  const filteredMetrics = getFilteredMetrics(metrics);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="skeleton-shimmer h-64 rounded-2xl" />
        <div className="skeleton-shimmer h-96 rounded-2xl mt-4" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Compare Phones</h1>
        {compared && (
          <button onClick={() => { setCompared(false); setShowPicker(true); }} className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Change phones
          </button>
        )}
      </div>

      {/* Sticky Phone Header (when comparing) */}
      {compared && (
        <div className="sticky top-16 z-40 py-3 -mx-4 px-4 bg-[#dce4f0]/90 backdrop-blur-xl">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {selected.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 border border-gray-200/60 shrink-0 min-w-0">
                {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={24} height={24} className="w-6 h-6 object-contain rounded" unoptimized /> : <Smartphone className="w-5 h-5 text-gray-400 shrink-0" />}
                <Link href={`/phones/${p.slug}`} className="text-xs font-semibold text-gray-900 hover:text-blue-500 transition-colors truncate max-w-[120px]">{p.modelName}</Link>
                <button onClick={() => removePhone(p.id)} className="shrink-0 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5 text-gray-400" /></button>
              </div>
            ))}
            {selected.length < 4 && (
              <button onClick={() => { setShowPicker(true); setCompared(false); }} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>
        </div>
      )}

      {showPicker && !compared ? (
        <div className="space-y-4">
          {/* Selected phones as proper cards with clear Remove button */}
          {selected.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Selected Phones ({selected.length}/4)</h2>
                {selected.length > 0 && (
                  <button onClick={() => { selected.forEach(p => removePhone(p.id)); }} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">Clear All</button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selected.map(p => (
                  <div key={p.id} className="card-premium p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-1">
                    {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={48} height={48} className="w-12 h-12 object-contain rounded-xl bg-[#F8FAFC] p-1 shrink-0" unoptimized /> : <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><Smartphone className="w-6 h-6 text-gray-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
                      <p className="text-xs text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p>
                    </div>
                    <button onClick={() => removePhone(p.id)} className="shrink-0 w-8 h-8 rounded-lg border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {/* Add phone slot */}
                {selected.length < 4 && (
                  <div className="card-premium p-3 flex items-center justify-center gap-2 border-dashed border-2 border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 cursor-pointer transition-all min-h-[72px] rounded-2xl" onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
                    if (input) input.focus();
                  }}>
                    <Plus className="w-5 h-5" />
                    <span className="text-sm font-medium">{selected.length === 0 ? 'Add phones to compare' : 'Add another phone'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search section */}
          <div className="card-premium p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Search className="w-4 h-4 text-blue-500" /> Search & Add Phones</h3>
              <span className="text-[10px] text-muted-foreground">Select 2-4 phones</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input placeholder="Type phone name to search..." value={search} onChange={e => setSearch(e.target.value)} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
              {search.length >= 2 && autocompleteResults.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">No phones found</div>
              )}
              {search.length < 2 && (
                <div className="text-center py-10 text-sm text-muted-foreground">Type at least 2 characters to search</div>
              )}
              {autocompleteResults.slice(0, 20).map(p => (
                <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                  <input type="checkbox" checked={selected.some(s => s.id === p.id)} onChange={() => togglePhone(p)} disabled={!selected.some(s => s.id === p.id) && selected.length >= 4} className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30" />
                  {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={36} height={36} className="w-9 h-9 object-contain rounded-lg bg-[#F8FAFC] p-0.5" unoptimized /> : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p><p className="text-xs text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p></div>
                  {selected.some(s => s.id === p.id) && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                </label>
              ))}
            </div>
          </div>

          {/* Compare button */}
          {selected.length >= 2 && (
            <button onClick={() => { setCompared(true); setShowPicker(false); updateURL(selected); }} className="w-full bg-blue-500 hover:bg-blue-600 text-white h-12 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25 flex items-center justify-center gap-2">
              <GitCompare className="w-4 h-4" /> Compare {selected.length} Phones
            </button>
          )}
        </div>
      ) : null}

      {/* Compare button — only show when picker is hidden (i.e. >= 2 phones) */}
      {!showPicker && !compared && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Selected:</span>
          {selected.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-full">
              {p.modelName}
              <button onClick={() => removePhone(p.id)} className="hover:bg-blue-600 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
          <button onClick={() => { if (selected.length >= 2) { setCompared(true); setShowPicker(false); updateURL(selected); } }} disabled={selected.length < 2} className="ml-auto bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 h-10 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25 disabled:shadow-none flex items-center gap-2">
            <GitCompare className="w-4 h-4" /> Compare ({selected.length})
          </button>
        </div>
      )}

      {compared && selected.length >= 2 && (
        fetchingDetails ? (
          <div className="card-premium p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading full specifications...</p>
          </div>
        ) : (
        <>
          {/* Category Winners */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-blue-500" /> Category Winners</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {catData.map(cat => {
                const winner = getWinner(cat.key);
                return (
                  <div key={cat.label} className={`bg-gradient-to-br ${cat.gradient} rounded-2xl p-4 text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3"><cat.icon className="w-5 h-5" /><span className="text-sm font-semibold">{cat.label}</span></div>
                      <Link href={`/phones/${winner?.slug}`} className="font-bold text-sm leading-snug hover:underline">{winner?.modelName || 'N/A'}</Link>
                      <p className="text-xs text-white/70 mt-1">{winner?.brand?.name}</p>
                      <p className="text-2xl font-extrabold mt-2">{winner?.[cat.key] || 0}<span className="text-sm font-medium text-white/70">/100</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Score Comparison */}
          <section className="card-premium p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Score Comparison</h2>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={onlyDifferences} onChange={e => setOnlyDifferences(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-500" />
                Only show differences
              </label>
            </div>
            {filteredMetrics.map(metric => {
              const scores = comparePhones.map(p => ({ phone: p, score: metric.get(p) }));
              const maxScore = Math.max(...scores.map(s => s.score));
              const winnerId = scores.find(s => s.score === maxScore)?.phone.id;
              return (
                <div key={metric.label}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
                  <div className="space-y-2">
                    {scores.map(s => (
                      <div key={s.phone.id} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-600 w-28 sm:w-40 truncate shrink-0">{s.phone.modelName}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${s.phone.id === winnerId ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`} style={{ width: `${Math.max(s.score, 2)}%` }} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
                          {s.phone.id === winnerId && <Trophy className="w-3.5 h-3.5 text-blue-500" />}
                          <span className={`text-xs font-bold ${s.phone.id === winnerId ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredMetrics.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All scores are identical</p>}
          </section>

          {/* Specifications Table */}
          <section className="card-premium overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Specifications Comparison</h2>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={onlyDifferences} onChange={e => setOnlyDifferences(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-500" />
                Only differences
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
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
                    const values = comparePhones.map(p => row.get(p) || '—');
                    const allSame = new Set(values).size <= 1;
                    return (
                      <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                        <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-inherit">{row.label}</td>
                        {comparePhones.map(p => {
                          const val = row.get(p) || '—';
                          const isBest = !allSame && val !== '—' && val === values.find(v => v !== '—');
                          return (
                            <td key={p.id} className={`px-4 py-3 text-gray-900 ${isBest ? 'font-semibold bg-sky-50' : ''}`}>
                              {val}
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
                      const minPrice = Math.min(...prices);
                      return comparePhones.map(p => (
                        <td key={p.id} className={`px-4 py-3 font-bold text-blue-600 ${p.pricePKR === minPrice ? 'bg-emerald-50' : ''}`}>
                          {formatPrice(p.pricePKR)}
                          {p.pricePKR === minPrice && comparePhones.length > 1 && <span className="ml-1 text-[10px] font-medium text-emerald-600">Best</span>}
                        </td>
                      ));
                    })()}
                  </tr>
                  <tr className="bg-[#F8FAFC]">
                    <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-[#F8FAFC]">PTA</td>
                    {comparePhones.map(p => (
                      <td key={p.id} className="px-4 py-3">
                        {p.ptaApproved ? <span className="text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Approved</span> : <span className="text-muted-foreground">{p.ptaStatus}</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {filteredSpecRows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">All specifications are identical</p>}
          </section>
        </>
        )
      )}

      {selected.length === 0 && !loading && (
        <div className="text-center py-16">
          <GitCompare className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Select phones to compare</h3>
          <p className="text-sm text-muted-foreground mb-4">Choose 2 to 4 phones by searching above, or use URL params like ?p=iphone-15,samsung-s24</p>
          <div className="flex gap-3 justify-center">
            <Button className="rounded-xl" asChild><Link href="/phones">Browse Phones</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /></div>}>
          <CompareContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}