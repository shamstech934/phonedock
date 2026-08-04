'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState, useEffect, useCallback } from 'react';
import { History as HistoryIcon, RotateCcw } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface LogEntry {
  id: string; action: string; details: string; createdAt: string;
  admin?: { name?: string; email?: string };
}

export default function AdminCollectorLogsPage() {
  useAdmin();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback((p: number = 1) => {
    setLoading(true);
    fetch(`/api/admin/activity?module=collector&page=${p}&limit=50`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load logs')))
      .then(d => { setLogs(d.logs || []); setTotal(d.total || 0); setPage(d.page || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Collector Logs</h1>
          <p className="text-xs text-gray-500 mt-0.5">{total} logged action{total === 1 ? '' : 's'} — sources, jobs, review decisions, discovery, scheduled syncs.</p>
        </div>
        <button onClick={() => fetchLogs(page)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
          <HistoryIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No collector activity logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{log.details}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {log.action} · {log.admin?.name || 'System'} · {new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => fetchLogs(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
          <button onClick={() => fetchLogs(page + 1)} disabled={page >= Math.ceil(total / 50)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
