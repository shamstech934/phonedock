'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Shield, Zap, Layers, Cpu, Battery, ChevronRight, GitCompare, Monitor, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import type { Phone, PhoneSpecs } from '@/components/shared/types';

// ============ SESSION-LEVEL SPEC CACHE ============
const specsCache = new Map<string, { specs: PhoneSpecs; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ SPEC FORMATTING ============

function extractDisplaySize(display?: string): string {
  if (!display) return '';
  const match = display.match(/(\d+\.?\d*)\s*(inch|in|["\u201D])/i);
  return match ? `${match[1]}"` : '';
}

function formatSpecValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.map(formatSpecValue).filter(Boolean).join(', ');
  if (typeof val === 'object') {
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
function normalizeSpecs(rawSpecs: unknown): PhoneSpecs | null {
  if (!rawSpecs || typeof rawSpecs !== 'object' || Array.isArray(rawSpecs)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawSpecs)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
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

// Spec rows for Quick View - in display order
const QV_SPEC_ROWS: { key: string; label: string; altKeys?: string[]; icon?: typeof Cpu }[] = [
  { key: 'display', label: 'Display', icon: Monitor, altKeys: ['displaySize'] },
  { key: 'displayType', label: 'Display Type' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'refreshRate', label: 'Refresh Rate' },
  { key: 'chipset', label: 'Chipset', icon: Cpu },
  { key: 'cpu', label: 'CPU' },
  { key: 'gpu', label: 'GPU' },
  { key: 'ram', label: 'RAM', icon: Zap },
  { key: 'storage', label: 'Storage', icon: Layers },
  { key: 'mainCamera', label: 'Main Camera', altKeys: ['camera', 'cameraMain'] },
  { key: 'selfieCamera', label: 'Selfie Camera' },
  { key: 'battery', label: 'Battery', icon: Battery, altKeys: ['batteryCapacity'] },
  { key: 'chargingSpeed', label: 'Wired Charging', altKeys: ['charging'] },
  { key: 'wirelessCharge', label: 'Wireless Charging' },
  { key: 'os', label: 'OS' },
  { key: 'weight', label: 'Weight' },
  { key: 'releaseDate', label: 'Release Date' },
];

function getSpecValue(specs: Record<string, any>, row: typeof QV_SPEC_ROWS[number]): string {
  if (specs[row.key]) return formatSpecValue(specs[row.key]);
  if (row.altKeys) {
    for (const alt of row.altKeys) {
      if (specs[alt]) return formatSpecValue(specs[alt]);
    }
  }
  return '';
}

function specsHasData(s: unknown): boolean {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  return QV_SPEC_ROWS.some(row => getSpecValue(s as Record<string, any>, row) !== '');
}

type QVState = 'idle' | 'loading' | 'success' | 'partial-data' | 'empty' | 'error' | 'retrying';

// Extract specs from various API response shapes
function extractSpecsFromResponse(data: unknown): { specs: PhoneSpecs | null; hasPartial: boolean } {
  let raw: unknown = null;
  const d = data as Record<string, unknown> | null;
  // Shape 1: { phone: { specs: ... } }
  if (d?.phone && typeof d.phone === 'object') raw = (d.phone as Record<string, unknown>)?.specs;
  // Shape 2: { data: { phone: { specs: ... } } }
  else if (d?.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>;
    if (inner.phone && typeof inner.phone === 'object') raw = (inner.phone as Record<string, unknown>)?.specs;
    // Shape 3: { data: { specs: ... } }
    else raw = inner.specs;
  }
  // Shape 4: { specs: ... }
  else if (d?.specs) raw = d.specs;
  // Shape 5: top-level keys look like specs
  else if (d?.chipset || d?.ram || d?.battery || d?.display) raw = d;

  if (!raw) return { specs: null, hasPartial: false };
  const specs = normalizeSpecs(raw);
  const hasData = specs ? specsHasData(specs) : false;
  // Check for partial data - some fields present but not all
  const fieldCount = specs ? QV_SPEC_ROWS.filter(row => getSpecValue(specs, row)).length : 0;
  return { specs: hasData ? specs : null, hasPartial: fieldCount > 0 && fieldCount < QV_SPEC_ROWS.length * 0.5 };
}

// ============ QUICK VIEW DIALOG COMPONENT ============

interface PhoneQuickViewDialogProps {
  phone: Phone;
  open: boolean;
  onClose: () => void;
}

export function PhoneQuickViewDialog({ phone, open, onClose }: PhoneQuickViewDialogProps) {
  const [state, setState] = useState<QVState>('idle');
  const [specs, setSpecs] = useState<PhoneSpecs | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const fetchSpecs = useCallback((signal: AbortSignal, fetchId: number) => {
    setState(fetchId > 1 ? 'retrying' : 'loading');
    setErrorMsg('');

    const timeout = setTimeout(() => {
      const ac = abortRef.current;
      if (ac) ac.abort();
    }, 10000);

    (async () => {
      try {
        const res = await fetch(`/api/phones/${encodeURIComponent(phone.slug)}`, { signal });

        if (fetchId !== fetchIdRef.current) return;

        if (!res.ok) {
          setState('error');
          setErrorMsg(`Server error (${res.status})`);
          return;
        }

        const ct = res.headers.get('content-type') || '';
        let data: unknown;
        if (ct.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          try { data = JSON.parse(text); } catch {
            setState('error');
            setErrorMsg('Invalid response format');
            return;
          }
        }

        if (fetchId !== fetchIdRef.current) return;

        const { specs: s, hasPartial } = extractSpecsFromResponse(data);
        if (s && specsHasData(s)) {
          // Cache successful result
          specsCache.set(phone.slug, { specs: s, timestamp: Date.now() });
          setSpecs(s);
          setState(hasPartial ? 'partial-data' : 'success');
        } else if (hasPartial) {
          setSpecs(s);
          setState('partial-data');
        } else {
          setState('empty');
        }
      } catch (err: unknown) {
        if (fetchId !== fetchIdRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') {
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
    if (!open) {
      // Reset state when dialog closes
      return;
    }

    // Check session cache first
    const cached = specsCache.get(phone.slug);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setSpecs(cached.specs);
      setState('success');
      return;
    }

    // If pre-attached specs have data, use them directly
    if (specsHasData(phone.specs)) {
      const normalized = normalizeSpecs(phone.specs);
      if (normalized) {
        setSpecs(normalized);
        specsCache.set(phone.slug, { specs: normalized, timestamp: Date.now() });
        setState('success');
        return;
      }
    }

    // Fetch specs from API
    const fetchId = ++fetchIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSpecs(controller.signal, fetchId);

    return () => {
      controller.abort();
    };
  }, [open, phone.slug, phone.specs, fetchSpecs]);

  const handleRetry = useCallback(() => {
    setSpecs(null);
    setErrorMsg('');
    // Clear cache for this slug
    specsCache.delete(phone.slug);
    const fetchId = ++fetchIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSpecs(controller.signal, fetchId);
  }, [phone.slug, fetchSpecs]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
    requestAnimationFrame(() => {
      returnFocusRef.current?.focus();
    });
  }, [onClose]);

  const priceStr = formatPrice(phone.pricePKR);
  const displaySize = extractDisplaySize(specs?.display || phone.specs?.display);

  // Find a release date from phone object
  const releaseDate = phone.releaseDate || '';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0" showCloseButton={true}>
        <DialogHeader className="sr-only">
          <DialogTitle>{phone.modelName} - Quick View</DialogTitle>
          <DialogDescription>Quick specifications for {phone.modelName}</DialogDescription>
        </DialogHeader>
        <div className="p-4 sm:p-5">
          {/* Phone header */}
          <div className="flex items-start gap-3 mb-4">
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
                {phone.upcoming && (
                  <Badge className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200/50 font-medium">
                    <Clock className="w-3 h-3 mr-0.5" /> Upcoming
                  </Badge>
                )}
              </div>
              {releaseDate && (
                <p className="text-[10px] text-muted-foreground mt-1">{releaseDate}</p>
              )}
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
                {displaySize && (
                  <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md">
                    <Monitor className="w-2.5 h-2.5 inline mr-0.5" />{displaySize}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Loading / Retrying state */}
          {(state === 'idle' || state === 'loading' || state === 'retrying') && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400 ml-2">
                {state === 'retrying' ? 'Retrying...' : 'Loading specifications...'}
              </span>
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

          {/* Partial data notice */}
          {state === 'partial-data' && (
            <div className="bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-700">Some specifications may be incomplete.</p>
            </div>
          )}

          {/* Success / Partial-data state - show specs */}
          {(state === 'success' || state === 'partial-data') && specs && (
            <div className="space-y-0">
              {QV_SPEC_ROWS.filter(row => getSpecValue(specs, row)).map(row => {
                const val = getSpecValue(specs, row);
                if (!val || val === 'undefined' || val === 'null' || val === '[object Object]') return null;
                return (
                  <div key={row.label} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-[11px] font-medium text-gray-500 w-28 shrink-0 pt-px">{row.label}</span>
                    <span className="text-[11px] text-gray-900 leading-relaxed">{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 mt-2">
            <Link
              href={`/phones/${phone.slug}`}
              onClick={handleClose}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg h-9 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              View Full Details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/compare?p=${phone.slug}`}
              onClick={handleClose}
              className="shrink-0 w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
              title="Compare"
              aria-label={`Compare ${phone.modelName}`}
            >
              <GitCompare className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}