/** Duplicate detection shared by Import Engine V2. */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: 'exact' | 'slug' | 'likely' | 'none';
  existingSlug?: string;
  existingPhoneId?: string;
  confidence: number;
}

type DuplicateEntry = { slug: string; phoneId: string; normalizedName: string; tokens: string[] };
export type DuplicateIndex = Map<string, DuplicateEntry>;

const NOISE_TOKENS = new Set(['smartphone', 'mobile', 'phone', 'official', 'global', 'edition', '5g', '4g', 'lte']);

export function normalizePhoneIdentity(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(5g|4g|lte)\b/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token && !NOISE_TOKENS.has(token))
    .join(' ');
}

function compact(value: string): string {
  return normalizePhoneIdentity(value).replace(/\s+/g, '');
}

function tokens(value: string): string[] {
  return normalizePhoneIdentity(value).split(' ').filter(Boolean);
}

function tokenSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter(token => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

export function buildDuplicateIndex(phones: Array<{ _id: { toString(): string }; slug: string; brandId?: { toString(): string }; brandName?: string; modelName: string }>): DuplicateIndex {
  const map: DuplicateIndex = new Map();
  for (const phone of phones) {
    const normalizedName = normalizePhoneIdentity(`${phone.brandName || ''} ${phone.modelName}`);
    const entry = { slug: phone.slug, phoneId: phone._id?.toString(), normalizedName, tokens: tokens(normalizedName) };
    map.set(compact(normalizedName), entry);
    map.set(`slug:${compact(phone.slug)}`, entry);
  }
  return map;
}

export function checkDuplicate(
  record: { brand: string; model: string; slug: string; specs?: Record<string, string> },
  duplicateIndex: DuplicateIndex,
): DuplicateCheckResult {
  const normalizedName = normalizePhoneIdentity(`${record.brand} ${record.model}`);
  const exact = duplicateIndex.get(compact(normalizedName));
  if (exact) {
    const sameSlug = compact(exact.slug) === compact(record.slug);
    return {
      isDuplicate: true,
      matchType: sameSlug ? 'exact' : 'likely',
      existingSlug: exact.slug,
      existingPhoneId: exact.phoneId,
      confidence: sameSlug ? 1 : 0.94,
    };
  }

  const slugMatch = duplicateIndex.get(`slug:${compact(record.slug)}`);
  if (slugMatch) {
    return { isDuplicate: true, matchType: 'slug', existingSlug: slugMatch.slug, existingPhoneId: slugMatch.phoneId, confidence: 0.98 };
  }

  // Conservative fuzzy match: strong token overlap plus same brand token.
  const incomingTokens = tokens(normalizedName);
  const incomingBrand = tokens(record.brand)[0];
  let best: { entry: DuplicateEntry; similarity: number } | null = null;
  const uniqueEntries = new Map<string, DuplicateEntry>();
  duplicateIndex.forEach(entry => uniqueEntries.set(entry.phoneId, entry));
  for (const entry of uniqueEntries.values()) {
    if (incomingBrand && !entry.tokens.includes(incomingBrand)) continue;
    const similarity = tokenSimilarity(incomingTokens, entry.tokens);
    if (!best || similarity > best.similarity) best = { entry, similarity };
  }

  if (best && best.similarity >= 0.84) {
    return {
      isDuplicate: true,
      matchType: 'likely',
      existingSlug: best.entry.slug,
      existingPhoneId: best.entry.phoneId,
      confidence: Math.min(0.93, Number(best.similarity.toFixed(2))),
    };
  }

  return { isDuplicate: false, matchType: 'none', confidence: 0 };
}

export function getDuplicateKey(brand: string, model: string, specs?: Record<string, string>): string {
  let key = compact(`${brand} ${model}`);
  const ram = compact(specs?.ram || '');
  const storage = compact(specs?.storage || '');
  if (ram || storage) key += `|${ram}|${storage}`;
  return key;
}
