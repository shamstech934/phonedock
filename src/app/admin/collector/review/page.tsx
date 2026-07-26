'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Copy, Loader2, Filter, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectedPhone {
  id: string; status: string; brandName: string; model: string; slug: string;
  sourceName?: string; sourceUrl?: string; collectedAt?: string;
  qualityScore?: number; completenessScore?: number; confidenceScore?: number;
  hasExactDuplicate?: boolean; duplicateMatches?: Array<{ modelName?: string; brandName?: string; confidence: number }>;
  conflicts?: Array<{ field: string; existingValue?: unknown; newValue?: unknown; existingSource?: string; newSource?: string }>;
  validationIssues?: string[]; isValid?: boolean;
  display?: Record<string, unknown>; processor?: Record<string, unknown>; memory?: Record<string, unknown>;
  camera?: Record<string, unknown>; battery?: Record<string, unknown>;
}

export default function AdminCollectorReviewPage() {
  useAdmin();
  const [items, setItems] = useState<CollectedPhone[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState('');
  const [dupOnly, setDupOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ status: 'pending,needs_review' });
    if (brandFilter) params.set('brand', brandFilter);
    if (dupOnly) params.set('duplicatesOnly', 'true');
    fetch(`/api/collector/review?${params.toString()}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch review queue'); return r.json(); })
      .then(d => { setItems(d.items || []); setTotal(d.total || 0); setLoading(false); })
      .catch(e => { setError(e?.message || 'Failed to load review queue'); setLoading(false); });
  }, [brandFilter, dupOnly]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    fetch('/api/collector/review/brands', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setBrands(d.brands || [])).catch(() => {});
  }, []);

  const singleAction = async (id: string, action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/collector/review/${id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      setItems(prev => prev.filter(i => i.id !== id));
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch (e) { setError(e instanceof Error ? e.message : `Failed to ${action}`); }
    finally { setBusy(false); }
  };

  const repairItem = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/collector/review/${id}/repair`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Repair failed');
      if (!data.fixes?.length) { setError('No auto-fixable issues found on this item.'); return; }
      fetchItems();
    } catch (e) { setError(e instanceof Error ? e.message : 'Repair failed'); }
    finally { setBusy(false); }
  };

  const bulkAction = async (action: 'approve' | 'reject', ids?: string[]) => {
    const targetIds = ids || Array.from(selected);
    if (!targetIds.length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/collector/review/bulk', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: targetIds, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Bulk ${action} failed`);
      if (data.errors?.length) setError(`${data.approved || data.rejected} succeeded, ${data.failed} failed: ${data.errors.slice(0, 3).join('; ')}`);
      setSelected(new Set());
      fetchItems();
    } catch (e) { setError(e instanceof Error ? e.message : `Bulk ${action} failed`); }
    finally { setBusy(false); }
  };

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Collector Review Queue</h1>
          <p className="text-xs text-gray-500 mt-0.5">{total} item{total === 1 ? '' : 's'} awaiting review. Nothing here has touched your live catalog yet.</p>
        </div>
        <button onClick={fetchItems} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 rounded-2xl p-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
          <option value="">All brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={() => setDupOnly(v => !v)} className={`h-9 px-3 rounded-lg text-xs font-medium ${dupOnly ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Duplicates only
        </button>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{selected.size} selected</span>
            <button onClick={() => bulkAction('reject')} disabled={busy} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-50">Reject All</button>
            <button onClick={() => bulkAction('approve')} disabled={busy} className="h-9 px-3 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50">Accept All</button>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
          <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Review queue is empty. Run a collector job or Discover to bring in new items.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{item.brandName} {item.model}</p>
                    {item.hasExactDuplicate && <Badge className="bg-amber-50 text-amber-700 text-[10px]"><Copy className="w-3 h-3 mr-1" />Possible duplicate</Badge>}
                    {!item.isValid && <Badge className="bg-red-50 text-red-700 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Needs fixes</Badge>}
                    {(item.conflicts?.length || 0) > 0 && <Badge className="bg-blue-50 text-blue-700 text-[10px]">{item.conflicts!.length} conflict{item.conflicts!.length === 1 ? '' : 's'}</Badge>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Source: {item.sourceName || 'unknown'} · Quality {item.qualityScore ?? 0}% · Completeness {item.completenessScore ?? 0}% · Confidence {item.confidenceScore ?? 0}%
                  </p>
                  {item.validationIssues && item.validationIssues.length > 0 && (
                    <ul className="mt-2 text-[11px] text-red-500 list-disc list-inside space-y-0.5">
                      {item.validationIssues.slice(0, 3).map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  )}
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="text-[11px] text-blue-600 mt-2 hover:underline">
                    {expanded === item.id ? 'Hide details' : 'Show specs & conflicts'}
                  </button>
                  {expanded === item.id && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 space-y-2">
                      {item.conflicts && item.conflicts.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Existing vs incoming:</p>
                          {item.conflicts.map((c, i) => (
                            <p key={i}>{c.field}: <span className="line-through text-gray-400">{String(c.existingValue ?? '—')}</span> → <span className="text-gray-900">{String(c.newValue ?? '—')}</span></p>
                          ))}
                        </div>
                      )}
                      <p><span className="font-medium text-gray-700">Display:</span> {JSON.stringify(item.display || {})}</p>
                      <p><span className="font-medium text-gray-700">Processor:</span> {JSON.stringify(item.processor || {})}</p>
                      <p><span className="font-medium text-gray-700">Memory:</span> {JSON.stringify(item.memory || {})}</p>
                      <p><span className="font-medium text-gray-700">Camera:</span> {JSON.stringify(item.camera || {})}</p>
                      <p><span className="font-medium text-gray-700">Battery:</span> {JSON.stringify(item.battery || {})}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!item.isValid && (
                    <button onClick={() => repairItem(item.id)} disabled={busy} className="h-9 px-3 rounded-lg border border-blue-200 text-blue-600 text-xs font-medium disabled:opacity-50">
                      Auto-fix
                    </button>
                  )}
                  <button onClick={() => singleAction(item.id, 'reject')} disabled={busy} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-50 inline-flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={() => singleAction(item.id, 'approve')} disabled={busy || !item.isValid} title={!item.isValid ? 'Fix validation issues first' : ''} className="h-9 px-3 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
