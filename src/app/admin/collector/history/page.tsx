'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RotateCcw, Ban } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorJob {
  id: string; sourceName?: string; status: string; mode?: string;
  fetched?: number; newPhones?: number; possibleUpdates?: number; duplicates?: number; failureCount?: number;
  startedAt?: string; completedAt?: string; duration?: number; retryCount?: number;
}

const TERMINAL = ['completed', 'partially_completed', 'failed', 'cancelled'];

const statusIcon: Record<string, { icon: React.ElementType; color: string }> = {
  completed: { icon: CheckCircle, color: 'text-emerald-500' },
  partially_completed: { icon: AlertTriangle, color: 'text-amber-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  cancelled: { icon: Ban, color: 'text-gray-400' },
};

function formatDuration(ms?: number) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function AdminCollectorHistoryPage() {
  useAdmin();
  const [jobs, setJobs] = useState<CollectorJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    fetch('/api/collector/jobs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load history')))
      .then(d => setJobs((d.jobs || []).filter((j: CollectorJob) => TERMINAL.includes(j.status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const totals = jobs.reduce((acc, j) => ({
    runs: acc.runs + 1,
    newPhones: acc.newPhones + (j.newPhones || 0),
    failed: acc.failed + (j.status === 'failed' ? 1 : 0),
  }), { runs: 0, newPhones: 0, failed: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Collector History</h1>
          <p className="text-xs text-gray-500 mt-0.5">{totals.runs} completed run{totals.runs === 1 ? '' : 's'} · {totals.newPhones} phones collected total · {totals.failed} failed run{totals.failed === 1 ? '' : 's'}</p>
        </div>
        <button onClick={fetchJobs} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
          <p className="text-sm text-gray-500">No completed runs yet — history appears here once a job finishes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const cfg = statusIcon[job.status] || statusIcon.completed;
            const Icon = cfg.icon;
            return (
              <div key={job.id} className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-100 rounded-xl">
                <Icon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{job.sourceName || 'Unknown source'} <span className="text-gray-400 font-normal">· {job.mode || 'incremental'}</span></p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {job.fetched || 0} fetched · {job.newPhones || 0} new · {job.possibleUpdates || 0} updates · {job.duplicates || 0} duplicates · {job.failureCount || 0} failed
                    {job.retryCount ? ` · retried ${job.retryCount}×` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">{formatDuration(job.duration)}</p>
                  <p className="text-[10px] text-gray-400">{job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }) : '—'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
