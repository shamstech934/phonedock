'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Newspaper, Plus, Edit, Trash2, Check, X, Eye, Star, Archive, Copy,
  Search, Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  BarChart3, FileText, Calendar, TrendingUp, Clock, BookOpen, AlertCircle
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface NewsItem {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category: string; author: string; imageUrl: string; published: boolean;
  featured: boolean; status: string; views: number; seoTitle: string;
  seoDescription: string; createdAt: string; updatedAt: string;
}

interface NewsStats {
  total: number; published: number; draft: number; scheduled: number;
  pending: number; featured: number; todayPublished: number; totalViews: number;
}

const STATUS_TABS = [
  { value: 'all', label: 'All' }, { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'featured', label: 'Featured' }, { value: 'archived', label: 'Archived' },
];

const CATEGORIES = ['General', 'Launch News', 'Leaks', 'Reviews', 'Comparisons', 'Software Updates', 'PTA', 'Price Drops', 'Accessories'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'views', label: 'Most Viewed' }, { value: 'updated', label: 'Recent Update' },
  { value: 'alpha', label: 'Alphabetical' },
];

function formatNum(n: number) { return n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n); }

export default function AdminNewsPage() {
  useAdmin();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState<NewsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<NewsItem | null>(null);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1); }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const fetchNews = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(rowsPerPage), sort });
      if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/admin/news?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const d = await res.json();
      setNews(d.news || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1);
    } catch (e: any) { setError(e.message || 'Failed to load news articles'); } finally { setLoading(false); }
  }, [page, rowsPerPage, sort, statusFilter, categoryFilter, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/stats', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setStats(await res.json());
    } catch (e: any) { console.error('Failed to load news stats:', e); }
  }, []);

  useEffect(() => { fetchNews(); fetchStats(); }, [fetchNews, fetchStats]);

  const togglePublish = async (n: NewsItem) => {
    setActionLoading(n.id);
    try {
      await fetch(`/api/admin/news/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ published: !n.published, status: !n.published ? 'published' : 'draft' }) });
      fetchNews(); fetchStats();
    } catch (e: any) { console.error('Toggle publish failed:', e); } finally { setActionLoading(null); }
  };

  const toggleFeatured = async (n: NewsItem) => {
    setActionLoading(n.id);
    try {
      await fetch(`/api/admin/news/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ featured: !n.featured }) });
      fetchNews(); fetchStats();
    } catch (e: any) { console.error('Toggle featured failed:', e); } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.id);
    try {
      await fetch(`/api/admin/news/${deleteModal.id}`, { method: 'DELETE', credentials: 'include' });
      setDeleteModal(null); fetchNews(); fetchStats();
    } catch (e: any) { console.error('Delete failed:', e); } finally { setActionLoading(null); }
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setActionLoading('bulk');
    try {
      const res = await fetch('/api/admin/news/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const d = await res.json();
      if (d.success) { setSelected(new Set()); fetchNews(); fetchStats(); }
    } catch (e: any) { console.error('Bulk action failed:', e); } finally { setActionLoading(null); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, total);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">News Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `Showing ${startIdx}\u2013${endIdx} of ${total} Articles` : 'No articles yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Article
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Articles', value: stats.total, icon: FileText, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Published', value: stats.published, icon: Check, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Draft', value: stats.draft, icon: Edit, bg: 'bg-gray-100', color: 'text-gray-500' },
            { label: 'Scheduled', value: stats.scheduled, icon: Calendar, bg: 'bg-violet-50', color: 'text-violet-600' },
            { label: 'Featured', value: stats.featured, icon: Star, bg: 'bg-yellow-50', color: 'text-yellow-600' },
            { label: 'Pending', value: stats.pending, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
            { label: "Today's Published", value: stats.todayPublished, icon: TrendingUp, bg: 'bg-cyan-50', color: 'text-cyan-600' },
            { label: 'Total Views', value: formatNum(stats.totalViews), icon: Eye, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          ].map(s => (
            <div key={s.label} className="card-premium p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
              </div>
              <p className="text-base font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search articles by title, slug..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white" aria-label="Search articles" />
          </div>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Sort">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Rows per page">
            {[10, 20, 40].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="w-3.5 h-3.5" /> Filters {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showFilters && (
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_TABS.map(f => (
                <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] bg-white" aria-label="Category filter">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { action: 'publish', label: 'Publish', icon: Check, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
              { action: 'draft', label: 'Draft', icon: Edit, color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
              { action: 'feature', label: 'Feature', icon: Star, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
              { action: 'archive', label: 'Archive', icon: Archive, color: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { action: 'delete', label: 'Delete', icon: Trash2, color: 'bg-red-100 text-red-600 hover:bg-red-200' },
            ].map(b => (
              <button key={b.action} onClick={() => handleBulkAction(b.action)} disabled={actionLoading === 'bulk'}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${b.color}`}>
                <b.icon className="w-3 h-3" /> {b.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-blue-600 hover:underline">Clear</button>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="card-premium p-6 border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5 text-red-500" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-red-900">Failed to load data</h3>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => { setError(''); fetchNews(); fetchStats(); }} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">Retry</button>
          </div>
        </div>
      )}

      {/* News List */}
      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-xl" />)}</div>
      ) : news.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Newspaper className="w-8 h-8 text-gray-300" /></div>
          <p className="text-sm font-medium text-gray-900">No news articles found</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first article to get started.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {news.map(n => (
            <div key={n.id} className={`group p-4 rounded-xl border transition-colors ${selected.has(n.id) ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-start gap-3.5">
                <button onClick={() => toggleSelect(n.id)} className="mt-1 shrink-0" aria-label={`Select ${n.title}`}>
                  {selected.has(n.id)
                    ? <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
                    : <div className="w-4 h-4 rounded border-2 border-gray-300 hover:border-blue-400 transition-colors" />}
                </button>

                {n.imageUrl && (
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hidden sm:block">
                    <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">{n.title}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {n.featured && <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${n.published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {n.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
                    <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{n.category}</span>
                    <span>{n.author || 'Unknown'}</span>
                    <span>{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    {n.views > 0 && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {formatNum(n.views)}</span>}
                  </div>
                  {n.excerpt && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{n.excerpt}</p>}
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => window.open(`/news/${n.slug}`, '_blank')} title="Preview" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors" aria-label="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => togglePublish(n)} disabled={actionLoading === n.id} title={n.published ? 'Unpublish' : 'Publish'} className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors ${n.published ? 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-600' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`} aria-label={n.published ? 'Unpublish' : 'Publish'}>
                    {n.published ? <BookOpen className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => toggleFeatured(n)} disabled={actionLoading === n.id} title={n.featured ? 'Unfeature' : 'Feature'} className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors ${n.featured ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-600'}`} aria-label="Feature">
                    <Star className={`w-3.5 h-3.5 ${n.featured ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => setDeleteModal(n)} disabled={actionLoading === n.id} title="Delete" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-[11px] text-muted-foreground">Showing {startIdx}\u2013{endIdx} of {total}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Previous">
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pn: number;
              if (totalPages <= 5) pn = i + 1;
              else if (page <= 3) pn = i + 1;
              else if (page >= totalPages - 2) pn = totalPages - 4 + i;
              else pn = page - 2 + i;
              return (
                <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-[11px] font-medium transition-colors ${page === pn ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} aria-label={`Page ${pn}`}>{pn}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Next">
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete Article</h2>
            <p className="text-xs text-muted-foreground mb-4">This action cannot be undone.</p>
            <div className="p-3 bg-gray-50 rounded-xl mb-4">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{deleteModal.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{deleteModal.category} &middot; {new Date(deleteModal.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={actionLoading === deleteModal.id} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {actionLoading === deleteModal.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}