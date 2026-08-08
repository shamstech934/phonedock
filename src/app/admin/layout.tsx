'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut, Eye, Shield, Key, ChevronDown, Newspaper, BrainCircuit,
  Workflow, Settings, Menu, Database, WandSparkles, LayoutDashboard,
} from 'lucide-react';
import { useAdmin, AdminAuthProvider } from '@/lib/useAdmin';

interface NavChild {
  label: string;
  href: string;
  permission?: string;
}

interface NavLink {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  children?: NavChild[];
}

// Keep the sidebar focused: frequently used destinations stay direct while
// related tools live inside six clear work areas.
const adminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, permission: 'phones:read' },
  { label: 'Content', href: '/admin/content', icon: Newspaper, children: [
    { label: 'Phones', href: '/admin/phones', permission: 'phones:read' },
    { label: 'Brands', href: '/admin/brands', permission: 'brands:read' },
    { label: 'News', href: '/admin/news', permission: 'news:read' },
    { label: 'Videos', href: '/admin/videos', permission: 'videos:read' },
    { label: 'Reviews', href: '/admin/reviews', permission: 'phones:read' },
    { label: 'Review Engine', href: '/admin/review-engine', permission: 'phones:edit' },
    { label: 'Sponsors', href: '/admin/sponsors', permission: 'sponsors:read' },
  ]},
  { label: 'Data & Quality', href: '/admin/data-operations', icon: Database, children: [
    { label: 'Import', href: '/admin/import-v2', permission: 'imports:read' },
    { label: 'Collector Workspace', href: '/admin/collector', permission: 'collectors:read' },
    { label: 'Sync', href: '/admin/sync', permission: 'phones:edit' },
    { label: 'Data Quality', href: '/admin/data-quality', permission: 'data-quality:read' },
    { label: 'Price Control', href: '/admin/price-tracker', permission: 'prices:read' },
    { label: 'Specs Control', href: '/admin/specs-intelligence', permission: 'phones:read' },
    { label: 'Image Control', href: '/admin/image-intelligence', permission: 'phones:read' },
    { label: 'Ratings & Benchmarks', href: '/admin/ratings-benchmarks', permission: 'phones:read' },
    { label: 'Lifecycle', href: '/admin/launch-center', permission: 'phones:read' },
  ]},
  { label: 'Intelligence', href: '/admin/intelligence', icon: BrainCircuit, children: [
    { label: 'Intelligence Center', href: '/admin/intelligence-center', permission: 'phones:read' },
    { label: 'Pakistan Intelligence', href: '/admin/pakistan-intelligence', permission: 'prices:read' },
    { label: 'Price Intelligence V2', href: '/admin/price-intelligence-v2', permission: 'prices:read' },
    { label: 'YouTube Intelligence', href: '/admin/youtube-intelligence', permission: 'videos:read' },
  ]},
  { label: 'Website', href: '/admin/website', icon: WandSparkles, children: [
    { label: 'Homepage Builder', href: '/admin/homepage-builder', permission: 'settings:read' },
    { label: 'Card Layout Control', href: '/admin/layout-control', permission: 'settings:read' },
    { label: 'Mobile App Control', href: '/admin/mobile-control', permission: 'settings:read' },
    { label: 'Monetization Center', href: '/admin/monetization', permission: 'settings:read' },
    { label: 'Affiliate Links', href: '/admin/affiliate-links', permission: 'prices:read' },
  ]},
  { label: 'Automation & Health', href: '/admin/operations', icon: Workflow, children: [
    { label: 'Automation Pipeline', href: '/admin/automation', permission: 'prices:read' },
    { label: 'Continuous Monitoring', href: '/admin/continuous-monitoring', permission: 'phones:read' },
    { label: 'Analytics', href: '/admin/analytics', permission: 'settings:read' },
    { label: 'SEO Monitoring', href: '/admin/seo-monitoring', permission: 'settings:read' },
    { label: 'Release Readiness', href: '/admin/release-readiness', permission: 'settings:read' },
    { label: 'Activity Log', href: '/admin/activity', permission: 'activity:read' },
  ]},
  { label: 'System', href: '/admin/system', icon: Settings, children: [
    { label: 'Site Settings', href: '/admin/settings', permission: 'settings:read' },
    { label: 'Users', href: '/admin/users', permission: 'users:read' },
  ]},
];

function childIsActive(pathname: string, href: string): boolean {
  const cleanHref = href.split('?')[0];
  if (cleanHref === '/admin/collector') return pathname === cleanHref;
  return pathname === cleanHref || pathname.startsWith(cleanHref + '/');
}

function isActive(pathname: string, link: NavLink): boolean {
  if (link.children) return link.children.some(child => childIsActive(pathname, child.href));
  return childIsActive(pathname, link.href);
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pendingVideoCount, setPendingVideoCount] = useState(0);
  const [navigationMode, setNavigationMode] = useState<'simple' | 'advanced'>('simple');

  useEffect(() => {
    const saved = window.localStorage.getItem('specsdekh-admin-navigation-mode');
    if (saved === 'advanced' || saved === 'simple') setNavigationMode(saved);
  }, []);

  const changeNavigationMode = (mode: 'simple' | 'advanced') => {
    setNavigationMode(mode);
    window.localStorage.setItem('specsdekh-admin-navigation-mode', mode);
  };

  // Fetch pending video count
  useEffect(() => {
    if (!admin) return;
    fetch('/api/admin/videos?limit=1&status=pending', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPendingVideoCount(d.pendingCount || 0))
      .catch(() => {});
  }, [admin]);

  // Keep the current work area open after navigation.
  useEffect(() => {
    const activeGroup = adminLinks.find(link => link.children?.some(child => childIsActive(pathname, child.href)));
    if (activeGroup) {
      setOpenGroups(prev => new Set(prev).add(activeGroup.href));
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

  // Filter links and nested destinations based on role permissions.
  const rolePerms: Record<string, string[]> = {
    superadmin: ['phones:read','phones:create','phones:edit','phones:delete','phones:publish','phones:seed','brands:read','brands:create','brands:edit','brands:delete','news:read','news:create','news:edit','news:delete','news:publish','sponsors:read','sponsors:manage','imports:read','imports:execute','collectors:read','collectors:manage','users:read','users:manage','settings:read','settings:manage','activity:read','media:upload','media:delete','trash:read','trash:restore','trash:delete','videos:read','videos:edit','videos:manage','prices:read','prices:edit','data-quality:read','data-quality:scan','data-quality:fix','ai-research:read'],
    admin: ['phones:read','phones:create','phones:edit','phones:delete','phones:publish','phones:seed','brands:read','brands:create','brands:edit','brands:delete','news:read','news:create','news:edit','news:delete','news:publish','sponsors:read','sponsors:manage','imports:read','imports:execute','collectors:read','collectors:manage','users:read','settings:read','activity:read','media:upload','media:delete','trash:read','trash:restore','trash:delete','videos:read','videos:edit','videos:manage','prices:read','prices:edit','data-quality:read','data-quality:scan','data-quality:fix','ai-research:read'],
    editor: ['phones:read','phones:create','phones:edit','brands:read','news:read','news:create','news:edit','activity:read','media:upload'],
    reviewer: ['phones:read','brands:read','news:read','activity:read','collectors:read'],
    viewer: ['phones:read','brands:read','news:read','activity:read'],
    moderator: ['phones:read','phones:edit','brands:read','news:read','news:edit','activity:read','reviews:read','reviews:manage','media:upload'],
  };
  const hasPermission = (permission?: string) => !permission || (rolePerms[admin.role] || []).includes(permission);
  const simpleDestinations = new Set([
    '/admin/dashboard', '/admin/phones', '/admin/brands', '/admin/news', '/admin/videos', '/admin/reviews',
    '/admin/import-v2', '/admin/collector', '/admin/data-quality', '/admin/price-tracker', '/admin/specs-intelligence', '/admin/image-intelligence', '/admin/ratings-benchmarks', '/admin/launch-center', '/admin/homepage-builder', '/admin/settings',
  ]);
  const filteredLinks = adminLinks
    .map(link => link.children
      ? { ...link, children: link.children.filter(child => hasPermission(child.permission) && (navigationMode === 'advanced' || simpleDestinations.has(child.href))) }
      : link)
    .filter(link => hasPermission(link.permission) && (navigationMode === 'advanced' || simpleDestinations.has(link.href) || Boolean(link.children?.length)) && (!link.children || link.children.length > 0));
  const flatMobileLinks = filteredLinks.flatMap(link => link.children || [{ label: link.label, href: link.href, permission: link.permission }]);
  const currentMobileHref = flatMobileLinks.find(link => childIsActive(pathname, link.href))?.href || '/admin/dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Admin top bar */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center px-4 sticky top-0 z-50">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900 hidden sm:block">SpecsDekh Admin</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5" title="Switch between everyday and technical admin tools">
            <button onClick={() => changeNavigationMode('simple')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${navigationMode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Simple</button>
            <button onClick={() => changeNavigationMode('advanced')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${navigationMode === 'advanced' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Advanced</button>
          </div>
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
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
                        const childActive = childIsActive(pathname, child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${childActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                          >
                            <span className="flex items-center justify-between gap-2"><span>{child.label}</span>{child.href === '/admin/videos' && pendingVideoCount > 0 && <span className="inline-flex min-w-[18px] h-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{pendingVideoCount}</span>}</span>
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

        {/* Mobile navigation: one compact selector replaces dozens of horizontal tabs. */}
        <div className="lg:hidden border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="w-7 h-7 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Menu className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-900">Admin navigation</p>
                <p className="truncate text-[10px] text-gray-500">{admin.name || admin.email}</p>
              </div>
            </div>
            <select
              aria-label="Choose admin page"
              value={currentMobileHref}
              onChange={event => router.push(event.target.value)}
              className="max-w-[62%] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            >
              {filteredLinks.map(link => link.children ? (
                <optgroup key={link.href} label={link.label}>
                  {link.children.map(child => <option key={child.href} value={child.href}>{child.label}</option>)}
                </optgroup>
              ) : <option key={link.href} value={link.href}>{link.label}</option>)}
            </select>
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
