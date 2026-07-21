/** Parse an integer query value without allowing NaN, decimals, negatives or huge limits. */
export function parseBoundedInt(
  value: string | null | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const min = options.min ?? 1;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
