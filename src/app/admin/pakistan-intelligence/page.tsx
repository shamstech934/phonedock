'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CircleDollarSign, Flag, RefreshCw, ShieldAlert, Store, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

type PhoneSummary = {
  _id: string;
  modelName: string;
  slug: string;
  status: string;
  pricePKR: number;
  currentPrice: number;
  ptaStatus: string;
  availabilityStatus: string;
  lastVerifiedAt?: string | null;
};

type Signal = {
  _id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved' | 'dismissed';
  title: string;
  details: string;
  sourceName?: string;
  sourceUrl?: string;
  recommendedValue?: string | number | null;
  lastSeenAt: string;
  phoneId: PhoneSummary;
};

type Payload = {
  items: Signal[];
  total: number;
  page: number;
  pages: number;
  summary: { phonesWithoutPrice: number; unknownPta: number; verifiedListings: number; trustedSources: number; openSignals: number };
};

const TYPE_LABELS: Record<string, string> = {
  missing_pta_status: 'Missing PTA', pta_status_available: 'PTA evidence', missing_pakistan_price: 'Missing price',
  price_available: 'Price evidence', no_verified_retailer: 'No retailer', retailer_price_conflict: 'Price conflict',
  stale_market_verification: 'Stale verification', missing_pakistan_launch_date: 'Missing PK launch',
};

const money = (value: unknown) => Number(value || 0) > 0 ? `Rs. ${Number(value).toLocaleString('en-PK')}` : '—';

export default function PakistanIntelligencePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/pakistan-intelligence?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}&page=${page}`, { credentials: 'include', cache: 'no-store' });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || 'Unable to load Pakistan Intelligence');
      setData(payload);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Pakistan Intelligence'); }
    finally { setLoading(false); }
  }, [status, type, page]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (action: string, id?: string) => {
    setError(''); setMessage(''); if (action === 'scan') setRunning(true);
    try {
      const response = await fetch('/api/admin/pakistan-intelligence', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'scan' ? { action, limit: 150 } : { action, id }),
      });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || 'Action failed');
      setMessage(action === 'scan' ? `Scan complete: ${payload.scannedPhones} phones checked, ${payload.signalsSeen} signals reviewed.` : action === 'apply' ? 'Recommendation applied.' : 'Signal dismissed.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setRunning(false); }
  };

  const cards = useMemo(() => data ? [
    { label: 'Open signals', value: data.summary.openSignals, icon: ShieldAlert, className: 'bg-amber-50 text-amber-700' },
    { label: 'Phones without PKR price', value: data.summary.phonesWithoutPrice, icon: CircleDollarSign, className: 'bg-red-50 text-red-700' },
    { label: 'Unknown PTA status', value: data.summary.unknownPta, icon: Flag, className: 'bg-violet-50 text-violet-700' },
    { label: 'Verified retailer listings', value: data.summary.verifiedListings, icon: Store, className: 'bg-emerald-50 text-emerald-700' },
  ] : [], [data]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Flag className="h-7 w-7 text-emerald-600"/>Pakistan Intelligence</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Low-load review center for PTA status, Pakistan prices, retailer coverage and market freshness. It never publishes automatically.</p>
      </div>
      <button onClick={() => void runAction('scan')} disabled={running} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`}/>{running ? 'Scanning…' : 'Scan 150 phones'}
      </button>
    </div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    {data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 inline-flex rounded-xl p-2.5 ${card.className}`}><Icon className="h-5 w-5"/></div><div className="text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</div><div className="mt-1 text-sm text-slate-500">{card.label}</div></div>; })}</div>}

    <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All statuses</option></select>
      <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="all">All signal types</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <Link href="/admin/price-tracker" className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Store className="h-4 w-4"/>Price Tracker</Link>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Market review queue</h2><p className="text-sm text-slate-500">Apply is only available for trusted price/PTA evidence. Other signals stay manual-review only.</p></div>
      <div className="divide-y divide-slate-100">
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading…</div> : !data?.items.length ? <div className="p-8 text-center text-sm text-slate-500">No signals match this filter.</div> : data.items.map(signal => {
          const canApply = signal.status === 'open' && ['price_available', 'pta_status_available'].includes(signal.type);
          return <div key={signal._id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{signal.phoneId?.modelName || 'Unknown phone'}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${signal.severity === 'critical' ? 'bg-red-50 text-red-700' : signal.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{signal.severity}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{TYPE_LABELS[signal.type] || signal.type}</span></div>
                <div className="mt-2 text-sm font-medium text-slate-800">{signal.title}</div><p className="mt-1 text-sm text-slate-500">{signal.details}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Current price: <b className="text-slate-700">{money(Math.max(signal.phoneId?.pricePKR || 0, signal.phoneId?.currentPrice || 0))}</b></span><span>PTA: <b className="text-slate-700">{signal.phoneId?.ptaStatus || 'Unknown'}</b></span>{signal.recommendedValue != null && <span>Recommendation: <b className="text-emerald-700">{signal.type === 'price_available' ? money(signal.recommendedValue) : String(signal.recommendedValue)}</b></span>}</div>
                {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">{signal.sourceName || 'View evidence'}<ExternalLink className="h-3 w-3"/></a>}
              </div>
              {signal.status === 'open' && <div className="flex shrink-0 gap-2">{canApply && <button onClick={() => void runAction('apply', signal._id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4"/>Apply</button>}<button onClick={() => void runAction('dismiss', signal._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><XCircle className="h-4 w-4"/>Dismiss</button></div>}
            </div>
          </div>;
        })}
      </div>
      {data && data.pages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm"><button disabled={page <= 1} onClick={() => setPage(v => Math.max(1, v - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span className="text-slate-500">Page {page} of {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage(v => Math.min(data.pages, v + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div>}
    </section>

    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><div className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0"/><p><b>Safety:</b> scans are capped, use existing database evidence only, and never call paid AI providers. Applying a recommendation always requires an admin click.</p></div></div>
  </div>;
}
