'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader, RefreshCw, Zap, AlertTriangle, RotateCcw, BarChart3, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorJob {
  id: string; sourceId?: string; sourceName?: string; status: string;
  lastError?: string; startedAt?: string; completedAt?: string; createdAt: string;
  fetched?: number; newPhones?: number; possibleUpdates?: number; duplicates?: number; failureCount?: number;
  currentBatch?: number; totalBatches?: number; totalExpected?: number; retryCount?: number;
}

export default function AdminCollectorJobsPage() {
  useAdmin();
  const [jobs, setJobs] = useState<CollectorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<CollectorJob | null>(null);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/collector/jobs', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch jobs'); return r.json(); })
      .then(d => { setJobs(d.jobs || []); setLoading(false); })
      .catch((e) => { setError(e?.message || 'Failed to load jobs. Please try again.'); setLoading(false); });
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const deleteJob = async (id: string) => {
    try {
      const response = await fetch('/api/collector/jobs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ jobId: id }) });
      if (!response.ok) throw new Error('Failed to delete collector job');
      setDeleteModal(null);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (error) { setError(error instanceof Error ? error.message : 'Failed to delete collector job'); }
  };

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const runJobAction = async (id: string, action: 'resume' | 'retry' | 'cancel') => {
    setActionBusyId(id);
    try {
      const response = await fetch(`/api/collector/jobs/${id}/${action}`, { method: 'POST', credentials: 'include' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || `Failed to ${action} job`);
      fetchJobs();
    } catch (error) { setError(error instanceof Error ? error.message : `Failed to ${action} job`); }
    finally { setActionBusyId(null); }
  };

  function cleanCollectorError(value?: string): string {
  if (!value) return '';
  if (/Headers\.(?:append|set)|invalid header value/i.test(value)) {
    return 'Invalid HTTP header configuration. Retry this job after deploying the latest collector fix.';
  }
  // Defensive UI guard: do not render serialized database documents or huge
  // upstream HTML/error bodies in the jobs list.
  return value.replace(/\s+/g, ' ').slice(0, 500);
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    queued: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Queued' },
    running: { icon: Loader, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Running' },
    paused: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Paused' },
    completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' },
    partially_completed: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Partially Completed' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Cancelled' },
  };

  const totalJobs = jobs.length;
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;
  const totalCollected = jobs.reduce((sum, j) => sum + (j.newPhones || 0), 0);

  const filteredJobs = jobs
    .filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const jobId = j.id?.slice(-6).toLowerCase() || '';
      return jobId.includes(q);
    });

  if (error) return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Collector Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Job history and status</p>
        </div>
      </div>
      <div className="card-premium p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-red-500" /></div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Unable to Load Jobs</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
        <button onClick={fetchJobs} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    </div>
  );

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
          <button onClick={fetchJobs} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors" aria-label="Refresh">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Jobs', value: totalJobs, icon: Clock, bg: 'bg-gray-100', color: 'text-gray-600' },
          { label: 'Completed', value: completed, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Failed', value: failed, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
          { label: 'Running', value: running, icon: Zap, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Total Collected', value: totalCollected, icon: BarChart3, bg: 'bg-violet-50', color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="card-premium p-3.5">
            <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
            <p className="text-base font-bold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by job ID..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'queued', 'running', 'paused', 'completed', 'partially_completed', 'failed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 text-[11px] font-medium rounded-xl transition-colors ${statusFilter === s ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-2">
        {filteredJobs.map(job => {
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
                  {(job.fetched !== undefined || job.newPhones !== undefined || job.failureCount !== undefined) && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {job.newPhones !== undefined && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{job.newPhones} new</span>}
                      {job.possibleUpdates !== undefined && job.possibleUpdates > 0 && <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">~{job.possibleUpdates} possible updates</span>}
                      {job.duplicates !== undefined && job.duplicates > 0 && <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">{job.duplicates} duplicates</span>}
                      {job.failureCount !== undefined && job.failureCount > 0 && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{job.failureCount} failed</span>}
                      {job.fetched !== undefined && <span className="text-[10px] text-gray-400">{job.fetched} fetched total</span>}
                    </div>
                  )}
                  {/* Error */}
                  {job.lastError && (
                    <div className="mt-2 p-2.5 bg-red-50/50 rounded-lg border border-red-100/50 text-[11px] text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{cleanCollectorError(job.lastError)}</span>
                    </div>
                  )}
                  {/* Progress */}
                  {(job.status === 'running' || job.status === 'paused') && !!job.totalExpected && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Progress · batch {job.currentBatch || 0}</span>
                        <span className="text-[10px] font-medium text-blue-600">{Math.min(100, Math.round(((job.fetched || 0) / job.totalExpected) * 100))}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round(((job.fetched || 0) / job.totalExpected) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-1 sm:mt-0">
                  {(job.status === 'paused' || job.status === 'failed') && (
                    <button onClick={() => runJobAction(job.id, 'resume')} disabled={actionBusyId === job.id} className="p-2 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50" title="Resume from where it left off" aria-label="Resume job">
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  {job.status === 'failed' && (
                    <button onClick={() => runJobAction(job.id, 'retry')} disabled={actionBusyId === job.id} className="p-2 rounded-lg hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50" title="Retry from the start" aria-label="Retry job">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {['queued', 'running', 'paused'].includes(job.status) && (
                    <button onClick={() => runJobAction(job.id, 'cancel')} disabled={actionBusyId === job.id} className="p-2 rounded-lg hover:bg-amber-100 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Cancel job" aria-label="Cancel job">
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDeleteModal(job)} className="p-2 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete" aria-label="Delete job">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredJobs.length === 0 && jobs.length > 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Filter className="w-7 h-7 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-900">No jobs match your filter</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different status filter or search term.</p>
            <button onClick={() => { setStatusFilter('all'); setSearch(''); }} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100">
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        )}
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
