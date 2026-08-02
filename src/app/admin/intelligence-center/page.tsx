'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, RefreshCw, Rocket, ShieldAlert, TrendingDown, TrendingUp, Database, Image as ImageIcon, type LucideIcon } from 'lucide-react';

interface DashboardData {
  generatedAt: string;
  summary: { phones: number; pendingLaunches: number; openIssues: number; missingSpecs: number; missingImages: number; specsCoverage: number; imageCoverage: number; trackedPricePhones: number };
  launches: Array<{ _id: string; brandName: string; modelName: string; sourceTitle: string; availabilityStatus: string; confidencePercent: number; sourceConfidence: { label: string; band: string; reason: string } }>;
  priceSignals: Array<{ phoneId: string; modelName: string; slug: string; status: string; confidence: string; current: number; average: number; range: [number, number] | null; sampleSize: number }>;
}

const money = (value?: number | null) => typeof value === 'number' && value > 0 ? `Rs. ${Math.round(value).toLocaleString('en-PK')}` : '—';

interface SummaryCard { label: string; value: number; icon: LucideIcon; classes: string }

export default function IntelligenceCenterPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/intelligence-center', { credentials: 'include', cache: 'no-store' });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || 'Unable to load intelligence dashboard');
      setData(payload);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load intelligence dashboard'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><BrainCircuit className="h-7 w-7 text-blue-600"/>Intelligence Center</h1><p className="mt-1 text-sm text-slate-500">Launch confidence, price signals and data readiness in one safe review dashboard.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Phones', value: data.summary.phones, icon: Database, classes: 'text-blue-600 bg-blue-50' },
          { label: 'Launch candidates', value: data.summary.pendingLaunches, icon: Rocket, classes: 'text-violet-600 bg-violet-50' },
          { label: 'Open quality issues', value: data.summary.openIssues, icon: ShieldAlert, classes: 'text-amber-600 bg-amber-50' },
          { label: 'Price-tracked phones', value: data.summary.trackedPricePhones, icon: TrendingDown, classes: 'text-emerald-600 bg-emerald-50' },
        ] satisfies SummaryCard[]).map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 inline-flex rounded-xl p-2.5 ${card.classes}`}><Icon className="h-5 w-5"/></div><div className="text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</div><div className="mt-1 text-sm text-slate-500">{card.label}</div></div>; })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900">Specs readiness</h2><span className="text-2xl font-bold text-blue-600">{data.summary.specsCoverage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${data.summary.specsCoverage}%` }}/></div><p className="mt-3 text-sm text-slate-500">{data.summary.missingSpecs.toLocaleString()} active spec-related issues.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-slate-900"><ImageIcon className="h-4 w-4"/>Image readiness</h2><span className="text-2xl font-bold text-cyan-600">{data.summary.imageCoverage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-cyan-500" style={{ width: `${data.summary.imageCoverage}%` }}/></div><p className="mt-3 text-sm text-slate-500">{data.summary.missingImages.toLocaleString()} active image-related issues.</p></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Launch confidence queue</h2><Link href="/admin/launch-intelligence" className="text-sm font-semibold text-blue-600">Review all</Link></div><div className="space-y-3">{data.launches.length === 0 ? <p className="text-sm text-slate-500">No pending launch candidates.</p> : data.launches.map(item => <div key={item._id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{item.brandName} {item.modelName}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.sourceTitle}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${item.confidencePercent >= 80 ? 'bg-emerald-50 text-emerald-700' : item.confidencePercent >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{item.confidencePercent}%</span></div><div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{item.availabilityStatus}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{item.sourceConfidence.label}</span></div></div>)}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900">Price intelligence signals</h2><Link href="/admin/price-tracker" className="text-sm font-semibold text-blue-600">Open tracker</Link></div><div className="space-y-3">{data.priceSignals.length === 0 ? <p className="text-sm text-slate-500">More historical price samples are needed before trends can be estimated.</p> : data.priceSignals.map(item => <div key={item.phoneId} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between"><div><div className="font-semibold text-slate-900">{item.modelName}</div><div className="mt-1 text-xs text-slate-500">{item.sampleSize} samples · {item.confidence} confidence</div></div>{item.status === 'likely-increase' ? <TrendingUp className="h-5 w-5 text-red-500"/> : <TrendingDown className="h-5 w-5 text-emerald-500"/>}</div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="text-slate-400">Current</span><div className="font-semibold text-slate-700">{money(item.current)}</div></div><div><span className="text-slate-400">Average</span><div className="font-semibold text-slate-700">{money(item.average)}</div></div></div><div className="mt-2 text-xs font-medium text-blue-700">{item.status.replaceAll('-', ' ')}</div></div>)}</div></section>
      </div>
      <p className="text-xs text-slate-400">Generated {new Date(data.generatedAt).toLocaleString()}. Signals are decision support only and never auto-publish records.</p>
    </>}
  </div>;
}
