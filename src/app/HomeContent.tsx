import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, Shield, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, Smartphone, Tag, ExternalLink, Layers,
  Check, Newspaper, CircleDollarSign, ChevronRight,
  Search, GitCompareArrows, BadgeDollarSign, ShieldCheck, ArrowRight,
  BellRing, BadgeCheck, Store, SearchCheck, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { PhoneGrid } from '@/components/shared/PhoneGrid';
import { SectionHeader } from '@/components/shared/SectionHeader';
import type { HeroPhone } from '@/components/shared/HeroPhoneShowcase';
import { HeroPhoneShowcase } from '@/components/shared/HeroPhoneShowcase';
import { HomeHeroSearch } from '@/components/home/HomeHeroSearch';
import { HomeNewsletter } from '@/components/home/HomeNewsletter';
import { HomeVideoSection } from '@/components/home/HomeVideoSection';
import { HomeSmartFilterSidebar, type HomepageSmartFilterGroup } from '@/components/home/HomeSmartFilterSidebar';
import { HeroCampaignBackground, type HeroCampaign } from '@/components/home/HeroCampaignBackground';
import { AdSlot } from '@/components/monetization/AdSlot';
import type { Phone, HomeData, Brand } from '@/components/shared/types';
import { normalizeHomepageSectionOrder, type OrderedHomepageSection } from '@/lib/homepage-builder';

// ============ QUICK CATEGORY STRIP ============
const QUICK_CATEGORIES = [
  { emoji: '\u{1F4F1}', label: 'Latest', href: '/phones?collection=latest&sort=newest' },
  { emoji: '\u{1F525}', label: 'Trending', href: '/phones?collection=trending&sort=trending' },
  { emoji: '\u{1F3AE}', label: 'Gaming', href: '/best-gaming-phone' },
  { emoji: '\u{1F4F7}', label: 'Camera', href: '/best-camera-phone' },
  { emoji: '\u{1F50B}', label: 'Battery', href: '/best-battery-phone' },
  { emoji: '\u{1F4B0}', label: 'Budget', href: '/best-budget-phone' },
  { emoji: '\u{1F451}', label: 'Flagship', href: '/phones?price=above100k&sort=rating' },
  { emoji: '\u{1F1F5}\u{1F1F0}', label: 'PTA', href: '/phones?pta=approved' },
  { emoji: '\u{1F4C8}', label: 'Price Drops', href: '/phones?priceDrop=true' },
  { emoji: '\u{1F4FA}', label: 'Reviews', href: '/reviews' },
  { emoji: '\u25B6', label: 'Videos', href: '/videos' },
];

function QuickCategoryStrip() {
  return (
    <nav aria-label="Popular phone categories" className="mx-auto w-fit max-w-full rounded-2xl border border-white/70 bg-white/35 p-1.5 shadow-[0_12px_36px_rgba(15,23,42,.06)] backdrop-blur-xl">
      <div className="flex snap-x snap-mandatory justify-start gap-1.5 overflow-x-auto no-scrollbar lg:justify-center">
        {QUICK_CATEGORIES.map(cat => (
          <Link
            key={cat.label}
            href={cat.href}
            className="group flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-xl border border-transparent px-3.5 py-2 text-xs font-semibold text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white/80 hover:text-blue-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="transition-transform group-hover:scale-110" aria-hidden="true">{cat.emoji}</span>
            {cat.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

// ============ PAKISTAN TRUST BAR ============
const PK_TRUST_SIGNALS = [
  { icon: Shield, text: 'PTA Approved Phones' },
  { icon: Tag, text: 'PKR Prices Updated Daily' },
  { icon: Star, text: 'Pakistani Expert Reviews' },
  { icon: Shield, text: 'Official PTA Information' },
  { icon: Clock, text: 'Latest Pakistan Launches' },
];

function PakistanTrustBar() {
  return (
    <div className="card-premium px-4 sm:px-6 py-3">
      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
        {PK_TRUST_SIGNALS.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-medium">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ COLORED CATEGORY SYSTEM ============
type CategoryTone = 'sky' | 'rose' | 'violet' | 'indigo' | 'emerald' | 'amber' | 'orange' | 'fuchsia' | 'cyan';
const CATEGORY_TONES: Record<CategoryTone, string> = {
  sky: 'border-sky-200/80 bg-gradient-to-br from-white/95 via-sky-50/75 to-cyan-50/65 shadow-sky-200/25',
  rose: 'border-rose-200/80 bg-gradient-to-br from-white/95 via-rose-50/70 to-orange-50/55 shadow-rose-200/25',
  violet: 'border-violet-200/80 bg-gradient-to-br from-white/95 via-violet-50/70 to-fuchsia-50/55 shadow-violet-200/25',
  indigo: 'border-indigo-200/80 bg-gradient-to-br from-white/95 via-indigo-50/70 to-blue-50/55 shadow-indigo-200/25',
  emerald: 'border-emerald-200/80 bg-gradient-to-br from-white/95 via-emerald-50/70 to-teal-50/55 shadow-emerald-200/25',
  amber: 'border-amber-200/80 bg-gradient-to-br from-white/95 via-amber-50/75 to-yellow-50/60 shadow-amber-200/25',
  orange: 'border-orange-200/80 bg-gradient-to-br from-white/95 via-orange-50/70 to-amber-50/55 shadow-orange-200/25',
  fuchsia: 'border-fuchsia-200/80 bg-gradient-to-br from-white/95 via-fuchsia-50/70 to-pink-50/55 shadow-fuchsia-200/25',
  cyan: 'border-cyan-200/80 bg-gradient-to-br from-white/95 via-cyan-50/70 to-sky-50/55 shadow-cyan-200/25',
};

// ============ PHONE SECTION (full card grid) ============
function PhoneSection({ phones, title, icon: Icon, link, linkText, showEmpty, tone = 'sky', cardCount = 6 }: { phones: Phone[]; title: string; icon: React.ElementType; link?: string; linkText?: string; showEmpty?: boolean; tone?: CategoryTone; cardCount?: number }) {
  if (!phones.length) {
    if (!showEmpty) return null;
    return (
      <section className={`rounded-3xl border p-3.5 shadow-sm sm:p-4 ${CATEGORY_TONES[tone]}`}>
        <SectionHeader title={title} icon={Icon} link={link} linkText={linkText} />
        <div className="text-center py-12 card-premium">
          <Smartphone className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-muted-foreground">No phones in this section yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Check back later for updates</p>
        </div>
      </section>
    );
  }
  return (
    <section className={`rounded-3xl border p-3.5 shadow-sm sm:p-4 ${CATEGORY_TONES[tone]}`}>
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText} />
      <PhoneGrid page="home">
        {phones.slice(0, cardCount).map(p => (
          <div key={p.id} className="min-w-0">
            <PhoneCard phone={p} />
          </div>
        ))}
      </PhoneGrid>
    </section>
  );
}

// ============ COMPACT TOP PHONES (for Budget, Flagship, Upcoming) ============
function CompactTopPhones({ phones, title, icon: Icon, link, linkText, tone = 'sky', cardCount = 6 }: { phones: Phone[]; title: string; icon: React.ElementType; link: string; linkText?: string; tone?: CategoryTone; cardCount?: number }) {
  if (!phones.length) return null;
  return (
    <section className={`rounded-3xl border p-3.5 shadow-sm sm:p-4 ${CATEGORY_TONES[tone]}`}>
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText || 'View All'} />
      <PhoneGrid page="home">
        {phones.slice(0, cardCount).map(p => <PhoneCard key={p.id} phone={p} />)}
      </PhoneGrid>
    </section>
  );
}

import { BrandLogo } from '@/components/shared/BrandLogo';

// ============ BRANDS GRID ============

const PRIORITY_ORDER = ['samsung', 'apple', 'google', 'xiaomi', 'oneplus', 'vivo', 'oppo', 'realme', 'motorola', 'nothing', 'honor', 'tecno', 'infinix'];
function BrandsGrid({ brands, title = 'Popular Brands', logoSize = 56, onlyWithPhones = true, limit = 11 }: { brands: Brand[]; title?: string; logoSize?: number; onlyWithPhones?: boolean; limit?: number; columns?: number }) {
  // Keep brands with published phones first, then supplement the grid with
  // active imported brands. This fills the second row without pretending that
  // an empty brand has phones.
  const brandBySlug = new Map<string, Brand>();
  brands.forEach(brand => brandBySlug.set(brand.slug.toLowerCase(), brand));

  const sorted = [...brandBySlug.values()].sort((a, b) => {
    const aCount = a._count?.phones || 0;
    const bCount = b._count?.phones || 0;
    if (onlyWithPhones && Boolean(aCount) !== Boolean(bCount)) return bCount ? 1 : -1;
    const aIdx = PRIORITY_ORDER.indexOf(a.slug.toLowerCase());
    const bIdx = PRIORITY_ORDER.indexOf(b.slug.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    if (bCount !== aCount) return bCount - aCount;
    return a.name.localeCompare(b.name);
  });

  const requestedBrandCount = Math.max(1, Number(limit || 11));
  // Six desktop columns: 5/11/17 brands plus the final All Brands CTA fill
  // complete rows and avoid the awkward half-empty second row.
  const desiredBrandCount = requestedBrandCount >= 17 ? 17 : requestedBrandCount <= 5 ? 5 : 11;
  const displayBrands = sorted.slice(0, desiredBrandCount);
  if (!displayBrands.length) return null;

  return (
    <section className="min-w-0">
      <SectionHeader title={title} icon={Layers} link="/brands" linkText="All Brands" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {displayBrands.map(brand => {
          const phoneCount = brand._count?.phones || 0;
          return (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/70 p-3 text-center shadow-[0_12px_34px_rgba(15,23,42,.07)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-[0_18px_45px_rgba(37,99,235,.13)] dark:border-slate-700 dark:bg-slate-900/75 dark:hover:border-sky-500/40"
            >
              <BrandLogo name={brand.name} slug={brand.slug} logo={brand.logo} size={Math.max(52, logoSize)} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="line-clamp-1 text-xs font-bold text-slate-800 transition-colors group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-sky-300">{brand.name}</span>
              <span className={`text-[10px] ${phoneCount ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {phoneCount ? `${phoneCount} phones` : 'Browse brand'}
              </span>
            </Link>
          );
        })}
        <Link
          href="/brands"
          className="group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/95 to-cyan-50/90 p-3 text-center shadow-[0_12px_34px_rgba(37,99,235,.09)] transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_18px_45px_rgba(37,99,235,.15)] dark:border-sky-500/25 dark:from-sky-950/50 dark:to-cyan-950/30"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-white text-blue-600 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300">
            <Layers className="h-6 w-6" />
          </div>
          <span className="text-xs font-bold text-blue-700 dark:text-sky-300">All Brands</span>
          <span className="text-[10px] text-blue-500/80 dark:text-sky-400/70">View full directory</span>
        </Link>
      </div>
    </section>
  );
}

// ============ SHOP BY PRICE SIDEBAR ============
interface HomepagePriceRange { id: string; label: string; min: number; max: number | null; enabled: boolean; }

const DEFAULT_HOME_PRICE_RANGES: HomepagePriceRange[] = [
  { id: '5k-20k', label: 'Rs. 5,000 – 20,000', min: 5000, max: 20000, enabled: true },
  { id: '20k-40k', label: 'Rs. 20,001 – 40,000', min: 20001, max: 40000, enabled: true },
  { id: '40k-60k', label: 'Rs. 40,001 – 60,000', min: 40001, max: 60000, enabled: true },
  { id: '60k-100k', label: 'Rs. 60,001 – 100,000', min: 60001, max: 100000, enabled: true },
  { id: '100k-200k', label: 'Rs. 100,001 – 200,000', min: 100001, max: 200000, enabled: true },
  { id: '200k-plus', label: 'Above Rs. 200,000', min: 200001, max: null, enabled: true },
];

const DEFAULT_SMART_FILTER_GROUPS: HomepageSmartFilterGroup[] = [
  { id: 'ram', title: 'Search by RAM', subtitle: 'Choose memory size', enabled: true, items: [
    { id: 'ram-4', label: '4GB RAM', param: 'ram', value: '4', enabled: true }, { id: 'ram-6', label: '6GB RAM', param: 'ram', value: '6', enabled: true }, { id: 'ram-8', label: '8GB RAM', param: 'ram', value: '8', enabled: true }, { id: 'ram-12', label: '12GB RAM', param: 'ram', value: '12', enabled: true }, { id: 'ram-16', label: '16GB & above', param: 'ram', value: '16', enabled: true },
  ]},
  { id: 'storage', title: 'Search by Storage', subtitle: 'Choose internal storage', enabled: true, items: [
    { id: 'storage-64', label: '64GB', param: 'storage', value: '64', enabled: true }, { id: 'storage-128', label: '128GB', param: 'storage', value: '128', enabled: true }, { id: 'storage-256', label: '256GB', param: 'storage', value: '256', enabled: true }, { id: 'storage-512', label: '512GB', param: 'storage', value: '512', enabled: true }, { id: 'storage-1tb', label: '1TB', param: 'storage', value: '1024', enabled: true },
  ]},
  { id: 'camera', title: 'Search by Camera', subtitle: 'Main camera resolution', enabled: true, items: [
    { id: 'camera-13', label: '13MP+', param: 'camera', value: '13', enabled: true }, { id: 'camera-32', label: '32MP+', param: 'camera', value: '32', enabled: true }, { id: 'camera-50', label: '50MP+', param: 'camera', value: '50', enabled: true }, { id: 'camera-108', label: '108MP+', param: 'camera', value: '108', enabled: true }, { id: 'camera-200', label: '200MP+', param: 'camera', value: '200', enabled: true },
  ]},
  { id: 'screen', title: 'Search by Screen', subtitle: 'Display size', enabled: true, items: [
    { id: 'screen-under6', label: 'Under 6.0 inch', param: 'screenMax', value: '5.99', enabled: true }, { id: 'screen-6-64', label: '6.0 – 6.4 inch', param: 'screenRange', value: '6|6.4', enabled: true }, { id: 'screen-65-67', label: '6.5 – 6.7 inch', param: 'screenRange', value: '6.5|6.7', enabled: true }, { id: 'screen-68', label: '6.8 inch+', param: 'screenMin', value: '6.8', enabled: true },
  ]},
  { id: 'features', title: 'More Phone Filters', subtitle: 'Popular capabilities', enabled: true, items: [
    { id: 'feature-5g', label: '5G Phones', param: '5g', value: 'yes', enabled: true }, { id: 'feature-battery', label: '5000mAh+', param: 'battery', value: '5000', enabled: true }, { id: 'feature-refresh', label: '120Hz+', param: 'refresh', value: '120', enabled: true }, { id: 'feature-nfc', label: 'NFC', param: 'nfc', value: 'yes', enabled: true }, { id: 'feature-pta', label: 'PTA Approved', param: 'pta', value: 'approved', enabled: true },
  ]},
];

function PriceCategorySidebar({ ranges = DEFAULT_HOME_PRICE_RANGES, limit = 6 }: { ranges?: HomepagePriceRange[]; limit?: number }) {
  const categories = ranges.filter(category => category.enabled && category.label.trim()).slice(0, Math.max(3, Math.min(8, limit)));
  return (
    <aside className="card-premium h-fit p-3.5" aria-labelledby="home-price-categories-title">
      <div className="mb-2.5 flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50"><CircleDollarSign className="h-5 w-5 text-blue-500" /></div><div><h2 id="home-price-categories-title" className="text-sm font-bold text-gray-900 dark:text-white">Phones by Price</h2><p className="text-[11px] text-muted-foreground">Choose your exact budget</p></div></div>
      <nav className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1" aria-label="Browse phones by price category">
        {categories.map(category => {
          const query = new URLSearchParams({ priceMin: String(category.min) });
          if (category.max !== null) query.set('priceMax', String(category.max));
          return <Link key={category.id} href={`/phones?${query.toString()}`} className="group flex min-h-11 items-center justify-between rounded-xl border border-gray-200/70 bg-white/55 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50"><span className="text-xs font-semibold text-gray-800 group-hover:text-blue-700">{category.label}</span><ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500" /></Link>;
        })}
      </nav>
      <Link href="/price-ranges" className="mt-2.5 flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">View all price ranges</Link>
    </aside>
  );
}

function ReleaseYearCategories({ years }: { years: number[] }) {
  if (!years.length) return null;
  return <aside className="card-premium h-fit p-3.5" aria-labelledby="home-year-categories-title"><div className="mb-2.5 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50"><Clock className="h-5 w-5 text-violet-600" /></div><div><h2 id="home-year-categories-title" className="text-sm font-bold">Phones by Year</h2><p className="text-[11px] text-muted-foreground">Years available in your imported data</p></div></div><nav className="grid max-h-[330px] grid-cols-2 gap-2 overflow-y-auto pr-1" aria-label="Browse phones by release year">{years.map(year => <Link key={year} href={`/phones?year=${year}`} className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 text-center text-xs font-bold text-gray-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700">{year}</Link>)}</nav></aside>;
}

// ============ TRUST / WHY PHONEDOCK ============
function TrustSection({ totalPhones, totalBrands }: { totalPhones?: number; totalBrands?: number }) {
  const tp = totalPhones || 0;
  const tb = totalBrands || 0;
  const trustSignals = [
    {
      icon: BadgeCheck,
      title: 'Verified Pakistan Prices',
      description: 'Market prices checked against trusted Pakistani retailers.',
      tone: 'from-blue-500/20 to-cyan-400/10 text-cyan-200 border-cyan-300/15',
    },
    {
      icon: FlaskConical,
      title: 'Real Performance Data',
      description: 'Benchmarks and gaming results presented with clear context.',
      tone: 'from-violet-500/20 to-fuchsia-400/10 text-violet-200 border-violet-300/15',
    },
    {
      icon: SearchCheck,
      title: 'PTA Status Guidance',
      description: 'Practical approval and availability information for Pakistan.',
      tone: 'from-emerald-500/20 to-teal-400/10 text-emerald-200 border-emerald-300/15',
    },
    {
      icon: Star,
      title: 'Useful Buying Advice',
      description: 'Specs translated into simple pros, cons and recommendations.',
      tone: 'from-amber-500/20 to-orange-400/10 text-amber-100 border-amber-300/15',
    },
  ];

  const methodology = [
    {
      number: '01',
      icon: Store,
      title: 'Collect',
      description: 'We gather launch, price and availability data from reliable sources.',
    },
    {
      number: '02',
      icon: SearchCheck,
      title: 'Verify',
      description: 'Core specifications, pricing and PTA information are cross-checked.',
    },
    {
      number: '03',
      icon: Shield,
      title: 'Review',
      description: 'Editorial checks remove duplicates, unclear claims and bad records.',
    },
    {
      number: '04',
      icon: BellRing,
      title: 'Update',
      description: 'Important price and availability changes are refreshed over time.',
    },
  ];

  return (
    <section className="scroll-mt-28 space-y-5" aria-labelledby="why-phonedock-title">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-700/70 bg-slate-950 px-4 py-5 shadow-2xl shadow-blue-950/20 sm:px-6 sm:py-7 lg:px-8">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Built for Pakistani buyers
              </div>
              <h2 id="why-phonedock-title" className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Why people use SpecsDekh
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Clear phone data, useful buying tools and Pakistan-focused guidance in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{tp > 0 ? `${tp.toLocaleString()}+ phones` : 'Growing phone database'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{tb > 0 ? `${tb}+ brands` : 'Popular brands covered'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trustSignals.map(signal => (
              <article key={signal.title} className={`group rounded-2xl border bg-gradient-to-br p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] ${signal.tone}`}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 shadow-inner shadow-white/5">
                  <signal.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-white">{signal.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-300">{signal.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.045] p-4 sm:p-5 lg:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Our data methodology</p>
                <h3 className="mt-1 text-xl font-bold text-white">From source to useful phone listing</h3>
              </div>
              <Link href="/about" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60">
                Learn more <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {methodology.map((step, index) => (
                <div key={step.title} className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="font-display text-xl font-black text-white/15">{step.number}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{step.title}</h4>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">{step.description}</p>
                  {index < methodology.length - 1 && (
                    <ChevronRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-blue-300/50 lg:block" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ LATEST REVIEWS SECTION ============
function HomeReviewsSection({ phones }: { phones: Phone[] }) {
  const reviewedPhones = phones.filter(p => p.reviewSummary && p.overallRating > 0).slice(0, 4);
  if (!reviewedPhones.length) return null;

  return (
    <section className={`rounded-3xl border p-3.5 shadow-sm sm:p-4 ${CATEGORY_TONES.fuchsia}`}>
      <SectionHeader title="Latest Reviews" icon={Star} link="/reviews" linkText="All Reviews" />
      <PhoneGrid page="home">
        {reviewedPhones.map(p => <PhoneCard key={p.id} phone={p} />)}
      </PhoneGrid>
    </section>
  );
}

// ============ EXPLORE PHONEDOCK TOOLS ============
const PHONEDOCK_TOOLS = [
  {
    title: 'Phone Finder',
    description: 'Answer a few simple questions and discover phones that match your budget and priorities.',
    icon: Search,
    href: '/phone-finder',
    accent: 'from-blue-600 via-blue-700 to-slate-900',
    glow: 'bg-cyan-400/25',
  },
  {
    title: 'Compare Phones',
    description: 'Compare specifications, ratings and Pakistan prices side by side before you buy.',
    icon: GitCompareArrows,
    href: '/compare',
    accent: 'from-violet-600 via-indigo-700 to-slate-900',
    glow: 'bg-fuchsia-400/20',
  },
  {
    title: 'Price Ranges',
    description: 'Browse the strongest phone options in Pakistan across every practical budget range.',
    icon: BadgeDollarSign,
    href: '/price-ranges',
    accent: 'from-emerald-600 via-teal-700 to-slate-900',
    glow: 'bg-lime-300/20',
  },
  {
    title: 'PTA Approved Phones',
    description: 'Quickly find PTA-approved devices and avoid uncertainty before purchasing a phone.',
    icon: ShieldCheck,
    href: '/phones?pta=approved',
    accent: 'from-amber-500 via-orange-600 to-slate-900',
    glow: 'bg-yellow-200/25',
  },
];

function ExploreSpecsDekhTools() {
  return (
    <section id="phonedock-tools" className="scroll-mt-28 space-y-5" aria-labelledby="phonedock-tools-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600">Useful shortcuts</p>
          <h2 id="phonedock-tools-title" className="font-display text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Explore SpecsDekh Tools</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">Working tools designed to make smartphone research faster and easier.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PHONEDOCK_TOOLS.map(tool => (
          <Link
            key={tool.title}
            href={tool.href}
            aria-label={`Explore ${tool.title}`}
            className={`group relative min-h-[210px] overflow-hidden rounded-3xl bg-gradient-to-br ${tool.accent} p-4 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-[230px] sm:p-5`}
          >
            <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full ${tool.glow} blur-2xl transition-transform duration-500 group-hover:scale-125`} />
            <div className="relative flex h-full flex-col">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/12 shadow-lg backdrop-blur-md sm:h-14 sm:w-14">
                <tool.icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              </div>
              <div className="mt-auto">
                <h3 className="text-sm font-extrabold leading-tight sm:text-lg">{tool.title}</h3>
                <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/72 sm:text-xs">{tool.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-white sm:text-xs">
                  Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============ MAIN HOMEPAGE CONTENT ============
interface HomepageSectionRule { mode?: 'automatic'|'manual'; brand?: string; year?: string; lifecycle?: string; priceMin?: string; priceMax?: string; cardCount?: number; manualPhoneSlugs?: string[]; showViewAll?: boolean; viewAllText?: string; viewAllUrl?: string; }
type CmsSettings = { homepage?: { heroEnabled?: boolean; heroBadge?: string; heroTitle?: string; heroHighlight?: string; heroSubtitle?: string; searchPlaceholder?: string; cta1Text?: string; cta1Url?: string; cta2Text?: string; cta2Url?: string; heroAnimationEnabled?: boolean; heroAnimationSpeed?: number; heroShowPhoneInfo?: boolean; heroBackground?: string; heroBackgroundImage?: string; heroCampaigns?: HeroCampaign[]; heroCampaignSpeed?: number; heroImageFit?: 'contain'|'cover'; heroDesktopX?: number; heroDesktopY?: number; heroDesktopScale?: number; heroDesktopRotate?: number; heroMobileX?: number; heroMobileY?: number; heroMobileScale?: number; heroMobileRotate?: number; pageBackground?: string; contentWidth?: 'standard'|'wide'|'full'; sectionGap?: number; brandLogoSize?: number; brandColumns?: number; brandLimit?: number; showOnlyBrandsWithPhones?: boolean; showPriceCategories?: boolean; showYearCategories?: boolean; pricePanelSide?: 'left'|'right'; hideEmptySections?: boolean; trendingMonths?: number; trendingMinRating?: number; trendingBalancePriceTiers?: boolean; yearMode?: 'data'|'manual'; yearStart?: number; yearEnd?: number; yearLimit?: number; priceRanges?: HomepagePriceRange[]; homepagePriceLimit?: number; smartFiltersEnabled?: boolean; smartFilterGroups?: HomepageSmartFilterGroup[]; sections?: Record<string, boolean>; titles?: Record<string, string>; sectionOrder?: OrderedHomepageSection[]; sectionRules?: Partial<Record<OrderedHomepageSection, HomepageSectionRule>> }; announcement?: { enabled?: boolean; text?: string; buttonText?: string; buttonUrl?: string; background?: string } };

export default function HomeContent({ homeData, heroPhones, siteSettings }: { homeData: HomeData; heroPhones: HeroPhone[]; siteSettings?: CmsSettings }) {
  const data = homeData;
  const cms = siteSettings?.homepage || {};
  const catalog = data.catalog?.length ? data.catalog : [...data.latest, ...data.featured, ...data.trending];
  const sections = cms.sections || {};
  const titles = cms.titles || {};
  const rules = cms.sectionRules || {};
  const visible = (key: string) => sections[key] !== false;
  const sectionOrder = normalizeHomepageSectionOrder(cms.sectionOrder);
  const contentWidthClass = cms.contentWidth === 'full' ? 'max-w-[1680px]' : cms.contentWidth === 'wide' ? 'max-w-[1520px]' : 'max-w-[1440px]';
  const releaseYear = (phone: Phone) => Number(String(phone.releaseDate || '').slice(0, 4)) || 0;
  const sectionRule = (key: OrderedHomepageSection) => rules[key] || {};
  const filterByRule = (key: OrderedHomepageSection, source: Phone[]) => {
    const rule = sectionRule(key);
    let phones = [...source];
    if (rule.mode === 'manual' && rule.manualPhoneSlugs?.length) {
      const order = new Map(rule.manualPhoneSlugs.map((slug, index) => [slug, index]));
      return catalog.filter(phone => order.has(phone.slug)).sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));
    }
    if (rule.brand) phones = phones.filter(phone => phone.brand?.slug === rule.brand || phone.brand?.name?.toLowerCase() === rule.brand?.toLowerCase());
    if (rule.year) phones = phones.filter(phone => releaseYear(phone) === Number(rule.year));
    if (rule.priceMin) phones = phones.filter(phone => phone.pricePKR >= Number(rule.priceMin));
    if (rule.priceMax) phones = phones.filter(phone => phone.pricePKR <= Number(rule.priceMax));
    if (rule.lifecycle === 'upcoming') phones = phones.filter(phone => phone.upcoming || ['rumored','announced','coming_soon'].includes(phone.availabilityStatus || ''));
    if (rule.lifecycle === 'available') phones = phones.filter(phone => !phone.upcoming && (phone.availabilityStatus || 'available') === 'available');
    if (rule.lifecycle === 'discontinued') phones = phones.filter(phone => phone.availabilityStatus === 'discontinued');
    return phones;
  };
  const uniquePhones = (phones: Phone[]) => [...new Map(phones.map(phone => [phone.id, phone])).values()];
  const latestPhones = filterByRule('latest', catalog).sort((a,b) => (b.releaseDate || b.createdAt || '').localeCompare(a.releaseDate || a.createdAt || ''));
  const trendingCutoff = new Date(); trendingCutoff.setMonth(trendingCutoff.getMonth() - (cms.trendingMonths || 12));
  const trendingCandidates = filterByRule('trending', catalog).filter(phone => {
    const date = phone.releaseDate ? new Date(phone.releaseDate) : null;
    const recent = Boolean(date && !Number.isNaN(date.getTime()) && date >= trendingCutoff);
    return recent && (phone.trending || phone.overallRating >= (cms.trendingMinRating ?? 7.5) || (phone.views || 0) >= 100);
  }).sort((a,b) => Number(b.trending)-Number(a.trending) || b.overallRating-a.overallRating || (b.views||0)-(a.views||0));
  const trendingFallback = catalog.filter(phone => {
    const date = phone.releaseDate ? new Date(phone.releaseDate) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= trendingCutoff);
  }).sort((a,b) => Number(b.trending)-Number(a.trending) || (b.views||0)-(a.views||0) || b.overallRating-a.overallRating);
  const balancedTrending = cms.trendingBalancePriceTiers === false ? uniquePhones([...trendingCandidates, ...trendingFallback]) : uniquePhones([
    ...trendingCandidates.filter(phone => phone.pricePKR > 0 && phone.pricePKR <= 40000).slice(0,3),
    ...trendingCandidates.filter(phone => phone.pricePKR > 40000 && phone.pricePKR <= 100000).slice(0,3),
    ...trendingCandidates.filter(phone => phone.pricePKR > 100000).slice(0,3),
    ...trendingCandidates,
    ...trendingFallback,
  ]);
  const cameraPhones = filterByRule('camera', catalog.filter(phone => phone.cameraScore > 0)).sort((a,b) => b.cameraScore-a.cameraScore || b.overallRating-a.overallRating);
  const gamingPhones = filterByRule('gaming', catalog.filter(phone => phone.performanceScore > 0)).sort((a,b) => b.performanceScore-a.performanceScore || b.overallRating-a.overallRating);
  const batteryPhones = filterByRule('battery', catalog.filter(phone => phone.batteryScore > 0)).sort((a,b) => b.batteryScore-a.batteryScore || b.overallRating-a.overallRating);
  const budgetPhones = filterByRule('budget', catalog.filter(phone => phone.pricePKR >= 5000 && phone.pricePKR <= 40000)).sort((a,b) => b.valueScore-a.valueScore || b.overallRating-a.overallRating);
  const flagshipPhones = filterByRule('flagship', catalog.filter(phone => phone.pricePKR > 150000)).sort((a,b) => b.overallRating-a.overallRating || b.performanceScore-a.performanceScore);
  const upcomingPhones = filterByRule('upcoming', catalog.filter(phone => phone.upcoming || ['rumored','announced','coming_soon'].includes(phone.availabilityStatus || ''))).sort((a,b) => (a.expectedLaunchAt || a.releaseDate || '').localeCompare(b.expectedLaunchAt || b.releaseDate || ''));
  const configuredYears = cms.yearMode === 'manual' ? Array.from({ length: Math.max(0, (cms.yearEnd || new Date().getFullYear()+1) - (cms.yearStart || 2015) + 1) }, (_, index) => (cms.yearEnd || new Date().getFullYear()+1) - index) : data.releaseYears || [];
  const displayYears = configuredYears.slice(0, cms.yearLimit || 12);
  const priceRanges = cms.priceRanges?.length ? cms.priceRanges : DEFAULT_HOME_PRICE_RANGES;
  const smartFilterGroups = cms.smartFilterGroups?.length ? cms.smartFilterGroups : DEFAULT_SMART_FILTER_GROUPS;
  const showEmpty = cms.hideEmptySections === false;
  const defaultLinks: Partial<Record<OrderedHomepageSection, string>> = { latest: '/phones?collection=latest&sort=newest', trending: '/phones?collection=trending&sort=trending', camera: '/best-camera-phone', gaming: '/best-gaming-phone', battery: '/best-battery-phone', budget: '/best-budget-phone', flagship: '/best-value-phone', upcoming: '/upcoming' };
  const ruleLink = (key: OrderedHomepageSection) => sectionRule(key).viewAllUrl || defaultLinks[key];
  const ruleLinkText = (key: OrderedHomepageSection, fallback: string) => sectionRule(key).showViewAll === false ? undefined : (sectionRule(key).viewAllText || fallback);
  const ruleCount = (key: OrderedHomepageSection, fallback: number) => Math.max(1, Math.min(24, sectionRule(key).cardCount || fallback));
  const renderOrderedSection = (key: OrderedHomepageSection) => {
    if (!visible(key)) return null;
    switch (key) {
      case 'latest': return <PhoneSection phones={latestPhones} title={titles.latest || 'Latest Phones'} icon={Clock} link={ruleLink('latest')} linkText={ruleLinkText('latest', 'View Latest')} showEmpty={showEmpty} tone="sky" cardCount={Math.max(6, ruleCount('latest', 6))} />;
      case 'trending': return <PhoneSection phones={balancedTrending} title={titles.trending || 'Trending Phones'} icon={TrendingUp} link={ruleLink('trending')} linkText={ruleLinkText('trending', 'View Trending')} showEmpty={showEmpty} tone="rose" cardCount={Math.max(6, ruleCount('trending', 6))} />;
      case 'camera': return <PhoneSection phones={cameraPhones} title={titles.camera || 'Best Camera Phones'} icon={Camera} link={ruleLink('camera')} linkText={ruleLinkText('camera', 'See All')} showEmpty={showEmpty} tone="violet" cardCount={Math.max(6, ruleCount('camera', 6))} />;
      case 'gaming': return <PhoneSection phones={gamingPhones} title={titles.gaming || 'Best Gaming Phones'} icon={Cpu} link={ruleLink('gaming')} linkText={ruleLinkText('gaming', 'See All')} showEmpty={showEmpty} tone="indigo" cardCount={Math.max(6, ruleCount('gaming', 6))} />;
      case 'battery': return <PhoneSection phones={batteryPhones} title={titles.battery || 'Best Battery Phones'} icon={Battery} link={ruleLink('battery')} linkText={ruleLinkText('battery', 'See All')} showEmpty={showEmpty} tone="emerald" cardCount={Math.max(6, ruleCount('battery', 6))} />;
      case 'budget': return <CompactTopPhones phones={budgetPhones} cardCount={Math.max(6, ruleCount('budget', 6))} title={titles.budget || 'Budget Champions'} icon={Tag} link={ruleLink('budget') || '/best-budget-phone'} linkText={ruleLinkText('budget', 'View All')} tone="amber" />;
      case 'flagship': return <CompactTopPhones phones={flagshipPhones} cardCount={Math.max(6, ruleCount('flagship', 6))} title={titles.flagship || 'Premium Flagships'} icon={Star} link={ruleLink('flagship') || '/best-value-phone'} linkText={ruleLinkText('flagship', 'See All')} tone="orange" />;
      case 'upcoming': return <CompactTopPhones phones={upcomingPhones} cardCount={Math.max(6, ruleCount('upcoming', 6))} title={titles.upcoming || 'Upcoming Phones'} icon={Clock} link={ruleLink('upcoming') || '/upcoming'} linkText={ruleLinkText('upcoming', 'View All')} tone="cyan" />;
      case 'reviews': return <HomeReviewsSection phones={data.featured} />;
      case 'videos': return <HomeVideoSection videos={data.videos} />;
      case 'news': return data.news.length > 0 ? (
        <section className={`rounded-3xl border p-3.5 shadow-sm sm:p-4 ${CATEGORY_TONES.orange}`}>
          <SectionHeader title={titles.news || 'Latest News'} icon={Newspaper} link="/news" linkText="All News" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.news.slice(0, 4).map(n => (
              <Link key={n.id} href={`/news/${n.slug}`} className="card-premium p-4 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 block">
                <Badge variant="secondary" className="text-[10px] mb-3 bg-gray-100 text-gray-600 font-medium">{n.category}</Badge>
                <h3 className="font-semibold text-sm line-clamp-2 mb-2 text-gray-900 leading-snug">{n.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.excerpt}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-3">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {siteSettings?.announcement?.enabled && siteSettings.announcement.text && (
        <div className="px-4 py-2 text-center text-sm font-medium text-white" style={{ background: siteSettings.announcement.background || '#2563eb' }}>
          <span>{siteSettings.announcement.text}</span>
          {siteSettings.announcement.buttonText && siteSettings.announcement.buttonUrl && <Link href={siteSettings.announcement.buttonUrl} className="ml-3 underline font-bold">{siteSettings.announcement.buttonText}</Link>}
        </div>
      )}
      <main className="flex-1">
        <div className="relative">
          <div className="glass-orb glass-orb-cyan" />
          <div className="glass-orb glass-orb-yellow" />
          <div className={`glass-page-bg ${contentWidthClass} mx-auto px-3 py-3 sm:px-5 sm:py-5 lg:px-6 space-y-7 sm:space-y-9 relative z-10`} style={{ backgroundColor: cms.pageBackground || undefined }}>

            {/* ===== 1. HERO ===== */}
            {cms.heroEnabled !== false && <section className="hero-gradient overflow-hidden rounded-3xl text-white relative sky-glow" style={{ backgroundColor: cms.heroBackground || undefined }}>
              <HeroCampaignBackground campaigns={cms.heroCampaigns} fallback={cms.heroBackgroundImage} intervalMs={cms.heroCampaignSpeed} />
              {/* Background effects — clipped to rounded corners */}
              <div className="hero-shimmer-effect absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="hero-particles">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="hero-particle" style={{ left: `${8 + (i * 7.5) % 85}%`, '--delay': `${i * 0.5}s`, '--duration': `${5 + (i % 4) * 1.5}s`, '--drift': `${(i % 2 === 0 ? 1 : -1) * (15 + i * 5)}px`, width: `${3 + (i % 3)}px`, height: `${3 + (i % 3)}px` } as React.CSSProperties} />
                  ))}
                </div>
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl hero-glow-anim" />
                <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-cyan-400/15 rounded-full blur-3xl hero-glow-anim" style={{ animationDelay: '2s' }} />
              </div>

              {/* Content — can overflow for floating phone effect */}
              <div className="relative z-10 p-4 sm:p-5 lg:p-6">
                <div className="relative flex flex-col items-center gap-5 lg:flex-row lg:gap-5">
                  {/* Left side — 45% */}
                  <div className="w-full lg:w-[45%]">
                    <div className="hero-badge-pop" style={{ animationDelay: '0.1s' }}>
                      <Badge className="bg-white/10 backdrop-blur-md text-white border border-white/20 mb-3 sm:mb-5 text-[10px] sm:text-xs font-medium">
                        <Trophy className="w-3 h-3 mr-1" /> {cms.heroBadge || "Pakistan's #1 Phone Database"}
                      </Badge>
                    </div>
                    <h1 className="hero-text-reveal font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-4 leading-tight tracking-tight" style={{ animationDelay: '0.25s' }}>
                      {cms.heroTitle || 'Find Your Perfect'} <span className="text-blue-400 hero-float" style={{ display: 'inline-block', fontSize: '0.74em' }}>{cms.heroHighlight || 'Smartphone'}</span>
                    </h1>
                    <p className="hero-animate text-gray-300/80 text-xs sm:text-base mb-4 sm:mb-6 leading-relaxed" style={{ animationDelay: '0.5s' }}>
                      {cms.heroSubtitle || 'Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.'}
                    </p>

                    <HomeHeroSearch placeholder={cms.searchPlaceholder} cta1Text={cms.cta1Text} cta1Url={cms.cta1Url} cta2Text={cms.cta2Text} cta2Url={cms.cta2Url} />

                    <div className="flex flex-wrap gap-3 sm:gap-5 mt-4 sm:mt-6 text-[10px] sm:text-sm text-gray-300/70">
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.1s' }}><Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> PTA Status</span>
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.2s' }}><Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> PKR Prices</span>
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.3s' }}><Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> Expert Reviews</span>
                    </div>
                  </div>

                  {/* Right side — 55% Featured Phone Showcase with floating effect */}
                  <div className="h-[290px] w-full flex-shrink-0 sm:h-[340px] lg:h-[390px] lg:w-[55%]">
                    {heroPhones.length > 0 ? (
                      <HeroPhoneShowcase phones={heroPhones} autoplay={cms.heroAnimationEnabled !== false} intervalMs={cms.heroAnimationSpeed || 5000} showInfo={cms.heroShowPhoneInfo !== false} position={{ desktopX: cms.heroDesktopX, desktopY: cms.heroDesktopY, desktopScale: cms.heroDesktopScale, desktopRotate: cms.heroDesktopRotate, mobileX: cms.heroMobileX, mobileY: cms.heroMobileY, mobileScale: cms.heroMobileScale, mobileRotate: cms.heroMobileRotate, imageFit: cms.heroImageFit }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>}

            {/* ===== 2. QUICK CATEGORIES ===== */}
            <QuickCategoryStrip />

            {/* ===== 3. PAKISTAN TRUST BAR ===== */}
            <PakistanTrustBar />

            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_TOP_SLOT} format="horizontal" className="py-2" />

            {/* ===== 4. POPULAR BRANDS + PHONE DISCOVERY FLOW ===== */}
            <div className={`grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] ${cms.pricePanelSide === 'left' ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div className="min-w-0 space-y-7 sm:space-y-9">
                {visible('brands') && <BrandsGrid brands={data.brands} title={titles.brands || 'Popular Brands'} logoSize={cms.brandLogoSize || 56} onlyWithPhones={cms.showOnlyBrandsWithPhones !== false} limit={cms.brandLimit || 11} columns={cms.brandColumns || 6} />}
                {sectionOrder
                  .filter(key => ['latest', 'trending', 'camera', 'gaming', 'battery', 'budget', 'flagship', 'upcoming'].includes(key))
                  .map(key => <React.Fragment key={key}>{renderOrderedSection(key)}</React.Fragment>)}
              </div>
              <aside className="isolate flex min-h-0 flex-col gap-5 self-start lg:sticky lg:top-24 [&>*]:!m-0 [&>*]:shrink-0">
                {cms.showPriceCategories !== false && <PriceCategorySidebar ranges={priceRanges} limit={cms.homepagePriceLimit || 6} />}
                {cms.smartFiltersEnabled !== false && <HomeSmartFilterSidebar groups={smartFilterGroups} />}
                {cms.showYearCategories !== false && <ReleaseYearCategories years={displayYears.slice(0, 6)} />}
              </aside>
            </div>

            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_MIDDLE_SLOT} format="auto" className="py-2" />
            <div style={{ display: 'grid', gap: `${Math.min(cms.sectionGap || 36, 44)}px` }}>
              {sectionOrder
                .filter(key => ['reviews', 'videos', 'news'].includes(key))
                .map(key => <React.Fragment key={key}>{renderOrderedSection(key)}</React.Fragment>)}
            </div>

            {/* ===== 16-18. COMING SOON TEASERS ===== */}
            <ExploreSpecsDekhTools />

            {/* ===== 19. SPONSOR BANNER ===== */}
            {visible('sponsors') && data.sponsors && data.sponsors.length > 0 && (
              <section>
                <div className="rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-4 p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, #111827, #1F2937)' }}>
                    <div className="flex-1 min-w-0">
                      <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 mb-2 text-[10px] font-medium">Sponsored</Badge>
                      <div className="flex items-center gap-3">
                        {data.sponsors[0].image ? (
                          <Image src={data.sponsors[0].image} alt={data.sponsors[0].name} width={60} height={60} className="rounded-xl object-contain bg-white/10 p-1.5" unoptimized />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center"><Star className="w-7 h-7 text-blue-400" /></div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-white">{data.sponsors[0].name}</h3>
                          <p className="text-xs text-gray-500">{data.sponsors[0].position || 'Featured Partner'}</p>
                        </div>
                      </div>
                    </div>
                    {data.sponsors[0].url && (
                      <a href={data.sponsors[0].url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="border-white/15 text-white hover:bg-white/10 rounded-xl">
                          Visit <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ===== 20. NEWSLETTER ===== */}
            {visible('newsletter') && <HomeNewsletter />}

            {/* ===== 21. TRUST SECTION ===== */}
            {visible('trust') && <TrustSection totalPhones={data.totalPhones} totalBrands={data.totalBrands} />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
