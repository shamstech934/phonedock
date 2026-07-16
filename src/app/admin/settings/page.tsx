'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Check, Globe, Share2, Search, Shield, Wrench, LucideIcon, Loader2 } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface SiteSettings {
  siteName: string;
  tagline: string;
  contactEmail: string;
  supportEmail: string;
  logo: string;
  favicon: string;
  facebook: string;
  twitter: string;
  instagram: string;
  youtubeChannel: string;
  titleSuffix: string;
  metaDescription: string;
  ogImage: string;
  googleAnalyticsId: string;
  maintenanceMode: boolean;
  footerText: string;
}

const DEFAULTS: SiteSettings = {
  siteName: 'PhoneDock',
  tagline: '',
  contactEmail: '',
  supportEmail: '',
  logo: '',
  favicon: '',
  facebook: '',
  twitter: '',
  instagram: '',
  youtubeChannel: '',
  titleSuffix: '',
  metaDescription: '',
  ogImage: '',
  googleAnalyticsId: '',
  maintenanceMode: false,
  footerText: '',
};

function SectionCard({ icon: Icon, title, children, color }: { icon: LucideIcon; title: string; children: React.ReactNode; color: string }) {
  return (
    <div className="card-premium p-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h2 className="font-bold text-sm text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
    </div>
  );
}

export default function AdminSettingsPage() {
  const { admin, loading: authLoading } = useAdmin();
  const [form, setForm] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to load settings (${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.settings) {
        setForm((prev) => ({
          siteName: data.settings.siteName ?? prev.siteName,
          tagline: data.settings.tagline ?? prev.tagline,
          contactEmail: data.settings.contactEmail ?? prev.contactEmail,
          supportEmail: data.settings.supportEmail ?? prev.supportEmail,
          logo: data.settings.logo ?? prev.logo,
          favicon: data.settings.favicon ?? prev.favicon,
          facebook: data.settings.facebook ?? prev.facebook,
          twitter: data.settings.twitter ?? prev.twitter,
          instagram: data.settings.instagram ?? prev.instagram,
          youtubeChannel: data.settings.youtubeChannel ?? prev.youtubeChannel,
          titleSuffix: data.settings.titleSuffix ?? prev.titleSuffix,
          metaDescription: data.settings.metaDescription ?? prev.metaDescription,
          ogImage: data.settings.ogImage ?? prev.ogImage,
          googleAnalyticsId: data.settings.googleAnalyticsId ?? prev.googleAnalyticsId,
          maintenanceMode: data.settings.maintenanceMode ?? prev.maintenanceMode,
          footerText: data.settings.footerText ?? prev.footerText,
        }));
      }
    } catch {
      setError('Network error while loading settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && admin) {
      fetchSettings();
    } else if (!authLoading && !admin) {
      setLoading(false);
    }
  }, [authLoading, admin, fetchSettings]);

  const updateField = (key: keyof SiteSettings, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Site Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your PhoneDock installation</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25 disabled:opacity-50">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Settings className="w-3.5 h-3.5" /> Save Settings</>}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200/50 rounded-xl p-3 text-sm text-red-700 font-medium animate-fade-in">
          {error}
        </div>
      )}

      {saved && !error && (
        <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-3 text-sm text-emerald-700 font-medium animate-fade-in">
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={Globe} title="General" color="bg-blue-50">
          <div className="space-y-3">
            <InputField label="Site Name" value={form.siteName} onChange={v => updateField('siteName', v)} />
            <InputField label="Tagline" value={form.tagline} onChange={v => updateField('tagline', v)} />
            <InputField label="Contact Email" type="email" value={form.contactEmail} onChange={v => updateField('contactEmail', v)} placeholder="info@example.com" />
            <InputField label="Support Email" type="email" value={form.supportEmail} onChange={v => updateField('supportEmail', v)} placeholder="support@example.com" />
            <InputField label="Logo URL" value={form.logo} onChange={v => updateField('logo', v)} placeholder="https://example.com/logo.png" />
            <InputField label="Favicon URL" value={form.favicon} onChange={v => updateField('favicon', v)} placeholder="https://example.com/favicon.ico" />
          </div>
        </SectionCard>

        <SectionCard icon={Share2} title="Social Links" color="bg-emerald-50">
          <div className="space-y-3">
            <InputField label="Facebook URL" value={form.facebook} onChange={v => updateField('facebook', v)} placeholder="https://facebook.com/phonedock" />
            <InputField label="Twitter/X URL" value={form.twitter} onChange={v => updateField('twitter', v)} placeholder="https://x.com/phonedock" />
            <InputField label="Instagram URL" value={form.instagram} onChange={v => updateField('instagram', v)} placeholder="https://instagram.com/phonedock" />
            <InputField label="YouTube Channel URL" value={form.youtubeChannel} onChange={v => updateField('youtubeChannel', v)} placeholder="https://youtube.com/@phonedock" />
          </div>
        </SectionCard>

        <SectionCard icon={Search} title="SEO Settings" color="bg-violet-50">
          <div className="space-y-3">
            <InputField label="Default Title Suffix" value={form.titleSuffix} onChange={v => updateField('titleSuffix', v)} />
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Meta Description</label>
              <textarea value={form.metaDescription} onChange={e => updateField('metaDescription', e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none" />
            </div>
            <InputField label="OG Image URL" value={form.ogImage} onChange={v => updateField('ogImage', v)} placeholder="https://example.com/og.png" />
            <InputField label="Google Analytics ID" value={form.googleAnalyticsId} onChange={v => updateField('googleAnalyticsId', v)} placeholder="G-XXXXXXXXXX" />
          </div>
        </SectionCard>

        <SectionCard icon={Shield} title="Advanced" color="bg-amber-50">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100/50">
              <div>
                <p className="text-sm font-semibold text-gray-900">Maintenance Mode</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Show a maintenance page to all visitors</p>
              </div>
              <button
                onClick={() => updateField('maintenanceMode', !form.maintenanceMode)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${form.maintenanceMode ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Footer Text</label>
              <textarea value={form.footerText} onChange={e => updateField('footerText', e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none" placeholder="© 2025 PhoneDock. All rights reserved." />
            </div>
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-800">Environment Info</p>
              </div>
              <div className="space-y-1 text-[10px] text-amber-700/80">
                <p>App: PhoneDock v1.0</p>
                <p>Framework: Next.js 16</p>
                <p>Database: MongoDB</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}