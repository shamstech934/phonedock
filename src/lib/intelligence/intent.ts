export type PreferenceKey = 'camera' | 'gaming' | 'battery' | 'performance' | 'display' | 'value';
export interface BuyingIntent { original: string; normalized: string; budgetMax?: number; ptaRequired: boolean; preferences: PreferenceKey[]; wantsAmoled: boolean; wantsFastCharging: boolean; condition?: 'new' | 'used'; language: 'en' | 'roman-ur' }

const replacements: Array<[RegExp, string]> = [
  [/acha camera|camera acha|photography/gi, 'camera'], [/gaming mobile|pubg|gaming phone/gi, 'gaming'],
  [/battery timing|long battery/gi, 'battery'], [/paisa vasool|value for money/gi, 'value'],
  [/budget phone|sasta mobile/gi, 'budget'], [/pta approved|pta wala/gi, 'pta'],
  [/fast charging|jaldi charge/gi, 'fast charging'], [/box pack|new mobile/gi, 'new'], [/used mobile|second hand/gi, 'used'],
];

export function normalizeSearchIntent(input: string) {
  const safe = input.replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return replacements.reduce((text, [pattern, value]) => text.replace(pattern, value), safe).toLowerCase();
}

export function parseBuyingIntent(input: string): BuyingIntent {
  const normalized = normalizeSearchIntent(input);
  const originalLower = input.toLowerCase();
  const roman = /acha|paisa|vasool|hazar|lakh|wala|jaldi|sasta|mobile/.test(originalLower);
  let budgetMax: number | undefined;
  const amount = normalized.match(/(?:under|below|budget|max|tak)?\s*(\d+(?:\.\d+)?)\s*(k|hazar|lakh)?/i);
  if (amount) {
    const raw = Number(amount[1]); const unit = amount[2]?.toLowerCase();
    const value = unit === 'lakh' ? raw * 100_000 : (unit === 'k' || unit === 'hazar') ? raw * 1_000 : raw;
    if (value >= 5_000 && value <= 2_000_000) budgetMax = Math.round(value);
  }
  const preferences: PreferenceKey[] = [];
  if (/camera|photo/.test(normalized)) preferences.push('camera');
  if (/gaming|pubg|fps/.test(normalized)) preferences.push('gaming');
  if (/battery/.test(normalized)) preferences.push('battery');
  if (/performance|fast phone|speed/.test(normalized)) preferences.push('performance');
  if (/display|amoled|screen/.test(normalized)) preferences.push('display');
  if (/value|budget/.test(normalized)) preferences.push('value');
  return { original: input.slice(0, 300), normalized, budgetMax, ptaRequired: /\bpta\b/.test(normalized), preferences: [...new Set(preferences)], wantsAmoled: /amoled|oled/.test(normalized), wantsFastCharging: /fast charging/.test(normalized), condition: /\bused\b/.test(normalized) ? 'used' : /\bnew\b/.test(normalized) ? 'new' : undefined, language: roman ? 'roman-ur' : 'en' };
}
