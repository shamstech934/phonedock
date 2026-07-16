'use client';

import { useState, useEffect } from 'react';
import { Star, Check, X, Trash2, Clock, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';
import { useAdmin } from '@/lib/useAdmin';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'all';

interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  comment: string;
  status: string;
  spamFlags: string[];
  phone: { modelName: string; slug: string; thumbnail: string } | null;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const { admin, loading: authLoading } = useAdmin();

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!admin) return null;

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = () => {
    setLoading(true);
    fetch(`/api/admin/reviews?status=${statusFilter}&page=${page}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setReviews(d.reviews || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, [statusFilter, page]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchReviews();
    setActionLoading(null);
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    setActionLoading(id);
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchReviews();
    setActionLoading(null);
  };

  const statusCounts: Record<string, number> = {};
  reviews.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Reviews</h1>
            <p className="text-sm text-muted-foreground mt-1">Moderate user-submitted phone reviews</p>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'flagged', 'approved', 'rejected', 'all'] as ReviewStatus[]).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${statusFilter === s ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s} {s === 'pending' || s === 'flagged' ? `(${total})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className={`rounded-xl border p-4 ${r.status === 'flagged' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= r.rating ? 'currentColor' : 'none'} />)}</div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : r.status === 'flagged' ? 'bg-amber-100 text-amber-700' : r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                      {r.spamFlags?.length > 0 && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {r.spamFlags.join(', ')}</span>}
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{r.comment}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {r.phone && <Link href={`/phones/${r.phone.slug}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" />{r.phone.modelName}</Link>}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.status !== 'approved' && (
                      <button onClick={() => updateStatus(r.id, 'approved')} disabled={actionLoading === r.id} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check className="w-4 h-4" /></button>
                    )}
                    {r.status !== 'rejected' && (
                      <button onClick={() => updateStatus(r.id, 'rejected')} disabled={actionLoading === r.id} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" title="Reject"><X className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => deleteReview(r.id)} disabled={actionLoading === r.id} className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-12 text-muted-foreground">No reviews found with this filter.</p>
        )}
      </div>
    );
}