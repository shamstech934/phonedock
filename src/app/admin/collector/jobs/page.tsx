'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorJob {
  id: string; sourceId?: string; status: string; progress?: number;
  error?: string; startedAt?: string; completedAt?: string; createdAt: string;
  phonesCollected?: number; phonesUpdated?: number; phonesFailed?: number;
}

export default function AdminCollectorJobsPage() {
  useAdmin();
  const [jobs, setJobs] = useState<CollectorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<CollectorJob | null>(null);

  useEffect(() => {
    fetch('/api/collector/jobs', { credentials: 'include' })
      .then(r => r.json()).then(d => { setJobs(d.jobs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const deleteJob = async (id: string) => {
    try {
      await fetch('/api/collector/jobs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ jobId: id }) });
      setDeleteModal(null);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch {}
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Pending' },
    running: { icon: Loader, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Running' },
    completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Cancelled' },
  };

  const running = jobs.filter(j => j.status === 'running').length;
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;

  if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{jobs.length} jobs total</p>
        </div>
        <div className="flex items-center gap-2">
          {running > 0 && <Badge className="bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200/50 animate-pulse"><Loader className="w-3 h-3 mr-1 animate-spin" /> {running} Running</Badge>}
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors" aria-label="Refresh">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: completed, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Failed', value: failed, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
          { label: 'Running', value: running, icon: Zap, bg: 'bg-blue-50', color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card-premium p-3.5">
            <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
            <p className="text-base font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Jobs List */}
      <div className="space-y-2">
        {jobs.map(job => {
          const config = statusConfig[job.status] || statusConfig.pending;
          const Icon = config.icon;
          return (
            <div key={job.id} className="card-premium p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 ${job.status === 'running' ? 'animate-pulse' : ''}`}>
                  <Icon className={`w-5 h-5 ${config.color} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900">Job #{job.id?.slice(-6)}</h3>
                    <Badge variant="secondary" className={`text-[10px] ${config.bg} ${config.color}`}>{config.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {job.startedAt ? new Date(job.startedAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not started'}</span>
                    {job.completedAt && <span className="flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5 text-emerald-500" /> {new Date(job.completedAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {/* Stats row */}
                  {(job.phonesCollected !== undefined || job.phonesUpdated !== undefined || job.phonesFailed !== undefined) && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {job.phonesCollected !== undefined && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{job.phonesCollected} collected</span>}
                      {job.phonesUpdated !== undefined && <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">~{job.phonesUpdated} updated</span>}
                      {job.phonesFailed !== undefined && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{job.phonesFailed} failed</span>}
                    </div>
                  )}
                  {/* Error */}
                  {job.error && (
                    <div className="mt-2 p-2.5 bg-red-50/50 rounded-lg border border-red-100/50 text-[11px] text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{job.error}</span>
                    </div>
                  )}
                  {/* Progress */}
                  {job.status === 'running' && job.progress !== undefined && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Progress</span>
                        <span className="text-[10px] font-medium text-blue-600">{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(job.progress, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setDeleteModal(job)} className="p-2 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors shrink-0 mt-1 sm:mt-0" title="Delete" aria-label="Delete job">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {jobs.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Clock className="w-8 h-8 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-900">No collector jobs yet</p>
            <p className="text-xs text-muted-foreground mt-1">Jobs are created when data collection runs automatically</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete Job</h2>
            <p className="text-xs text-muted-foreground mb-4">This action cannot be undone.</p>
            <div className="p-3 bg-gray-50 rounded-xl mb-4">
              <p className="text-sm font-medium text-gray-900">Job #{deleteModal.id?.slice(-6)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Status: {deleteModal.status} &middot; Created: {new Date(deleteModal.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteJob(deleteModal.id)} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}