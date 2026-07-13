'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Smartphone, Shield, Star, TrendingUp, Clock, Zap, Layers, Cpu, Battery, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';

interface PhoneCardProps {
  phone: Phone;
  onSelect?: (id: string) => void;
}

export function PhoneCard({ phone, onSelect }: PhoneCardProps) {
  return (
    <Link href={`/phones/${phone.slug}`} className="phone-card glass-shine cursor-pointer group block" onClick={() => onSelect?.(phone.id)}>
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
          <p className="text-xs text-muted-foreground font-medium">{phone.brand?.name}</p>
          <h3 className="font-bold text-sm line-clamp-2 leading-tight text-gray-900">{phone.modelName}</h3>
          <p className="font-bold text-blue-600 text-sm">{formatPrice(phone.pricePKR)}</p>
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
            {phone.specs?.chipset && (
              <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded-md hidden sm:flex items-center gap-0.5">
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
        <Button className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg h-9 text-xs font-semibold transition-colors">
          View Details <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </Link>
  );
}