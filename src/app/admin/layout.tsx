'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Smartphone, Layers, Newspaper, Star, Clock, Upload,
  LogOut, Eye, Shield, RefreshCw, Radio, Activity, Settings, Users,
  ChevronDown, DollarSign, Key, Play, TrendingDown,
  ShieldCheck, Rocket, Sparkles,
  Workflow, Grid3X3, Link2, AppWindow,
} from 'lucide-react';
import { useAdmin, AdminAuthProvider } from '@/lib/useAdmin';

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
  group: AdminNavGroup;
  permission?: string;
  children?: { label: string; href: string }[];
}

type AdminNavGroup = 'Overview' | 'Catalog' | 'Automation' | 'Content' | 'Experience' | 'Mobile' | 'System';

const ADMIN_NAV_GROUPS: AdminNavGroup[] = ['Overview', 'Catalog', 'Automation', 'Content', 'Experience', 'Mobile', 'System'];

const adminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: BarChart3, group: 'Overview', permission: 'phones:read' },
  { label: 'Analytics', href: '/admin/analytics', icon: Activity, group: 'Overview', permission: 'settings:read' },
  { label: 'Activity', href: '/admin/activity', icon: Clock, group: 'Overview', permission: 'activity:read' },
  { label: 'Phones', href: '/admin/phones', icon: Smartphone, group: 'Catalog', permission: 'phones:read' },
  { label: 'Brands', href: '/admin/brands', icon: Layers, group: 'Catalog', permission: 'brands:read' },
  { label: 'Import', href: '/admin/import-v2', icon: Upload, group: 'Catalog', permission: 'imports:read' },
  { label: 'Data Quality', href: '/admin/data-quality', icon: ShieldCheck, group: 'Catalog', permission: 'data-quality:read' },
  { label: 'Automation Pipeline', href: '/admin/automation', icon: Workflow, group: 'Automation', permission: 'prices:read' },
  { label: 'Price Tracker', href: '/admin/price-tracker', icon: TrendingDown, group: 'Automation', permission: 'prices:read' },
  { label: 'Collector', href: '/admin/collector', icon: Radio, group: 'Automation', permission: 'collectors:read', children: [
    { label: 'Overview', href: '/admin/collector' },
    { label: 'Discover', href: '/admin/collector/discover' },
    { label: 'Sources', href: '/admin/collector/sources' },
    { label: 'Jobs', href: '/admin/collector/jobs' },
    { label: 'Review', href: '/admin/collector/review' },
    { label: 'Logs', href: '/admin/collector/logs' },
    { label: 'History', href: '/admin/collector/history' },
    { label: 'Settings', href: '/admin/collector/settings' },
  ]},
  { label: 'AI Research', href: '/admin/ai-research', icon: Sparkles, group: 'Automation', permission: 'ai-research:read' },
  { label: 'Sync', href: '/admin/sync', icon: RefreshCw, group: 'Automation', permission: 'phones:edit' },
  { label: 'News', href: '/admin/news', icon: Newspaper, group: 'Content', permission: 'news:read' },
  { label: 'Videos', href: '/admin/videos', icon: Play, group: 'Content', permission: 'videos:read' },
  { label: 'Reviews', href: '/admin/reviews', icon: Star, group: 'Content', permission: 'phones:read' },
  { label: 'Review Engine', href: '/admin/review-engine', icon: Sparkles, group: 'Content', permission: 'phones:edit' },
  { label: 'Sponsors', href: '/admin/sponsors', icon: DollarSign, group: 'Content', permission: 'sponsors:read' },
  { label: 'Homepage Builder', href: '/admin/homepage-builder', icon: Sparkles, group: 'Experience', permission: 'settings:read' },
  { label: 'Card Layout Control', href: '/admin/layout-control', icon: Grid3X3, group: 'Experience', permission: 'settings:read' },
  { label: 'Links & Hrefs', href: '/admin/homepage-builder?tab=navigation', icon: Link2, group: 'Experience', permission: 'settings:read' },
  { label: 'Mobile App Control', href: '/admin/mobile-control', icon: AppWindow, group: 'Mobile', permission: 'settings:read' },
  { label: 'Launch Center', href: '/admin/launch-center', icon: Rocket, group: 'System', permission: 'settings:read' },
  { label: 'Site Settings', href: '/admin/settings', icon: Settings, group: 'System', permission: 'settings:read' },
  { label: 'Users', href: '/admin/users', icon: Users, group: 'System', permission: 'users:read' },
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
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openNavSections, setOpenNavSections] = useState<Set<AdminNavGroup>>(new Set(['Overview']));
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
    const activeLink = adminLinks.find(link => isActive(pathname, link));
    if (activeLink) {
      setOpenNavSections(previous => new Set(previous).add(activeLink.group));
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

  const toggleNavSection = (group: AdminNavGroup) => {
    setOpenNavSections(previous => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
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
  const groupedLinks = ADMIN_NAV_GROUPS
    .map(group => ({ group, links: filteredLinks.filter(link => link.group === group) }))
    .filter(section => section.links.length > 0);

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
          <nav className="flex-1 space-y-1 overflow-y-auto p-3 max-h-[calc(100vh-8rem)]" aria-label="Admin navigation">
            {groupedLinks.map(section => {
              const sectionOpen = openNavSections.has(section.group);
              const sectionActive = section.links.some(link => isActive(pathname, link));
              return (
                <section key={section.group} className="rounded-xl border border-transparent">
                  <button
                    type="button"
                    onClick={() => toggleNavSection(section.group)}
                    aria-expanded={sectionOpen}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      sectionActive ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                  >
                    <span>{section.group}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sectionOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {sectionOpen && (
                    <div className="mt-1 space-y-0.5">
                      {section.links.map(link => {
                        const active = isActive(pathname, link);
                        const hasChildren = Boolean(link.children?.length);
                        const isOpen = openGroups.has(link.href);
                        return (
                          <div key={link.href}>
                            <Link
                              href={hasChildren ? '#' : link.href}
                              onClick={event => {
                                if (hasChildren) {
                                  event.preventDefault();
                                  toggleGroup(link.href);
                                }
                              }}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                active ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              <link.icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate">{link.label}</span>
                              {link.href === '/admin/videos' && pendingVideoCount > 0 && (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingVideoCount}</span>
                              )}
                              {hasChildren && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                            </Link>
                            {hasChildren && isOpen && (
                              <div className="ml-7 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                                {link.children!.map(child => {
                                  const childActive = pathname === child.href;
                                  return (
                                    <Link key={child.href} href={child.href}
                                      className={`block rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${childActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                                      {child.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
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
