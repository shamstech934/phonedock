'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BatteryCharging, Camera, Gamepad2, Search, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parsePhoneFinderQuery } from '@/lib/phone-finder/parse-query';

const EXAMPLES = [
  '50,000 ke andar gaming phone with 8GB RAM and 5G',
  'Best camera phone under 100k with 5000mAh battery',
  'Cheap Samsung PTA approved phone',
  '120Hz AMOLED phone with Snapdragon and 256GB storage',
];

export function SmartPhoneFinder() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('phonedock-finder-history') || '[]')); } catch { setHistory([]); }
  }, []);
  const result = useMemo(() => parsePhoneFinderQuery(query), [query]);

  const findPhones = () => {
    if (!query.trim()) return;
    const nextHistory = [query.trim(), ...history.filter(item => item !== query.trim())].slice(0, 5);
    setHistory(nextHistory);
    localStorage.setItem('phonedock-finder-history', JSON.stringify(nextHistory));
    router.push(`/phones?${result.params.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center max-w-3xl mx-auto">
        <Badge className="rounded-full bg-violet-100 text-violet-700 hover:bg-violet-100"><Sparkles className="w-3.5 h-3.5 mr-1" /> Smart Finder</Badge>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-gray-900 mt-5">Tell us what phone you need</h1>
        <p className="text-gray-500 mt-4 text-base sm:text-lg">Roman Urdu ya English mein budget, RAM, camera, gaming, battery aur brand likhein. PhoneDock automatically matching filters laga dega.</p>
      </div>

      <div className="card-premium p-5 sm:p-8 mt-8">
        <label htmlFor="finder-query" className="text-sm font-semibold text-gray-800">Your requirements</label>
        <textarea id="finder-query" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') findPhones(); }} placeholder="Example: 60,000 ke andar 8GB RAM, 5G aur achi camera wala gaming phone" className="mt-2 w-full min-h-32 rounded-2xl border border-gray-200 bg-white p-4 text-base outline-none focus:ring-2 focus:ring-violet-500 resize-y" />
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button onClick={findPhones} disabled={!query.trim()} className="rounded-xl h-11 bg-violet-600 hover:bg-violet-700"><Search className="w-4 h-4" /> Find matching phones</Button>
          <span className="text-xs text-gray-400 self-center">Ctrl + Enter se bhi search kar sakte hain</span>
        </div>

        {query.trim() && (
          <div className="mt-6 rounded-2xl bg-violet-50 border border-violet-100 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Understood requirements</p><span className="text-xs font-semibold text-violet-700">Confidence {result.confidence}%</span></div>
            <div className="flex flex-wrap gap-2 mt-3">{result.reasons.map(reason => <Badge key={reason} variant="secondary" className="bg-white">{reason}</Badge>)}</div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-700">Recent searches</p>
          <div className="flex flex-wrap gap-2 mt-2">{history.map(item => <button key={item} onClick={() => setQuery(item)} className="px-3 py-2 rounded-xl bg-gray-100 text-sm text-gray-600 hover:bg-violet-50 hover:text-violet-700">{item}</button>)}</div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        <div className="card-premium p-5"><Gamepad2 className="w-6 h-6 text-blue-500" /><h2 className="font-bold mt-3">Gaming & speed</h2><p className="text-sm text-gray-500 mt-1">RAM, chipset, 5G aur high refresh rate filters.</p></div>
        <div className="card-premium p-5"><Camera className="w-6 h-6 text-pink-500" /><h2 className="font-bold mt-3">Camera priority</h2><p className="text-sm text-gray-500 mt-1">50MP, 108MP aur 200MP camera matching.</p></div>
        <div className="card-premium p-5"><BatteryCharging className="w-6 h-6 text-emerald-500" /><h2 className="font-bold mt-3">Battery life</h2><p className="text-sm text-gray-500 mt-1">Large battery aur value-focused choices.</p></div>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /><h2 className="font-bold text-lg">Try an example</h2></div>
        <div className="flex flex-wrap gap-2 mt-3">{EXAMPLES.map(example => <button key={example} onClick={() => setQuery(example)} className="text-left px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-violet-300 hover:text-violet-700 transition-colors">{example}</button>)}</div>
      </div>
    </div>
  );
}
