import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, Shield, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, Smartphone, Tag, ExternalLink, Layers,
  Check, Newspaper, BarChart3, Target, CircleDollarSign, ChevronRight,
  Search, GitCompareArrows, BadgeDollarSign, ShieldCheck, ArrowRight,
  BellRing, BadgeCheck, Store, SearchCheck, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import type { HeroPhone } from '@/components/shared/HeroPhoneShowcase';
import { HeroPhoneShowcase } from '@/components/shared/HeroPhoneShowcase';
import { HomeHeroSearch } from '@/components/home/HomeHeroSearch';
import { HomeNewsletter } from '@/components/home/HomeNewsletter';
import { HomeVideoSection } from '@/components/home/HomeVideoSection';
import { AdSlot } from '@/components/monetization/AdSlot';
import type { Phone, HomeData, Brand } from '@/components/shared/types';
import { PRICE_CATEGORIES } from '@/lib/price-categories';

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
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {QUICK_CATEGORIES.map(cat => (
        <Link
          key={cat.label}
          href={cat.href}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/60 border border-gray-200/60 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200"
        >
          <span>{cat.emoji}</span>
          {cat.label}
        </Link>
      ))}
    </div>
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
  sky: 'border-sky-300/75 bg-gradient-to-br from-sky-200/90 via-blue-100/70 to-cyan-200/75 shadow-sky-300/30',
  rose: 'border-rose-300/75 bg-gradient-to-br from-rose-200/90 via-pink-100/70 to-orange-200/65 shadow-rose-300/30',
  violet: 'border-violet-300/75 bg-gradient-to-br from-violet-200/90 via-purple-100/70 to-fuchsia-200/65 shadow-violet-300/30',
  indigo: 'border-indigo-300/75 bg-gradient-to-br from-indigo-200/90 via-blue-100/70 to-violet-200/70 shadow-indigo-300/30',
  emerald: 'border-emerald-300/75 bg-gradient-to-br from-emerald-200/90 via-green-100/70 to-teal-200/70 shadow-emerald-300/30',
  amber: 'border-amber-300/80 bg-gradient-to-br from-amber-200/95 via-yellow-100/75 to-orange-200/70 shadow-amber-300/30',
  orange: 'border-orange-300/75 bg-gradient-to-br from-orange-200/90 via-amber-100/70 to-rose-200/65 shadow-orange-300/30',
  fuchsia: 'border-fuchsia-300/75 bg-gradient-to-br from-fuchsia-200/85 via-pink-100/70 to-violet-200/70 shadow-fuchsia-300/30',
  cyan: 'border-cyan-300/75 bg-gradient-to-br from-cyan-200/90 via-sky-100/70 to-teal-200/70 shadow-cyan-300/30',
};

// ============ PHONE SECTION (full card grid) ============
function PhoneSection({ phones, title, icon: Icon, link, linkText, showEmpty, tone = 'sky' }: { phones: Phone[]; title: string; icon: React.ElementType; link?: string; linkText?: string; showEmpty?: boolean; tone?: CategoryTone }) {
  if (!phones.length) {
    if (!showEmpty) return null;
    return (
      <section className={`rounded-3xl border p-3 shadow-lg sm:p-5 ${CATEGORY_TONES[tone]}`}>
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
    <section className={`rounded-3xl border p-3 shadow-lg sm:p-5 ${CATEGORY_TONES[tone]}`}>
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
        {phones.slice(0, 8).map(p => (
          <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto">
            <PhoneCard phone={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ COMPACT TOP PHONES (for Budget, Flagship, Upcoming) ============
function CompactTopPhones({ phones, title, icon: Icon, link, linkText, tone = 'sky' }: { phones: Phone[]; title: string; icon: React.ElementType; link: string; linkText?: string; tone?: CategoryTone }) {
  if (!phones.length) return null;
  return (
    <section className={`rounded-3xl border p-3 shadow-lg sm:p-5 ${CATEGORY_TONES[tone]}`}>
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText || 'View All'} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {phones.slice(0, 4).map(p => <PhoneCard key={p.id} phone={p} />)}
      </div>
    </section>
  );
}

import { OFFICIAL_LOGOS } from '@/lib/brand-logos';

// ============ BRANDS GRID ============

const PRIORITY_ORDER = ['samsung', 'apple', 'google', 'xiaomi', 'oneplus', 'vivo', 'oppo', 'realme', 'motorola', 'nothing', 'honor', 'tecno', 'infinix'];

function BrandsGrid({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;

  // Only show brands that have at least 1 phone
  const brandsWithPhones = brands.filter(b => (b._count?.phones || 0) > 0);

  // Sort: priority brands first, then by phone count
  const sorted = [...brandsWithPhones].sort((a, b) => {
    const aIdx = PRIORITY_ORDER.indexOf(a.slug.toLowerCase());
    const bIdx = PRIORITY_ORDER.indexOf(b.slug.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (b._count?.phones || 0) - (a._count?.phones || 0);
  });

  // Keep the final "All Brands" tile inside the same two-row desktop grid.
  const displayBrands = sorted.slice(0, 13);
  if (!displayBrands.length) return null;

  return (
    <section>
      <SectionHeader title="Popular Brands" icon={Layers} link="/brands" linkText="All Brands" />
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 xl:grid-cols-7">
        {displayBrands.map(brand => {
          const logoSrc = OFFICIAL_LOGOS[brand.name.toLowerCase()] || OFFICIAL_LOGOS[brand.slug.toLowerCase()] || brand.logo;
          return (
            <Link key={brand.id} href={`/brands/${brand.slug}`} className="card-premium flex min-h-[122px] flex-col items-center justify-center gap-1.5 p-2.5 text-center transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 sm:min-h-[132px] sm:p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-sky-500/15 sm:h-11 sm:w-11">
                {logoSrc ? (
                  <Image src={logoSrc} alt={brand.name} width={32} height={32} className="object-contain" unoptimized />
                ) : (
                  <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-sky-300 transition-colors line-clamp-1">{brand.name}</span>
              <span className="text-[10px] text-muted-foreground">{brand._count?.phones || 0} phones</span>
            </Link>
          );
        })}
        {/* All Brands card */}
        <Link href="/brands" className="card-premium flex min-h-[122px] flex-col items-center justify-center gap-1.5 p-2.5 text-center transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 sm:min-h-[132px] sm:p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 transition-colors group-hover:bg-blue-100 sm:h-11 sm:w-11">
            <Layers className="w-5 h-5 text-blue-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">All Brands</span>
          <span className="text-[10px] text-muted-foreground">View all</span>
        </Link>
      </div>
    </section>
  );
}

// ============ SHOP BY PRICE SIDEBAR ============
function PriceCategorySidebar() {
  const categories = PRICE_CATEGORIES.filter(category => !category.missing);

  return (
    <aside className="card-premium h-fit p-3.5 lg:-mt-10 lg:self-start lg:sticky lg:top-24" aria-labelledby="home-price-categories-title">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <CircleDollarSign className="h-5 w-5 text-blue-500" aria-hidden="true" />
        </div>
        <div>
          <h2 id="home-price-categories-title" className="text-sm font-bold text-gray-900 dark:text-white">Phones by Price</h2>
          <p className="text-[11px] text-muted-foreground">Choose your budget</p>
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2" aria-label="Browse phones by price category">
        {categories.map(category => (
          <Link
            key={category.key}
            href={`/phones?priceCategory=${category.key}`}
            className="group flex min-h-12 items-center justify-between gap-1.5 rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-white/55 dark:bg-slate-900/65 px-2.5 py-1.5 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-gray-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-sky-300">{category.label}</span>
              <span className="block text-[10px] text-muted-foreground">{category.shortLabel}</span>
            </span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 xl:block" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <Link href="/price-ranges" className="mt-2.5 flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        View all price ranges
      </Link>
    </aside>
  );
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
                Why people use PhoneDock
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
    <section className={`rounded-3xl border p-3 shadow-lg sm:p-5 ${CATEGORY_TONES.fuchsia}`}>
      <SectionHeader title="Latest Reviews" icon={Star} link="/reviews" linkText="All Reviews" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {reviewedPhones.map(p => <PhoneCard key={p.id} phone={p} />)}
      </div>
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

function ExplorePhoneDockTools() {
  return (
    <section id="phonedock-tools" className="scroll-mt-28 space-y-5" aria-labelledby="phonedock-tools-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600">Useful shortcuts</p>
          <h2 id="phonedock-tools-title" className="font-display text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Explore PhoneDock Tools</h2>
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
type CmsSettings = { homepage?: { heroEnabled?: boolean; heroBadge?: string; heroTitle?: string; heroHighlight?: string; heroSubtitle?: string; searchPlaceholder?: string; cta1Text?: string; cta1Url?: string; cta2Text?: string; cta2Url?: string; heroAnimationEnabled?: boolean; heroAnimationSpeed?: number; heroShowPhoneInfo?: boolean; sections?: Record<string, boolean>; titles?: Record<string, string> }; announcement?: { enabled?: boolean; text?: string; buttonText?: string; buttonUrl?: string; background?: string } };

export default function HomeContent({ homeData, heroPhones, siteSettings }: { homeData: HomeData; heroPhones: HeroPhone[]; siteSettings?: CmsSettings }) {
  const data = homeData;
  const flagshipPhones = data.featured.filter(p => p.pricePKR >= 150000).slice(0, 5);
  const budgetPhones = data.featured.filter(p => p.pricePKR > 0 && p.pricePKR <= 40000).slice(0, 5);
  const cms = siteSettings?.homepage || {};
  const sections = cms.sections || {};
  const titles = cms.titles || {};
  const visible = (key: string) => sections[key] !== false;

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
          <div className="glass-page-bg max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-10 sm:space-y-14 relative z-10">

            {/* ===== 1. HERO ===== */}
            {cms.heroEnabled !== false && <section className="hero-gradient rounded-3xl text-white relative sky-glow">
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
              <div className="relative z-10 p-4 sm:p-6 lg:p-7">
                <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-6">
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
                  <div className="h-[330px] w-full flex-shrink-0 sm:h-[390px] lg:h-[470px] lg:w-[55%]">
                    {heroPhones.length > 0 ? (
                      <HeroPhoneShowcase phones={heroPhones} autoplay={cms.heroAnimationEnabled !== false} intervalMs={cms.heroAnimationSpeed || 5000} showInfo={cms.heroShowPhoneInfo !== false} />
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

            {/* ===== 4. POPULAR BRANDS + PRICE CATEGORIES ===== */}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                {visible('brands') && <BrandsGrid brands={data.brands} />}
              </div>
              <PriceCategorySidebar />
            </div>

            {/* ===== 5. LATEST PHONES ===== */}
            {visible('latest') && <PhoneSection phones={data.latest} title={titles.latest || 'Latest Phones'} icon={Clock} link="/phones?collection=latest&sort=newest" linkText="View Latest" showEmpty tone="sky" />}

            {/* ===== 6. TRENDING PHONES ===== */}
            {visible('trending') && <PhoneSection phones={data.trending} title={titles.trending || 'Trending Phones'} icon={TrendingUp} link="/phones?collection=trending&sort=trending" linkText="View Trending" showEmpty tone="rose" />}

            {/* ===== 7. BEST CAMERA PHONES ===== */}
            {visible('camera') && <PhoneSection phones={data.bestCamera} title={titles.camera || 'Best Camera Phones'} icon={Camera} link="/best-camera-phone" linkText="See All" tone="violet" />}

            {/* ===== 8. BEST GAMING PHONES ===== */}
            {visible('gaming') && <PhoneSection phones={data.bestGaming} title={titles.gaming || 'Best Gaming Phones'} icon={Cpu} link="/best-gaming-phone" linkText="See All" tone="indigo" />}

            {/* ===== 9. BEST BATTERY PHONES ===== */}
            {visible('battery') && <PhoneSection phones={data.bestBattery} title={titles.battery || 'Best Battery Phones'} icon={Battery} link="/best-battery-phone" linkText="See All" tone="emerald" />}

            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_MIDDLE_SLOT} format="auto" className="py-2" />

            {/* ===== 10. BUDGET CHAMPIONS ===== */}
            {visible('budget') && <CompactTopPhones phones={budgetPhones} title={titles.budget || 'Budget Champions'} icon={Tag} link="/best-budget-phone" tone="amber" />}

            {/* ===== 11. PREMIUM FLAGSHIPS ===== */}
            {visible('flagship') && <CompactTopPhones phones={flagshipPhones} title={titles.flagship || 'Premium Flagships'} icon={Star} link="/best-value-phone" linkText="See All" tone="orange" />}

            {/* ===== 12. UPCOMING PHONES ===== */}
            {visible('upcoming') && <CompactTopPhones phones={data.upcoming} title={titles.upcoming || 'Upcoming Phones'} icon={Clock} link="/upcoming" tone="cyan" />}

            {/* ===== 13. LATEST REVIEWS ===== */}
            {visible('reviews') && <HomeReviewsSection phones={data.featured} />}

            {/* ===== 14. LATEST VIDEOS ===== */}
            {visible('videos') && <HomeVideoSection videos={data.videos} />}

            {/* ===== 15. LATEST NEWS ===== */}
            {visible('news') && data.news.length > 0 && (
              <section className={`rounded-3xl border p-3 shadow-lg sm:p-5 ${CATEGORY_TONES.orange}`}>
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
            )}

            {/* ===== 16-18. COMING SOON TEASERS ===== */}
            <ExplorePhoneDockTools />

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
