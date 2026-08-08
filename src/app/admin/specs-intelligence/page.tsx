'use client';

import { readApiResponse } from '@/lib/client/api-response';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Check, X, ExternalLink, Database, Search } from 'lucide-react';

type Item = {
  _id: string;
  status: string;
  severity: string;
  field?: string;
  currentValue?: string;
  recommendedValue?: string;
  confidence?: number;
  sourceName?: string;
  sourceUrl?: string;
  evidence?: { issueKind?: string; valuesConflict?: boolean };
  phoneId?: { _id: string; modelName: string; slug: string; brandId?: { name?: string } };
  [key: string]: unknown;
};

type Data = { items: Item[]; total: number; page: number; pages: number; summary: Record<string, number> };
type ActionResponse = { error?: string; scanned?: number; opened?: number; withRecommendation?: number; message?: string };

const EMPTY: Data = { items: [], total: 0, page: 1, pages: 1, summary: {} };
const FIELDS = ['all', 'display', 'chipset', 'ram', 'storage', 'battery', 'mainCamera', 'fiveG'];
const RETAILER_BRANDS = new Set(['priceoye', 'price oye', 'daraz', 'whatmobile', 'what mobile', 'mega.pk', 'shophive']);

function cleanPhoneName(item: Item) {
  const rawBrand = String(item.phoneId?.brandId?.name || '').trim();
  const model = String(item.phoneId?.modelName || 'Unknown phone').trim();
  const brand = RETAILER_BRANDS.has(rawBrand.toLowerCase()) ? '' : rawBrand;
  return `${brand} ${model}`.trim();
}

function hasRecommendation(item: Item) {
  return Boolean(String(item.recommendedValue || '').trim());
}

function confidenceText(item: Item) {
  return hasRecommendation(item) ? `Confidence ${Math.max(0, Number(item.confidence || 0))}%` : 'Not verified';
}

export default function SpecsIntelligencePage() {
  const [data, setData] = useState<Data>(EMPTY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('open');
  const [field, setField] = useState('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/specs-intelligence?status=${status}&field=${field}&page=${page}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const p = await readApiResponse<Data>(r);
      setData(p);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Specs Intelligence');
    } finally {
      setLoading(false);
    }
  }, [status, field, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phoneId?: string; items: Item[] }>();
    for (const item of data.items) {
      const phoneId = item.phoneId?._id || `orphan:${item._id}`;
      const existing = map.get(phoneId);
      if (existing) existing.items.push(item);
      else map.set(phoneId, { key: phoneId, name: cleanPhoneName(item), phoneId: item.phoneId?._id, items: [item] });
    }
    return Array.from(map.values());
  }, [data.items]);

  const run = async (action: string, id?: string, force = false) => {
    setRunning(id || action);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/specs-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, id, force, limit: 500 }),
      });
      const p = await readApiResponse<ActionResponse>(r);
      setMessage(
        action === 'scan'
          ? `Scan complete: ${p.scanned || 0} phones checked, ${p.opened || 0} missing/conflicting fields queued, ${p.withRecommendation || 0} with trusted recommendations.`
          : action === 'apply'
            ? 'Verified value applied.'
            : 'Issue dismissed.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setRunning('');
    }
  };

  const bulkDismiss = async () => {
    if (!selected.size) return;
    if (!confirm(`Dismiss ${selected.size} selected issues?`)) return;
    setRunning('bulk');
    setError('');
    try {
      const r = await fetch('/api/admin/specs-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'bulk_dismiss', ids: Array.from(selected) }),
      });
      await readApiResponse<ActionResponse>(r);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk action failed');
    } finally {
      setRunning('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Database className="h-7 w-7 text-violet-600" /> Specs Intelligence
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Detect missing/conflicting specifications, compare them with trusted local datasets, and route unresolved fields to the phone editor. Nothing is published without admin approval.
          </p>
        </div>
        <button onClick={() => void run('scan')} disabled={!!running} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${running === 'scan' ? 'animate-spin' : ''}`} />
          {running === 'scan' ? 'Scanning…' : 'Scan up to 500'}
        </button>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(data.summary || {}).map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.replaceAll('_', ' ')}</div>
            <div className="mt-1 text-2xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm">
          <option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All</option>
        </select>
        <select value={field} onChange={(e) => { setField(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm">
          {FIELDS.map((v) => <option key={v} value={v}>{v === 'all' ? 'All fields' : v}</option>)}
        </select>
        <button onClick={() => setSelected(new Set(data.items.filter((i) => i.status === 'open').map((i) => i._id)))} className="rounded-lg border px-3 py-2 text-sm font-semibold">Select page</button>
        <button onClick={() => setSelected(new Set())} disabled={!selected.size} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Clear</button>
        <button onClick={() => void bulkDismiss()} disabled={!selected.size || !!running} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40">Dismiss selected ({selected.size})</button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-slate-500">No signals found.</div>
        ) : groups.map((group) => (
          <section key={group.key} className="rounded-xl border bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{group.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{group.items.length} spec issue{group.items.length === 1 ? '' : 's'} grouped for this phone</p>
              </div>
              {group.phoneId && (
                <Link href={`/admin/phones/${group.phoneId}/edit`} className="inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700">
                  <Search className="h-3.5 w-3.5" /> Open phone editor
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {group.items.map((item) => {
                const conflict = Boolean(item.evidence?.valuesConflict || item.currentValue);
                const actionable = hasRecommendation(item);
                return (
                  <div key={item._id} className="rounded-xl border bg-slate-50/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="checkbox" checked={selected.has(item._id)} disabled={item.status !== 'open'} onChange={(e) => setSelected((prev) => { const next = new Set(prev); e.target.checked ? next.add(item._id) : next.delete(item._id); return next; })} />
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.severity === 'critical' ? 'bg-red-100 text-red-700' : item.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{item.severity}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{conflict ? 'Conflict' : 'Missing'} · {item.field}</span>
                          {!actionable && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Needs manual/source review</span>}
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="rounded-lg border bg-white p-3"><div className="text-[11px] font-semibold uppercase text-slate-500">Current</div><div className="mt-1 text-sm text-slate-800">{item.currentValue || 'Missing'}</div></div>
                          <div className={`rounded-lg border p-3 ${actionable ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className={`text-[11px] font-semibold uppercase ${actionable ? 'text-emerald-700' : 'text-slate-500'}`}>Verified recommendation</div>
                            <div className="mt-1 text-sm text-slate-800">{item.recommendedValue || 'No trusted recommendation yet'}</div>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          {confidenceText(item)}
                          {item.sourceName ? ` • Source: ${item.sourceName}` : ''}
                          {item.sourceUrl && <a className="ml-2 inline-flex items-center gap-1 text-blue-600" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source<ExternalLink className="h-3 w-3" /></a>}
                        </div>
                      </div>

                      {item.status === 'open' && (
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            onClick={() => void run('apply', item._id, conflict)}
                            disabled={!!running || !actionable}
                            title={!actionable ? 'A trusted recommendation is required before Apply is available.' : undefined}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100"
                          >
                            <Check className="h-4 w-4" />{conflict ? 'Approve replacement' : 'Apply'}
                          </button>
                          <button onClick={() => void run('dismiss', item._id)} disabled={!!running} className="inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
                            <X className="h-4 w-4" />{actionable ? 'Reject recommendation' : 'Dismiss issue'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
        <span className="text-sm text-slate-500">Page {data.page} of {data.pages}</span>
        <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
