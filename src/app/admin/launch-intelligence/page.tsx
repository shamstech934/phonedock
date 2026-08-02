'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw, Rocket, X } from 'lucide-react';

interface Candidate {
  _id: string;
  brandName: string;
  modelName: string;
  sourceTitle: string;
  sourceName: string;
  sourceUrl: string;
  availabilityStatus: string;
  confidence: number;
  reasons: string[];
  status: string;
  createdAt: string;
  linkedPhoneId?: { modelName: string; slug: string; status: string };
}

export default function LaunchIntelligencePage() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/launch-intelligence?status=${status}&limit=100`, { credentials: 'include', cache: 'no-store' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Failed to load launch candidates');
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load launch intelligence');
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusy(id + action);
    setMessage('');
    try {
      const response = await fetch('/api/admin/launch-intelligence', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || `${action} failed`);
      setMessage(action === 'approve' ? 'Draft phone created successfully.' : 'Candidate rejected.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed'); }
    finally { setBusy(''); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Rocket className="h-6 w-6 text-blue-600"/>Launch Intelligence</h1><p className="mt-1 text-sm text-slate-500">Monitored feeds detect new phones. Approval creates an unpublished draft only; specs must be verified before publishing.</p></div>
      <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </div>

    <div className="grid gap-3 sm:grid-cols-4">
      {['pending','approved','duplicate','rejected'].map(key => <button key={key} onClick={() => setStatus(key)} className={`rounded-xl border p-4 text-left ${status === key ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}><div className="text-xs font-semibold uppercase text-slate-500">{key}</div><div className="mt-1 text-2xl font-bold">{counts[key] || 0}</div></button>)}
    </div>

    {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-600"/></div> :
      items.length === 0 ? <div className="rounded-xl border bg-white p-12 text-center text-slate-500">No {status} launch candidates.</div> :
      <div className="space-y-3">{items.map(item => <div key={item._id} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{item.brandName}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{item.availabilityStatus.replace('_',' ')}</span><span className="text-xs text-slate-500">Confidence {Math.round(item.confidence * 100)}%</span></div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">{item.modelName}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.sourceTitle}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">{item.reasons?.map(reason => <span key={reason} className="rounded bg-slate-50 px-2 py-1">{reason}</span>)}</div>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">{item.sourceName || 'Source'}<ExternalLink className="h-3.5 w-3.5"/></a>}
          </div>
          {item.status === 'pending' && <div className="flex shrink-0 gap-2 self-start"><button disabled={!!busy} onClick={() => act(item._id,'reject')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4"/>Reject</button><button disabled={!!busy} onClick={() => act(item._id,'approve')} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy === item._id+'approve' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}Create Draft</button></div>}
          {item.linkedPhoneId && <a className="text-sm font-semibold text-blue-600 hover:underline" href={`/admin/phones/${item.linkedPhoneId.slug}`}>Linked: {item.linkedPhoneId.modelName}</a>}
        </div>
      </div>)}</div>}
  </div>;
}
