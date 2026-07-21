export const MIN_COMPARE_PHONES = 2;
export const MAX_COMPARE_PHONES = 6;

export function normalizeCompareValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const value of raw.split(',')) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    values.push(clean);
    if (values.length === MAX_COMPARE_PHONES) break;
  }
  return values;
}

export function canAddComparePhone(currentCount: number): boolean {
  return currentCount < MAX_COMPARE_PHONES;
}
