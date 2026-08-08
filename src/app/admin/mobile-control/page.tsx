'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppWindow, BellRing, CheckCircle2, ExternalLink, Eye, Loader2, RefreshCw,
  RotateCcw, Save, ShieldAlert, Smartphone, TriangleAlert,
} from 'lucide-react';

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

const HOME_SECTIONS = ['hero', 'latest', 'brands', 'features', 'priceGroups'] as const;

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
  homeSections: [...HOME_SECTIONS],
  navigation: { home: true, phones: true, search: true, brands: true, saved: true },
  features: { compare: true, savedPhones: true, priceAlerts: false, news: false, reviews: false, videos: false, account: false },
  campaign: { enabled: false, title: '', message: '', image: '', actionLabel: '', actionUrl: '' },
};

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const versionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function normalizeSettings(value: Partial<MobileSettings> | null | undefined): MobileSettings {
  return {
    ...defaults,
    ...(value || {}),
    homeSections: Array.isArray(value?.homeSections)
      ? value!.homeSections.filter(section => HOME_SECTIONS.includes(section as typeof HOME_SECTIONS[number]))
      : [...HOME_SECTIONS],
    navigation: { ...defaults.navigation, ...(value?.navigation || {}) },
    features: { ...defaults.features, ...(value?.features || {}) },
    campaign: { ...defaults.campaign, ...(value?.campaign || {}) },
  };
}

function sameSettings(a: MobileSettings, b: MobileSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function versionParts(value: string): number[] {
  return value.split(/[+-]/)[0].split('.').map(part => Number(part) || 0);
}

function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function validHref(value: string): boolean {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export default function MobileControlPage() {
  const [form, setForm] = useState<MobileSettings>(defaults);
  const [savedForm, setSavedForm] = useState<MobileSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [configTest, setConfigTest] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' });
    const payload = await readApiResponse(response).catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Mobile settings could not load');
    const next = normalizeSettings(payload?.settings?.mobileApp || {});
    setForm(next);
    setSavedForm(next);
  }, []);

  useEffect(() => {
    void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Load failed')).finally(() => setLoading(false));
  }, [load]);

  const dirty = useMemo(() => !sameSettings(form, savedForm), [form, savedForm]);
  const validationErrors = useMemo(() => {
    const issues: string[] = [];
    if (!versionPattern.test(form.minimumVersion)) issues.push('Minimum version must look like 1.2.3.');
    if (!versionPattern.test(form.latestVersion)) issues.push('Latest version must look like 1.2.3.');
    if (versionPattern.test(form.minimumVersion) && versionPattern.test(form.latestVersion) && compareVersions(form.minimumVersion, form.latestVersion) > 0) {
      issues.push('Minimum supported version cannot be newer than latest release.');
    }
    if (form.forceUpdate && !form.updateUrlAndroid && !form.updateUrlIos) issues.push('Force update needs at least one Android or iOS update URL.');
    if (!validHref(form.updateUrlAndroid)) issues.push('Android update URL must be HTTPS.');
    if (!validHref(form.updateUrlIos)) issues.push('iOS update URL must be HTTPS.');
    if (!validHref(form.supportUrl)) issues.push('Support URL must be a site path or HTTPS URL.');
    if (!validHref(form.campaign.image)) issues.push('Campaign image must be a site path or HTTPS URL.');
    if (!validHref(form.campaign.actionUrl)) issues.push('Campaign action URL must be a site path or HTTPS URL.');
    if (form.campaign.enabled && !form.campaign.title.trim()) issues.push('Campaign title is required while campaign is enabled.');
    if (form.homeSections.length === 0) issues.push('Keep at least one mobile homepage section enabled.');
    return issues;
  }, [form]);

  const save = async () => {
    if (validationErrors.length) { setError(validationErrors[0]); return; }
    setSaving(true); setError(''); setMessage(''); setConfigTest(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileApp: form }),
      });
      const payload = await readApiResponse(response).catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Mobile settings could not be saved');
      const next = normalizeSettings(payload?.settings?.mobileApp || form);
      setForm(next); setSavedForm(next);
      setMessage('Mobile configuration published successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const testPublicConfig = async () => {
    setTesting(true); setConfigTest(null); setError('');
    try {
      const response = await fetch('/api/mobile/config', { cache: 'no-store' });
      const payload = await readApiResponse(response).catch(() => null);
      if (!response.ok || !payload?.config) throw new Error(payload?.error || 'Public mobile config endpoint failed');
      setConfigTest({ ok: true, text: `Public config is reachable · version ${payload.config.latestVersion || 'unknown'} · ${payload.config.enabled === false ? 'app disabled' : 'app enabled'}` });
    } catch (reason) {
      setConfigTest({ ok: false, text: reason instanceof Error ? reason.message : 'Public config test failed' });
    } finally { setTesting(false); }
  };

  const setMap = (group: 'navigation' | 'features', key: string, value: boolean) =>
    setForm(current => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const toggleHomeSection = (section: string, enabled: boolean) => setForm(current => {
    if (enabled) {
      const next = [...current.homeSections, section];
      return { ...current, homeSections: HOME_SECTIONS.filter(item => next.includes(item)) };
    }
    return { ...current, homeSections: current.homeSections.filter(item => item !== section) };
  });

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;

  return <div className="space-y-5 pb-20">
    <header className="sticky top-0 z-20 -mx-1 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><AppWindow className="h-4 w-4" /> Mobile control</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Mobile App Control Center</h1>
        <p className="mt-1 text-sm text-slate-500">One simple place for app availability, navigation, homepage, release safety and campaigns.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setForm(savedForm); setError(''); setMessage(''); }} disabled={!dirty || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-40"><RotateCcw className="h-4 w-4" />Revert</button>
        <button type="button" onClick={testPublicConfig} disabled={testing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 disabled:opacity-50">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Test config</button>
        <button onClick={save} disabled={saving || !dirty || validationErrors.length > 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : dirty ? 'Publish changes' : 'Saved'}
        </button>
      </div>
    </header>

    <div className={`rounded-xl border p-4 text-sm font-semibold ${dirty ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      <div className="flex items-center gap-2">{dirty ? <TriangleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{dirty ? 'Unsaved mobile changes — publish when ready.' : 'Mobile settings are saved.'}</div>
    </div>
    {validationErrors.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong className="block">Fix before publishing:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{validationErrors.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {configTest && <div className={`rounded-xl border p-4 text-sm font-semibold ${configTest.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{configTest.text}</div>}

    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Availability & release safety" icon={ShieldAlert}>
          <Toggle label="Mobile app enabled" value={form.enabled} onChange={enabled => setForm(current => ({ ...current, enabled }))} />
          <Toggle label="Maintenance mode" value={form.maintenanceMode} onChange={maintenanceMode => setForm(current => ({ ...current, maintenanceMode }))} />
          <Toggle label="Force users to update" value={form.forceUpdate} onChange={forceUpdate => setForm(current => ({ ...current, forceUpdate }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum supported version" value={form.minimumVersion} onChange={minimumVersion => setForm(current => ({ ...current, minimumVersion }))} placeholder="1.0.0" />
            <Field label="Latest release version" value={form.latestVersion} onChange={latestVersion => setForm(current => ({ ...current, latestVersion }))} placeholder="1.0.0" />
          </div>
          <Field label="Android update URL" value={form.updateUrlAndroid} onChange={updateUrlAndroid => setForm(current => ({ ...current, updateUrlAndroid }))} placeholder="https://play.google.com/…" />
          <Field label="iOS update URL" value={form.updateUrlIos} onChange={updateUrlIos => setForm(current => ({ ...current, updateUrlIos }))} placeholder="https://apps.apple.com/…" />
        </Panel>

        <Panel title="Maintenance screen" icon={Smartphone}>
          <Field label="Title" value={form.maintenanceTitle} onChange={maintenanceTitle => setForm(current => ({ ...current, maintenanceTitle }))} />
          <label className="block text-xs font-semibold text-slate-600">Message<textarea className={`${inputClass} min-h-24 py-3`} value={form.maintenanceMessage} onChange={event => setForm(current => ({ ...current, maintenanceMessage: event.target.value }))} /></label>
          <Field label="Support URL" value={form.supportUrl} onChange={supportUrl => setForm(current => ({ ...current, supportUrl }))} placeholder="/contact or https://…" />
        </Panel>

        <Panel title="Bottom navigation" icon={ExternalLink}>
          <p className="text-xs leading-5 text-slate-500">Choose only destinations that are ready in the app.</p>
          {Object.entries(form.navigation).map(([key, value]) => <Toggle key={key} label={labelFor(key)} value={value} onChange={next => setMap('navigation', key, next)} />)}
        </Panel>

        <Panel title="Feature flags" icon={BellRing}>
          <p className="text-xs leading-5 text-slate-500">Turn features on when their app screens are production-ready.</p>
          {Object.entries(form.features).map(([key, value]) => <Toggle key={key} label={labelFor(key)} value={value} onChange={next => setMap('features', key, next)} />)}
        </Panel>

        <Panel title="Mobile homepage" icon={AppWindow}>
          <p className="text-xs leading-5 text-slate-500">Show/hide sections here, then arrange only the enabled sections below.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {HOME_SECTIONS.map(section => <Toggle key={section} label={labelFor(section)} value={form.homeSections.includes(section)} onChange={next => toggleHomeSection(section, next)} />)}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            {form.homeSections.map((section, index) => <div key={section} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <strong className="text-sm">{labelFor(section)}</strong>
              <div className="flex gap-2"><MoveButton disabled={index === 0} label="↑" onClick={() => setForm(current => ({ ...current, homeSections: move(current.homeSections, index, index - 1) }))} />
                <MoveButton disabled={index === form.homeSections.length - 1} label="↓" onClick={() => setForm(current => ({ ...current, homeSections: move(current.homeSections, index, index + 1) }))} /></div>
            </div>)}
          </div>
        </Panel>

        <Panel title="Mobile campaign" icon={BellRing}>
          <Toggle label="Show campaign" value={form.campaign.enabled} onChange={enabled => setForm(current => ({ ...current, campaign: { ...current.campaign, enabled } }))} />
          {(['title', 'message', 'image', 'actionLabel', 'actionUrl'] as const).map(key =>
            <Field key={key} label={labelFor(key)} value={form.campaign[key]} onChange={value => setForm(current => ({ ...current, campaign: { ...current.campaign, [key]: value } }))} />
          )}
          <p className="text-xs text-slate-500">Campaign image: 1200 × 600 px, WebP/AVIF, ideally under 200 KB.</p>
        </Panel>
      </div>

      <aside className="2xl:sticky 2xl:top-28 2xl:self-start">
        <Panel title="Live mobile preview" icon={Eye}>
          <div className="mx-auto max-w-[360px] rounded-[2rem] border-[7px] border-slate-900 bg-slate-100 p-2 shadow-xl">
            <div className="overflow-hidden rounded-[1.45rem] bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><strong className="text-sm text-slate-950">Specs<span className="text-blue-600">Dekh</span></strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${form.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{form.enabled ? 'LIVE' : 'OFF'}</span></div>
              {form.maintenanceMode ? <div className="px-5 py-16 text-center"><Smartphone className="mx-auto h-8 w-8 text-blue-500" /><strong className="mt-4 block text-base">{form.maintenanceTitle || 'Maintenance'}</strong><p className="mt-2 text-xs leading-5 text-slate-500">{form.maintenanceMessage}</p></div> : <>
                <div className="space-y-3 p-4">
                  {form.campaign.enabled && <div className="rounded-xl bg-blue-600 p-3 text-white"><strong className="block text-xs">{form.campaign.title || 'Campaign'}</strong><p className="mt-1 text-[10px] text-blue-100">{form.campaign.message || 'Campaign message'}</p></div>}
                  {form.homeSections.map(section => <div key={section} className={`rounded-xl border p-3 ${section === 'hero' ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{labelFor(section)}</p><div className="mt-2 h-8 rounded-lg bg-white" /></div>)}
                </div>
                <div className="grid border-t border-slate-100 bg-white p-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, Object.values(form.navigation).filter(Boolean).length)}, minmax(0, 1fr))` }}>
                  {Object.entries(form.navigation).filter(([, enabled]) => enabled).map(([key]) => <span key={key} className="truncate px-1 text-center text-[9px] font-semibold text-slate-500">{labelFor(key)}</span>)}
                </div>
              </>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Summary label="Sections" value={`${form.homeSections.length}/${HOME_SECTIONS.length}`} />
            <Summary label="Features" value={`${Object.values(form.features).filter(Boolean).length}/${Object.keys(form.features).length}`} />
            <Summary label="Navigation" value={`${Object.values(form.navigation).filter(Boolean).length}/${Object.keys(form.navigation).length}`} />
            <Summary label="Version" value={form.latestVersion} />
          </div>
        </Panel>
      </aside>
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
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-sm text-slate-900">{value}</strong></div>; }
function move(items: string[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
function labelFor(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()); }
