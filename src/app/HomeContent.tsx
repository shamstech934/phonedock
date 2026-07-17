'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search, Star, Shield, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, Smartphone, Tag, ExternalLink, Layers,
  Check, ChevronRight, Newspaper, BarChart3, Target, Play, X,
  Zap, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { HeroPhoneShowcase } from '@/components/shared/HeroPhoneShowcase';
import type { HeroPhone } from '@/components/shared/HeroPhoneShowcase';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone, HomeData, Brand } from '@/components/shared/types';

// ============ QUICK CATEGORY STRIP ============
const QUICK_CATEGORIES = [
  { emoji: '\u{1F4F1}', label: 'Latest', href: '/phones?sort=newest' },
  { emoji: '\u{1F525}', label: 'Trending', href: '/phones?sort=trending' },
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

// ============ PHONE SECTION (full card grid) ============
function PhoneSection({ phones, title, icon: Icon, link, linkText, showEmpty }: { phones: Phone[]; title: string; icon: React.ElementType; link?: string; linkText?: string; showEmpty?: boolean }) {
  if (!phones.length) {
    if (!showEmpty) return null;
    return (
      <section className="space-y-4">
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
    <section className="space-y-4">
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
function CompactTopPhones({ phones, title, icon: Icon, gradient, link, linkText }: { phones: Phone[]; title: string; icon: React.ElementType; gradient: string; link: string; linkText?: string }) {
  const router = useRouter();
  if (!phones.length) return null;
  return (
    <section className="space-y-4">
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText || 'View All'} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-premium overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
          <div className={`bg-gradient-to-br ${gradient} p-4 text-white`}>
            <div className="flex items-center gap-2"><Icon className="w-5 h-5" /><h3 className="font-bold text-sm">{title}</h3></div>
          </div>
          <div className="p-3 space-y-1.5">
            {phones.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -m-1 transition-colors" onClick={() => router.push(`/phones/${p.slug}`)}>
                <span className="text-xs font-bold text-gray-300 w-5 text-center">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground">{p.brand?.name}</p>
                  <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
                </div>
                <p className="text-xs font-bold text-blue-600 shrink-0">{formatPrice(p.pricePKR)}</p>
              </div>
            ))}
            <Link href={link} className="flex items-center justify-center gap-1 text-xs text-blue-500 font-medium pt-2 hover:text-blue-600 transition-colors">
              {linkText || 'View All'} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ BRANDS GRID ============
const OFFICIAL_LOGOS: Record<string, string> = {
  samsung: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Samsung_logo_wordmark.svg',
  apple: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
  xiaomi: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg',
  realme: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Realme_logo.svg',
  tecno: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Tecno_Mobile_logo.svg',
  infinix: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Infinix_logo.svg',
  oneplus: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/OnePlus_logo.svg',
  oppo: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/OPPO_LOGO_2019.svg',
  vivo: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Vivo_logo_2019.svg',
  huawei: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Huawei_wordmark_2019.svg',
  motorola: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Motorola_new_logo.svg',
  honor: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Honor_Logo_%282020%29.svg',
  nokia: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Nokia_2023.svg',
  google: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  nothing: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Nothing.svg',
  'google pixel': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
};

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

  const displayBrands = sorted.slice(0, 14);
  if (!displayBrands.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title="Popular Brands" icon={Layers} link="/brands" linkText="All Brands" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {displayBrands.map(brand => {
          const logoSrc = OFFICIAL_LOGOS[brand.name.toLowerCase()] || OFFICIAL_LOGOS[brand.slug.toLowerCase()] || brand.logo;
          return (
            <Link key={brand.id} href={`/brands/${brand.slug}`} className="card-premium p-3 sm:p-4 flex flex-col items-center justify-center gap-2 group hover:shadow-lg hover:shadow-black/5 transition-all duration-300 text-center">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
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
        <Link href="/brands" className="card-premium p-3 sm:p-4 flex flex-col items-center justify-center gap-2 group hover:shadow-lg hover:shadow-black/5 transition-all duration-300 text-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Layers className="w-5 h-5 text-blue-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">All Brands</span>
          <span className="text-[10px] text-muted-foreground">View all</span>
        </Link>
      </div>
    </section>
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

// ============ VIDEO REVIEWS SECTION ============
function HomeVideoSection() {
  const [videos, setVideos] = useState<Array<{ id: string; youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string; phone: { modelName: string; slug: string; brand: string; thumbnail: string } | null }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeVideo, setActiveVideo] = useState<typeof videos[0] | null>(null);

  const closeModal = useCallback(() => setActiveVideo(null), []);

  React.useEffect(() => {
    fetch('/api/videos?limit=4')
      .then(r => r.json())
      .then(d => { if (d.videos?.length) { setVideos(d.videos); setLoaded(true); } })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (activeVideo) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [activeVideo, closeModal]);

  if (!loaded || !videos.length) return null;

  return (
    <section className="space-y-5">
      <SectionHeader title="Latest Video Reviews" icon={Play} link="/videos" linkText="All Videos" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {videos.map(v => (
          <div key={v.id} onClick={() => setActiveVideo(v)} className="card-premium overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 block">
            <div className="relative aspect-video bg-gray-100">
              {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Play className="w-4 h-4 text-gray-900 ml-0.5" fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm line-clamp-2 text-gray-900 leading-snug mb-1">{v.title}</h3>
              {v.phone && <Link href={`/phones/${v.phone.slug}`} className="text-[11px] text-blue-500 font-medium hover:underline" onClick={e => e.stopPropagation()}>{v.phone.brand} {v.phone.modelName}</Link>}
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <button onClick={closeModal} className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2">
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <h2 className="text-white font-semibold text-sm sm:text-base mt-3 px-1 line-clamp-2">{activeVideo.title}</h2>
            {activeVideo.phone && (
              <Link href={`/phones/${activeVideo.phone.slug}`} onClick={closeModal} className="inline-flex items-center gap-2 mt-2 px-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                {activeVideo.phone.thumbnail && <Image src={activeVideo.phone.thumbnail} alt={activeVideo.phone.modelName} width={16} height={16} className="rounded object-contain" unoptimized />}
                {activeVideo.phone.brand} {activeVideo.phone.modelName}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ============ LATEST REVIEWS SECTION ============
function HomeReviewsSection({ phones }: { phones: Phone[] }) {
  const router = useRouter();
  const reviewedPhones = phones.filter(p => p.reviewSummary && p.overallRating > 0).slice(0, 4);
  if (!reviewedPhones.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title="Latest Reviews" icon={Star} link="/reviews" linkText="All Reviews" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reviewedPhones.map(p => (
          <div key={p.id} onClick={() => router.push(`/phones/${p.slug}`)} className="card-premium p-4 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground font-medium">{p.brand?.name}</p>
              <div className="flex items-center gap-0.5 ml-auto">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-gray-900">{p.overallRating}/10</span>
              </div>
            </div>
            <h3 className="font-semibold text-sm text-gray-900 mb-2 line-clamp-1">{p.modelName}</h3>
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{p.reviewSummary}</p>
          </div>
        ))}
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

// ============ NEWSLETTER ============
function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (email.trim() && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <section className="space-y-4">
      <SectionHeader title="Stay Updated" icon={Mail} />
      <div className="card-premium p-6 sm:p-8 text-center">
        <h3 className="font-bold text-gray-900 text-lg mb-2">Get the Latest Phone Updates</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">New launches, price drops, and expert reviews delivered straight to your inbox.</p>
        {subscribed ? (
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm py-2">
            <Check className="w-4 h-4" /> Subscribed successfully! Check your inbox.
          </div>
        ) : (
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
              className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            <button onClick={handleSubscribe} className="btn-primary h-11 px-6 rounded-xl text-sm font-semibold whitespace-nowrap">
              Subscribe
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ============ MAIN CLIENT CONTENT ============
export default function HomeContent({ homeData, heroPhones }: { homeData: HomeData; heroPhones: HeroPhone[] }) {
  const [homeSearchQ, setHomeSearchQ] = useState('');
  const router = useRouter();

  const handleHomeSearch = () => {
    if (homeSearchQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(homeSearchQ.trim())}`);
    }
  };

  const data = homeData;
  const flagshipPhones = data.featured.filter(p => p.pricePKR >= 150000).slice(0, 5);
  const budgetPhones = data.featured.filter(p => p.pricePKR > 0 && p.pricePKR <= 40000).slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="relative">
          <div className="glass-orb glass-orb-cyan" />
          <div className="glass-orb glass-orb-yellow" />
          <div className="glass-page-bg max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-10 sm:space-y-14 relative z-10">

            {/* ===== 1. HERO ===== */}
            <section className="hero-gradient rounded-3xl text-white relative sky-glow">
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
              <div className="relative z-10 p-4 sm:p-7 lg:p-[34px]">
                <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-6">
                  {/* Left side — 45% */}
                  <div className="w-full lg:w-[45%]">
                    <div className="hero-badge-pop" style={{ animationDelay: '0.1s' }}>
                      <Badge className="bg-white/10 backdrop-blur-md text-white border border-white/20 mb-3 sm:mb-5 text-[10px] sm:text-xs font-medium">
                        <Trophy className="w-3 h-3 mr-1" /> Pakistan&apos;s #1 Phone Database
                      </Badge>
                    </div>
                    <h1 className="hero-text-reveal font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-4 leading-tight tracking-tight" style={{ animationDelay: '0.25s' }}>
                      Find Your Perfect <span className="text-blue-400 hero-float" style={{ display: 'inline-block', fontSize: '0.74em' }}>Smartphone</span>
                    </h1>
                    <p className="hero-animate text-gray-300/80 text-xs sm:text-base mb-4 sm:mb-6 leading-relaxed" style={{ animationDelay: '0.5s' }}>
                      Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.
                    </p>

                    <div className="hero-search-slide flex gap-2 max-w-xl" style={{ animationDelay: '0.7s' }}>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        <input placeholder="Phone name, brand..." value={homeSearchQ} onChange={e => setHomeSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHomeSearch()} className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 h-10 sm:h-12 text-xs sm:text-sm rounded-xl bg-white/15 backdrop-blur-xl text-white outline-none focus:ring-2 focus:ring-blue-400/40 focus:bg-white/20 border border-white/10 placeholder:text-gray-400 transition-all" />
                      </div>
                      <button onClick={handleHomeSearch} className="glass-float text-white h-10 sm:h-12 px-4 sm:px-6 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
                        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Search
                      </button>
                    </div>

                    <div className="hero-animate flex flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6" style={{ animationDelay: '0.9s' }}>
                      <Button className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border-white/20 text-xs sm:text-sm" onClick={() => router.push('/brands')}>
                        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Browse Phones
                      </Button>
                      <Button className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border-white/20 text-xs sm:text-sm" onClick={() => router.push('/compare')}>
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Compare
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-3 sm:gap-5 mt-4 sm:mt-6 text-[10px] sm:text-sm text-gray-300/70">
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.1s' }}><Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> PTA Status</span>
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.2s' }}><Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /> PKR Prices</span>
                      <span className="hero-feature-slide flex items-center gap-1 sm:gap-1.5" style={{ animationDelay: '1.3s' }}><Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> Expert Reviews</span>
                    </div>
                  </div>

                  {/* Right side — 55% Featured Phone Showcase with floating effect */}
                  <div className="w-full lg:w-[55%] h-[200px] sm:h-[280px] lg:h-[320px] flex-shrink-0 -mb-4 sm:-mb-6 lg:-mb-10">
                    {heroPhones.length > 0 ? (
                      <HeroPhoneShowcase phones={heroPhones} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ===== 2. QUICK CATEGORIES ===== */}
            <QuickCategoryStrip />

            {/* ===== 3. PAKISTAN TRUST BAR ===== */}
            <PakistanTrustBar />

            {/* ===== 4. POPULAR BRANDS ===== */}
            <BrandsGrid brands={data.brands} />

            {/* ===== 5. LATEST PHONES ===== */}
            <PhoneSection phones={data.latest} title="Latest Phones" icon={Clock} link="/phones" linkText="All Phones" showEmpty />

            {/* ===== 6. TRENDING PHONES ===== */}
            <PhoneSection phones={data.trending} title="Trending Phones" icon={TrendingUp} link="/phones" linkText="All Phones" showEmpty />

            {/* ===== 7. BEST CAMERA PHONES ===== */}
            <PhoneSection phones={data.bestCamera} title="Best Camera Phones" icon={Camera} link="/best-camera-phone" linkText="See All" />

            {/* ===== 8. BEST GAMING PHONES ===== */}
            <PhoneSection phones={data.bestGaming} title="Best Gaming Phones" icon={Cpu} link="/best-gaming-phone" linkText="See All" />

            {/* ===== 9. BEST BATTERY PHONES ===== */}
            <PhoneSection phones={data.bestBattery} title="Best Battery Phones" icon={Battery} link="/best-battery-phone" linkText="See All" />

            {/* ===== 10. BUDGET CHAMPIONS ===== */}
            <CompactTopPhones phones={budgetPhones} title="Budget Champions" icon={Tag} gradient="from-green-500 to-emerald-600" link="/best-budget-phone" />

            {/* ===== 11. PREMIUM FLAGSHIPS ===== */}
            <CompactTopPhones phones={flagshipPhones} title="Premium Flagships" icon={Star} gradient="from-amber-500 to-orange-500" link="/best-value-phone" linkText="See All" />

            {/* ===== 12. UPCOMING PHONES ===== */}
            <CompactTopPhones phones={data.upcoming} title="Upcoming Phones" icon={Clock} gradient="from-indigo-500 to-violet-600" link="/upcoming" />

            {/* ===== 13. LATEST REVIEWS ===== */}
            <HomeReviewsSection phones={data.featured} />

            {/* ===== 14. LATEST VIDEOS ===== */}
            <HomeVideoSection />

            {/* ===== 15. LATEST NEWS ===== */}
            {data.news.length > 0 && (
              <section className="space-y-5">
                <SectionHeader title="Latest News" icon={Newspaper} link="/news" linkText="All News" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.news.slice(0, 4).map(n => (
                    <div key={n.id} className="card-premium p-4 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300" onClick={() => router.push('/news')}>
                      <Badge variant="secondary" className="text-[10px] mb-3 bg-gray-100 text-gray-600 font-medium">{n.category}</Badge>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-2 text-gray-900 leading-snug">{n.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.excerpt}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-3">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===== 16-18. COMING SOON TEASERS ===== */}
            <ComingSoonTeasers />

            {/* ===== 19. SPONSOR BANNER ===== */}
            {data.sponsors && data.sponsors.length > 0 && (
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
            <NewsletterSection />

            {/* ===== 21. TRUST SECTION ===== */}
            <TrustSection totalPhones={data.totalPhones} totalBrands={data.totalBrands} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}