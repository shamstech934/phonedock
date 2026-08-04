'use client';

import { useState } from 'react';
import { Sparkles, ShieldCheck, RefreshCw } from 'lucide-react';

export default function ReviewEngineAdminPage() {
  const [limit, setLimit] = useState(25);
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated?: number; skipped?: number; error?: string } | null>(null);

  async function run() {
    setLoading(true); setResult(null);
    try {
      const response = await fetch('/api/admin/review-engine', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, overwrite }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review generation failed');
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Review generation failed' });
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> Smart Review Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate deterministic scores, pros, cons and buying verdicts from existing PhoneDock data. No external AI or fabricated specs.</p>
      </div>

      <div className="card-premium p-5 space-y-5">
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

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex gap-3"><ShieldCheck className="w-5 h-5 shrink-0" /><p>Existing reviews are protected unless overwrite is enabled. Each request is admin-authenticated and limited to 100 phones.</p></div>

      {result && <div className={`rounded-xl border p-4 text-sm ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>{result.error || `Updated ${result.updated || 0} phones; skipped ${result.skipped || 0}.`}</div>}
    </div>
  );
}
