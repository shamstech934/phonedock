'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Plus, X, Check, Power, PowerOff, Trash2, AlertTriangle, Clock, Zap, Search, RotateCcw, ArrowUpDown, Radio, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorSource {
  id: string; name: string; type: string; url?: string;
  enabled: boolean; lastRun?: string; createdAt: string;
}

export default function AdminCollectorSourcesPage() {
  useAdmin();
  const [sources, setSources] = useState<CollectorSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'api', url: '' });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<CollectorSource | null>(null);

  const fetchSources = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/collector/sources', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch sources'); return r.json(); })
      .then(d => { setSources(d.sources || []); setLoading(false); })
      .catch((e) => { setError(e?.message || 'Failed to load sources. Please try again.'); setLoading(false); });
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/collector/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      setForm({ name: '', type: 'api', url: '' }); setShowForm(false); fetchSources();
    } catch {} finally { setSaving(false); }
  };

  const toggleSource = async (s: CollectorSource) => {
    try { await fetch(`/api/collector/sources/${s.id}`, { method: 'PUT', credentials: 'include' }); fetchSources(); } catch {}
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetch(`/api/collector/sources/${deleteModal.id}`, { method: 'DELETE', credentials: 'include' });
      setDeleteModal(null); fetchSources();
    } catch {}
  };

  const activeCount = sources.filter(s => s.enabled).length;
  const inactiveCount = sources.length - activeCount;
  const lastRunDate = sources.reduce((latest, s) => {
    if (!s.lastRun) return latest;
    return !latest || new Date(s.lastRun) > new Date(latest) ? s.lastRun : latest;
  }, null as string | null);

  const filteredSources = sources
    .filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'type': return a.type.localeCompare(b.type);
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest': default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (error) return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Sources</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Data sources and providers</p>
        </div>
      </div>
      <div className="card-premium p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-red-500" /></div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Unable to Load Sources</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
        <button onClick={fetchSources} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Sources</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{sources.length} sources configured</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add Source
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-premium p-3.5">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center mb-2"><Database className="w-3.5 h-3.5 text-blue-600" /></div>
          <p className="text-base font-bold text-gray-900">{sources.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total Sources</p>
        </div>
        <div className="card-premium p-3.5">
          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center mb-2"><Radio className="w-3.5 h-3.5 text-emerald-600" /></div>
          <p className="text-base font-bold text-gray-900">{activeCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Active</p>
        </div>
        <div className="card-premium p-3.5">
          <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mb-2"><XCircle className="w-3.5 h-3.5 text-gray-400" /></div>
          <p className="text-base font-bold text-gray-900">{inactiveCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Inactive</p>
        </div>
        <div className="card-premium p-3.5">
          <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center mb-2"><Clock className="w-3.5 h-3.5 text-violet-600" /></div>
          <p className="text-base font-bold text-gray-900">{lastRunDate ? new Date(lastRunDate).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Last Run</p>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or type..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
        </div>
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="type">Type A-Z</option>
          </select>
        </div>
      </div>

      {showForm && (
        <div className="card-premium p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-gray-900">New Source</h2>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="Source name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white">
                <option value="api">API</option>
                <option value="web_scrape">Web Scraper</option>
                <option value="csv">CSV Import</option>
                <option value="xml">XML Feed</option>
                <option value="rss">RSS Feed</option>
                <option value="json">JSON Feed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">URL / Endpoint</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="https://..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
              {saving && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Check className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredSources.map(s => (
          <div key={s.id} className="card-premium p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.enabled ? 'bg-emerald-50' : 'bg-gray-100'}`}>
              <Database className={`w-5 h-5 ${s.enabled ? 'text-emerald-500' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{s.name}</h3>
              {s.url && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.url}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{s.type || 'api'}</Badge>
                {s.enabled
                  ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Zap className="w-2.5 h-2.5 mr-0.5" /> Active</Badge>
                  : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                }
                {s.lastRun && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> {new Date(s.lastRun).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => toggleSource(s)} className={`p-2 rounded-lg transition-colors ${s.enabled ? 'hover:bg-red-100 text-red-500' : 'hover:bg-emerald-100 text-emerald-600'}`} title={s.enabled ? 'Disable' : 'Enable'} aria-label={s.enabled ? 'Disable' : 'Enable'}>
                {s.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
              <button onClick={() => setDeleteModal(s)} className="p-2 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete" aria-label="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredSources.length === 0 && sources.length > 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Search className="w-7 h-7 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-900">No sources match your search</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
            <button onClick={() => { setSearch(''); setSortBy('newest'); }} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100">
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        )}
        {sources.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Database className="w-8 h-8 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-900">No collector sources configured</p>
            <p className="text-xs text-muted-foreground mt-1">Add a data source to start collecting phone data automatically.</p>
            <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100">
              <Plus className="w-3.5 h-3.5" /> Add Your First Source
            </button>
          </div>
        )}
      </div>

      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete Source</h2>
            <p className="text-xs text-muted-foreground mb-4">This will also delete all jobs associated with this source.</p>
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl mb-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900">{deleteModal.name}</p>
                <p className="text-[10px] text-red-500">{deleteModal.type} source</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
