'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight,
  Clock, Shield, AlertTriangle, RefreshCw, BarChart3, Users,
  Monitor, Smartphone, Database, FileText, Video, Star,
  Radio, Upload, Zap, Key, AlertCircle, ChevronDown
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface LogItem {
  id: string; action: string; details: string; entityType: string;
  entityId: string; createdAt: string;
  admin?: { name: string; email: string; role: string };
}

interface ActivityStats {
  total: number; todayActivities: number; securityEvents: number;
  moduleBreakdown: { _id: string; count: number }[];
  activeAdminsToday: number;
}

const MODULE_FILTERS = [
  { value: '', label: 'All Modules' }, { value: 'phone', label: 'Phones' },
  { value: 'brand', label: 'Brands' }, { value: 'news', label: 'News' },
  { value: 'video', label: 'Videos' }, { value: 'review', label: 'Reviews' },
  { value: 'admin', label: 'Admin' }, { value: 'settings', label: 'Settings' },
  { value: 'import', label: 'Import' }, { value: 'collector', label: 'Collector' },
];

const ACTION_ICONS: Record<string, any> = {
  delete: Trash2, update: Edit, create: Plus, sync: RefreshCw,
  bulk_delete: Trash2, bulk_import: Upload, login: Key,
  password: Key, approve: Plus, reject: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  delete: 'text-red-500 bg-red-50', update: 'text-amber-500 bg-amber-50',
  create: 'text-emerald-500 bg-emerald-50', sync: 'text-blue-500 bg-blue-50',
  bulk_delete: 'text-red-500 bg-red-50', bulk_import: 'text-violet-500 bg-violet-50',
  login: 'text-indigo-500 bg-indigo-50', password: 'text-orange-500 bg-orange-50',
};

const MODULE_ICONS: Record<string, any> = {
  phone: Smartphone, brand: Database, news: FileText, video: Video,
  review: Star, admin: Users, settings: Monitor, import: Upload,
  collector: Radio, sponsor: BarChart3,
};

export default function AdminActivityPage() {
  useAdmin();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const [moduleFilter, setModuleFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1); }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(rowsPerPage), sort });
      if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
      if (moduleFilter) params.set('module', moduleFilter);
      const res = await fetch(`/api/admin/activity?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const d = await res.json();
      setLogs(d.logs || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1);
    } catch (e: any) { setError(e.message || 'Failed to load activity logs'); } finally { setLoading(false); }
  }, [page, rowsPerPage, debouncedSearch, moduleFilter, sort]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/activity/stats', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setStats(await res.json());
    } catch (e: any) { console.error('Failed to load activity stats:', e); }
  }, []);

  useEffect(() => { fetchLogs(); fetchStats(); }, [fetchLogs, fetchStats]);

  const getActionIcon = (action: string) => {
    for (const [key, icon] of Object.entries(ACTION_ICONS)) {
      if (action.includes(key)) return icon;
    }
    return Activity;
  };

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return color;
    }
    return 'text-gray-500 bg-gray-50';
  };

  const getModuleIcon = (type: string) => MODULE_ICONS[type] || Activity;
  const isSecurityEvent = (action: string) => /delete|password|login_fail|permission|revoke/i.test(action);

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, total);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `Showing ${startIdx}\u2013${endIdx} of ${total} entries` : 'No activity yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchLogs(); fetchStats(); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors" aria-label="Refresh">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${autoRefresh ? 'bg-blue-600 text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`} aria-label="Toggle auto-refresh">
            <Zap className="w-3.5 h-3.5" /> {autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Activities', value: stats.total, icon: Activity, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: "Today's Activities", value: stats.todayActivities, icon: Clock, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Security Events', value: stats.securityEvents, icon: Shield, bg: 'bg-red-50', color: 'text-red-600' },
            { label: 'Active Admins Today', value: stats.activeAdminsToday, icon: Users, bg: 'bg-violet-50', color: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="card-premium p-3.5">
              <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
              <p className="text-base font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Module Breakdown */}
      {stats?.moduleBreakdown && stats.moduleBreakdown.length > 0 && (
        <div className="card-premium p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3">Activity by Module</h3>
          <div className="flex flex-wrap gap-2">
            {stats.moduleBreakdown.map(m => {
              const ModIcon = MODULE_ICONS[m._id] || Activity;
              return (
                <div key={m._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <ModIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-[11px] font-medium text-gray-700 capitalize">{m._id || 'Other'}</span>
                  <span className="text-[10px] font-bold text-gray-900 bg-gray-200 rounded-full px-1.5 py-0.5">{m.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by action, details, admin..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white" aria-label="Search activity logs" />
        </div>
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Module filter">
          {MODULE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Sort order">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Per page">
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>

      {/* Error Card */}
      {error && (
        <div className="card-premium p-6 border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5 text-red-500" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-red-900">Failed to load data</h3>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => { setError(''); fetchLogs(); fetchStats(); }} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">Retry</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>
      ) : logs.length > 0 ? (
        <div className="card-premium p-4 sm:p-6">
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-1">
              {logs.map((log, i) => {
                const ActionIcon = getActionIcon(log.action);
                const actionColor = getActionColor(log.action);
                const ModuleIcon = getModuleIcon(log.entityType);
                const isSecurity = isSecurityEvent(log.action);
                return (
                  <div key={log.id || i} className={`relative flex items-start gap-4 p-2.5 -mx-2.5 rounded-xl transition-colors hover:bg-gray-50/80 ${isSecurity ? 'bg-red-50/30' : ''}`}>
                    <div className={`w-8 h-8 rounded-full ${actionColor} flex items-center justify-center shrink-0 z-10 ring-4 ring-white`}>
                      <ActionIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                        {log.entityType && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded-full">
                            <ModuleIcon className="w-2.5 h-2.5" /> {log.entityType}
                          </span>
                        )}
                        {isSecurity && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Security</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {log.admin && <span className="text-[10px] text-gray-500">{log.admin.name}{log.admin.role ? ` (${log.admin.role})` : ''}</span>}
                        <span className="text-[10px] text-muted-foreground/70">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Activity className="w-8 h-8 text-gray-300" /></div>
          <p className="text-sm font-medium text-gray-900">No activity logged yet</p>
          <p className="text-xs text-muted-foreground mt-1">Actions will appear here as admins use the system.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-[11px] text-muted-foreground">Showing {startIdx}\u2013{endIdx} of {total}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Previous"><ChevronLeft className="w-3 h-3" /> Prev</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pn: number;
              if (totalPages <= 7) pn = i + 1; else if (page <= 4) pn = i + 1; else if (page >= totalPages - 3) pn = totalPages - 6 + i; else pn = page - 3 + i;
              return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-[11px] font-medium transition-colors ${page === pn ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} aria-label={`Page ${pn}`}>{pn}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Next">Next <ChevronRight className="w-3 h-3" /></button>
          </div>
        </div>
      )}
    </div>
  );
}