'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Star, Check, X, Trash2, Clock, AlertTriangle, Eye, Search, Filter,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Flag, Shield,
  MessageSquare, BarChart3, Zap, AlertCircle
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface ReviewItem {
  id: string; name: string; rating: number; comment: string; status: string;
  spamFlags: string[]; phone: { modelName: string; slug: string; thumbnail: string; brand: string } | null;
  createdAt: string;
}

interface ReviewStats {
  total: number; pending: number; approved: number; rejected: number;
  flagged: number; spam: number; todayReviews: number; avgRating: number;
}

const STATUS_TABS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'flagged', label: 'Flagged' }, { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }, { value: 'spam', label: 'Spam' },
];

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  flagged: { bg: 'bg-amber-100', text: 'text-amber-700' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  spam: { bg: 'bg-red-100', text: 'text-red-600' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest Rating' }, { value: 'lowest', label: 'Lowest Rating' },
];

export default function AdminReviewsPage() {
  const { admin, loading: authLoading } = useAdmin();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ratingFilter, setRatingFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailReview, setDetailReview] = useState<ReviewItem | null>(null);
  const [deleteModal, setDeleteModal] = useState<ReviewItem | null>(null);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1); }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const fetchReviews = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(rowsPerPage), status: statusFilter, sort });
      if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
      if (ratingFilter) params.set('rating', ratingFilter);
      const res = await fetch(`/api/admin/reviews?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const d = await res.json();
      setReviews(d.reviews || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load reviews'); } finally { setLoading(false); }
  }, [page, rowsPerPage, statusFilter, sort, debouncedSearch, ratingFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reviews/stats', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setStats(await res.json());
    } catch (e: unknown) { console.error('Failed to load review stats:', e); }
  }, []);

  useEffect(() => { fetchReviews(); fetchStats(); }, [fetchReviews, fetchStats]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      fetchReviews(); fetchStats();
      if (detailReview?.id === id) setDetailReview(null);
    } catch (e: unknown) { console.error('Update status failed:', e); }
    setActionLoading(null);
  };

  const deleteReview = async (r: ReviewItem) => {
    setActionLoading(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setDeleteModal(null); setDetailReview(null);
      fetchReviews(); fetchStats();
    } catch (e: unknown) { console.error('Delete review failed:', e); }
    setActionLoading(null);
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setActionLoading('bulk');
    try {
      await Promise.all(Array.from(selected).map(id =>
        fetch(`/api/admin/reviews/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status: action }) })
      ));
      setSelected(new Set()); fetchReviews(); fetchStats();
    } catch (e: unknown) { console.error('Bulk action failed:', e); } finally { setActionLoading(null); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const startIdx = (page - 1) * rowsPerPage + 1;
  const endIdx = Math.min(page * rowsPerPage, total);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!admin) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Moderation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `Showing ${startIdx}\u2013${endIdx} of ${total} Reviews` : 'No reviews yet'}
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Reviews', value: stats.total, icon: MessageSquare, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Pending', value: stats.pending, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600' },
            { label: 'Approved', value: stats.approved, icon: Check, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Rejected', value: stats.rejected, icon: X, bg: 'bg-red-50', color: 'text-red-600' },
            { label: 'Flagged', value: stats.flagged, icon: Flag, bg: 'bg-orange-50', color: 'text-orange-600' },
            { label: 'Spam', value: stats.spam, icon: Shield, bg: 'bg-red-100', color: 'text-red-500' },
            { label: "Today's Reviews", value: stats.todayReviews, icon: Zap, bg: 'bg-violet-50', color: 'text-violet-600' },
            { label: 'Avg Rating', value: stats.avgRating, icon: Star, bg: 'bg-yellow-50', color: 'text-yellow-600' },
          ].map(s => (
            <div key={s.label} className="card-premium p-3.5">
              <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
              <p className="text-base font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by reviewer name, comment..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white" aria-label="Search reviews" />
          </div>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Sort">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={ratingFilter} onChange={e => { setRatingFilter(e.target.value); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Rating filter">
            <option value="">All Ratings</option>
            {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
          </select>
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="h-9 px-2.5 rounded-xl border border-gray-200 text-xs bg-white" aria-label="Per page">
            {[10, 20, 40].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(s => (
            <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${statusFilter === s.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {s.label} {s.value === 'pending' || s.value === 'flagged' ? `(${s.value === 'pending' ? stats?.pending || 0 : stats?.flagged || 0})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-xs font-medium text-blue-700">{selected.size} selected</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { action: 'approved', label: 'Approve', icon: Check, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
              { action: 'rejected', label: 'Reject', icon: X, color: 'bg-red-100 text-red-600 hover:bg-red-200' },
              { action: 'spam', label: 'Spam', icon: Shield, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
            ].map(b => (
              <button key={b.action} onClick={() => handleBulkAction(b.action)} disabled={actionLoading === 'bulk'}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${b.color}`}>
                <b.icon className="w-3 h-3" /> {b.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-blue-600 hover:underline">Clear</button>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="card-premium p-6 border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5 text-red-500" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-red-900">Failed to load data</h3>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => { setError(''); fetchReviews(); fetchStats(); }} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">Retry</button>
          </div>
        </div>
      )}

      {/* Review List */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : reviews.length > 0 ? (
        <div className="space-y-2.5">
          {reviews.map(r => {
            const badge = STATUS_BADGES[r.status] || STATUS_BADGES.pending;
            return (
              <div key={r.id} className={`group p-4 rounded-xl border transition-colors ${selected.has(r.id) ? 'border-blue-300 bg-blue-50/50' : r.status === 'flagged' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-start gap-3.5">
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(r.id)} className="mt-1 shrink-0" aria-label={`Select review by ${r.name}`}>
                    {selected.has(r.id) ? <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div> : <div className="w-4 h-4 rounded border-2 border-gray-300 hover:border-blue-400 transition-colors" />}
                  </button>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0" aria-hidden="true">
                    {r.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailReview(r)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= r.rating ? 'currentColor' : 'none'} />)}</div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{r.status}</span>
                      {r.spamFlags?.length > 0 && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {r.spamFlags.join(', ')}</span>}
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5 leading-relaxed line-clamp-2">{r.comment}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {r.phone && <Link href={`/phones/${r.phone.slug}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}><Eye className="w-3 h-3" />{r.phone.brand} {r.phone.modelName}</Link>}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status !== 'approved' && (
                      <button onClick={() => updateStatus(r.id, 'approved')} disabled={actionLoading === r.id} title="Approve" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50" aria-label="Approve"><Check className="w-4 h-4" /></button>
                    )}
                    {r.status !== 'rejected' && (
                      <button onClick={() => updateStatus(r.id, 'rejected')} disabled={actionLoading === r.id} title="Reject" className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" aria-label="Reject"><X className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => updateStatus(r.id, 'flagged')} disabled={actionLoading === r.id} title="Flag" className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 disabled:opacity-50" aria-label="Flag"><Flag className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteModal(r)} disabled={actionLoading === r.id} title="Delete" className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:bg-red-100 hover:text-red-500 disabled:opacity-50" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Star className="w-8 h-8 text-gray-300" /></div>
          <p className="text-sm font-medium text-gray-900">No reviews available</p>
          <p className="text-xs text-muted-foreground mt-1">Reviews will appear here once users submit them.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-[11px] text-muted-foreground">Showing {startIdx}\u2013{endIdx} of {total}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Previous"><ChevronLeft className="w-3 h-3" /> Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pn: number;
              if (totalPages <= 5) pn = i + 1; else if (page <= 3) pn = i + 1; else if (page >= totalPages - 2) pn = totalPages - 4 + i; else pn = page - 2 + i;
              return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-[11px] font-medium transition-colors ${page === pn ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} aria-label={`Page ${pn}`}>{pn}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Next">Next <ChevronRight className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailReview && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4" role="dialog" aria-modal="true" onClick={() => setDetailReview(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Review Details</h2>
                <button onClick={() => setDetailReview(null)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">{detailReview.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{detailReview.name}</p>
                  <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= detailReview.rating ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= detailReview.rating ? 'currentColor' : 'none'} />)}</div>
                </div>
                <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${(STATUS_BADGES[detailReview.status] || STATUS_BADGES.pending).bg} ${(STATUS_BADGES[detailReview.status] || STATUS_BADGES.pending).text}`}>{detailReview.status}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{detailReview.comment}</p>
              <div className="space-y-2 text-xs text-muted-foreground mb-4">
                {detailReview.phone && <p>Phone: <span className="text-blue-600 font-medium">{detailReview.phone.brand} {detailReview.phone.modelName}</span></p>}
                <p>Date: {new Date(detailReview.createdAt).toLocaleString('en-PK')}</p>
                {detailReview.spamFlags?.length > 0 && <p className="text-amber-600">Spam Flags: {detailReview.spamFlags.join(', ')}</p>}
              </div>
              <div className="flex gap-2">
                {detailReview.status !== 'approved' && <button onClick={() => updateStatus(detailReview.id, 'approved')} disabled={actionLoading === detailReview.id} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"><Check className="w-4 h-4" /> Approve</button>}
                {detailReview.status !== 'rejected' && <button onClick={() => updateStatus(detailReview.id, 'rejected')} disabled={actionLoading === detailReview.id} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"><X className="w-4 h-4" /> Reject</button>}
                <button onClick={() => { setDeleteModal(detailReview); setDetailReview(null); }} disabled={actionLoading === detailReview.id} className="h-10 px-4 rounded-xl border border-gray-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Delete Review</h2>
            <p className="text-xs text-muted-foreground mb-4">This action cannot be undone.</p>
            <div className="p-3 bg-gray-50 rounded-xl mb-4">
              <p className="text-sm font-medium text-gray-900">{deleteModal.name}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{deleteModal.comment}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => deleteReview(deleteModal)} disabled={actionLoading === deleteModal.id} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {actionLoading === deleteModal.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}