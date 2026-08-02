'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Archive, CheckCircle2, Clock3, Play, RefreshCw, Tag, Zap } from 'lucide-react';

interface AutomationStatus {
  lifecycle: Record<string, number>;
  lastRun: { at: string; details: string } | null;
}

interface AutomationRunResult {
  durationMs?: number;
  prices?: { updated?: number };
  lifecycle?: { launched?: number };
}

export default function AutomationControlPage() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/automation', { credentials: 'include', cache: 'no-store' });
    const payload = await readApiResponse<AutomationStatus>(response);
    setStatus(payload);
  }, []);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Status failed')); }, [load]);

  const run = async () => {
    setRunning(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/automation/run', { method: 'POST', credentials: 'include' });
      const payload = await readApiResponse<AutomationRunResult>(response);
      setMessage(`Pipeline complete in ${Math.round((payload.durationMs || 0) / 1000)}s · ${payload.prices?.updated || 0} prices updated · ${payload.lifecycle?.launched || 0} launches activated`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pipeline failed safely');
    } finally {
      setRunning(false);
    }
  };

  const lifecycleCards = [
    ['Available', status?.lifecycle.available || 0, CheckCircle2, 'text-emerald-700 bg-emerald-50'],
    ['Coming soon', (status?.lifecycle.coming_soon || 0) + (status?.lifecycle.announced || 0), Clock3, 'text-violet-700 bg-violet-50'],
    ['Rumoured', status?.lifecycle.rumored || 0, Zap, 'text-amber-700 bg-amber-50'],
    ['Discontinued', status?.lifecycle.discontinued || 0, Archive, 'text-slate-700 bg-slate-100'],
  ] as const;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><Activity className="h-4 w-4" /> Unified operations</div>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Automation Control Center</h1>
        <p className="mt-1 text-sm text-slate-500">One safe staged pipeline for prices, discounts, rumours and phone lifecycle.</p>
      </div>
      <button onClick={run} disabled={running} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60">
        {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? 'Pipeline running…' : 'Run complete pipeline'}
      </button>
    </header>

    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {lifecycleCards.map(([label, value, Icon, tone]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
        <strong className="text-3xl font-black text-slate-950">{value}</strong><p className="mt-1 text-sm text-slate-500">{label}</p>
      </div>)}
    </div>

    <section className="grid gap-4 lg:grid-cols-3">
      {[
        ['1. Collect & match', 'Trusted retailer listings and approved rumour feeds are matched to existing phones.', Tag],
        ['2. Validate & update', 'Safe thresholds apply normal changes; suspicious price jumps stay pending for review.', CheckCircle2],
        ['3. Publish & refresh', 'Only changed records are written and affected public caches are refreshed.', RefreshCw],
      ].map(([title, body, Icon]) => <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5">
        <Icon className="h-5 w-5 text-blue-600" /><h2 className="mt-3 font-bold text-slate-950">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{String(body)}</p>
      </div>)}
    </section>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <strong className="text-slate-950">Last successful run:</strong>{' '}
      {status?.lastRun?.at ? new Date(status.lastRun.at).toLocaleString() : 'No complete run recorded yet.'}
    </div>
  </div>;
}
