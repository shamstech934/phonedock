'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, Check, ChevronRight, Eye, GripVertical, Image,
  LayoutDashboard, Loader2, Monitor, Save, Settings2, Smartphone,
  Sparkles, Tablet, Undo2,
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import {
  HOMEPAGE_SECTION_ORDER,
  normalizeHomepageSectionOrder,
  type OrderedHomepageSection,
} from '@/lib/homepage-builder';

type Device = 'desktop' | 'tablet' | 'mobile';
type Tab = 'overview' | 'hero' | 'sections' | 'preview';
type SectionMode = 'automatic' | 'manual';

interface PhoneOption {
  id?: string;
  slug: string;
  modelName: string;
  brand?: string | { name?: string };
}

interface SectionRule {
  mode: SectionMode;
  brand: string;
  year: string;
  lifecycle: string;
  priceMin: string;
  priceMax: string;
  cardCount: number;
  columns: number;
  manualPhoneSlugs: string[];
}

interface HomepageSettings {
  heroEnabled: boolean;
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  searchPlaceholder: string;
  cta1Text: string;
  cta1Url: string;
  cta2Text: string;
  cta2Url: string;
  heroAnimationEnabled: boolean;
  heroAnimationSpeed: number;
  heroShowPhoneInfo: boolean;
  heroPhoneSlugs: string[];
  sections: Record<string, boolean>;
  titles: Record<string, string>;
  sectionOrder: OrderedHomepageSection[];
  sectionRules: Partial<Record<OrderedHomepageSection, SectionRule>>;
}

interface SettingsDocument {
  [key: string]: unknown;
  homepage?: Partial<HomepageSettings>;
  theme?: { primaryColor?: string; secondaryColor?: string; accentColor?: string };
}

const LABELS: Record<OrderedHomepageSection, string> = {
  latest: 'Latest Phones',
  trending: 'Trending Phones',
  camera: 'Best Camera Phones',
  gaming: 'Best Gaming Phones',
  battery: 'Best Battery Phones',
  budget: 'Budget Champions',
  flagship: 'Premium Flagships',
  upcoming: 'Upcoming Phones',
  reviews: 'Latest Reviews',
  videos: 'Latest Videos',
  news: 'Latest News',
};

const DEFAULT_RULE: SectionRule = {
  mode: 'automatic',
  brand: '',
  year: '',
  lifecycle: '',
  priceMin: '',
  priceMax: '',
  cardCount: 8,
  columns: 4,
  manualPhoneSlugs: [],
};

const DEFAULT_HOMEPAGE: HomepageSettings = {
  heroEnabled: true,
  heroBadge: "Pakistan's #1 Phone Database",
  heroTitle: 'Find Your Perfect',
  heroHighlight: 'Smartphone',
  heroSubtitle: 'Compare specs, check PTA status, read reviews, and find the best prices in Pakistan.',
  searchPlaceholder: 'Search phones, brands or chipsets...',
  cta1Text: 'Browse Phones',
  cta1Url: '/phones',
  cta2Text: 'Compare',
  cta2Url: '/compare',
  heroAnimationEnabled: true,
  heroAnimationSpeed: 5000,
  heroShowPhoneInfo: true,
  heroPhoneSlugs: [],
  sections: Object.fromEntries(HOMEPAGE_SECTION_ORDER.map(key => [key, true])),
  titles: { ...LABELS },
  sectionOrder: [...HOMEPAGE_SECTION_ORDER],
  sectionRules: {},
};

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
}) {
  return <label className="block text-xs font-semibold text-slate-600">{label}
    <input className={inputClass} type={type} value={value} onChange={event => onChange(event.target.value)} />
  </label>;
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return <button type="button" onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700">
    {label}
    <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </span>
  </button>;
}

export default function HomepageBuilderPage() {
  const { admin, loading: authLoading } = useAdmin();
  const [settings, setSettings] = useState<SettingsDocument>({});
  const [homepage, setHomepage] = useState<HomepageSettings>(DEFAULT_HOMEPAGE);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<OrderedHomepageSection>('latest');
  const [dragged, setDragged] = useState<OrderedHomepageSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [settingsResponse, phonesResponse] = await Promise.all([
        fetch('/api/admin/settings', { credentials: 'include' }),
        fetch('/api/admin/phones?limit=200&status=published&sort=modelName_asc', { credentials: 'include' }),
      ]);
      const settingsPayload = await settingsResponse.json();
      const phonesPayload = await phonesResponse.json();
      if (!settingsResponse.ok) throw new Error(settingsPayload.error || 'Builder settings could not be loaded');
      const document = (settingsPayload.settings || {}) as SettingsDocument;
      const current = document.homepage || {};
      setSettings(document);
      setHomepage({
        ...DEFAULT_HOMEPAGE,
        ...current,
        sections: { ...DEFAULT_HOMEPAGE.sections, ...(current.sections || {}) },
        titles: { ...DEFAULT_HOMEPAGE.titles, ...(current.titles || {}) },
        sectionOrder: normalizeHomepageSectionOrder(current.sectionOrder),
        sectionRules: current.sectionRules || {},
      });
      if (phonesResponse.ok) setPhones(phonesPayload.phones || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Builder could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && admin) void load();
    if (!authLoading && !admin) setLoading(false);
  }, [admin, authLoading, load]);

  const updateHomepage = <K extends keyof HomepageSettings>(key: K, value: HomepageSettings[K]) => {
    setHomepage(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const selectedRule = useMemo(
    () => ({ ...DEFAULT_RULE, ...(homepage.sectionRules[selected] || {}) }),
    [homepage.sectionRules, selected],
  );

  const updateRule = (patch: Partial<SectionRule>) => {
    updateHomepage('sectionRules', {
      ...homepage.sectionRules,
      [selected]: { ...selectedRule, ...patch },
    });
  };

  const reorder = (from: OrderedHomepageSection, to: OrderedHomepageSection) => {
    if (from === to) return;
    const order = [...homepage.sectionOrder];
    const fromIndex = order.indexOf(from);
    const toIndex = order.indexOf(to);
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, from);
    updateHomepage('sectionOrder', order);
  };

  const move = (key: OrderedHomepageSection, direction: -1 | 1) => {
    const index = homepage.sectionOrder.indexOf(key);
    const target = homepage.sectionOrder[index + direction];
    if (target) reorder(key, target);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, homepage }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Changes could not be saved');
      setSettings(current => ({ ...current, homepage }));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changes could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const setHeroSlot = (index: number, slug: string) => {
    const next = [...homepage.heroPhoneSlugs];
    if (slug) next[index] = slug;
    else next[index] = '';
    updateHomepage('heroPhoneSlugs', next.slice(0, 6));
  };

  if (authLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!admin) return null;

  const previewWidth = device === 'desktop' ? '100%' : device === 'tablet' ? '720px' : '360px';

  return <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-slate-100 sm:-m-6">
    <header className="sticky top-14 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mr-auto">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /><h1 className="text-lg font-black text-slate-950">Homepage Builder Pro</h1></div>
        <p className="text-xs text-slate-500">Arrange, configure and preview your homepage safely.</p>
      </div>
      <Link href="/" target="_blank" className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><Eye className="h-4 w-4" />Open live site</Link>
      <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
      </button>
    </header>

    {error && <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:mx-6">{error}</div>}

    <div className="grid min-h-[calc(100vh-8rem)] xl:grid-cols-[180px_minmax(420px,620px)_minmax(420px,1fr)]">
      <nav className="border-r border-slate-200 bg-white p-3">
        {([
          ['overview', LayoutDashboard, 'Overview'],
          ['hero', Image, 'Hero stage'],
          ['sections', GripVertical, 'Sections'],
          ['preview', Eye, 'Full preview'],
        ] as const).map(([key, Icon, label]) =>
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Link href="/admin/settings" className="flex items-center gap-2 px-3 text-xs font-semibold text-slate-500 hover:text-blue-700"><Settings2 className="h-4 w-4" />Advanced site settings</Link>
        </div>
      </nav>

      <main className="border-r border-slate-200 p-4 sm:p-5">
        {tab === 'overview' && <div className="space-y-4">
          <Panel title="Builder status" subtitle="A safe control room for the existing PhoneDock homepage.">
            <div className="grid grid-cols-2 gap-3">
              <Stat value={homepage.sectionOrder.filter(key => homepage.sections[key]).length} label="Visible sections" />
              <Stat value={homepage.heroPhoneSlugs.filter(Boolean).length || 'Auto'} label="Hero phones" />
            </div>
          </Panel>
          <Panel title="Quick actions" subtitle="Choose an area to start editing.">
            <button onClick={() => setTab('hero')} className="mb-2 flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left"><span><strong className="block text-sm">Edit floating 3D hero</strong><small className="text-slate-500">Text, buttons, timing and phones</small></span><ChevronRight /></button>
            <button onClick={() => setTab('sections')} className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left"><span><strong className="block text-sm">Arrange homepage sections</strong><small className="text-slate-500">Drag, filter and configure cards</small></span><ChevronRight /></button>
          </Panel>
        </div>}

        {tab === 'hero' && <div className="space-y-4">
          <Panel title="Hero content" subtitle="All changes appear instantly in the preview.">
            <div className="space-y-3">
              <Toggle label="Show hero stage" checked={homepage.heroEnabled} onChange={value => updateHomepage('heroEnabled', value)} />
              <Field label="Top badge" value={homepage.heroBadge} onChange={value => updateHomepage('heroBadge', value)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Main title" value={homepage.heroTitle} onChange={value => updateHomepage('heroTitle', value)} />
                <Field label="Highlighted word" value={homepage.heroHighlight} onChange={value => updateHomepage('heroHighlight', value)} />
              </div>
              <label className="block text-xs font-semibold text-slate-600">Subtitle<textarea rows={3} className={inputClass} value={homepage.heroSubtitle} onChange={event => updateHomepage('heroSubtitle', event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary button" value={homepage.cta1Text} onChange={value => updateHomepage('cta1Text', value)} />
                <Field label="Primary URL" value={homepage.cta1Url} onChange={value => updateHomepage('cta1Url', value)} />
                <Field label="Secondary button" value={homepage.cta2Text} onChange={value => updateHomepage('cta2Text', value)} />
                <Field label="Secondary URL" value={homepage.cta2Url} onChange={value => updateHomepage('cta2Url', value)} />
              </div>
              <Toggle label="Animate selected phones" checked={homepage.heroAnimationEnabled} onChange={value => updateHomepage('heroAnimationEnabled', value)} />
              <label className="block text-xs font-semibold text-slate-600">Slide duration: {homepage.heroAnimationSpeed / 1000}s<input className="mt-2 w-full" type="range" min={2000} max={12000} step={1000} value={homepage.heroAnimationSpeed} onChange={event => updateHomepage('heroAnimationSpeed', Number(event.target.value))} /></label>
            </div>
          </Panel>
          <Panel title="Hero phones" subtitle="Select up to six published phones; empty slots use automatic featured phones.">
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, index) =>
              <label key={index} className="text-xs font-semibold text-slate-600">Slide {index + 1}
                <select className={inputClass} value={homepage.heroPhoneSlugs[index] || ''} onChange={event => setHeroSlot(index, event.target.value)}>
                  <option value="">Auto / Empty</option>
                  {phones.map(phone => <option key={phone.id || phone.slug} value={phone.slug}>{phoneName(phone)}</option>)}
                </select>
              </label>
            )}</div>
          </Panel>
        </div>}

        {tab === 'sections' && <div className="space-y-4">
          <Panel title="Page structure" subtitle="Drag sections to reorder; arrow buttons are keyboard-friendly fallback.">
            <div className="space-y-2">{homepage.sectionOrder.map((key, index) =>
              <div key={key} draggable onDragStart={() => setDragged(key)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged) reorder(dragged, key); setDragged(null); }}
                onClick={() => setSelected(key)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-white p-2.5 transition ${selected === key ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
                <button type="button" className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{homepage.titles[key] || LABELS[key]}</strong><small className="text-slate-400">{homepage.sections[key] ? 'Visible' : 'Hidden'} · {selectedRuleLabel(homepage.sectionRules[key])}</small></button>
                <button type="button" aria-label={`Move ${LABELS[key]} up`} disabled={index === 0} onClick={event => { event.stopPropagation(); move(key, -1); }} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Move ${LABELS[key]} down`} disabled={index === homepage.sectionOrder.length - 1} onClick={event => { event.stopPropagation(); move(key, 1); }} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
            )}</div>
            <button type="button" onClick={() => updateHomepage('sectionOrder', [...HOMEPAGE_SECTION_ORDER])} className="mt-3 flex items-center gap-2 text-xs font-bold text-blue-700"><Undo2 className="h-3.5 w-3.5" />Reset default order</button>
          </Panel>
          <Panel title={`${LABELS[selected]} settings`} subtitle="Control visibility, source rules and card density.">
            <div className="space-y-3">
              <Toggle label="Show this section" checked={homepage.sections[selected]} onChange={value => updateHomepage('sections', { ...homepage.sections, [selected]: value })} />
              <Field label="Section title" value={homepage.titles[selected] || ''} onChange={value => updateHomepage('titles', { ...homepage.titles, [selected]: value })} />
              <label className="block text-xs font-semibold text-slate-600">Content source<select className={inputClass} value={selectedRule.mode} onChange={event => updateRule({ mode: event.target.value as SectionMode })}><option value="automatic">Automatic rules</option><option value="manual">Manual phone selection</option></select></label>
              {selectedRule.mode === 'automatic' ? <div className="grid grid-cols-2 gap-3">
                <Field label="Brand slug (optional)" value={selectedRule.brand} onChange={brand => updateRule({ brand })} />
                <Field label="Release year" value={selectedRule.year} onChange={year => updateRule({ year })} type="number" />
                <label className="block text-xs font-semibold text-slate-600">Lifecycle<select className={inputClass} value={selectedRule.lifecycle} onChange={event => updateRule({ lifecycle: event.target.value })}><option value="">Any status</option><option value="upcoming">Coming soon</option><option value="latest">Latest</option><option value="available">Available</option><option value="discontinued">Discontinued</option></select></label>
                <span />
                <Field label="Minimum price" value={selectedRule.priceMin} onChange={priceMin => updateRule({ priceMin })} type="number" />
                <Field label="Maximum price" value={selectedRule.priceMax} onChange={priceMax => updateRule({ priceMax })} type="number" />
              </div> : <label className="block text-xs font-semibold text-slate-600">Add published phone<select className={inputClass} value="" onChange={event => { if (event.target.value && !selectedRule.manualPhoneSlugs.includes(event.target.value)) updateRule({ manualPhoneSlugs: [...selectedRule.manualPhoneSlugs, event.target.value].slice(0, 12) }); }}><option value="">Select a phone…</option>{phones.map(phone => <option key={phone.id || phone.slug} value={phone.slug}>{phoneName(phone)}</option>)}</select>
                <div className="mt-2 flex flex-wrap gap-2">{selectedRule.manualPhoneSlugs.map(slug => <button type="button" key={slug} onClick={() => updateRule({ manualPhoneSlugs: selectedRule.manualPhoneSlugs.filter(value => value !== slug) })} className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{slug} ×</button>)}</div>
              </label>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cards to show" value={String(selectedRule.cardCount)} onChange={value => updateRule({ cardCount: clamp(Number(value), 1, 24) })} type="number" />
                <Field label="Desktop columns" value={String(selectedRule.columns)} onChange={value => updateRule({ columns: clamp(Number(value), 2, 6) })} type="number" />
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>Checkpoint note:</strong> rules are saved safely with the homepage configuration. Existing homepage data queries continue unchanged until the next rule-engine checkpoint, preventing accidental content loss.</p>
            </div>
          </Panel>
        </div>}

        {tab === 'preview' && <Panel title="Responsive preview" subtitle="Use the device controls on the preview panel."><p className="text-sm leading-6 text-slate-600">This preview uses your unsaved builder state, so you can review layout before saving. The live site only changes after “Save changes”.</p></Panel>}
      </main>

      <aside className="bg-slate-200/60 p-4 sm:p-5">
        <div className="sticky top-32">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-black text-slate-900">Live responsive preview</p><p className="text-[11px] text-slate-500">Unsaved working state</p></div>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([key, Icon]) =>
                <button type="button" key={key} aria-label={`${key} preview`} onClick={() => setDevice(key)} className={`rounded-lg p-2 ${device === key ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><Icon className="h-4 w-4" /></button>
              )}
            </div>
          </div>
          <div className="overflow-auto rounded-2xl border border-slate-300 bg-slate-300/60 p-3">
            <div style={{ width: previewWidth, maxWidth: '100%' }} className="mx-auto overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
              <HomepagePreview homepage={homepage} device={device} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="text-sm font-black text-slate-950">{title}</h2>
    <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
    {children}
  </section>;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><strong className="block text-2xl font-black text-slate-950">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>;
}

function HomepagePreview({ homepage, device }: { homepage: HomepageSettings; device: Device }) {
  const compact = device !== 'desktop';
  return <div className="min-h-[620px] bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 text-slate-950">
    <div className="flex h-12 items-center border-b bg-white/80 px-4"><strong className="text-sm">Phone<span className="text-blue-600">Dock</span></strong><div className="ml-auto flex gap-3 text-[9px] font-bold text-slate-500"><span>Phones</span><span>Brands</span><span>Compare</span></div></div>
    {homepage.heroEnabled && <section className={`m-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-600 p-5 text-white ${compact ? 'min-h-72' : 'min-h-64'}`}>
      <div className={compact ? '' : 'grid grid-cols-2 items-center gap-5'}>
        <div><span className="rounded-full border border-white/20 px-2 py-1 text-[7px] font-bold">{homepage.heroBadge}</span><h3 className="mt-4 text-2xl font-black leading-tight">{homepage.heroTitle}<br /><span className="text-blue-400">{homepage.heroHighlight}</span></h3><p className="mt-2 line-clamp-2 text-[9px] leading-4 text-slate-300">{homepage.heroSubtitle}</p><div className="mt-4 flex gap-2"><span className="rounded-lg bg-blue-600 px-3 py-2 text-[8px] font-bold">{homepage.cta1Text}</span><span className="rounded-lg border border-white/20 px-3 py-2 text-[8px] font-bold">{homepage.cta2Text}</span></div></div>
        {!compact && <div className="flex h-48 items-center justify-center"><div className="relative h-36 w-24 rotate-6 rounded-[1.4rem] border-4 border-slate-300 bg-gradient-to-b from-slate-100 to-blue-200 shadow-2xl"><span className="absolute left-1/2 top-2 h-2 w-8 -translate-x-1/2 rounded-full bg-slate-900" /><span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[7px] font-black text-blue-800">3D STAGE</span></div></div>}
      </div>
    </section>}
    <div className="space-y-5 p-3">{homepage.sectionOrder.filter(key => homepage.sections[key]).slice(0, 6).map((key, sectionIndex) =>
      <section key={key}><div className="mb-2 flex items-center justify-between"><strong className="text-xs">{homepage.titles[key] || LABELS[key]}</strong><span className="text-[8px] font-bold text-blue-600">See all →</span></div><div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>{Array.from({ length: compact ? 2 : 4 }, (_, cardIndex) => <div key={cardIndex} className={`rounded-xl border border-white/70 p-2 shadow-sm ${['bg-violet-100','bg-blue-100','bg-cyan-100','bg-amber-100'][sectionIndex % 4]}`}><div className="h-16 rounded-lg bg-white/80" /><div className="mt-2 h-2 w-1/3 rounded bg-slate-300" /><div className="mt-1 h-2 w-4/5 rounded bg-slate-700" /><div className="mt-2 h-5 rounded-md bg-blue-600" /></div>)}</div></section>
    )}</div>
  </div>;
}

function phoneName(phone: PhoneOption) {
  const brand = typeof phone.brand === 'object' ? phone.brand?.name : phone.brand;
  return `${brand ? `${brand} — ` : ''}${phone.modelName}`;
}

function selectedRuleLabel(rule?: SectionRule) {
  return rule?.mode === 'manual' ? 'Manual selection' : 'Automatic';
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
