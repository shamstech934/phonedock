'use client';

import { useState, useEffect } from 'react';
import { Newspaper, Check, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import type { NewsItem } from '@/components/shared/types';

export default function AdminNewsPage() {
  const { token } = useAdmin();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/news', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage News</h1>
        <span className="text-xs text-muted-foreground">{news.length} articles</span>
      </div>
      <div className="space-y-2">
        {news.map(n => (
          <div key={n.id} className="card-premium p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{n.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {n.published ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Check className="w-3 h-3 mr-0.5" /> Published</Badge> : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {news.length === 0 && <div className="text-center py-16 text-muted-foreground"><Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No news articles yet</p></div>}
      </div>
    </div>
  );
}