'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database, CheckCircle, AlertCircle, Clock, ArrowRight, Radio, Zap,
  TrendingUp, BarChart3, RefreshCw, Settings, Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

export default function AdminCollectorPage() {
  useAdmin();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/collector/dashboard', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/collector/jobs', { credentials: 'include' }).then(r => r.json()),
    ]).then(([d, j]) => { setStats(d); setRecentJobs((j.jobs || []).slice(0, 5)); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-28 rounded-2xl" />)}</div>;

  const successRate = stats?.totalJobs > 0 ? `${Math.round(((stats.completedJobs || 0) / stats.totalJobs) * 100)}%` : 'N/A';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Data collection system and automation</p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.activeSources > 0 ? (
            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">
              <CheckCircle className="w-3 h-3 mr-1" /> {stats.activeSources} Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">No Active Sources</Badge>
          )}
        </div>
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