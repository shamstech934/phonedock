'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Shield, Star, TrendingUp, Clock, Zap, Layers, Cpu, Battery, ChevronRight, GitCompare, Eye, Monitor, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
const PhoneQuickViewDialog = dynamic(
  () => import('@/components/shared/PhoneQuickViewDialog').then((mod) => mod.PhoneQuickViewDialog),
  { ssr: false },
);
import type { Phone } from '@/components/shared/types';
import { useWishlist } from '@/lib/personalization/usePersonalization';

interface PhoneCardProps {
  phone: Phone;
  onSelect?: (_id: string) => void;
}

// Extract display size from display string
function extractDisplaySize(display?: string): string {
  if (!display) return '';
  const match = display.match(/(\d+\.?\d*)\s*(inch|in|["\u201D])/i);
  return match ? `${match[1]}"` : '';
}

export function PhoneCard({ phone, onSelect }: PhoneCardProps) {
  const [qvOpen, setQvOpen] = useState(false);
  const wishlist = useWishlist();
  const wishlisted = wishlist.has(phone.slug);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const displaySize = extractDisplaySize(phone.specs?.display);

  const handleQuickView = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setQvOpen(true);
  }, []);

  const handleQVClose = useCallback(() => {
    setQvOpen(false);
    requestAnimationFrame(() => {
      eyeButtonRef.current?.focus();
    });
  }, []);

  const handleQVKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setQvOpen(true);
    }
  }, []);

  return (
    <>
      <article className="phone-card glass-shine group block h-full overflow-hidden">
        <div className="p-3 sm:p-4">
          <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-white to-slate-50 ring-1 ring-slate-200/60">
            <SafePhoneImage
              src={phone.thumbnail}
              alt={phone.modelName}
              width={200}
              height={200}
              className="p-4 transition-transform duration-500 ease-out group-hover:scale-[1.035]"
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
            <h3 className="line-clamp-2 min-h-10 text-sm font-extrabold leading-tight text-slate-900">
              <Link href={`/phones/${phone.slug}`} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{phone.modelName}</Link>
            </h3>
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
              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 text-xs font-bold text-white shadow-sm shadow-sky-500/20 transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              View Details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); wishlist.toggle(phone); }}
              aria-label={`${wishlisted ? 'Remove' : 'Add'} ${phone.modelName} ${wishlisted ? 'from' : 'to'} wishlist`}
              aria-pressed={wishlisted}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${wishlisted ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white/60 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'}`}
              title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            {/* Compare button */}
            <Link
              href={`/compare?p=${phone.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              title="Quick View"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>

      {/* Quick View Dialog - rendered via PhoneQuickViewDialog (Radix Portal to document.body) */}
      {qvOpen && (
        <PhoneQuickViewDialog
          phone={phone}
          open={qvOpen}
          onClose={handleQVClose}
        />
      )}
    </>
  );
}