'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Rocket, ShieldAlert, XCircle } from 'lucide-react';

type CheckStatus = 'pass' | 'warning' | 'fail';
interface ReleaseCheck { key: string; label: string; status: CheckStatus; detail: string; }
interface ReleaseData {
  generatedAt: string;
  ready: boolean;
  score: number;
  failed: number;
  warnings: number;
  summary: Record<string, number>;
  checks: ReleaseCheck[];
}

const statusMeta: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800', label: 'Pass' },
  warning: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-800', label: 'Warning' },
  fail: { icon: XCircle, className: 'border-rose-200 bg-rose-50 text-rose-800', label: 'Fail' },
};

export default function ReleaseReadinessPage() {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/release-readiness', { credentials: 'include', cache: 'no-store' });
      const json = await readApiResponse<ReleaseData & { error?: string }>(response).catch(() => null);
      if (!response.ok || !json) throw new Error(json?.error || 'Release readiness check failed');
      setData(json);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load checks'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <div className="space-y-6 p-6">
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600"><Rocket className="h-4 w-4"/> Production Gate</div><h1 className="mt-2 text-3xl font-black text-slate-950">Release Readiness Center</h1><p className="mt-1 text-slate-600">A safe, read-only launch checklist for SpecsDekh production.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Run checks</button>
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>}
    {data && <>
      <div className={`rounded-2xl border p-6 ${data.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3">{data.ready ? <CheckCircle2 className="h-9 w-9 text-emerald-600"/> : <ShieldAlert className="h-9 w-9 text-amber-600"/>}<div><div className="text-2xl font-black text-slate-950">{data.ready ? 'Ready for controlled release' : 'Release blockers remain'}</div><div className="text-sm text-slate-600">{data.failed} failed checks · {data.warnings} warnings</div></div></div><div className="text-right"><div className="text-4xl font-black text-slate-950">{data.score}%</div><div className="text-xs uppercase tracking-wider text-slate-500">Readiness score</div></div></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Published phones', data.summary.publishedCount], ['Draft / review', data.summary.draftCount], ['Open quality issues', data.summary.openIssues], ['Critical issues', data.summary.criticalIssues]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-black text-slate-950">{value}</div></div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.checks.map((check) => { const meta = statusMeta[check.status]; const Icon = meta.icon; return <div key={check.key} className={`rounded-2xl border p-5 ${meta.className}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="font-bold">{check.label}</div><div className="mt-1 text-sm opacity-90">{check.detail}</div><div className="mt-2 text-xs font-bold uppercase tracking-wider">{meta.label}</div></div></div></div>; })}
      </div>
      <div className="text-xs text-slate-500">Generated {new Date(data.generatedAt).toLocaleString()}. This page never exposes secret values and does not change production data.</div>
    </>}
    {loading && !data && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Running release checks…</div>}
  </div>;
}
