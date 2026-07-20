'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, X, Check, Trophy, Camera, Cpu, Battery, Tag, GitCompare, Shield, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import type { Phone } from '@/components/shared/types';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<Phone[]>([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acError, setAcError] = useState(false);
  const acAbortRef = useRef<AbortController | null>(null);

  // Load pre-selected phones from URL on mount
  useEffect(() => {
    if (!slugsParam) { setLoading(false); return; }
    let cancelled = false;
    const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    fetch(`/api/phones/lookup?slugs=${encodeURIComponent(slugs.join(','))}`)
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
      setSelected(phones);
      if (phones.length >= 2) {
        setCompared(true);
      } else if (phones.length > 0) {
        setPickerOpen(true);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autocomplete search
  useEffect(() => {
    if (acAbortRef.current) acAbortRef.current.abort();
    if (!search || search.length < 2) { setAutocompleteResults([]); setAcError(false); return; }
    setAcLoading(true);
    setAcError(false);
    const timer = setTimeout(() => {
      const controller = new AbortController();
      acAbortRef.current = controller;
      fetch(`/api/phones/autocomplete?q=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => {
          const results: Phone[] = (data.phones || []).filter(
            (p: Phone) => !selected.some(s => s.id === p.id)
          );
          setAutocompleteResults(results);
          setAcLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setAcError(true);
            setAutocompleteResults([]);
            setAcLoading(false);
          }
        });
    }, 300);
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
      setTimeout(() => { setCompared(true); setPickerOpen(false); updateURL(next); }, 100);
    } else {
      updateURL(next);
    }
  };

  const removePhone = (id: string) => {
    const next = selected.filter(p => p.id !== id);
    setSelected(next);
    if (next.length < 2) { setCompared(false); }
    updateURL(next);
  };

  const clearAll = () => {
    setSelected([]);
    setCompared(false);
    updateURL([] as Phone[]);
  };

  const openPicker = () => {
    setSearch('');
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
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
    if (!onlyDifferences) return rows;
    return rows.filter(row => {
      const values = comparePhones.map(p => row.get(p) || '');
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
          <button onClick={openPicker} className="text-sm font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg">
            Change Phones
          </button>
        )}
      </div>

      {/* Prominent Phone Management Bar (always visible when phones selected) */}
      {selected.length > 0 && (
        <div className="card-premium p-3 sm:p-4">
          <div className="flex items-center gap-2 flex-wrap">
            {selected.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200/60 shrink-0 min-w-0">
                <SafePhoneImage src={p.thumbnail} alt={p.modelName} width={24} height={24} className="w-6 h-6 rounded" />
                <Link href={`/phones/${p.slug}`} className="text-xs font-semibold text-gray-900 hover:text-blue-500 transition-colors truncate max-w-[120px]">{p.modelName}</Link>
                <button onClick={() => removePhone(p.id)} className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Remove phone" aria-label={`Remove ${p.modelName}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {selected.length < 4 && (
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

      {/* Phone Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 sm:p-5 pb-0">
            <DialogTitle>Search & Add Phones</DialogTitle>
            <DialogDescription>Select 2 to 4 phones to compare. Type at least 2 characters to search.</DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-5 pt-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                placeholder="Type phone name or brand..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400"
                aria-label="Search phones to compare"
              />
            </div>
          </div>

          {/* Already selected in picker */}
          {selected.length > 0 && (
            <div className="px-4 sm:px-5 pt-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Selected ({selected.length}/4)</p>
              <div className="flex flex-wrap gap-2">
                {selected.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 text-xs font-medium">
                    <SafePhoneImage src={p.thumbnail} alt={p.modelName} width={16} height={16} className="w-4 h-4 rounded" />
                    <span className="max-w-[100px] truncate">{p.modelName}</span>
                    <button onClick={() => removePhone(p.id)} className="ml-0.5 w-11 h-11 rounded-full hover:bg-blue-200 flex items-center justify-center transition-colors" aria-label={`Remove ${p.modelName}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-2 pb-2">
            {selected.length >= 4 && (
              <div className="text-center py-8">
                <p className="text-sm text-amber-600 font-medium">Maximum 4 phones allowed</p>
                <p className="text-xs text-muted-foreground mt-1">Remove a phone to add a different one</p>
              </div>
            )}
            {selected.length < 4 && acLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-400 ml-2">Searching...</span>
              </div>
            )}
            {selected.length < 4 && !acLoading && acError && (
              <div className="text-center py-6">
                <p className="text-sm text-red-500">Search failed. Please try again.</p>
              </div>
            )}
            {selected.length < 4 && !acLoading && search.length >= 2 && autocompleteResults.length === 0 && !acError && (
              <div className="text-center py-8 text-sm text-muted-foreground">No phones found matching &ldquo;{search}&rdquo;</div>
            )}
            {selected.length < 4 && !acLoading && search.length < 2 && (
              <div className="text-center py-8 text-sm text-muted-foreground">Type at least 2 characters to search</div>
            )}
            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              {autocompleteResults.slice(0, 20).map(p => {
                const isSelected = selected.some(s => s.id === p.id);
                const isDisabled = isSelected || selected.length >= 4;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (isDisabled) return;
                      togglePhone(p);
                      if (selected.length + 1 >= 2 && selected.length + 1 <= 4) {
                        // Stay in picker so user can add more
                        setSearch('');
                        setAutocompleteResults([]);
                      }
                    }}
                    disabled={isDisabled}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <SafePhoneImage src={p.thumbnail} alt={p.modelName} width={36} height={36} className="w-9 h-9 rounded-lg bg-[#F8FAFC] p-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
                      <p className="text-xs text-muted-foreground">{p.brand?.name} &middot; {formatPrice(p.pricePKR)}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Picker footer */}
          <div className="border-t border-gray-100 p-4 sm:p-5 flex items-center justify-between gap-3 bg-gray-50/50">
            <span className="text-xs text-muted-foreground">{selected.length}/4 phones selected</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={closePicker}>Cancel</Button>
              {selected.length >= 2 && (
                <Button size="sm" onClick={() => {
                  setCompared(true);
                  closePicker();
                  updateURL(selected);
                }}>
                  <GitCompare className="w-3.5 h-3.5 mr-1" /> Compare {selected.length} Phones
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty state — show inline picker when no phones and no dialog */}
      {selected.length === 0 && !loading && (
        <div className="text-center py-16">
          <GitCompare className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Select phones to compare</h2>
          <p className="text-sm text-muted-foreground mb-6">Choose 2 to 4 phones by searching, or use URL params like ?p=iphone-15,samsung-s24</p>
          <div className="flex gap-3 justify-center">
            <Button className="rounded-xl" onClick={openPicker}>
              <Plus className="w-4 h-4 mr-1" /> Add Phones
            </Button>
            <Button variant="outline" className="rounded-xl" asChild><Link href="/phones">Browse Phones</Link></Button>
          </div>
        </div>
      )}

      {/* Instruction for 1 phone */}
      {selected.length === 1 && !compared && (
        <div className="text-center py-10 card-premium p-6">
          <p className="text-sm text-muted-foreground">Add at least one more phone to compare.</p>
          <Button className="rounded-xl mt-3" onClick={openPicker}>
            <Plus className="w-4 h-4 mr-1" /> Add Another Phone
          </Button>
        </div>
      )}

      {compared && selected.length >= 2 && (
        false ? (
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
                        {winner ? (
                          <>
                            <Link href={`/phones/${winner.slug}`} className="font-bold text-sm leading-snug hover:underline">{winner.modelName}</Link>
                            <p className="text-xs text-white/70 mt-1">{winner.brand?.name}</p>
                            <p className="text-2xl font-extrabold mt-2">{winner[cat.key] || 0}<span className="text-sm font-medium text-white/70">/100</span></p>
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
                const hasNonZero = scores.some(s => s.score > 0);
                const winnerIds = hasNonZero
                  ? scores.filter(s => s.score === maxScore && maxScore > 0).map(s => s.phone.id)
                  : [];
                return (
                  <div key={metric.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
                    <div className="space-y-2">
                      {scores.map(s => (
                        <div key={s.phone.id} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-28 sm:w-40 truncate shrink-0">{s.phone.modelName}</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${winnerIds.includes(s.phone.id) ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`} style={{ width: `${Math.max(hasNonZero ? s.score : 0, 2)}%` }} />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
                            {winnerIds.includes(s.phone.id) && <Trophy className="w-3.5 h-3.5 text-blue-500" />}
                            <span className={`text-xs font-bold ${winnerIds.includes(s.phone.id) ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.score}</span>
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
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Specifications Comparison</h2>
              </div>
              <div className="overflow-x-auto relative after:absolute after:top-0 after:right-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:pointer-events-none">
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
                            const isBest = !allSame && val && val === nonEmptyValues[0];
                            return (
                              <td key={p.id} className={`px-4 py-3 text-gray-900 ${isBest ? 'font-semibold bg-sky-50' : ''}`}>
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
                        const minPrice = Math.min(...prices.filter(p => p > 0));
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
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /></div>}>
          <CompareContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}