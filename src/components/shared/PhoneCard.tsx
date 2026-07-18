'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Smartphone, Shield, Star, TrendingUp, Clock, Zap, Layers, Cpu, Battery, ChevronRight, GitCompare, Eye, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';

interface PhoneCardProps {
  phone: Phone;
  onSelect?: (id: string) => void;
}

// Extract display size from display string (e.g. "6.7 inches, AMOLED" → "6.7\"")
function extractDisplaySize(display?: string): string {
  if (!display) return '';
  const match = display.match(/(\d+\.?\d*)\s*(inch|in|["\u201D])/i);
  return match ? `${match[1]}"` : '';
}

export function PhoneCard({ phone, onSelect }: PhoneCardProps) {
  const [showQuickView, setShowQuickView] = useState(false);
  const [qvSpecs, setQvSpecs] = useState<Record<string, string> | null>(null);
  const [qvLoading, setQvLoading] = useState(false);
  const [qvFetched, setQvFetched] = useState(false);
  const displaySize = extractDisplaySize(phone.specs?.display);

  // Check if specs have any useful data
  const hasSpecsData = phone.specs && (
    phone.specs.chipset || phone.specs.ram || phone.specs.storage ||
    phone.specs.display || phone.specs.battery || phone.specs.mainCamera
  );

  // Quick specs for Quick View popover (from already-loaded specs or fetched on demand)
  const quickSpecs = hasSpecsData
    ? [
        phone.specs!.chipset && { label: 'Chipset', value: phone.specs!.chipset },
        phone.specs!.ram && { label: 'RAM', value: phone.specs!.ram },
        phone.specs!.storage && { label: 'Storage', value: phone.specs!.storage },
        phone.specs!.display && { label: 'Display', value: phone.specs!.display },
        phone.specs!.battery && { label: 'Battery', value: phone.specs!.battery },
        phone.specs!.mainCamera && { label: 'Camera', value: phone.specs!.mainCamera },
      ].filter(Boolean) as { label: string; value: string }[]
    : qvSpecs
      ? Object.entries(qvSpecs)
          .filter(([, v]) => v)
          .slice(0, 6)
          .map(([label, value]) => ({ label, value }))
    : [];

  // Fetch specs on demand when quick view is opened
  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showQuickView) { setShowQuickView(false); return; }
    setShowQuickView(true);
    if (!hasSpecsData && !qvSpecs && !qvFetched) {
      setQvLoading(true);
      setQvFetched(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch(`/api/phones/${phone.slug}`, { signal: controller.signal })
        .then(r => r.json())
        .then(d => {
          const s = d?.phone?.specs;
          if (s && (s.chipset || s.ram || s.storage || s.display || s.battery || s.mainCamera)) {
            const mapped: Record<string, string> = {};
            if (s.chipset) mapped.Chipset = s.chipset;
            if (s.ram) mapped.RAM = s.ram;
            if (s.storage) mapped.Storage = s.storage;
            if (s.display) mapped.Display = s.display;
            if (s.battery) mapped.Battery = s.battery;
            if (s.mainCamera) mapped.Camera = s.mainCamera;
            setQvSpecs(mapped);
          }
        })
        .catch((err) => { if (err.name !== 'AbortError') console.error('[QuickView] fetch failed for', phone.slug, err); })
        .finally(() => { clearTimeout(timeout); setQvLoading(false); });
    }
  };

  // Close quick view on outside click (delegated to document)
  useEffect(() => {
    if (!showQuickView) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only close if clicking outside the entire card
      if (!target.closest('.phone-card')) {
        setShowQuickView(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [showQuickView]);

  return (
    <div className="phone-card glass-shine cursor-pointer group block">
      <div className="p-3 sm:p-4">
        <div className="relative aspect-square bg-[#F8FAFC] rounded-xl mb-3 overflow-hidden flex items-center justify-center">
          {phone.thumbnail ? (
            <Image src={phone.thumbnail} alt={phone.modelName} width={200} height={200} className="object-contain p-4 group-hover:scale-[1.03] transition-transform duration-500 ease-out" unoptimized />
          ) : (
            <Smartphone className="w-16 h-16 text-gray-300" />
          )}
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
            className="shrink-0 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
            title="Compare"
          >
            <GitCompare className="w-3.5 h-3.5" />
          </Link>
          {/* Quick View button */}
          <button
            type="button"
            onClick={handleQuickView}
            className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${showQuickView ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'}`}
            title="Quick View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline Quick View Panel — only render when there are specs to show */}
        {showQuickView && !qvLoading && quickSpecs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Specs</p>
            <div className="space-y-1.5">
              {quickSpecs.slice(0, 6).map(spec => (
                <div key={spec.label} className="flex items-start gap-2">
                  <span className="text-[10px] font-medium text-gray-500 w-14 shrink-0">{spec.label}</span>
                  <span className="text-[10px] text-gray-900 leading-tight">{spec.value}</span>
                </div>
              ))}
            </div>
            <Link
              href={`/phones/${phone.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="block text-center text-[10px] font-medium text-blue-500 hover:text-blue-600 mt-2.5 pt-2 border-t border-gray-100"
            >
              View Full Specs →
            </Link>
          </div>
        )}
        {showQuickView && qvLoading && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-gray-400 ml-2">Loading specs...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}