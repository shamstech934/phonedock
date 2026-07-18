'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({ title: '', slug: '', excerpt: '', content: '', category: 'General', author: '', image: '', published: false, status: 'draft' });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/news/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.title) {
          setForm({
            title: d.title || '',
            slug: d.slug || '',
            excerpt: d.excerpt || '',
            content: d.content || '',
            category: d.category || 'General',
            author: d.author || '',
            image: d.image || '',
            published: d.published || false,
            status: d.status || 'draft',
          });
        }
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, [id]);

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, slug: form.slug || generateSlug(form.title) }),
      });
      const data = await res.json();
      if (res.ok) { router.push('/admin/news'); } else { alert(data.error || 'Failed to update'); }
    } catch { alert('Network error'); }
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Article</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Article title" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Slug</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="article-slug" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Excerpt</label>
          <textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Brief summary..." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Content *</label>
          <textarea required value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={12} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Article content (HTML supported)..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {['General', 'Review', 'Comparison', 'Guide', 'News', 'Opinion'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Author</label>
            <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Author name" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Image URL</label>
            <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}