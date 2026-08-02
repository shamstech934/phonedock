'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

type PhoneOption = { _id: string; modelName: string; slug: string; brandName?: string };
type LinkRow = {
  _id: string; storeKey: 'daraz' | 'priceoye' | 'mega'; storeName: string; destinationUrl: string; trackingId?: string;
  phoneId?: PhoneOption | null; priority: number; availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  active: boolean; clicks: number; clicks30d: number; expiresAt?: string | null;
};

type FormState = {
  id: string; storeKey: LinkRow['storeKey']; storeName: string; destinationUrl: string; trackingId: string; phoneId: string;
  priority: string; availability: LinkRow['availability']; active: boolean; expiresAt: string;
};

const blankForm: FormState = { id: '', storeKey: 'priceoye', storeName: 'PriceOye', destinationUrl: '', trackingId: '', phoneId: '', priority: '100', availability: 'in_stock', active: true, expiresAt: '' };

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(blankForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/affiliate-links', { credentials: 'include', cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) setMessage(data.error || 'Unable to load affiliate links');
    else { setLinks(data.links || []); setPhones(data.phones || []); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter((row) => `${row.storeName} ${row.storeKey} ${row.phoneId?.brandName || ''} ${row.phoneId?.modelName || ''}`.toLowerCase().includes(q));
  }, [links, query]);

  const startEdit = (row: LinkRow) => {
    setForm({
      id: row._id, storeKey: row.storeKey, storeName: row.storeName, destinationUrl: row.destinationUrl || '', trackingId: row.trackingId || '',
      phoneId: row.phoneId?._id || '', priority: String(row.priority || 0), availability: row.availability, active: row.active,
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 10) : '',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true); setMessage('');
    const method = form.id ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/affiliate-links', {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, priority: Number(form.priority), expiresAt: form.expiresAt || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setMessage(data.error || 'Save failed');
    setOpen(false); setForm(blankForm); setMessage('Affiliate link saved.'); await load();
  };

  const remove = async (row: LinkRow) => {
    if (!window.confirm(`Delete ${row.storeName}${row.phoneId ? ` link for ${row.phoneId.modelName}` : ' default link'}?`)) return;
    const res = await fetch(`/api/admin/affiliate-links?id=${encodeURIComponent(row._id)}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || 'Delete failed');
    setMessage('Affiliate link deleted.'); await load();
  };

  const totalClicks = links.reduce((sum, row) => sum + (row.clicks || 0), 0);
  const clicks30d = links.reduce((sum, row) => sum + (row.clicks30d || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Revenue Operations</p><h1 className="mt-1 text-2xl font-black text-gray-950">Affiliate Link Manager</h1><p className="mt-1 text-sm text-gray-500">Phone-specific aur fallback store links manage karein. Links redirect API se tracked aur allowlisted rehte hain.</p></div>
        <button onClick={() => { setForm(blankForm); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add affiliate link</button>
      </div>

      {message ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active links" value={links.filter((row) => row.active).length.toLocaleString()} />
        <Stat label="Clicks (30 days)" value={clicks30d.toLocaleString()} />
        <Stat label="Lifetime clicks" value={totalClicks.toLocaleString()} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search store or phone..." className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Store</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Clicks 30d</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading affiliate links…</td></tr> : filtered.length ? filtered.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3"><p className="font-semibold text-gray-900">{row.storeName}</p><p className="text-xs text-gray-500">{row.storeKey}</p></td>
                  <td className="px-4 py-3">{row.phoneId ? <><p className="font-medium text-gray-900">{row.phoneId.brandName} {row.phoneId.modelName}</p><p className="text-xs text-gray-500">/{row.phoneId.slug}</p></> : <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Fallback link</span>}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{row.availability.replaceAll('_', ' ')}</span></td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{row.priority}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.clicks30d || 0}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{row.active ? 'Active' : 'Disabled'}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><a href={`/api/affiliate?partner=${row.storeKey}&phone=${encodeURIComponent(row.phoneId?.slug || 'unknown')}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" title="Test redirect"><ExternalLink className="h-4 w-4" /></a><button onClick={() => startEdit(row)} className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button><button onClick={() => void remove(row)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              )) : <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No affiliate links found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-gray-950">{form.id ? 'Edit affiliate link' : 'Add affiliate link'}</h2><p className="mt-1 text-sm text-gray-500">Exact product URL use karein. Phone blank ho to fallback store link banega.</p></div><button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">Close</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Store"><select value={form.storeKey} onChange={(event) => { const value = event.currentTarget.value as FormState['storeKey']; setForm((current) => ({ ...current, storeKey: value, storeName: value === 'priceoye' ? 'PriceOye' : value === 'daraz' ? 'Daraz' : 'Mega.pk' })); }} className="input"><option value="priceoye">PriceOye</option><option value="mega">Mega.pk</option><option value="daraz">Daraz</option></select></Field>
          <Field label="Store name"><input value={form.storeName} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, storeName: value })); }} className="input" /></Field>
          <Field label="Phone (optional)" wide><select value={form.phoneId} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, phoneId: value })); }} className="input"><option value="">Fallback link for all phones</option>{phones.map((phone) => <option key={phone._id} value={phone._id}>{phone.brandName} {phone.modelName}</option>)}</select></Field>
          <Field label="Destination URL" wide><input value={form.destinationUrl} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, destinationUrl: value })); }} placeholder="https://priceoye.pk/mobiles/..." className="input" /></Field>
          <Field label="Tracking ID"><input value={form.trackingId} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, trackingId: value })); }} className="input" /></Field>
          <Field label="Priority"><input type="number" min="0" max="1000" value={form.priority} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, priority: value })); }} className="input" /></Field>
          <Field label="Availability"><select value={form.availability} onChange={(event) => { const value = event.currentTarget.value as FormState['availability']; setForm((current) => ({ ...current, availability: value })); }} className="input"><option value="in_stock">In stock</option><option value="preorder">Preorder</option><option value="out_of_stock">Out of stock</option><option value="unknown">Unknown</option></select></Field>
          <Field label="Expires on"><input type="date" value={form.expiresAt} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, expiresAt: value })); }} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.active} onChange={(event) => { const checked = event.currentTarget.checked; setForm((current) => ({ ...current, active: checked })); }} /> Active</label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button><button disabled={saving || !form.destinationUrl.trim()} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Link2 className="h-4 w-4" />{saving ? 'Saving…' : 'Save link'}</button></div>
      </div></div> : null}
      <style jsx>{`.input{height:42px;width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;font-size:14px;outline:none}.input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.15)}`}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-gray-500">{label}</p><p className="mt-2 text-3xl font-black text-gray-950">{value}</p></div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}><span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>{children}</label>; }
