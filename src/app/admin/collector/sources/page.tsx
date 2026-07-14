'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Plus, X, Check, Power, PowerOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorSource {
  id: string;
  name: string;
  type: string;
  url?: string;
  enabled: boolean;
  lastRun?: string;
  createdAt: string;
}

export default function AdminCollectorSourcesPage() {
  useAdmin();
  const [sources, setSources] = useState<CollectorSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'api', url: '' });
  const [saving, setSaving] = useState(false);

  const fetchSources = useCallback(() => {
    fetch('/api/collector/sources', { credentials: 'include' })
      .then(r => r.json()).then(d => { setSources(d.sources || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/collector/sources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      setForm({ name: '', type: 'api', url: '' });
      setShowForm(false);
      fetchSources();
    } catch {}
    setSaving(false);
  };

  const toggleSource = async (source: CollectorSource) => {
    await fetch(`/api/collector/sources/${source.id}`, {
      method: 'PUT', credentials: 'include',
    });
    fetchSources();
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Delete this source?')) return;
    await fetch('/api/collector/jobs', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ sourceId: id }),
    }).catch(() => {});
    setSources(prev => prev.filter(s => s.id !== id));
  };

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Sources</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{sources.length} sources configured</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25">
          <Plus className="w-3.5 h-3.5" /> Add Source
        </button>
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
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                <option value="api">API</option>
                <option value="web_scrape">Web Scraper</option>
                <option value="csv">CSV Import</option>
                <option value="xml">XML Feed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">URL / Endpoint</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" placeholder="https://..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50">
              {saving ? <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1 inline" /> Add</>}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sources.map(s => (
          <div key={s.id} className="card-premium p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{s.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{s.type || 'api'}</Badge>
                {s.lastRun && <span className="text-[10px] text-muted-foreground">Last run: {new Date(s.lastRun).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {s.enabled ? (
                <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Power className="w-3 h-3 mr-0.5" /> Enabled</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]"><PowerOff className="w-3 h-3 mr-0.5" /> Disabled</Badge>
              )}
              <button onClick={() => toggleSource(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors">
                {s.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteSource(s.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No collector sources configured</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-medium text-blue-500 hover:text-blue-600">Add your first source</button>
          </div>
        )}
      </div>
    </div>
  );
}