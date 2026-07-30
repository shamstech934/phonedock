'use client';

import { useEffect, useState } from 'react';
import { Grid3X3, Monitor, Save, Smartphone, Tablet } from 'lucide-react';

type PageKey = 'home' | 'phones' | 'brands' | 'search' | 'rankings' | 'related' | 'guides';
type PageLayout = { desktop: number; tablet: number; mobile: number; density: 'compact' | 'comfortable' };

const LABELS: Record<PageKey, string> = {
  home: 'Homepage phone sections',
  phones: 'All Phones catalogue',
  brands: 'Brand pages',
  search: 'Search results',
  rankings: 'Ranking pages',
  related: 'Related & Smart Alternatives',
  guides: 'Buying guides',
};
const DEFAULT_LAYOUT: Record<PageKey, PageLayout> = {
  home: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
  phones: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
  brands: { desktop: 5, tablet: 3, mobile: 2, density: 'compact' },
  search: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
  rankings: { desktop: 4, tablet: 3, mobile: 2, density: 'comfortable' },
  related: { desktop: 4, tablet: 4, mobile: 2, density: 'compact' },
  guides: { desktop: 5, tablet: 3, mobile: 2, density: 'compact' },
};

export default function LayoutControlPage() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Settings failed');
        setLayout({ ...DEFAULT_LAYOUT, ...(payload.settings?.catalogLayout || payload.catalogLayout || {}) });
      })
      .catch(reason => setMessage(reason instanceof Error ? reason.message : 'Settings could not load'));
  }, []);

  const update = (page: PageKey, patch: Partial<PageLayout>) => setLayout(current => ({
    ...current,
    [page]: { ...current[page], ...patch },
  }));

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ catalogLayout: layout }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Layout could not be saved');
      setMessage('Layout saved. Public pages will use the new responsive card grid.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Grid3X3 className="h-6 w-6 text-blue-600" /> Phone Card Layout Control</h1>
        <p className="mt-1 text-sm text-slate-500">Every page has independent, responsive card columns. The grid automatically stretches without overflow.</p></div>
      <button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save layouts'}</button>
    </header>
    {message && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{message}</div>}
    <div className="grid gap-4 xl:grid-cols-2">
      {(Object.keys(LABELS) as PageKey[]).map(page => <section key={page} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-950">{LABELS[page]}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{layout[page].density}</span></div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {([
            ['Desktop', 'desktop', Monitor, 10],
            ['Tablet', 'tablet', Tablet, 6],
            ['Mobile', 'mobile', Smartphone, 3],
          ] as const).map(([label, key, Icon, max]) => <label key={key} className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
            <select value={layout[page][key]} onChange={event => update(page, { [key]: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-bold">
              {Array.from({ length: max }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} cards</option>)}
            </select>
          </label>)}
        </div>
        <label className="mt-4 block text-xs font-semibold text-slate-600">Card size
          <select value={layout[page].density} onChange={event => update(page, { density: event.target.value as PageLayout['density'] })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
            <option value="comfortable">Comfortable — full specs</option>
            <option value="compact">Compact — more cards per row</option>
          </select>
        </label>
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(layout[page].desktop, 10)}, minmax(0,1fr))` }}>
          {Array.from({ length: Math.min(layout[page].desktop, 10) }, (_, index) => <div key={index} className="aspect-[3/4] rounded-md border border-blue-100 bg-gradient-to-b from-blue-50 to-white" />)}
        </div>
      </section>)}
    </div>
  </div>;
}
