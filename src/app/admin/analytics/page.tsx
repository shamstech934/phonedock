'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, ExternalLink, MousePointerClick, RefreshCw, Star, Users } from 'lucide-react';

interface AnalyticsData {
  rangeDays: number;
  totals: { phoneViews:number; newsViews:number; affiliateClicks:number; sponsorClicks:number; sponsorImpressions:number; reviews:number; contacts:number };
  topPhones: Array<{ id:string; modelName:string; slug:string; views:number }>;
  affiliateByStore: Array<{ store:string; clicks:number }>;
  integrations: { googleAnalytics:boolean; microsoftClarity:boolean };
  generatedAt:string;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/analytics?t=${Date.now()}`, { credentials:'include', cache:'no-store' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || `Analytics failed (${res.status})`);
      setData(payload);
    } catch (e) { setError(e instanceof Error ? e.message : 'Analytics could not load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = data ? [
    ['Phone views', data.totals.phoneViews, BarChart3],
    ['Affiliate clicks (30d)', data.totals.affiliateClicks, MousePointerClick],
    ['Sponsor impressions', data.totals.sponsorImpressions, Activity],
    ['Reviews (30d)', data.totals.reviews, Star],
    ['Contacts (30d)', data.totals.contacts, Users],
  ] as const : [];

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold text-gray-900">Website Analytics</h1><p className="text-sm text-gray-500 mt-1">Internal content, affiliate and engagement signals.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label,value,Icon]) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon className="h-5 w-5 text-blue-600"/><div className="mt-3 text-2xl font-bold">{Number(value).toLocaleString()}</div><div className="text-xs text-gray-500">{label}</div></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Top phones by views</h2><div className="mt-4 divide-y">{data.topPhones.map(p => <div key={p.id} className="flex items-center justify-between py-3 text-sm"><span>{p.modelName}</span><span className="font-semibold">{p.views.toLocaleString()}</span></div>)}</div></section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Affiliate clicks by store (30 days)</h2><div className="mt-4 divide-y">{data.affiliateByStore.length ? data.affiliateByStore.map(r => <div key={r.store} className="flex items-center justify-between py-3 text-sm"><span>{r.store}</span><span className="font-semibold">{r.clicks.toLocaleString()}</span></div>) : <p className="py-4 text-sm text-gray-500">No affiliate click data yet.</p>}</div></section>
      </div>
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">External analytics setup</h2><div className="mt-3 flex flex-wrap gap-3 text-sm"><span className={`rounded-full px-3 py-1 ${data.integrations.googleAnalytics?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>Google Analytics: {data.integrations.googleAnalytics?'Configured':'Not configured'}</span><span className={`rounded-full px-3 py-1 ${data.integrations.microsoftClarity?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>Microsoft Clarity: {data.integrations.microsoftClarity?'Configured':'Not configured'}</span></div><p className="mt-3 text-xs text-gray-500"><ExternalLink className="mr-1 inline h-3 w-3"/>Detailed visitor sessions remain in Google Analytics or Microsoft Clarity; this page shows PhoneDock's own database-backed metrics.</p></section>
      <p className="text-xs text-gray-400">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </>}
  </div>;
}
