'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, ExternalLink, MousePointerClick, RefreshCw, Star, Users, BadgePercent, DatabaseZap, ShieldAlert } from 'lucide-react';

interface AnalyticsData {
  rangeDays: number;
  totals: { phoneViews:number; newsViews:number; affiliateClicks:number; sponsorClicks:number; sponsorImpressions:number; reviews:number; contacts:number };
  topPhones: Array<{ id:string; modelName:string; slug:string; views:number }>;
  affiliateByStore: Array<{ store:string; clicks:number }>;
  integrations: { googleAnalytics:boolean; microsoftClarity:boolean };
  operations: {
    publishedPhones:number; trackedPhones:number; trackingCoveragePct:number; discountedPhones:number; pendingPriceChanges:number;
    lifecycle:Record<string,number>; sourceHealth:Record<string,number>; activityByDay:Array<{date:string;count:number}>;
  };
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
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Automation & catalogue health</h2><p className="mt-1 text-xs text-gray-500">Operational metrics that directly affect prices and public phone status.</p></div><DatabaseZap className="h-5 w-5 text-blue-600" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['Tracking coverage', `${data.operations.trackingCoveragePct}%`, `${data.operations.trackedPhones}/${data.operations.publishedPhones} published phones`, DatabaseZap],
            ['Live discounts', data.operations.discountedPhones, 'Cards with verified previous price', BadgePercent],
            ['Pending price review', data.operations.pendingPriceChanges, 'Large changes waiting for approval', ShieldAlert],
            ['Healthy sources', data.operations.sourceHealth.active || 0, `${data.operations.sourceHealth.error || 0} sources need attention`, Activity],
          ] as const).map(([label,value,caption,Icon]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><Icon className="h-4 w-4 text-blue-600" /><div className="mt-2 text-2xl font-black text-slate-950">{String(value)}</div><div className="text-xs font-semibold text-slate-700">{String(label)}</div><p className="mt-1 text-[11px] text-slate-500">{String(caption)}</p></div>)}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone lifecycle</h3><div className="mt-2 space-y-2">{Object.entries(data.operations.lifecycle).map(([label,value]) => <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="capitalize">{label.replaceAll('_',' ')}</span><strong>{value}</strong></div>)}</div></div>
          <div><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Admin activity — 7 days</h3><div className="mt-3 flex h-36 items-end gap-2">{data.operations.activityByDay.length ? data.operations.activityByDay.map(row => { const max=Math.max(...data.operations.activityByDay.map(item=>item.count),1); return <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] font-bold">{row.count}</span><div className="w-full rounded-t bg-blue-500" style={{height:`${Math.max(8,(row.count/max)*100)}px`}}/><span className="text-[9px] text-slate-400">{row.date.slice(5)}</span></div>; }) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}</div></div>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">External analytics setup</h2><div className="mt-3 flex flex-wrap gap-3 text-sm"><span className={`rounded-full px-3 py-1 ${data.integrations.googleAnalytics?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>Google Analytics: {data.integrations.googleAnalytics?'Configured':'Not configured'}</span><span className={`rounded-full px-3 py-1 ${data.integrations.microsoftClarity?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>Microsoft Clarity: {data.integrations.microsoftClarity?'Configured':'Not configured'}</span></div><p className="mt-3 text-xs text-gray-500"><ExternalLink className="mr-1 inline h-3 w-3"/>Detailed visitor sessions remain in Google Analytics or Microsoft Clarity; this page shows SpecsDekh's own database-backed metrics.</p></section>
      <p className="text-xs text-gray-400">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </>}
  </div>;
}
