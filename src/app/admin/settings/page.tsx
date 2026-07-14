'use client';

import { useState } from 'react';
import { Settings, Check, Globe, Share2, Search, Shield, Wrench, LucideIcon } from 'lucide-react';

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
  const [site, setSite] = useState({
    siteName: 'PhoneDock',
    tagline: "Pakistan's #1 Smartphone Database",
    contactEmail: 'info@phonedock.pk',
  });

  const [social, setSocial] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    youtube: '',
  });

  const [seo, setSeo] = useState({
    titleSuffix: '| PhoneDock Pakistan',
    metaDescription: 'Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan.',
    googleAnalyticsId: '',
  });

  const [maintenance, setMaintenance] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Site Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your PhoneDock installation</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Settings className="w-3.5 h-3.5" /> Save Settings</>}
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-3 text-sm text-emerald-700 font-medium animate-fade-in">
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={Globe} title="General" color="bg-blue-50">
          <div className="space-y-3">
            <InputField label="Site Name" value={site.siteName} onChange={v => setSite({ ...site, siteName: v })} />
            <InputField label="Tagline" value={site.tagline} onChange={v => setSite({ ...site, tagline: v })} />
            <InputField label="Contact Email" type="email" value={site.contactEmail} onChange={v => setSite({ ...site, contactEmail: v })} placeholder="info@example.com" />
          </div>
        </SectionCard>

        <SectionCard icon={Share2} title="Social Links" color="bg-emerald-50">
          <div className="space-y-3">
            <InputField label="Facebook URL" value={social.facebook} onChange={v => setSocial({ ...social, facebook: v })} placeholder="https://facebook.com/phonedock" />
            <InputField label="Twitter/X URL" value={social.twitter} onChange={v => setSocial({ ...social, twitter: v })} placeholder="https://x.com/phonedock" />
            <InputField label="Instagram URL" value={social.instagram} onChange={v => setSocial({ ...social, instagram: v })} placeholder="https://instagram.com/phonedock" />
            <InputField label="YouTube URL" value={social.youtube} onChange={v => setSocial({ ...social, youtube: v })} placeholder="https://youtube.com/@phonedock" />
          </div>
        </SectionCard>

        <SectionCard icon={Search} title="SEO Settings" color="bg-violet-50">
          <div className="space-y-3">
            <InputField label="Default Title Suffix" value={seo.titleSuffix} onChange={v => setSeo({ ...seo, titleSuffix: v })} />
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Meta Description</label>
              <textarea value={seo.metaDescription} onChange={e => setSeo({ ...seo, metaDescription: e.target.value })} rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none" />
            </div>
            <InputField label="Google Analytics ID" value={seo.googleAnalyticsId} onChange={v => setSeo({ ...seo, googleAnalyticsId: v })} placeholder="G-XXXXXXXXXX" />
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
                onClick={() => setMaintenance(!maintenance)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${maintenance ? 'bg-red-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${maintenance ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
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