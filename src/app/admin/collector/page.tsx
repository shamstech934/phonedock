'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Radio, Database, CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

export default function AdminCollectorPage() {
  useAdmin();
  const [stats, setStats] = useState({ totalSources: 0, activeSources: 0, totalJobs: 0, pendingReview: 0, completedJobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/collector/dashboard', { credentials: 'include' })
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-28 rounded-2xl" />)}</div>;

  const cards = [
    { label: 'Total Sources', value: stats.totalSources, icon: Database, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Active Sources', value: stats.activeSources, icon: Radio, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { label: 'Total Jobs', value: stats.totalJobs, icon: Clock, bg: 'bg-violet-50', iconColor: 'text-violet-500' },
    { label: 'Pending Review', value: stats.pendingReview, icon: AlertCircle, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Data collection system and automation</p>
        </div>
        <div className="flex items-center gap-2">
          {stats.activeSources > 0 ? (
            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">
              <CheckCircle className="w-3 h-3 mr-1" /> {stats.activeSources} Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">No Active Sources</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card-premium p-4">
            <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center mb-2.5`}>
              <c.icon className={`w-4 h-4 ${c.iconColor}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

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

      <div className="card-premium p-5">
        <h3 className="font-bold text-sm text-gray-900 mb-3">System Status</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completed Jobs</span>
            <span className="font-semibold text-gray-900">{stats.completedJobs}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Items Pending Review</span>
            <Badge className="bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200/50">{stats.pendingReview}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Source Coverage</span>
            <span className="font-semibold text-gray-900">{stats.totalSources > 0 ? `${Math.round((stats.activeSources / stats.totalSources) * 100)}%` : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}