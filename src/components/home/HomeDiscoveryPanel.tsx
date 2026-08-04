'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Battery, Camera, ChevronRight, CircleDollarSign, Clock, Database,
  MemoryStick, ShieldCheck,
} from 'lucide-react';
import { PRICE_CATEGORIES } from '@/lib/price-categories';

export type DiscoveryCategory = 'price' | 'ram' | 'storage' | 'camera' | 'battery' | 'pta' | 'year';

interface DiscoveryOption {
  label: string;
  detail?: string;
  href: string;
}

const CATEGORY_META: Record<DiscoveryCategory, { label: string; hint: string; icon: React.ElementType }> = {
  price: { label: 'Price', hint: 'Choose your budget', icon: CircleDollarSign },
  ram: { label: 'RAM', hint: 'Choose memory', icon: MemoryStick },
  storage: { label: 'Storage', hint: 'Choose capacity', icon: Database },
  camera: { label: 'Camera', hint: 'Main camera resolution', icon: Camera },
  battery: { label: 'Battery', hint: 'Battery capacity', icon: Battery },
  pta: { label: 'PTA', hint: 'Approval status', icon: ShieldCheck },
  year: { label: 'Year', hint: 'Release generation', icon: Clock },
};

function optionsFor(category: DiscoveryCategory): DiscoveryOption[] {
  if (category === 'price') {
    return PRICE_CATEGORIES.filter(item => !item.missing).map(item => ({
      label: item.label,
      detail: item.shortLabel,
      href: `/phones?priceCategory=${item.key}`,
    }));
  }
  if (category === 'ram') {
    return [4, 6, 8, 12, 16].map(value => ({ label: `${value}GB+`, detail: 'RAM', href: `/phones?ram=${value}` }));
  }
  if (category === 'storage') {
    return [64, 128, 256, 512, 1024].map(value => ({
      label: value === 1024 ? '1TB+' : `${value}GB+`,
      detail: 'Storage',
      href: `/phones?storage=${value}`,
    }));
  }
  if (category === 'camera') {
    return [12, 48, 50, 108, 200].map(value => ({ label: `${value}MP+`, detail: 'Main camera', href: `/phones?camera=${value}` }));
  }
  if (category === 'battery') {
    return [4000, 4500, 5000, 5500, 6000].map(value => ({ label: `${value}+`, detail: 'mAh', href: `/phones?battery=${value}` }));
  }
  if (category === 'pta') {
    return [
      { label: 'PTA Approved', detail: 'Ready for local SIM', href: '/phones?pta=approved' },
      { label: 'Non-PTA', detail: 'Approval required', href: '/phones?pta=not-approved' },
      { label: 'PTA Unknown', detail: 'Status not confirmed', href: '/phones?pta=unknown' },
    ];
  }
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, index) => currentYear + 1 - index)
    .map(year => ({ label: String(year), detail: 'Released', href: `/phones?year=${year}` }));
}

export function HomeDiscoveryPanel({
  categories,
  title = 'Find Your Phone',
  viewAllText = 'Explore all phones',
  viewAllUrl = '/phones',
}: {
  categories?: DiscoveryCategory[];
  title?: string;
  viewAllText?: string;
  viewAllUrl?: string;
}) {
  const enabled = useMemo(() => {
    const valid = (categories || []).filter((value): value is DiscoveryCategory => value in CATEGORY_META);
    return valid.length ? [...new Set(valid)] : (['price', 'ram', 'storage', 'camera', 'battery', 'pta', 'year'] as DiscoveryCategory[]);
  }, [categories]);
  const [selected, setSelected] = useState<DiscoveryCategory>(enabled[0]);
  const active = enabled.includes(selected) ? selected : enabled[0];
  const meta = CATEGORY_META[active];
  const Icon = meta.icon;
  const options = optionsFor(active);

  return (
    <aside className="card-premium h-fit overflow-hidden p-3.5" aria-labelledby="home-discovery-title">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50">
          <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="home-discovery-title" className="truncate text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="truncate text-[11px] text-muted-foreground">{meta.hint}</p>
        </div>
      </div>

      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 no-scrollbar" role="tablist" aria-label="Browse phone categories">
        {enabled.map(category => {
          const CategoryIcon = CATEGORY_META[category].icon;
          const selectedTab = category === active;
          return (
            <button key={category} type="button" role="tab" aria-selected={selectedTab}
              onClick={() => setSelected(category)}
              className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold transition-colors ${
                selectedTab ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-200/80 bg-white/65 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }`}>
              <CategoryIcon className="h-3.5 w-3.5" />
              {CATEGORY_META[category].label}
            </button>
          );
        })}
      </div>

      <nav className="grid grid-cols-2 gap-2" aria-label={`Browse phones by ${CATEGORY_META[active].label.toLowerCase()}`}>
        {options.map(option => (
          <Link key={`${active}-${option.href}`} href={option.href}
            className="group flex min-h-12 items-center justify-between gap-1.5 rounded-xl border border-gray-200/70 bg-white/55 px-2.5 py-1.5 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-gray-800 group-hover:text-blue-700 dark:text-slate-100">{option.label}</span>
              {option.detail && <span className="block truncate text-[10px] text-muted-foreground">{option.detail}</span>}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <Link href={active === 'price' ? '/price-ranges' : viewAllUrl}
        className="mt-3 flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {active === 'price' ? 'View all price ranges' : viewAllText}
      </Link>
    </aside>
  );
}
