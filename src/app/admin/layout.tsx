'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Smartphone, Layers, Newspaper, Star, Clock, Upload,
  LogOut, Eye, Shield, RefreshCw, Radio, Activity, Settings, Users,
  ChevronDown, DollarSign, Database, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/lib/useAdmin';

interface NavLink {
  label: string;
  href: string;
  icon: any;
  children?: { label: string; href: string }[];
}

const adminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { label: 'Phones', href: '/admin/phones', icon: Smartphone },
  { label: 'Brands', href: '/admin/brands', icon: Layers },
  { label: 'News', href: '/admin/news', icon: Newspaper },
  { label: 'Sponsors', href: '/admin/sponsors', icon: DollarSign },
  { label: 'Activity', href: '/admin/activity', icon: Clock },
  { label: 'Import', href: '/admin/import', icon: Upload },
  { label: 'Collector', href: '/admin/collector', icon: Radio, children: [
    { label: 'Overview', href: '/admin/collector' },
    { label: 'Sources', href: '/admin/collector/sources' },
    { label: 'Jobs', href: '/admin/collector/jobs' },
  ]},
  { label: 'Sync', href: '/admin/sync', icon: RefreshCw },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Users', href: '/admin/users', icon: Users },
];

function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === '/admin/dashboard') return pathname === link.href;
  if (link.children) {
    return pathname === link.href || pathname.startsWith(link.href + '/');
  }
  return pathname === link.href || pathname.startsWith(link.href + '/');
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, token, loading, logout } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !admin && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [admin, loading, pathname, router]);

  // Auto-open collector group if on a collector sub-page
  useEffect(() => {
    if (pathname.startsWith('/admin/collector')) {
      setOpenGroups(prev => new Set(prev).add('/admin/collector'));
    }
  }, [pathname]);

  const toggleGroup = (href: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Admin top bar */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center px-4 sticky top-0 z-50">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900 hidden sm:block">PhoneDock Admin</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors">
            <Eye className="w-3.5 h-3.5" /> View Site
          </Link>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      <div className="flex flex-1">
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
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {adminLinks.map(link => {
              const active = isActive(pathname, link);
              const hasChildren = link.children && link.children.length > 0;
              const isOpen = openGroups.has(link.href);
              const showChildren = hasChildren && isOpen;

              return (
                <div key={link.href}>
                  <Link
                    href={hasChildren ? '#' : link.href}
                    onClick={e => { if (hasChildren) { e.preventDefault(); toggleGroup(link.href); } }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active && !hasChildren ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/10' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    <link.icon className="w-4 h-4" />
                    <span className="flex-1">{link.label}</span>
                    {hasChildren && (
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </Link>
                  {showChildren && (
                    <div className="ml-7 pl-3 border-l border-gray-100 space-y-0.5 mt-0.5 mb-1">
                      {link.children!.map(child => {
                        const childActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${childActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tabs */}
        <div className="lg:hidden border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-900">{admin.name || admin.email}</span>
            </div>
          </div>
          <div className="flex overflow-x-auto px-3 pb-2.5 gap-1.5 no-scrollbar">
            {adminLinks.filter(l => !l.children).map(link => {
              const active = isActive(pathname, link);
              return (
                <Link key={link.href} href={link.href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${active ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  <link.icon className="w-3 h-3" />{link.label}
                </Link>
              );
            })}
            {adminLinks.filter(l => l.children).map(link => (
              <div key={link.href} className="relative">
                <button
                  onClick={() => toggleGroup(link.href)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${isActive(pathname, link) ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                >
                  <link.icon className="w-3 h-3" />{link.label}
                </button>
                {openGroups.has(link.href) && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-1 z-50 min-w-[140px]">
                    {link.children!.map(child => (
                      <Link key={child.href} href={child.href} className={`block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${pathname === child.href ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full">
          {children}
        </div>
      </div>
    </div>
  );
}