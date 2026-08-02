'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, ExternalLink, Info, RefreshCw, Search, XCircle } from 'lucide-react';

type Status = 'pass' | 'warning' | 'fail' | 'info';
interface SeoCheck { key: string; label: string; status: Status; detail: string; }
interface SeoData {
  generatedAt: string;
  baseUrl: string;
  summary: {
    totalPhones: number;
    publishedPhones: number;
    eligiblePhones: number;
    excludedPublishedPhones: number;
    totalBrands: number;
    activeBrands: number;
    brandsWithPublishedPhones: number;
    emptyBrands: number;
  };
  endpoints: { sitemap: string; robots: string; googleSearchConsole: string; bingWebmaster: string; };
  checks: SeoCheck[];
  examples: { missingSlug: Array<{ id: string; label: string }>; missingPrice: Array<{ id: string; label: string; slug: string }>; };
}

const meta: Record<Status, { icon: typeof CheckCircle2; classes: string; label: string }> = {
  pass: { icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', label: 'Pass' },
  warning: { icon: AlertTriangle, classes: 'border-amber-200 bg-amber-50 text-amber-800', label: 'Review' },
  fail: { icon: XCircle, classes: 'border-rose-200 bg-rose-50 text-rose-800', label: 'Fail' },
  info: { icon: Info, classes: 'border-blue-200 bg-blue-50 text-blue-800', label: 'Info' },
};

export default function SeoMonitoringPage() {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/seo-monitoring', { credentials: 'include', cache: 'no-store' });
      const json = await readApiResponse<SeoData & { error?: string }>(response).catch(() => null);
      if (!response.ok || !json) throw new Error(json?.error || 'SEO monitoring failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load SEO monitoring');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1500);
  }

  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600"><Search className="h-4 w-4"/> Search Visibility</div><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">SEO Monitoring Center</h1><p className="mt-1 text-sm text-slate-600">Indexability, sitemap and verification checks without paid APIs.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh audit</button>
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Published phones', data.summary.publishedPhones],
          ['SEO eligible phones', data.summary.eligiblePhones],
          ['Published needing review', data.summary.excludedPublishedPhones],
          ['Empty active brands', data.summary.emptyBrands],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-black text-slate-950">{value}</div></div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.checks.map((check) => { const item = meta[check.status]; const Icon = item.icon; return <div key={check.key} className={`rounded-2xl border p-5 ${item.classes}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="font-bold">{check.label}</div><div className="mt-1 break-all text-sm opacity-90">{check.detail}</div><div className="mt-2 text-xs font-bold uppercase tracking-wider">{item.label}</div></div></div></div>; })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[['Sitemap URL', data.endpoints.sitemap, 'sitemap'], ['Robots URL', data.endpoints.robots, 'robots']].map(([label, url, key]) => <div key={key} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-900">{label}</div><div className="mt-2 break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{url}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void copy(url, key)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Clipboard className="h-4 w-4"/>{copied === key ? 'Copied' : 'Copy'}</button><a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4"/>Open</a></div></div>)}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Submit and monitor</h2><p className="mt-1 text-sm text-slate-600">Submit the sitemap once, then use each platform to monitor indexing and crawl issues.</p><div className="mt-4 flex flex-wrap gap-3"><a href={data.endpoints.googleSearchConsole} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"><ExternalLink className="h-4 w-4"/>Google Search Console</a><a href={data.endpoints.bingWebmaster} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold text-slate-800"><ExternalLink className="h-4 w-4"/>Bing Webmaster</a></div>
      </div>

      {(data.examples.missingSlug.length > 0 || data.examples.missingPrice.length > 0) && <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black text-slate-950">Published phones missing slug</h3><div className="mt-3 space-y-2 text-sm">{data.examples.missingSlug.length ? data.examples.missingSlug.map(item => <div key={item.id} className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">{item.label}</div>) : <div className="text-slate-500">None</div>}</div></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black text-slate-950">Published phones missing price</h3><div className="mt-3 space-y-2 text-sm">{data.examples.missingPrice.length ? data.examples.missingPrice.map(item => <div key={item.id} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{item.label}</div>) : <div className="text-slate-500">None</div>}</div></div>
      </div>}
      <div className="text-xs text-slate-500">Generated {new Date(data.generatedAt).toLocaleString()}. Search Console indexing data remains authoritative.</div>
    </>}
    {loading && !data && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Running SEO checks…</div>}
  </div>;
}
