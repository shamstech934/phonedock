'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BatteryCharging, Camera, Gamepad2, Search, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const EXAMPLES = [
  '50,000 ke andar gaming phone with 8GB RAM and 5G',
  'Best camera phone under 100k with 5000mAh battery',
  'Cheap Samsung PTA approved phone',
  '120Hz AMOLED phone with Snapdragon and 256GB storage',
];

type FinderResult = { params: URLSearchParams; reasons: string[] };

function parseRequest(input: string): FinderResult {
  const text = input.toLowerCase().replace(/,/g, '');
  const params = new URLSearchParams();
  const reasons: string[] = [];

  const budgetMatch = text.match(/(?:under|andar|below|less than|tak)\s*(?:rs\.?\s*)?(\d{4,6})|(?:rs\.?\s*)?(\d{4,6})\s*(?:ke andar|tak|budget)/i);
  const budget = Number(budgetMatch?.[1] || budgetMatch?.[2] || 0);
  if (budget) {
    const price = budget <= 20000 ? 'under20k' : budget <= 40000 ? '20k-40k' : budget <= 60000 ? '40k-60k' : budget <= 100000 ? '60k-100k' : 'above100k';
    params.set('price', price);
    reasons.push(`Budget around Rs ${budget.toLocaleString()}`);
  }

  const ram = text.match(/(4|6|8|12|16)\s*gb\s*ram/);
  if (ram) { params.set('ram', ram[1]); reasons.push(`${ram[1]}GB+ RAM`); }
  const storage = text.match(/(64|128|256|512|1024)\s*gb(?:\s*storage)?/);
  if (storage) { params.set('storage', storage[1]); reasons.push(`${storage[1]}GB+ storage`); }
  const battery = text.match(/(4000|4500|5000|5500|6000)\s*mah/);
  if (battery) { params.set('battery', battery[1]); reasons.push(`${battery[1]}mAh+ battery`); }
  const refresh = text.match(/(90|120|144)\s*hz/);
  if (refresh) { params.set('refresh', refresh[1]); reasons.push(`${refresh[1]}Hz display`); }

  if (/5g/.test(text)) { params.set('5g', 'yes'); reasons.push('5G support'); }
  if (/nfc/.test(text)) { params.set('nfc', 'yes'); reasons.push('NFC support'); }
  if (/pta\s*(approved|pass)|approved pta/.test(text)) { params.set('pta', 'approved'); reasons.push('PTA approved'); }
  if (/snapdragon/.test(text)) { params.set('chipset', 'Snapdragon'); reasons.push('Snapdragon chipset'); }
  else if (/dimensity/.test(text)) { params.set('chipset', 'Dimensity'); reasons.push('MediaTek Dimensity chipset'); }
  else if (/exynos/.test(text)) { params.set('chipset', 'Exynos'); reasons.push('Exynos chipset'); }

  const brands: Record<string, string> = { samsung: 'samsung', xiaomi: 'xiaomi', redmi: 'redmi', poco: 'poco', oneplus: 'oneplus', oppo: 'oppo', vivo: 'vivo', realme: 'realme', apple: 'apple', iphone: 'apple', infinix: 'infinix', tecno: 'tecno', motorola: 'motorola', google: 'google' };
  for (const [term, slug] of Object.entries(brands)) {
    if (text.includes(term)) { params.set('brand', slug); reasons.push(`${term[0].toUpperCase()}${term.slice(1)} brand`); break; }
  }

  if (/gaming|pubg|performance|fast/.test(text)) { params.set('sort', 'trending'); reasons.push('Performance-focused ranking'); }
  else if (/camera|photo|video|portrait/.test(text)) { params.set('camera', text.includes('200mp') ? '200' : text.includes('108mp') ? '108' : '50'); params.set('sort', 'rating'); reasons.push('Camera-focused results'); }
  else if (/battery|long lasting/.test(text)) { if (!params.has('battery')) params.set('battery', '5000'); params.set('sort', 'rating'); reasons.push('Battery-focused results'); }
  else if (/cheap|budget|sasta/.test(text)) { params.set('sort', 'price-low'); reasons.push('Lowest price first'); }
  else { params.set('sort', 'rating'); reasons.push('Best rated first'); }

  params.set('page', '1');
  return { params, reasons };
}

export function SmartPhoneFinder() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const result = useMemo(() => parseRequest(query), [query]);

  const findPhones = () => {
    if (!query.trim()) return;
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
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Understood requirements</p>
            <div className="flex flex-wrap gap-2 mt-3">{result.reasons.map(reason => <Badge key={reason} variant="secondary" className="bg-white">{reason}</Badge>)}</div>
          </div>
        )}
      </div>

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
