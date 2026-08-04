'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Radio, Database, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

export default function AdminSyncPage() {
  useAdmin();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [stats, setStats] = useState({ totalSources: 0, activeSources: 0, totalJobs: 0, pendingReview: 0, completedJobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/collector/dashboard', { credentials: 'include' })
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch('/api/collector/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ sourceId: 'all', action: 'sync' }),
      });
      setLastSync(new Date().toLocaleString('en-PK'));
    } catch (e) { console.error('[triggerSync]', e); }
    setSyncing(false);
  };

  if (loading) return <div className="grid grid-cols-2 gap-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Data Sync</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Trigger manual data sync and manage collection</p>
        </div>
      </div>

      <div className="card-premium p-6 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <RefreshCw className={`w-8 h-8 text-blue-500 ${syncing ? 'animate-spin' : ''}`} />
        </div>
        <h2 className="font-bold text-gray-900 mb-2">Sync All Sources</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Trigger a full data sync from all active collector sources. This will create new collection jobs and pull the latest phone data from configured providers.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing || stats.activeSources === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-500/25"
        >
          {syncing ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Syncing...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Start Sync</>
          )}
        </button>
        {stats.activeSources === 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No active sources. Configure sources first.</span>
          </div>
        )}
        {lastSync && (
          <p className="text-xs text-muted-foreground mt-3">Last sync: {lastSync}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-900">Active Sources</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.activeSources} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalSources}</span></p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-900">Completed Jobs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.completedJobs}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/admin/collector/sources" className="card-premium p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Radio className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Manage Sources</p>
                <p className="text-[10px] text-muted-foreground">Add, edit, or toggle data sources</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>

        <Link href="/admin/collector/jobs" className="card-premium p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">View Jobs</p>
                <p className="text-[10px] text-muted-foreground">Job history, status, and errors</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}