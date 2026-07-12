'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  Search, Star, ChevronRight, ChevronDown, Menu, X, Shield, Zap, Camera, Battery, Cpu, Trophy,
  TrendingUp, Clock, ArrowUpRight, Phone, Smartphone, BarChart3, Users, Newspaper, Settings,
  LogOut, Plus, Trash2, Edit, Eye, Sun, Moon, Home, GitCompare, Layers, Heart, Check,
  ChevronLeft, Minus, Filter, SlidersHorizontal, Play, ExternalLink, Tag, Package,
  Monitor, Wifi, Bluetooth, Fingerprint, Cpu as Chip, Image as ImageIcon, Activity, Star as StarIcon,
  AlertTriangle
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
          </nav>

          <div className="flex items-center gap-1">
            {admin ? (
              <button onClick={() => onNavigate('/admin/dashboard')} className="px-3.5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm shadow-blue-500/25">
                <Shield className="w-4 h-4" />Dashboard
              </button>
            ) : (
              <button onClick={() => onNavigate('/admin/login')} className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/60 transition-all duration-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />Admin
              </button>
            )}
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
              {[{ l: 'Home', h: '/' }, { l: 'Compare', h: '/compare' }, { l: 'News', h: '/news' }, { l: 'Best Camera', h: '/brands' }, { l: 'Best Gaming', h: '/brands' }, { l: 'Best Battery', h: '/brands' }].map(item => (
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
function PhoneSection({ phones, title, icon: Icon, link, linkText, showEmpty }: { phones: Phone[]; title: string; icon: React.ElementType; link?: string; linkText?: string; showEmpty?: boolean }) {
  if (!phones.length) {
    if (!showEmpty) return null;
    return (
      <section className="space-y-4">
        <SectionHeader title={title} icon={Icon} link={link} linkText={linkText} />
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
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
          <p className="text-gray-400 text-sm sm:text-base mb-6 leading-relaxed max-w-lg">Compare specs, check PTA status, read reviews, and find the best prices in Pakistan across all major brands.</p>

          {/* Search Bar Inside Hero */}
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input placeholder="Phone name, brand ya chipset search karein..." value={homeSearchQ} onChange={e => setHomeSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHomeSearch()} className="w-full pl-12 pr-4 h-12 text-sm rounded-xl bg-white/95 text-gray-900 outline-none focus:ring-2 focus:ring-blue-400/50 placeholder:text-gray-400 transition-all shadow-lg" />
            </div>
            <button onClick={handleHomeSearch} className="bg-blue-500 hover:bg-blue-400 text-white h-12 px-6 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2">
              <Search className="w-4 h-4" /> Search
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button className="bg-white text-gray-900 hover:bg-gray-100 font-semibold rounded-xl h-10 px-5 shadow-lg shadow-white/10 transition-colors" onClick={() => onNavigate('/brands')}>
              <Smartphone className="w-4 h-4 mr-2" /> Browse Phones
            </Button>
          </div>
          <div className="flex flex-wrap gap-5 mt-6 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> PTA Status</span>
            <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-blue-400" /> PKR Prices</span>
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400" /> Expert Reviews</span>
          </div>
        </div>
      </section>

      {/* Featured Phones */}
      <section className="space-y-4">
        <SectionHeader title="Featured Phones" icon={Star} link="/brands" linkText="All Phones" />
        {data.featured.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
            {data.featured.slice(0, 8).map(p => (
              <div key={p.id} className="shrink-0 w-[calc(50%-6px)] sm:w-auto">
                <PhoneCard phone={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Star className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-muted-foreground">No featured phones yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">We are adding phones to our database</p>
          </div>
        )}
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
      <PhoneSection phones={data.trending} title="Trending Now" icon={TrendingUp} link="/brands" linkText="All Phones" showEmpty />

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
      <PhoneSection phones={data.latest} title="Latest Additions" icon={Clock} link="/brands" linkText="All Phones" showEmpty />

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
      <PhoneSection phones={data.upcoming} title="Upcoming Phones" icon={Clock} showEmpty />
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

// ============ COMPARE PAGE ============
function ComparePage({ params, onNavigate }: { params: Record<string, string>; onNavigate: (p: string) => void }) {
  const [allPhones, setAllPhones] = useState<Phone[]>([]);
  const [selected, setSelected] = useState<Phone[]>([]);
  const [search, setSearch] = useState('');
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/phones').then(r => r.json()).then(data => {
      if (cancelled) return;
      const phones: Phone[] = data.phones || [];
      setAllPhones(phones);
      if (params.ids) {
        const ids = params.ids.split(',');
        const pre = phones.filter(p => ids.includes(p.id));
        setSelected(pre.slice(0, 4));
        if (pre.length >= 2) setCompared(true);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = allPhones.filter(p => p.modelName.toLowerCase().includes(search.toLowerCase()));
  const isSelected = (id: string) => selected.some(p => p.id === id);

  const togglePhone = (phone: Phone) => {
    if (isSelected(phone.id)) { setSelected(prev => prev.filter(p => p.id !== phone.id)); setCompared(false); }
    else if (selected.length < 4) { setSelected(prev => [...prev, phone]); setCompared(false); }
  };

  const getWinner = (key: 'cameraScore' | 'performanceScore' | 'batteryScore' | 'valueScore') => {
    let best = selected[0]; let max = 0;
    selected.forEach(p => { if (p[key] > max) { max = p[key]; best = p; } });
    return best;
  };

  const catData = [
    { label: 'Camera', key: 'cameraScore' as const, icon: Camera, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Performance', key: 'performanceScore' as const, icon: Cpu, gradient: 'from-purple-500 to-purple-600' },
    { label: 'Battery', key: 'batteryScore' as const, icon: Battery, gradient: 'from-emerald-500 to-green-600' },
    { label: 'Value', key: 'valueScore' as const, icon: Tag, gradient: 'from-amber-500 to-orange-500' },
  ];

  const metrics = [
    { label: 'Overall', get: (p: Phone) => p.overallRating * 10 },
    { label: 'Camera', get: (p: Phone) => p.cameraScore },
    { label: 'Performance', get: (p: Phone) => p.performanceScore },
    { label: 'Battery', get: (p: Phone) => p.batteryScore },
    { label: 'Value', get: (p: Phone) => p.valueScore },
    { label: 'Display', get: (p: Phone) => p.displayScore },
  ];

  const specRows = [
    { label: 'Display', get: (p: Phone) => p.specs?.display },
    { label: 'Processor', get: (p: Phone) => p.specs?.chipset },
    { label: 'RAM', get: (p: Phone) => p.specs?.ram },
    { label: 'Storage', get: (p: Phone) => p.specs?.storage },
    { label: 'Main Camera', get: (p: Phone) => p.specs?.mainCamera },
    { label: 'Battery', get: (p: Phone) => p.specs?.battery },
    { label: 'OS', get: (p: Phone) => [p.specs?.os, p.specs?.osVersion].filter(Boolean).join(' ') },
    { label: '5G', get: (p: Phone) => p.specs?.fiveG },
    { label: 'Fingerprint', get: (p: Phone) => p.specs?.fingerprint },
  ];

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /><div className="skeleton-shimmer h-96 rounded-2xl mt-4" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Compare Phones</h1>

      {!compared ? (<>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search phones to compare..." value={search} onChange={e => setSearch(e.target.value)} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm bg-white/70 backdrop-blur-md border border-white/50 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400 transition-all" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {filtered.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">No phones found</div>}
            {filtered.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                <input type="checkbox" checked={isSelected(p.id)} onChange={() => togglePhone(p)} disabled={!isSelected(p.id) && selected.length >= 4} className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30" />
                {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={36} height={36} className="w-9 h-9 object-contain rounded-lg bg-[#F8FAFC] p-0.5" unoptimized /> : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p><p className="text-xs text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p></div>
                {isSelected(p.id) && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
              </label>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Selected:</span>
            {selected.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-full">
                {p.modelName}
                <button onClick={() => togglePhone(p)} className="hover:bg-blue-600 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => setCompared(true)} disabled={selected.length < 2} className="ml-auto bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 h-10 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25 disabled:shadow-none flex items-center gap-2">
              <GitCompare className="w-4 h-4" /> Compare ({selected.length})
            </button>
          </div>
        )}
      </>) : (<>
        <button onClick={() => setCompared(false)} className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to picker
        </button>

        {/* Category Winners */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-blue-500" /> Category Winners</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {catData.map(cat => {
              const winner = getWinner(cat.key);
              return (
                <div key={cat.label} className={`bg-gradient-to-br ${cat.gradient} rounded-2xl p-4 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3"><cat.icon className="w-5 h-5" /><span className="text-sm font-semibold">{cat.label}</span></div>
                    <p className="font-bold text-sm leading-snug">{winner?.modelName || 'N/A'}</p>
                    <p className="text-xs text-white/70 mt-1">{winner?.brand?.name}</p>
                    <p className="text-2xl font-extrabold mt-2">{winner?.[cat.key] || 0}<span className="text-sm font-medium text-white/70">/100</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Score Comparison */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-5">
          <h2 className="font-bold text-gray-900">Score Comparison</h2>
          {metrics.map(metric => {
            const scores = selected.map(p => ({ phone: p, score: metric.get(p) }));
            const maxScore = Math.max(...scores.map(s => s.score));
            const winnerId = scores.find(s => s.score === maxScore)?.phone.id;
            return (
              <div key={metric.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
                <div className="space-y-2">
                  {scores.map(s => (
                    <div key={s.phone.id} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-28 sm:w-40 truncate shrink-0">{s.phone.modelName}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${s.phone.id === winnerId ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`} style={{ width: `${Math.max(s.score, 2)}%` }} />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
                        {s.phone.id === winnerId && <Trophy className="w-3.5 h-3.5 text-blue-500" />}
                        <span className={`text-xs font-bold ${s.phone.id === winnerId ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Specs Table */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Specifications Comparison</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="sticky left-0 bg-[#F8FAFC] z-10 text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Spec</th>
                  {selected.map(p => <th key={p.id} className="text-left px-4 py-3 text-xs font-semibold text-gray-900">{p.modelName}</th>)}
                </tr>
              </thead>
              <tbody>
                {specRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                    <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-inherit">{row.label}</td>
                    {selected.map(p => <td key={p.id} className="px-4 py-3 text-gray-900">{row.get(p) || <span className="text-muted-foreground">—</span>}</td>)}
                  </tr>
                ))}
                <tr className="bg-white border-t border-gray-100">
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-white">Price</td>
                  {selected.map(p => <td key={p.id} className="px-4 py-3 font-bold text-blue-600">{formatPrice(p.pricePKR)}</td>)}
                </tr>
                <tr className="bg-[#F8FAFC]">
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-[#F8FAFC]">PTA</td>
                  {selected.map(p => <td key={p.id} className="px-4 py-3">{p.ptaApproved ? <span className="text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Approved</span> : <span className="text-muted-foreground">{p.ptaStatus}</span>}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </>)}
    </div>
  );
}

// ============ BRANDS PAGE ============
function BrandsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-48 rounded-lg mb-6" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-40 rounded-2xl" />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">All Brands</h1>
        <p className="text-sm text-muted-foreground mt-1">{brands.length} brands in our database</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="phone-card bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/8 hover:border-blue-200" onClick={() => onNavigate(`/brand/${brand.slug}`)}>
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
              {brand.logo ? <Image src={brand.logo} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />}
            </div>
            <h3 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{brand.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{brand._count?.phones || 0} phones</p>
            {brand.country && <p className="text-[10px] text-muted-foreground mt-0.5">{brand.country}</p>}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-3 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ BRAND DETAIL PAGE ============
function BrandDetailPage({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/brands/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setBrand(d.brand || null); setPhones(d.phones || []); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6 space-y-4"><div className="skeleton-shimmer h-6 w-48 rounded-lg" /><div className="skeleton-shimmer h-32 rounded-2xl" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div></div>;

  if (!brand) return <div className="max-w-7xl mx-auto px-4 py-20 text-center"><Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h2 className="text-xl font-bold text-gray-900">Brand not found</h2><Button variant="outline" className="mt-4 rounded-xl" onClick={() => onNavigate('/')}>Go Home</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => onNavigate('/')} className="hover:text-blue-500 transition-colors">Home</button><ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => onNavigate('/brands')} className="hover:text-blue-500 transition-colors">Brands</button><ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-gray-900">{brand.name}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            {brand.logo ? <Image src={brand.logo} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-7 h-7 text-gray-400" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">{brand.name}</h1>
            <p className="text-sm text-muted-foreground">{brand.country && `${brand.country} · `}{brand._count?.phones || 0} phones</p>
            {brand.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{brand.description}</p>}
          </div>
        </div>
      </div>
      {phones.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {phones.map(p => <PhoneCard key={p.id} phone={p} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground"><Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">No phones listed for this brand yet</p></div>
      )}
    </div>
  );
}

// ============ SEARCH PAGE ============
function SearchPage({ query, onNavigate }: { query: string; onNavigate: (p: string) => void }) {
  const [results, setResults] = useState<{ brands: Brand[]; phones: Phone[] }>({ brands: [], phones: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { if (!cancelled) { setResults({ brands: d.brands || [], phones: d.phones || [] }); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const total = results.brands.length + results.phones.length;

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-64 rounded-lg mb-2" /><div className="skeleton-shimmer h-5 w-32 rounded-md mb-6" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(6).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Search Results for &ldquo;{query}&rdquo;</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} result{total !== 1 ? 's' : ''} found</p>
      </div>

      {results.brands.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-500" /> Brands ({results.brands.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.brands.map(b => (
              <div key={b.id} className="phone-card bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/8 hover:border-blue-200 flex items-center gap-3" onClick={() => onNavigate(`/brand/${b.slug}`)}>
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                  {b.logo ? <Image src={b.logo} alt={b.name} width={28} height={28} className="object-contain" unoptimized /> : <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />}
                </div>
                <div><p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{b.name}</p><p className="text-[10px] text-muted-foreground">{b._count?.phones || 0} phones</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.phones.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> Phones ({results.phones.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.phones.map(p => <PhoneCard key={p.id} phone={p} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No results found</h3>
          <p className="text-sm">Try a different search term</p>
          <Button variant="outline" className="mt-5 rounded-xl" onClick={() => onNavigate('/')}>Browse All Phones</Button>
        </div>
      )}
    </div>
  );
}

// ============ NEWS PAGE ============
function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news').then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-48 rounded-lg mb-2" /><div className="skeleton-shimmer h-5 w-64 rounded-md mb-6" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-56 rounded-2xl" />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">News & Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">Latest smartphone news, leaks, and reviews</p>
      </div>
      {news.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {news.map(n => (
            <article key={n.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 font-medium">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <h2 className="font-bold text-base text-gray-900 leading-snug mb-2 line-clamp-2">{n.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{n.excerpt || n.content}</p>
              {n.author && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Users className="w-3 h-3" /> {n.author}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground"><Newspaper className="w-14 h-14 mx-auto mb-4 opacity-15" /><h3 className="text-lg font-bold text-gray-900 mb-1">No news yet</h3><p className="text-sm">Check back later for updates</p></div>
      )}
    </div>
  );
}

// ============ ADMIN LOGIN PAGE ============
function AdminLoginPage({ onLogin }: { onLogin: (admin: AdminUser, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.token) { onLogin(data.admin, data.token); } else { setError(data.error || 'Invalid credentials'); }
    } catch { setError('Connection failed. Try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your phone database</p>
        </div>
        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl px-4 py-2.5 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white" />
          <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground/70 mt-4">Demo: admin@phonedock.pk / admin123</p>
      </div>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============
function AdminDashboard({ token, admin, onNavigate, homeData }: { token: string | null; admin: AdminUser; onNavigate: (p: string) => void; homeData: HomeData | null }) {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const statCards = [
    { label: 'Total Phones', value: stats.totalPhones ?? homeData?.featured?.length ?? 0, icon: Smartphone, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Brands', value: stats.totalBrands ?? homeData?.brands?.length ?? 0, icon: Layers, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { label: 'Trending', value: stats.trendingCount ?? homeData?.trending?.length ?? 0, icon: TrendingUp, bg: 'bg-red-50', iconColor: 'text-red-500' },
    { label: 'Featured', value: stats.featuredCount ?? homeData?.featured?.length ?? 0, icon: Star, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    { label: 'Avg Price', value: stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A', icon: Tag, bg: 'bg-violet-50', iconColor: 'text-violet-500' },
    { label: 'News', value: stats.newsCount ?? homeData?.news?.length ?? 0, icon: Newspaper, bg: 'bg-cyan-50', iconColor: 'text-cyan-500' },
  ];

  const quickActions = [
    { label: 'Phones', icon: Smartphone, hash: '/admin/phones' },
    { label: 'Brands', icon: Layers, hash: '/admin/brands' },
    { label: 'News', icon: Newspaper, hash: '/admin/news' },
    { label: 'Sponsors', icon: Star, hash: '/admin/sponsors' },
    { label: 'SEO', icon: Settings, hash: '/admin/dashboard' },
    { label: 'Images', icon: ImageIcon, hash: '/admin/dashboard' },
  ];

  const priceDist = stats.priceDistribution || [
    { range: 'Under 20K', count: 0 }, { range: '20K - 40K', count: 0 }, { range: '40K - 60K', count: 0 },
    { range: '60K - 100K', count: 0 }, { range: 'Above 100K', count: 0 },
  ];
  const maxPriceCount = Math.max(...priceDist.map((d: any) => d.count || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Welcome back, {admin.name || 'Admin'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s what&apos;s happening with PhoneDock</p>
        </div>
        <button onClick={() => onNavigate('/')} className="self-start bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 h-9 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Eye className="w-4 h-4" /> View Site
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.iconColor}`} /></div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => onNavigate(a.hash)} className="card-premium bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-50 transition-colors"><a.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" /></div>
            <p className="text-xs font-semibold text-gray-700">{a.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Distribution */}
        <div className="card-premium bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Price Distribution</h3>
          <div className="space-y-3">
            {priceDist.map((d: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{d.range}</span><span className="font-semibold text-gray-900">{d.count || 0}</span></div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700" style={{ width: `${((d.count || 0) / maxPriceCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-premium bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Recent Activity</h3>
          <div className="space-y-3">
            {(stats.recentActivity || []).slice(0, 6).map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{log.details || log.action}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.admin?.name || 'Admin'} · {log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              </div>
            ))}
            {(!stats.recentActivity || stats.recentActivity.length === 0) && <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN PHONES PAGE ============
function AdminPhonesPage({ token }: { token: string | null }) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/phones', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setPhones(d.phones || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Phones</h1>
        <span className="text-xs text-muted-foreground">{phones.length} phones</span>
      </div>
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F8FAFC] border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PTA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {phones.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={32} height={32} className="w-8 h-8 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{p.modelName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.brand?.name}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{formatPrice(p.pricePKR)}</td>
                  <td className="px-4 py-3">{p.ptaApproved ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">Approved</Badge> : <Badge variant="secondary" className="text-[10px]">{p.ptaStatus}</Badge>}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="font-semibold">{p.overallRating}</span></div></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {phones.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={40} height={40} className="w-10 h-10 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-5 h-5 text-gray-400" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
              <p className="text-[10px] text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ADMIN BRANDS PAGE ============
function AdminBrandsPage({ token }: { token: string | null }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/brands', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-36 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Brands</h1>
        <span className="text-xs text-muted-foreground">{brands.length} brands</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {brand.logo ? <Image src={brand.logo} alt={brand.name} width={32} height={32} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">{brand.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{brand.slug}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{brand.country || 'N/A'}</span>
              <Badge variant="secondary" className="text-[10px]">{brand._count?.phones || 0} phones</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ADMIN NEWS PAGE ============
function AdminNewsPage({ token }: { token: string | null }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/news', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage News</h1>
        <span className="text-xs text-muted-foreground">{news.length} articles</span>
      </div>
      <div className="space-y-2">
        {news.map(n => (
          <div key={n.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{n.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {n.published ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Check className="w-3 h-3 mr-0.5" /> Published</Badge> : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {news.length === 0 && <div className="text-center py-16 text-muted-foreground"><Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No news articles yet</p></div>}
      </div>
    </div>
  );
}

// ============ ADMIN SPONSORS PAGE ============
function AdminSponsorsPage({ token }: { token: string | null }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/sponsors', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setSponsors(d.sponsors || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Sponsors</h1>
        <span className="text-xs text-muted-foreground">{sponsors.length} sponsors</span>
      </div>
      <div className="space-y-2">
        {sponsors.map(s => (
          <div key={s.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                {s.image ? <Image src={s.image} alt={s.name} width={28} height={28} className="object-contain" unoptimized /> : <Star className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 truncate">{s.name}</h3>
                <p className="text-[10px] text-muted-foreground">{s.position || 'No position'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">Clicks</p>
                <p className="text-xs font-semibold text-gray-900">{(s as any).clicks || 0}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">Impressions</p>
                <p className="text-xs font-semibold text-gray-900">{(s as any).impressions || 0}</p>
              </div>
              {s.active ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">Active</Badge> : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
          </div>
        ))}
        {sponsors.length === 0 && <div className="text-center py-16 text-muted-foreground"><Star className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No sponsors yet</p></div>}
      </div>
    </div>
  );
}

// ============ ADMIN ACTIVITY PAGE ============
function AdminActivityPage({ token }: { token: string | null }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/activity', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-xl font-extrabold text-gray-900">Activity Log</h1>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        {logs.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-4">
              {logs.map((log, i) => (
                <div key={log.id || i} className="relative flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 z-10 ring-4 ring-white">
                    {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {log.entityType && <Badge variant="secondary" className="text-[10px]">{log.entityType}</Badge>}
                      {log.admin && <span className="text-[10px] text-muted-foreground">{log.admin.name}</span>}
                      <span className="text-[10px] text-muted-foreground/70">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground"><Activity className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No activity logged yet</p></div>
        )}
      </div>
    </div>
  );
}

// ============ ERROR BOUNDARY ============
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center"><AlertTriangle className="w-8 h-8 text-red-500" /></div>
            <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-sm text-gray-500">We are connecting to the database. Please refresh in a moment.</p>
            <button onClick={() => { this.setState({ hasError: false, error: undefined }); window.location.reload(); }} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">Refresh Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ MAIN APP ============
export default function PhoneDockApp() {
  const { view, params, navigate } = useHashRouter();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    fetch('/api/home').then(r => r.json()).then(d => { if (!cancelled) { if (d.error) { console.warn('Home API error:', d.error); setHomeData(null); } else { setHomeData(d); } setLoading(false); } }).catch(() => { if (!cancelled) { console.warn('Home fetch failed'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mounted]);

  const handleLogin = useCallback((a: AdminUser, t: string) => { setAdmin(a); setToken(t); navigate('/admin/dashboard'); }, [navigate]);
  const handleLogout = useCallback(() => { setAdmin(null); setToken(null); navigate('/'); }, [navigate]);
  const handleSearch = useCallback((q: string) => { setSearchQuery(q); navigate(`/search/${encodeURIComponent(q)}`); }, [navigate]);
  const toggleTheme = useCallback(() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }, [theme, setTheme]);

  const isAdmin = view.startsWith('admin-') && view !== 'admin-login';

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <AppErrorBoundary>
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Header onNavigate={navigate} onSearch={handleSearch} theme={theme || 'light'} toggleTheme={toggleTheme} admin={admin} onLogout={handleLogout} />
      <main className="flex-1">
        {isAdmin ? (
          admin ? (
            <div className="flex">
              <AdminSidebar admin={admin} onNavigate={navigate} onLogout={handleLogout} currentView={view} />
              <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full">
                <div className="animate-fade-in">
                  {view === 'admin-dashboard' && <AdminDashboard token={token} admin={admin} onNavigate={navigate} homeData={homeData} />}
                  {view === 'admin-phones' && <AdminPhonesPage token={token} />}
                  {view === 'admin-brands' && <AdminBrandsPage token={token} />}
                  {view === 'admin-news' && <AdminNewsPage token={token} />}
                  {view === 'admin-sponsors' && <AdminSponsorsPage token={token} />}
                  {view === 'admin-activity' && <AdminActivityPage token={token} />}
                </div>
              </div>
            </div>
          ) : (
            <AdminLoginPage onLogin={handleLogin} />
          )
        ) : (
          <div className="animate-fade-in">
            {view === 'home' && <HomePage data={homeData} loading={loading} onNavigate={navigate} />}
            {view === 'phone' && <PhoneDetailPage slug={params.slug || ''} onNavigate={navigate} />}
            {view === 'compare' && <ComparePage params={params} onNavigate={navigate} />}
            {view === 'brand' && <BrandDetailPage slug={params.slug || ''} onNavigate={navigate} />}
            {view === 'brands' && <BrandsPage onNavigate={navigate} />}
            {view === 'search' && <SearchPage query={params.q || ''} onNavigate={navigate} />}
            {view === 'news' && <NewsPage />}
            {view === 'admin-login' && <AdminLoginPage onLogin={handleLogin} />}
          </div>
        )}
      </main>
      {!isAdmin && <Footer onNavigate={navigate} />}
    </div>
    </AppErrorBoundary>
  );
}