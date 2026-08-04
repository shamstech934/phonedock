'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Layers, Plus, Pencil, Trash2, X, Save, Globe, AlignLeft, Hash, Eye, EyeOff, Search, Smartphone, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import type { Brand } from '@/components/shared/types';

interface BrandForm {
  name: string;
  logo: string;
  country: string;
  description: string;
  sortOrder: number;
  active: boolean;
}

const EMPTY_FORM: BrandForm = { name: '', logo: '', country: '', description: '', sortOrder: 0, active: true };

interface BrandStats { total: number; active: number; inactive: number; withLogos: number; countries: number; totalPhones: number; }
interface Pagination { page: number; pageSize: number; total: number; totalPages: number; }

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: 'sort-order', label: 'Sort Order' },
  { value: 'name', label: 'Name' },
  { value: 'phones-count', label: 'Phones Count' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];
const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function AdminBrandsPage() {
  useAdmin();
  const [brands, setBrands] = useState<(Brand & { phonesCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('sort-order');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(searchQuery); }, 350);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery]);

  // Fetch stats
  const fetchStats = useCallback(() => {
    fetch('/api/admin/brands/stats', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch stats'); return r.json(); })
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  // Fetch brands with server params
  const fetchBrands = useCallback((page = 1) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sortBy) params.set('sort', sortBy);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    const qs = params.toString();
    fetch(`/api/admin/brands${qs ? `?${qs}` : ''}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch brands'); return r.json(); })
      .then(d => {
        setBrands(d.brands || []);
        setPagination(d.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [debouncedSearch, statusFilter, sortBy]);

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => { fetchBrands(1); }, [fetchBrands]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // After save/delete, refetch current page
  const refreshAfterMutation = useCallback(() => {
    fetchBrands(pagination.page);
    fetchStats();
  }, [fetchBrands, fetchStats, pagination.page]);

  // Open create modal
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  // Open edit modal
  const openEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      logo: brand.logo || '',
      country: brand.country || '',
      description: brand.description || '',
      sortOrder: (brand as unknown as { sortOrder?: number }).sortOrder || 0,
      active: (brand as unknown as { active?: boolean }).active !== false,
    });
    setModalOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/brands/${editingId}` : '/api/admin/brands';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? form : { ...form, slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      if (r.ok) { setModalOpen(false); refreshAfterMutation(); }
    } catch (e) { console.error('[saveBrand]', e); }
    setSaving(false);
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/brands/${deleteId}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) { setBrands(prev => prev.filter(b => b.id !== deleteId)); setDeleteId(null); refreshAfterMutation(); }
    } catch (e) { console.error('[deleteBrand]', e); }
    setDeleting(false);
  };

  const updateField = <K extends keyof BrandForm>(key: K, value: BrandForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (loading && brands.length === 0) return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-48 rounded-2xl" />)}</div>;

  const goToPage = (p: number) => {
    if (p >= 1 && p <= pagination.totalPages) fetchBrands(p);
  };

  // Client-side sort for phones-count (server can't do it easily without extra aggregation per request)
  const displayBrands = (() => {
    const sorted = [...brands];
    if (sortBy === 'phones-count') {
      sorted.sort((a, b) => (b.phonesCount || 0) - (a.phonesCount || 0));
    }
    return sorted;
  })();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Manage Brands</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{pagination.total} brands total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Brand
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Brands', value: stats?.total ?? '—', icon: Layers, color: 'bg-gray-50 text-gray-600' },
          { label: 'Active', value: stats?.active ?? '—', icon: Eye, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Inactive', value: stats?.inactive ?? '—', icon: EyeOff, color: 'bg-red-50 text-red-500' },
          { label: 'Total Phones', value: stats?.totalPhones ?? '—', icon: Smartphone, color: 'bg-amber-50 text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center shrink-0`}><s.icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search brands by name or slug (min 2 chars)..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >{tab.label}</button>
            ))}
          </div>
          {/* Sort Dropdown */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="pl-8 pr-7 py-2 text-xs font-medium border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="card-premium p-6 border border-red-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <div><h3 className="font-bold text-sm text-gray-900">Failed to load brands</h3><p className="text-xs text-muted-foreground">{error}</p></div>
          </div>
          <button onClick={() => fetchBrands(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Loading overlay for subsequent loads */}
      {loading && brands.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50 pointer-events-none">
          {Array(Math.min(3, brands.length)).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-48 rounded-2xl" />)}
        </div>
      )}

      {/* Brands Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayBrands.map(brand => (
            <div key={brand.id} className="card-premium p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {brand.logo ? (
                      <Image src={brand.logo} alt={brand.name} width={40} height={40} className="object-contain p-1" unoptimized />
                    ) : (
                      <Layers className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{brand.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">{brand.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(brand)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(brand.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {brand.country ? <span className="text-muted-foreground">{brand.country}</span> : <span className="text-gray-300">No country</span>}
                  {(brand as unknown as { active?: boolean }).active === false && <Badge className="bg-red-50 text-red-600 text-[10px] border-red-200/50">Inactive</Badge>}
                </div>
                <Badge variant="secondary" className="text-[10px]">{(brand as unknown as { phonesCount?: number }).phonesCount || brand._count?.phones || 0} phones</Badge>
              </div>
              {brand.description && <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{brand.description}</p>}
            </div>
          ))}
        </div>
      )}

      {brands.length === 0 && !loading && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No brands found</p>
          <p className="text-xs mt-1">{(searchQuery || statusFilter !== 'all') ? 'Try adjusting your search or filters' : 'Click "Add Brand" to create your first brand'}</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) => typeof p === 'string' ? (
                <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <button key={p} onClick={() => goToPage(p)} className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${p === pagination.page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingId ? 'Edit Brand' : 'New Brand'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Logo Preview + URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Brand Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {form.logo ? (
                      <Image src={form.logo} alt="Logo preview" width={48} height={48} className="object-contain p-1" unoptimized />
                    ) : (
                      <Layers className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={form.logo}
                      onChange={e => updateField('logo', e.target.value)}
                      placeholder="Paste logo URL (e.g. /brands/samsung.png or https://...)"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Use local path like /brands/name.png or any external URL</p>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Brand Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g. Samsung"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Country + Sort Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1.5"><Globe className="w-3 h-3" /> Country</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={e => updateField('country', e.target.value)}
                    placeholder="e.g. South Korea"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1.5"><Hash className="w-3 h-3" /> Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => updateField('sortOrder', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1.5"><AlignLeft className="w-3 h-3" /> Description</label>
                <textarea
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Brief brand description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">Active</p>
                  <p className="text-[11px] text-muted-foreground">Inactive brands are hidden from the public site</p>
                </div>
                <button
                  onClick={() => updateField('active', !form.active)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : editingId ? 'Update Brand' : 'Create Brand'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div><h3 className="font-bold text-gray-900">Delete Brand</h3><p className="text-xs text-muted-foreground">This cannot be undone</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure? Phones linked to this brand will keep their data but won&apos;t have a brand association.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}