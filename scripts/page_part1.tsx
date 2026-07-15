'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  Search, Star, ChevronRight, ChevronDown, Menu, X, Shield, Zap, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, ArrowUpRight, Phone, Smartphone, BarChart3, Users, Newspaper, Settings,
  LogOut, Plus, Trash2, Edit, Eye, Sun, Moon, Home, GitCompare, Layers, Heart, Check,
  ChevronLeft, Minus, Filter, SlidersHorizontal, Play, ExternalLink, Tag, Package,
  Monitor, Wifi, Bluetooth, Fingerprint, Cpu as Chip, Image as ImageIcon, Activity, Star as StarIcon
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
interface Phone { id: string; modelName: string; slug: string; brandId: string; brand?: Brand; thumbnail: string; pricePKR: number; description: string; overallRating: number; cameraScore: number; performanceScore: number; batteryScore: number; displayScore: number; valueScore: number; ptaStatus: string; ptaApproved: boolean; releaseDate: string; trending: boolean; upcoming: boolean; featured: boolean; specs?: PhoneSpecs; benchmarks?: PhoneBenchmark; images?: PhoneImage[]; prices?: PhonePrice[]; pros?: string; cons?: string; reviewSummary?: string; reviewVerdict?: string; published?: boolean; }
interface NewsItem { id: string; title: string; slug: string; excerpt: string; content: string; category: string; author: string; imageUrl: string; published: boolean; createdAt: string; }
interface Sponsor { id: string; name: string; image: string; url: string; position: string; active: boolean; }
interface ActivityLog { id: string; action: string; details: string; entityType: string; createdAt: string; admin?: { name: string; email: string }; }
interface HomeData { featured: Phone[]; trending: Phone[]; latest: Phone[]; bestCamera: Phone[]; bestGaming: Phone[]; bestBattery: Phone[]; upcoming: Phone[]; news: NewsItem[]; priceCategories: { above100k: Phone[]; price60to100: Phone[]; price40to60: Phone[]; price20to40: Phone[]; under20k: Phone[] }; brands: Brand[]; sponsors?: Sponsor[]; }
interface AdminUser { id: string; email: string; name: string; role: string; }

// ============ ROUTER ============
type View = 'home' | 'phone' | 'compare' | 'brand' | 'search' | 'brands' | 'news' | 'admin' | 'admin-login' | 'admin-phones' | 'admin-brands' | 'admin-news' | 'admin-dashboard' | 'admin-sponsors' | 'admin-activity';

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
      if (parts[0] === 'admin' && parts[1] === 'sponsors') { setView('admin-sponsors'); setParams({}); return; }
      if (parts[0] === 'admin' && parts[1] === 'activity') { setView('admin-activity'); setParams({}); return; }
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

// ============ SCORE BAR ============
function ScoreBar({ score, label, mini }: { score: number; label: string; mini?: boolean }) {
  if (mini) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-bold w-8 text-right">{score}</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ============ PHONE CARD ============
function PhoneCard({ phone, onSelect }: { phone: Phone; onSelect?: (id: string) => void }) {
  const nav = () => { if (onSelect) onSelect(phone.id); else window.location.hash = `/phone/${phone.slug}`; };
  return (
    <div className="phone-card bg-white rounded-2xl border border-gray-100 cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/8 hover:border-blue-200" onClick={nav}>
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
    </div>
  );
}

// ============ PHONE CARD SKELETON ============
function PhoneCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="skeleton-shimmer aspect-square rounded-xl mb-3" />
        <div className="skeleton-shimmer h-3 w-16 mb-2 rounded-md" />
        <div className="skeleton-shimmer h-4 w-full mb-1.5 rounded-md" />
        <div className="skeleton-shimmer h-4 w-3/4 mb-2 rounded-md" />
        <div className="skeleton-shimmer h-3 w-20 mb-1 rounded-md" />
        <div className="skeleton-shimmer h-3 w-16 mb-3 rounded-md" />
        <div className="skeleton-shimmer h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ============ SECTION HEADER ============
function SectionHeader({ title, icon: Icon, link, linkText }: { title: string; icon: React.ElementType; link?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-blue-500" />}
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 relative">
          {title}
          <span className="absolute -bottom-1.5 left-0 h-[3px] w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
        </h2>
      </div>
      {link && (
        <button onClick={() => { window.location.hash = link; }} className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
          {linkText || 'View All'} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============ ADMIN SIDEBAR ============
function AdminSidebar({ admin, onNavigate, onLogout, currentView }: { admin: AdminUser; onNavigate: (p: string) => void; onLogout: () => void; currentView: string }) {
  const adminLinks = [
    { label: 'Dashboard', hash: '/admin/dashboard', icon: BarChart3, view: 'admin-dashboard' },
    { label: 'Phones', hash: '/admin/phones', icon: Smartphone, view: 'admin-phones' },
    { label: 'Brands', hash: '/admin/brands', icon: Layers, view: 'admin-brands' },
    { label: 'News', hash: '/admin/news', icon: Newspaper, view: 'admin-news' },
    { label: 'Sponsors', hash: '/admin/sponsors', icon: Star, view: 'admin-sponsors' },
    { label: 'Activity', hash: '/admin/activity', icon: Clock, view: 'admin-activity' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 min-h-[calc(100vh-3.5rem)] sticky top-14">
        <div className="p-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{admin.name || 'Admin'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{admin.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {adminLinks.map(link => {
            const isActive = currentView === link.view;
            return (
              <button key={link.hash} onClick={() => onNavigate(link.hash)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/10' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <link.icon className="w-4 h-4" />{link.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-50">
          <button onClick={() => onNavigate('/')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 mb-1">
            <Eye className="w-4 h-4" />View Site
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200">
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      {/* Mobile horizontal pill tabs */}
      <div className="lg:hidden border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-900">{admin.name || admin.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onNavigate('/')}><Eye className="w-3.5 h-3.5 mr-1" /><span className="text-xs hidden sm:inline">Site</span></Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={onLogout}><LogOut className="w-3.5 h-3.5 mr-1" /><span className="text-xs hidden sm:inline">Logout</span></Button>
          </div>
        </div>
        <div className="flex overflow-x-auto px-3 pb-2.5 gap-1.5 no-scrollbar">
          {adminLinks.map(link => {
            const isActive = currentView === link.view;
            return (
              <button key={link.hash} onClick={() => onNavigate(link.hash)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${isActive ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                <link.icon className="w-3 h-3" />{link.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ HEADER (LIQUID GLASS) ============
function Header({ onNavigate, onSearch, theme, toggleTheme, admin, onLogout }: { onNavigate: (p: string) => void; onSearch: (q: string) => void; theme: string; toggleTheme: () => void; admin: AdminUser | null; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [location?.hash]);

  const doSearch = () => { if (searchQ.trim()) { onSearch(searchQ.trim()); setSearchOpen(false); setSearchQ(''); } };

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/25">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-gray-900 hidden sm:block">Phone<span className="text-blue-500">Dock</span></span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Home', hash: '/' }, { label: 'Brands', hash: '/brands' },
              { label: 'Compare', hash: '/compare' }, { label: 'News', hash: '/news' },
            ].map(item => (
              <button key={item.hash} onClick={() => onNavigate(item.hash)} className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white/60 transition-all duration-200">
                {item.label}
              </button>
            ))}
            {admin ? (
              <button onClick={() => onNavigate('/admin/dashboard')} className="px-3.5 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50/80 transition-all duration-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />Dashboard
              </button>
            ) : (
              <button onClick={() => onNavigate('/admin/login')} className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white/60 transition-all duration-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200">
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && (
          <div className="pb-3 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input ref={searchRef} placeholder="Search phones, brands, processors..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm bg-white/70 backdrop-blur-md border border-white/50 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400 transition-all" autoFocus />
            </div>
            <button onClick={doSearch} className="bg-blue-500 hover:bg-blue-600 text-white h-11 px-5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25">
              Search
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden glass-modal border-t border-white/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <nav className="flex flex-col p-4 gap-1">
            {[
              { label: 'Home', hash: '/', icon: Home }, { label: 'Brands', hash: '/brands', icon: Layers },
              { label: 'Compare', hash: '/compare', icon: GitCompare }, { label: 'News', hash: '/news', icon: Newspaper },
            ].map(item => (
              <button key={item.hash} onClick={() => { onNavigate(item.hash); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-200">
                <item.icon className="w-4 h-4 text-gray-400" />{item.label}
              </button>
            ))}
            {admin ? (
              <button onClick={() => { onNavigate('/admin/dashboard'); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 bg-blue-50/80">
                <Shield className="w-4 h-4" />Dashboard
              </button>
            ) : (
              <button onClick={() => { onNavigate('/admin/login'); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-200">
                <Shield className="w-4 h-4 text-gray-400" />Admin
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

// ============ FOOTER ============
function Footer({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <footer className="bg-[#0F172A] text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-lg text-white">Phone<span className="text-blue-400">Dock</span></span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">Pakistan&apos;s #1 smartphone database. Compare specs, prices, and find your perfect phone.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Popular Brands</h4>
            <div className="space-y-2.5 text-sm">
              {['Samsung', 'Apple', 'Xiaomi', 'OnePlus', 'Vivo', 'Oppo'].map(b => (
                <button key={b} onClick={() => onNavigate(`/brand/${b.toLowerCase()}`)} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{b}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Quick Links</h4>
            <div className="space-y-2.5 text-sm">
              {[{ l: 'Home', h: '/' }, { l: 'Compare', h: '/compare' }, { l: 'News', h: '/news' }, { l: 'Best Camera', h: '/' }, { l: 'Best Gaming', h: '/' }, { l: 'Best Battery', h: '/' }].map(item => (
                <button key={item.l} onClick={() => onNavigate(item.h)} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{item.l}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Price Ranges (PKR)</h4>
            <div className="space-y-2.5 text-sm text-gray-500">
              {['Under 20,000', '20K - 40K', '40K - 60K', '60K - 100K', 'Above 100K'].map(r => (
                <span key={r} className="block">{r}</span>
              ))}
            </div>
          </div>
        </div>
        <Separator className="bg-gray-800 mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
          <p>&copy; 2025 PhoneDock. All rights reserved. Made for Pakistan.</p>
          <p className="text-cyan-400/80 font-medium">Phone prices may vary. Check with retailers.</p>
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

// ============ HOME PAGE ============
function HomePage({ data, loading, onNavigate }: { data: HomeData | null; loading: boolean; onNavigate: (p: string) => void }) {
  const [homeSearchQ, setHomeSearchQ] = useState('');

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        <div className="skeleton-shimmer h-72 sm:h-96 rounded-3xl" />
        <div className="skeleton-shimmer h-14 rounded-2xl max-w-2xl mx-auto" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array(8).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div>
      </div>
    );
  }

  const flagshipPhones = data.featured.filter(p => p.pricePKR >= 150000).slice(0, 3);
  const budgetPhones = data.featured.filter(p => p.pricePKR <= 40000).slice(0, 3);

  const handleHomeSearch = () => {
    if (homeSearchQ.trim()) {
      window.location.hash = `/search/${encodeURIComponent(homeSearchQ.trim())}`;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-10 sm:space-y-14">
      {/* Hero */}
      <section className="rounded-3xl p-8 sm:p-12 lg:p-16 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #2563EB 100%)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/15 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-cyan-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-white/10 backdrop-blur-md text-white border border-white/20 mb-5 text-xs font-medium">
            <Trophy className="w-3 h-3 mr-1" /> Pakistan&apos;s #1 Phone Database
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight tracking-tight">
            Find Your Perfect <span className="text-blue-400">Smartphone</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-8 leading-relaxed max-w-lg">Compare specs, check PTA status, read reviews, and find the best prices in Pakistan across all major brands.</p>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-white text-gray-900 hover:bg-gray-100 font-semibold rounded-xl h-11 px-6 shadow-lg shadow-white/10 transition-colors" onClick={() => onNavigate('/brands')}>
              <Smartphone className="w-4 h-4 mr-2" /> Browse Phones
            </Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-xl h-11 px-6 transition-colors" onClick={() => onNavigate('/compare')}>
              <GitCompare className="w-4 h-4 mr-2" /> Compare
            </Button>
          </div>
          <div className="flex flex-wrap gap-5 mt-8 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> PTA Status</span>
            <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-blue-400" /> PKR Prices</span>
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400" /> Expert Reviews</span>
          </div>
        </div>
      </section>

      {/* Glass Search Bar */}
      <section>
        <div className="relative max-w-2xl mx-auto -mt-8 z-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input placeholder="Search phones, brands, processors..." value={homeSearchQ} onChange={e => setHomeSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHomeSearch()} className="glass-search w-full pl-12 pr-4 h-14 text-base rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg shadow-black/5 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400 transition-all" />
            </div>
            <button onClick={handleHomeSearch} className="bg-blue-500 hover:bg-blue-600 text-white h-14 px-7 rounded-2xl text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Featured Phones */}
      <section className="space-y-4">
        <SectionHeader title="Featured Phones" icon={Star} link="/brands" linkText="All Phones" />
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
          {data.featured.slice(0, 8).map(p => (
            <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto">
              <PhoneCard phone={p} />
            </div>
          ))}
        </div>
      </section>

      {/* Phones by Price */}
      {data.priceCategories.above100k.length > 0 && (
        <section className="space-y-5">
          <SectionHeader title="Phones by Price" icon={Tag} />
          <Tabs defaultValue="above100k" className="w-full">
            <TabsList className="glass-filter h-auto flex flex-wrap gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
              {[
                { key: 'above100k', label: 'Above 100K' }, { key: 'price60to100', label: '60K-100K' },
                { key: 'price40to60', label: '40K-60K' }, { key: 'price20to40', label: '20K-40K' },
                { key: 'under20k', label: 'Under 20K' },
              ].map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl">{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {['above100k', 'price60to100', 'price40to60', 'price20to40', 'under20k'].map(key => (
              <TabsContent key={key} value={key}>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:overflow-visible">
                  {(data.priceCategories as Record<string, Phone[]>)[key]?.length > 0 ? (data.priceCategories as Record<string, Phone[]>)[key].map((p: Phone) => (
                    <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto"><PhoneCard phone={p} /></div>
                  )) : (
                    <div className="col-span-full text-center py-16 text-muted-foreground">
                      <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No phones in this range yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      )}

      {/* Trending Now */}
      <PhoneSection phones={data.trending} title="Trending Now" icon={TrendingUp} link="/brands" linkText="All Phones" />

      {/* Best in Category */}
      <section className="space-y-5">
        <SectionHeader title="Best in Category" icon={Trophy} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { phones: data.bestCamera, title: 'Best Camera Phones', icon: Camera, gradient: 'from-violet-500 to-purple-600' },
            { phones: data.bestGaming, title: 'Best Gaming Phones', icon: Cpu, gradient: 'from-blue-500 to-cyan-500' },
            { phones: data.bestBattery, title: 'Best Battery Phones', icon: Battery, gradient: 'from-emerald-500 to-green-600' },
            { phones: flagshipPhones, title: 'Flagship Phones', icon: Star, gradient: 'from-amber-500 to-orange-500' },
            { phones: budgetPhones, title: 'Budget Phones', icon: Tag, gradient: 'from-green-500 to-emerald-600' },
            { phones: data.upcoming, title: 'Upcoming Phones', icon: Clock, gradient: 'from-indigo-500 to-violet-600' },
          ].map(cat => (
            <div key={cat.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
              <div className={`bg-gradient-to-br ${cat.gradient} p-4 text-white`}>
                <div className="flex items-center gap-2"><cat.icon className="w-5 h-5" /><h3 className="font-bold text-sm">{cat.title}</h3></div>
              </div>
              <div className="p-3 space-y-1.5">
                {cat.phones.length > 0 ? cat.phones.slice(0, 3).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -m-1 transition-colors" onClick={() => onNavigate(`/phone/${p.slug}`)}>
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
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest Additions */}
      <PhoneSection phones={data.latest} title="Latest Additions" icon={Clock} link="/brands" linkText="All Phones" />

      {/* Latest News */}
      {data.news.length > 0 && (
        <section className="space-y-5">
          <SectionHeader title="Latest News" icon={Newspaper} link="/news" linkText="All News" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.news.slice(0, 4).map(n => (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300" onClick={() => onNavigate('/news')}>
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

      {/* Upcoming Phones */}
      {data.upcoming.length > 0 && <PhoneSection phones={data.upcoming} title="Upcoming Phones" icon={Clock} />}
    </div>
  );
}

// ============ PHONE DETAIL PAGE ============
function PhoneDetailPage({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  const [data, setData] = useState<{ phone: Phone; related: Phone[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/phones/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="skeleton-shimmer h-6 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="skeleton-shimmer aspect-square rounded-2xl" />
            <div className="skeleton-shimmer h-48 rounded-2xl" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-full rounded-lg" />
            <div className="skeleton-shimmer h-32 rounded-2xl" />
            <div className="skeleton-shimmer h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.phone) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <Smartphone className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Phone not found</h2>
        <p className="text-sm text-muted-foreground mt-2">The phone you&apos;re looking for doesn&apos;t exist.</p>
        <Button variant="outline" className="mt-6 rounded-xl" onClick={() => onNavigate('/')}>Go Home</Button>
      </div>
    );
  }

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
      { label: 'Fingerprint', value: p.specs?.fingerprint }, { label: 'Face Unlock', value: p.specs?.faceUnlock }, { label: 'Sensors', value: p.specs?.sensors },
    ]},
    { title: 'Features & OS', icon: Smartphone, specs: [
      { label: 'OS', value: `${p.specs?.os} ${p.specs?.osVersion}` }, { label: 'UI', value: p.specs?.osUI }, { label: 'Update Policy', value: p.specs?.updatePolicy },
      { label: 'Fingerprint', value: p.specs?.fingerprint }, { label: 'Face Unlock', value: p.specs?.faceUnlock }, { label: 'Sensors', value: p.specs?.sensors },
      { label: 'Special Features', value: p.specs?.specialFeatures },
    ]},
  ];

  const cameraTiles = [
    { label: 'Sensor', value: p.specs?.mainCameraSensor },
    { label: 'Aperture', value: p.specs?.aperture },
    { label: 'OIS', value: p.specs?.ois },
    { label: 'EIS', value: p.specs?.eis },
    { label: 'Zoom', value: p.specs?.zoom },
    { label: 'Video', value: p.specs?.videoRecording },
    { label: 'Features', value: p.specs?.cameraFeatures },
  ].filter(t => t.value && t.value !== 'No' && t.value !== '');

  const perfTiles = [
    { label: 'Process Node', value: p.specs?.process, span: '' },
    { label: 'Chipset', value: p.specs?.chipset, span: 'sm:col-span-2' },
    { label: 'CPU', value: p.specs?.cpu, span: 'sm:col-span-2' },
    { label: 'GPU', value: p.specs?.gpu, span: 'sm:col-span-2' },
    { label: 'RAM', value: p.specs?.ram, span: '' },
    { label: 'RAM Type', value: p.specs?.ramType, span: '' },
    { label: 'Storage', value: p.specs?.storage, span: '' },
  ].filter(t => t.value && t.value !== 'No' && t.value !== '');

  const batteryTiles = [
    { label: 'Capacity', value: p.specs?.battery },
    { label: 'Charging Speed', value: p.specs?.chargingSpeed },
    { label: 'Wireless Charging', value: p.specs?.wirelessCharge },
    { label: 'Wireless Speed', value: p.specs?.wirelessSpeed },
    { label: 'Reverse Charge', value: p.specs?.reverseCharge },
  ];
  if (p.benchmarks?.videoPlayback) batteryTiles.push({ label: 'Video Playback', value: p.benchmarks.videoPlayback });
  if (p.benchmarks?.gamingBattery) batteryTiles.push({ label: 'Gaming Battery', value: p.benchmarks.gamingBattery });
  if (p.benchmarks?.browsingBattery) batteryTiles.push({ label: 'Browsing Battery', value: p.benchmarks.browsingBattery });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 flex-wrap">
        <button onClick={() => onNavigate('/')} className="hover:text-blue-500 transition-colors">Home</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => onNavigate(`/brand/${p.brand?.slug}`)} className="hover:text-blue-500 transition-colors">{p.brand?.name}</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-gray-900">{p.modelName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Image Card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="bg-[#F8FAFC] aspect-square flex items-center justify-center p-8">
              {p.thumbnail ? (
                <Image src={p.thumbnail} alt={p.modelName} width={300} height={300} className="object-contain" unoptimized />
              ) : (
                <div className="w-32 h-32 rounded-3xl bg-gray-100 flex items-center justify-center">
                  <Smartphone className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price in Pakistan</span>
              <span className="text-xl font-bold text-blue-600">{formatPrice(p.pricePKR)}</span>
            </div>
            <Separator className="bg-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">PTA Status</span>
              <Badge className={p.ptaApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-medium' : 'bg-gray-100 text-gray-600 font-medium'}>
                <Shield className="w-3 h-3 mr-1" /> {p.ptaStatus}
              </Badge>
            </div>
            <Separator className="bg-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Release Date</span>
              <span className="text-sm font-medium text-gray-900">{p.releaseDate ? new Date(p.releaseDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
            </div>
            {p.specs?.colors && (
              <>
                <Separator className="bg-gray-100" />
                <div>
                  <span className="text-sm text-muted-foreground">Colors</span>
                  <p className="text-sm mt-1 font-medium text-gray-900">{p.specs.colors}</p>
                </div>
              </>
            )}
            <Separator className="bg-gray-100" />
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-11 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25" onClick={() => onNavigate(`/compare?ids=${p.id}`)}>
              <GitCompare className="w-4 h-4" /> Add to Compare
            </button>
          </div>

          {/* Store Prices */}
          {p.prices && p.prices.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Best Prices</h3>
              <div className="space-y-2">
                {p.prices.map(pr => (
                  <div key={pr.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC]">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pr.storeName}</p>
                      <p className="text-[10px] mt-0.5 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${pr.inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <span className={pr.inStock ? 'text-emerald-600' : 'text-red-500'}>{pr.inStock ? 'In Stock' : 'Out of Stock'}</span>
                      </p>
                    </div>
                    <span className="font-bold text-sm text-blue-600">{formatPrice(pr.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Content */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">{p.brand?.name}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">{p.modelName}</h1>
            {p.description && <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{p.description}</p>}
          </div>

          {/* Quick Verdict Card */}
          {p.reviewVerdict && (
            <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/25">
                      <div className="text-center">
                        <span className="text-xl font-extrabold">{p.overallRating}</span>
                        <span className="text-[10px] block opacity-70">/ 10</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Trophy className="w-4 h-4 text-blue-500" />
                        <h3 className="font-bold text-sm sm:text-base text-gray-900">Quick Verdict</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{p.reviewVerdict}</p>
                    </div>
                  </div>
                  <div className="sm:ml-auto sm:w-64 space-y-2">
                    <ScoreBar score={p.cameraScore} label="Camera" mini />
                    <ScoreBar score={p.performanceScore} label="Performance" mini />
                    <ScoreBar score={p.displayScore} label="Display" mini />
                    <ScoreBar score={p.batteryScore} label="Battery" mini />
                    <ScoreBar score={p.valueScore} label="Value" mini />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Camera Details */}
          {(p.specs?.mainCamera || p.specs?.mainCameraSensor) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Camera className="w-4 h-4 text-blue-600" /></div>
                Camera Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cameraTiles.map(tile => (
                  <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.label === 'Features' ? 'col-span-2 sm:col-span-3' : ''}`}>
                    <p className="text-xs text-muted-foreground">{tile.label}</p>
                    <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Section */}
          {(p.specs?.chipset || p.specs?.cpu) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Cpu className="w-4 h-4 text-blue-600" /></div>
                Performance
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {perfTiles.map(tile => (
                  <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.span}`}>
                    <p className="text-xs text-muted-foreground">{tile.label}</p>
                    <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Battery & Charging */}
          {p.specs?.battery && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Battery className="w-4 h-4 text-blue-600" /></div>
                Battery & Charging
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {batteryTiles.filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                  <div key={tile.label} className="p-3 rounded-xl bg-[#F8FAFC]">
                    <p className="text-xs text-muted-foreground">{tile.label}</p>
                    <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ratings & Scores */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Ratings & Scores</h3>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-2xl font-extrabold text-gray-900">{p.overallRating}</span>
                <span className="text-sm text-muted-foreground">/ 10</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <ScoreBar score={p.performanceScore} label="Performance" />
              <ScoreBar score={p.cameraScore} label="Camera" />
              <ScoreBar score={p.batteryScore} label="Battery" />
              <ScoreBar score={p.displayScore} label="Display" />
              <ScoreBar score={p.valueScore} label="Value" />
            </div>
          </div>

          {/* Tabs: Specs / Benchmarks / Review */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass-filter w-full justify-start bg-gray-100 rounded-2xl p-1.5 h-auto">
              <TabsTrigger value="specs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Specifications</TabsTrigger>
              <TabsTrigger value="benchmarks" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Benchmarks</TabsTrigger>
              <TabsTrigger value="review" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Review</TabsTrigger>
            </TabsList>

            {/* Specs Tab */}
            <TabsContent value="specs" className="mt-5 space-y-4">
              {specGroups.map(group => (
                <div key={group.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-50">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                      <group.icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                  </div>
                  <div className="divide-y divide-gray-50 px-4 py-1">
                    {group.specs.filter(s => s.value && s.value !== 'No' && s.value !== '').map(s => (
                      <div key={s.label} className="flex justify-between py-3 text-sm">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium text-right max-w-[60%] text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Benchmarks Tab */}
            <TabsContent value="benchmarks" className="mt-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-6">
                {p.benchmarks ? (<>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'AnTuTu', value: p.benchmarks.antutu.toLocaleString(), max: 2500000, color: 'from-blue-500 to-blue-600' },
                      { label: 'Geekbench Single', value: p.benchmarks.geekbenchSingle.toLocaleString(), max: 3500, color: 'from-emerald-500 to-green-600' },
                      { label: 'Geekbench Multi', value: p.benchmarks.geekbenchMulti.toLocaleString(), max: 8000, color: 'from-violet-500 to-purple-600' },
                    ].map(b => (
                      <div key={b.label} className="text-center p-5 rounded-2xl bg-[#F8FAFC] border border-gray-100">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">{b.label}</p>
                        <p className="text-3xl font-extrabold text-gray-900">{b.value}</p>
                        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${b.color} transition-all duration-700`} style={{ width: `${Math.min((parseInt(b.value.replace(/,/g, '')) / b.max) * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Gaming Performance</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'PUBG Mobile', value: p.benchmarks.pubgFps },
                        { label: 'COD Mobile', value: p.benchmarks.codMobileFps },
                        { label: 'Genshin Impact', value: p.benchmarks.genshinFps },
                      ].map(g => (
                        <div key={g.label} className="p-4 rounded-2xl border border-gray-100 text-center bg-white">
                          <p className="text-xs text-muted-foreground font-medium">{g.label}</p>
                          <p className="text-lg font-bold mt-1.5 text-gray-900">{g.value || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Battery Tests</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Video Playback', value: p.benchmarks.videoPlayback },
                        { label: 'Gaming', value: p.benchmarks.gamingBattery },
                        { label: 'Browsing', value: p.benchmarks.browsingBattery },
                      ].map(b => (
                        <div key={b.label} className="p-4 rounded-2xl border border-gray-100 text-center bg-white">
                          <p className="text-xs text-muted-foreground font-medium">{b.label}</p>
                          <p className="text-lg font-bold mt-1.5 text-gray-900">{b.value || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No benchmark data available</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Review Tab */}
            <TabsContent value="review" className="mt-5 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
                {p.reviewSummary && <p className="text-sm leading-relaxed text-gray-700">{p.reviewSummary}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {p.pros && (
                    <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <h4 className="font-semibold text-emerald-700 text-sm mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/25"><Check className="w-3.5 h-3.5 text-white" /></div>
                        Pros
                      </h4>
                      <ul className="space-y-2">{p.pros.split(',').map((pro, i) => <li key={i} className="text-sm text-emerald-700 flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />{pro.trim()}</li>)}</ul>
                    </div>
                  )}
                  {p.cons && (
                    <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                      <h4 className="font-semibold text-red-700 text-sm mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm shadow-red-500/25"><Minus className="w-3.5 h-3.5 text-white" /></div>
                        Cons
                      </h4>
                      <ul className="space-y-2">{p.cons.split(',').map((con, i) => <li key={i} className="text-sm text-red-700 flex items-start gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />{con.trim()}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Related Phones */}
          {related.length > 0 && (
            <section className="space-y-5 pt-4">
              <SectionHeader title={`More from ${p.brand?.name}`} icon={Smartphone} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {related.slice(0, 6).map(r => <PhoneCard key={r.id} phone={r} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}