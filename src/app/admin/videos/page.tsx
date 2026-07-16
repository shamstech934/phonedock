'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { RefreshCw, ExternalLink, Check, X, AlertTriangle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  phoneId: string | null;
  phone: { modelName: string; slug: string; brand: string } | null;
  active: boolean;
  autoLinked: boolean;
  createdAt: string;
}

export default function AdminVideosPage() {
  useAdmin();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; inserted: number; skipped: number; autoLinked: number; error?: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchVideos = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    fetch(`/api/admin/videos?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setVideos(d.videos || []);
        setTotal(d.total || 0);
        setPendingCount(d.pendingCount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/videos/sync', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setSyncResult(data);
      fetchVideos();
    } catch {}
    setSyncing(false);
  };

  const handleToggleActive = async (v: VideoItem) => {
    setSavingId(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: !v.active, autoLinked: false }),
      });
      fetchVideos();
    } catch {}
    setSavingId(null);
  };

  const handleUnlink = async (v: VideoItem) => {
    setSavingId(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneId: null, autoLinked: false }),
      });
      fetchVideos();
    } catch {}
    setSavingId(null);
  };

  const handleConfirmLink = async (v: VideoItem) => {
    setSavingId(v.id);
    try {
      await fetch(`/api/admin/videos/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: true, autoLinked: false }),
      });
      fetchVideos();
    } catch {}
    setSavingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">YouTube Videos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} total &middot; {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} pending review</span>}
          </p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncResult && (
        <div className={`p-4 rounded-xl text-sm ${syncResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {syncResult.error
            ? <>Sync failed: {syncResult.error}</>
            : <>Fetched {syncResult.total} videos: {syncResult.inserted} new, {syncResult.autoLinked} auto-linked, {syncResult.skipped} skipped.</>
          }
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'active'] as const).map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? `All (${total})` : s === 'pending' ? `Pending (${pendingCount})` : 'Active'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Play className="w-12 h-12 mx-auto mb-3 opacity-15" />
          <p className="text-sm">No videos found. Click &quot;Sync Now&quot; to fetch from YouTube.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map(v => (
            <div key={v.id} className={`p-4 rounded-xl border ${!v.active ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'} flex gap-4 items-start`}>
              {/* Thumbnail */}
              <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" unoptimized />}
                <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
                  <Play className="w-5 h-5 text-white drop-shadow" fill="currentColor" />
                </a>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{v.title}</h3>
                  <Badge variant={v.active ? 'default' : 'secondary'} className={`text-[10px] shrink-0 ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {v.active ? 'Live' : 'Pending'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(v.publishedAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                  {v.phone && <> &middot; <span className="text-blue-600">{v.phone.brand} {v.phone.modelName}</span></>}
                </p>
                {v.autoLinked && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" /> Auto-linked — needs confirmation
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {v.autoLinked && v.phone && (
                  <button onClick={() => handleConfirmLink(v)} disabled={savingId === v.id} title="Confirm link & activate"
                    className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 disabled:opacity-50 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {v.phone && (
                  <button onClick={() => handleUnlink(v)} disabled={savingId === v.id} title="Unlink from phone"
                    className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 disabled:opacity-50 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleToggleActive(v)} disabled={savingId === v.id}
                  title={v.active ? 'Deactivate' : 'Activate'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors ${v.active ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}>
                  {v.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}