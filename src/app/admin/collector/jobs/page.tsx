'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorJob {
  id: string;
  sourceId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  phonesCollected?: number;
  phonesUpdated?: number;
  phonesFailed?: number;
}

export default function AdminCollectorJobsPage() {
  useAdmin();
  const [jobs, setJobs] = useState<CollectorJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/collector/jobs', { credentials: 'include' })
      .then(r => r.json()).then(d => { setJobs(d.jobs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job record?')) return;
    await fetch('/api/collector/jobs', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ jobId: id }),
    });
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' },
    running: { icon: Loader, color: 'text-blue-500', bg: 'bg-blue-50' },
    completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  };

  if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{jobs.length} jobs total</p>
        </div>
        <div className="flex items-center gap-2">
          {jobs.filter(j => j.status === 'running').length > 0 && (
            <Badge className="bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200/50 animate-pulse">
              <Loader className="w-3 h-3 mr-1" /> {jobs.filter(j => j.status === 'running').length} Running
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {jobs.map(job => {
          const config = statusConfig[job.status] || statusConfig.pending;
          const Icon = config.icon;
          return (
            <div key={job.id} className="card-premium p-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 ${job.status === 'running' ? 'animate-pulse' : ''}`}>
                  <Icon className={`w-5 h-5 ${config.color} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900">Job #{job.id?.slice(-6)}</h3>
                    <Badge variant="secondary" className={`text-[10px] ${config.bg} ${config.color}`}>{job.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-muted-foreground">
                    <span>Started: {job.startedAt ? new Date(job.startedAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not started'}</span>
                    {job.completedAt && <span>Completed: {new Date(job.completedAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                    {job.phonesCollected !== undefined && <span className="text-emerald-600">+{job.phonesCollected} phones</span>}
                    {job.phonesUpdated !== undefined && <span className="text-blue-600">~{job.phonesUpdated} updated</span>}
                    {job.phonesFailed !== undefined && <span className="text-red-600">{job.phonesFailed} failed</span>}
                  </div>
                  {job.error && (
                    <div className="mt-2 p-2 bg-red-50/50 rounded-lg border border-red-100/50 text-[10px] text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{job.error}</span>
                    </div>
                  )}
                  {job.status === 'running' && job.progress !== undefined && (
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(job.progress, 100)}%` }} />
                    </div>
                  )}
                </div>
                <button onClick={() => deleteJob(job.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {jobs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No collector jobs yet</p>
            <p className="text-xs mt-1">Jobs are created when data collection runs</p>
          </div>
        )}
      </div>
    </div>
  );
}