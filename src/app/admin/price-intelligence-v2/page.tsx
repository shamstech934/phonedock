'use client';

import Link from 'next/link';
import { readApiResponse } from '@/lib/client/api-response';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  Check,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';

type PopulatedPhone = {
  _id?: string;
  modelName?: string;
  slug?: string;
  pricePKR?: number;
  currentPrice?: number;
  manualLock?: boolean;
};

type PopulatedSource = {
  _id?: string;
  name?: string;
  baseUrl?: string;
  trusted?: boolean;
  enabled?: boolean;
  status?: string;
};

type Item = {
  _id: string;
  status: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  field?: string;
  title?: string;
  details?: string;
  recommendedPrice?: number;
  sourceUrl?: string;
  evidence?: Record<string, unknown>;
  phoneId?: PopulatedPhone;
  sourceId?: PopulatedSource;
};

type Data = {
  items: Item[];
  total: number;
  page: number;
  pages: number;
  summary: Record<string, number>;
};

type ActionResponse = {
  error?: string;
  scanned?: number;
  opened?: number;
  recommendations?: number;
  message?: string;
};

const EMPTY: Data = { items: [], total: 0, page: 1, pages: 1, summary: {} };

function money(value: unknown) {
  const number = Number(value || 0);
  return number > 0 ? `PKR ${number.toLocaleString()}` : '';
}

function isActionableRecommendation(item: Item) {
  return item.type === 'recommended_market_price'
    && Number(item.recommendedPrice) > 0
    && Boolean(item.sourceId?._id)
    && Boolean(item.sourceUrl);
}

function remediationFor(item: Item) {
  if (item.type === 'missing_product_links') {
    return {
      href: '/admin/price-tracker',
      label: 'Link product',
      icon: Link2,
      help: 'Add an exact retailer product URL for this phone before price detection can run.',
    };
  }
  if (item.type === 'unverified_retailer_coverage') {
    return {
      href: '/admin/price-tracker',
      label: 'Verify listings',
      icon: ShieldCheck,
      help: 'Review linked retailer pages and mark only exact, trustworthy phone variants as verified.',
    };
  }
  if (item.type === 'missing_retailer_coverage') {
    return {
      href: '/admin/price-tracker',
      label: 'Match trusted source',
      icon: Store,
      help: 'Enable or match a trusted Pakistani retailer source with an available verified listing.',
    };
  }
  return null;
}

export default function PriceIntelligenceV2Page() {
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/price-intelligence-v2?status=${status}&page=${page}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await readApiResponse<Data>(response);
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: string, id?: string, force = false) => {
    setRunning(id || action);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/price-intelligence-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, id, force, limit: action === 'scan' ? 25 : undefined }),
      });
      const payload = await readApiResponse<ActionResponse>(response);
      if (action === 'scan') {
        setMessage(
          payload.message
          || `Scanned ${Number(payload.scanned || 0)} phones; ${Number(payload.opened || 0)} signals detected and ${Number(payload.recommendations || 0)} safe recommendation(s) created.`,
        );
      }
      await load();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'Action failed';
      const needsForce = action === 'apply' && !force && (reason.includes('more than 35%') || reason.includes('manually locked'));
      if (needsForce && window.confirm(`${reason}\n\nApply this verified retailer price anyway?`)) {
        setRunning('');
        await run(action, id, true);
        return;
      }
      setError(reason);
    } finally {
      setRunning('');
    }
  };

  const summaryEntries = useMemo(() => Object.entries(data.summary || {}), [data.summary]);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <BadgeDollarSign className="h-7 w-7 text-emerald-600" /> Price Intelligence V2
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Pakistan retailer coverage, stale checks, price spread, history gaps and trusted market recommendations. Public prices change only after a verified recommendation is approved.
        </p>
      </div>
      <button
        onClick={() => void run('scan')}
        disabled={Boolean(running)}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${running === 'scan' ? 'animate-spin' : ''}`} />
        {running === 'scan' ? 'Scanning safe batch…' : 'Scan 25 phones'}
      </button>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {summaryEntries.map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replaceAll('_', ' ')}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </div>)}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(event) => { setStatus(event.target.value); setPage(1); }}
        className="rounded-lg border px-3 py-2 text-sm"
      >
        <option value="open">Open</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
        <option value="all">All</option>
      </select>
      {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>

    <div className="space-y-3">
      {loading
        ? <div className="rounded-xl border bg-white p-8 text-center">Loading…</div>
        : data.items.length === 0
          ? <div className="rounded-xl border bg-white p-8 text-center text-slate-500">No signals found.</div>
          : data.items.map((item) => {
            const actionable = isActionableRecommendation(item);
            const remediation = remediationFor(item);
            const RemediationIcon = remediation?.icon;
            return <div key={item._id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.severity === 'critical' ? 'bg-red-100 text-red-700' : item.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.severity}
                    </span>
                    <span className="text-xs text-slate-500">{item.field || item.type}</span>
                    {actionable && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Verified recommendation</span>}
                  </div>
                  <h2 className="mt-2 font-semibold text-slate-900">{item.title || item.phoneId?.modelName || 'Price signal'}</h2>
                  <p className="mt-1 text-sm text-slate-600">{item.details || ''}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{item.phoneId?.modelName || 'Unknown phone'}</span>
                    {Number(item.recommendedPrice) > 0 && <span className="font-semibold text-emerald-700">{money(item.recommendedPrice)}</span>}
                    {item.sourceId?.name && <span>Source: {item.sourceId.name}</span>}
                    {item.sourceUrl && <a className="inline-flex items-center gap-1 text-blue-600" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Retailer page <ExternalLink className="h-3 w-3" />
                    </a>}
                  </div>
                  {remediation && <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{remediation.help}</span>
                  </div>}
                </div>

                {item.status === 'open' && <div className="flex flex-wrap gap-2">
                  {actionable ? <button
                    onClick={() => void run('apply', item._id)}
                    disabled={Boolean(running)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> {running === item._id ? 'Applying…' : 'Apply verified price'}
                  </button> : remediation && RemediationIcon ? <Link
                    href={remediation.href}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <RemediationIcon className="h-4 w-4" /> {remediation.label}
                  </Link> : null}
                  <button
                    onClick={() => void run('dismiss', item._id)}
                    disabled={Boolean(running)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Dismiss
                  </button>
                </div>}
              </div>
            </div>;
          })}
    </div>

    <div className="flex items-center justify-between">
      <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
      <span className="text-sm text-slate-500">Page {data.page} of {data.pages}</span>
      <button disabled={page >= data.pages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
    </div>
  </div>;
}
