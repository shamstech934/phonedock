'use client';

import { readApiResponse } from '@/lib/client/api-response';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Eye,
  Flag,
  RefreshCw,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react';

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
  evidence?: Record<string, unknown>;
  lastSeenAt: string;
  phoneId: PhoneSummary;
};

type SeveritySummary = { info: number; warning: number; critical: number };

type Payload = {
  items: Signal[];
  total: number;
  page: number;
  pages: number;
  summary: {
    activePhones: number;
    phonesWithoutPrice: number;
    unknownPta: number;
    verifiedListings: number;
    trustedSources: number;
    phonesCovered: number;
    retailerCoveragePercent: number;
    openSignals: number;
    severity: SeveritySummary;
  };
};

type ActionPayload = { error?: string; scannedPhones?: number; signalsSeen?: number; autoResolved?: number; message?: string };

const TYPE_LABELS: Record<string, string> = {
  missing_pta_status: 'Missing PTA',
  pta_status_available: 'PTA evidence',
  missing_pakistan_price: 'Missing price',
  price_available: 'Price evidence',
  no_verified_retailer: 'No retailer',
  retailer_price_conflict: 'Price conflict',
  stale_market_verification: 'Stale verification',
  missing_pakistan_launch_date: 'Missing PK launch',
};

const money = (value: unknown) => Number(value || 0) > 0 ? `Rs. ${Number(value).toLocaleString('en-PK')}` : '—';
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-PK') : '—';

function EvidencePanel({ signal }: { signal: Signal }) {
  const entries = Object.entries(signal.evidence || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const confidence = Number(signal.evidence?.confidence ?? signal.evidence?.matchConfidence ?? 0);

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Eye className="h-4 w-4 text-blue-600"/>Evidence</div>
        {confidence > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">Confidence {Math.round(confidence)}%</span>}
      </div>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div><div className="text-slate-500">Source</div><div className="mt-1 font-semibold text-slate-800">{signal.sourceName || 'Internal market checks'}</div></div>
        <div><div className="text-slate-500">Last detected</div><div className="mt-1 font-semibold text-slate-800">{dateTime(signal.lastSeenAt)}</div></div>
        <div><div className="text-slate-500">Suggested value</div><div className="mt-1 font-semibold text-emerald-700">{signal.recommendedValue == null ? 'Manual review' : signal.type === 'price_available' ? money(signal.recommendedValue) : String(signal.recommendedValue)}</div></div>
        <div><div className="text-slate-500">Current state</div><div className="mt-1 font-semibold text-slate-800">{signal.phoneId?.ptaStatus || 'PTA unknown'} · {money(Math.max(signal.phoneId?.pricePKR || 0, signal.phoneId?.currentPrice || 0))}</div></div>
      </div>
      {entries.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{entries.slice(0, 8).map(([key, value]) => <span key={key} className="rounded-lg border border-blue-100 bg-white px-2.5 py-1 text-xs text-slate-600"><b className="text-slate-800">{key.replace(/([A-Z])/g, ' $1')}:</b> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>)}</div>}
    </div>
  );
}

export default function PakistanIntelligencePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);
  const [scanLimit, setScanLimit] = useState(25);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/pakistan-intelligence?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}&severity=${encodeURIComponent(severity)}&page=${page}`, { credentials: 'include', cache: 'no-store' });
      const payload = await readApiResponse<Payload>(response);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Pakistan Intelligence');
    } finally {
      setLoading(false);
    }
  }, [status, type, severity, page]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (action: string, id?: string) => {
    setError('');
    setMessage('');
    if (action === 'scan') setRunning(true);
    try {
      const response = await fetch('/api/admin/pakistan-intelligence', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'scan' ? { action, limit: scanLimit } : { action, id }),
      });
      const payload = await readApiResponse<ActionPayload>(response);
      setMessage(action === 'scan'
        ? `Scan complete: ${payload.scannedPhones ?? 0} phones checked, ${payload.signalsSeen ?? 0} signals reviewed, ${payload.autoResolved ?? 0} cleared.`
        : action === 'apply' ? 'Verified recommendation applied.'
        : action === 'resolve' ? 'Signal marked as resolved.'
        : 'Signal dismissed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setRunning(false);
    }
  };

  const cards = useMemo(() => data ? [
    { label: 'Open signals', value: data.summary.openSignals, helper: `${data.summary.severity.critical} critical · ${data.summary.severity.warning} warning`, icon: ShieldAlert, className: 'bg-amber-50 text-amber-700' },
    { label: 'Phones without PKR price', value: data.summary.phonesWithoutPrice, helper: 'Need verified Pakistan pricing', icon: CircleDollarSign, className: 'bg-red-50 text-red-700' },
    { label: 'Unknown PTA status', value: data.summary.unknownPta, helper: 'Need PTA evidence or review', icon: Flag, className: 'bg-violet-50 text-violet-700' },
    { label: 'Retailer coverage', value: `${data.summary.retailerCoveragePercent}%`, helper: `${data.summary.phonesCovered.toLocaleString()} of ${data.summary.activePhones.toLocaleString()} phones · ${data.summary.verifiedListings.toLocaleString()} listings`, icon: Store, className: 'bg-emerald-50 text-emerald-700' },
  ] : [], [data]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Flag className="h-7 w-7 text-emerald-600"/>Pakistan Intelligence</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Low-load review center for PTA status, Pakistan prices, retailer coverage and market freshness. Nothing publishes without admin approval.</p>
      </div>
      <div className="flex items-center overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="relative border-r border-emerald-100">
          <select value={scanLimit} onChange={e => setScanLimit(Number(e.target.value))} disabled={running} className="appearance-none bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none disabled:opacity-60">
            <option value={25}>25 phones</option><option value={50}>50 phones</option><option value={100}>100 phones</option><option value={150}>150 phones</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-slate-400"/>
        </div>
        <button onClick={() => void runAction('scan')} disabled={running} className="inline-flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`}/>{running ? 'Scanning…' : 'Scan now'}
        </button>
      </div>
    </div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    {data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 inline-flex rounded-xl p-2.5 ${card.className}`}><Icon className="h-5 w-5"/></div><div className="text-3xl font-bold text-slate-900">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div><div className="mt-1 text-sm font-medium text-slate-600">{card.label}</div><div className="mt-2 text-xs text-slate-400">{card.helper}</div></div>; })}</div>}

    <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All statuses</option></select>
      <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="all">All priorities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
      <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="all">All signal types</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <Link href="/admin/price-tracker" className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Store className="h-4 w-4"/>Price Tracker</Link>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Market review queue</h2><p className="text-sm text-slate-500">Inspect evidence first. Apply is only available for trusted price/PTA evidence; all other signals remain manual-review only.</p></div>
      <div className="divide-y divide-slate-100">
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading…</div> : !data?.items.length ? <div className="p-8 text-center text-sm text-slate-500">No signals match this filter.</div> : data.items.map(signal => {
          const canApply = signal.status === 'open' && ['price_available', 'pta_status_available'].includes(signal.type) && signal.recommendedValue != null && Boolean(signal.sourceUrl);
          const isExpanded = Boolean(expanded[signal._id]);
          const phoneHref = signal.phoneId?._id ? `/admin/phones/${signal.phoneId._id}` : '/admin/phones';
          return <div key={signal._id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{signal.phoneId?.modelName || 'Unknown phone'}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${signal.severity === 'critical' ? 'bg-red-50 text-red-700' : signal.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{signal.severity}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{TYPE_LABELS[signal.type] || signal.type}</span></div>
                <div className="mt-2 text-sm font-medium text-slate-800">{signal.title}</div><p className="mt-1 text-sm text-slate-500">{signal.details}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Current price: <b className="text-slate-700">{money(Math.max(signal.phoneId?.pricePKR || 0, signal.phoneId?.currentPrice || 0))}</b></span><span>PTA: <b className="text-slate-700">{signal.phoneId?.ptaStatus || 'Unknown'}</b></span>{signal.recommendedValue != null && <span>Recommendation: <b className="text-emerald-700">{signal.type === 'price_available' ? money(signal.recommendedValue) : String(signal.recommendedValue)}</b></span>}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={phoneHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><ExternalLink className="h-3.5 w-3.5"/>Open phone</Link>
                  <button onClick={() => setExpanded(current => ({ ...current, [signal._id]: !isExpanded }))} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700"><Eye className="h-3.5 w-3.5"/>{isExpanded ? 'Hide evidence' : 'View evidence'}</button>
                  {signal.type === 'no_verified_retailer' && <Link href="/admin/price-tracker" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"><Store className="h-3.5 w-3.5"/>Link retailer</Link>}
                  {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-600">Source page<ExternalLink className="h-3.5 w-3.5"/></a>}
                </div>
                {isExpanded && <EvidencePanel signal={signal}/>} 
              </div>
              {signal.status === 'open' && <div className="flex shrink-0 flex-wrap gap-2">{canApply && <button onClick={() => void runAction('apply', signal._id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-4 w-4"/>Apply</button>}<button onClick={() => void runAction('resolve', signal._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Resolve</button><button onClick={() => void runAction('dismiss', signal._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><XCircle className="h-4 w-4"/>Dismiss</button></div>}
            </div>
          </div>;
        })}
      </div>
      {data && data.pages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm"><button disabled={page <= 1} onClick={() => setPage(v => Math.max(1, v - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {data.page} of {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage(v => Math.min(data.pages, v + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div>}
    </section>

    {data && data.summary.severity.critical > 0 && <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><b>{data.summary.severity.critical} critical signals need attention.</b><div className="mt-1 text-amber-700">Prioritize missing prices and trusted retailer evidence before resolving lower-priority launch-date or freshness signals.</div></div></div>}
  </div>;
}
