'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Shield, Star, TrendingUp, Clock, Zap, Layers, Cpu, Battery, ChevronRight, GitCompare, Eye, Monitor, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import type { Phone, PhoneSpecs } from '@/components/shared/types';

interface PhoneCardProps {
  phone: Phone;
  onSelect?: (_id: string) => void;
}

// Extract display size from display string (e.g. "6.7 inches, AMOLED" → "6.7\"")
function extractDisplaySize(display?: string): string {
  if (!display) return '';
  const match = display.match(/(\d+\.?\d*)\s*(inch|in|["\u201D])/i);
  return match ? `${match[1]}"` : '';
}

// Safely format any spec value into a readable string — never shows [object Object]
function formatSpecValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.map(formatSpecValue).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    // Nested object — try to extract meaningful sub-values
    try {
      const obj = val as Record<string, unknown>;
      const parts: string[] = [];
      for (const v of Object.values(obj)) {
        const s = formatSpecValue(v);
        if (s && s.length < 100) parts.push(s);
      }
      return parts.join(', ') || '';
    } catch {
      return '';
    }
  }
  return String(val);
}

// Normalize various API response shapes to a flat PhoneSpecs object
function normalizeSpecs(rawSpecs: any): PhoneSpecs | null {
  if (!rawSpecs) return null;
  const out: Record<string, string> = {};
  // Known nested spec formats: { display: { size: "6.7" } } → { display: "6.7" }
  for (const [key, value] of Object.entries(rawSpecs)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Try to flatten nested object
      const nested = value as Record<string, unknown>;
      const sub = Object.values(nested).map(formatSpecValue).filter(Boolean).join(', ');
      if (sub) out[key] = sub;
    } else {
      const formatted = formatSpecValue(value);
      if (formatted) out[key] = formatted;
    }
  }
  return out as unknown as PhoneSpecs;
}

// Spec rows for Quick View — in display order
const QV_SPEC_ROWS: { key: string; label: string; altKeys?: string[]; icon?: typeof Cpu }[] = [
  { key: 'display', label: 'Display', icon: Monitor, altKeys: ['displaySize'] },
  { key: 'resolution', label: 'Resolution' },
  { key: 'refreshRate', label: 'Refresh Rate' },
  { key: 'chipset', label: 'Chipset', icon: Cpu },
  { key: 'ram', label: 'RAM', icon: Zap },
  { key: 'storage', label: 'Storage', icon: Layers },
  { key: 'mainCamera', label: 'Main Camera', altKeys: ['camera', 'cameraMain'] },
  { key: 'selfieCamera', label: 'Selfie Camera' },
  { key: 'battery', label: 'Battery', icon: Battery, altKeys: ['batteryCapacity'] },
  { key: 'chargingSpeed', label: 'Charging', altKeys: ['charging'] },
  { key: 'os', label: 'OS' },
];

// Get spec value with fallback to alt keys
function getSpecValue(specs: Record<string, any>, row: typeof QV_SPEC_ROWS[number]): string {
  if (specs[row.key]) return formatSpecValue(specs[row.key]);
  if (row.altKeys) {
    for (const alt of row.altKeys) {
      if (specs[alt]) return formatSpecValue(specs[alt]);
    }
  }
  return '';
}

// Check if a specs object has at least one useful field
function specsHasData(s: any): boolean {
  if (!s || typeof s !== 'object') return false;
  for (const row of QV_SPEC_ROWS) {
    if (getSpecValue(s, row)) return true;
  }
  return false;
}

type QVState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

// Extract specs from various API response shapes
function extractSpecsFromResponse(data: any): PhoneSpecs | null {
  // Shape 1: { phone: { specs: ... } }
  if (data?.phone?.specs) return normalizeSpecs(data.phone.specs);
  // Shape 2: { data: { phone: { specs: ... } } }
  if (data?.data?.phone?.specs) return normalizeSpecs(data.data.phone.specs);
  // Shape 3: { data: { specs: ... } }
  if (data?.data?.specs) return normalizeSpecs(data.data.specs);
  // Shape 4: { specs: ... }
  if (data?.specs) return normalizeSpecs(data.specs);
  // Shape 5: top-level keys look like specs
  if (data?.chipset || data?.ram || data?.battery || data?.display) return normalizeSpecs(data);
  return null;
}

function QuickViewContent({
  phone,
  onClose,
}: {
  phone: Phone;
  onClose: () => void;
}) {
  const [state, setState] = useState<QVState>('idle');
  const [specs, setSpecs] = useState<PhoneSpecs | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fetchIdRef = useRef(0); // prevent stale state updates
  const abortRef = useRef<AbortController | null>(null);

  const fetchSpecs = useCallback((signal: AbortSignal, fetchId: number) => {
    setState('loading');

    const timeout = setTimeout(() => {
      const ac = abortRef.current;
      if (ac) ac.abort();
    }, 8000);

    (async () => {
      try {
        const res = await fetch(`/api/phones/${encodeURIComponent(phone.slug)}`, { signal });

        if (fetchId !== fetchIdRef.current) return; // stale

        if (!res.ok) {
          setState('error');
          setErrorMsg(`Server error (${res.status})`);
          return;
        }

        const ct = res.headers.get('content-type') || '';
        let data: any;
        if (ct.includes('application/json')) {
          data = await res.json();
        } else {
          // Non-JSON response
          const text = await res.text();
          try { data = JSON.parse(text); } catch {
            setState('error');
            setErrorMsg('Invalid response format');
            return;
          }
        }

        if (fetchId !== fetchIdRef.current) return;

        const s = extractSpecsFromResponse(data);
        if (s && specsHasData(s)) {
          setSpecs(s);
          setState('success');
        } else {
          setState('empty');
        }
      } catch (err: any) {
        if (fetchId !== fetchIdRef.current) return;
        if (err.name === 'AbortError') {
          setState('error');
          setErrorMsg('Request timed out');
        } else {
          setState('error');
          setErrorMsg('Network error');
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
  }, [phone.slug]);

  useEffect(() => {
    // If pre-attached specs have data, use them directly
    if (specsHasData(phone.specs)) {
      setSpecs(normalizeSpecs(phone.specs));
      setState('success');
      return;
    }

    // Fetch specs from API
    const fetchId = ++fetchIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    fetchSpecs(controller.signal, fetchId);

    return () => {
      controller.abort();
    };
  }, [phone.slug, phone.specs, fetchSpecs]);

  const handleRetry = useCallback(() => {
    setSpecs(null);
    setErrorMsg('');
    const fetchId = ++fetchIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSpecs(controller.signal, fetchId);
  }, [fetchSpecs]);

  const priceStr = formatPrice(phone.pricePKR);
  const displaySize = extractDisplaySize(specs?.display);

  return (
    <div className="space-y-4">
      {/* Phone header */}
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0 bg-[#F8FAFC] rounded-xl flex items-center justify-center overflow-hidden">
          <SafePhoneImage
            src={phone.thumbnail}
            alt={phone.modelName}
            width={80}
            height={80}
            className="p-1"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground font-medium">{phone.brand?.name}</p>
          <h3 className="font-bold text-sm text-gray-900 leading-tight">{phone.modelName}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-bold text-blue-600 text-sm">{priceStr}</span>
            {phone.ptaApproved && (
              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-medium">
                <Shield className="w-3 h-3 mr-0.5" /> PTA
              </Badge>
            )}
          </div>
          {displaySize && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {specs?.ram && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md">
                  <Zap className="w-2.5 h-2.5 inline mr-0.5" />{formatSpecValue(specs.ram)}
                </span>
              )}
              {specs?.storage && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md">
                  <Layers className="w-2.5 h-2.5 inline mr-0.5" />{formatSpecValue(specs.storage)}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md">
                <Monitor className="w-2.5 h-2.5 inline mr-0.5" />{displaySize}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Idle state — initial (should be brief) */}
      {state === 'idle' && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 ml-2">Loading specifications...</span>
        </div>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 ml-2">Loading specifications...</span>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-1">Unable to load specifications.</p>
          <p className="text-xs text-muted-foreground mb-3">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={handleRetry} className="text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {state === 'empty' && (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Specifications are not available yet.</p>
        </div>
      )}

      {/* Success state — show specs */}
      {state === 'success' && specs && (
        <div className="space-y-0">
          {QV_SPEC_ROWS.filter(row => getSpecValue(specs, row)).map(row => (
            <div key={row.label} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
              <span className="text-[11px] font-medium text-gray-500 w-24 shrink-0 pt-px">{row.label}</span>
              <span className="text-[11px] text-gray-900 leading-relaxed">{getSpecValue(specs, row)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Link
          href={`/phones/${phone.slug}`}
          onClick={onClose}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg h-9 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
        >
          View Full Details <ChevronRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={`/compare?p=${phone.slug}`}
          onClick={onClose}
          className="shrink-0 w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
          title="Compare"
          aria-label={`Compare ${phone.modelName}`}
        >
          <GitCompare className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function PhoneCard({ phone, onSelect }: PhoneCardProps) {
  const [qvOpen, setQvOpen] = useState(false);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const displaySize = extractDisplaySize(phone.specs?.display);

  const handleQuickView = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setQvOpen(true);
  }, []);

  const handleQVClose = useCallback(() => {
    setQvOpen(false);
    // Return focus to the eye button after close
    requestAnimationFrame(() => {
      eyeButtonRef.current?.focus();
    });
  }, []);

  // Keyboard handler for the eye button
  const handleQVKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setQvOpen(true);
    }
  }, []);

  return (
    <>
      <div className="phone-card glass-shine cursor-pointer group block">
        <div className="p-3 sm:p-4">
          <div className="relative aspect-square bg-[#F8FAFC] rounded-xl mb-3 overflow-hidden flex items-center justify-center">
            <SafePhoneImage
              src={phone.thumbnail}
              alt={phone.modelName}
              width={200}
              height={200}
              className="p-4 group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            />
            {phone.ptaApproved && (
              <Badge className="absolute top-2 left-2 text-[10px] bg-white/80 backdrop-blur-md text-emerald-700 border border-emerald-200/50 font-medium shadow-sm">
                <Shield className="w-3 h-3 mr-0.5" /> PTA
              </Badge>
            )}
            {phone.overallRating >= 8 && !phone.upcoming && (
              <Badge className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-semibold shadow-sm shadow-blue-500/30">
                <Star className="w-3 h-3 mr-0.5 fill-current" /> {phone.overallRating}
              </Badge>
            )}
            {phone.upcoming && (
              <Badge className="absolute top-2 right-2 bg-violet-600 text-white text-[10px] font-semibold shadow-sm shadow-violet-500/30">
                <Clock className="w-3 h-3 mr-0.5" /> Upcoming
              </Badge>
            )}
            {phone.trending && (
              <Badge className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-md text-red-600 text-[10px] border border-red-100 font-medium">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Hot
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{phone.brand?.name}</p>
              {phone.overallRating > 0 && !phone.upcoming && phone.overallRating < 8 && (
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-semibold text-gray-700">{phone.overallRating}</span>
                </div>
              )}
            </div>
            <h3 className="font-bold text-sm line-clamp-2 leading-tight text-gray-900">{phone.modelName}</h3>
            <p className="font-bold text-blue-600 text-sm">{formatPrice(phone.pricePKR)}</p>
            {phone.originalPricePKR > phone.pricePKR && phone.originalPricePKR > 0 && (
              <p className="text-[10px] text-emerald-600 font-medium line-through">{formatPrice(phone.originalPricePKR)} <span className="text-emerald-700 font-bold">-{Math.round(((phone.originalPricePKR - phone.pricePKR) / phone.originalPricePKR) * 100)}%</span></p>
            )}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {phone.specs?.ram && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />{phone.specs.ram}
                </span>
              )}
              {phone.specs?.storage && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Layers className="w-2.5 h-2.5" />{phone.specs.storage}
                </span>
              )}
              {displaySize && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Monitor className="w-2.5 h-2.5" />{displaySize}
                </span>
              )}
              {phone.specs?.chipset && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md items-center gap-0.5 hidden sm:flex">
                  <Cpu className="w-2.5 h-2.5" />{phone.specs.chipset.split(' ').slice(0, 2).join(' ')}
                </span>
              )}
              {phone.specs?.battery && (
                <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Battery className="w-2.5 h-2.5" />{phone.specs.battery}
                </span>
              )}
            </div>
          </div>
          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-3">
            <Link
              href={`/phones/${phone.slug}`}
              onClick={() => onSelect?.(phone.id)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg h-9 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              View Details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            {/* Compare button */}
            <Link
              href={`/compare?p=${phone.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
              title="Compare"
              aria-label={`Compare ${phone.modelName}`}
            >
              <GitCompare className="w-3.5 h-3.5" />
            </Link>
            {/* Quick View button */}
            <button
              ref={eyeButtonRef}
              type="button"
              onClick={handleQuickView}
              onKeyDown={handleQVKeyDown}
              aria-label={`Quick view ${phone.modelName}`}
              aria-expanded={qvOpen}
              aria-haspopup="dialog"
              className="shrink-0 w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
              title="Quick View"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick View Dialog — rendered via Radix Portal to document.body, OUTSIDE any card/grid/container */}
      <Dialog open={qvOpen} onOpenChange={(open) => { if (!open) handleQVClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto p-0" showCloseButton={true}>
          <DialogHeader className="sr-only">
            <DialogTitle>{phone.modelName} - Quick View</DialogTitle>
            <DialogDescription>Quick specifications for {phone.modelName}</DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-5">
            <QuickViewContent phone={phone} onClose={handleQVClose} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}