export type FinderIntent = 'gaming' | 'camera' | 'battery' | 'performance' | 'display' | 'value' | 'general';
export type FinderParseResult = { params: URLSearchParams; reasons: string[]; intents: FinderIntent[]; confidence: number; normalizedQuery: string };

const BRAND_ALIASES: Record<string,string> = {
  samsung:'samsung', samung:'samsung', sumsung:'samsung', xiaomi:'xiaomi', mi:'xiaomi', redmi:'redmi', poco:'poco',
  oneplus:'oneplus', 'one plus':'oneplus', oppo:'oppo', vivo:'vivo', realme:'realme', apple:'apple', iphone:'apple',
  infinix:'infinix', tecno:'tecno', techno:'tecno', motorola:'motorola', moto:'motorola', google:'google', pixel:'google',
  honor:'honor', huawei:'huawei', nothing:'nothing', iqoo:'iqoo', sony:'sony', nokia:'nokia'
};

function parseMoney(text: string): number {
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(Number(k[1]) * 1000);
  const plain = text.match(/(?:under|below|andar|tak|budget|less than|upto|up to)\s*(?:rs\.?\s*)?(\d{4,7})|(?:rs\.?\s*)?(\d{4,7})\s*(?:ke andar|tak|budget)/i);
  return Number(plain?.[1] || plain?.[2] || 0);
}

function priceBucket(budget: number): string {
  if (budget <= 20000) return 'under20k';
  if (budget <= 40000) return '20k-40k';
  if (budget <= 60000) return '40k-60k';
  if (budget <= 100000) return '60k-100k';
  return 'above100k';
}

export function parsePhoneFinderQuery(input: string): FinderParseResult {
  const text = input.toLowerCase().replace(/[,،]/g, '').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams();
  const reasons: string[] = [];
  const intents: FinderIntent[] = [];
  let signals = 0;

  const budget = parseMoney(text);
  if (budget > 0) { params.set('price', priceBucket(budget)); reasons.push(`Budget up to Rs ${budget.toLocaleString()}`); signals++; }

  const ram = text.match(/\b(4|6|8|12|16|24)\s*gb\s*(?:ram)?\b/);
  if (ram) { params.set('ram', ram[1]); reasons.push(`${ram[1]}GB+ RAM`); signals++; }
  const storage = text.match(/\b(64|128|256|512|1024)\s*gb\s*(?:storage|rom)?\b/);
  if (storage) { params.set('storage', storage[1]); reasons.push(`${storage[1]}GB+ storage`); signals++; }
  const battery = text.match(/\b(4000|4500|5000|5500|6000|6500|7000)\s*mah\b/);
  if (battery) { params.set('battery', battery[1]); reasons.push(`${battery[1]}mAh+ battery`); signals++; }
  const refresh = text.match(/\b(90|120|144|165)\s*hz\b/);
  if (refresh) { params.set('refresh', refresh[1]); reasons.push(`${refresh[1]}Hz+ display`); signals++; }
  const camera = text.match(/\b(48|50|64|108|200)\s*mp\b/);
  if (camera) { params.set('camera', camera[1]); reasons.push(`${camera[1]}MP+ camera`); signals++; }

  if (/\b5g\b/.test(text)) { params.set('5g','yes'); reasons.push('5G support'); signals++; }
  if (/\bnfc\b/.test(text)) { params.set('nfc','yes'); reasons.push('NFC support'); signals++; }
  if (/pta\s*(?:approved|pass)|approved\s*pta|pta wala|pta chahiye/.test(text)) { params.set('pta','approved'); reasons.push('PTA approved'); signals++; }
  if (/amoled|oled/.test(text)) { params.set('display','amoled'); reasons.push('AMOLED/OLED display'); signals++; }

  if (/snapdragon/.test(text)) { params.set('chipset','Snapdragon'); reasons.push('Snapdragon chipset'); signals++; }
  else if (/dimensity|mediatek/.test(text)) { params.set('chipset','Dimensity'); reasons.push('MediaTek Dimensity chipset'); signals++; }
  else if (/exynos/.test(text)) { params.set('chipset','Exynos'); reasons.push('Exynos chipset'); signals++; }
  else if (/tensor/.test(text)) { params.set('chipset','Tensor'); reasons.push('Google Tensor chipset'); signals++; }

  const brandEntries = Object.entries(BRAND_ALIASES).sort((a,b)=>b[0].length-a[0].length);
  for (const [term, slug] of brandEntries) {
    if (new RegExp(`\\b${term.replace(/ /g,'\\s+')}\\b`).test(text)) { params.set('brand',slug); reasons.push(`${slug[0].toUpperCase()+slug.slice(1)} brand`); signals++; break; }
  }

  if (/gaming|pubg|codm|call of duty|genshin|game/.test(text)) intents.push('gaming');
  if (/camera|photo|photography|portrait|selfie|video|vlog/.test(text)) intents.push('camera');
  if (/battery|long lasting|backup|battery timing/.test(text)) intents.push('battery');
  if (/performance|fast|speed|powerful|processor/.test(text)) intents.push('performance');
  if (/display|screen|amoled|oled|refresh/.test(text)) intents.push('display');
  if (/cheap|budget|sasta|value|paisa vasool|paisa wasool/.test(text)) intents.push('value');
  if (!intents.length) intents.push('general');

  if (intents.includes('gaming') || intents.includes('performance')) { params.set('sort','trending'); reasons.push('Performance-focused ranking'); }
  else if (intents.includes('camera') || intents.includes('battery')) { params.set('sort','rating'); reasons.push(`${intents[0][0].toUpperCase()+intents[0].slice(1)}-focused ranking`); }
  else if (intents.includes('value')) { params.set('sort','price-low'); reasons.push('Value-focused ranking'); }
  else params.set('sort','rating');

  params.set('page','1');
  return { params, reasons: [...new Set(reasons)], intents: [...new Set(intents)], confidence: Math.min(100, 35 + signals * 10), normalizedQuery: text };
}
