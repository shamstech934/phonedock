/**
 * Duplicate detection for Import Engine V2.
 * Uses normalized brand+model as primary key.
 * Tolerates casing, spacing, hyphen, punctuation differences.
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: 'exact' | 'slug' | 'likely' | 'none';
  existingSlug?: string;
  existingPhoneId?: string;
  confidence: number; // 0-1
}

// Normalize for comparison: lowercase, strip non-alphanumeric, collapse spaces
function normalizeForCompare(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
}

/**
 * Build a duplicate check map from existing phones.
 * Returns a Map<string, { slug, phoneId }> keyed by normalized brand+model.
 */
export function buildDuplicateIndex(phones: Array<{ _id: any; slug: string; brandId?: any; brandName?: string; modelName: string }>): Map<string, { slug: string; phoneId: string }> {
  const map = new Map<string, { slug: string; phoneId: string }>();
  for (const p of phones) {
    const key = normalizeForCompare(`${p.brandName || ''} ${p.modelName}`);
    map.set(key, { slug: p.slug, phoneId: p._id?.toString() });
  }
  return map;
}

/**
 * Check if a normalized record is a duplicate of an existing phone.
 */
export function checkDuplicate(
  record: { brand: string; model: string; slug: string; specs?: Record<string, string> },
  duplicateIndex: Map<string, { slug: string; phoneId: string }>,
): DuplicateCheckResult {
  const key = normalizeForCompare(`${record.brand} ${record.model}`);

  const match = duplicateIndex.get(key);
  if (!match) return { isDuplicate: false, matchType: 'none', confidence: 0 };

  // Exact match on brand+model
  if (match.slug === record.slug) {
    return { isDuplicate: true, matchType: 'exact', existingSlug: match.slug, existingPhoneId: match.phoneId, confidence: 1 };
  }

  // Slug match only
  const slugKey = record.slug.toLowerCase();
  for (const [, v] of duplicateIndex) {
    if (v.slug.toLowerCase() === slugKey) {
      return { isDuplicate: true, matchType: 'slug', existingSlug: v.slug, existingPhoneId: v.phoneId, confidence: 0.7 };
    }
  }

  // Likely match (brand+model match but different slug due to minor variants)
  return { isDuplicate: true, matchType: 'likely', existingSlug: match.slug, existingPhoneId: match.phoneId, confidence: 0.5 };
}

/**
 * Generate a duplicate key for a normalized record.
 */
export function getDuplicateKey(brand: string, model: string, specs?: Record<string, string>): string {
  let key = normalizeForCompare(`${brand} ${model}`);
  // Optionally include RAM/storage for variant context
  const ram = specs?.ram?.toLowerCase().replace(/\s/g, '') || '';
  const storage = specs?.storage?.toLowerCase().replace(/\s/g, '') || '';
  if (ram || storage) key += `|${ram}|${storage}`;
  return key;
}