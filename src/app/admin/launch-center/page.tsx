'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, LockKeyhole, RefreshCw, Rocket, Search, ShieldCheck, Smartphone, UnlockKeyhole } from 'lucide-react';
import { readApiResponse } from '@/lib/client/api-response';
import { useAdmin } from '@/lib/useAdmin';

const STATUSES = [
  ['rumored', 'Rumored'], ['announced', 'Announced'], ['coming_soon', 'Coming Soon'], ['available', 'Available'],
  ['limited', 'Limited'], ['discontinued', 'Discontinued'], ['cancelled', 'Cancelled'],
] as const;
type LifecycleStatus = typeof STATUSES[number][0];

type PhoneRow = {
  _id: string;
  brandId?: { name?: string } | null;
  modelName: string;
  slug: string;
  status?: string;
  availabilityStatus?: LifecycleStatus;
  upcoming?: boolean;
  releaseDate?: string;
  announcedAt?: string;
  expectedLaunchAt?: string;
  pakistanLaunchAt?: string;
  availableFrom?: string;
  discontinuedAt?: string;
  lifecycleManualLock?: boolean;
  lifecycleLockReason?: string;
};

type LifecyclePayload = {
  items: PhoneRow[]; total: number; page: number; pages: number;
  counts: Record<LifecycleStatus, number>; candidates?: Record<string, number>;
  needsReview: number; upcomingTotal: number; liveTotal: number;
};

type Candidate = {
  _id: string; brandName: string; modelName: string; sourceTitle?: string; availabilityStatus?: string;
  confidence?: number; status?: string; sourceName?: string; linkedPhoneId?: { modelName?: string; slug?: string } | null;
};
type CandidatePayload = { items: Candidate[]; total: number; counts: Record<string, number> };

function statusLabel(value?: string) {
  return STATUSES.find(([id]) => id === value)?.[1] || value || 'Unknown';
}

function statusClass(value?: string) {
  if (value === 'available') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'limited') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (value === 'discontinued' || value === 'cancelled') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (value === 'coming_soon') return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function LaunchCenterPage() {
  useAdmin();
  const [view, setView] = useState<'lifecycle' | 'candidates'>('lifecycle');
  const [data, setData] = useState<LifecyclePayload | null>(null);
  const [candidateData, setCandidateData] = useState<CandidatePayload | null>(null);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (view === 'candidates') {
        const response = await fetch('/api/admin/launch-intelligence?view=candidates&status=pending&limit=50', { credentials: 'include', cache: 'no-store' });
        setCandidateData(await readApiResponse<CandidatePayload>(response));
      } else {
        const params = new URLSearchParams({ view: 'lifecycle', status, limit: '60' });
        if (q.trim()) params.set('q', q.trim());
        const response = await fetch(`/api/admin/launch-intelligence?${params}`, { credentials: 'include', cache: 'no-store' });
        setData(await readApiResponse<LifecyclePayload>(response));
        setSelected(new Set());
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load lifecycle data'); }
    finally { setLoading(false); }
  }, [view, status, q]);

  useEffect(() => { void load(); }, [load]);

  const run = async (body: Record<string, unknown>, key: string, success: string) => {
    setRunning(key); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/launch-intelligence', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await readApiResponse(response);
      setMessage(success); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { setRunning(''); }
  };

  const selectedCount = selected.size;
  const allVisibleSelected = useMemo(() => Boolean(data?.items.length) && data!.items.every(item => selected.has(item._id)), [data, selected]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Data Control</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Launch & Lifecycle Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">Coming Soon, Upcoming, Released, Available aur Discontinued phones ko ek hi workspace se control karein.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setView('lifecycle')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === 'lifecycle' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Lifecycle</button>
          <button onClick={() => setView('candidates')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === 'candidates' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Incoming launches {data?.candidates?.pending ? `(${data.candidates.pending})` : ''}</button>
          <button onClick={() => void run({ action: 'run_lifecycle' }, 'auto', 'Lifecycle automation completed. Locked phones were preserved.')} disabled={running === 'auto'} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${running === 'auto' ? 'animate-spin' : ''}`} /> Run lifecycle</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {view === 'lifecycle' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-violet-100 bg-white p-4"><Clock3 className="h-5 w-5 text-violet-600" /><p className="mt-3 text-2xl font-black text-slate-950">{data?.upcomingTotal ?? 0}</p><p className="text-xs text-slate-500">Upcoming pipeline</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-black text-slate-950">{data?.liveTotal ?? 0}</p><p className="text-xs text-slate-500">Available / Limited</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><Smartphone className="h-5 w-5 text-slate-600" /><p className="mt-3 text-2xl font-black text-slate-950">{data?.counts.discontinued ?? 0}</p><p className="text-xs text-slate-500">Discontinued</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-black text-slate-950">{data?.needsReview ?? 0}</p><p className="text-xs text-amber-700">Needs lifecycle review</p></div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setStatus('all')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${status === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}>All</button>
                {STATUSES.map(([id, label]) => <button key={id} onClick={() => setStatus(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${status === id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}>{label} {data?.counts?.[id] ?? 0}</button>)}
              </div>
              <div className="relative w-full lg:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search phone..." className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" /></div>
            </div>
          </section>

          {selectedCount > 0 && <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3"><span className="mr-2 text-sm font-semibold text-blue-900">{selectedCount} selected</span>{(['coming_soon','available','discontinued'] as LifecycleStatus[]).map(next => <button key={next} onClick={() => void run({ action:'bulk_update', ids:Array.from(selected), availabilityStatus:next }, `bulk-${next}`, `${selectedCount} phones moved to ${statusLabel(next)}.`)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">Set {statusLabel(next)}</button>)}</div>}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={e => setSelected(e.target.checked ? new Set(data?.items.map(i => i._id) || []) : new Set())} /></th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Lifecycle</th><th className="px-4 py-3 text-left">Dates</th><th className="px-4 py-3 text-left">Control</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading lifecycle data…</td></tr> : data?.items.length ? data.items.map(phone => (
                    <tr key={phone._id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-4"><input type="checkbox" checked={selected.has(phone._id)} onChange={e => setSelected(prev => { const next=new Set(prev); e.target.checked?next.add(phone._id):next.delete(phone._id); return next; })} /></td>
                      <td className="px-4 py-4"><Link href={`/admin/phones/${phone._id}`} className="font-bold text-slate-900 hover:text-blue-600">{phone.brandId?.name} {phone.modelName}</Link><p className="mt-1 text-xs text-slate-400">{phone.slug} · {phone.status}</p></td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(phone.availabilityStatus)}`}>{statusLabel(phone.availabilityStatus)}</span><div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">{phone.lifecycleManualLock ? <><LockKeyhole className="h-3 w-3 text-blue-600" /> Admin locked</> : <><UnlockKeyhole className="h-3 w-3" /> Automation allowed</>}</div></td>
                      <td className="px-4 py-4 text-xs text-slate-600"><p>Expected: {phone.expectedLaunchAt || '—'}</p><p>Pakistan: {phone.pakistanLaunchAt || '—'}</p><p>Available: {phone.availableFrom || phone.releaseDate || '—'}</p><p>Ended: {phone.discontinuedAt || '—'}</p></td>
                      <td className="px-4 py-4"><div className="flex max-w-xs flex-wrap gap-1.5">{(['coming_soon','available','discontinued'] as LifecycleStatus[]).map(next => <button key={next} onClick={() => void run({ action:'update_phone', id:phone._id, availabilityStatus:next, lock:true, useToday: next !== 'coming_soon' }, `${phone._id}-${next}`, `${phone.modelName} updated.`)} disabled={running === `${phone._id}-${next}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">{statusLabel(next)}</button>)}{phone.lifecycleManualLock && <button onClick={() => void run({ action:'unlock_phone', id:phone._id }, `unlock-${phone._id}`, `${phone.modelName} unlocked for lifecycle automation.`)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">Unlock auto</button>}<Link href={`/admin/phones/${phone._id}/edit`} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">Edit dates</Link></div></td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No phones in this lifecycle state.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'candidates' && <div className="space-y-3">{loading ? <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">Loading incoming launch candidates…</div> : candidateData?.items.length ? candidateData.items.map(item => <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{item.brandName} {item.modelName}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(item.availabilityStatus)}`}>{statusLabel(item.availabilityStatus)}</span></div><p className="mt-1 text-xs text-slate-500">{item.sourceTitle || 'Launch signal'} {item.sourceName ? `· ${item.sourceName}` : ''}</p></div><div className="flex gap-2"><button onClick={() => void run({ action:'reject', id:item._id }, `reject-${item._id}`, 'Candidate rejected.')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Reject</button><button onClick={() => void run({ action:'approve', id:item._id }, `approve-${item._id}`, 'Candidate approved as a draft phone.')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Approve draft</button></div></div></div>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-700"><ShieldCheck className="mx-auto h-7 w-7" /><p className="mt-2 font-semibold">No pending launch candidates</p></div>}</div>}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600"><strong>Safe lifecycle rules:</strong> admin-locked phones are never auto-transitioned. Automatic lifecycle only normalises unlocked records when verified release/availability/discontinued dates become due. Publishing remains a separate admin decision.</div>
    </div>
  );
}
