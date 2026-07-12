'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  Search, Star, ChevronRight, ChevronDown, Menu, X, Shield, Zap, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, ArrowUpRight, Phone, Smartphone, BarChart3, Users, Newspaper, Settings,
  LogOut, Plus, Trash2, Edit, Eye, Sun, Moon, Home, GitCompare, Layers, Heart, Check,
  ChevronLeft, Minus, Filter, SlidersHorizontal, Play, ExternalLink, Tag, Package,
  Monitor, Wifi, Bluetooth, Fingerprint, Cpu as Chip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============ TYPES ============
interface Brand { id: string; name: string; slug: string; logo: string; country: string; description: string; _count?: { phones: number } }
interface PhoneSpecs { display?: string; displayType?: string; resolution?: string; refreshRate?: string; protection?: string; brightness?: string; chipset?: string; cpu?: string; gpu?: string; process?: string; ram?: string; ramType?: string; storage?: string; cardSlot?: string; mainCamera?: string; mainCameraSensor?: string; aperture?: string; ois?: string; eis?: string; ultrawide?: string; telephoto?: string; zoom?: string; cameraFeatures?: string; videoRecording?: string; selfieCamera?: string; selfieSensor?: string; selfieVideo?: string; battery?: string; charging?: string; chargingSpeed?: string; wirelessCharge?: string; wirelessSpeed?: string; reverseCharge?: string; weight?: string; dimensions?: string; build?: string; sim?: string; ipRating?: string; network?: string; fiveG?: string; wifi?: string; bluetooth?: string; nfc?: string; usb?: string; fingerprint?: string; faceUnlock?: string; sensors?: string; colors?: string; os?: string; osVersion?: string; osUI?: string; updatePolicy?: string; specialFeatures?: string; }
interface PhoneBenchmark { antutu: number; geekbenchSingle: number; geekbenchMulti: number; gamingScore: number; pubgFps?: string; codMobileFps?: string; genshinFps?: string; videoPlayback?: string; gamingBattery?: string; browsingBattery?: string; }
interface PhoneImage { id: string; url: string; altText: string; sortOrder: number; }
interface PhonePrice { id: string; storeName: string; price: number; url: string; inStock: boolean; }
interface Phone { id: string; brandId: string; modelName: string; slug: string; releaseDate: string; pricePKR: number; ptaStatus: string; ptaApproved: boolean; featured: boolean; trending: boolean; upcoming: boolean; thumbnail: string; description: string; cameraScore: number; performanceScore: number; batteryScore: number; displayScore: number; valueScore: number; overallRating: number; pros: string; cons: string; reviewSummary: string; reviewVerdict: string; brand?: Brand; specs?: PhoneSpecs | null; benchmarks?: PhoneBenchmark | null; images?: PhoneImage[]; prices?: PhonePrice[]; }
interface NewsItem { id: string; title: string; slug: string; content: string; excerpt: string; category: string; image: string; author: string; published: boolean; featured: boolean; createdAt: string; }
interface HomeData { featured: Phone[]; trending: Phone[]; upcoming: Phone[]; bestCamera: Phone[]; bestGaming: Phone[]; bestBattery: Phone[]; latest: Phone[]; news: NewsItem[]; priceCategories: { under20k: Phone[]; price20to40: Phone[]; price40to60: Phone[]; price60to100: Phone[]; above100k: Phone[]; }; }
interface AdminUser { id: string; email: string; name: string; role: string; }

// ============ ROUTER ============
type View = 'home' | 'phone' | 'compare' | 'brand' | 'search' | 'brands' | 'news' | 'admin' | 'admin-login' | 'admin-phones' | 'admin-brands' | 'admin-news' | 'admin-dashboard';

function useHashRouter() {
  const [view, setView] = useState<View>('home');
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.slice(1) || '/';
      const parts = hash.split('/').filter(Boolean);
      if (parts.length === 0) { setView('home'); setParams({}); return; }
      if (parts[0] === 'phone' && parts[1]) { setView('phone'); setParams({ slug: parts[1] }); return; }
      if (parts[0] === 'compare') { setView('compare'); setParams(Object.fromEntries(new URLSearchParams(parts.slice(1).join('/')))); return; }
      if (parts[0] === 'brand' && parts[1]) { setView('brand'); setParams({ slug: parts[1] }); return; }
      if (parts[0] === 'search') { setView('search'); setParams({ q: parts.slice(1).join('/') }); return; }
      if (parts[0] === 'brands') { setView('brands'); setParams({}); return; }
      if (parts[0] === 'news') { setView('news'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'login') { setView('admin-login'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'phones') { setView('admin-phones'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'brands') { setView('admin-brands'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'news') { setView('admin-news'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'dashboard') { setView('admin-dashboard'); setParams({}); return; }
      if (parts[0] === 'admin') { setView('admin'); setParams({}); return; }
      setView('home'); setParams({});
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { view, params, navigate };
}

// ============ HELPERS ============
function formatPrice(price: number): string {
  return 'PKR ' + price.toLocaleString('en-PK');
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full bg-yellow-400" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function PhoneCard({ phone, onSelect }: { phone: Phone; onSelect?: (id: string) => void }) {
  const nav = () => { if (onSelect) onSelect(phone.id); else window.location.hash = `/phone/${phone.slug}`; };
  return (
    <Card className="phone-card cursor-pointer border hover:border-yellow-400/50 group" onClick={nav}>
      <CardContent className="p-3 sm:p-4">
        <div className="relative aspect-square bg-gray-50 dark:bg-gray-800 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
          {phone.thumbnail ? (
            <Image src={phone.thumbnail} alt={phone.modelName} width={200} height={200} className="object-contain p-4 group-hover:scale-105 transition-transform duration-300" unoptimized />
          ) : (
            <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600" />
          )}
          {phone.ptaApproved && (
            <Badge className="absolute top-2 left-2 text-[10px] pta-approved"><Shield className="w-3 h-3 mr-0.5" /> PTA</Badge>
          )}
          {phone.overallRating >= 9 && (
            <Badge className="absolute top-2 right-2 bg-yellow-400 text-black text-[10px]"><Star className="w-3 h-3 mr-0.5 fill-current" /> {phone.overallRating}</Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{phone.brand?.name}</p>
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{phone.modelName}</h3>
          <div className="flex items-center justify-between pt-1">
            <p className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">{formatPrice(phone.pricePKR)}</p>
            {phone.trending && <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Trending</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhoneCardSkeleton() {
  return (
    <Card><CardContent className="p-4">
      <Skeleton className="aspect-square rounded-lg mb-3" />
      <Skeleton className="h-3 w-16 mb-1" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-3 w-24 mb-1" />
      <Skeleton className="h-4 w-20" />
    </CardContent></Card>
  );
}

function SectionHeader({ title, icon: Icon, link, linkText }: { title: string; icon: React.ElementType; link?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-yellow-400 rounded-full" />
        <h2 className="text-lg sm:text-xl font-bold section-title">{title}</h2>
      </div>
      {link && <Button variant="ghost" size="sm" className="text-yellow-600 dark:text-yellow-400" onClick={() => { window.location.hash = link; }}>
        {linkText || 'View All'} <ChevronRight className="w-4 h-4" />
      </Button>}
    </div>
  );
}

// ============ HEADER ============
function Header({ onNavigate, onSearch, theme, toggleTheme }: { onNavigate: (p: string) => void; onSearch: (q: string) => void; theme: string; toggleTheme: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const doSearch = () => { if (searchQ.trim()) { onSearch(searchQ.trim()); setSearchOpen(false); setSearchQ(''); } };
  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-black" />
            </div>
            <span className="font-extrabold text-lg hidden sm:block">Phone<span className="text-yellow-500">Dock</span></span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Home', hash: '/' }, { label: 'Brands', hash: '/brands' },
              { label: 'Compare', hash: '/compare' }, { label: 'News', hash: '/news' },
            ].map(item => (
              <button key={item.hash} onClick={() => onNavigate(item.hash)} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <TooltipProvider><Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)}><Search className="w-5 h-5" /></Button></TooltipTrigger>
              <TooltipContent>Search</TooltipContent>
            </Tooltip></TooltipProvider>
            <TooltipProvider><Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme}><Sun className="w-5 h-5 hidden dark:block" /><Moon className="w-5 h-5 dark:hidden" /></Button></TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip></TooltipProvider>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="pb-3 flex gap-2 animate-in slide-in-from-top-2 duration-200">
            <Input ref={searchRef} placeholder="Search phones, brands, processors..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} className="flex-1" autoFocus />
            <Button onClick={doSearch} className="bg-yellow-400 text-black hover:bg-yellow-300">Search</Button>
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 animate-in slide-in-from-top-2">
          <nav className="flex flex-col p-4 gap-1">
            {[
              { label: 'Home', hash: '/', icon: Home }, { label: 'Brands', hash: '/brands', icon: Layers },
              { label: 'Compare', hash: '/compare', icon: GitCompare }, { label: 'News', hash: '/news', icon: Newspaper },
              { label: 'Admin', hash: '/admin/login', icon: Settings },
            ].map(item => (
              <button key={item.hash} onClick={() => { onNavigate(item.hash); setMobileOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <item.icon className="w-4 h-4" />{item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

// ============ FOOTER ============
function Footer({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <footer className="bg-gray-950 text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center"><Smartphone className="w-5 h-5 text-black" /></div>
              <span className="font-extrabold text-lg text-white">Phone<span className="text-yellow-400">Dock</span></span>
            </div>
            <p className="text-sm leading-relaxed">Pakistan&apos;s #1 smartphone database. Compare specs, prices, and find your perfect phone.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Popular Brands</h4>
            <div className="space-y-2 text-sm">
              {['Samsung', 'Apple', 'Xiaomi', 'OnePlus', 'Vivo', 'Oppo'].map(b => (
                <button key={b} onClick={() => onNavigate(`/brand/${b.toLowerCase()}`)} className="block hover:text-yellow-400 transition-colors">{b}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Quick Links</h4>
            <div className="space-y-2 text-sm">
              {[{ l: 'Home', h: '/' }, { l: 'Compare', h: '/compare' }, { l: 'News', h: '/news' }, { l: 'Admin', h: '/admin/login' }].map(item => (
                <button key={item.h} onClick={() => onNavigate(item.h)} className="block hover:text-yellow-400 transition-colors">{item.l}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Price Ranges (PKR)</h4>
            <div className="space-y-2 text-sm">
              {['Under 20,000', '20K - 40K', '40K - 60K', '60K - 100K', 'Above 100K'].map(r => (
                <span key={r} className="block">{r}</span>
              ))}
            </div>
          </div>
        </div>
        <Separator className="bg-gray-800 mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p>&copy; 2025 PhoneDock. All rights reserved. Made for Pakistan.</p>
          <p className="text-yellow-400 font-medium">Phone prices may vary. Check with retailers.</p>
        </div>
      </div>
    </footer>
  );
}

// ============ PHONE SECTION (reusable) ============
function PhoneSection({ phones, title, icon: Icon, link, linkText }: { phones: Phone[]; title: string; icon: React.ElementType; link?: string; linkText?: string }) {
  if (!phones.length) return null;
  return (
    <section className="space-y-4">
      <SectionHeader title={title} icon={Icon} link={link} linkText={linkText} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {phones.map(p => <PhoneCard key={p.id} phone={p} />)}
      </div>
    </section>
  );
}

// ============ HOME PAGE ============
function HomePage({ data, loading, onNavigate }: { data: HomeData | null; loading: boolean; onNavigate: (p: string) => void }) {
  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        <Skeleton className="h-64 sm:h-80 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array(8).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-8 sm:space-y-10">
      {/* Hero */}
      <section className="hero-gradient rounded-2xl p-6 sm:p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-yellow-400 text-black mb-4">Pakistan&apos;s #1 Phone Database</Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3 leading-tight">
            Find Your Perfect <span className="text-yellow-400">Smartphone</span>
          </h1>
          <p className="text-gray-300 text-sm sm:text-base mb-6 leading-relaxed">Compare specs, check PTA status, read reviews, and find the best prices in Pakistan across all major brands.</p>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold" onClick={() => onNavigate('/brands')}>
              <Smartphone className="w-4 h-4 mr-2" /> Browse Phones
            </Button>
            <Button variant="outline" className="border-gray-600 text-white hover:bg-white/10" onClick={() => onNavigate('/compare')}>
              <GitCompare className="w-4 h-4 mr-2" /> Compare
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 mt-6 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-green-400" /> PTA Status</span>
            <span className="flex items-center gap-1"><Tag className="w-4 h-4 text-yellow-400" /> PKR Prices</span>
            <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400" /> Expert Reviews</span>
          </div>
        </div>
      </section>

      {/* Featured Phones */}
      <PhoneSection phones={data.featured} title="Featured Phones" icon={Star} />

      {/* Price Categories */}
      {data.priceCategories.above100k.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Phones by Price" icon={Tag} />
          <Tabs defaultValue="above100k" className="w-full">
            <TabsList className="h-auto flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              {[
                { key: 'above100k', label: 'Above 100K' }, { key: 'price60to100', label: '60K-100K' },
                { key: 'price40to60', label: '40K-60K' }, { key: 'price20to40', label: '20K-40K' },
                { key: 'under20k', label: 'Under 20K' },
              ].map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs sm:text-sm data-[state=active]:bg-yellow-400 data-[state=active]:text-black">{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {['above100k', 'price60to100', 'price40to60', 'price20to40', 'under20k'].map(key => (
              <TabsContent key={key} value={key}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {(data.priceCategories as Record<string, Phone[]>)[key]?.length > 0 ? (data.priceCategories as Record<string, Phone[]>)[key].map((p: Phone) => <PhoneCard key={p.id} phone={p} />) : (
                    <div className="col-span-full text-center py-10 text-muted-foreground"><Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No phones in this range yet</p></div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      )}

      {/* Trending */}
      <PhoneSection phones={data.trending} title="Trending Now" icon={TrendingUp} link="/brands" linkText="All Phones" />

      {/* Best categories */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { phones: data.bestCamera, title: 'Best Camera Phones', icon: Camera, color: 'from-purple-500 to-indigo-600' },
          { phones: data.bestGaming, title: 'Best Gaming Phones', icon: Cpu, color: 'from-red-500 to-orange-600' },
          { phones: data.bestBattery, title: 'Best Battery Phones', icon: Battery, color: 'from-green-500 to-emerald-600' },
        ].map(cat => (
          <Card key={cat.title} className="overflow-hidden border-0 shadow-lg">
            <div className={`bg-gradient-to-br ${cat.color} p-4 text-white`}>
              <div className="flex items-center gap-2 mb-1"><cat.icon className="w-5 h-5" /><h3 className="font-bold text-sm">{cat.title}</h3></div>
            </div>
            <CardContent className="p-3 space-y-2">
              {cat.phones.slice(0, 3).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-1.5 -m-1.5" onClick={() => onNavigate(`/phone/${p.slug}`)}>
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{p.brand?.name}</p>
                    <p className="text-sm font-semibold truncate">{p.modelName}</p>
                  </div>
                  <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400">{formatPrice(p.pricePKR)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Latest */}
      <PhoneSection phones={data.latest} title="Latest Additions" icon={Clock} link="/brands" linkText="All Phones" />

      {/* News */}
      {data.news.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Latest News" icon={Newspaper} link="/news" linkText="All News" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.news.map(n => (
              <Card key={n.id} className="cursor-pointer phone-card border hover:border-yellow-400/50" onClick={() => onNavigate('/news')}>
                <CardContent className="p-4">
                  <Badge variant="secondary" className="text-[10px] mb-2">{n.category}</Badge>
                  <h3 className="font-semibold text-sm line-clamp-2 mb-2">{n.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {data.upcoming.length > 0 && <PhoneSection phones={data.upcoming} title="Upcoming Phones" icon={Clock} />}
    </div>
  );
}

// ============ PHONE DETAIL PAGE ============
function PhoneDetailPage({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  const [data, setData] = useState<{ phone: Phone; related: Phone[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs');

  useEffect(() => { let cancelled = false; fetch(`/api/phones/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [slug]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><Skeleton className="h-96 rounded-2xl" /><div className="mt-6 space-y-4">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div></div>;
  if (!data?.phone) return <div className="max-w-7xl mx-auto px-4 py-20 text-center"><Smartphone className="w-16 h-16 mx-auto text-gray-300 mb-4" /><h2 className="text-xl font-bold">Phone not found</h2><Button variant="outline" className="mt-4" onClick={() => onNavigate('/')}>Go Home</Button></div>;

  const { phone, related } = data;
  const p = phone;

  const specGroups = [
    { title: 'Display & Design', icon: Monitor, specs: [
      { label: 'Display', value: p.specs?.display }, { label: 'Type', value: p.specs?.displayType }, { label: 'Resolution', value: p.specs?.resolution },
      { label: 'Refresh Rate', value: p.specs?.refreshRate }, { label: 'Protection', value: p.specs?.protection }, { label: 'Brightness', value: p.specs?.brightness },
      { label: 'Dimensions', value: p.specs?.dimensions }, { label: 'Weight', value: p.specs?.weight }, { label: 'Build', value: p.specs?.build },
      { label: 'Colors', value: p.specs?.colors }, { label: 'IP Rating', value: p.specs?.ipRating },
    ]},
    { title: 'Performance', icon: Cpu, specs: [
      { label: 'Chipset', value: p.specs?.chipset }, { label: 'CPU', value: p.specs?.cpu }, { label: 'GPU', value: p.specs?.gpu },
      { label: 'Process', value: p.specs?.process }, { label: 'RAM', value: p.specs?.ram }, { label: 'RAM Type', value: p.specs?.ramType },
      { label: 'Storage', value: p.specs?.storage }, { label: 'Card Slot', value: p.specs?.cardSlot },
    ]},
    { title: 'Camera', icon: Camera, specs: [
      { label: 'Main Camera', value: p.specs?.mainCamera }, { label: 'Sensor', value: p.specs?.mainCameraSensor }, { label: 'Aperture', value: p.specs?.aperture },
      { label: 'OIS', value: p.specs?.ois }, { label: 'EIS', value: p.specs?.eis }, { label: 'Ultrawide', value: p.specs?.ultrawide },
      { label: 'Telephoto', value: p.specs?.telephoto }, { label: 'Zoom', value: p.specs?.zoom }, { label: 'Features', value: p.specs?.cameraFeatures },
      { label: 'Video', value: p.specs?.videoRecording }, { label: 'Selfie', value: p.specs?.selfieCamera }, { label: 'Selfie Video', value: p.specs?.selfieVideo },
    ]},
    { title: 'Battery & Charging', icon: Battery, specs: [
      { label: 'Capacity', value: p.specs?.battery }, { label: 'Charging', value: p.specs?.charging }, { label: 'Charging Speed', value: p.specs?.chargingSpeed },
      { label: 'Wireless Charging', value: p.specs?.wirelessCharge }, { label: 'Wireless Speed', value: p.specs?.wirelessSpeed }, { label: 'Reverse Charge', value: p.specs?.reverseCharge },
    ]},
    { title: 'Connectivity', icon: Wifi, specs: [
      { label: 'Network', value: p.specs?.network }, { label: '5G', value: p.specs?.fiveG }, { label: 'WiFi', value: p.specs?.wifi },
      { label: 'Bluetooth', value: p.specs?.bluetooth }, { label: 'NFC', value: p.specs?.nfc }, { label: 'USB', value: p.specs?.usb },
      { label: 'SIM', value: p.specs?.sim },
    ]},
    { title: 'Features & OS', icon: Smartphone, specs: [
      { label: 'OS', value: `${p.specs?.os} ${p.specs?.osVersion}` }, { label: 'UI', value: p.specs?.osUI }, { label: 'Update Policy', value: p.specs?.updatePolicy },
      { label: 'Fingerprint', value: p.specs?.fingerprint }, { label: 'Face Unlock', value: p.specs?.faceUnlock }, { label: 'Sensors', value: p.specs?.sensors },
      { label: 'Special Features', value: p.specs?.specialFeatures },
    ]},
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap">
        <button onClick={() => onNavigate('/')} className="hover:text-yellow-600">Home</button>
        <ChevronRight className="w-3 h-3" />
        <button onClick={() => onNavigate(`/brand/${p.brand?.slug}`)} className="hover:text-yellow-600">{p.brand?.name}</button>
        <ChevronRight className="w-3 h-3" />
        <span className="font-medium text-foreground">{p.modelName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image + Quick Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 aspect-square flex items-center justify-center p-8">
              {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={300} height={300} className="object-contain" unoptimized /> : <Smartphone className="w-32 h-32 text-gray-300" />}
            </div>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price in Pakistan</span>
                <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{formatPrice(p.pricePKR)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">PTA Status</span>
                <Badge className={p.ptaApproved ? 'pta-approved' : 'pta-unknown'}>
                  <Shield className="w-3 h-3 mr-1" /> {p.ptaStatus}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Release Date</span>
                <span className="text-sm font-medium">{p.releaseDate ? new Date(p.releaseDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
              </div>
              {p.specs?.colors && <><Separator /><div><span className="text-sm text-muted-foreground">Colors</span><p className="text-sm mt-1">{p.specs.colors}</p></div></>}
              <Separator />
              <Button className="w-full bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => onNavigate(`/compare?ids=${p.id}`)}>
                <GitCompare className="w-4 h-4 mr-2" /> Add to Compare
              </Button>
            </CardContent>
          </Card>
          {/* Store prices */}
          {p.prices && p.prices.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Best Prices</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {p.prices.map(pr => (
                  <div key={pr.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div>
                      <p className="text-sm font-medium">{pr.storeName}</p>
                      <p className="text-[10px] text-green-600">{pr.inStock ? 'In Stock' : 'Out of Stock'}</p>
                    </div>
                    <span className="font-bold text-sm text-yellow-600 dark:text-yellow-400">{formatPrice(pr.price)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{p.brand?.name}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{p.modelName}</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{p.description}</p>
            {p.reviewVerdict && <Badge className="mt-2 bg-yellow-400 text-black"><Trophy className="w-3 h-3 mr-1" /> {p.reviewVerdict}</Badge>}
          </div>

          {/* Rating Scores */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">Ratings & Scores</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-2xl font-extrabold">{p.overallRating}</span>
                  <span className="text-sm text-muted-foreground">/ 10</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <ScoreBar score={p.performanceScore} label="Performance" />
                <ScoreBar score={p.cameraScore} label="Camera" />
                <ScoreBar score={p.batteryScore} label="Battery" />
                <ScoreBar score={p.displayScore} label="Display" />
                <ScoreBar score={p.valueScore} label="Value" />
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Specs / Benchmarks / Review */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <TabsTrigger value="specs" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-xs sm:text-sm">Specifications</TabsTrigger>
              <TabsTrigger value="benchmarks" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-xs sm:text-sm">Benchmarks</TabsTrigger>
              <TabsTrigger value="review" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-xs sm:text-sm">Review</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="mt-4 space-y-4">
              {specGroups.map(group => (
                <Card key={group.title}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><group.icon className="w-4 h-4 text-yellow-500" />{group.title}</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {group.specs.filter(s => s.value && s.value !== 'No' && s.value !== '').map(s => (
                        <div key={s.label} className="spec-row flex justify-between py-2.5 px-2 rounded text-sm">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-medium text-right max-w-[60%]">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="benchmarks" className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-6">
                  {p.benchmarks ? (<>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'AnTuTu', value: p.benchmarks.antutu.toLocaleString(), max: 2500000, color: 'bg-blue-500' },
                        { label: 'Geekbench Single', value: p.benchmarks.geekbenchSingle.toLocaleString(), max: 3500, color: 'bg-green-500' },
                        { label: 'Geekbench Multi', value: p.benchmarks.geekbenchMulti.toLocaleString(), max: 8000, color: 'bg-purple-500' },
                      ].map(b => (
                        <div key={b.label} className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                          <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
                          <p className="text-2xl font-extrabold">{b.value}</p>
                          <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${b.color} rounded-full`} style={{ width: `${Math.min((parseInt(b.value.replace(/,/g, '')) / b.max) * 100, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Gaming Performance</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'PUBG Mobile', value: p.benchmarks.pubgFps },
                          { label: 'COD Mobile', value: p.benchmarks.codMobileFps },
                          { label: 'Genshin Impact', value: p.benchmarks.genshinFps },
                        ].map(g => (
                          <div key={g.label} className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mt-1">{g.label}</p>
                            <p className="text-sm font-bold mt-0.5">{g.value || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Battery Tests</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Video Playback', value: p.benchmarks.videoPlayback },
                          { label: 'Gaming', value: p.benchmarks.gamingBattery },
                          { label: 'Browsing', value: p.benchmarks.browsingBattery },
                        ].map(b => (
                          <div key={b.label} className="p-3 rounded-lg border text-center">
                            <p className="text-xs text-muted-foreground mt-1">{b.label}</p>
                            <p className="text-sm font-bold mt-0.5">{b.value || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>) : <p className="text-muted-foreground text-center py-8">No benchmark data available</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="review" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  {p.reviewSummary && <p className="text-sm leading-relaxed">{p.reviewSummary}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {p.pros && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-green-700 dark:text-green-400 text-sm mb-2 flex items-center gap-1"><Check className="w-4 h-4" /> Pros</h4>
                        <ul className="space-y-1">{p.pros.split(',').map((pro, i) => <li key={i} className="text-sm text-green-600 dark:text-green-300 flex items-start gap-1"><Plus className="w-3 h-3 mt-1 shrink-0" />{pro.trim()}</li>)}</ul>
                      </div>
                    )}
                    {p.cons && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <h4 className="font-semibold text-red-700 dark:text-red-400 text-sm mb-2 flex items-center gap-1"><Minus className="w-4 h-4" /> Cons</h4>
                        <ul className="space-y-1">{p.cons.split(',').map((con, i) => <li key={i} className="text-sm text-red-600 dark:text-red-300 flex items-start gap-1"><Minus className="w-3 h-3 mt-1 shrink-0" />{con.trim()}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Related Phones */}
          {related.length > 0 && (
            <section className="space-y-4 pt-4">
              <SectionHeader title={`More from ${p.brand?.name}`} icon={Smartphone} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{related.slice(0, 6).map(r => <PhoneCard key={r.id} phone={r} />)}</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ COMPARE PAGE ============
function ComparePage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [allPhones, setAllPhones] = useState<Phone[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showPicker, setShowPicker] = useState(true);

  useEffect(() => { fetch('/api/phones?limit=50').then(r => r.json()).then(d => setAllPhones(d.phones || [])); }, []);

  const doCompare = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    setShowPicker(false);
    try {
      const res = await fetch(`/api/compare?ids=${selectedIds.join(',')}`);
      const d = await res.json();
      setCompareData(d.phones || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  const addToCompare = (id: string) => {
    if (selectedIds.includes(id)) { setSelectedIds(selectedIds.filter(x => x !== id)); }
    else if (selectedIds.length < 4) { setSelectedIds([...selectedIds, id]); }
  };

  const getWinner = (field: 'cameraScore' | 'performanceScore' | 'batteryScore' | 'valueScore' | 'overallRating') => {
    if (compareData.length < 2) return null;
    const maxVal = Math.max(...compareData.map(p => p[field]));
    return compareData.findIndex(p => p[field] === maxVal);
  };

  const specRows = [
    { label: 'Display', key: 'display' }, { label: 'Resolution', key: 'resolution' }, { label: 'Refresh Rate', key: 'refreshRate' },
    { label: 'Chipset', key: 'chipset' }, { label: 'CPU', key: 'cpu' }, { label: 'RAM', key: 'ram' }, { label: 'Storage', key: 'storage' },
    { label: 'Main Camera', key: 'mainCamera' }, { label: 'Selfie', key: 'selfieCamera' }, { label: 'Video', key: 'videoRecording' },
    { label: 'Battery', key: 'battery' }, { label: 'Charging', key: 'charging' }, { label: 'Wireless', key: 'wirelessCharge' },
    { label: '5G', key: 'fiveG' }, { label: 'WiFi', key: 'wifi' }, { label: 'Bluetooth', key: 'bluetooth' },
    { label: 'NFC', key: 'nfc' }, { label: 'Fingerprint', key: 'fingerprint' }, { label: 'IP Rating', key: 'ipRating' },
    { label: 'OS', key: 'os' }, { label: 'Weight', key: 'weight' },
  ];

  const filteredPhones = searchQ ? allPhones.filter(p => p.modelName.toLowerCase().includes(searchQ.toLowerCase()) || p.brand?.name.toLowerCase().includes(searchQ.toLowerCase())) : allPhones;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Compare Phones</h1>
          <p className="text-sm text-muted-foreground mt-1">Select 2-4 phones to compare specifications side by side</p>
        </div>
        {!showPicker && <Button variant="outline" onClick={() => { setShowPicker(true); setSelectedIds([]); setCompareData([]); }}>
          <Plus className="w-4 h-4 mr-2" /> New Compare
        </Button>}
      </div>

      {showPicker ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Search & Select Phones</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <Input placeholder="Search phones..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                {filteredPhones.slice(0, 20).map(p => (
                  <div key={p.id} onClick={() => addToCompare(p.id)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedIds.includes(p.id) ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0" style={{ borderColor: selectedIds.includes(p.id) ? '#FACC15' : '#d4d4d4', background: selectedIds.includes(p.id) ? '#FACC15' : 'transparent' }}>
                      {selectedIds.includes(p.id) && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.brand?.name} {p.modelName}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(p.pricePKR)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3">Selected ({selectedIds.length}/4)</h3>
                {selectedIds.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Select phones from the left panel</p>}
                <div className="space-y-2">
                  {selectedIds.map(id => {
                    const phone = allPhones.find(p => p.id === id);
                    if (!phone) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{phone.brand?.name} {phone.modelName}</p>
                          <p className="text-xs text-muted-foreground">{formatPrice(phone.pricePKR)}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addToCompare(id)}><X className="w-4 h-4" /></Button>
                      </div>
                    );
                  })}
                </div>
                <Button className="w-full mt-4 bg-yellow-400 text-black hover:bg-yellow-300" disabled={selectedIds.length < 2} onClick={doCompare}>
                  Compare {selectedIds.length} Phones
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-20"><Skeleton className="h-96 max-w-4xl mx-auto rounded-2xl" /></div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <div className="min-w-[600px]">
            {/* Header row */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `160px repeat(${compareData.length}, 1fr)` }}>
              <div />
              {compareData.map(p => (
                <div key={p.id} className="text-center">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-2">
                    {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={120} height={120} className="object-contain mx-auto" unoptimized /> : <Smartphone className="w-16 h-16 mx-auto text-gray-400" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.brand?.name}</p>
                  <p className="text-sm font-bold">{p.modelName}</p>
                  <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{formatPrice(p.pricePKR)}</p>
                  <Button variant="link" size="sm" className="text-xs text-yellow-600" onClick={() => onNavigate(`/phone/${p.slug}`)}>Full Specs <ExternalLink className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>

            {/* Scores */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="grid gap-2" style={{ gridTemplateColumns: `160px repeat(${compareData.length}, 1fr)` }}>
                  {[{ label: 'Overall', key: 'overallRating' as const }, { label: 'Camera', key: 'cameraScore' as const }, { label: 'Performance', key: 'performanceScore' as const }, { label: 'Battery', key: 'batteryScore' as const }, { label: 'Value', key: 'valueScore' as const }].map(row => {
                    const winner = getWinner(row.key);
                    return (
                      <React.Fragment key={row.label}>
                        <div className="text-sm font-medium py-2 flex items-center">{row.label}</div>
                        {compareData.map((p, i) => (
                          <div key={p.id} className={`text-center py-2 rounded-lg text-sm font-bold ${winner === i ? 'winner-cell' : ''}`}>
                            {p[row.key]}{row.key === 'overallRating' ? '/10' : '/100'}
                            {winner === i && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Specs comparison */}
            <Card>
              <CardContent className="p-3">
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `160px repeat(${compareData.length}, 1fr)` }}>
                  {specRows.map(row => (
                    <React.Fragment key={row.label}>
                      <div className="spec-row text-xs font-medium py-2 px-2 text-muted-foreground">{row.label}</div>
                      {compareData.map(p => {
                        const val = (p.specs as Record<string, string | undefined>)?.[row.key] || '-';
                        return <div key={p.id} className="spec-row text-xs py-2 px-2 text-center">{val}</div>;
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ BRANDS PAGE ============
function BrandsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/brands').then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }); }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div><h1 className="text-2xl font-extrabold">All Brands</h1><p className="text-sm text-muted-foreground mt-1">Browse smartphones by manufacturer</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brands.map(b => (
          <Card key={b.id} className="cursor-pointer phone-card border hover:border-yellow-400/50" onClick={() => onNavigate(`/brand/${b.slug}`)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6 text-gray-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{b.name}</h3>
                <p className="text-xs text-muted-foreground">{b._count?.phones || 0} phones</p>
                <p className="text-[10px] text-muted-foreground">{b.country}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ BRAND DETAIL PAGE ============
function BrandDetailPage({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  const [brand, setBrand] = useState<Brand & { phones: Phone[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let cancelled = false; fetch(`/api/brands/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setBrand(d.brand); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [slug]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6">{Array(6).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div>;
  if (!brand) return <div className="max-w-7xl mx-auto px-4 py-20 text-center"><h2 className="text-xl font-bold">Brand not found</h2><Button className="mt-4" onClick={() => onNavigate('/brands')}>All Brands</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => onNavigate('/')} className="hover:text-yellow-600">Home</button><ChevronRight className="w-3 h-3" />
        <button onClick={() => onNavigate('/brands')} className="hover:text-yellow-600">Brands</button><ChevronRight className="w-3 h-3" />
        <span className="font-medium text-foreground">{brand.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center"><Smartphone className="w-8 h-8 text-gray-400" /></div>
        <div>
          <h1 className="text-2xl font-extrabold">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.country} &middot; {brand.phones.length} phones</p>
          {brand.description && <p className="text-sm text-muted-foreground mt-1">{brand.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brand.phones.map(p => <PhoneCard key={p.id} phone={p} />)}
      </div>
      {brand.phones.length === 0 && <div className="text-center py-16 text-muted-foreground"><Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No phones listed yet for this brand</p></div>}
    </div>
  );
}

// ============ SEARCH PAGE ============
function SearchPage({ query, onNavigate }: { query: string; onNavigate: (p: string) => void }) {
  const [results, setResults] = useState<{ phones: Phone[]; brands: Brand[]; total?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let cancelled = false; fetch(`/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { if (!cancelled) { setResults(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Search Results for &ldquo;{query}&rdquo;</h1>
        <p className="text-sm text-muted-foreground mt-1">{loading ? 'Searching...' : `${results?.total || 0} results found`}</p>
      </div>
      {results?.brands && results.brands.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Brands</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.brands.map(b => (
              <Card key={b.id} className="cursor-pointer" onClick={() => onNavigate(`/brand/${b.slug}`)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                  <div><p className="font-semibold text-sm">{b.name}</p><p className="text-xs text-muted-foreground">{b._count?.phones || 0} phones</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      {results?.phones && results.phones.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Phones</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.phones.map(p => <PhoneCard key={p.id} phone={p} />)}
          </div>
        </section>
      )}
      {!loading && results && results.phones.length === 0 && results.brands.length === 0 && (
        <div className="text-center py-16 text-muted-foreground"><Search className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No results found for &ldquo;{query}&rdquo;</p><Button variant="outline" className="mt-4" onClick={() => onNavigate('/')}>Browse All Phones</Button></div>
      )}
    </div>
  );
}

// ============ NEWS PAGE ============
function NewsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/news').then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }); }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div><h1 className="text-2xl font-extrabold">Latest News</h1><p className="text-sm text-muted-foreground mt-1">Stay updated with the latest smartphone news from Pakistan and around the world</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {news.map(n => (
          <Card key={n.id} className="overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <h2 className="font-bold text-lg leading-tight">{n.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{n.excerpt}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{n.content}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3 h-3" />{n.author}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {news.length === 0 && <div className="text-center py-16 text-muted-foreground"><Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No news articles yet</p></div>}
    </div>
  );
}

// ============ ADMIN LOGIN ============
function AdminLoginPage({ onLogin }: { onLogin: (admin: AdminUser, token: string) => void }) {
  const [email, setEmail] = useState('admin@phonedock.pk');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.success) { onLogin(data.admin, data.token); window.location.hash = '/admin/dashboard'; }
      else { setError(data.error || 'Login failed'); }
    } catch { setError('Connection error'); }
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-2 border-yellow-400/30 yellow-glow">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3"><Shield className="w-7 h-7 text-black" /></div>
            <h1 className="text-2xl font-extrabold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage PhoneDock</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">Email</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><label className="text-sm font-medium mb-1 block">Password</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            <Button type="submit" className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-semibold" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
          </form>
          <p className="text-[10px] text-center text-muted-foreground mt-4">Demo: admin@phonedock.pk / admin123</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============
function AdminDashboard({ admin, onNavigate }: { admin: AdminUser; onNavigate: (p: string) => void }) {
  const [stats, setStats] = useState<{ totalPhones?: number; totalBrands?: number; trending?: number; featured?: number; avgPrice?: number } | null>(null);
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setStats); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {admin.name || admin.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { window.location.hash = '/'; }}><Eye className="w-4 h-4 mr-2" />View Site</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Phones', value: stats?.totalPhones || 0, icon: Smartphone, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
          { label: 'Brands', value: stats?.totalBrands || 0, icon: Layers, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
          { label: 'Trending', value: stats?.trending || 0, icon: TrendingUp, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
          { label: 'Featured', value: stats?.featured || 0, icon: Star, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <div><p className="text-2xl font-extrabold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="cursor-pointer phone-card" onClick={() => onNavigate('/admin/phones')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Smartphone className="w-5 h-5 text-purple-600" /></div>
            <div><p className="font-semibold text-sm">Manage Phones</p><p className="text-xs text-muted-foreground">Add, edit, delete phones</p></div>
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer phone-card" onClick={() => onNavigate('/admin/brands')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><Layers className="w-5 h-5 text-orange-600" /></div>
            <div><p className="font-semibold text-sm">Manage Brands</p><p className="text-xs text-muted-foreground">Add, edit, delete brands</p></div>
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer phone-card" onClick={() => onNavigate('/admin/news')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center"><Newspaper className="w-5 h-5 text-teal-600" /></div>
            <div><p className="font-semibold text-sm">Manage News</p><p className="text-xs text-muted-foreground">Add, edit, delete news</p></div>
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {stats?.avgPrice && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-1">Average Phone Price</h3>
            <p className="text-3xl font-extrabold text-yellow-600 dark:text-yellow-400">{formatPrice(Math.round(stats.avgPrice))}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ ADMIN PHONES ============
function AdminPhones({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/admin/phones', { headers: { Authorization: 'Bearer token' } }).then(r => r.json()).then(d => { setPhones(d.phones || []); setLoading(false); }); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/admin/dashboard')}><ChevronLeft className="w-4 h-4" /> Back</Button>
          <h1 className="text-xl font-extrabold">Manage Phones ({phones.length})</h1>
        </div>
        <Button className="bg-yellow-400 text-black hover:bg-yellow-300" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Phone</Button>
      </div>
      {loading ? <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-left p-3 font-medium">Brand</th>
                <th className="text-left p-3 font-medium">Price (PKR)</th>
                <th className="text-left p-3 font-medium">Rating</th>
                <th className="text-left p-3 font-medium">PTA</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {phones.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="p-3"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0">{p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={40} height={40} className="object-contain" unoptimized /> : <Smartphone className="w-5 h-5 text-gray-400" />}</div><span className="font-medium truncate max-w-[200px] block">{p.modelName}</span></div></td>
                    <td className="p-3 text-muted-foreground">{p.brand?.name}</td>
                    <td className="p-3 font-medium">{formatPrice(p.pricePKR)}</td>
                    <td className="p-3"><span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{p.overallRating}</span></td>
                    <td className="p-3"><Badge className={p.ptaApproved ? 'pta-approved text-[10px]' : 'pta-unknown text-[10px]'}>{p.ptaStatus}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onNavigate(`/phone/${p.slug}`)}><Eye className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ ADMIN BRANDS ============
function AdminBrands({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/brands').then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => onNavigate('/admin/dashboard')}><ChevronLeft className="w-4 h-4" /> Back</Button><h1 className="text-xl font-extrabold">Manage Brands ({brands.length})</h1></div>
        <Button className="bg-yellow-400 text-black hover:bg-yellow-300" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Brand</Button>
      </div>
      {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {brands.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center"><Smartphone className="w-6 h-6 text-gray-400" /></div>
                  <div><p className="font-semibold text-sm">{b.name}</p><p className="text-xs text-muted-foreground">{b.country} &middot; {b._count?.phones || 0} phones</p></div>
                </div>
                <div className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ ADMIN NEWS ============
function AdminNews({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/news?published=false').then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => onNavigate('/admin/dashboard')}><ChevronLeft className="w-4 h-4" /> Back</Button><h1 className="text-xl font-extrabold">Manage News ({news.length})</h1></div>
        <Button className="bg-yellow-400 text-black hover:bg-yellow-300" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Article</Button>
      </div>
      {loading ? <div className="space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div> : (
        <div className="space-y-2">
          {news.map(n => (
            <Card key={n.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1"><Badge variant="secondary" className="text-[10px]">{n.category}</Badge><Badge className={`text-[10px] ${n.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{n.published ? 'Published' : 'Draft'}</Badge></div>
                  <p className="font-semibold text-sm truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.author} &middot; {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 shrink-0"><Button size="icon" variant="ghost" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MAIN APP ============
export default function PhoneDockApp() {
  const { view, params, navigate } = useHashRouter();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('phonedock_admin');
    if (saved) { try { const a = JSON.parse(saved); return a.admin; } catch { return null; } }
    return null;
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('phonedock_admin');
    if (saved) { try { const a = JSON.parse(saved); return a.token; } catch { return null; } }
    return null;
  });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const savedTheme = localStorage.getItem('phonedock_theme');
    if (savedTheme) { queueMicrotask(() => setTheme(savedTheme)); }
  }, []);

  useEffect(() => {
    if (view === 'home') {
      let cancelled = false;
      fetch('/api/home').then(r => r.json()).then(d => { if (!cancelled) { setHomeData(d); setHomeLoading(false); } }).catch(() => { if (!cancelled) setHomeLoading(false); });
      return () => { cancelled = true; };
    }
  }, [view]);

  const handleLogin = (a: AdminUser, token: string) => {
    setAdmin(a); setAdminToken(token);
    localStorage.setItem('phonedock_admin', JSON.stringify({ admin: a, token }));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('phonedock_theme', newTheme);
  };

  const handleSearch = (q: string) => { navigate(`/search/${encodeURIComponent(q)}`); };
  const nav = (path: string) => { if (path === '/' || path === '') window.location.hash = '/'; else if (!path.startsWith('#')) window.location.hash = path; };

  const isAdminView = view.startsWith('admin');

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header onNavigate={nav} onSearch={handleSearch} theme={theme || 'light'} toggleTheme={toggleTheme} />

      <main className="flex-1">
        {view === 'home' && <HomePage data={homeData} loading={homeLoading} onNavigate={nav} />}
        {view === 'phone' && <PhoneDetailPage key={params.slug} slug={params.slug || ''} onNavigate={nav} />}
        {view === 'compare' && <ComparePage onNavigate={nav} />}
        {view === 'brands' && <BrandsPage onNavigate={nav} />}
        {view === 'brand' && <BrandDetailPage key={params.slug} slug={params.slug || ''} onNavigate={nav} />}
        {view === 'search' && <SearchPage key={params.q} query={params.q || ''} onNavigate={nav} />}
        {view === 'news' && <NewsPage onNavigate={nav} />}
        {view === 'admin-login' && <AdminLoginPage onLogin={handleLogin} />}
        {view === 'admin-dashboard' && admin && <AdminDashboard admin={admin} onNavigate={nav} />}
        {view === 'admin-phones' && admin && <AdminPhones onNavigate={nav} />}
        {view === 'admin-brands' && admin && <AdminBrands onNavigate={nav} />}
        {view === 'admin-news' && admin && <AdminNews onNavigate={nav} />}
        {view === 'admin' && !admin && <AdminLoginPage onLogin={handleLogin} />}
      </main>

      {!isAdminView && <Footer onNavigate={nav} />}
    </div>
  );
}