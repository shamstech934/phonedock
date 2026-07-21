export function formatCardScore(value: unknown): string | null {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score) || score <= 0) return null;
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, '');
}
