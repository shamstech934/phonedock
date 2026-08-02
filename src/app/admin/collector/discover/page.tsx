'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState } from 'react';
import { Search, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface DiscoveredModel { name: string; confidence: number; sourceUrl?: string; }

export default function AdminCollectorDiscoverPage() {
  useAdmin();
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');
  const [series, setSeries] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveredModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staging, setStaging] = useState(false);
  const [stagedMessage, setStagedMessage] = useState('');

  const runDiscover = async () => {
    if (!brand.trim()) { setError('Brand is required'); return; }
    setLoading(true); setError(null); setResults([]); setSelected(new Set()); setStagedMessage('');
    try {
      const res = await fetch('/api/collector/discover', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brand.trim(), year: year.trim(), series: series.trim() }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Discovery failed');
      setResults(data.models || []);
      if (!data.models?.length) setError(data.message || 'No models found.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Discovery failed'); }
    finally { setLoading(false); }
  };

  const toggle = (name: string) => setSelected(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });

  const stageSelected = async () => {
    if (!selected.size) return;
    setStaging(true); setError(null);
    try {
      const models = results.filter(m => selected.has(m.name)).map(m => ({ name: m.name, sourceUrl: m.sourceUrl }));
      const res = await fetch('/api/collector/discover/stage', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brand.trim(), models }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data.error || 'Staging failed');
      setStagedMessage(`${data.staged} model(s) added to the Review queue for further enrichment.`);
      setSelected(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : 'Staging failed'); }
    finally { setStaging(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Discover</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Finds real phone model names via web search for a brand/year/series — it never invents names.
          Results still need specs collected and full review before they touch your catalog.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand (required) e.g. Samsung" className="h-10 px-3 rounded-xl border border-gray-200 text-sm" />
          <input value={series} onChange={e => setSeries(e.target.value)} placeholder="Series e.g. Galaxy S" className="h-10 px-3 rounded-xl border border-gray-200 text-sm" />
          <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year e.g. 2024" className="h-10 px-3 rounded-xl border border-gray-200 text-sm" />
        </div>
        <button onClick={runDiscover} disabled={loading} className="mt-3 h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Discover
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">{error}</div>}
      {stagedMessage && <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {stagedMessage}</div>}

      {results.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Found {results.length} model{results.length === 1 ? '' : 's'}</h3>
            <button onClick={stageSelected} disabled={!selected.size || staging} className="h-9 px-3 rounded-lg bg-purple-600 text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
              {staging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Send {selected.size || ''} to Review
            </button>
          </div>
          <div className="space-y-1.5">
            {results.map(m => (
              <label key={m.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(m.name)} onChange={() => toggle(m.name)} />
                <span className="text-sm text-gray-900 flex-1">{m.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.confidence >= 0.6 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{Math.round(m.confidence * 100)}% match</span>
                {m.sourceUrl && <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600"><ExternalLink className="w-3.5 h-3.5" /></a>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
