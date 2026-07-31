'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Play, Radio, RefreshCw, ShieldAlert } from 'lucide-react';

interface AlertItem { code: string; severity: 'info' | 'warning' | 'critical'; title: string; details: string; count: number }
interface MonitoringRun {
  _id: string;
  status: 'running' | 'completed' | 'completed_with_warnings' | 'failed';
  trigger: 'manual' | 'cron';
  startedAt: string;
  durationMs: number;
  summary?: Record<string, number>;
  alerts?: AlertItem[];
}

export default function ContinuousMonitoringPage() {
  const [runs, setRuns] = useState<MonitoringRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/admin/continuous-monitoring?limit=20', { credentials: 'include', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load monitoring history');
      setRuns(data.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    setError('');
    try {
      const response = await fetch('/api/admin/continuous-monitoring', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ syncFeeds: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Monitoring run failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Monitoring run failed');
    } finally {
      setRunning(false);
    }
  };

  const latest = runs[0];
  const cards: Array<[string, number]> = [
    ['Pending launches', latest?.summary?.pendingLaunchCandidates || 0],
    ['Stale drafts', latest?.summary?.staleDraftPhones || 0],
    ['Missing specs', latest?.summary?.missingSpecs || 0],
    ['Missing images', latest?.summary?.missingImages || 0],
    ['Missing prices', latest?.summary?.missingPrices || 0],
    ['Open quality issues', latest?.summary?.openDataQualityIssues || 0],
  ];

  return <div className="space-y-6 p-6">
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600"><Radio className="h-4 w-4" /> Continuous Monitoring</div><h1 className="mt-2 text-3xl font-black text-slate-950">SpecsDekh Watch Center</h1><p className="mt-1 text-slate-600">Runs safe, review-first checks for launches, stale drafts and critical data gaps.</p></div>
      <button onClick={runNow} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-60">{running ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}{running ? 'Running checks...' : 'Run monitoring now'}</button>
    </section>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-3xl font-black text-slate-950">{value}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>)}</section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-slate-950"><ShieldAlert className="h-5 w-5 text-amber-500" /> Latest alerts</h2><div className="mt-4 space-y-3">{!latest?.alerts?.length ? <p className="text-sm text-slate-500">No alerts from the latest run.</p> : latest.alerts.map(item => <div key={item.code} className={`rounded-xl border p-4 ${item.severity === 'critical' ? 'border-red-200 bg-red-50' : item.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-slate-900">{item.title}</div><div className="mt-1 text-sm text-slate-600">{item.details}</div></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{item.count}</span></div></div>)}</div></div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-slate-950"><Activity className="h-5 w-5 text-blue-600" /> Run history</h2><div className="mt-4 space-y-3">{loading ? <p className="text-sm text-slate-500">Loading...</p> : runs.length === 0 ? <p className="text-sm text-slate-500">No monitoring runs yet.</p> : runs.map(run => <div key={run._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div className="flex items-center gap-3">{run.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : run.status === 'failed' ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <Clock className="h-5 w-5 text-amber-500" />}<div><div className="font-semibold text-slate-900">{run.status.replaceAll('_', ' ')}</div><div className="text-xs text-slate-500">{new Date(run.startedAt).toLocaleString()} · {run.trigger}</div></div></div><div className="text-xs font-semibold text-slate-500">{Math.round((run.durationMs || 0) / 1000)}s</div></div>)}</div></div>
    </section>
  </div>;
}
