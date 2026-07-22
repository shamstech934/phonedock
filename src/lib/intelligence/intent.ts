export type PreferenceKey = 'camera' | 'gaming' | 'battery' | 'performance' | 'display' | 'value';
export interface BuyingIntent {
  original: string;
  normalized: string;
  budgetMax?: number;
  ptaRequired: boolean;
  preferences: PreferenceKey[];
  wantsAmoled: boolean;
  wantsFastCharging: boolean;
  condition?: 'new' | 'used';
  language: 'en' | 'roman-ur';
}

const replacements: Array<[RegExp, string]> = [
  [/acha camera|camera acha|camera behtar|photography|photos? ach[ei]/gi, 'camera'],
  [/gaming mobile|gaming phone|pubg|codm|call of duty|genshin|games? ke liye/gi, 'gaming'],
  [/battery timing|long battery|battery backup|zyada battery|battery ach[ei]/gi, 'battery'],
  [/paisa vasool|paisa wasool|value for money|best value/gi, 'value'],
  [/budget phone|budget mobile|sasta mobile|kam price/gi, 'budget'],
  [/pta approved|pta pass|pta wala|approved pta/gi, 'pta'],
  [/fast charging|jaldi charge|tez charging/gi, 'fast charging'],
  [/box pack|new mobile|naya mobile/gi, 'new'],
  [/used mobile|second hand|purana mobile/gi, 'used'],
  [/display ach[ei]|screen ach[ei]/gi, 'display'],
  [/fast mobile|tez mobile|powerful processor/gi, 'performance'],
];

export function normalizeSearchIntent(input: string) {
  const safe = input.replace(/[<>\u0000-\u001f]/g, ' ').replace(/[,،]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return replacements.reduce((text, [pattern, value]) => text.replace(pattern, value), safe).toLowerCase();
}

function parseBudget(normalized: string): number | undefined {
  const lakh = normalized.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100_000);

  const thousand = normalized.match(/(\d+(?:\.\d+)?)\s*(?:k|hazar|hazaar)\b/i);
  if (thousand) return Math.round(Number(thousand[1]) * 1_000);

  const currency = normalized.match(/(?:under|below|budget|max|upto|up to|tak|andar|ke andar)?\s*(?:pkr|rs\.?|rupees?)?\s*(\d{4,7})\b/i);
  if (!currency) return undefined;
  const value = Number(currency[1]);
  return value >= 5_000 && value <= 2_000_000 ? Math.round(value) : undefined;
}

export function parseBuyingIntent(input: string): BuyingIntent {
  const normalized = normalizeSearchIntent(input);
  const originalLower = input.toLowerCase();
  const roman = /acha|achi|paisa|vasool|wasool|hazar|hazaar|lakh|wala|wali|jaldi|sasta|mobile|chahiye|chaye|andar|tak|aur|ya/.test(originalLower);
  const budgetMax = parseBudget(normalized);
  const preferences: PreferenceKey[] = [];

  if (/camera|photo|portrait|selfie|video|vlog/.test(normalized)) preferences.push('camera');
  if (/gaming|pubg|codm|genshin|fps|game/.test(normalized)) preferences.push('gaming');
  if (/battery|backup/.test(normalized)) preferences.push('battery');
  if (/performance|fast phone|speed|processor|powerful/.test(normalized)) preferences.push('performance');
  if (/display|amoled|oled|screen|refresh/.test(normalized)) preferences.push('display');
  if (/value|budget|cheap|sasta/.test(normalized)) preferences.push('value');

  return {
    original: input.slice(0, 300),
    normalized,
    budgetMax,
    ptaRequired: /\bpta\b/.test(normalized),
    preferences: [...new Set(preferences)],
    wantsAmoled: /amoled|oled/.test(normalized),
    wantsFastCharging: /fast charging/.test(normalized),
    condition: /\bused\b/.test(normalized) ? 'used' : /\bnew\b/.test(normalized) ? 'new' : undefined,
    language: roman ? 'roman-ur' : 'en',
  };
}
