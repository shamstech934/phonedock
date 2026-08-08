'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

type ReviewEngineResult = { updated?: number; skipped?: number; error?: string };
type ReviewStats = { total: number; missingRatings: number; missingReviews: number; withBenchmarks: number; missingBenchmarks: number };

export default function ReviewEngineAdminPage() {
  const [limit, setLimit] = useState(25);
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [result, setResult] = useState<ReviewEngineResult | null>(null);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/admin/review-engine', { credentials: 'include', cache: 'no-store' });
      setStats(await readApiResponse<ReviewStats>(response));
    } catch { setStats(null); } finally { setStatsLoading(false); }
  }

  useEffect(() => { void loadStats(); }, []);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const response = await fetch('/api/admin/review-engine', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, overwrite }),
      });
      const data = await readApiResponse<ReviewEngineResult>(response);
      if (!response.ok) throw new Error(data.error || 'Review generation failed');
      setResult(data); await loadStats();
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Review generation failed' });
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Data Control</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-violet-600" /> Ratings & Benchmark Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Editorial scores, deterministic reviews aur benchmark coverage ko ek jagah monitor karein.</p>
        </div>
        <Link href="/admin/data-quality" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Back to Data Quality</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Catalog', stats?.total], ['Missing ratings', stats?.missingRatings], ['Missing reviews', stats?.missingReviews], ['With benchmarks', stats?.withBenchmarks], ['Missing benchmarks', stats?.missingBenchmarks],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-black text-gray-950">{statsLoading ? '…' : Number(value || 0).toLocaleString()}</p></div>)}
      </div>

      <div className="card-premium p-5 space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Sparkles className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Safe score generation</p><p className="mt-1 text-xs leading-5 text-blue-800">Engine sirf existing phone/spec data use karta hai. Existing editorial reviews protected rehte hain jab tak overwrite explicitly enable na ho.</p></div></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 text-sm font-medium">Batch size
            <input type="number" min={1} max={100} value={limit} onChange={e => setLimit(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className="w-full h-10 rounded-xl border border-gray-200 px-3" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 mt-6">
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            <span className="text-sm">Regenerate existing editorial reviews</span>
          </label>
        </div>
        <button onClick={run} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Generating…' : 'Generate Review Batch'}
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex gap-3"><ShieldCheck className="w-5 h-5 shrink-0" /><p>Ratings, benchmarks aur user ratings separate concepts hain. Ye engine editorial scores generate karta hai; benchmark documents ko overwrite nahi karta.</p></div>

      {result && <div className={`rounded-xl border p-4 text-sm ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>{result.error || `Updated ${result.updated || 0} phones; skipped ${result.skipped || 0}.`}</div>}
    </div>
  );
}
