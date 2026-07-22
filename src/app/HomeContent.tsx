import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, Shield, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, Smartphone, Tag, ExternalLink, Layers,
  Check, Newspaper, BarChart3, Target, CircleDollarSign, ChevronRight,
  Zap,
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
  sky: 'border-sky-200/60 bg-gradient-to-br from-sky-100/75 via-blue-50/45 to-cyan-100/55 shadow-sky-200/20',
  rose: 'border-rose-200/60 bg-gradient-to-br from-rose-100/75 via-pink-50/45 to-orange-100/45 shadow-rose-200/20',
  violet: 'border-violet-200/60 bg-gradient-to-br from-violet-100/75 via-purple-50/45 to-fuchsia-100/45 shadow-violet-200/20',
  indigo: 'border-indigo-200/60 bg-gradient-to-br from-indigo-100/75 via-blue-50/45 to-violet-100/50 shadow-indigo-200/20',
  emerald: 'border-emerald-200/60 bg-gradient-to-br from-emerald-100/75 via-green-50/45 to-teal-100/50 shadow-emerald-200/20',
  amber: 'border-amber-200/60 bg-gradient-to-br from-amber-100/80 via-yellow-50/45 to-orange-100/45 shadow-amber-200/20',
  orange: 'border-orange-200/60 bg-gradient-to-br from-orange-100/75 via-amber-50/45 to-rose-100/45 shadow-orange-200/20',
  fuchsia: 'border-fuchsia-200/60 bg-gradient-to-br from-fuchsia-100/70 via-pink-50/45 to-violet-100/50 shadow-fuchsia-200/20',
  cyan: 'border-cyan-200/60 bg-gradient-to-br from-cyan-100/75 via-sky-50/45 to-teal-100/50 shadow-cyan-200/20',
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-blue-50 sm:h-11 sm:w-11">
                {logoSrc ? (
                  <Image src={logoSrc} alt={brand.name} width={32} height={32} className="object-contain" unoptimized />
                ) : (
                  <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-1">{brand.name}</span>
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
          <h2 id="home-price-categories-title" className="text-sm font-bold text-gray-900">Phones by Price</h2>
          <p className="text-[11px] text-muted-foreground">Choose your budget</p>
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2" aria-label="Browse phones by price category">
        {categories.map(category => (
          <Link
            key={category.key}
            href={`/phones?priceCategory=${category.key}`}
            className="group flex min-h-12 items-center justify-between gap-1.5 rounded-xl border border-gray-200/70 bg-white/55 px-2.5 py-1.5 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-gray-800 group-hover:text-blue-700">{category.label}</span>
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
  const stats = [
    { icon: Smartphone, label: 'Phones Listed', value: tp > 0 ? `${tp.toLocaleString()}+` : '4,500+' },
    { icon: Layers, label: 'Brands Covered', value: tb > 0 ? `${tb}+` : '120+' },
    { icon: Star, label: 'Expert Reviews', value: '500+' },
    { icon: Target, label: 'Prices Tracked', value: 'Daily' },
  ];
  const methods = [
    { icon: Check, text: 'Prices verified from authorized retailers across Pakistan' },
    { icon: Check, text: 'PTA approval status checked with official PTA database' },
    { icon: Check, text: 'Benchmark scores from standardized testing procedures' },
    { icon: Check, text: 'Editorial reviews based on hands-on testing experience' },
    { icon: Check, text: 'Specs sourced from official manufacturer documentation' },
  ];

  return (
    <section className="space-y-5">
      <SectionHeader title="Why PhoneDock?" icon={Shield} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="card-premium p-5 text-center">
            <stat.icon className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-extrabold text-gray-900 font-display">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="card-premium p-5 sm:p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" /> Our Data Methodology
        </h3>
        <ul className="space-y-2.5">
          {methods.map((m, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <m.icon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
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

// ============ COMING SOON TEASERS ============
const COMING_SOON = [
  { title: 'Price Tracker', description: 'Track price history over time and get drop alerts', icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
  { title: 'Benchmarks', description: 'AnTuTu, Geekbench & gaming FPS scores compared', icon: Target, color: 'text-violet-500', bg: 'bg-violet-50' },
  { title: 'Camera Samples', description: 'Real sample photos from every phone camera', icon: Camera, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { title: 'PTA Updates', description: 'Official PTA approval status & IMEI verification', icon: Shield, color: 'text-amber-500', bg: 'bg-amber-50' },
];

function ComingSoonTeasers() {
  return (
    <section className="space-y-4">
      <SectionHeader title="New Features" icon={Zap} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {COMING_SOON.map(t => (
          <div key={t.title} className="card-premium p-4 hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
            <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center mb-3`}>
              <t.icon className={`w-5 h-5 ${t.color}`} />
            </div>
            <h3 className="font-bold text-sm text-gray-900 mb-1">{t.title}</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t.description}</p>
            <Badge variant="secondary" className="mt-2.5 text-[9px] bg-gray-100 text-gray-500 font-medium">Coming Soon</Badge>
          </div>
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
            <ComingSoonTeasers />

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
