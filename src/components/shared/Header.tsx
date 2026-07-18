'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Smartphone, Shield, Sun, Moon, Menu, X, Home, Layers, GitCompare, Newspaper, Info, Mail, ChevronDown, Play, Star, BarChart3 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAdmin } from '@/lib/useAdmin';

interface AutocompleteResult {
  id: string;
  slug: string;
  modelName: string;
  thumbnail: string;
  pricePKR: number;
  brand: { id: string; name: string; slug: string } | null;
}

const POPULAR_SEARCHES = ['Samsung Galaxy S24', 'iPhone 15', 'Xiaomi 14', 'Redmi Note 13', 'Poco X6'];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { admin } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pd_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setShowDropdown(false); setMoreOpen(false); }, [pathname]);

  // Debounced autocomplete
  const handleSearchChange = useCallback((value: string) => {
    setSearchQ(value);
    if (value.length < 2) { setAutocompleteResults([]); setShowDropdown(false); return; }
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/phones/autocomplete?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setAutocompleteResults(data.phones || []);
      } catch { setAutocompleteResults([]); }
    }, 300);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const saveRecentSearch = (q: string) => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem('pd_recent_searches') || '[]');
      const updated = [q, ...saved.filter(s => s !== q)].slice(0, 5);
      localStorage.setItem('pd_recent_searches', JSON.stringify(updated));
      setRecentSearches(updated);
    } catch { /* ignore */ }
  };

  const doSearch = (query?: string) => {
    const q = (query || searchQ).trim();
    if (q) {
      saveRecentSearch(q);
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQ('');
      setAutocompleteResults([]);
      setShowDropdown(false);
    }
  };

  const toggleTheme = () => { setTheme(theme === 'dark' ? 'light' : 'dark'); };

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Brands', href: '/brands' },
    { label: 'Compare', href: '/compare' },
    { label: 'News', href: '/news' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const moreLinks = [
    { label: 'Reviews', href: '/reviews', icon: Star },
    { label: 'Videos', href: '/videos', icon: Play },
    { label: 'PTA Status', href: '/phones', icon: Shield },
    { label: 'Price Tracker', href: '/price-ranges', icon: BarChart3 },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/25">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-gray-900 hidden sm:block">Phone<span className="text-blue-500">Dock</span></span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(item => (
              <Link key={item.href} href={item.href} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white/60 transition-all duration-200">
                {item.label}
              </Link>
            ))}
            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white/60 transition-all duration-200 flex items-center gap-1"
                aria-label="More navigation"
                aria-expanded={moreOpen}
              >
                More <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-200/60 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {moreLinks.map(item => (
                    <Link role="menuitem" key={item.href} href={item.href} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                      <item.icon className="w-4 h-4 text-gray-400" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1">
            {admin ? (
              <Link href="/admin/dashboard" className="px-3.5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm shadow-blue-500/25">
                <Shield className="w-4 h-4" />Dashboard
              </Link>
            ) : (
              <Link href="/admin/login" className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/60 transition-all duration-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
            <div className="relative" ref={searchContainerRef}>
              <button onClick={() => setSearchOpen(!searchOpen)} aria-label="Search" className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200">
                <Search className="w-[18px] h-[18px]" />
              </button>
            </div>
            <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200">
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button className="p-2 rounded-xl hover:bg-white/60 text-gray-600 hover:text-gray-900 transition-all duration-200 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search bar with autocomplete */}
        {searchOpen && (
          <div className="pb-3 relative animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  placeholder="Search phones, brands, processors..."
                  aria-label="Search phones, brands, processors..."
                  value={searchQ}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                  onFocus={() => { if (searchQ.length >= 2) setShowDropdown(true); }}
                  className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <button onClick={() => doSearch()} className="btn-primary h-11 px-5 rounded-xl text-sm">
                Search
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-200/60 max-h-[340px] overflow-y-auto z-50">
                {/* Search results */}
                {autocompleteResults.length > 0 && (
                  <div className="py-1">
                    <p className="px-3.5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Results</p>
                    {autocompleteResults.slice(0, 6).map(p => (
                      <button
                        key={p.id}
                        onClick={() => doSearch(p.modelName)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.thumbnail ? (
                            <Image src={p.thumbnail} alt={p.modelName} width={24} height={24} className="object-contain" unoptimized />
                          ) : (
                            <Smartphone className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.modelName}</p>
                          <p className="text-[10px] text-gray-500">{p.brand?.name || ''}{p.pricePKR ? ` · Rs ${p.pricePKR.toLocaleString()}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent searches */}
                {autocompleteResults.length === 0 && recentSearches.length > 0 && (
                  <div className="py-1">
                    <p className="px-3.5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent Searches</p>
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => doSearch(s)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left text-sm text-gray-700"
                      >
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular searches */}
                {autocompleteResults.length === 0 && (
                  <div className="py-1 border-t border-gray-100">
                    <p className="px-3.5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Popular Searches</p>
                    <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
                      {POPULAR_SEARCHES.map(s => (
                        <button
                          key={s}
                          onClick={() => doSearch(s)}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden glass-modal border-t border-white/30 animate-in fade-in slide-in-from-top-1 duration-200" role="navigation" aria-label="Main navigation" onKeyDown={(e) => { if (e.key === 'Escape') setMobileOpen(false); }}>
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-200">
                {item.label === 'Home' && <Home className="w-4 h-4 text-gray-400" />}
                {item.label === 'Brands' && <Layers className="w-4 h-4 text-gray-400" />}
                {item.label === 'Compare' && <GitCompare className="w-4 h-4 text-gray-400" />}
                {item.label === 'News' && <Newspaper className="w-4 h-4 text-gray-400" />}
                {item.label === 'About' && <Info className="w-4 h-4 text-gray-400" />}
                {item.label === 'Contact' && <Mail className="w-4 h-4 text-gray-400" />}
                {item.label}
              </Link>
            ))}
            {/* More links in mobile */}
            {moreLinks.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-200">
                <item.icon className="w-4 h-4 text-gray-400" />
                {item.label}
              </Link>
            ))}
            {admin ? (
              <Link href="/admin/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 bg-blue-50/80">
                <Shield className="w-4 h-4" />Dashboard
              </Link>
            ) : (
              <Link href="/admin/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 transition-all duration-200">
                <Shield className="w-4 h-4 text-gray-400" />Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}