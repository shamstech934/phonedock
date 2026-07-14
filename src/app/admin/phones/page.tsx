'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Star, Smartphone, Plus, Trash2, Edit, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone, Brand } from '@/components/shared/types';

export default function AdminPhonesPage() {
  useAdmin();
  const router = useRouter();
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPhones = useCallback(() => {
    Promise.all([
      fetch('/api/admin/phones', { credentials: 'include' }).then(r => r.json()),
    ]).then(([pd]) => { setPhones(pd.phones || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPhones(); }, [fetchPhones]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/phones/${deleteId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (r.ok) { setPhones(prev => prev.filter(p => p.id !== deleteId)); setDeleteId(null); }
    } catch {}
    setDeleting(false);
  };

  const filtered = phones.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.modelName.toLowerCase().includes(q) || p.brand?.name?.toLowerCase().includes(q) || p.slug.includes(q);
  });

  if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Manage Phones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{phones.length} phones total, {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search phones..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-48" />
          </div>
          <Link href="/admin/phones/new" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Phone</span><span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F8FAFC] border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PTA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p, i) => (
                <tr key={p.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/50'} hover:bg-blue-50/30 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={32} height={32} className="w-8 h-8 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                      <div className="min-w-0"><span className="font-medium text-gray-900 truncate block max-w-[200px]">{p.modelName}</span><span className="text-[10px] text-gray-400">{p.slug}</span></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.brand?.name}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{p.pricePKR > 0 ? formatPrice(p.pricePKR) : '—'}</td>
                  <td className="px-4 py-3">{p.ptaApproved ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">PTA</Badge> : <Badge variant="secondary" className="text-[10px]">{p.ptaStatus || 'Unknown'}</Badge>}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="font-semibold">{p.overallRating || '—'}</span></div></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.featured && <Badge className="bg-amber-50 text-amber-700 text-[10px] border-amber-200/50">Featured</Badge>}
                      {p.trending && <Badge className="bg-blue-50 text-blue-700 text-[10px] border-blue-200/50">Trending</Badge>}
                      {p.upcoming && <Badge className="bg-purple-50 text-purple-700 text-[10px] border-purple-200/50">Upcoming</Badge>}
                      {!p.featured && !p.trending && !p.upcoming && <span className="text-[10px] text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/phones/${p.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" title="View"><Eye className="w-4 h-4" /></Link>
                      <Link href={`/admin/phones/${p.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors" title="Edit"><Edit className="w-4 h-4" /></Link>
                      <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No phones found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="card-premium p-3 flex items-center gap-3">
            {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={40} height={40} className="w-10 h-10 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-5 h-5 text-gray-400" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
              <p className="text-[10px] text-muted-foreground">{p.brand?.name} · {p.pricePKR > 0 ? formatPrice(p.pricePKR) : '—'}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <Link href={`/admin/phones/${p.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Eye className="w-4 h-4" /></Link>
              <Link href={`/admin/phones/${p.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit className="w-4 h-4" /></Link>
              <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <div><h3 className="font-bold text-gray-900">Delete Phone</h3><p className="text-xs text-muted-foreground">This action cannot be undone</p></div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this phone and all its specs, benchmarks, images, and prices?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}