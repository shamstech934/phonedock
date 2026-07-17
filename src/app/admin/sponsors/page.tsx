'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, X, Check, Search, RefreshCw, BarChart3, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface Sponsor {
  id: string;
  name: string;
  image: string;
  url: string;
  position: string;
  active: boolean;
  impressions?: number;
  clicks?: number;
  startDate?: string;
  endDate?: string;
}

const emptyForm = { name: '', image: '', url: '', position: 'sidebar', startDate: '', endDate: '' };

export default function AdminSponsorsPage() {
  useAdmin();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSponsors = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/sponsors', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setSponsors(d.sponsors || []); setLoading(false); })
      .catch(e => { setError(e.message || 'Failed to load sponsors'); setLoading(false); });
  }, []);

  useEffect(() => { fetchSponsors(); }, [fetchSponsors]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: Sponsor) => {
    setEditing(s);
    setForm({ name: s.name, image: s.image || '', url: s.url || '', position: s.position || 'sidebar', startDate: s.startDate?.slice(0, 10) || '', endDate: s.endDate?.slice(0, 10) || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/admin/sponsors/${editing.id}` : '/api/admin/sponsors';
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Save failed (${r.status})`);
      }
      setShowForm(false);
      fetchSponsors();
    } catch (e: any) { setError(e.message || 'Failed to save sponsor'); }
    setSaving(false);
  };

  const toggleActive = async (s: Sponsor) => {
    await fetch(`/api/admin/sponsors/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ active: !s.active }),
    });
    fetchSponsors();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/sponsors/${deleteId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (r.ok) { setDeleteId(null); fetchSponsors(); }
    } catch (e) { console.error('[deleteSponsor]', e); }
    setDeleting(false);
  };

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}</div>;

  if (error && sponsors.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="card-premium p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-red-500" /></div>
          <h3 className="font-bold text-gray-900">Failed to load sponsors</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <button onClick={fetchSponsors} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
        </div>
      </div>
    );
  }

  const totalClicks = sponsors.reduce((sum, s) => sum + (s.clicks || 0), 0);
  const totalImpressions = sponsors.reduce((sum, s) => sum + (s.impressions || 0), 0);
  const activeCount = sponsors.filter(s => s.active).length;
  const pausedCount = sponsors.filter(s => !s.active).length;

  const filtered = search.trim()
    ? sponsors.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : sponsors;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Manage Sponsors</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{sponsors.length} sponsors total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25">
          <Plus className="w-3.5 h-3.5" /> Add Sponsor
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-premium p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Star className="w-4.5 h-4.5 text-blue-500" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Total Sponsors</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{sponsors.length}</p>
            </div>
          </div>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><Eye className="w-4.5 h-4.5 text-emerald-500" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Active</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Pause className="w-4.5 h-4.5 text-amber-500" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Paused</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{pausedCount}</p>
            </div>
          </div>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0"><BarChart3 className="w-4.5 h-4.5 text-violet-500" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Impressions</p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{totalImpressions.toLocaleString()}</p>
              {totalClicks > 0 && <p className="text-[10px] text-muted-foreground">{totalClicks.toLocaleString()} clicks</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Search + Error Banner */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sponsors..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
        </div>
      </div>
      {error && sponsors.length > 0 && (
        <div className="card-premium p-3 flex items-center gap-3 border border-red-200/50 bg-red-50/50">
          <X className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium text-red-600 hover:text-red-800 shrink-0">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="card-premium p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-gray-900">{editing ? 'Edit Sponsor' : 'New Sponsor'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="Sponsor name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Position</label>
              <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                <option value="sidebar">Sidebar</option>
                <option value="header">Header Banner</option>
                <option value="footer">Footer Banner</option>
                <option value="in-feed">In-Feed</option>
                <option value="popup">Popup</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Image URL</label>
              <input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="https://example.com/banner.jpg" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-700 mb-1 block">Destination URL</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="https://example.com/landing" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50">
              {saving ? <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1 inline" /> Save</>}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(s => (
          <div key={s.id} className="card-premium p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
              {s.image ? (
                <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
              ) : (
                <Star className="w-5 h-5 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{s.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{s.position || 'sidebar'}</Badge>
                {s.impressions !== undefined && <span className="text-[10px] text-muted-foreground">{s.impressions.toLocaleString()} views</span>}
                {s.clicks !== undefined && <span className="text-[10px] text-muted-foreground">{s.clicks.toLocaleString()} clicks</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {s.active ? (
                <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Eye className="w-3 h-3 mr-0.5" /> Active</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]"><EyeOff className="w-3 h-3 mr-0.5" /> Paused</Badge>
              )}
              <button onClick={() => toggleActive(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors" title={s.active ? 'Pause' : 'Activate'}>
                {s.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"><ExternalLink className="w-4 h-4" /></a>
              )}
              <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
              <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && sponsors.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No sponsors match &quot;{search}&quot;</p>
          </div>
        )}
        {sponsors.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No sponsors yet</p>
            <button onClick={openAdd} className="mt-3 text-xs font-medium text-blue-500 hover:text-blue-600">Add your first sponsor</button>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div><h3 className="font-bold text-gray-900">Delete Sponsor</h3><p className="text-xs text-muted-foreground">This cannot be undone</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to permanently delete this sponsor and all its tracking data?</p>
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