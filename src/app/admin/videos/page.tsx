'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  RefreshCw, ExternalLink, Check, X, AlertTriangle, Play, ChevronLeft, ChevronRight,
  Search, Filter, Trash2, Eye, Edit3, Download, Star, EyeOff, Copy, Link2,
  Plus, MoreHorizontal, BarChart3, Clock, TrendingUp, AlertCircle, Zap, Radio,
  ChevronDown, CheckSquare, Square, XCircle, Video, Users, MessageSquare, ChevronUp
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

/* ─── Types ─── */
interface VideoItem {
  id: string; youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string;
  phoneId: string | null; phone: { modelName: string; slug: string; brand: string } | null;
  brand: { name: string; id: string } | null; active: boolean; autoLinked: boolean;
  status: string; featured: boolean; hidden: boolean; syncStatus: string;
  views: number; likes: number; commentCount: number; duration: string;
  channelName: string; category: string; lastSyncedAt: string | null;
  createdBy: { name: string } | null; createdAt: string;
}

interface VideoStats {
  total: number; liveCount: number; pendingCount: number; draftCount: number;
  hiddenCount: number; failedCount: number; featuredCount: number; todaySynced: number;
  totalViews: number; totalLikes: number; lastSyncTime: string | null; channelName: string;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  live: { label: 'Live', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600' },
  hidden: { label: 'Hidden', bg: 'bg-slate-100', text: 'text-slate-600' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
  failed: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-600' },
  featured: { label: 'Featured', bg: 'bg-blue-100', text: 'text-blue-700' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'views', label: 'Most Views' }, { value: 'likes', label: 'Most Likes' },
  { value: 'comments', label: 'Most Comments' }, { value: 'synced', label: 'Recent Sync' },
  { value: 'alpha', label: 'Alphabetical' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' }, { value: 'live', label: 'Live' },
  { value: 'pending', label: 'Pending' }, { value: 'draft', label: 'Draft' },
  { value: 'hidden', label: 'Hidden' }, { value: 'rejected', label: 'Rejected' },
  { value: 'featured', label: 'Featured' },
];

const SYNC_FILTERS = [
  { value: 'all', label: 'All Sync' }, { value: 'synced', label: 'Synced' },
  { value: 'not_synced', label: 'Not Synced' }, { value: 'failed', label: 'Failed' },
];

const DATE_FILTERS = [
  { value: '', label: 'All Time' }, { value: 'today', label: "Today's Uploads" },
  { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' },
];

function formatNum(n: number) { return n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n); }

/* ─── Main Component ─── */
export default function AdminVideosPage() {
  useAdmin();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; inserted: number; skipped: number; autoLinked: number; error?: string } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [dateFilter, setDateFilter] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [deleteModal, setDeleteModal] = useState<VideoItem | null>(null);
  const [addVideoModal, setAddVideoModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(rowsPerPage), sort,
        status: statusFilter, syncStatus: syncFilter,
      });
      if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
      if (dateFilter) params.set('dateFilter', dateFilter);
      const res = await fetch(`/api/admin/videos?${params}`, { credentials: 'include' });
      const d = await res.json();
      setVideos(d.videos || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch {} finally { setLoading(false); }
  }, [page, rowsPerPage, sort, statusFilter, syncFilter, debouncedSearch, dateFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/videos/stats', { credentials: 'include' });
      const d = await res.json();
      setStats(d);
    } catch {}
  }, []);

  useEffect(() => { fetchVideos(); fetchStats(); }, [fetchVideos, fetchStats]);

  // Sync
  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/admin/videos/sync', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setSyncResult(data);
      fetchVideos(); fetchStats();
    } catch {} finally { setSyncing(false); }
  };

  // Single actions
  const handleToggleActive = async (v: VideoItem) => {
    setActionLoading(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ active: !v.active, status: !v.active ? 'live' : 'pending', autoLinked: false }),
      });
      fetchVideos(); fetchStats();
    } catch {} finally { setActionLoading(null); }
  };

  const handleToggleFeatured = async (v: VideoItem) => {
    setActionLoading(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ featured: !v.featured }),
      });
      fetchVideos(); fetchStats();
    } catch {} finally { setActionLoading(null); }
  };

  const handleToggleHidden = async (v: VideoItem) => {
    setActionLoading(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ hidden: !v.hidden, status: !v.hidden ? 'hidden' : 'live', active: v.hidden }),
      });
      fetchVideos(); fetchStats();
    } catch {} finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.id);
    try {
      await fetch(`/api/admin/videos/${deleteModal.id}`, { method: 'DELETE', credentials: 'include' });
      setDeleteModal(null);
      fetchVideos(); fetchStats();
    } catch {} finally { setActionLoading(null); }
  };

  const handleCopyUrl = (v: VideoItem) => {
    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${v.youtubeId}`);
  };

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/videos/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const d = await res.json();
      if (d.success) { setSelected(new Set()); fetchVideos(); fetchStats(); }
    } catch {} finally { setBulkLoading(false); }
  };

  // Import video
  const handleImportVideo = async () => {
    setImportLoading(true); setImportError('');
    try {
      const res = await fetch('/api/admin/videos/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ youtubeUrl: importUrl }),
      });
      const d = await res.json();
      if (d.error) { setImportError(d.error); }
      else { setAddVideoModal(false); setImportUrl(''); fetchVideos(); fetchStats(); }
    } catch { setImportError('Failed to import video'); }
    finally { setImportLoading(false); }
  };

  // Select logic
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selected.size === videos.length) setSelected(new Set());
    else setSelected(new Set(videos.map(v => v.id)));
  };

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, total);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">YouTube Videos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `Showing ${startIdx}\u2013${endIdx} of ${total} Videos` : 'No videos yet'}
            {stats?.pendingCount ? <span className="text-amber-600 font-medium ml-1.5">{stats.pendingCount} pending review</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAddVideoModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors" aria-label="Add Video">
            <Plus className="w-3.5 h-3.5" /> Add Video
          </button>
          <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors" aria-label="Sync Channel">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Channel'}
          </button>
        </div>
      </div>

      {/* ─── Sync Result Banner ─── */}
      {syncResult && (
        <div className={`p-3.5 rounded-xl text-xs ${syncResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {syncResult.error
            ? <>Sync failed: {syncResult.error}</>
            : <>Fetched {syncResult.total} videos: {syncResult.inserted} new, {syncResult.autoLinked} auto-linked, {syncResult.skipped} skipped.</>
          }
          <button onClick={() => setSyncResult(null)} className="float-right opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Videos', value: stats.total, icon: Video, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Live', value: stats.liveCount, icon: Play, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Pending Review', value: stats.pendingCount, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
            { label: 'Draft', value: stats.draftCount, icon: Edit3, bg: 'bg-gray-100', color: 'text-gray-500' },
            { label: 'Hidden', value: stats.hiddenCount, icon: EyeOff, bg: 'bg-slate-100', color: 'text-slate-600' },
            { label: 'Failed Sync', value: stats.failedCount, icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-500' },
            { label: "Today's Synced", value: stats.todaySynced, icon: Zap, bg: 'bg-violet-50', color: 'text-violet-600' },
            { label: 'Total Views', value: formatNum(stats.totalViews), icon: Eye, bg: 'bg-cyan-50', color: 'text-cyan-600' },
            { label: 'Featured', value: stats.featuredCount, icon: Star, bg: 'bg-yellow-50', color: 'text-yellow-600' },
            { label: 'Last Sync', value: stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never', icon: RefreshCw, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          ].map(s => (
            <div key={s.label} className="card-premium p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
              </div>
              <p className="text-base font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Search + Filters ─── */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search by title, video ID, phone, brand..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
              aria-label="Search videos"
            />
          </div>
          {/* Sort */}
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Sort videos">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* Rows per page */}
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Rows per page">
            {[10, 20, 40, 60].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)} className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="w-3.5 h-3.5" /> Filters {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            {/* Status tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Sync & Date filters */}
            <div className="flex gap-2 flex-wrap">
              <select value={syncFilter} onChange={e => { setSyncFilter(e.target.value); setPage(1); }} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] bg-white" aria-label="Sync status filter">
                {SYNC_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] bg-white" aria-label="Date filter">
                {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bulk Actions Bar ─── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { action: 'approve', label: 'Approve', icon: Check, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
              { action: 'reject', label: 'Reject', icon: XCircle, color: 'bg-red-100 text-red-600 hover:bg-red-200' },
              { action: 'feature', label: 'Feature', icon: Star, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
              { action: 'hide', label: 'Hide', icon: EyeOff, color: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { action: 'activate', label: 'Activate', icon: Zap, color: 'bg-blue-100 text-blue-600 hover:bg-blue-200' },
              { action: 'deactivate', label: 'Deactivate', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
              { action: 'delete', label: 'Delete', icon: Trash2, color: 'bg-red-100 text-red-600 hover:bg-red-200' },
            ].map(b => (
              <button key={b.action} onClick={() => handleBulkAction(b.action)} disabled={bulkLoading}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${b.color}`}>
                <b.icon className="w-3 h-3" /> {b.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-blue-600 hover:underline">Clear</button>
        </div>
      )}

      {/* ─── Video List ─── */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-xl" />)}</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-900">No videos found</p>
          <p className="text-xs text-muted-foreground mt-1">Start by syncing your YouTube channel or importing a video.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync Channel
            </button>
            <button onClick={() => setAddVideoModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-200">
              <Plus className="w-3.5 h-3.5" /> Import Video
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Select All row */}
          <div className="flex items-center gap-3 px-1">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700" aria-label="Select all">
              {selected.size === videos.length && videos.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              Select All
            </button>
          </div>

          {videos.map(v => {
            const badge = STATUS_BADGES[v.status] || STATUS_BADGES.pending;
            return (
              <div key={v.id} className={`group p-3.5 rounded-xl border transition-colors ${selected.has(v.id) ? 'border-blue-300 bg-blue-50/50' : v.autoLinked ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex gap-3.5 items-start">
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(v.id)} className="mt-1 shrink-0" aria-label={`Select ${v.title}`}>
                    {selected.has(v.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />}
                  </button>

                  {/* Thumbnail 16:9 */}
                  <div className="relative w-36 sm:w-44 aspect-video rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" sizes="176px" unoptimized />}
                    <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors" aria-label={`Preview ${v.title} on YouTube`}>
                      <Play className="w-6 h-6 text-white drop-shadow" fill="currentColor" />
                    </a>
                    {v.duration && <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">{v.duration}</span>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1" title={v.title}>{v.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        {v.featured && <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
                      {v.phone && <span className="text-blue-600 font-medium">{v.phone.brand} {v.phone.modelName}</span>}
                      {!v.phone && v.brand && <span className="text-blue-600 font-medium">{v.brand.name}</span>}
                      <span>{new Date(v.publishedAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      {v.views > 0 && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {formatNum(v.views)}</span>}
                      {v.likes > 0 && <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> {formatNum(v.likes)}</span>}
                      {v.commentCount > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {formatNum(v.commentCount)}</span>}
                      {v.channelName && <span className="flex items-center gap-0.5"><Radio className="w-3 h-3" /> {v.channelName}</span>}
                    </div>
                    {v.autoLinked && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Auto-linked — needs confirmation
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => window.open(`https://www.youtube.com/watch?v=${v.youtubeId}`, '_blank')} disabled={actionLoading === v.id} title="Preview" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 disabled:opacity-50 transition-colors" aria-label="Preview">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {v.autoLinked && v.phone && (
                      <button onClick={() => { setActionLoading(v.id); fetch(`/api/admin/videos/${v.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ active: true, status: 'live', autoLinked: false }) }).then(() => { fetchVideos(); fetchStats(); setActionLoading(null); }); }} disabled={actionLoading === v.id} title="Confirm Link" className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 disabled:opacity-50 transition-colors" aria-label="Confirm link">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleToggleFeatured(v)} disabled={actionLoading === v.id} title={v.featured ? 'Unfeature' : 'Feature'} className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors ${v.featured ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600'}`} aria-label={v.featured ? 'Unfeature' : 'Feature'}>
                      <Star className={`w-3.5 h-3.5 ${v.featured ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={() => handleToggleHidden(v)} disabled={actionLoading === v.id} title={v.hidden ? 'Show' : 'Hide'} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 transition-colors" aria-label={v.hidden ? 'Show' : 'Hide'}>
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleCopyUrl(v)} title="Copy URL" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-50 transition-colors" aria-label="Copy URL">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => window.open(`https://www.youtube.com/watch?v=${v.youtubeId}`, '_blank')} title="Open on YouTube" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors" aria-label="Open on YouTube">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggleActive(v)} disabled={actionLoading === v.id}
                      title={v.active ? 'Deactivate' : 'Activate'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors ${v.active ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                      aria-label={v.active ? 'Deactivate' : 'Activate'}>
                      {v.active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleteModal(v)} disabled={actionLoading === v.id} title="Delete" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile actions (always visible) */}
                  <div className="flex items-center gap-1 shrink-0 sm:hidden">
                    <button onClick={() => window.open(`https://www.youtube.com/watch?v=${v.youtubeId}`, '_blank')} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center" aria-label="Preview"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToggleActive(v)} disabled={actionLoading === v.id} className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 ${v.active ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'}`} aria-label={v.active ? 'Deactivate' : 'Activate'}>
                      {v.active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleteModal(v)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-[11px] text-muted-foreground">
            Showing {startIdx}\u2013{endIdx} of {total} Videos
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous page">
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) { pageNum = i + 1; }
              else if (page <= 3) { pageNum = i + 1; }
              else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i; }
              else { pageNum = page - 2 + i; }
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-[11px] font-medium transition-colors ${page === pageNum ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  aria-label={`Page ${pageNum}`} aria-current={page === pageNum ? 'page' : undefined}>
                  {pageNum}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Next page">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true" aria-label="Delete video confirmation">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete Video</h2>
            <p className="text-xs text-muted-foreground mb-4">This action cannot be undone.</p>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              {deleteModal.thumbnailUrl && (
                <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  <Image src={deleteModal.thumbnailUrl} alt={deleteModal.title} fill className="object-cover" unoptimized />
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{deleteModal.title}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={actionLoading === deleteModal.id} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {actionLoading === deleteModal.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Video Modal ─── */}
      {addVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true" aria-label="Add video">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Import Video</h2>
            <p className="text-xs text-muted-foreground mb-4">Add a YouTube video by URL or Video ID</p>
            {importError && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2 mb-3">{importError}</div>}
            <input type="text" placeholder="Paste YouTube URL or Video ID" value={importUrl} onChange={e => { setImportUrl(e.target.value); setImportError(''); }}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white mb-4"
              onKeyDown={e => { if (e.key === 'Enter') handleImportVideo(); }}
              aria-label="YouTube URL or Video ID" />
            <div className="flex gap-2">
              <button onClick={() => { setAddVideoModal(false); setImportUrl(''); setImportError(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleImportVideo} disabled={importLoading || !importUrl.trim()} className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {importLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}