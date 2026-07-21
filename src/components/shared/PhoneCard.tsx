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
import { formatCardScore } from '@/components/shared/phone-card-utils';

interface PhoneCardProps {
  phone: Phone;
  onSelect?: (_id: string) => void;
  categoryScore?: unknown;
  categoryLabel?: string;
  categoryScoreClassName?: string;
  hideOverallRating?: boolean;
}

// Extract display size from display string
function extractDisplaySize(display?: string): string {
  if (!display) return '';
  const match = display.match(/(\d+\.?\d*)\s*(inch|in|["\u201D])/i);
  return match ? `${match[1]}"` : '';
}

export function PhoneCard({ phone, onSelect, categoryScore, categoryLabel, categoryScoreClassName = 'bg-emerald-600', hideOverallRating = false }: PhoneCardProps) {
  const [qvOpen, setQvOpen] = useState(false);
  const wishlist = useWishlist();
  const wishlisted = wishlist.has(phone.slug);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const displaySize = extractDisplaySize(phone.specs?.display);
  const formattedCategoryScore = formatCardScore(categoryScore);
  const formattedOverallRating = hideOverallRating ? null : formatCardScore(phone.overallRating);

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
      <article data-testid="phone-card" className="phone-card glass-shine group flex h-[440px] min-h-0 overflow-hidden sm:h-[472px]">
        <div className="flex h-full min-w-0 flex-1 flex-col p-3 sm:p-4">
          <Link
            href={`/phones/${phone.slug}`}
            onClick={() => onSelect?.(phone.id)}
            aria-label={`View ${phone.brand?.name ? `${phone.brand.name} ` : ''}${phone.modelName} details`}
            data-testid="phone-card-link"
            className="flex min-h-0 flex-1 cursor-pointer flex-col rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
          <div data-testid="phone-card-image" className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-white to-slate-50 ring-1 ring-slate-200/60">
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
            {formattedCategoryScore && categoryLabel && (
              <Badge data-testid="category-score" className={`absolute right-2 top-2 z-[2] border-0 text-[10px] font-semibold text-white shadow-sm ${categoryScoreClassName}`}>
                {categoryLabel} {formattedCategoryScore}
              </Badge>
            )}
            {formattedOverallRating && (
              <Badge data-testid="overall-rating" className="absolute bottom-2 right-2 z-[2] border border-amber-200 bg-white/95 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-md">
                <Star className="mr-0.5 h-3 w-3 fill-amber-400 text-amber-400" /> {formattedOverallRating}
              </Badge>
            )}
            {phone.upcoming && (
              <Badge className="absolute bottom-2 left-2 bg-violet-600 text-white text-[10px] font-semibold shadow-sm shadow-violet-500/30">
                <Clock className="w-3 h-3 mr-0.5" /> Upcoming
              </Badge>
            )}
            {phone.trending && (
              <Badge className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-red-600 text-[10px] border border-red-100 font-medium">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Hot
              </Badge>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-5 items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">{phone.brand?.name}</p>
            </div>
            <h3 data-testid="phone-card-title" className="line-clamp-2 h-10 min-h-10 text-sm font-extrabold leading-5 text-slate-900">{phone.modelName}</h3>
            <div className="h-10 pt-1">
              <p className="truncate text-sm font-bold text-blue-600">{formatPrice(phone.pricePKR)}</p>
              {phone.originalPricePKR > phone.pricePKR && phone.originalPricePKR > 0 && (
                <p className="truncate text-[10px] font-medium text-emerald-600 line-through">{formatPrice(phone.originalPricePKR)} <span className="font-bold text-emerald-700">-{Math.round(((phone.originalPricePKR - phone.pricePKR) / phone.originalPricePKR) * 100)}%</span></p>
              )}
            </div>
            <div data-testid="phone-card-specs" className="grid h-16 min-h-16 max-h-16 grid-cols-2 grid-rows-3 content-start gap-1.5 overflow-hidden pt-1">
              {phone.specs?.ram && (
                <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Zap className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{phone.specs.ram}</span>
                </span>
              )}
              {phone.specs?.storage && (
                <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Layers className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{phone.specs.storage}</span>
                </span>
              )}
              {displaySize && (
                <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Monitor className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{displaySize}</span>
                </span>
              )}
              {phone.specs?.chipset && (
                <span className="hidden min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
                  <Cpu className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{phone.specs.chipset}</span>
                </span>
              )}
              {phone.specs?.battery && (
                <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Battery className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{phone.specs.battery}</span>
                </span>
              )}
            </div>
          </div>
          </Link>
          {/* Action buttons row */}
          <div data-testid="phone-card-actions" className="mt-auto flex h-11 min-h-11 items-center gap-1.5 pt-0 sm:gap-2">
            <Link
              href={`/phones/${phone.slug}`}
              onClick={() => onSelect?.(phone.id)}
              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 text-xs font-bold text-white shadow-sm shadow-sky-500/20 transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <span className="hidden xl:inline">View Details</span><span className="xl:hidden">View</span> <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); wishlist.toggle(phone); }}
              aria-label={`${wishlisted ? 'Remove' : 'Add'} ${phone.modelName} ${wishlisted ? 'from' : 'to'} wishlist`}
              aria-pressed={wishlisted}
              data-testid="wishlist-action"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition sm:h-11 sm:w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${wishlisted ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white/60 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'}`}
              title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            {/* Compare button */}
            <Link
              href={`/compare?p=${phone.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 sm:h-11 sm:w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              title="Compare"
              aria-label={`Compare ${phone.modelName}`}
              data-testid="compare-action"
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
              data-testid="quick-view-action"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
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

export function PhoneCardSkeleton() {
  return (
    <div className="h-[440px] animate-pulse rounded-2xl border border-slate-200 bg-white p-3 sm:h-[472px] sm:p-4" aria-hidden="true">
      <div className="aspect-square rounded-2xl bg-slate-100" />
      <div className="mt-3 h-3 w-1/3 rounded bg-slate-100" />
      <div className="mt-2 h-10 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-4 h-12 rounded bg-slate-100" />
      <div className="mt-3 h-11 rounded-xl bg-slate-100" />
    </div>
  );
}
