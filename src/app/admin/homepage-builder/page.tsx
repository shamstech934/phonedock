'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, Check, ChevronRight, Eye, GripVertical, Image,
  LayoutDashboard, Link2, Loader2, Monitor, Navigation, Palette, Save,
  Settings2, Smartphone, Sparkles, Tablet, Undo2, Upload,
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import { uploadImage } from '@/lib/cloudinary';
import {
  HOMEPAGE_SECTION_ORDER,
  normalizeHomepageSectionOrder,
  type OrderedHomepageSection,
} from '@/lib/homepage-builder';

type Device = 'desktop' | 'tablet' | 'mobile';
type Tab = 'overview' | 'hero' | 'sections' | 'design' | 'navigation' | 'media' | 'preview';
type SectionMode = 'automatic' | 'manual';

interface HeroCampaign {
  id: string;
  name: string;
  enabled: boolean;
  desktopImage: string;
  mobileImage: string;
  alt: string;
  startAt: string;
  endAt: string;
  overlay: number;
  position: string;
}

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
  background: string;
  accent: string;
  cardStyle: 'glass' | 'solid' | 'outline';
  spacing: 'compact' | 'normal' | 'spacious';
  showViewAll: boolean;
  viewAllText: string;
  viewAllUrl: string;
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
  pageBackground: string;
  contentWidth: 'standard' | 'wide' | 'full';
  sectionGap: number;
  heroBackground: string;
  heroImageFit: 'contain' | 'cover';
  heroDesktopX: number;
  heroDesktopY: number;
  heroDesktopScale: number;
  heroDesktopRotate: number;
  heroMobileX: number;
  heroMobileY: number;
  heroMobileScale: number;
  heroMobileRotate: number;
  heroBackgroundImage: string;
  heroCampaigns: HeroCampaign[];
  heroCampaignSpeed: number;
  brandLogoSize: number;
  brandColumns: number;
  showPriceCategories: boolean;
  showYearCategories: boolean;
  pricePanelSide: 'left' | 'right';
  discoveryEnabled: boolean;
  discoveryTitle: string;
  discoveryCategories: Array<'price' | 'ram' | 'storage' | 'camera' | 'battery' | 'pta' | 'year'>;
  discoveryViewAllText: string;
  discoveryViewAllUrl: string;
  navigation: Array<{ label: string; url: string; enabled: boolean }>;
  media: {
    heroBackground: string;
    homepageOgImage: string;
    sectionImages: Partial<Record<OrderedHomepageSection, string>>;
  };
}

interface SettingsDocument {
  [key: string]: unknown;
  siteName?: string;
  tagline?: string;
  logo?: string;
  favicon?: string;
  titleSuffix?: string;
  metaDescription?: string;
  ogImage?: string;
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
  background: '',
  accent: '#2563eb',
  cardStyle: 'glass',
  spacing: 'normal',
  showViewAll: true,
  viewAllText: 'See all',
  viewAllUrl: '',
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
  pageBackground: '#eef4fb',
  contentWidth: 'standard',
  sectionGap: 56,
  heroBackground: '#0f172a',
  heroImageFit: 'contain',
  heroDesktopX: 0,
  heroDesktopY: 0,
  heroDesktopScale: 100,
  heroDesktopRotate: 3,
  heroMobileX: 0,
  heroMobileY: 0,
  heroMobileScale: 88,
  heroMobileRotate: 0,
  heroBackgroundImage: '',
  heroCampaigns: [],
  heroCampaignSpeed: 7000,
  brandLogoSize: 48,
  brandColumns: 7,
  showPriceCategories: true,
  showYearCategories: true,
  pricePanelSide: 'right',
  discoveryEnabled: true,
  discoveryTitle: 'Find Your Phone',
  discoveryCategories: ['price', 'ram', 'storage', 'camera', 'battery', 'pta', 'year'],
  discoveryViewAllText: 'Explore all phones',
  discoveryViewAllUrl: '/phones',
  navigation: [
    { label: 'Home', url: '/', enabled: true },
    { label: 'Phones', url: '/phones', enabled: true },
    { label: 'Brands', url: '/brands', enabled: true },
    { label: 'Compare', url: '/compare', enabled: true },
    { label: 'Rankings', url: '/rankings', enabled: true },
    { label: 'Reviews', url: '/reviews', enabled: true },
  ],
  media: { heroBackground: '', homepageOgImage: '', sectionImages: {} },
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
  const [uploading, setUploading] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && ['overview', 'hero', 'sections', 'design', 'navigation', 'media', 'preview'].includes(requested)) {
      setTab(requested as Tab);
    }
  }, []);

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
        discoveryCategories: Array.isArray(current.discoveryCategories) && current.discoveryCategories.length
          ? current.discoveryCategories
          : DEFAULT_HOMEPAGE.discoveryCategories,
        sections: { ...DEFAULT_HOMEPAGE.sections, ...(current.sections || {}) },
        titles: { ...DEFAULT_HOMEPAGE.titles, ...(current.titles || {}) },
        sectionOrder: normalizeHomepageSectionOrder(current.sectionOrder),
        sectionRules: current.sectionRules || {},
        navigation: Array.isArray(current.navigation) ? current.navigation : DEFAULT_HOMEPAGE.navigation,
        media: {
          ...DEFAULT_HOMEPAGE.media,
          ...(current.media || {}),
          sectionImages: { ...DEFAULT_HOMEPAGE.media.sectionImages, ...(current.media?.sectionImages || {}) },
        },
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

  const updateSetting = (key: string, value: unknown) => {
    setSettings(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const upload = async (file: File | undefined, target: string) => {
    if (!file) return;
    setUploading(target);
    setError('');
    try {
      const result = await uploadImage(file, 'site-builder');
      if (target === 'logo' || target === 'favicon') updateSetting(target, result.url);
      else if (target === 'heroBackground') {
        updateHomepage('heroBackgroundImage', result.url);
        updateHomepage('media', { ...homepage.media, heroBackground: result.url });
      } else if (target === 'homepageOgImage') {
        updateSetting('ogImage', result.url);
        updateHomepage('media', { ...homepage.media, homepageOgImage: result.url });
      } else if (target.startsWith('campaign:')) {
        const [, id, viewport] = target.split(':');
        updateHomepage('heroCampaigns', homepage.heroCampaigns.map(campaign =>
          campaign.id === id ? { ...campaign, [viewport === 'mobile' ? 'mobileImage' : 'desktopImage']: result.url } : campaign));
      } else {
        updateHomepage('media', { ...homepage.media, sectionImages: { ...homepage.media.sectionImages, [target]: result.url } });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed');
    } finally {
      setUploading('');
    }
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

  const addCampaign = () => {
    const id = `campaign-${Date.now()}`;
    updateHomepage('heroCampaigns', [...homepage.heroCampaigns, {
      id,
      name: '14 August Campaign',
      enabled: true,
      desktopImage: '',
      mobileImage: '',
      alt: 'PhoneDock Independence Day campaign',
      startAt: '',
      endAt: '',
      overlay: 45,
      position: 'center',
    }]);
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
          ['design', Palette, 'Design system'],
          ['navigation', Navigation, 'Header & links'],
          ['media', Upload, 'Media library'],
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
          <Panel title="Seasonal background campaigns" subtitle="Schedule 14 August, Eid, launch events or sale artwork. Only active campaigns inside their date window rotate on the live hero.">
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <NumberRange label="Background slide duration" value={homepage.heroCampaignSpeed} min={4000} max={20000} suffix="ms" onChange={value => updateHomepage('heroCampaignSpeed', value)} />
                <button type="button" onClick={addCampaign} className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">Add campaign</button>
              </div>
              {homepage.heroCampaigns.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">No scheduled campaign yet. The normal hero background remains active.</p>}
              {homepage.heroCampaigns.map((campaign, index) => {
                const updateCampaign = (patch: Partial<HeroCampaign>) => updateHomepage('heroCampaigns', homepage.heroCampaigns.map(item => item.id === campaign.id ? { ...item, ...patch } : item));
                return <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <strong className="text-sm text-slate-900">Campaign {index + 1}</strong>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${campaign.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{campaign.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button type="button" onClick={() => updateHomepage('heroCampaigns', homepage.heroCampaigns.filter(item => item.id !== campaign.id))} className="ml-auto text-xs font-bold text-red-600">Remove</button>
                  </div>
                  <div className="space-y-3">
                    <Toggle label="Enable this campaign" checked={campaign.enabled} onChange={enabled => updateCampaign({ enabled })} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Campaign name" value={campaign.name} onChange={name => updateCampaign({ name })} />
                      <Field label="Accessible image description" value={campaign.alt} onChange={alt => updateCampaign({ alt })} />
                      <Field label="Starts (optional)" value={campaign.startAt} onChange={startAt => updateCampaign({ startAt })} type="datetime-local" />
                      <Field label="Ends (optional)" value={campaign.endAt} onChange={endAt => updateCampaign({ endAt })} type="datetime-local" />
                    </div>
                    <MediaField label="Desktop campaign background" hint="Recommended 1920 × 760 px · WebP/AVIF · ideally under 350 KB" value={campaign.desktopImage} uploading={uploading === `campaign:${campaign.id}:desktop`} onUrlChange={desktopImage => updateCampaign({ desktopImage })} onFile={file => void upload(file, `campaign:${campaign.id}:desktop`)} />
                    <MediaField label="Mobile campaign background" hint="Recommended 900 × 1200 px · WebP/AVIF · ideally under 220 KB" value={campaign.mobileImage} uploading={uploading === `campaign:${campaign.id}:mobile`} onUrlChange={mobileImage => updateCampaign({ mobileImage })} onFile={file => void upload(file, `campaign:${campaign.id}:mobile`)} />
                    <div className="grid grid-cols-2 gap-3">
                      <NumberRange label="Dark overlay" value={campaign.overlay} min={0} max={85} suffix="%" onChange={overlay => updateCampaign({ overlay })} />
                      <label className="block text-xs font-semibold text-slate-600">Image focus<select className={inputClass} value={campaign.position} onChange={event => updateCampaign({ position: event.target.value })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          </Panel>
          <Panel title="3D stage positioning" subtitle="Adjust phone placement separately for desktop and mobile.">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumberRange label="Desktop horizontal" value={homepage.heroDesktopX} min={-150} max={150} suffix="px" onChange={value => updateHomepage('heroDesktopX', value)} />
                <NumberRange label="Desktop vertical" value={homepage.heroDesktopY} min={-150} max={150} suffix="px" onChange={value => updateHomepage('heroDesktopY', value)} />
                <NumberRange label="Desktop zoom" value={homepage.heroDesktopScale} min={50} max={160} suffix="%" onChange={value => updateHomepage('heroDesktopScale', value)} />
                <NumberRange label="Desktop rotation" value={homepage.heroDesktopRotate} min={-25} max={25} suffix="°" onChange={value => updateHomepage('heroDesktopRotate', value)} />
                <NumberRange label="Mobile horizontal" value={homepage.heroMobileX} min={-100} max={100} suffix="px" onChange={value => updateHomepage('heroMobileX', value)} />
                <NumberRange label="Mobile vertical" value={homepage.heroMobileY} min={-100} max={100} suffix="px" onChange={value => updateHomepage('heroMobileY', value)} />
                <NumberRange label="Mobile zoom" value={homepage.heroMobileScale} min={45} max={130} suffix="%" onChange={value => updateHomepage('heroMobileScale', value)} />
                <NumberRange label="Mobile rotation" value={homepage.heroMobileRotate} min={-20} max={20} suffix="°" onChange={value => updateHomepage('heroMobileRotate', value)} />
              </div>
              <label className="block text-xs font-semibold text-slate-600">Image fit<select className={inputClass} value={homepage.heroImageFit} onChange={event => updateHomepage('heroImageFit', event.target.value as HomepageSettings['heroImageFit'])}><option value="contain">Contain — show complete phone</option><option value="cover">Cover — fill stage</option></select></label>
            </div>
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Section background" value={selectedRule.background} onChange={background => updateRule({ background })} type="color" />
                <Field label="Accent color" value={selectedRule.accent} onChange={accent => updateRule({ accent })} type="color" />
                <label className="block text-xs font-semibold text-slate-600">Card style<select className={inputClass} value={selectedRule.cardStyle} onChange={event => updateRule({ cardStyle: event.target.value as SectionRule['cardStyle'] })}><option value="glass">Glass</option><option value="solid">Solid</option><option value="outline">Outline</option></select></label>
                <label className="block text-xs font-semibold text-slate-600">Vertical spacing<select className={inputClass} value={selectedRule.spacing} onChange={event => updateRule({ spacing: event.target.value as SectionRule['spacing'] })}><option value="compact">Compact</option><option value="normal">Normal</option><option value="spacious">Spacious</option></select></label>
              </div>
              <Toggle label="Show “See all” link" checked={selectedRule.showViewAll} onChange={showViewAll => updateRule({ showViewAll })} />
              {selectedRule.showViewAll && <div className="grid grid-cols-2 gap-3"><Field label="Link text" value={selectedRule.viewAllText} onChange={viewAllText => updateRule({ viewAllText })} /><Field label="Link URL override" value={selectedRule.viewAllUrl} onChange={viewAllUrl => updateRule({ viewAllUrl })} /></div>}
              <MediaField label="Section cover/background image" value={homepage.media.sectionImages[selected] || ''} uploading={uploading === selected} onUrlChange={url => updateHomepage('media', { ...homepage.media, sectionImages: { ...homepage.media.sectionImages, [selected]: url } })} onFile={file => void upload(file, selected)} />
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>Checkpoint note:</strong> rules are saved safely with the homepage configuration. Existing homepage data queries continue unchanged until the next rule-engine checkpoint, preventing accidental content loss.</p>
            </div>
          </Panel>
        </div>}

        {tab === 'design' && <div className="space-y-4">
          <Panel title="Global design system" subtitle="Control the overall visual language without editing code.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Page background" value={homepage.pageBackground} onChange={value => updateHomepage('pageBackground', value)} type="color" />
                <Field label="Hero background" value={homepage.heroBackground} onChange={value => updateHomepage('heroBackground', value)} type="color" />
                <Field label="Primary color" value={String(settings.theme && typeof settings.theme === 'object' ? settings.theme.primaryColor || '#2563eb' : '#2563eb')} onChange={primaryColor => updateSetting('theme', { ...(settings.theme || {}), primaryColor })} type="color" />
                <Field label="Secondary color" value={String(settings.theme && typeof settings.theme === 'object' ? settings.theme.secondaryColor || '#7c3aed' : '#7c3aed')} onChange={secondaryColor => updateSetting('theme', { ...(settings.theme || {}), secondaryColor })} type="color" />
              </div>
              <label className="block text-xs font-semibold text-slate-600">Content width<select className={inputClass} value={homepage.contentWidth} onChange={event => updateHomepage('contentWidth', event.target.value as HomepageSettings['contentWidth'])}><option value="standard">Standard — 1280px</option><option value="wide">Wide — 1440px</option><option value="full">Full width</option></select></label>
              <NumberRange label="Space between homepage sections" value={homepage.sectionGap} min={16} max={96} suffix="px" onChange={value => updateHomepage('sectionGap', value)} />
            </div>
          </Panel>
          <Panel title="Brands and category panels" subtitle="Adjust the parts highlighted in your homepage screenshots.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberRange label="Brand logo size" value={homepage.brandLogoSize} min={28} max={90} suffix="px" onChange={value => updateHomepage('brandLogoSize', value)} />
                <NumberRange label="Desktop brand columns" value={homepage.brandColumns} min={4} max={10} onChange={value => updateHomepage('brandColumns', value)} />
              </div>
              <Toggle label="Show discovery panel" checked={homepage.discoveryEnabled} onChange={value => updateHomepage('discoveryEnabled', value)} />
              <label className="block text-xs font-semibold text-slate-600">Category panel position<select className={inputClass} value={homepage.pricePanelSide} onChange={event => updateHomepage('pricePanelSide', event.target.value as HomepageSettings['pricePanelSide'])}><option value="right">Right side</option><option value="left">Left side</option></select></label>
              <Field label="Discovery panel title" value={homepage.discoveryTitle} onChange={value => updateHomepage('discoveryTitle', value)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="View all button text" value={homepage.discoveryViewAllText} onChange={value => updateHomepage('discoveryViewAllText', value)} />
                <Field label="View all button URL" value={homepage.discoveryViewAllUrl} onChange={value => updateHomepage('discoveryViewAllUrl', value)} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Visible discovery tabs</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['price', 'ram', 'storage', 'camera', 'battery', 'pta', 'year'] as const).map(category => {
                    const enabled = homepage.discoveryCategories.includes(category);
                    return <Toggle key={category} label={category === 'pta' ? 'PTA status' : category.charAt(0).toUpperCase() + category.slice(1)}
                      checked={enabled}
                      onChange={checked => updateHomepage('discoveryCategories', checked
                        ? [...homepage.discoveryCategories, category]
                        : homepage.discoveryCategories.filter(value => value !== category))} />;
                  })}
                </div>
              </div>
            </div>
          </Panel>
        </div>}

        {tab === 'navigation' && <div className="space-y-4">
          <Panel title="Brand identity" subtitle="Logo and name are already consumed by the public header.">
            <div className="space-y-3">
              <Field label="Website name" value={String(settings.siteName || 'PhoneDock')} onChange={value => updateSetting('siteName', value)} />
              <Field label="Tagline" value={String(settings.tagline || '')} onChange={value => updateSetting('tagline', value)} />
              <MediaField label="Header logo" value={String(settings.logo || '')} uploading={uploading === 'logo'} onUrlChange={value => updateSetting('logo', value)} onFile={file => void upload(file, 'logo')} />
              <MediaField label="Browser favicon" value={String(settings.favicon || '')} uploading={uploading === 'favicon'} onUrlChange={value => updateSetting('favicon', value)} onFile={file => void upload(file, 'favicon')} />
            </div>
          </Panel>
          <Panel title="Main navigation" subtitle="Rename, reorder, hide or change the URL of every top-level link.">
            <div className="space-y-2">{homepage.navigation.map((item, index) =>
              <div key={`${item.url}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input aria-label={`Navigation label ${index + 1}`} className={inputClass} value={item.label} onChange={event => updateHomepage('navigation', homepage.navigation.map((value, itemIndex) => itemIndex === index ? { ...value, label: event.target.value } : value))} />
                  <input aria-label={`Navigation URL ${index + 1}`} className={inputClass} value={item.url} onChange={event => updateHomepage('navigation', homepage.navigation.map((value, itemIndex) => itemIndex === index ? { ...value, url: event.target.value } : value))} />
                  <button type="button" aria-label={`${item.enabled ? 'Hide' : 'Show'} ${item.label}`} onClick={() => updateHomepage('navigation', homepage.navigation.map((value, itemIndex) => itemIndex === index ? { ...value, enabled: !value.enabled } : value))} className={`mt-1.5 rounded-xl px-3 text-xs font-bold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.enabled ? 'On' : 'Off'}</button>
                </div>
                <div className="mt-2 flex gap-2"><button type="button" disabled={index === 0} onClick={() => updateHomepage('navigation', arrayMove(homepage.navigation, index, index - 1))} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" disabled={index === homepage.navigation.length - 1} onClick={() => updateHomepage('navigation', arrayMove(homepage.navigation, index, index + 1))} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" onClick={() => updateHomepage('navigation', homepage.navigation.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto text-xs font-bold text-red-600">Remove</button></div>
              </div>
            )}</div>
            <button type="button" onClick={() => updateHomepage('navigation', [...homepage.navigation, { label: 'New link', url: '/', enabled: true }])} className="mt-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Link2 className="h-4 w-4" />Add navigation link</button>
          </Panel>
        </div>}

        {tab === 'media' && <div className="space-y-4">
          <Panel title="Homepage media library" subtitle="Upload to the configured Cloudinary account or paste an existing image URL.">
            <div className="space-y-4">
              <MediaField label="Hero background image" hint="Recommended 1920 × 760 px · WebP/AVIF · under 350 KB" value={homepage.heroBackgroundImage || homepage.media.heroBackground} uploading={uploading === 'heroBackground'} onUrlChange={value => { updateHomepage('heroBackgroundImage', value); updateHomepage('media', { ...homepage.media, heroBackground: value }); }} onFile={file => void upload(file, 'heroBackground')} />
              <MediaField label="Homepage social/OG image" hint="Required social ratio 1200 × 630 px · JPG/WebP · under 300 KB" value={String(settings.ogImage || homepage.media.homepageOgImage)} uploading={uploading === 'homepageOgImage'} onUrlChange={value => { updateSetting('ogImage', value); updateHomepage('media', { ...homepage.media, homepageOgImage: value }); }} onFile={file => void upload(file, 'homepageOgImage')} />
            </div>
          </Panel>
          <Panel title="Section images" subtitle="Each homepage category can have its own managed visual.">
            <div className="space-y-3">{homepage.sectionOrder.map(key => <MediaField key={key} label={homepage.titles[key] || LABELS[key]} value={homepage.media.sectionImages[key] || ''} uploading={uploading === key} onUrlChange={value => updateHomepage('media', { ...homepage.media, sectionImages: { ...homepage.media.sectionImages, [key]: value } })} onFile={file => void upload(file, key)} />)}</div>
          </Panel>
          <Panel title="SEO preview" subtitle="Homepage title and search/social description.">
            <div className="space-y-3"><Field label="Title suffix" value={String(settings.titleSuffix || '')} onChange={value => updateSetting('titleSuffix', value)} /><label className="block text-xs font-semibold text-slate-600">Meta description<textarea rows={4} className={inputClass} value={String(settings.metaDescription || '')} onChange={event => updateSetting('metaDescription', event.target.value)} /></label></div>
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

function NumberRange({ label, value, min, max, suffix = '', onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void;
}) {
  return <label className="block text-xs font-semibold text-slate-600">{label}: <strong className="text-blue-700">{value}{suffix}</strong>
    <input className="mt-2 w-full accent-blue-600" type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} />
  </label>;
}

function MediaField({ label, hint = 'Recommended 1600 × 900 px · WebP/AVIF · under 300 KB', value, uploading, onUrlChange, onFile }: {
  label: string; hint?: string; value: string; uploading: boolean; onUrlChange: (value: string) => void; onFile: (file?: File) => void;
}) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="block text-xs font-semibold text-slate-600">{label}
      <input className={inputClass} value={value} placeholder="https://..." onChange={event => onUrlChange(event.target.value)} />
    </label>
    <p className="mt-1 text-[10px] leading-4 text-slate-500">{hint}</p>
    <div className="mt-2 flex items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? 'Uploading…' : 'Upload image'}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={event => onFile(event.target.files?.[0])} />
      </label>
      {value && <button type="button" onClick={() => onUrlChange('')} className="text-xs font-bold text-red-600">Remove</button>}
      {value && <span className="ml-auto h-10 w-14 rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url("${value.replace(/"/g, '%22')}")` }} aria-label={`${label} preview`} />}
    </div>
  </div>;
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

function arrayMove<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
