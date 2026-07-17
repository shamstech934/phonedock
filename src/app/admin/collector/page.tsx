'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database, CheckCircle, AlertCircle, Clock, ArrowRight, Radio,
  TrendingUp, RefreshCw, Play, RotateCcw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

export default function AdminCollectorPage() {
  useAdmin();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [runningCollection, setRunningCollection] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/collector/dashboard', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Dashboard fetch failed'); return r.json(); }),
      fetch('/api/collector/jobs', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Jobs fetch failed'); return r.json(); }),
    ]).then(([d, j]) => {
      setStats(d);
      setRecentJobs((j.jobs || []).slice(0, 5));
      setLastSync(new Date().toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      setLoading(false);
    }).catch((e) => {
      setError(e?.message || 'Failed to load collector data. Please try again.');
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRunCollection = async () => {
    setRunningCollection(true);
    try {
      const res = await fetch('/api/collector/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ sourceId: 'all' }),
      });
      if (!res.ok) throw new Error('Failed to start collection');
      fetchData();
    } catch {
      setError('Failed to start collection. Check that sources are configured.');
    } finally { setRunningCollection(false); }
  };

  if (error) return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-premium p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-7 h-7 text-red-500" /></div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Unable to Load Data</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
        <button onClick={fetchData} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-28 rounded-2xl" />)}</div>;

  const successRate = stats?.totalJobs > 0 ? `${Math.round(((stats.completedJobs || 0) / stats.totalJobs) * 100)}%` : 'N/A';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Data collection system and automation</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stats?.activeSources > 0 ? (
            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">
              <CheckCircle className="w-3 h-3 mr-1" /> {stats.activeSources} Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">No Active Sources</Badge>
          )}
          {lastSync && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Synced {lastSync}
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Link href="/admin/collector/sources" className="card-premium p-3.5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0"><Database className="w-4.5 h-4.5 text-blue-500" /></div>
          <div>
            <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">View Sources</p>
            <p className="text-[10px] text-muted-foreground">{stats?.totalSources || 0} configured</p>
          </div>
        </Link>
        <Link href="/admin/collector/jobs" className="card-premium p-3.5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0"><Clock className="w-4.5 h-4.5 text-violet-500" /></div>
          <div>
            <p className="text-xs font-bold text-gray-900 group-hover:text-violet-600 transition-colors">View Jobs</p>
            <p className="text-[10px] text-muted-foreground">{stats?.totalJobs || 0} total</p>
          </div>
        </Link>
        <button onClick={handleRunCollection} disabled={runningCollection} className="card-premium p-3.5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group flex items-center gap-3 text-left disabled:opacity-60">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
            {runningCollection ? <RefreshCw className="w-4.5 h-4.5 text-emerald-500 animate-spin" /> : <Play className="w-4.5 h-4.5 text-emerald-500" />}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Run Collection</p>
            <p className="text-[10px] text-muted-foreground">Start a new job</p>
          </div>
        </button>
      </div>

      {/* Expanded Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Sources', value: stats?.totalSources || 0, icon: Database, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Active Sources', value: stats?.activeSources || 0, icon: Radio, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Total Jobs', value: stats?.totalJobs || 0, icon: Clock, bg: 'bg-violet-50', color: 'text-violet-600' },
          { label: 'Completed', value: stats?.completedJobs || 0, icon: CheckCircle, bg: 'bg-cyan-50', color: 'text-cyan-600' },
          { label: 'Pending Review', value: stats?.pendingReview || 0, icon: AlertCircle, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Success Rate', value: successRate, icon: TrendingUp, bg: 'bg-indigo-50', color: 'text-indigo-600' },
        ].map(s => (
          <div key={s.label} className="card-premium p-3.5">
            <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
            <p className="text-base font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/admin/collector/sources" className="card-premium p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Collector Sources</h3>
              <p className="text-xs text-muted-foreground mt-1">Manage data sources, providers, and endpoints</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>

        <Link href="/admin/collector/jobs" className="card-premium p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Collector Jobs</h3>
              <p className="text-xs text-muted-foreground mt-1">View job history, status, and error logs</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* System Status */}
      <div className="card-premium p-5">
        <h3 className="font-bold text-sm text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed Jobs</span>
              <span className="font-semibold text-gray-900">{stats?.completedJobs || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items Pending Review</span>
              <Badge className="bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200/50">{stats?.pendingReview || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Source Coverage</span>
              <span className="font-semibold text-gray-900">{stats?.totalSources > 0 ? `${Math.round(((stats.activeSources || 0) / stats.totalSources) * 100)}%` : 'N/A'}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-gray-700 mb-1">Recent Jobs</h4>
            {recentJobs.length > 0 ? recentJobs.map((job: any) => {
              const statusColors: Record<string, string> = { completed: 'bg-emerald-50 text-emerald-700', failed: 'bg-red-50 text-red-700', running: 'bg-blue-50 text-blue-700', pending: 'bg-gray-100 text-gray-600' };
              return (
                <div key={job.id} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-gray-500">#{job.id?.slice(-6)}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[job.status] || statusColors.pending}`}>{job.status}</span>
                </div>
              );
            }) : <p className="text-xs text-muted-foreground">No recent jobs</p>}
          </div>
        </div>
      </div>
    </div>
  );
}