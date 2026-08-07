import { SystemState } from '@/lib/models';

const KEY = 'fx_usd_pkr';
const TTL_MS = 12 * 60 * 60 * 1000;

export async function getUsdPkrRate(): Promise<{ rate: number; updatedAt: Date | null; source: string }> {
  const envRate = Number(process.env.USD_PKR_RATE || 0);
  try {
    const cached = await SystemState.findOne({ key: KEY }).lean();
    const meta = (cached?.metadata || {}) as { rate?: number; updatedAt?: string; source?: string };
    const updatedAt = meta.updatedAt ? new Date(meta.updatedAt) : null;
    if (Number(meta.rate || 0) > 0 && updatedAt && Date.now() - updatedAt.getTime() < TTL_MS) {
      return { rate: Number(meta.rate), updatedAt, source: meta.source || 'cached' };
    }
  } catch { /* use fetch/env fallback */ }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json', 'User-Agent': 'SpecsDekh-FX/1.0' },
      next: { revalidate: 43200 },
    });
    if (response.ok) {
      const data = await response.json() as { rates?: Record<string, number> };
      const rate = Number(data.rates?.PKR || 0);
      if (Number.isFinite(rate) && rate > 0) {
        const now = new Date();
        await SystemState.findOneAndUpdate(
          { key: KEY },
          { $set: { completed: true, completedAt: now, metadata: { rate, updatedAt: now.toISOString(), source: 'open.er-api.com' } } },
          { upsert: true },
        ).catch(() => undefined);
        return { rate, updatedAt: now, source: 'open.er-api.com' };
      }
    }
  } catch { /* fallback below */ }

  if (Number.isFinite(envRate) && envRate > 0) return { rate: envRate, updatedAt: null, source: 'env' };
  return { rate: 0, updatedAt: null, source: 'unavailable' };
}
