'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface PhoneImage {
  url: string;
  altText: string;
}

interface PhonePrice {
  storeName: string;
  price: number | '';
  url: string;
  inStock: boolean;
}

interface PhoneFormProps {
  phoneId?: string | null;
  brands: Array<{ id: string; name: string; slug: string }>;
  onSave: () => void;
  onCancel: () => void;
}

interface PhoneFormData {
  brand: string;
  modelName: string;
  slug: string;
  pakistaniPricePKR: number | '';
  ptaStatus: string;
  ptaApproved: boolean;
  releaseDate: string;
  thumbnailUrl: string;
  description: string;
  status: string;
  featured: boolean;
  trending: boolean;
  upcoming: boolean;
  // Display & Processor
  display: string;
  displayType: string;
  resolution: string;
  refreshRate: string;
  protection: string;
  brightness: string;
  chipset: string;
  cpu: string;
  gpu: string;
  process: string;
  ram: string;
  ramType: string;
  storage: string;
  cardSlot: string;
  // Camera
  mainCamera: string;
  mainCameraSensor: string;
  aperture: string;
  ois: string;
  eis: string;
  ultrawide: string;
  telephoto: string;
  zoom: string;
  cameraFeatures: string;
  videoRecording: string;
  selfieCamera: string;
  selfieSensor: string;
  selfieVideo: string;
  // Battery & Body
  battery: string;
  charging: string;
  chargingSpeed: string;
  wirelessCharge: string;
  wirelessSpeed: string;
  reverseCharge: string;
  weight: string;
  dimensions: string;
  build: string;
  sim: string;
  ipRating: string;
  colors: string;
  // Connectivity & OS
  network: string;
  fiveG: string;
  wifi: string;
  bluetooth: string;
  nfc: string;
  usb: string;
  fingerprint: string;
  faceUnlock: string;
  sensors: string;
  os: string;
  osVersion: string;
  osUI: string;
  updatePolicy: string;
  specialFeatures: string;
  // Benchmarks & Ratings
  antutuScore: number | '';
  geekbenchSingle: number | '';
  geekbenchMulti: number | '';
  gamingScore: number | '';
  pubgFPS: string;
  codMobileFPS: string;
  genshinFPS: string;
  videoPlayback: string;
  gamingBattery: string;
  browsingBattery: string;
  cameraScore: number | '';
  performanceScore: number | '';
  batteryScore: number | '';
  displayScore: number | '';
  valueScore: number | '';
  overallRating: number | '';
  // Review & SEO
  pros: string;
  cons: string;
  reviewSummary: string;
  reviewVerdict: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string;
  // Images & Prices
  images: PhoneImage[];
  prices: PhonePrice[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORE_NAMES = [
  'Daraz',
  'PriceOye',
  'Whatmobile',
  'Telemart',
  'iShopping',
  'Yayvo',
] as const;

const TABS = [
  'Basic Info',
  'Display & Processor',
  'Camera',
  'Battery & Body',
  'Connectivity & OS',
  'Benchmarks & Ratings',
  'Review & SEO',
  'Images & Prices',
] as const;

const EMPTY_IMAGE: PhoneImage = { url: '', altText: '' };

const EMPTY_PRICE: PhonePrice = {
  storeName: 'Daraz',
  price: '',
  url: '',
  inStock: true,
};

const createEmptyFormData = (): PhoneFormData => ({
  brand: '',
  modelName: '',
  slug: '',
  pakistaniPricePKR: '',
  ptaStatus: 'Unknown',
  ptaApproved: false,
  releaseDate: '',
  thumbnailUrl: '',
  description: '',
  status: 'draft',
  featured: false,
  trending: false,
  upcoming: false,
  display: '',
  displayType: '',
  resolution: '',
  refreshRate: '',
  protection: '',
  brightness: '',
  chipset: '',
  cpu: '',
  gpu: '',
  process: '',
  ram: '',
  ramType: '',
  storage: '',
  cardSlot: '',
  mainCamera: '',
  mainCameraSensor: '',
  aperture: '',
  ois: '',
  eis: '',
  ultrawide: '',
  telephoto: '',
  zoom: '',
  cameraFeatures: '',
  videoRecording: '',
  selfieCamera: '',
  selfieSensor: '',
  selfieVideo: '',
  battery: '',
  charging: '',
  chargingSpeed: '',
  wirelessCharge: '',
  wirelessSpeed: '',
  reverseCharge: '',
  weight: '',
  dimensions: '',
  build: '',
  sim: '',
  ipRating: '',
  colors: '',
  network: '',
  fiveG: '',
  wifi: '',
  bluetooth: '',
  nfc: '',
  usb: '',
  fingerprint: '',
  faceUnlock: '',
  sensors: '',
  os: '',
  osVersion: '',
  osUI: '',
  updatePolicy: '',
  specialFeatures: '',
  antutuScore: '',
  geekbenchSingle: '',
  geekbenchMulti: '',
  gamingScore: '',
  pubgFPS: '',
  codMobileFPS: '',
  genshinFPS: '',
  videoPlayback: '',
  gamingBattery: '',
  browsingBattery: '',
  cameraScore: '',
  performanceScore: '',
  batteryScore: '',
  displayScore: '',
  valueScore: '',
  overallRating: '',
  pros: '',
  cons: '',
  reviewSummary: '',
  reviewVerdict: '',
  seoTitle: '',
  seoDescription: '',
  keywords: '',
  images: [],
  prices: [],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toNumberOrEmpty(value: unknown): number | '' {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return isNaN(n) ? '' : n;
}

// ─── Shared UI Primitives ────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700">{children}</label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={value === '' ? '' : value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
        min={min}
        max={max}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="col-span-full">
      <FieldLabel>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PhoneForm({
  phoneId,
  brands,
  onSave,
  onCancel,
}: PhoneFormProps) {
  const isEditMode = Boolean(phoneId);

  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<PhoneFormData>(createEmptyFormData);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Field updater helper ──
  const set = useCallback(
    <K extends keyof PhoneFormData>(key: K, value: PhoneFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Auto-generate slug in add mode ──
  useEffect(() => {
    if (isEditMode) return;
    const selectedBrand = brands.find((b) => b.id === form.brand);
    const brandName = selectedBrand?.name ?? '';
    const model = form.modelName.trim();
    if (brandName || model) {
      setForm((prev) => ({
        ...prev,
        slug: slugify(`${brandName} ${model}`),
      }));
    }
    // Only react to brand & modelName changes
  }, [form.brand, form.modelName, brands, isEditMode]);

  // ── Fetch phone data in edit mode ──
  useEffect(() => {
    if (!isEditMode || !phoneId) return;

    let cancelled = false;

    async function fetchPhone() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/phones/${phoneId}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch phone (HTTP ${res.status})`);
        }

        const data = await res.json();

        if (cancelled) return;

        // Map API response to form state
        setForm({
          brand: data.brand ?? data.brandId ?? '',
          modelName: data.modelName ?? data.model_name ?? '',
          slug: data.slug ?? '',
          pakistaniPricePKR: toNumberOrEmpty(
            data.pakistaniPricePKR ?? data.pakistani_price_pkr,
          ),
          ptaStatus: data.ptaStatus ?? data.pta_status ?? 'Unknown',
          ptaApproved: Boolean(data.ptaApproved ?? data.pta_approved),
          releaseDate: data.releaseDate ?? data.release_date ?? '',
          thumbnailUrl: data.thumbnailUrl ?? data.thumbnail_url ?? '',
          description: data.description ?? '',
          status: data.status ?? 'draft',
          featured: Boolean(data.featured),
          trending: Boolean(data.trending),
          upcoming: Boolean(data.upcoming),
          // Display & Processor
          display: data.display ?? '',
          displayType: data.displayType ?? data.display_type ?? '',
          resolution: data.resolution ?? '',
          refreshRate: data.refreshRate ?? data.refresh_rate ?? '',
          protection: data.protection ?? '',
          brightness: data.brightness ?? '',
          chipset: data.chipset ?? '',
          cpu: data.cpu ?? '',
          gpu: data.gpu ?? '',
          process: data.process ?? '',
          ram: data.ram ?? '',
          ramType: data.ramType ?? data.ram_type ?? '',
          storage: data.storage ?? '',
          cardSlot: data.cardSlot ?? data.card_slot ?? '',
          // Camera
          mainCamera: data.mainCamera ?? data.main_camera ?? '',
          mainCameraSensor:
            data.mainCameraSensor ?? data.main_camera_sensor ?? '',
          aperture: data.aperture ?? '',
          ois: data.ois ?? '',
          eis: data.eis ?? '',
          ultrawide: data.ultrawide ?? '',
          telephoto: data.telephoto ?? '',
          zoom: data.zoom ?? '',
          cameraFeatures: data.cameraFeatures ?? data.camera_features ?? '',
          videoRecording: data.videoRecording ?? data.video_recording ?? '',
          selfieCamera: data.selfieCamera ?? data.selfie_camera ?? '',
          selfieSensor: data.selfieSensor ?? data.selfie_sensor ?? '',
          selfieVideo: data.selfieVideo ?? data.selfie_video ?? '',
          // Battery & Body
          battery: data.battery ?? '',
          charging: data.charging ?? '',
          chargingSpeed: data.chargingSpeed ?? data.charging_speed ?? '',
          wirelessCharge: data.wirelessCharge ?? data.wireless_charge ?? '',
          wirelessSpeed: data.wirelessSpeed ?? data.wireless_speed ?? '',
          reverseCharge: data.reverseCharge ?? data.reverse_charge ?? '',
          weight: data.weight ?? '',
          dimensions: data.dimensions ?? '',
          build: data.build ?? '',
          sim: data.sim ?? '',
          ipRating: data.ipRating ?? data.ip_rating ?? '',
          colors: data.colors ?? '',
          // Connectivity & OS
          network: data.network ?? '',
          fiveG: data.fiveG ?? data.five_g ?? data['5g'] ?? '',
          wifi: data.wifi ?? data.wiFi ?? data.wi_fi ?? '',
          bluetooth: data.bluetooth ?? '',
          nfc: data.nfc ?? '',
          usb: data.usb ?? '',
          fingerprint: data.fingerprint ?? '',
          faceUnlock: data.faceUnlock ?? data.face_unlock ?? '',
          sensors: data.sensors ?? '',
          os: data.os ?? '',
          osVersion: data.osVersion ?? data.os_version ?? '',
          osUI: data.osUI ?? data.os_ui ?? '',
          updatePolicy: data.updatePolicy ?? data.update_policy ?? '',
          specialFeatures: data.specialFeatures ?? data.special_features ?? '',
          // Benchmarks & Ratings
          antutuScore: toNumberOrEmpty(
            data.antutuScore ?? data.antutu_score,
          ),
          geekbenchSingle: toNumberOrEmpty(
            data.geekbenchSingle ?? data.geekbench_single,
          ),
          geekbenchMulti: toNumberOrEmpty(
            data.geekbenchMulti ?? data.geekbench_multi,
          ),
          gamingScore: toNumberOrEmpty(
            data.gamingScore ?? data.gaming_score,
          ),
          pubgFPS: data.pubgFPS ?? data.pubg_fps ?? '',
          codMobileFPS: data.codMobileFPS ?? data.cod_mobile_fps ?? '',
          genshinFPS: data.genshinFPS ?? data.genshin_fps ?? '',
          videoPlayback: data.videoPlayback ?? data.video_playback ?? '',
          gamingBattery: data.gamingBattery ?? data.gaming_battery ?? '',
          browsingBattery: data.browsingBattery ?? data.browsing_battery ?? '',
          cameraScore: toNumberOrEmpty(data.cameraScore ?? data.camera_score),
          performanceScore: toNumberOrEmpty(
            data.performanceScore ?? data.performance_score,
          ),
          batteryScore: toNumberOrEmpty(data.batteryScore ?? data.battery_score),
          displayScore: toNumberOrEmpty(data.displayScore ?? data.display_score),
          valueScore: toNumberOrEmpty(data.valueScore ?? data.value_score),
          overallRating: toNumberOrEmpty(
            data.overallRating ?? data.overall_rating,
          ),
          // Review & SEO
          pros: data.pros ?? '',
          cons: data.cons ?? '',
          reviewSummary: data.reviewSummary ?? data.review_summary ?? '',
          reviewVerdict: data.reviewVerdict ?? data.review_verdict ?? '',
          seoTitle: data.seoTitle ?? data.seo_title ?? '',
          seoDescription: data.seoDescription ?? data.seo_description ?? '',
          keywords: data.keywords ?? '',
          // Images & Prices
          images: Array.isArray(data.images)
            ? data.images.map((img: Record<string, string>) => ({
                url: img.url ?? '',
                altText: img.altText ?? img.alt_text ?? '',
              }))
            : [],
          prices: Array.isArray(data.prices)
            ? data.prices.map((p: Record<string, unknown>) => ({
                storeName: String(p.storeName ?? p.store_name ?? 'Daraz'),
                price: toNumberOrEmpty(p.price),
                url: String(p.url ?? ''),
                inStock: Boolean(p.inStock ?? p.in_stock ?? true),
              }))
            : [],
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load phone data',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPhone();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, phoneId]);

  // ── Submit handler ──
  const handleSubmit = async () => {
    // Validation
    if (!form.brand) {
      setError('Brand is required.');
      setActiveTab(0);
      return;
    }
    if (!form.modelName.trim()) {
      setError('Model Name is required.');
      setActiveTab(0);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEditMode
        ? `/api/admin/phones/${phoneId}`
        : '/api/admin/phones';

      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Save failed (HTTP ${res.status}): ${body || res.statusText}`,
        );
      }

      onSave();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save phone data',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Image helpers ──
  const addImage = () => set('images', [...form.images, { ...EMPTY_IMAGE }]);

  const removeImage = (index: number) =>
    set(
      'images',
      form.images.filter((_, i) => i !== index),
    );

  const updateImage = (
    index: number,
    field: keyof PhoneImage,
    value: string,
  ) => {
    const updated = form.images.map((img, i) =>
      i === index ? { ...img, [field]: value } : img,
    );
    set('images', updated);
  };

  // ── Price helpers ──
  const addPrice = () => set('prices', [...form.prices, { ...EMPTY_PRICE }]);

  const removePrice = (index: number) =>
    set(
      'prices',
      form.prices.filter((_, i) => i !== index),
    );

  const updatePrice = (
    index: number,
    field: keyof PhonePrice,
    value: PhonePrice[keyof PhonePrice],
  ) => {
    const updated = form.prices.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    set('prices', updated);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-sm text-gray-500">Loading phone data&hellip;</span>
      </div>
    );
  }

  // ── Brand options ──
  const brandOptions = [
    { value: '', label: '— Select Brand —' },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Phone' : 'Add New Phone'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {saving ? 'Saving...' : 'Save Phone'}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-4 font-medium text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-1 overflow-x-auto"
          aria-label="Tabs"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                activeTab === idx
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Content ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* ────── Tab 0: Basic Info ────── */}
        {activeTab === 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <SelectInput
              label="Brand"
              value={form.brand}
              onChange={(v) => set('brand', v)}
              options={brandOptions}
              required
            />
            <TextInput
              label="Model Name"
              value={form.modelName}
              onChange={(v) => set('modelName', v)}
              required
              placeholder="e.g. Galaxy S24 Ultra"
            />
            <TextInput
              label="Slug"
              value={form.slug}
              onChange={(v) => set('slug', v)}
              placeholder="auto-generated-from-brand-model"
            />
            <NumberInput
              label="Pakistani Price PKR"
              value={form.pakistaniPricePKR}
              onChange={(v) => set('pakistaniPricePKR', v)}
              placeholder="e.g. 350000"
            />
            <SelectInput
              label="PTA Status"
              value={form.ptaStatus}
              onChange={(v) => set('ptaStatus', v)}
              options={[
                { value: 'PTA Approved', label: 'PTA Approved' },
                { value: 'Non-PTA', label: 'Non-PTA' },
                { value: 'Unknown', label: 'Unknown' },
              ]}
            />
            <div className="flex items-end pb-1">
              <CheckboxInput
                label="PTA Approved"
                value={form.ptaApproved}
                onChange={(v) => set('ptaApproved', v)}
              />
            </div>
            <TextInput
              label="Release Date"
              value={form.releaseDate}
              onChange={(v) => set('releaseDate', v)}
              type="date"
            />
            <TextInput
              label="Thumbnail URL"
              value={form.thumbnailUrl}
              onChange={(v) => set('thumbnailUrl', v)}
              placeholder="https://..."
            />
            <TextArea
              label="Description"
              value={form.description}
              onChange={(v) => set('description', v)}
              rows={3}
            />
            <SelectInput
              label="Status"
              value={form.status}
              onChange={(v) => set('status', v)}
              options={[
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
              ]}
            />
            <div className="flex flex-col gap-3">
              <CheckboxInput
                label="Featured"
                value={form.featured}
                onChange={(v) => set('featured', v)}
              />
              <CheckboxInput
                label="Trending"
                value={form.trending}
                onChange={(v) => set('trending', v)}
              />
              <CheckboxInput
                label="Upcoming"
                value={form.upcoming}
                onChange={(v) => set('upcoming', v)}
              />
            </div>
          </div>
        )}

        {/* ────── Tab 1: Display & Processor ────── */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              label="Display"
              value={form.display}
              onChange={(v) => set('display', v)}
              placeholder='e.g. 6.8"'
            />
            <TextInput
              label="Display Type"
              value={form.displayType}
              onChange={(v) => set('displayType', v)}
              placeholder="e.g. Dynamic AMOLED 2X"
            />
            <TextInput
              label="Resolution"
              value={form.resolution}
              onChange={(v) => set('resolution', v)}
              placeholder="e.g. 1440 x 3120"
            />
            <TextInput
              label="Refresh Rate"
              value={form.refreshRate}
              onChange={(v) => set('refreshRate', v)}
              placeholder="e.g. 120Hz"
            />
            <TextInput
              label="Protection"
              value={form.protection}
              onChange={(v) => set('protection', v)}
              placeholder="e.g. Gorilla Glass Victus 2"
            />
            <TextInput
              label="Brightness"
              value={form.brightness}
              onChange={(v) => set('brightness', v)}
              placeholder="e.g. 2600 nits peak"
            />
            <TextInput
              label="Chipset"
              value={form.chipset}
              onChange={(v) => set('chipset', v)}
              placeholder="e.g. Snapdragon 8 Gen 3"
            />
            <TextInput
              label="CPU"
              value={form.cpu}
              onChange={(v) => set('cpu', v)}
              placeholder="e.g. Octa-core"
            />
            <TextInput
              label="GPU"
              value={form.gpu}
              onChange={(v) => set('gpu', v)}
              placeholder="e.g. Adreno 750"
            />
            <TextInput
              label="Process"
              value={form.process}
              onChange={(v) => set('process', v)}
              placeholder="e.g. 4nm"
            />
            <TextInput
              label="RAM"
              value={form.ram}
              onChange={(v) => set('ram', v)}
              placeholder="e.g. 12GB"
            />
            <TextInput
              label="RAM Type"
              value={form.ramType}
              onChange={(v) => set('ramType', v)}
              placeholder="e.g. LPDDR5X"
            />
            <TextInput
              label="Storage"
              value={form.storage}
              onChange={(v) => set('storage', v)}
              placeholder="e.g. 256GB"
            />
            <TextInput
              label="Card Slot"
              value={form.cardSlot}
              onChange={(v) => set('cardSlot', v)}
              placeholder="e.g. microSDXC up to 1TB"
            />
          </div>
        )}

        {/* ────── Tab 2: Camera ────── */}
        {activeTab === 2 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              label="Main Camera"
              value={form.mainCamera}
              onChange={(v) => set('mainCamera', v)}
              placeholder="e.g. 200MP + 50MP + 12MP + 10MP"
            />
            <TextInput
              label="Main Camera Sensor"
              value={form.mainCameraSensor}
              onChange={(v) => set('mainCameraSensor', v)}
              placeholder="e.g. ISOCELL HP2"
            />
            <TextInput
              label="Aperture"
              value={form.aperture}
              onChange={(v) => set('aperture', v)}
              placeholder="e.g. f/1.7"
            />
            <TextInput
              label="OIS"
              value={form.ois}
              onChange={(v) => set('ois', v)}
              placeholder="e.g. Yes"
            />
            <TextInput
              label="EIS"
              value={form.eis}
              onChange={(v) => set('eis', v)}
              placeholder="e.g. Yes"
            />
            <TextInput
              label="Ultrawide"
              value={form.ultrawide}
              onChange={(v) => set('ultrawide', v)}
              placeholder="e.g. 12MP, f/2.2"
            />
            <TextInput
              label="Telephoto"
              value={form.telephoto}
              onChange={(v) => set('telephoto', v)}
              placeholder="e.g. 10MP, 3x optical"
            />
            <TextInput
              label="Zoom"
              value={form.zoom}
              onChange={(v) => set('zoom', v)}
              placeholder="e.g. 100x Space Zoom"
            />
            <TextInput
              label="Camera Features"
              value={form.cameraFeatures}
              onChange={(v) => set('cameraFeatures', v)}
              placeholder="e.g. LED flash, HDR, panorama"
            />
            <TextInput
              label="Video Recording"
              value={form.videoRecording}
              onChange={(v) => set('videoRecording', v)}
              placeholder="e.g. 8K@30fps, 4K@60fps"
            />
            <TextInput
              label="Selfie Camera"
              value={form.selfieCamera}
              onChange={(v) => set('selfieCamera', v)}
              placeholder="e.g. 12MP"
            />
            <TextInput
              label="Selfie Sensor"
              value={form.selfieSensor}
              onChange={(v) => set('selfieSensor', v)}
              placeholder="e.g. Sony IMX564"
            />
            <TextInput
              label="Selfie Video"
              value={form.selfieVideo}
              onChange={(v) => set('selfieVideo', v)}
              placeholder="e.g. 4K@60fps"
            />
          </div>
        )}

        {/* ────── Tab 3: Battery & Body ────── */}
        {activeTab === 3 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              label="Battery"
              value={form.battery}
              onChange={(v) => set('battery', v)}
              placeholder="e.g. 5000 mAh"
            />
            <TextInput
              label="Charging"
              value={form.charging}
              onChange={(v) => set('charging', v)}
              placeholder="e.g. Fast Charging"
            />
            <TextInput
              label="Charging Speed"
              value={form.chargingSpeed}
              onChange={(v) => set('chargingSpeed', v)}
              placeholder="e.g. 45W"
            />
            <TextInput
              label="Wireless Charge"
              value={form.wirelessCharge}
              onChange={(v) => set('wirelessCharge', v)}
              placeholder="e.g. Yes"
            />
            <TextInput
              label="Wireless Speed"
              value={form.wirelessSpeed}
              onChange={(v) => set('wirelessSpeed', v)}
              placeholder="e.g. 15W"
            />
            <TextInput
              label="Reverse Charge"
              value={form.reverseCharge}
              onChange={(v) => set('reverseCharge', v)}
              placeholder="e.g. 4.5W"
            />
            <TextInput
              label="Weight"
              value={form.weight}
              onChange={(v) => set('weight', v)}
              placeholder="e.g. 232g"
            />
            <TextInput
              label="Dimensions"
              value={form.dimensions}
              onChange={(v) => set('dimensions', v)}
              placeholder="e.g. 162.3 x 77.6 x 8.6 mm"
            />
            <TextInput
              label="Build"
              value={form.build}
              onChange={(v) => set('build', v)}
              placeholder="e.g. Glass front/back, Titanium frame"
            />
            <TextInput
              label="SIM"
              value={form.sim}
              onChange={(v) => set('sim', v)}
              placeholder="e.g. Dual Nano-SIM"
            />
            <TextInput
              label="IP Rating"
              value={form.ipRating}
              onChange={(v) => set('ipRating', v)}
              placeholder="e.g. IP68"
            />
            <TextInput
              label="Colors"
              value={form.colors}
              onChange={(v) => set('colors', v)}
              placeholder="e.g. Titanium Gray, Titanium Black"
            />
          </div>
        )}

        {/* ────── Tab 4: Connectivity & OS ────── */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              label="Network"
              value={form.network}
              onChange={(v) => set('network', v)}
              placeholder="e.g. GSM / HSPA / LTE / 5G"
            />
            <TextInput
              label="5G"
              value={form.fiveG}
              onChange={(v) => set('fiveG', v)}
              placeholder="e.g. SA/NSA"
            />
            <TextInput
              label="WiFi"
              value={form.wifi}
              onChange={(v) => set('wifi', v)}
              placeholder="e.g. Wi-Fi 7, 802.11be"
            />
            <TextInput
              label="Bluetooth"
              value={form.bluetooth}
              onChange={(v) => set('bluetooth', v)}
              placeholder="e.g. 5.3, A2DP, LE"
            />
            <TextInput
              label="NFC"
              value={form.nfc}
              onChange={(v) => set('nfc', v)}
              placeholder="e.g. Yes"
            />
            <TextInput
              label="USB"
              value={form.usb}
              onChange={(v) => set('usb', v)}
              placeholder="e.g. USB Type-C 3.2"
            />
            <TextInput
              label="Fingerprint"
              value={form.fingerprint}
              onChange={(v) => set('fingerprint', v)}
              placeholder="e.g. Ultrasonic, under display"
            />
            <TextInput
              label="Face Unlock"
              value={form.faceUnlock}
              onChange={(v) => set('faceUnlock', v)}
              placeholder="e.g. Yes"
            />
            <TextInput
              label="Sensors"
              value={form.sensors}
              onChange={(v) => set('sensors', v)}
              placeholder="e.g. Accelerometer, Gyro, Proximity"
            />
            <TextInput
              label="OS"
              value={form.os}
              onChange={(v) => set('os', v)}
              placeholder="e.g. Android"
            />
            <TextInput
              label="OS Version"
              value={form.osVersion}
              onChange={(v) => set('osVersion', v)}
              placeholder="e.g. 14"
            />
            <TextInput
              label="OS UI"
              value={form.osUI}
              onChange={(v) => set('osUI', v)}
              placeholder="e.g. One UI 6.1"
            />
            <TextInput
              label="Update Policy"
              value={form.updatePolicy}
              onChange={(v) => set('updatePolicy', v)}
              placeholder="e.g. 7 years"
            />
            <TextInput
              label="Special Features"
              value={form.specialFeatures}
              onChange={(v) => set('specialFeatures', v)}
              placeholder="e.g. S-Pen, Samsung DeX"
            />
          </div>
        )}

        {/* ────── Tab 5: Benchmarks & Ratings ────── */}
        {activeTab === 5 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <NumberInput
              label="AnTuTu Score"
              value={form.antutuScore}
              onChange={(v) => set('antutuScore', v)}
              placeholder="e.g. 2240000"
            />
            <NumberInput
              label="Geekbench Single"
              value={form.geekbenchSingle}
              onChange={(v) => set('geekbenchSingle', v)}
              placeholder="e.g. 2200"
            />
            <NumberInput
              label="Geekbench Multi"
              value={form.geekbenchMulti}
              onChange={(v) => set('geekbenchMulti', v)}
              placeholder="e.g. 7000"
            />
            <NumberInput
              label="Gaming Score"
              value={form.gamingScore}
              onChange={(v) => set('gamingScore', v)}
              placeholder="e.g. 985"
            />
            <TextInput
              label="PUBG FPS"
              value={form.pubgFPS}
              onChange={(v) => set('pubgFPS', v)}
              placeholder="e.g. 90 FPS"
            />
            <TextInput
              label="COD Mobile FPS"
              value={form.codMobileFPS}
              onChange={(v) => set('codMobileFPS', v)}
              placeholder="e.g. 60 FPS"
            />
            <TextInput
              label="Genshin FPS"
              value={form.genshinFPS}
              onChange={(v) => set('genshinFPS', v)}
              placeholder="e.g. 60 FPS"
            />
            <TextInput
              label="Video Playback"
              value={form.videoPlayback}
              onChange={(v) => set('videoPlayback', v)}
              placeholder="e.g. Up to 29 hours"
            />
            <TextInput
              label="Gaming Battery"
              value={form.gamingBattery}
              onChange={(v) => set('gamingBattery', v)}
              placeholder="e.g. 7 hours"
            />
            <TextInput
              label="Browsing Battery"
              value={form.browsingBattery}
              onChange={(v) => set('browsingBattery', v)}
              placeholder="e.g. 14 hours"
            />
            <NumberInput
              label="Camera Score"
              value={form.cameraScore}
              onChange={(v) => set('cameraScore', v)}
              min={0}
              max={100}
            />
            <NumberInput
              label="Performance Score"
              value={form.performanceScore}
              onChange={(v) => set('performanceScore', v)}
              min={0}
              max={100}
            />
            <NumberInput
              label="Battery Score"
              value={form.batteryScore}
              onChange={(v) => set('batteryScore', v)}
              min={0}
              max={100}
            />
            <NumberInput
              label="Display Score"
              value={form.displayScore}
              onChange={(v) => set('displayScore', v)}
              min={0}
              max={100}
            />
            <NumberInput
              label="Value Score"
              value={form.valueScore}
              onChange={(v) => set('valueScore', v)}
              min={0}
              max={100}
            />
            <NumberInput
              label="Overall Rating"
              value={form.overallRating}
              onChange={(v) => set('overallRating', v)}
              min={0}
              max={100}
            />
          </div>
        )}

        {/* ────── Tab 6: Review & SEO ────── */}
        {activeTab === 6 && (
          <div className="grid grid-cols-1 gap-5">
            <TextArea
              label="Pros"
              value={form.pros}
              onChange={(v) => set('pros', v)}
              rows={3}
            />
            <TextArea
              label="Cons"
              value={form.cons}
              onChange={(v) => set('cons', v)}
              rows={3}
            />
            <TextArea
              label="Review Summary"
              value={form.reviewSummary}
              onChange={(v) => set('reviewSummary', v)}
              rows={4}
            />
            <TextArea
              label="Review Verdict"
              value={form.reviewVerdict}
              onChange={(v) => set('reviewVerdict', v)}
              rows={3}
            />

            <hr className="col-span-full border-gray-200" />

            <div className="col-span-full">
              <TextInput
                label="SEO Title"
                value={form.seoTitle}
                onChange={(v) => set('seoTitle', v)}
                placeholder="Meta title for search engines"
              />
            </div>
            <TextArea
              label="SEO Description"
              value={form.seoDescription}
              onChange={(v) => set('seoDescription', v)}
              rows={2}
            />
            <div className="col-span-full">
              <TextInput
                label="Keywords"
                value={form.keywords}
                onChange={(v) => set('keywords', v)}
                placeholder="comma-separated, e.g. samsung, galaxy, s24, ultra"
              />
            </div>
          </div>
        )}

        {/* ────── Tab 7: Images & Prices ────── */}
        {activeTab === 7 && (
          <div className="space-y-10">
            {/* Images */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  Images
                </h3>
                <button
                  type="button"
                  onClick={addImage}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Add Image
                </button>
              </div>

              {form.images.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                  No images added yet. Click &quot;Add Image&quot; to get started.
                </p>
              )}

              <div className="space-y-3">
                {form.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex-1">
                      <FieldLabel>URL</FieldLabel>
                      <input
                        type="text"
                        value={img.url}
                        onChange={(e) =>
                          updateImage(idx, 'url', e.target.value)
                        }
                        placeholder="https://..."
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <FieldLabel>Alt Text</FieldLabel>
                      <input
                        type="text"
                        value={img.altText}
                        onChange={(e) =>
                          updateImage(idx, 'altText', e.target.value)
                        }
                        placeholder="Description of the image"
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                      title="Remove image"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Prices */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  Prices
                </h3>
                <button
                  type="button"
                  onClick={addPrice}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Add Price
                </button>
              </div>

              {form.prices.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                  No prices added yet. Click &quot;Add Price&quot; to get started.
                </p>
              )}

              <div className="space-y-3">
                {form.prices.map((price, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      {/* Store Name */}
                      <div className="min-w-[140px]">
                        <FieldLabel>Store</FieldLabel>
                        <select
                          value={price.storeName}
                          onChange={(e) =>
                            updatePrice(idx, 'storeName', e.target.value)
                          }
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          {STORE_NAMES.map((store) => (
                            <option key={store} value={store}>
                              {store}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price */}
                      <div className="min-w-[140px] flex-1">
                        <FieldLabel>Price (PKR)</FieldLabel>
                        <input
                          type="number"
                          value={price.price === '' ? '' : price.price}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updatePrice(
                              idx,
                              'price',
                              raw === '' ? '' : Number(raw),
                            );
                          }}
                          placeholder="e.g. 349999"
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* URL */}
                      <div className="min-w-[200px] flex-1">
                        <FieldLabel>URL</FieldLabel>
                        <input
                          type="text"
                          value={price.url}
                          onChange={(e) =>
                            updatePrice(idx, 'url', e.target.value)
                          }
                          placeholder="https://..."
                          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* In Stock */}
                      <div className="flex items-end pb-0.5">
                        <CheckboxInput
                          label="In Stock"
                          value={price.inStock}
                          onChange={(v) => updatePrice(idx, 'inStock', v)}
                        />
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removePrice(idx)}
                        className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                        title="Remove price"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {saving ? 'Saving...' : 'Save Phone'}
        </button>
      </div>
    </div>
  );
}