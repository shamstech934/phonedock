'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Shield, Plus, Trash2, Ban, CheckCircle, XCircle, AlertCircle, Loader2,
  Search, Filter, ChevronDown, Download, Mail, MoreHorizontal, UserCog,
  Lock, Unlock, ShieldCheck, ShieldX, KeyRound, Eye, LogOut, Clock,
  Monitor, Smartphone, Globe, Activity, ChevronLeft, ChevronRight, UserPlus,
  ArrowUpDown, Check, X, ShieldAlert, Fingerprint, Settings, Copy,
  ExternalLink, RefreshCw, UserMinus, UserCheck, AlertTriangle,
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

// ============ TYPES ============

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  status: string;
  lastLogin: string | null;
  lastLoginIp: string;
  lastLoginUA: string;
  createdAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
  twoFactorEnabled: boolean;
  customPermissions: string[];
  suspended: boolean;
  suspendedReason: string;
  suspendedUntil: string | null;
  requirePasswordChange: boolean;
  phone: string;
  emailVerified: boolean;
  sessionCount: number;
}

interface UserStats {
  total: number;
  superAdmins: number;
  activeAdmins: number;
  disabledAdmins: number;
  suspendedAdmins: number;
  failedToday: number;
  onlineAdmins: number;
  activeSessions: number;
  twoFactorEnabled: number;
  withCustomPerms: number;
}

interface UserDetail extends AdminUser {
  sessions: SessionInfo[];
  recentActivity: ActivityEntry[];
  passwordChangedAt?: string;
}

interface SessionInfo {
  id: string;
  jti: string;
  ip: string;
  userAgent: string;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  admin?: { name: string; email: string; role: string };
}

// ============ CONSTANTS ============

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-50 text-purple-700 border-purple-200/50',
  admin: 'bg-blue-50 text-blue-700 border-blue-200/50',
  editor: 'bg-amber-50 text-amber-700 border-amber-200/50',
  moderator: 'bg-cyan-50 text-cyan-700 border-cyan-200/50',
  reviewer: 'bg-gray-50 text-gray-700 border-gray-200/50',
  viewer: 'bg-slate-50 text-slate-600 border-slate-200/50',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200/50',
  suspended: 'bg-red-50 text-red-700 border-red-200/50',
};

const ALL_ROLES = ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];

const PERMISSION_MODULES = [
  { key: 'phones', label: 'Phones' },
  { key: 'brands', label: 'Brands' },
  { key: 'news', label: 'News' },
  { key: 'videos', label: 'Videos' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'users', label: 'Users' },
  { key: 'collectors', label: 'Collector' },
  { key: 'imports', label: 'Import' },
  { key: 'settings', label: 'Settings' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'activity', label: 'Activity Logs' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'media', label: 'Media' },
  { key: 'trash', label: 'Trash' },
];

const PERMISSION_ACTIONS = ['read', 'create', 'edit', 'delete', 'approve', 'export'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'recent', label: 'Recently Active' },
  { value: 'name', label: 'Alphabetical' },
  { value: 'role', label: 'Role' },
  { value: 'status', label: 'Status' },
];

// ============ HELPERS ============

function formatDate(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelative(d: string | null) {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

function parseUA(ua: string) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/')) browser = 'Safari';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = 'Mobile'; }
  return { browser, os, device };
}

function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, { credentials: 'include', ...options });
}

// ============ MAIN COMPONENT ============

export default function AdminUsersPage() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === 'superadmin';
  const canManage = admin?.role === 'superadmin' || admin?.role === 'admin';

  // State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [twoFactorFilter, setTwoFactorFilter] = useState('all');
  const [lastLoginFilter, setLastLoginFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState<string | null>(null);
  const [showBulkRole, setShowBulkRole] = useState(false);
  const [bulkRole, setBulkRole] = useState('admin');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // User detail drawer
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'profile' | 'permissions' | 'sessions' | 'activity' | 'security'>('profile');

  // Edit user
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Invite form
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'admin', expiresInHours: 48 });
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Permissions edit
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current !== undefined) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiFetch('/api/admin/users/stats');
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error('[stats]', e); }
    setStatsLoading(false);
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: '20', sort: sortBy });
      if (search) params.set('search', search);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (twoFactorFilter !== 'all') params.set('twoFactor', twoFactorFilter);
      if (lastLoginFilter !== 'all') params.set('lastLogin', lastLoginFilter);
      const res = await apiFetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load users');
      }
    } catch (e) { setError('Connection error'); }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter, twoFactorFilter, lastLoginFilter, sortBy]);

  useEffect(() => { fetchStats(); fetchUsers(); }, [fetchStats, fetchUsers]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [roleFilter, statusFilter, twoFactorFilter, lastLoginFilter, sortBy]);

  // Fetch user detail
  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetailUser(null);
    setDetailTab('profile');
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailUser(data);
        setEditPerms(data.customPermissions || []);
      }
    } catch (e) { console.error('[detail]', e); }
    setDetailLoading(false);
  };

  // Create user
  const handleCreate = async () => {
    setFormError('');
    if (!form.name || !form.email || !form.password) { setFormError('All fields are required'); return; }
    if (form.password.length < 12) { setFormError('Password must be at least 12 characters'); return; }
    setFormLoading(true);
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: '', email: '', password: '', role: 'admin' });
        showToast('Admin created successfully');
        fetchUsers(); fetchStats();
      } else { setFormError(data.error || 'Failed to create user'); }
    } catch { setFormError('Connection error'); }
    setFormLoading(false);
  };

  // Invite user
  const handleInvite = async () => {
    setInviteError('');
    if (!inviteForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) { setInviteError('Valid email required'); return; }
    setInviteLoading(true);
    try {
      const res = await apiFetch('/api/admin/users/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowInvite(false);
        setInviteForm({ email: '', role: 'admin', expiresInHours: 48 });
        showToast('Invitation sent successfully');
        fetchUsers(); fetchStats();
      } else { setInviteError(data.error || 'Failed to send invitation'); }
    } catch { setInviteError('Connection error'); }
    setInviteLoading(false);
  };

  // Delete user
  const handleDelete = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast('User deleted');
        setDeleteConfirm(null);
        setDetailUser(null);
        fetchUsers(); fetchStats();
      } else { showToast(data.error || 'Delete failed', 'error'); }
    } catch { showToast('Connection error', 'error'); }
  };

  // Update user
  const handleUpdateUser = async (userId: string, updates: Record<string, any>) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) { showToast('User updated'); fetchUsers(); if (detailUser?.id === userId) openDetail(userId); return true; }
      else { showToast(data.error || 'Update failed', 'error'); return false; }
    } catch { showToast('Connection error', 'error'); return false; }
  };

  // Bulk actions
  const handleBulkAction = async (action: string, extra?: Record<string, any>) => {
    if (selected.size === 0) return;
    setShowBulkMenu(null);
    setShowBulkRole(false);
    try {
      const res = await apiFetch('/api/admin/users/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || `Bulk ${action} completed`); setSelected(new Set()); fetchUsers(); fetchStats(); setBulkDeleteConfirm(false); }
      else { showToast(data.error || 'Bulk action failed', 'error'); }
    } catch { showToast('Connection error', 'error'); }
  };

  // Revoke session
  const handleRevokeSession = async (userId: string, jti: string) => {
    try {
      const res = await apiFetch(`/api/admin/sessions/${jti}`, { method: 'DELETE' });
      if (res.ok) { showToast('Session revoked'); if (detailUser?.id === userId) openDetail(userId); }
      else showToast('Failed to revoke session', 'error');
    } catch { showToast('Connection error', 'error'); }
  };

  // Revoke all sessions for user
  const handleRevokeAllSessions = async (userId: string) => {
    try {
      const res = await apiFetch('/api/admin/sessions', { method: 'DELETE' });
      if (res.ok) { showToast('All other sessions revoked'); if (detailUser?.id === userId) openDetail(userId); }
    } catch {}
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!detailUser) return;
    setPermsSaving(true);
    await handleUpdateUser(detailUser.id, { customPermissions: editPerms });
    setPermsSaving(false);
  };

  // Toggle permission
  const togglePerm = (perm: string) => {
    setEditPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  // Export
  const handleExport = () => {
    window.open('/api/admin/users/export', '_blank');
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.id)));
  };

  // Edit user modal
  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditName(u.name);
    setEditPhone(u.phone || '');
    setEditRole(u.role);
  };

  // ============ RENDER ============

  if (loading && !users.length) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" /> : <XCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage admin accounts, roles, and permissions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <>
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Admin
              </button>
              <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
                <Mail className="w-3.5 h-3.5" /> Invite Admin
              </button>
            </>
          )}
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card-premium p-4 animate-pulse"><div className="h-3 bg-gray-200 rounded w-8 mb-2" /><div className="h-5 bg-gray-200 rounded w-6" /></div>)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Admins', value: stats.total, icon: Users, color: 'text-blue-600' },
            { label: 'Super Admins', value: stats.superAdmins, icon: Shield, color: 'text-purple-600' },
            { label: 'Active', value: stats.activeAdmins, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Disabled', value: stats.disabledAdmins, icon: XCircle, color: 'text-gray-500' },
            { label: 'Suspended', value: stats.suspendedAdmins, icon: ShieldAlert, color: 'text-red-600' },
            { label: 'Online', value: stats.onlineAdmins, icon: Monitor, color: 'text-green-500' },
            { label: 'Failed Logins', value: stats.failedToday, icon: AlertTriangle, color: 'text-amber-600' },
            { label: 'Sessions', value: stats.activeSessions, icon: KeyRound, color: 'text-indigo-600' },
          ].map(card => (
            <div key={card.label} className="card-premium p-3.5 group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1.5 mb-1.5">
                <card.icon className={`w-3.5 h-3.5 ${card.color} opacity-60`} />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="card-premium p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name, email, role, or ID..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
              aria-label="Search users"
            />
          </div>
          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" aria-label="Filter by role">
              <option value="all">All Roles</option>
              {ALL_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" aria-label="Filter by status">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={twoFactorFilter} onChange={e => setTwoFactorFilter(e.target.value)} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" aria-label="Filter by 2FA">
              <option value="all">2FA: All</option>
              <option value="enabled">2FA Enabled</option>
              <option value="disabled">2FA Disabled</option>
            </select>
            <select value={lastLoginFilter} onChange={e => setLastLoginFilter(e.target.value)} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" aria-label="Filter by last login">
              <option value="all">Last Login: All</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" aria-label="Sort by">
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {(search || roleFilter !== 'all' || statusFilter !== 'all' || twoFactorFilter !== 'all' || lastLoginFilter !== 'all') && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setTwoFactorFilter('all'); setLastLoginFilter('all'); }} className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && canManage && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200/50 rounded-xl animate-fade-in">
          <span className="text-xs font-semibold text-blue-700">{selected.size} selected</span>
          <div className="flex items-center gap-1.5 ml-2">
            <button onClick={() => handleBulkAction('activate')} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><UserCheck className="w-3 h-3" /> Activate</button>
            <button onClick={() => handleBulkAction('deactivate')} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><UserMinus className="w-3 h-3" /> Deactivate</button>
            <button onClick={() => setShowBulkRole(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><UserCog className="w-3 h-3" /> Assign Role</button>
            <button onClick={() => handleBulkAction('force_password_reset')} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><KeyRound className="w-3 h-3" /> Force Reset</button>
            <button onClick={() => setBulkDeleteConfirm(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="card-premium overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {canManage && (
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" aria-label="Select all users" />
                  </th>
                )}
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">2FA</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Last Login</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                {canManage && <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${selected.has(u.id) ? 'bg-blue-50/30' : ''}`} onClick={() => openDetail(u.id)} role="row" tabIndex={0} onKeyDown={e => e.key === 'Enter' && openDetail(u.id)}>
                  {canManage && (
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(u.id)) next.delete(u.id); else next.add(u.id); return next; })} className="rounded border-gray-300" aria-label={`Select ${u.name || u.email}`} />
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-xs truncate">{u.name || 'Unnamed'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${ROLE_COLORS[u.role] || ROLE_COLORS.admin}`}>
                      <Shield className="w-2.5 h-2.5" />{u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${STATUS_COLORS[u.status] || STATUS_COLORS.active}`}>
                      {u.status === 'active' && <CheckCircle className="w-2.5 h-2.5" />}
                      {u.status === 'inactive' && <XCircle className="w-2.5 h-2.5" />}
                      {u.status === 'suspended' && <ShieldAlert className="w-2.5 h-2.5" />}
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    {u.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200/50 rounded-full px-2 py-0.5"><Fingerprint className="w-2.5 h-2.5" />On</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200/50 rounded-full px-2 py-0.5">Off</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatRelative(u.lastLogin)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">{formatDate(u.createdAt)}</td>
                  {canManage && (
                    <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button onClick={() => { setShowBulkMenu(prev => prev === u.id ? null : u.id); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="User actions">
                          <MoreHorizontal className="w-4 h-4 text-gray-500" />
                        </button>
                        {showBulkMenu === u.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                            <button onClick={() => { openEdit(u); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><UserCog className="w-3.5 h-3.5 text-gray-500" /> Edit User</button>
                            {u.status === 'active' ? (
                              <button onClick={() => { handleUpdateUser(u.id, { active: false }); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-amber-600"><Ban className="w-3.5 h-3.5" /> Deactivate</button>
                            ) : (
                              <button onClick={() => { handleUpdateUser(u.id, { active: true, suspended: false }); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Activate</button>
                            )}
                            <button onClick={() => { handleUpdateUser(u.id, { requirePasswordChange: true }); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><KeyRound className="w-3.5 h-3.5 text-gray-500" /> Force Reset</button>
                            <button onClick={() => { handleUpdateUser(u.id, { twoFactorEnabled: !u.twoFactorEnabled }); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-gray-500" /> {u.twoFactorEnabled ? 'Disable' : 'Enable'} 2FA</button>
                            {u.id !== admin?.id && (
                              <button onClick={() => { setDeleteConfirm(u.id); setShowBulkMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={canManage ? 8 : 7} className="text-center py-16">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No users found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-muted-foreground">{total} total &middot; Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-blue-500 text-white' : 'hover:bg-gray-50 text-gray-600'}`} aria-label={`Page ${p}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Only superadmins and admins can manage user accounts.</span>
        </div>
      )}

      {/* ============ CREATE MODAL ============ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Admin User</h2>
            {formError && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Password (12+ chars)</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="Strong password" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white">
                  {ALL_ROLES.filter(r => isSuperAdmin || r !== 'superadmin').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowCreate(false); setFormError(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={formLoading} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2">
                {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ INVITE MODAL ============ */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Invite Admin</h2>
            {inviteError && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3">{inviteError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Email Address</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white">
                  {ALL_ROLES.filter(r => isSuperAdmin || r !== 'superadmin').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Expires In (hours)</label>
                <input type="number" value={inviteForm.expiresInHours} onChange={e => setInviteForm(f => ({ ...f, expiresInHours: parseInt(e.target.value) || 48 }))} min={1} max={168} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowInvite(false); setInviteError(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleInvite} disabled={inviteLoading} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2">
                {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ EDIT USER MODAL ============ */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit User</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Phone</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="+92 300 1234567" />
              </div>
              {editUser.id !== admin?.id && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Role</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white">
                    {ALL_ROLES.filter(r => isSuperAdmin || r !== 'superadmin').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditUser(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={async () => {
                setEditSaving(true);
                const updates: Record<string, any> = { name: editName, phone: editPhone };
                if (editUser.id !== admin?.id && editRole !== editUser.role) updates.role = editRole;
                const ok = await handleUpdateUser(editUser.id, updates);
                if (ok) setEditUser(null);
                setEditSaving(false);
              }} disabled={editSaving} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2">
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ DELETE CONFIRM ============ */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 text-center mb-1">Delete User</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">This action cannot be undone. All sessions will be revoked.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ BULK DELETE CONFIRM ============ */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 text-center mb-1">Delete {selected.size} Users</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">This will permanently delete {selected.size} users and revoke all their sessions.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkDeleteConfirm(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleBulkAction('delete')} className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ BULK ROLE ASSIGN ============ */}
      {showBulkRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowBulkRole(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Assign Role to {selected.size} Users</h3>
            <select value={bulkRole} onChange={e => setBulkRole(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white mb-4">
              {ALL_ROLES.filter(r => isSuperAdmin || r !== 'superadmin').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkRole(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleBulkAction('assign_role', { role: bulkRole })} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ USER DETAIL DRAWER ============ */}
      {(detailUser || detailLoading) && (
        <div className="fixed inset-0 z-[90] flex justify-end" onClick={() => setDetailUser(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-slide-in-right" onClick={e => e.stopPropagation()} style={{ animation: 'slideInRight 0.2s ease-out' }}>
            {detailLoading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : detailUser ? (
              <div>
                {/* Drawer Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setDetailUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close drawer">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{detailUser.name || 'Unnamed'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{detailUser.email}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${ROLE_COLORS[detailUser.role] || ROLE_COLORS.admin}`}>
                      <Shield className="w-2.5 h-2.5" />{detailUser.role}
                    </span>
                  </div>
                  {/* Tabs */}
                  <div className="flex gap-1 mt-4 -mb-4 overflow-x-auto no-scrollbar">
                    {(['profile', 'permissions', 'sessions', 'activity', 'security'] as const).map(tab => (
                      <button key={tab} onClick={() => setDetailTab(tab)} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${detailTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {tab === 'profile' && <Users className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {tab === 'permissions' && <ShieldCheck className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {tab === 'sessions' && <Monitor className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {tab === 'activity' && <Activity className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {tab === 'security' && <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  {/* Profile Tab */}
                  {detailTab === 'profile' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                          {detailUser.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{detailUser.name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{detailUser.email}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 mt-1 ${STATUS_COLORS[detailUser.status] || STATUS_COLORS.active}`}>{detailUser.status.charAt(0).toUpperCase() + detailUser.status.slice(1)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Role', value: detailUser.role },
                          { label: 'Phone', value: detailUser.phone || 'Not set' },
                          { label: 'Email Verified', value: detailUser.emailVerified ? 'Yes' : 'No' },
                          { label: 'Created', value: formatDate(detailUser.createdAt) },
                          { label: 'Last Login', value: formatDate(detailUser.lastLogin) },
                          { label: 'Password Changed', value: formatDate(detailUser.passwordChangedAt || null) },
                          { label: 'Failed Attempts', value: String(detailUser.failedAttempts || 0) },
                          { label: 'Locked Until', value: detailUser.lockedUntil ? formatDate(detailUser.lockedUntil) : 'Not locked' },
                        ].map(item => (
                          <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                            <p className="text-xs font-semibold text-gray-900 mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {detailUser.lastLoginIp && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Last Login Info</p>
                          <p className="text-xs text-gray-700 mt-1">IP: {detailUser.lastLoginIp}</p>
                          {detailUser.lastLoginUA && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{detailUser.lastLoginUA.slice(0, 120)}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Permissions Tab */}
                  {detailTab === 'permissions' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Custom permissions override role-based permissions. Leave empty to use role defaults.</p>
                      <div className="space-y-2">
                        {PERMISSION_MODULES.map(mod => (
                          <div key={mod.key} className="border border-gray-100 rounded-xl p-3">
                            <p className="text-xs font-semibold text-gray-900 mb-2">{mod.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PERMISSION_ACTIONS.map(action => {
                                const perm = `${mod.key}:${action}`;
                                const isOn = editPerms.includes(perm);
                                return (
                                  <button key={perm} onClick={() => togglePerm(perm)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${isOn ? 'bg-blue-50 text-blue-700 border-blue-200/50' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>
                                    {action}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={handleSavePermissions} disabled={permsSaving} className="w-full h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2 mt-3">
                        {permsSaving && <Loader2 className="w-4 h-4 animate-spin" />}Save Permissions
                      </button>
                    </div>
                  )}

                  {/* Sessions Tab */}
                  {detailTab === 'sessions' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{detailUser.sessions?.length || 0} active sessions</p>
                        {canManage && detailUser.sessions?.length > 0 && (
                          <button onClick={() => handleRevokeAllSessions(detailUser.id)} className="text-[11px] font-medium text-red-600 hover:text-red-700">Revoke All</button>
                        )}
                      </div>
                      {(!detailUser.sessions || detailUser.sessions.length === 0) ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs">No active sessions</p>
                        </div>
                      ) : (
                        detailUser.sessions.map((s, i) => {
                          const ua = parseUA(s.userAgent);
                          return (
                            <div key={s.jti || i} className="border border-gray-100 rounded-xl p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {ua.device === 'Mobile' ? <Smartphone className="w-4 h-4 text-gray-400" /> : <Monitor className="w-4 h-4 text-gray-400" />}
                                  <span className="text-xs font-medium text-gray-900">{ua.browser} on {ua.os}</span>
                                </div>
                                {canManage && (
                                  <button onClick={() => handleRevokeSession(detailUser.id, s.jti)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Revoke session">
                                    <LogOut className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{s.ip || 'Unknown'}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelative(s.lastUsedAt)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Activity Tab */}
                  {detailTab === 'activity' && (
                    <div className="space-y-2">
                      {(!detailUser.recentActivity || detailUser.recentActivity.length === 0) ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs">No recent activity</p>
                        </div>
                      ) : (
                        detailUser.recentActivity.map((log, i) => (
                          <div key={log.id || i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                              <Activity className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900">{log.action.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{log.details}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(log.createdAt)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Security Tab */}
                  {detailTab === 'security' && canManage && detailUser.id !== admin?.id && (
                    <div className="space-y-3">
                      <div className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-900">Two-Factor Authentication</p>
                            <p className="text-[10px] text-muted-foreground">{detailUser.twoFactorEnabled ? 'Enabled for this user' : 'Not enabled'}</p>
                          </div>
                          <button onClick={() => handleUpdateUser(detailUser.id, { twoFactorEnabled: !detailUser.twoFactorEnabled })} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${detailUser.twoFactorEnabled ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                            {detailUser.twoFactorEnabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-900">Force Password Reset</p>
                            <p className="text-[10px] text-muted-foreground">User will be required to change password on next login</p>
                          </div>
                          <button onClick={() => handleUpdateUser(detailUser.id, { requirePasswordChange: !detailUser.requirePasswordChange })} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${detailUser.requirePasswordChange ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {detailUser.requirePasswordChange ? 'Enabled' : 'Require'}
                          </button>
                        </div>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-900">Account Status</p>
                            <p className="text-[10px] text-muted-foreground">{detailUser.suspended ? `Suspended: ${detailUser.suspendedReason}` : 'Account is active'}</p>
                          </div>
                          <button onClick={() => handleUpdateUser(detailUser.id, { suspended: !detailUser.suspended, active: detailUser.suspended ? true : false })} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${detailUser.suspended ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                            {detailUser.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </div>
                      </div>
                      {detailUser.failedAttempts > 0 && (
                        <div className="border border-gray-100 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-gray-900">Failed Login Attempts</p>
                              <p className="text-[10px] text-muted-foreground">{detailUser.failedAttempts} failed attempts</p>
                            </div>
                            <button onClick={() => handleUpdateUser(detailUser.id, { resetFailedAttempts: true })} className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                              Reset
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3 mt-4">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Danger Zone</p>
                        <p className="text-[10px] text-amber-700 mt-1">Permanently delete this user and revoke all sessions.</p>
                        <button onClick={() => { setDeleteConfirm(detailUser.id); }} className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">
                          Delete User
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Tab for self */}
                  {detailTab === 'security' && detailUser.id === admin?.id && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs">Security settings for your own account can be managed from the header menu.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Inline style for slide animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}