'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search, Star, Smartphone, Plus, Trash2, Edit, Eye,
  ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp,
  CheckSquare, Square, AlertCircle, X, Smartphone as PhoneIcon,
  TrendingUp, Sparkles, Shield, DollarSign, FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone, Brand } from '@/components/shared/types';

/* ─── Constants ─── */
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'price-low', label: 'Price Low→High' }, { value: 'price-high', label: 'Price High→Low' },
  { value: 'name-az', label: 'Name A-Z' }, { value: 'name-za', label: 'Name Z-A' },
  { value: 'rating', label: 'Rating' }, { value: 'views', label: 'Views' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All Status' }, { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' }, { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' }, { value: 'upcoming', label: 'Upcoming' },
  { value: 'trending', label: 'Trending' }, { value: 'featured', label: 'Featured' },
];

const PTA_FILTERS = [
  { value: '', label: 'All PTA' }, { value: 'approved', label: 'PTA Approved' },
  { value: 'non-pta', label: 'Non-PTA' }, { value: 'unknown', label: 'Unknown' },
];

interface PhoneStats {
  total: number; published: number; draft: number; upcoming: number;
  trending: number; featured: number; ptaApproved: number; avgPrice: number;
}

/* ─── Main Component ─── */
export default function AdminPhonesPage() {
  useAdmin();

  // Data
  const [phones, setPhones] = useState<Phone[]>([]);
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [ptaFilter, setPtaFilter] = useState('');
  const [featuredToggle, setFeaturedToggle] = useState(false);
  const [trendingToggle, setTrendingToggle] = useState(false);
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modals
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  // Debounced search (350ms)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Build URL params
  const buildParams = useCallback((): string => {
    const params = new URLSearchParams({
      page: String(page), limit: String(rowsPerPage), sort,
    });
    if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (brandFilter) params.set('brandId', brandFilter);
    if (ptaFilter) params.set('pta', ptaFilter);
    if (featuredToggle) params.set('featured', 'true');
    if (trendingToggle) params.set('trending', 'true');
    return params.toString();
  }, [page, rowsPerPage, sort, debouncedSearch, statusFilter, brandFilter, ptaFilter, featuredToggle, trendingToggle]);

  // Fetch phones
  const fetchPhones = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = buildParams();
      const res = await fetch(`/api/admin/phones?${params}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to fetch phones');
      setPhones(d.phones || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load phones');
    } finally { setLoading(false); }
  }, [buildParams]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/phones/stats', { credentials: 'include' });
      const d = await res.json();
      setStats(d);
    } catch {}
  }, []);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brands?limit=200', { credentials: 'include' });
      const d = await res.json();
      setBrands(d.brands || []);
    } catch {}
  }, []);

  useEffect(() => { fetchPhones(); fetchStats(); fetchBrands(); }, [fetchPhones, fetchStats, fetchBrands]);

  // Single delete
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/phones/${deleteId}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) { setPhones(prev => prev.filter(p => p.id !== deleteId)); setDeleteId(null); fetchStats(); setTotal(t => t - 1); }
    } catch (e) { console.error('[deletePhone]', e); }
    setDeleting(false);
  };

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const updates: Record<string, any> = {};
      if (action === 'feature') updates.featured = true;
      else if (action === 'unfeature') updates.featured = false;
      else if (action === 'trend') updates.trending = true;
      else if (action === 'untrend') updates.trending = false;
      else if (action === 'publish') updates.status = 'published';
      else if (action === 'draft') updates.status = 'draft';

      if (action === 'delete') {
        setBulkDeleteModal(true); setBulkLoading(false); return;
      }

      await Promise.all(ids.map(id =>
        fetch(`/api/admin/phones/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify(updates),
        })
      ));
      setSelected(new Set()); fetchPhones(); fetchStats();
    } catch {} finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selected).map(id =>
        fetch(`/api/admin/phones/${id}`, { method: 'DELETE', credentials: 'include' })
      ));
      setBulkDeleteModal(false); setSelected(new Set()); fetchPhones(); fetchStats();
    } catch {} finally { setBulkLoading(false); }
  };

  // Select logic
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selected.size === phones.length) setSelected(new Set());
    else setSelected(new Set(phones.map(p => p.id)));
  };

  const clearFilters = () => {
    setSearchQuery(''); setStatusFilter(''); setBrandFilter('');
    setPtaFilter(''); setFeaturedToggle(false); setTrendingToggle(false);
    setSort('newest'); setPage(1);
  };

  const hasActiveFilters = statusFilter || brandFilter || ptaFilter || featuredToggle || trendingToggle;

  const startIdx = total > 0 ? (page - 1) * rowsPerPage + 1 : 0;
  const endIdx = Math.min(page * rowsPerPage, total);

  // Error state
  if (error && !phones.length) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Manage Phones</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Phone management</p>
          </div>
          <Link href="/admin/phones/new" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Phone</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
        <div className="card-premium p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">Failed to load phones</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{error}</p>
          <button onClick={fetchPhones} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Manage Phones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `Showing ${startIdx}\u2013${endIdx} of ${total} phones` : 'No phones yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/phones/new" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Phone</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Phones', value: stats.total, icon: PhoneIcon, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Published', value: stats.published, icon: FileText, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Draft', value: stats.draft, icon: Edit, bg: 'bg-gray-100', color: 'text-gray-500' },
            { label: 'Upcoming', value: stats.upcoming, icon: Smartphone, bg: 'bg-purple-50', color: 'text-purple-600' },
            { label: 'Trending', value: stats.trending, icon: TrendingUp, bg: 'bg-cyan-50', color: 'text-cyan-600' },
            { label: 'Featured', value: stats.featured, icon: Sparkles, bg: 'bg-amber-50', color: 'text-amber-600' },
            { label: 'PTA Approved', value: stats.ptaApproved, icon: Shield, bg: 'bg-green-50', color: 'text-green-600' },
            { label: 'Avg Price', value: formatPrice(stats.avgPrice), icon: DollarSign, bg: 'bg-rose-50', color: 'text-rose-600' },
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
              type="text" placeholder="Search by name, slug, brand..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
              aria-label="Search phones"
            />
          </div>
          {/* Sort */}
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Sort phones">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* Rows per page */}
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Rows per page">
            {[10, 20, 40].map(n => <option key={n} value={n}>{n} per page</option>)}
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
            {/* Brand + PTA filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] bg-white" aria-label="Brand filter">
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={ptaFilter} onChange={e => { setPtaFilter(e.target.value); setPage(1); }} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] bg-white" aria-label="PTA filter">
                {PTA_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              {/* Featured/Trending toggles */}
              <button onClick={() => { setFeaturedToggle(!featuredToggle); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${featuredToggle ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                <Star className="w-3 h-3 inline mr-1" />Featured
              </button>
              <button onClick={() => { setTrendingToggle(!trendingToggle); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${trendingToggle ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                <TrendingUp className="w-3 h-3 inline mr-1" />Trending
              </button>
              {/* Clear filters */}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                  <X className="w-3 h-3 inline mr-1" />Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bulk Actions Bar ─── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex-wrap">
          <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { action: 'publish', label: 'Publish', icon: Eye, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
              { action: 'draft', label: 'Draft', icon: Edit, color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
              { action: 'feature', label: 'Feature', icon: Star, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
              { action: 'unfeature', label: 'Unfeature', icon: Star, color: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
              { action: 'trend', label: 'Trend', icon: TrendingUp, color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
              { action: 'untrend', label: 'Untrend', icon: TrendingUp, color: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
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

      {/* ─── Loading ─── */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>
      ) : phones.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-900">No phones found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-4 px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">Clear All Filters</button>
          )}
        </div>
      ) : (
        <>
          {/* Select All row */}
          <div className="flex items-center gap-3 px-1">
            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700" aria-label="Select all">
              {selected.size === phones.length && phones.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              Select All
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F8FAFC] border-b border-gray-100">
                  <th className="text-left px-3 py-3 w-10"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PTA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {phones.map((p, i) => (
                    <tr key={p.id} className={`${selected.has(p.id) ? 'bg-blue-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/50'} hover:bg-blue-50/30 transition-colors`}>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleSelect(p.id)} aria-label={`Select ${p.modelName}`}>
                          {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={32} height={32} className="w-8 h-8 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                          <div className="min-w-0"><span className="font-medium text-gray-900 truncate block max-w-[200px]">{p.modelName}</span><span className="text-[10px] text-gray-400">{p.slug}</span></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.brand?.name}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{p.pricePKR > 0 ? formatPrice(p.pricePKR) : '—'}</td>
                      <td className="px-4 py-3">{p.ptaApproved ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">PTA</Badge> : <Badge variant="secondary" className="text-[10px]">{p.ptaStatus || 'Unknown'}</Badge>}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="font-semibold">{p.overallRating || '—'}</span></div></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {p.published !== false && <Badge className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200/50">Published</Badge>}
                          {!p.published && p.status !== 'published' && <Badge variant="secondary" className="text-[10px]">{p.status || 'Draft'}</Badge>}
                          {p.featured && <Badge className="bg-amber-50 text-amber-700 text-[10px] border-amber-200/50">Featured</Badge>}
                          {p.trending && <Badge className="bg-blue-50 text-blue-700 text-[10px] border-blue-200/50">Trending</Badge>}
                          {p.upcoming && <Badge className="bg-purple-50 text-purple-700 text-[10px] border-purple-200/50">Upcoming</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/phones/${p.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/admin/phones/${p.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors" title="Edit"><Edit className="w-4 h-4" /></Link>
                          <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {phones.map(p => (
              <div key={p.id} className={`card-premium p-3 flex items-center gap-3 ${selected.has(p.id) ? 'border-blue-300 bg-blue-50/50' : ''}`}>
                <button onClick={() => toggleSelect(p.id)} className="shrink-0" aria-label={`Select ${p.modelName}`}>
                  {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                </button>
                {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={40} height={40} className="w-10 h-10 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-5 h-5 text-gray-400" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
                  <p className="text-[10px] text-muted-foreground">{p.brand?.name} · {p.pricePKR > 0 ? formatPrice(p.pricePKR) : '—'}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {p.featured && <Badge className="bg-amber-50 text-amber-700 text-[9px] border-amber-200/50">Featured</Badge>}
                    {p.trending && <Badge className="bg-blue-50 text-blue-700 text-[9px] border-blue-200/50">Trending</Badge>}
                    {p.upcoming && <Badge className="bg-purple-50 text-purple-700 text-[9px] border-purple-200/50">Upcoming</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Link href={`/admin/phones/${p.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Eye className="w-4 h-4" /></Link>
                  <Link href={`/admin/phones/${p.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit className="w-4 h-4" /></Link>
                  <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-[11px] text-muted-foreground">
            Showing {startIdx}\u2013{endIdx} of {total} phones
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous page">
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
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
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div><h3 className="font-bold text-gray-900">Delete Phone</h3><p className="text-xs text-muted-foreground">This action cannot be undone</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this phone and all its specs, benchmarks, images, and prices?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Delete Confirmation Modal ─── */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true" aria-label="Bulk delete confirmation">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete {selected.size} Phones</h2>
            <p className="text-xs text-muted-foreground mb-4">This will permanently delete {selected.size} phones and all associated data. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkDeleteModal(false)} disabled={bulkLoading} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkLoading} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {bulkLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}