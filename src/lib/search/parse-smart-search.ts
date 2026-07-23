export type SmartSearchIntent = {
  original: string;
  text: string;
  maxPrice?: number;
  minPrice?: number;
  chipset?: string;
  display?: string;
  refresh?: number;
  camera?: number;
  battery?: number;
  ram?: number;
  storage?: number;
  fiveG?: 'yes';
  nfc?: 'yes';
  pta?: 'approved';
  sort?: 'camera' | 'performance' | 'battery' | 'value';
  detected: string[];
};

const FEATURE_WORDS = new Set([
  'best', 'phone', 'phones', 'mobile', 'mobiles', 'under', 'below', 'within', 'upto', 'up', 'to',
  'andar', 'neeche', 'kam', 'mein', 'mai', 'me', 'ka', 'ki', 'ke', 'liye', 'wala', 'wali', 'with',
  'budget', 'price', 'pkr', 'rs', 'rupees', 'hazar', 'hazaar', 'lakh', 'lac', 'gaming', 'camera',
  'battery', 'performance', 'value', 'pta', 'approved', '5g', 'nfc', 'amoled', 'oled', 'display',
]);

function normalizeNumber(raw: string, suffix?: string): number {
  const value = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(value)) return 0;
  const normalizedSuffix = (suffix || '').toLowerCase();
  if (normalizedSuffix === 'k' || normalizedSuffix.includes('hazar') || normalizedSuffix.includes('hazaar')) return Math.round(value * 1000);
  if (normalizedSuffix === 'lakh' || normalizedSuffix === 'lac') return Math.round(value * 100000);
  return Math.round(value);
}

export function parseSmartSearch(input: string): SmartSearchIntent {
  const original = input.trim();
  const normalized = original.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const detected: string[] = [];
  const intent: SmartSearchIntent = { original, text: original, detected };

  const budgetMatch = normalized.match(/(?:under|below|upto|up to|andar|neeche|kam(?:\s+se)?|within)\s*(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?(?:,\d{3})*)\s*(k|hazar|hazaar|lakh|lac)?/i)
    || normalized.match(/(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?(?:,\d{3})*)\s*(k|hazar|hazaar|lakh|lac)\s*(?:tak|andar|under|below)?/i);
  if (budgetMatch) {
    const amount = normalizeNumber(budgetMatch[1], budgetMatch[2]);
    if (amount >= 5000 && amount <= 2000000) {
      intent.maxPrice = amount;
      detected.push(`Under PKR ${amount.toLocaleString('en-PK')}`);
    }
  }

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(k|hazar|hazaar|lakh|lac)?\s*(?:to|se|\-|–)\s*(\d+(?:\.\d+)?)\s*(k|hazar|hazaar|lakh|lac)?/i);
  if (rangeMatch) {
    const min = normalizeNumber(rangeMatch[1], rangeMatch[2] || rangeMatch[4]);
    const max = normalizeNumber(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
    if (min > 0 && max > min) {
      intent.minPrice = min;
      intent.maxPrice = max;
      detected.push(`PKR ${min.toLocaleString('en-PK')}–${max.toLocaleString('en-PK')}`);
    }
  }

  const ram = normalized.match(/\b(2|3|4|6|8|12|16|24)\s*gb\s*ram\b/i);
  if (ram) { intent.ram = Number(ram[1]); detected.push(`${ram[1]}GB RAM`); }
  const storage = normalized.match(/\b(32|64|128|256|512|1024)\s*gb(?:\s*storage)?\b/i);
  if (storage) { intent.storage = Number(storage[1]); detected.push(storage[1] === '1024' ? '1TB storage' : `${storage[1]}GB storage`); }
  const refresh = normalized.match(/\b(90|120|144|165)\s*hz\b/i);
  if (refresh) { intent.refresh = Number(refresh[1]); detected.push(`${refresh[1]}Hz+`); }
  const camera = normalized.match(/\b(50|64|108|200)\s*mp\b/i);
  if (camera) { intent.camera = Number(camera[1]); detected.push(`${camera[1]}MP+ camera`); }
  const battery = normalized.match(/\b(4000|4500|5000|5500|6000|7000)\s*mah\b/i);
  if (battery) { intent.battery = Number(battery[1]); detected.push(`${battery[1]}mAh+`); }

  if (/\b(snapdragon|dimensity|exynos|helio|unisoc|tensor|apple\s+a\d+)\b/i.test(normalized)) {
    const match = normalized.match(/\b(snapdragon|dimensity|exynos|helio|unisoc|tensor|apple\s+a\d+)\b/i)!;
    intent.chipset = match[1].replace(/\b\w/g, c => c.toUpperCase());
    detected.push(intent.chipset);
  }
  if (/\bamoled\b/i.test(normalized)) { intent.display = 'AMOLED'; detected.push('AMOLED'); }
  else if (/\boled\b/i.test(normalized)) { intent.display = 'OLED'; detected.push('OLED'); }
  else if (/\bips(?:\s+lcd)?\b/i.test(normalized)) { intent.display = 'IPS LCD'; detected.push('IPS LCD'); }
  if (/\b5g\b/i.test(normalized)) { intent.fiveG = 'yes'; detected.push('5G'); }
  if (/\bnfc\b/i.test(normalized)) { intent.nfc = 'yes'; detected.push('NFC'); }
  if (/\bpta(?:\s+approved)?\b/i.test(normalized)) { intent.pta = 'approved'; detected.push('PTA approved'); }

  if (/\bgaming|performance|pubg|codm|genshin\b/i.test(normalized)) intent.sort = 'performance';
  else if (/\bcamera|photo|photography|video\b/i.test(normalized)) intent.sort = 'camera';
  else if (/\bbattery|backup|lasting\b/i.test(normalized)) intent.sort = 'battery';
  else if (/\bvalue|paisa vasool|budget\b/i.test(normalized)) intent.sort = 'value';
  if (intent.sort) detected.push(intent.sort);

  const cleanText = normalized
    .replace(/(?:under|below|upto|up to|andar|neeche|kam(?:\s+se)?|within)\s*(?:rs\.?|pkr)?\s*\d+(?:\.\d+)?(?:,\d{3})*\s*(?:k|hazar|hazaar|lakh|lac)?/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:k|hazar|hazaar|lakh|lac)\s*(?:tak|andar|under|below)?/gi, ' ')
    .replace(/\b(?:2|3|4|6|8|12|16|24)\s*gb\s*ram\b/gi, ' ')
    .replace(/\b(?:32|64|128|256|512|1024)\s*gb(?:\s*storage)?\b/gi, ' ')
    .replace(/\b(?:90|120|144|165)\s*hz\b/gi, ' ')
    .replace(/\b(?:50|64|108|200)\s*mp\b/gi, ' ')
    .replace(/\b(?:4000|4500|5000|5500|6000|7000)\s*mah\b/gi, ' ')
    .split(/\s+/)
    .filter(word => word && !FEATURE_WORDS.has(word))
    .join(' ')
    .trim();
  intent.text = cleanText || '';
  return intent;
}

export function smartSearchToPhonesUrl(intent: SmartSearchIntent): string {
  const params = new URLSearchParams();
  if (intent.text) params.set('q', intent.text);
  if (intent.minPrice) params.set('priceMin', String(intent.minPrice));
  if (intent.maxPrice) params.set('priceMax', String(intent.maxPrice));
  if (intent.ram) params.set('ram', String(intent.ram));
  if (intent.storage) params.set('storage', String(intent.storage));
  if (intent.display) params.set('display', intent.display);
  if (intent.refresh) params.set('refresh', String(intent.refresh));
  if (intent.camera) params.set('camera', String(intent.camera));
  if (intent.battery) params.set('battery', String(intent.battery));
  if (intent.chipset) params.set('chipset', intent.chipset);
  if (intent.fiveG) params.set('5g', intent.fiveG);
  if (intent.nfc) params.set('nfc', intent.nfc);
  if (intent.pta) params.set('pta', intent.pta);
  if (intent.sort) { params.set('sort', intent.sort); params.set('order', 'desc'); }
  return `/phones${params.size ? `?${params.toString()}` : ''}`;
}
