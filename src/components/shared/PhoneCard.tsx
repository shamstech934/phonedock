'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Shield, Star, TrendingUp, Clock, Zap, Layers, Cpu, Battery, ChevronRight, GitCompare, Eye, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/components/shared/formatPrice';
import { SafePhoneImage } from '@/components/shared/SafePhoneImage';
import { PhoneQuickViewDialog } from '@/components/shared/PhoneQuickViewDialog';
import type { Phone } from '@/components/shared/types';

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
              className="shrink-0 w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              title="Quick View"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick View Dialog - rendered via PhoneQuickViewDialog (Radix Portal to document.body) */}
      <PhoneQuickViewDialog
        phone={phone}
        open={qvOpen}
        onClose={handleQVClose}
      />
    </>
  );
}