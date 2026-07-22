'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { formatPrice } from '@/components/shared/formatPrice';

type Alternative = {
  type: 'cheaper' | 'upgrade' | 'balanced';
  phone: { slug: string; modelName: string; pricePKR: number };
  reason: string;
  priceDifference: number;
};

type Result = {
  phone: {
    slug: string;
    modelName: string;
    pricePKR: number;
    href: string;
    brand?: { name: string };
  };
  matchPercentage: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  compromises: string[];
  verdict: string;
  dataFreshness: string;
  missingData: string[];
  alternatives: Alternative[];
};

type AssistantResponse = {
  results?: Result[];
  warnings?: string[];
  intent?: {
    budgetMax?: number;
    ptaRequired?: boolean;
    preferences?: string[];
    language?: 'en' | 'roman-ur';
  };
  error?: string;
};

const QUICK_PROMPTS = [
  'Best gaming phone under 80 hazar with PTA',
  'Camera aur battery ke liye 1 lakh tak best mobile',
  'Paisa vasool AMOLED phone under 60k',
  'Samsung ya Xiaomi under 100k for daily use',
];

const confidenceClass: Record<Result['confidence'], string> = {
  high: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function BuyingAssistantPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [intent, setIntent] = useState<AssistantResponse['intent']>();
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  async function runSearch(value: string) {
    const cleanQuery = value.trim();
    if (cleanQuery.length < 3 || loading) return;

    setLoading(true);
    setError('');
    setWarnings([]);
    setHasSearched(true);

    try {
      const response = await fetch('/api/buying-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const data = (await response.json()) as AssistantResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to search right now.');
      setResults(data.results || []);
      setWarnings(data.warnings || []);
      setIntent(data.intent);
    } catch (value) {
      setResults([]);
      setIntent(undefined);
      setError(value instanceof Error ? value.message : 'Unable to search right now.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query);
  }

  function usePrompt(prompt: string) {
    setQuery(prompt);
    void runSearch(prompt);
  }

  return (
    <>
      <Header />
      <main className="min-h-[70vh] bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm sm:p-9 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
              <Sparkles className="h-4 w-4" /> PhoneDock Smart Buying Assistant
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              Apna budget aur priorities batao — verified data se best phones dekho.
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              English ya Roman Urdu mein gaming, camera, battery, PTA aur budget likhein. Assistant missing data ko chupata nahi hai.
            </p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="buying-query">Phone requirements</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="buying-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  required
                  minLength={3}
                  maxLength={300}
                  placeholder="Misal: 80 hazar mein gaming aur camera phone with PTA"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-slate-950 outline-none ring-blue-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <button
                disabled={loading || query.trim().length < 3}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {loading ? 'Checking...' : 'Recommend'}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => usePrompt(prompt)}
                  className="rounded-full border border-blue-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> {error}
            </p>
          )}

          {warnings.map((item) => (
            <p key={item} className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {item}
            </p>
          ))}

          {intent && results.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {intent.budgetMax ? <span className="rounded-full bg-white px-3 py-2 shadow-sm dark:bg-slate-900">Budget: {formatPrice(intent.budgetMax)}</span> : null}
              {intent.ptaRequired ? <span className="rounded-full bg-white px-3 py-2 shadow-sm dark:bg-slate-900">PTA required</span> : null}
              {intent.preferences?.map((preference) => <span key={preference} className="rounded-full bg-white px-3 py-2 capitalize shadow-sm dark:bg-slate-900">{preference}</span>)}
            </div>
          )}

          {!loading && hasSearched && !error && results.length === 0 && (
            <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Verified match nahi mila</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">Budget thora barha kar, brand restriction hata kar, ya PTA requirement ke baghair dobara try karein.</p>
            </section>
          )}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {results.map((item) => (
              <article key={item.phone.slug} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.phone.brand?.name || 'PhoneDock pick'}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{item.phone.modelName}</h2>
                    <p className="mt-2 font-black text-blue-600 dark:text-blue-400">{formatPrice(item.phone.pricePKR)}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">{item.matchPercentage}% match</span>
                    <span className={`mt-2 block rounded-full px-2 py-1 text-[11px] font-bold uppercase ring-1 ${confidenceClass[item.confidence]}`}>{item.confidence} confidence</span>
                  </div>
                </div>

                <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200">{item.verdict}</p>

                {item.reasons.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {item.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {reason}</li>
                    ))}
                  </ul>
                )}

                {item.compromises.length > 0 && <p className="mt-4 text-xs text-amber-700 dark:text-amber-300"><strong>Compromises:</strong> {item.compromises.join('; ')}</p>}
                {item.missingData.length > 0 && <p className="mt-2 text-xs text-slate-500"><strong>Data to verify:</strong> {item.missingData.join(', ')}</p>}
                <p className="mt-2 text-xs text-slate-500">{item.dataFreshness}</p>

                {item.alternatives?.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Other options</p>
                    <div className="mt-2 space-y-2">
                      {item.alternatives.slice(0, 2).map((alternative) => (
                        <Link key={`${item.phone.slug}-${alternative.phone.slug}`} href={`/phones/${alternative.phone.slug}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm transition hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800">
                          <span><strong>{alternative.phone.modelName}</strong><span className="block text-xs text-slate-500">{alternative.reason}</span></span>
                          <span className="ml-3 shrink-0 font-bold text-slate-700 dark:text-slate-200">{formatPrice(alternative.phone.pricePKR)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <Link href={item.phone.href} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-blue-700 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-200">
                  View phone <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
