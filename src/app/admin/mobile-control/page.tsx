'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { AppWindow, BellRing, ExternalLink, Loader2, Save, ShieldAlert, Smartphone } from 'lucide-react';

type BooleanMap = Record<string, boolean>;
type MobileSettings = {
  enabled: boolean;
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  minimumVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  updateUrlAndroid: string;
  updateUrlIos: string;
  supportUrl: string;
  homeSections: string[];
  navigation: BooleanMap;
  features: BooleanMap;
  campaign: {
    enabled: boolean;
    title: string;
    message: string;
    image: string;
    actionLabel: string;
    actionUrl: string;
  };
};

const defaults: MobileSettings = {
  enabled: true,
  maintenanceMode: false,
  maintenanceTitle: 'SpecsDekh is being improved',
  maintenanceMessage: 'Please check back shortly.',
  minimumVersion: '0.1.0',
  latestVersion: '0.1.0',
  forceUpdate: false,
  updateUrlAndroid: '',
  updateUrlIos: '',
  supportUrl: '/contact',
  homeSections: ['hero', 'latest', 'brands', 'features', 'priceGroups'],
  navigation: { home: true, phones: true, search: true, brands: true, saved: true },
  features: { compare: true, savedPhones: true, priceAlerts: false, news: false, reviews: false, videos: false, account: false },
  campaign: { enabled: false, title: '', message: '', image: '', actionLabel: '', actionUrl: '' },
};

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function MobileControlPage() {
  const [form, setForm] = useState<MobileSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' });
    const payload = await readApiResponse(response).catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Mobile settings could not load');
    const value = payload?.settings?.mobileApp || {};
    setForm({
      ...defaults,
      ...value,
      navigation: { ...defaults.navigation, ...(value.navigation || {}) },
      features: { ...defaults.features, ...(value.features || {}) },
      campaign: { ...defaults.campaign, ...(value.campaign || {}) },
    });
  }, []);

  useEffect(() => {
    void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Load failed')).finally(() => setLoading(false));
  }, [load]);

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileApp: form }),
      });
      const payload = await readApiResponse(response).catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Mobile settings could not be saved');
      setMessage('Mobile configuration published. App will receive it on its next refresh.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setMap = (group: 'navigation' | 'features', key: string, value: boolean) =>
    setForm(current => ({ ...current, [group]: { ...current[group], [key]: value } }));

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;

  return <div className="space-y-5 pb-16">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><AppWindow className="h-4 w-4" /> Shared platform control</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Mobile App Control Center</h1>
        <p className="mt-1 text-sm text-slate-500">Content stays shared; only mobile presentation and release safety are controlled here.</p>
      </div>
      <button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Publish mobile settings'}
      </button>
    </header>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="Availability & release safety" icon={ShieldAlert}>
        <Toggle label="Mobile app enabled" value={form.enabled} onChange={enabled => setForm(current => ({ ...current, enabled }))} />
        <Toggle label="Maintenance mode" value={form.maintenanceMode} onChange={maintenanceMode => setForm(current => ({ ...current, maintenanceMode }))} />
        <Toggle label="Force users to update" value={form.forceUpdate} onChange={forceUpdate => setForm(current => ({ ...current, forceUpdate }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum supported version" value={form.minimumVersion} onChange={minimumVersion => setForm(current => ({ ...current, minimumVersion }))} placeholder="0.1.0" />
          <Field label="Latest release version" value={form.latestVersion} onChange={latestVersion => setForm(current => ({ ...current, latestVersion }))} placeholder="0.1.0" />
        </div>
        <Field label="Android update URL" value={form.updateUrlAndroid} onChange={updateUrlAndroid => setForm(current => ({ ...current, updateUrlAndroid }))} placeholder="https://play.google.com/…" />
        <Field label="iOS update URL" value={form.updateUrlIos} onChange={updateUrlIos => setForm(current => ({ ...current, updateUrlIos }))} placeholder="https://apps.apple.com/…" />
      </Panel>

      <Panel title="Maintenance screen" icon={Smartphone}>
        <Field label="Title" value={form.maintenanceTitle} onChange={maintenanceTitle => setForm(current => ({ ...current, maintenanceTitle }))} />
        <label className="block text-xs font-semibold text-slate-600">Message<textarea className={`${inputClass} min-h-24 py-3`} value={form.maintenanceMessage} onChange={event => setForm(current => ({ ...current, maintenanceMessage: event.target.value }))} /></label>
        <Field label="Support URL" value={form.supportUrl} onChange={supportUrl => setForm(current => ({ ...current, supportUrl }))} placeholder="/contact or https://…" />
        <div className="rounded-2xl bg-slate-950 p-5 text-center text-white">
          <Smartphone className="mx-auto h-8 w-8 text-blue-400" /><strong className="mt-3 block text-lg">{form.maintenanceTitle}</strong>
          <p className="mt-2 text-sm text-slate-300">{form.maintenanceMessage}</p>
        </div>
      </Panel>

      <Panel title="Bottom navigation" icon={ExternalLink}>
        <p className="text-xs leading-5 text-slate-500">Core data remains shared. These switches only control which mobile destinations are visible.</p>
        {Object.entries(form.navigation).map(([key, value]) => <Toggle key={key} label={labelFor(key)} value={value} onChange={next => setMap('navigation', key, next)} />)}
      </Panel>

      <Panel title="Feature flags" icon={BellRing}>
        {Object.entries(form.features).map(([key, value]) => <Toggle key={key} label={labelFor(key)} value={value} onChange={next => setMap('features', key, next)} />)}
      </Panel>

      <Panel title="Mobile campaign" icon={BellRing}>
        <Toggle label="Show campaign" value={form.campaign.enabled} onChange={enabled => setForm(current => ({ ...current, campaign: { ...current.campaign, enabled } }))} />
        {(['title', 'message', 'image', 'actionLabel', 'actionUrl'] as const).map(key =>
          <Field key={key} label={labelFor(key)} value={form.campaign[key]} onChange={value => setForm(current => ({ ...current, campaign: { ...current.campaign, [key]: value } }))} />
        )}
        <p className="text-xs text-slate-500">Campaign image recommendation: 1200 × 600 px, WebP/AVIF, ideally under 200 KB.</p>
      </Panel>

      <Panel title="Mobile homepage order" icon={AppWindow}>
        <p className="text-xs leading-5 text-slate-500">Website order is independent. Use arrows to arrange mobile sections.</p>
        {form.homeSections.map((section, index) => <div key={section} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <strong className="text-sm capitalize">{section.replace(/([A-Z])/g, ' $1')}</strong>
          <div className="flex gap-2"><MoveButton disabled={index === 0} label="↑" onClick={() => setForm(current => ({ ...current, homeSections: move(current.homeSections, index, index - 1) }))} />
            <MoveButton disabled={index === form.homeSections.length - 1} label="↓" onClick={() => setForm(current => ({ ...current, homeSections: move(current.homeSections, index, index + 1) }))} /></div>
        </div>)}
      </Panel>
    </section>
  </div>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Smartphone; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-slate-950"><Icon className="h-5 w-5 text-blue-600" />{title}</h2>{children}</section>;
}
function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input className={inputClass} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-blue-600" checked={value} onChange={event => onChange(event.target.checked)} /></label>;
}
function MoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="h-9 w-9 rounded-lg border border-slate-200 text-sm font-bold disabled:opacity-30">{label}</button>;
}
function move(items: string[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
function labelFor(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()); }
