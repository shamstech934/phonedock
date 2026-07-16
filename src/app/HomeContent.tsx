'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search, Star, Shield, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, Smartphone, Tag, ExternalLink, Layers,
  Check, ChevronRight, Newspaper, BarChart3, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { HeroPhoneShowcase } from '@/components/shared/HeroPhoneShowcase';
import type { HeroPhone } from '@/components/shared/HeroPhoneShowcase';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone, HomeData, Brand } from '@/components/shared/types';

// ============ PHONE SECTION ============
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
        {phones.map(p => (
          <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto">
            <PhoneCard phone={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ BRANDS GRID ============
function BrandsGrid({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;
  const displayBrands = brands.filter(b => (b._count?.phones || 0) > 0).slice(0, 12);
  if (!displayBrands.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title="Popular Brands" icon={Layers} link="/brands" linkText="All Brands" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {displayBrands.map(brand => (
          <Link key={brand.id} href={`/brands/${brand.slug}`} className="card-premium p-4 flex flex-col items-center justify-center gap-2 group hover:shadow-lg hover:shadow-black/5 transition-all duration-300 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
              {brand.logo ? (
                <Image src={brand.logo} alt={brand.name} width={32} height={32} className="object-contain" unoptimized />
              ) : (
                <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              )}
            </div>
            <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-1">{brand.name}</span>
            <span className="text-[10px] text-muted-foreground">{brand._count?.phones || 0} phones</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============ TRUST SECTION ============
function TrustSection() {
  const stats = [
    { icon: Smartphone, label: 'Phones Listed', value: '500+' },
    { icon: Layers, label: 'Brands Covered', value: '25+' },
    { icon: BarChart3, label: 'Reviews Written', value: '100+' },
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



// ============ MAIN CLIENT CONTENT ============
// Receives pre-fetched data from the server component — no useEffect data fetching needed.

export default function HomeContent({ homeData, heroPhones }: { homeData: HomeData; heroPhones: HeroPhone[] }) {
  const [homeSearchQ, setHomeSearchQ] = useState('');
  const router = useRouter();

  const handleHomeSearch = () => {
    if (homeSearchQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(homeSearchQ.trim())}`);
    }
  };

  const data = homeData;
  const flagshipPhones = data.featured.filter(p => p.pricePKR >= 150000).slice(0, 3);
  const budgetPhones = data.featured.filter(p => p.pricePKR <= 40000).slice(0, 3);

  const hasAnyPriceCategory = data.priceCategories.above100k.length > 0 ||
    data.priceCategories.price60to100.length > 0 ||
    data.priceCategories.price40to60.length > 0 ||
    data.priceCategories.price20to40.length > 0 ||
    data.priceCategories.under20k.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="relative">
          <div className="glass-orb glass-orb-cyan" />
          <div className="glass-orb glass-orb-yellow" />
          <div className="glass-page-bg max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-10 sm:space-y-14 relative z-10">
            {/* Hero */}
            <section className="hero-gradient hero-shimmer-effect rounded-3xl p-6 sm:p-8 lg:p-10 text-white relative overflow-hidden sky-glow">
              <div className="hero-particles">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="hero-particle" style={{ left: `${8 + (i * 7.5) % 85}%`, '--delay': `${i * 0.5}s`, '--duration': `${5 + (i % 4) * 1.5}s`, '--drift': `${(i % 2 === 0 ? 1 : -1) * (15 + i * 5)}px`, width: `${3 + (i % 3)}px`, height: `${3 + (i % 3)}px` } as React.CSSProperties} />
                ))}
              </div>
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl hero-glow-anim" />
              <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-cyan-400/15 rounded-full blur-3xl hero-glow-anim" style={{ animationDelay: '2s' }} />

              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-6">
                {/* Left side — 45% */}
                <div className="w-full lg:w-[45%]">
                  <div className="hero-badge-pop" style={{ animationDelay: '0.1s' }}>
                    <Badge className="bg-white/10 backdrop-blur-md text-white border border-white/20 mb-5 text-xs font-medium">
                      <Trophy className="w-3 h-3 mr-1" /> Pakistan&apos;s #1 Phone Database
                    </Badge>
                  </div>
                  <h1 className="hero-text-reveal font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight tracking-tight" style={{ animationDelay: '0.25s' }}>
                    Find Your Perfect <span className="text-blue-400 hero-float" style={{ display: 'inline-block', fontSize: '0.78em' }}>Smartphone</span>
                  </h1>
                  <p className="hero-animate text-gray-300/80 text-sm sm:text-base mb-6 leading-relaxed max-w-lg" style={{ animationDelay: '0.5s' }}>
                    Compare specs, check PTA status, read reviews, and find the best prices in Pakistan across all major brands.
                  </p>

                  <div className="hero-search-slide flex gap-2 max-w-xl" style={{ animationDelay: '0.7s' }}>
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input placeholder="Phone name, brand or chipset..." value={homeSearchQ} onChange={e => setHomeSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHomeSearch()} className="w-full pl-12 pr-4 h-12 text-sm rounded-xl bg-white/15 backdrop-blur-xl text-white outline-none focus:ring-2 focus:ring-blue-400/40 focus:bg-white/20 border border-white/10 placeholder:text-gray-400 transition-all" />
                    </div>
                    <button onClick={handleHomeSearch} className="glass-float text-white h-12 px-6 text-sm font-semibold flex items-center gap-2">
                      <Search className="w-4 h-4" /> Search
                    </button>
                  </div>

                  <div className="hero-animate flex flex-wrap gap-3 mt-6" style={{ animationDelay: '0.9s' }}>
                    <Button className="btn-glass text-white hover:bg-white/15 font-semibold h-10 px-5 border-white/20" onClick={() => router.push('/brands')}>
                      <Smartphone className="w-4 h-4 mr-2" /> Browse Phones
                    </Button>
                    <Button className="btn-glass text-white hover:bg-white/15 font-semibold h-10 px-5 border-white/20" onClick={() => router.push('/compare')}>
                      <TrendingUp className="w-4 h-4 mr-2" /> Compare
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-5 mt-6 text-xs sm:text-sm text-gray-300/70">
                    <span className="hero-feature-slide flex items-center gap-1.5" style={{ animationDelay: '1.1s' }}><Shield className="w-4 h-4 text-emerald-400" /> PTA Status</span>
                    <span className="hero-feature-slide flex items-center gap-1.5" style={{ animationDelay: '1.2s' }}><Tag className="w-4 h-4 text-blue-400" /> PKR Prices</span>
                    <span className="hero-feature-slide flex items-center gap-1.5" style={{ animationDelay: '1.3s' }}><Star className="w-4 h-4 text-amber-400" /> Expert Reviews</span>
                  </div>
                </div>

                {/* Right side — 55% Featured Phone Showcase */}
                <div className="w-full lg:w-[55%] h-[240px] sm:h-[280px] lg:h-[315px] flex-shrink-0">
                  {heroPhones.length > 0 ? (
                    <HeroPhoneShowcase phones={heroPhones} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Featured Phones */}
            <PhoneSection phones={data.featured} title="Featured Phones" icon={Star} link="/phones" linkText="All Phones" showEmpty />

            {/* Phones by Price */}
            {hasAnyPriceCategory && (
              <section className="space-y-5">
                <SectionHeader title="Phones by Price" icon={Tag} />
                <Tabs defaultValue={data.priceCategories.above100k.length > 0 ? 'above100k' : data.priceCategories.price60to100.length > 0 ? 'price60to100' : data.priceCategories.price40to60.length > 0 ? 'price40to60' : data.priceCategories.price20to40.length > 0 ? 'price20to40' : 'under20k'} className="w-full">
                  <TabsList className="glass-filter h-auto flex flex-wrap gap-1.5 p-1.5 rounded-2xl">
                    {[
                      { key: 'above100k', label: 'Above 100K', phones: data.priceCategories.above100k },
                      { key: 'price60to100', label: '60K-100K', phones: data.priceCategories.price60to100 },
                      { key: 'price40to60', label: '40K-60K', phones: data.priceCategories.price40to60 },
                      { key: 'price20to40', label: '20K-40K', phones: data.priceCategories.price20to40 },
                      { key: 'under20k', label: 'Under 20K', phones: data.priceCategories.under20k },
                    ].filter(t => t.phones.length > 0).map(tab => (
                      <TabsTrigger key={tab.key} value={tab.key} className="text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl">{tab.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  {[
                    { key: 'above100k', phones: data.priceCategories.above100k },
                    { key: 'price60to100', phones: data.priceCategories.price60to100 },
                    { key: 'price40to60', phones: data.priceCategories.price40to60 },
                    { key: 'price20to40', phones: data.priceCategories.price20to40 },
                    { key: 'under20k', phones: data.priceCategories.under20k },
                  ].filter(t => t.phones.length > 0).map(({ key, phones }) => (
                    <TabsContent key={key} value={key}>
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:overflow-visible">
                        {phones.map((p: Phone) => (
                          <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto"><PhoneCard phone={p} /></div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </section>
            )}

            {/* Trending Now */}
            <PhoneSection phones={data.trending} title="Trending Now" icon={TrendingUp} link="/phones" linkText="All Phones" showEmpty />

            {/* Popular Brands */}
            <BrandsGrid brands={data.brands} />

            {/* Best in Category */}
            <section className="space-y-5">
              <SectionHeader title="Best in Category" icon={Trophy} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { phones: data.bestCamera, title: 'Best Camera Phones', icon: Camera, gradient: 'from-blue-500 to-cyan-500' },
                  { phones: data.bestGaming, title: 'Best Gaming Phones', icon: Cpu, gradient: 'from-violet-500 to-purple-600' },
                  { phones: data.bestBattery, title: 'Best Battery Phones', icon: Battery, gradient: 'from-emerald-500 to-green-600' },
                  { phones: flagshipPhones, title: 'Flagship Phones', icon: Star, gradient: 'from-amber-500 to-orange-500' },
                  { phones: budgetPhones, title: 'Budget Phones', icon: Tag, gradient: 'from-green-500 to-emerald-600' },
                  { phones: data.upcoming, title: 'Upcoming Phones', icon: Clock, gradient: 'from-indigo-500 to-violet-600' },
                ].map(cat => (
                  <div key={cat.title} className="card-premium overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
                    <div className={`bg-gradient-to-br ${cat.gradient} p-4 text-white`}>
                      <div className="flex items-center gap-2"><cat.icon className="w-5 h-5" /><h3 className="font-bold text-sm">{cat.title}</h3></div>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {cat.phones.length > 0 ? cat.phones.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -m-1 transition-colors" onClick={() => router.push(`/phones/${p.slug}`)}>
                          <span className="text-xs font-bold text-gray-300 w-5 text-center">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-muted-foreground">{p.brand?.name}</p>
                            <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
                          </div>
                          <p className="text-xs font-bold text-blue-600">{formatPrice(p.pricePKR)}</p>
                        </div>
                      )) : (
                        <div className="text-center py-5 text-xs text-muted-foreground">No phones yet</div>
                      )}
                      {cat.phones.length > 0 && (
                        <Link href="/phones" className="flex items-center justify-center gap-1 text-xs text-blue-500 font-medium pt-2 hover:text-blue-600 transition-colors">
                          See all <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Latest Additions */}
            <PhoneSection phones={data.latest} title="Latest Additions" icon={Clock} link="/phones" linkText="All Phones" showEmpty />

            {/* Latest News */}
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

            {/* Sponsor Banner */}
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

            {/* Trust Section */}
            <TrustSection />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}