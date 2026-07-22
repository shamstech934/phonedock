'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Smartphone, Layers, Newspaper, Star, Clock, Upload,
  LogOut, Eye, Shield, RefreshCw, Radio, Activity, Settings, Users,
  ChevronDown, DollarSign, Database, Zap, Key, Play, TrendingDown,
  ShieldCheck, Rocket, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin, AdminAuthProvider } from '@/lib/useAdmin';

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  children?: { label: string; href: string }[];
}

const adminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: BarChart3, permission: 'phones:read' },
  { label: 'Launch Center', href: '/admin/launch-center', icon: Rocket, permission: 'settings:read' },
  { label: 'Phones', href: '/admin/phones', icon: Smartphone, permission: 'phones:read' },
  { label: 'Brands', href: '/admin/brands', icon: Layers, permission: 'brands:read' },
  { label: 'News', href: '/admin/news', icon: Newspaper, permission: 'news:read' },
  { label: 'Sponsors', href: '/admin/sponsors', icon: DollarSign, permission: 'sponsors:read' },
  { label: 'Price Tracker', href: '/admin/price-tracker', icon: TrendingDown, permission: 'prices:read' },
  { label: 'Videos', href: '/admin/videos', icon: Play, permission: 'videos:read' },
  { label: 'Reviews', href: '/admin/reviews', icon: Star, permission: 'phones:read' },
  { label: 'Review Engine', href: '/admin/review-engine', icon: Sparkles, permission: 'phones:edit' },
  { label: 'Activity', href: '/admin/activity', icon: Clock, permission: 'activity:read' },
  { label: 'Import', href: '/admin/import', icon: Upload, permission: 'imports:read' },
  { label: 'Collector', href: '/admin/collector', icon: Radio, permission: 'collectors:read', children: [
    { label: 'Overview', href: '/admin/collector' },
    { label: 'Sources', href: '/admin/collector/sources' },
    { label: 'Jobs', href: '/admin/collector/jobs' },
  ]},
  { label: 'Sync', href: '/admin/sync', icon: RefreshCw, permission: 'phones:edit' },
  { label: 'Data Quality', href: '/admin/data-quality', icon: ShieldCheck, permission: 'data-quality:read' },
  { label: 'Users', href: '/admin/users', icon: Users, permission: 'users:read' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, permission: 'settings:read' },
];

function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === '/admin/dashboard') return pathname === link.href;
  if (link.children) {
    return pathname === link.href || pathname.startsWith(link.href + '/');
  }
  return pathname === link.href || pathname.startsWith(link.href + '/');
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pendingVideoCount, setPendingVideoCount] = useState(0);

  // Fetch pending video count
  useEffect(() => {
    if (!admin) return;
    fetch('/api/admin/videos?limit=1&status=pending', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPendingVideoCount(d.pendingCount || 0))
      .catch(() => {});
  }, [admin]);

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

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwData.current || !pwData.newPw || !pwData.confirm) {
      setPwError('All fields are required');
      return;
    }
    if (pwData.newPw !== pwData.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    // Client-side strength check (mirrors server-side isStrongPassword)
    const pw = pwData.newPw;
    const pwErrors: string[] = [];
    if (pw.length < 12) pwErrors.push('at least 12 characters');
    if (!/[A-Z]/.test(pw)) pwErrors.push('one uppercase letter');
    if (!/[a-z]/.test(pw)) pwErrors.push('one lowercase letter');
    if (!/[0-9]/.test(pw)) pwErrors.push('one number');
    if (!/[^A-Za-z0-9]/.test(pw)) pwErrors.push('one special character');
    if (pwErrors.length > 0) {
      setPwError(`Password needs: ${pwErrors.join(', ')}`);
      return;
    }
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: pwData.current, newPassword: pwData.newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess('Password changed successfully');
        setPwData({ current: '', newPw: '', confirm: '' });
        setTimeout(() => setShowPasswordModal(false), 1500);
      } else {
        setPwError(data.error || 'Failed to change password');
      }
    } catch {
      setPwError('Connection error');
    }
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

  // Filter links based on permissions
  const filteredLinks = adminLinks.filter(link => {
    if (!link.permission) return true;
    const rolePerms: Record<string, string[]> = {
      superadmin: ['phones:read','phones:create','phones:edit','phones:delete','phones:publish','phones:seed','brands:read','brands:create','brands:edit','brands:delete','news:read','news:create','news:edit','news:delete','news:publish','sponsors:read','sponsors:manage','imports:read','imports:execute','collectors:read','collectors:manage','users:read','users:manage','settings:read','settings:manage','activity:read','media:upload','media:delete','trash:read','trash:restore','trash:delete','videos:read','videos:edit','videos:manage','prices:read','prices:edit','data-quality:read','data-quality:scan','data-quality:fix'],
      admin: ['phones:read','phones:create','phones:edit','phones:delete','phones:publish','phones:seed','brands:read','brands:create','brands:edit','brands:delete','news:read','news:create','news:edit','news:delete','news:publish','sponsors:read','sponsors:manage','imports:read','imports:execute','collectors:read','collectors:manage','users:read','settings:read','activity:read','media:upload','media:delete','trash:read','trash:restore','trash:delete','videos:read','videos:edit','videos:manage','prices:read','prices:edit','data-quality:read','data-quality:scan','data-quality:fix'],
      editor: ['phones:read','phones:create','phones:edit','brands:read','news:read','news:create','news:edit','activity:read','media:upload'],
      reviewer: ['phones:read','brands:read','news:read','activity:read','collectors:read'],
      viewer: ['phones:read','brands:read','news:read','activity:read'],
      moderator: ['phones:read','phones:edit','brands:read','news:read','news:edit','activity:read','reviews:read','reviews:manage','media:upload'],
    };
    return (rolePerms[admin.role] || []).includes(link.permission);
  });

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
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            title="Change Password"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Password</span>
          </button>
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors">
            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">View Site</span>
          </Link>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
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
            {filteredLinks.map(link => {
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
                    {link.href === '/admin/videos' && pendingVideoCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingVideoCount}</span>
                    )}
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
            {filteredLinks.filter(l => !l.children).map(link => {
              const active = isActive(pathname, link);
              return (
                <Link key={link.href} href={link.href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${active ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  <link.icon className="w-3 h-3" />{link.label}
                  {link.href === '/admin/videos' && pendingVideoCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold">{pendingVideoCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full">
          {children}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true" aria-label="Change Password" onKeyDown={(e) => { if (e.key === 'Escape') { setShowPasswordModal(false); setPwData({ current: '', newPw: '', confirm: '' }); setPwError(''); setPwSuccess(''); } }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Change Password</h2>
            {pwError && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3">{pwError}</div>}
            {pwSuccess && <div className="bg-green-50 text-green-600 text-xs rounded-xl px-4 py-2.5 mb-3">{pwSuccess}</div>}
            <div className="space-y-3">
              <input type="password" placeholder="Current password" value={pwData.current} onChange={e => setPwData(p => ({ ...p, current: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
              <input type="password" placeholder="New password (12+ chars)" value={pwData.newPw} onChange={e => setPwData(p => ({ ...p, newPw: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
              <input type="password" placeholder="Confirm new password" value={pwData.confirm} onChange={e => setPwData(p => ({ ...p, confirm: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowPasswordModal(false); setPwData({ current: '', newPw: '', confirm: '' }); setPwError(''); setPwSuccess(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleChangePassword} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with AdminAuthProvider at the layout level
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}