'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader, RefreshCw, Zap, AlertTriangle, RotateCcw, BarChart3, Search, Filter, ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorJob {
  id: string; sourceId?: string; sourceName?: string; status: string;
  lastError?: string; startedAt?: string; completedAt?: string; createdAt: string;
  fetched?: number; newPhones?: number; possibleUpdates?: number; duplicates?: number; failureCount?: number;
  currentBatch?: number; totalBatches?: number; totalExpected?: number; retryCount?: number;
  normalized?: number; conflictCount?: number; duration?: number; trigger?: string; mode?: string;
  errorLog?: string[]; warningLog?: string[]; warningCount?: number; skippedCount?: number; requestId?: string; updatedAt?: string;
}

export default function AdminCollectorJobsPage() {
  useAdmin();
  const [jobs, setJobs] = useState<CollectorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<CollectorJob | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoResumeKeys = useRef<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/collector/jobs', { credentials: 'include' });
      const payload = await readApiResponse<{ jobs?: CollectorJob[]; error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch jobs');
      setJobs(payload.jobs || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const hasActiveJob = jobs.some(job => job.status === 'queued' || job.status === 'running');
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => fetchJobs(), 5000);
    return () => window.clearInterval(timer);
  }, [jobs, fetchJobs]);

  const deleteJob = async (id: string) => {
    setDeleteBusy(true);
    setActionError(null);
    try {
      const response = await fetch('/api/collector/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: id }),
      });
      const payload = await readApiResponse<{ success?: boolean; error?: string }>(response).catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to delete collector job (HTTP ${response.status})`);
      setDeleteModal(null);
      setJobs(previous => previous.filter(job => job.id !== id));
    } catch (reason) {
      // A failed action must not replace the whole jobs screen with a load error.
      setActionError(reason instanceof Error ? reason.message : 'Failed to delete collector job');
    } finally {
      setDeleteBusy(false);
    }
  };

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const runJobAction = useCallback(async (id: string, action: 'resume' | 'retry' | 'cancel') => {
    setActionBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/collector/jobs/${id}/${action}`, { method: 'POST', credentials: 'include' });
      const data = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || `Failed to ${action} job`);
      await fetchJobs();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : `Failed to ${action} job`);
    } finally {
      setActionBusyId(null);
    }
  }, [fetchJobs]);

  // Manual collector runs are split into bounded serverless batches. Continue
  // paused batches automatically while this page is open instead of making the
  // admin press Resume after every batch. Scheduled cron remains the fallback
  // when the page is closed.
  useEffect(() => {
    if (actionBusyId) return;
    const pausedJob = jobs.find(job => job.status === 'paused');
    if (!pausedJob) return;
    const continuationKey = `${pausedJob.id}:${pausedJob.currentBatch || 0}`;
    if (autoResumeKeys.current.has(continuationKey)) return;
    autoResumeKeys.current.add(continuationKey);
    const timer = window.setTimeout(() => { void runJobAction(pausedJob.id, 'resume'); }, 700);
    return () => window.clearTimeout(timer);
  }, [jobs, actionBusyId, runJobAction]);


  const toggleJob = (id: string) => {
    setExpandedJobs(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadJobLog = (job: CollectorJob) => {
    const lines = [
      `Collector Job ${job.id}`,
      `Source: ${job.sourceName || 'Unknown'}`,
      `Status: ${job.status}`,
      `Created: ${job.createdAt || ''}`,
      `Started: ${job.startedAt || ''}`,
      `Completed: ${job.completedAt || ''}`,
      `Fetched: ${job.fetched || 0}`,
      `New phones: ${job.newPhones || 0}`,
      `Possible updates: ${job.possibleUpdates || 0}`,
      `Duplicates: ${job.duplicates || 0}`,
      `Failures: ${job.failureCount || 0}`,
      `Warnings: ${job.warningCount || 0}`,
      `Skipped assets: ${job.skippedCount || 0}`,
      '',
      'Warnings:',
      ...(job.warningLog?.length ? job.warningLog : ['No warnings recorded.']),
      '',
      'Errors / warnings:',
      ...(job.errorLog?.length ? job.errorLog : [job.lastError || 'No error log recorded.']),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `collector-job-${job.id.slice(-6)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

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

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}

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
          const expanded = expandedJobs.has(job.id);
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
                      {(job.warningCount || 0) > 0 && <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">{job.warningCount} warnings</span>}
                      {(job.skippedCount || 0) > 0 && <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">{job.skippedCount} skipped assets</span>}
                      {job.fetched !== undefined && <span className="text-[10px] text-gray-400">{job.fetched} fetched total</span>}
                    </div>
                  )}
                  {/* Error */}
                  {job.lastError && (
                    <div className="mt-2 p-2.5 bg-red-50/50 rounded-lg border border-red-100/50 text-[11px] text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{job.lastError}</span>
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
                  <button onClick={() => toggleJob(job.id)} className="p-2 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title={expanded ? 'Hide details' : 'View details'} aria-label={expanded ? 'Hide job details' : 'View job details'}>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {job.status === 'paused' && (
                    <button onClick={() => runJobAction(job.id, 'resume')} disabled={actionBusyId === job.id} className="p-2 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50" title="Resume from where it left off" aria-label="Resume job">
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  {['failed', 'partially_completed'].includes(job.status) && (
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

              {expanded && (
                <div className="mt-4 border-t border-gray-100 pt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-blue-500" /><h4 className="text-sm font-semibold text-gray-900">Job details</h4></div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <dt className="text-gray-500">Source</dt><dd className="font-medium text-gray-900 text-right break-words">{job.sourceName || 'Unknown'}</dd>
                      <dt className="text-gray-500">Status</dt><dd className="font-medium text-gray-900 text-right">{config.label}</dd>
                      <dt className="text-gray-500">Trigger</dt><dd className="font-medium text-gray-900 text-right">{job.trigger || 'manual'}</dd>
                      <dt className="text-gray-500">Mode</dt><dd className="font-medium text-gray-900 text-right">{job.mode || 'incremental'}</dd>
                      <dt className="text-gray-500">Fetched</dt><dd className="font-medium text-gray-900 text-right">{job.fetched || 0}</dd>
                      <dt className="text-gray-500">Normalized</dt><dd className="font-medium text-gray-900 text-right">{job.normalized || 0}</dd>
                      <dt className="text-gray-500">New phones</dt><dd className="font-medium text-emerald-700 text-right">{job.newPhones || 0}</dd>
                      <dt className="text-gray-500">Possible updates</dt><dd className="font-medium text-blue-700 text-right">{job.possibleUpdates || 0}</dd>
                      <dt className="text-gray-500">Duplicates</dt><dd className="font-medium text-gray-900 text-right">{job.duplicates || 0}</dd>
                      <dt className="text-gray-500">Conflicts</dt><dd className="font-medium text-amber-700 text-right">{job.conflictCount || 0}</dd>
                      <dt className="text-gray-500">Failures</dt><dd className="font-medium text-red-700 text-right">{job.failureCount || 0}</dd>
                      <dt className="text-gray-500">Warnings</dt><dd className="font-medium text-amber-700 text-right">{job.warningCount || 0}</dd>
                      <dt className="text-gray-500">Skipped assets</dt><dd className="font-medium text-slate-700 text-right">{job.skippedCount || 0}</dd>
                      <dt className="text-gray-500">Retry count</dt><dd className="font-medium text-gray-900 text-right">{job.retryCount || 0}</dd>
                    </dl>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /><h4 className="text-sm font-semibold text-gray-900">Errors and warnings</h4></div>
                      <button onClick={() => downloadJobLog(job)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[11px] font-medium text-gray-700"><Download className="w-3.5 h-3.5" /> Download log</button>
                    </div>
                    {job.warningLog?.length ? (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-amber-800 mb-2">Warnings</p>
                        <ol className="space-y-2 max-h-40 overflow-auto pr-1">
                          {job.warningLog.map((entry, index) => <li key={`${job.id}-warning-${index}`} className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2.5"><span className="font-semibold mr-1">#{index + 1}</span>{entry}</li>)}
                        </ol>
                      </div>
                    ) : null}
                    {job.errorLog?.length ? (
                      <ol className="space-y-2 max-h-56 overflow-auto pr-1">
                        {job.errorLog.map((entry, index) => <li key={`${job.id}-error-${index}`} className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5"><span className="font-semibold mr-1">#{index + 1}</span>{entry}</li>)}
                      </ol>
                    ) : job.lastError ? (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">{job.lastError}</p>
                    ) : !job.warningLog?.length ? (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">No errors or warnings were recorded for this job.</p>
                    ) : null}
                  </div>
                </div>
              )}
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
              <button onClick={() => setDeleteModal(null)} disabled={deleteBusy} className="flex-1 h-10 disabled:opacity-50 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteJob(deleteModal.id)} disabled={deleteBusy} className="flex-1 h-10 disabled:opacity-60 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5">
                {deleteBusy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
