'use client';

import { useState, useEffect } from 'react';
import { Activity, Plus, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import type { ActivityLog } from '@/components/shared/types';

export default function AdminActivityPage() {
  useAdmin();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/activity', { credentials: 'include' })
      .then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-xl font-extrabold text-gray-900">Activity Log</h1>
      <div className="card-premium p-4 sm:p-6">
        {logs.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-4">
              {logs.map((log, i) => (
                <div key={log.id || i} className="relative flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 z-10 ring-4 ring-white">
                    {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {log.entityType && <Badge variant="secondary" className="text-[10px]">{log.entityType}</Badge>}
                      {log.admin && <span className="text-[10px] text-muted-foreground">{log.admin.name}</span>}
                      <span className="text-[10px] text-muted-foreground/70">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground"><Activity className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No activity logged yet</p></div>
        )}
      </div>
    </div>
  );
}