'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock3,
  Database,
  RefreshCw,
  Radio,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { readApiResponse } from '@/lib/client/api-response';
import { useAdmin } from '@/lib/useAdmin';

interface RecentActivity {
  id?: string;
  action?: string;
  details?: string;
  createdAt?: string;
}

interface SyncStats {
  totalSources: number;
  activeSources: number;
  totalJobs: number;
  pendingReview: number;
  completedJobs: number;
  jobsRunning: number;
  jobsWaiting: number;
  jobsFailed: number;
  recentActivity: RecentActivity[];
  config?: {
    schedulerEnabled?: boolean;
    deterministicOnly?: boolean;
  };
}

interface RunAllResponse {
  success?: boolean;
  error?: string;
  started?: string[];
  skipped?: string[];
  unconfigured?: string[];
}

const EMPTY_STATS: SyncStats = {
  totalSources: 0,
  activeSources: 0,
  totalJobs: 0,
  pendingReview: 0,
  completedJobs: 0,
  jobsRunning: 0,
  jobsWaiting: 0,
  jobsFailed: 0,
  recentActivity: [],
};

function formatActivityDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminSyncPage() {
  useAdmin();
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStats = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch('/api/collector/dashboard', { credentials: 'include', cache: 'no-store' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load sync status.');
      setStats({ ...EMPTY_STATS, ...(data as Partial<SyncStats>) });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sync status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      // The collector already owns sync orchestration. Use its run-all endpoint so
      // every enabled/configured source gets an incremental job and active jobs
      // are skipped instead of creating duplicate work.
      const response = await fetch('/api/collector/jobs/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await readApiResponse(response) as RunAllResponse;
      if (!response.ok) throw new Error(data.error || 'Failed to start sync.');

      const started = data.started?.length ?? 0;
      const skipped = data.skipped?.length ?? 0;
      const unconfigured = data.unconfigured?.length ?? 0;
      setMessage(
        `Incremental sync started for ${started} source${started === 1 ? '' : 's'}` +
        `${skipped ? `; ${skipped} already active` : ''}` +
        `${unconfigured ? `; ${unconfigured} need configuration` : ''}.`,
      );
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Data Sync</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Incremental collection, review routing, conflict control, and scheduled source sync.</p>
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {stats.config?.schedulerEnabled ? 'Auto sync ready' : 'Manual sync'}
        </Badge>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1"><p className="font-semibold">Sync action needs attention</p><p className="mt-0.5">{error}</p></div>
          <button onClick={() => void loadStats(true)} className="inline-flex items-center gap-1 font-semibold hover:underline"><RotateCcw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-xs text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" /><span>{message}</span>
        </div>
      )}

      <div className="card-premium p-6 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <RefreshCw className={`w-8 h-8 text-blue-500 ${syncing ? 'animate-spin' : ''}`} />
        </div>
        <h2 className="font-bold text-gray-900 mb-2">Sync All Configured Sources</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-5">
          Starts one incremental collector job per enabled source. Existing queued, running, or paused jobs are skipped, preventing duplicate sync work. Incoming changes remain review-controlled before they affect live phone data.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing || stats.activeSources === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-500/25"
        >
          {syncing ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting sync...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Start Incremental Sync</>
          )}
        </button>
        {stats.activeSources === 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No active sources. Configure a collector source first.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-blue-500" /><span className="text-xs font-semibold text-gray-900">Active Sources</span></div>
          <p className="text-2xl font-bold text-gray-900">{stats.activeSources} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalSources}</span></p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2"><Clock3 className="w-4 h-4 text-violet-500" /><span className="text-xs font-semibold text-gray-900">Active Jobs</span></div>
          <p className="text-2xl font-bold text-gray-900">{stats.jobsRunning + stats.jobsWaiting}</p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-amber-500" /><span className="text-xs font-semibold text-gray-900">Needs Review</span></div>
          <p className="text-2xl font-bold text-gray-900">{stats.pendingReview}</p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs font-semibold text-gray-900">Completed Jobs</span></div>
          <p className="text-2xl font-bold text-gray-900">{stats.completedJobs}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/admin/collector/sources" className="card-premium p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center"><Radio className="w-4 h-4 text-emerald-500" /></div><div><p className="text-sm font-semibold text-gray-900">Sources & Auto Sync</p><p className="text-[10px] text-muted-foreground">Enable sources and configure sync frequency</p></div></div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </div>
        </Link>
        <Link href="/admin/collector/jobs" className="card-premium p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center"><RefreshCw className="w-4 h-4 text-violet-500" /></div><div><p className="text-sm font-semibold text-gray-900">Sync Jobs</p><p className="text-[10px] text-muted-foreground">Progress, resume, retry, cancel, and errors</p></div></div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </div>
        </Link>
        <Link href="/admin/collector/review" className="card-premium p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-amber-500" /></div><div><p className="text-sm font-semibold text-gray-900">Conflict / Review Queue</p><p className="text-[10px] text-muted-foreground">Approve verified incoming changes before import</p></div></div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
          </div>
        </Link>
      </div>

      {stats.recentActivity.length > 0 && (
        <div className="card-premium p-4">
          <div className="flex items-center justify-between mb-3"><div><p className="text-sm font-bold text-gray-900">Recent Sync Activity</p><p className="text-[10px] text-muted-foreground">Collector actions are recorded in Activity Logs.</p></div><Link href="/admin/activity" className="text-[10px] font-semibold text-blue-600 hover:underline">All activity</Link></div>
          <div className="divide-y divide-gray-100">
            {stats.recentActivity.slice(0, 5).map((activity, index) => (
              <div key={activity.id || `${activity.action}-${index}`} className="py-2.5 flex items-start justify-between gap-4">
                <div><p className="text-xs font-medium text-gray-900">{activity.details || activity.action || 'Collector activity'}</p><p className="text-[10px] text-muted-foreground mt-0.5">{activity.action || 'sync'}</p></div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatActivityDate(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
