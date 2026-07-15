'use client';

import { useState, useEffect, useCallback } from 'react';

import type { PhoneFormProps, PhoneFormData } from './types';
import { TABS, createEmptyFormData, toNumberOrEmpty, slugify } from './types';
import BasicInfoSection from './BasicInfoSection';
import DisplayProcessorSection from './DisplayProcessorSection';
import CameraSection from './CameraSection';
import BatteryBodySection from './BatteryBodySection';
import ConnectivitySection from './ConnectivitySection';
import BenchmarkSection from './BenchmarkSection';
import ReviewSEOSection from './ReviewSEOSection';
import ImagesPricesSection from './ImagesPricesSection';

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
        {activeTab === 0 && (
          <BasicInfoSection form={form} set={set} brandOptions={brandOptions} />
        )}
        {activeTab === 1 && (
          <DisplayProcessorSection form={form} set={set} />
        )}
        {activeTab === 2 && (
          <CameraSection form={form} set={set} />
        )}
        {activeTab === 3 && (
          <BatteryBodySection form={form} set={set} />
        )}
        {activeTab === 4 && (
          <ConnectivitySection form={form} set={set} />
        )}
        {activeTab === 5 && (
          <BenchmarkSection form={form} set={set} />
        )}
        {activeTab === 6 && (
          <ReviewSEOSection form={form} set={set} />
        )}
        {activeTab === 7 && (
          <ImagesPricesSection form={form} set={set} />
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