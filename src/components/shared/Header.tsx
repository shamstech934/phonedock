'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Smartphone, Shield, Sun, Moon, Menu, X, Home, Layers, GitCompare, Newspaper, Info, Mail } from 'lucide-react';
import { useTheme } from 'next-themes';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [admin, setAdmin] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pd_admin');
      if (stored) setAdmin(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [pathname]);

  const doSearch = () => {
    if (searchQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`);
      setSearchOpen(false);
      setSearchQ('');
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

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(item => (
              <Link key={item.href} href={item.href} className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-white/60 transition-all duration-200">
                {item.label}
              </Link>
            ))}
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

        {searchOpen && (
          <div className="pb-3 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input ref={searchRef} placeholder="Search phones, brands, processors..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none placeholder:text-gray-400" autoFocus />
            </div>
            <button onClick={doSearch} className="btn-primary h-11 px-5 rounded-xl text-sm">
              Search
            </button>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div className="md:hidden glass-modal border-t border-white/30 animate-in fade-in slide-in-from-top-1 duration-200">
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